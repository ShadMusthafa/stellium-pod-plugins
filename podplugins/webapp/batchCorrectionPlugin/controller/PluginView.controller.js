sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/base/Log',
    '../utils/formatter',
    'sap/m/MessageBox',
    'sap/m/MessageToast'
  ],
  function(JSONModel, PluginViewController, Log, formatter, MessageBox, MessageToast) {
    'use strict';

    var oLogger = Log.getLogger('batchCorrectionPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend('stellium.ext.podplugins.batchCorrectionPlugin.controller.PluginView', {
      metadata: {
        properties: {}
      },

      oFormatter: formatter,

      onInit: function() {
        if (PluginViewController.prototype.onInit) {
          PluginViewController.prototype.onInit.apply(this, arguments);
        }

        this.currentScaleFactor = 1;

        var oView = this.getView();
        var oViewData = {
          calcGRQty: 0,
          calcGrUOM: '',
          isCheckEnabled: false,
          scaleFactor: {
            value: 1,
            min: 1,
            // max: 15,
            stepSize: 1,
            precision: 0
          }
        };
        oView.setModel(new JSONModel(oViewData), 'viewModel');
        oView.setModel(new JSONModel([]), 'routingData');
        oView.setModel(new JSONModel({}), 'giData');
      },

      /**
     * @see PluginViewController.onBeforeRenderingPlugin()
     */
      onBeforeRenderingPlugin: function() {
        this.subscribe('orderSelectionEvent', this.handleOrderSelectionEvent, this);
        this.publish('requestForOrderData', { source: this, sendToAllPages: true });
      },

      onExit: function() {
        if (PluginViewController.prototype.onExit) {
          PluginViewController.prototype.onExit.apply(this, arguments);
        }

        this.unsubscribe('orderSelectionEvent', this.handleOrderSelectionEvent, this);
      },

      onBeforeRendering: function() {},

      onAfterRendering: function() {},

      handleOrderSelectionEvent: async function(sChannelId, sEventId, oData) {
        console.log('Order selection event', oData);
        var oView = this.getView();

        //Reset the scaleFactor and calculated GR quantity
        var oViewModel = oView.getModel('viewModel');
        oViewModel.setProperty('/calcGRQty', 0);
        oViewModel.setProperty('/calcGrUOM', '');
        oViewModel.setProperty('/scaleFactor', {
          value: 1,
          min: 1,
          stepSize: 1,
          precision: 0
        });

        this.selectedOrder = oData;

        //Get routing information for selected order
        var aRoutingData = await this._getRoutingDetailsForOrder(oData.order);
        oView.getModel('routingData').setData(aRoutingData);
        console.log('Routing Data ', aRoutingData);

        var oBatchCorrectionInfo = await this._getBatchCorrectionData().catch(oError => {
          return [];
        });
        
        //If batch correction items exist, then get the items applicable for selected phase
        // this.batchCorrItems = [];
        this.batchCorrItems = oBatchCorrectionInfo.content;
        // if (oBatchCorrectionInfo && oBatchCorrectionInfo.content && oBatchCorrectionInfo.content.length > 0) {
        //   var sStepId = this.getPodSelectionModel().selectedPhaseData.stepId;
        //   this.batchCorrItems = oBatchCorrectionInfo.content.filter(oItem => oItem.phase === sStepId);
        // }

        //Get goods issue summary for the components
        var aLineItems = await this._getGoodsIssueSummaryForOrder(oData.order);
        //Apply the correction entries
        if (this.batchCorrItems.length > 0) {
          aLineItems.forEach(oItem => {
            var oCorrItem = this.batchCorrItems.find(val => val.component === oItem.materialId.material);
            if (!oCorrItem) return;

            // oItem.toleranceOver = oCorrItem.approvedTUpper;
            // oItem.toleranceUnder = oCorrItem.approvedTLower;
            oItem.recipeComponentToleranceOver = oCorrItem.approvedTUpper;
            oItem.recipeComponentToleranceUnder = oCorrItem.approvedTLower;
            oItem.targetQuantity.value = oCorrItem.approvedQuantity;
            oItem.totalQtyEntryUom.value = oCorrItem.approvedQuantity;
            oItem.totalQtyBaseUom.value = oCorrItem.approvedQuantity;
          });
        }
        aLineItems.forEach(oItem => {
          //Update line item status
          oItem.status = '';

          var fToleranceUpper = 0,
            fToleranceLower = 0,
            fUpperThreshold = 0,
            fLowerThreshold = 0;

          if (oItem.recipeComponentToleranceOver && oItem.recipeComponentToleranceUnder) {
            fToleranceUpper = oItem.recipeComponentToleranceOver / 100;
            fToleranceLower = oItem.recipeComponentToleranceUnder / 100;
          } else if (oItem.toleranceOver && oItem.toleranceUnder) {
            fToleranceUpper = oItem.toleranceOver / 100;
            fToleranceLower = oItem.toleranceUnder / 100;
          } else {
            fToleranceUpper = oItem.targetQuantity.value;
            fToleranceLower = oItem.targetQuantity.value;
          }

          fUpperThreshold = oItem.targetQuantity.value * (1 + fToleranceUpper);
          fLowerThreshold = oItem.targetQuantity.value * (1 - fToleranceLower);

          if (oItem.consumedQuantity.value) {
            if (oItem.consumedQuantity.value < fLowerThreshold) {
              oItem.status = 'PARKED';
              oItem.statusText = 'Parked';
            } else if (oItem.consumedQuantity.value > fUpperThreshold) {
              oItem.status = 'BATCH_CORRECTION';
              oItem.statusText = 'Batch Correction';
            } else {
              oItem.status = 'ACCEPTED';
              oItem.statusText = 'Accepted';
            }
          }
        });
        oView.getModel('giData').setProperty('/lineItems', aLineItems);
        console.log('GI Summary Data: ', aLineItems);
        this._setScaleFactorEnabled(false);

        this._getGoodsReceiptSummary().then(
          function(oGRSummary) {
            this.grSummary = oGRSummary;
          }.bind(this)
        );

        //Get header material details
        var sMaterial = this.selectedOrder.material.material,
          sVersion = this.selectedOrder.material.version;
        this._getMaterialDetails(sMaterial, sVersion).then(oMaterial => {
          this.materialDetail = oMaterial;

          switch (oMaterial.quantityRestriction) {
            case 'ANY_NUMBER':
              this.getView().getModel('viewModel').setProperty('/scaleFactor/stepSize', 0.05);
              this.getView().getModel('viewModel').setProperty('/scaleFactor/precision', 2);
              break;
            case 'WHOLE_NUMBER':
            default:
              this.getView().getModel('viewModel').setProperty('/scaleFactor/stepSize', 1);
              this.getView().getModel('viewModel').setProperty('/scaleFactor/precision', 0);
          }
        });
      },

      onCalculateNewBomQty: function(oEvent) {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_260a0c6a-3f96-4228-b15d-c372ed3e7afd&async=false';

        var fGrQty = this.getView().getModel('viewModel').getProperty('/scaleFactor/value');
        var oRequestBody = {
          payload: {
            plant: this.getPodController().getUserPlant(),
            hdrmat: this.selectedOrder.materialName,
            grUom: this.selectedOrder.baseInternalUom,
            grQty: fGrQty
          }
        };

        this.getView().getModel('viewModel').setProperty('/isCheckEnabled', false);

        this.ajaxPostRequest(
          sUrl,
          oRequestBody,
          function(oResponse) {
            var oViewModel = this.getView().getModel('viewModel');
            oViewModel.setProperty('/calcGRQty', oResponse.response.grQty);
            oViewModel.setProperty('/calcGrUOM', oResponse.response.grUom);

            var oGiModel = this.getView().getModel('giData'),
              aLineItems = oGiModel.getProperty('/lineItems');
            aLineItems.forEach(oLineItem => {
              var sComponent = oLineItem.materialId.material;
              var oItem = oResponse.response.calculatedBom.find(oResItem => oResItem.component === sComponent);

              console.assert(!!oItem, 'Item not found in response object');
              if (!oItem) return;

              oLineItem.batchCorrectionWeight = {
                value: oItem.calcComponenetQty,
                unitOfMeasure: {
                  uom: oItem.componentUom
                }
              };

              oLineItem.batchCorrectionWeightCalc = { ...oLineItem.batchCorrectionWeight };

              oLineItem.issueWeight = {
                value: oItem.calcComponenetQty - oLineItem.consumedQuantity.value,
                unitOfMeasure: {
                  uom: oItem.componentUom
                }
              };
            });
            oGiModel.setProperty('/lineItems', aLineItems);
          }.bind(this),
          function(oError) {
            this.getView().getModel('viewModel').setProperty('/isCheckEnabled', true);
          }.bind(this)
        );
      },

      onCalculateBatchCorrectionBtnPress: function(oEvent) {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_260a0c6a-3f96-4228-b15d-c372ed3e7afd&async=false';

        //Get the batch correction item
        var oGiModel = this.getView().getModel('giData'),
          aLineItems = oGiModel.getProperty('/lineItems');

        var oBatchCorrectionItem = aLineItems.find(oItem => oItem.status === 'BATCH_CORRECTION');
        if (!oBatchCorrectionItem) {
          MessageBox.information(this.getI18nText('noItemsForBatchCorrectionMsg'));
          return;
        }

        var sComponent = oBatchCorrectionItem.materialId.material,
          fConsumedQty = parseFloat(oBatchCorrectionItem.consumedQuantity.value),
          sConsumedQtyUom = oBatchCorrectionItem.consumedQuantity.unitOfMeasure.uom;

        // var oRequestBody = {
        //   plant: this.getPodController().getUserPlant(),
        //   headerMaterial: this.selectedOrder.materialName,
        //   component: sComponent,
        //   correctionQuantity: fConsumedQty,
        //   uom: sConsumedQtyUom
        // };

        var oRequestBody = {
          payload: {
            plant: this.getPodController().getUserPlant(),
            hdrmat: this.selectedOrder.materialName,
            grUom: this.selectedOrder.baseInternalUom,
            componenet: sComponent,
            comQty: fConsumedQty,
            comUom: sConsumedQtyUom
          }
        };

        this.ajaxPostRequest(
          sUrl,
          oRequestBody,
          function(oResponse) {
            var oViewModel = this.getView().getModel('viewModel');
            oViewModel.setProperty('/calcGRQty', oResponse.response.grQty);
            oViewModel.setProperty('/calcGrUOM', oResponse.response.grUom);

            aLineItems.forEach(oLineItem => {
              var sComponent = oLineItem.materialId.material;
              var oItem = oResponse.response.calculatedBom.find(oResItem => oResItem.component === sComponent);

              console.assert(!!oItem, 'Item not found in response object');
              if (!oItem) return;

              oLineItem.batchCorrectionWeight = {
                value: oItem.calcComponenetQty,
                unitOfMeasure: {
                  uom: oItem.componentUom
                }
              };

              oLineItem.batchCorrectionWeightCalc = { ...oLineItem.batchCorrectionWeight };

              oLineItem.issueWeight = {
                value: oItem.calcComponenetQty - oLineItem.consumedQuantity.value,
                unitOfMeasure: {
                  uom: oItem.componentUom
                }
              };
            });
            oGiModel.setProperty('/lineItems', aLineItems);

            //Reset the scaleFactor input value
            this.getView().getModel('viewModel').setProperty('/scaleFactor/value', oResponse.response.grQty);
            this.getView().getModel('viewModel').setProperty('/scaleFactor/min', oResponse.response.grQty);

            // var oItem = this._getBatchCorrectionItem();
            // if (!oItem) return;

            // var fScaleFactor = oItem.batchCorrectionWeightCalc.value / oItem.targetQuantity.value;

            // //Update the step input based on batch correction data
            // var oViewModel = this.getView().getModel('viewModel');
            // oViewModel.setProperty('/scaleFactor/value', fScaleFactor * this.grSummary.targetQuantityInProductionUnit.value);
            // oViewModel.setProperty('/scaleFactor/min', fScaleFactor * this.grSummary.targetQuantityInProductionUnit.value);

            this._setScaleFactorEnabled(true);
          }.bind(this)
        );
      },

      onStepInputChange: function(oEvent) {
        this.getView().getModel('viewModel').setProperty('/isCheckEnabled', true);
        // var oGiModel = this.getView().getModel('giData'),
        //   aLineItems = oGiModel.getProperty('/lineItems'),
        //   newValue = oEvent.getSource().getValue(),
        //   fTotalGRQty = this.grSummary.targetQuantityInProductionUnit.value;

        // var oFloatInstance = sap.ui.core.format.NumberFormat.getFloatInstance({
        //   maxFractionDigits: 3
        // });

        // aLineItems.forEach(oItem => {
        //   oItem.batchCorrectionWeight.value = oFloatInstance.format(oItem.targetQuantity.value / fTotalGRQty * newValue);
        //   oItem.batchCorrectionWeightCalc.value = oFloatInstance.format(oItem.targetQuantity.value / fTotalGRQty * newValue);
        //   oItem.issueWeight.value = oFloatInstance.format(oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value);
        // });

        // // aLineItems.forEach(oItem => {
        // //   oItem.batchCorrectionWeight.value = oItem.batchCorrectionWeight.value / this.currentScaleFactor * newValue;
        // //   oItem.batchCorrectionWeightCalc.value = oItem.batchCorrectionWeightCalc.value / this.currentScaleFactor * newValue;
        // //   oItem.issueWeight.value = oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value;
        // // });

        // oGiModel.setProperty('/lineItems', aLineItems);
        // this.currentScaleFactor = newValue;
      },

      onBatchCorrectionWtChange: function(oEvent) {
        var fNewValue = parseFloat(oEvent.getSource().getValue());
        if (isNaN(fNewValue)) {
          return;
        }

        var oContext = oEvent.getSource().getBindingContext('giData'),
          oItem = oContext.getObject();

        if (oItem.batchCorrectionWeight.value < oItem.consumedQuantity.value) {
          MessageToast.show('Correction value cannot be less than measured quantity');
          oEvent.getSource().setValue(oItem.consumedQuantity.value);
        }

        oItem.issueWeight.value = oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value;
      },

      onReject: function() {
        MessageBox.confirm(this.getI18nText('scrapSfcConfirmationMsg', [this.selectedOrder.sfc]), {
          onClose: function(sAction) {
            if (sAction !== MessageBox.Action.OK) return;
            this._postSfcScrap();
          }.bind(this)
        });
      },

      onApprove: function() {
        var oStepInput = this.getView().byId('idStepInput');
        if (oStepInput.getValueState() === sap.ui.core.ValueState.Error) {
          return MessageBox.error(this.getI18nText('fixErrorsBeforeProceedErrMsg'));
        }

        var oViewModel = this.getView().getModel('viewModel'),
          fCalcQuantity = oViewModel.getProperty('/calcGRQty'),
          fCalcQtyUom = oViewModel.getProperty('/calcGrUOM'),
          sMessage = this.getI18nText('confirmBatchCorrectionApproval', [this.selectedOrder.sfc, fCalcQuantity, fCalcQtyUom]);
        MessageBox.confirm(sMessage, {
          onClose: function(oAction) {
            if (oAction === MessageBox.Action.CANCEL) return;
            //Send batch correction details to S4
            this._sendBatchCorrectionToS4();
            //Release the SFC
            this._releaseSfcHold();
            //Navigate back to order selection
            window.history.go(-1);
          }.bind(this)
        });
      },

      _getRoutingDetailsForOrder: function(sOrderId) {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'routing/v1/routings';
        var oParams = {
          plant: this.getPodController().getUserPlant(),
          routing: sOrderId,
          type: 'SHOPORDER_SPECIFIC_RECIPE'
        };

        return new Promise((resolve, reject) => {
          this.ajaxGetRequest(sUrl, oParams, resolve, reject);
        });
      },

      _getGoodsIssueSummaryForOrder: function(sOrderId) {
        var oRoutingModel = this.getView().getModel('routingData'),
          aRoutes = oRoutingModel.getProperty('/');

        if (!aRoutes || aRoutes.length < 1) {
          //TODO: throw error
          return;
        }

        var aRoutingSteps = aRoutes[0].routingSteps;
        var sUrl = this.getPodController().getAssemblyDataSourceUri() + 'order/goodsIssue/summary';
        var aPromises = aRoutingSteps.map(oStep => {
          var sOperationActivity = oStep.routingOperation.operationActivity.operationActivity;
          var sStepId = oStep.stepId;
          var sWorkCenter = oStep.workCenter.workCenter;

          var oParams = {
            shopOrder: this.selectedOrder.order,
            batchId: this.selectedOrder.sfc,
            operationActivity: sOperationActivity,
            stepId: oStep.stepId
          };

          //Raise get request for gi summary for phase and step
          return new Promise((resolve, reject) => {
            this.ajaxGetRequest(
              sUrl,
              oParams,
              function(oResponse) {
                resolve(
                  oResponse.lineItems.map(oItem => {
                    return {
                      ...oItem,
                      workCenter: sWorkCenter,
                      operationActivity: sOperationActivity,
                      stepId: sStepId
                    };
                  })
                );
              },
              reject
            );
          });
        });

        return Promise.all(aPromises).then(function(aResponses) {
          var aLineItems = aResponses.flatMap(oResponse => oResponse);
          // .filter(oItem => oItem.componentType === 'N');
          return aLineItems;
        });
      },

      _setScaleFactorEnabled: function(bFlag) {
        this.byId('idStepInput').setEnabled(bFlag);
      },

      _getMaterialDetails: function(sMaterial, sVersion) {
        var sUrl = this.getProductDataSourceUri();
        sUrl =
          sUrl +
          "Materials('ItemBO%3a" +
          this.getPodController().getUserPlant() +
          '%2c' +
          encodeURIComponent(sMaterial) +
          '%2c' +
          sVersion +
          "')";
        return new Promise((resolve, reject) => {
          this.ajaxGetRequest(sUrl, null, resolve, reject);
        });
      },

      _getBatchCorrectionData: function() {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_04527345-c48f-44c1-9424-5b65503c18ed&async=false';
        var oParams = {
          order: this.selectedOrder.order,
          sfc: this.selectedOrder.sfc
        };
        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oParams, resolve, reject);
        });
      },

      _postSfcScrap: async function() {
        // var oGRSummary = await this._getGoodsReceiptSummary();
        var oGRSummary = this.grSummary;
        var sUrl = this.getPublicApiRestDataSourceUri() + 'sfc/v1/sfcs/scrap';
        var oBatchCorrectionItem = this._getBatchCorrectionItem();
        if (!oBatchCorrectionItem) {
          return;
        }

        var oRequestBody = {
          plant: this.getPodController().getUserPlant(),
          sfcs: [this.selectedOrder.sfc],
          resource: oBatchCorrectionItem.workCenter,
          quantity: oGRSummary.targetQuantityInProductionUnit.value
        };

        this.ajaxPostRequest(
          sUrl,
          oRequestBody,
          function(oResponse) {
            MessageToast.show(this.getI18nText('sfcScrapped', [this.selectedOrder.sfc]));
            this.navigateToPage('MainPage');
            oLogger.info('SFC scrap service response', oResponse);
          }.bind(this)
        );
      },

      _releaseSfcHold: function() {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'sfc/v1/sfcs/release';
        var oRequestBody = {
          plant: this.getPodController().getUserPlant(),
          sfcs: [this.selectedOrder.sfc],
          releaseComments: 'Batch correction approved'
        };

        this.ajaxPostRequest(sUrl, oRequestBody);
      },

      _getGoodsReceiptSummary: function() {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'inventory/v1/inventory/goodsReceipts/summarize';
        var oParams = {
          plant: this.getPodController().getUserPlant(),
          sfc: this.selectedOrder.sfc,
          order: this.selectedOrder.order
        };
        return new Promise((resolve, reject) => {
          this.ajaxGetRequest(sUrl, oParams, resolve, reject);
        });
      },

      _getBatchCorrectionItem: function() {
        var oView = this.getView(),
          oGiDataModel = oView.getModel('giData'),
          aLineItems = oGiDataModel.getProperty('/lineItems');

        return aLineItems.find(oItem => oItem.status === 'BATCH_CORRECTION');
      },

      _sendBatchCorrectionToS4: function() {
        var sUrl =
          this.getPublicApiRestDataSourceUri() + '/pe/api/v1/process/processDefinitions/start?key=REG_602cf830-1ee2-4756-bd82-e306ef25940a';

        var oViewModel = this.getView().getModel('viewModel'),
          calcGRQty = oViewModel.getProperty('/calcGRQty'),
          calcGrUOM = oViewModel.getProperty('/calcGrUOM');

        var oRequestBody = {
          orderNumber: this.selectedOrder.order,
          sfc: this.selectedOrder.sfc,
          material: this.selectedOrder.materialName,
          materialDescription: this.selectedOrder.materialDescription,
          grQty: calcGRQty,
          grUom: calcGrUOM,
          phase: '',
          component: '',
          componentDescription: '',
          workCenter: '',
          bomTarget: 0,
          bomTUpper: 0,
          bomTLower: 0,
          measure: 0,
          approvedQuantity: 0,
          approvedTUpper: 0,
          approvedTLower: 0
        };

        //Get the array of component items for service call
        var oGiModel = this.getView().getModel('giData'),
          aLineItems = oGiModel.getProperty('/lineItems');

        var aPayload = aLineItems.map(oItem => {
          return {
            ...oRequestBody,
            phase: oItem.stepId,
            component: oItem.materialId.material,
            componentDescription: oItem.description,
            workCenter: oItem.workCenter,
            bomTarget: oItem.targetQuantity.value,
            bomTUpper: oItem.toleranceOver || 0,
            bomTLower: oItem.toleranceUnder || 0,
            measure: oItem.consumedQuantity.value,
            approvedQuantity: oItem.batchCorrectionWeight ? oItem.batchCorrectionWeight.value : oItem.targetQuantity.value,
            approvedTUpper: oItem.toleranceOver || 0,
            approvedTLower: oItem.toleranceUnder || 0
          };
        });

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, { Body: aPayload }, resolve, reject);
        });
      }
    });

    return oPluginViewController;
  }
);
