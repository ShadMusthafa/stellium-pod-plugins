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
            max: 15,
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
              oItem.statusText = 'Parked'
            } else if (oItem.consumedQuantity.value > oItem.targetQuantity.value) {
              oItem.status = 'BATCH_CORRECTION';
              oItem.statusText = 'Batch Correction'
            } else {
              oItem.status = 'ACCEPTED';
              oItem.statusText = 'Accepted'
            }
          }
        });
        oView.getModel('giData').setProperty('/lineItems', aLineItems);
        console.log('GI Summary Data: ', aLineItems);
        this._setScaleFactorEnabled(false);
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
            this._setScaleFactorEnabled(true);
            this.getView().getModel('viewModel').setProperty('/scaleFactor/value', 1);
          }.bind(this)
        );
      },

      onStepInputChange: function(oEvent) {
        var oGiModel = this.getView().getModel('giData'),
          aLineItems = oGiModel.getProperty('/lineItems'),
          newValue = oEvent.getSource().getValue();

        aLineItems.forEach(oItem => {
          oItem.batchCorrectionWeight.value = oItem.batchCorrectionWeight.value / this.currentScaleFactor * newValue;
          oItem.batchCorrectionWeightCalc.value = oItem.batchCorrectionWeightCalc.value / this.currentScaleFactor * newValue;
          oItem.issueWeight.value = oItem.batchCorrectionWeight.value - oItem.consumedQuantity.value;
        });

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
                      operationActivity: sOperationActivity
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

      _postSfcScrap: async function() {
        var oGRSummary = await this._getGoodsReceiptSummary();
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
      }
    });

    return oPluginViewController;
  }
);
