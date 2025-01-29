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

        this.selectedOrder = oData;

        //Get routing information for selected order
        var aRoutingData = await this._getRoutingDetailsForOrder(oData.order);
        oView.getModel('routingData').setData(aRoutingData);
        console.log('Routing Data ', aRoutingData);

        //Get goods issue summary for the components
        var aLineItems = await this._getGoodsIssueSummaryForOrder(oData.order);
        aLineItems.forEach(oItem => {
          //Update line item status
          oItem.status = '';
          //TODO: Tolerance checks
          if (oItem.consumedQuantity.value) {
            if (oItem.consumedQuantity.value < oItem.targetQuantity.value) {
              oItem.status = 'PARKED';
              oItem.statusText = 'Parked';
            } else if (oItem.consumedQuantity.value > oItem.targetQuantity.value) {
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

      onCalculateBatchCorrectionBtnPress: function(oEvent) {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_0ae51ff6-5158-477f-bdea-546e8f9bffa1&async=false';

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

        var oRequestBody = {
          plant: this.getPodController().getUserPlant(),
          headerMaterial: this.selectedOrder.materialName,
          component: sComponent,
          correctionQuantity: fConsumedQty,
          uom: sConsumedQtyUom
        };

        this.ajaxPostRequest(
          sUrl,
          oRequestBody,
          function(oResponse) {
            aLineItems.forEach(oLineItem => {
              var sComponent = oLineItem.materialId.material;
              var oItem = oResponse.response.find(oResItem => oResItem.componenet === sComponent);
              console.assert(!!oItem, 'Item not found in response object');

              oLineItem.batchCorrectionWeight = {
                value: oItem.calcqty,
                unitOfMeasure: {
                  uom: oItem.cuom
                }
              };

              oLineItem.batchCorrectionWeightCalc = { ...oLineItem.batchCorrectionWeight };

              oLineItem.issueWeight = {
                value: oItem.calcqty - oLineItem.consumedQuantity.value,
                unitOfMeasure: {
                  uom: oItem.cuom
                }
              };
            });
            oGiModel.setProperty('/lineItems', aLineItems);

            //Reset the scaleFactor input value
            this.getView().getModel('viewModel').setProperty('/scaleFactor/value', 1);

            var oItem = this._getBatchCorrectionItem();
            if (!oItem) return;

            var fScaleFactor = oItem.batchCorrectionWeightCalc.value / oItem.targetQuantity.value;

            //Update the step input based on batch correction data
            var oViewModel = this.getView().getModel('viewModel');
            oViewModel.setProperty('/scaleFactor/value', fScaleFactor * this.grSummary.targetQuantityInProductionUnit.value);
            oViewModel.setProperty('/scaleFactor/min', fScaleFactor * this.grSummary.targetQuantityInProductionUnit.value);

            this._setScaleFactorEnabled(true);
          }.bind(this)
        );
      },

      onStepInputChange: function(oEvent) {
        var oGiModel = this.getView().getModel('giData'),
          aLineItems = oGiModel.getProperty('/lineItems'),
          newValue = oEvent.getSource().getValue(),
          fTotalGRQty = this.grSummary.targetQuantityInProductionUnit.value;

        var oFloatInstance = (oInstance = sap.ui.core.format.NumberFormat.getFloatInstance({
          maxFractionDigits: 3
        }));

        aLineItems.forEach(oItem => {
          oItem.batchCorrectionWeight.value = oFloatInstance.format(oItem.targetQuantity.value / fTotalGRQty * newValue);
          oItem.batchCorrectionWeightCalc.value = oFloatInstance.format(oItem.targetQuantity.value / fTotalGRQty * newValue);
          oItem.issueWeight.value = oFloatInstance.format(oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value);
        });

        // aLineItems.forEach(oItem => {
        //   oItem.batchCorrectionWeight.value = oItem.batchCorrectionWeight.value / this.currentScaleFactor * newValue;
        //   oItem.batchCorrectionWeightCalc.value = oItem.batchCorrectionWeightCalc.value / this.currentScaleFactor * newValue;
        //   oItem.issueWeight.value = oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value;
        // });

        oGiModel.setProperty('/lineItems', aLineItems);
        this.currentScaleFactor = newValue;
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
        //Send batch correction details to S4
        this._sendBatchCorrectionToS4();
        //Release the SFC
        this._releaseSfcHold();
        //Navigate back to order selection
        window.history.go(-1);
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
          var aLineItems = aResponses.flatMap(oResponse => oResponse).filter(oItem => oItem.componentType === 'N');
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

        var oRequestBody = {
          orderNumber: this.selectedOrder.order,
          sfc: this.selectedOrder.sfc,
          material: this.selectedOrder.materialName,
          materialDescription: this.selectedOrder.materialDescription,
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
            approvedQuantity: oItem.batchCorrectionWeight.value,
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
