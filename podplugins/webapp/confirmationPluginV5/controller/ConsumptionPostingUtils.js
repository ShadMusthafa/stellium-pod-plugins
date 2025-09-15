sap.ui.define(['sap/ui/base/Object', 'sap/ui/core/Fragment', 'sap/ui/model/json/JSONModel'], function (UI5Object, Fragment, JSONModel) {
  return UI5Object.extend('stellium.ext.podplugins.confirmationPluginV5.controller.ConsumptionPostingUtils', {
    mStatusText: {
      DEFAULT: 'Posting Pending',
      ERROR: 'Posting Failed',
      SUCCESS: 'Posted'
    },

    constructor: function (oController) {
      this._oController = oController;
      this._oDialog = null;
      this._oModel = new JSONModel({});
      this.DB_BASE_URL = 'https://dbapicall.cfapps.eu20-001.hana.ondemand.com/';

      this.onConsumeBtnThrottled = this._throttle(this._consumeComponent, 1000);
    },

    showDialog: async function () {
      if (!this._oDialog) {
        this._oDialog = await this.getDialog();
      }

      this._oDialog.setBusy(true);

      this._getConsumptionListForSfc()
        .then((oResponse) => {
          let oStatus = {
            status: 'None',
            icon: '',
            text: this.mStatusText['DEFAULT']
          };
          let aItems = oResponse.map((oItem) => ({ ...oItem, message: '', status: oStatus }));
          this._oModel.setProperty('/items', aItems);
          this._oModel.refresh(true);

          //If there are no pending consumption items to be posted, allow direct confirmation posting
          if (aItems.length < 1) {
            return this._oController.postConfirmation();
          }

          this._oDialog.open();
        })
        .catch((oError) => {
          this._oDialog.close();
          //TODO: Show error dialog
        })
        .finally(() => {
          this._oDialog.setBusy(false);
        });
    },

    getDialog: function () {
      if (this._oDialog) return this._oDialog;

      return Fragment.load({
        id: this._oController.getView().getId(),
        name: 'stellium.ext.podplugins.confirmationPluginV5.view.fragments.ConsumptionPostingDialog',
        controller: this
      }).then((oDialog) => {
        oDialog.setModel(this._oModel);
        this._oController.getView().addDependent(oDialog);
        return oDialog;
      });
    },

    onConsumeBtnPress: function (oEvent) {
      this.onConsumeBtnThrottled(oEvent);
    },

    _consumeComponent: async function (oEvent) {
      let aItems = this._oModel.getProperty('/items').filter((oItem) => oItem.status.status !== 'Success'),
        aPayloads = aItems.map((oItem) => this._prepareGoodsIssuePayload(oItem));

      let aPromises = aPayloads.map((oPayload, idx) => this._postGoodsIssue(oPayload, `/items/${idx}`));
      let bPostConfirmation = await Promise.allSettled(aPromises).then((aResults) => {
        let bIsSuccess = aResults.every((oResult) => oResult.status === 'fulfilled');
        return bIsSuccess;
      });

      //If all the consumption posting is successfull, then close the dialog and post the confirmations
      if (bPostConfirmation) {
        this._oDialog.close();
        this._oController.postConfirmation();
      }

      this._oModel.refresh(true);
    },

    onCancelBtnPress: function (oEvent) {
      if (this._oDialog) this._oDialog.close();
      this._oModel.setProperty('/items', []);
      this._oModel.refresh(true);
    },

    onRetryPosting: function (oEvent) {
      let oContext = oEvent.getSource().getBindingContext();

      //TODO: Update the status object to show retry

      var oPayload = this._prepareGoodsIssuePayload(oContext.getObject());
      this._postGoodsIssue(oPayload, oContext.getPath()).then((oResponse) => {
        let aItems = this._oModel.getProperty('/items');
        let bIsAllPosted = aItems.every((oItem) => oItem.status.status === 'Success');
        if (bIsAllPosted) {
          this._oDialog.close();
          this._oController.postConfirmation();
        }
      });
    },

    _getConsumptionListForSfc: async function () {
      let that = this._oController,
        oSelectedOrder = that.getPodSelectionModel().selectedOrderData,
        oSelectedPhase = that.getPodSelectionModel().selectedPhaseData,
        sUrl = 'https://dbapicall.cfapps.eu20-001.hana.ondemand.com/api/v2/consolidatedQuantity';

      let oParams = {
        plant: that.getPodController().getUserPlant(),
        material: oSelectedOrder.materialName,
        order: oSelectedOrder.order,
        sfc: oSelectedOrder.sfc,
        phase: oSelectedPhase.phaseId,
        workcenter: oSelectedPhase.selectedWorkcenter
      };

      return new Promise((resolve, reject) => that.ajaxGetRequest(sUrl, oParams, resolve, reject)).then((aResponse) => {
        let mBatches = aResponse.data.reduce((acc, val) => {
          acc[val.batchNo] = val.batchNo;
          return acc;
        }, {});

        let aUniqueBatches = Object.keys(mBatches);
        let aInventoryPromise = aUniqueBatches.map((sBatch) => this._getInventoryData(sBatch));
        return Promise.all(aInventoryPromise).then((aInventories) => {
          aInventories.forEach((oInventory) => (mBatches[oInventory.content[0]?.batchNumber] = oInventory.content[0]));
          return aResponse.data.map((oItem) => {
            oItem.inventory = mBatches[oItem.batchNo];
            return oItem;
          });
        });
      });

      // return new Promise((resolve, reject) => that.ajaxGetRequest(sUrl, oParams, resolve, reject));
    },

    _getInventoryData: function (sBatchNo) {
      let that = this._oController,
        sUrl = that.getPublicApiRestDataSourceUri() + 'inventory/v1/inventories';

      let oParams = {
        plant: that.getPodController().getUserPlant(),
        batchNumber: sBatchNo
      };

      return new Promise((resolve, reject) => that.ajaxGetRequest(sUrl, oParams, resolve, reject));
    },

    _prepareGoodsIssuePayload: function (oConsumptionItem) {
      let that = this._oController,
        oSelectedOrder = that.getPodSelectionModel().selectedOrderData,
        oSelectedPhase = that.getPodSelectionModel().selectedPhaseData;

      let oPayload = {
        plant: that.getPodController().getUserPlant(),
        order: oSelectedOrder.order,
        charge: oSelectedOrder.sfc,
        phase: oSelectedPhase.phaseId,
        workCenter: oSelectedPhase.selectedWorkcenter,
        component: {
          material: {
            material: oConsumptionItem.component,
            version: oConsumptionItem.componentVersion
          },
          sequence: oConsumptionItem.localSequence
        },
        isBomComponent: true,
        bom: {
          bom: oConsumptionItem.bom,
          version: oConsumptionItem.bomVersion
        },
        inventoryId: oConsumptionItem.inventory.inventoryId,
        quantity: oConsumptionItem.totalQuantity,
        // quantity: oConsumptionItem.quantity,
        unitOfMeasure: oConsumptionItem.uom,
        postedBy: that.getPodController().getUserId(),
        postingDateTime: moment().subtract(1, 'seconds').format('YYYY-MM-DD HH:mm:ss'),
        comments: 'Portioning consumption posting'
      };

      return oPayload;

      // return new Promise((resolve, reject) => that.ajaxPostRequest(sUrl, oPayload, resolve, reject));
    },

    _postGoodsIssue: async function (oPayload, sPath) {
      let that = this._oController,
        sUrl = that.getPublicApiRestDataSourceUri() + 'processorder/v1/goodsissue';
      return new Promise((resolve, reject) => that.ajaxPostRequest(sUrl, oPayload, resolve, reject))
        .then((oResponse) => {
          //Update the status for the item
          let oStatus = {
            status: 'Success',
            icon: 'sap-icon://sys-enter-2',
            text: this.mStatusText['SUCCESS']
          };
          this._oModel.setProperty(`${sPath}/status`, oStatus);
          this._oModel.setProperty(`${sPath}/message`, '');

          let oConsumptionItem = this._oModel.getProperty(sPath);
          return this._postUpdateToHanaDb(oConsumptionItem);
        })
        .catch(async (oError) => {
          let sMessage = oError?.message || 'Posting Failed';
          let oStatus = {
            status: 'Error',
            icon: 'sap-icon://error',
            text: this.mStatusText['ERROR']
          };
          this._oModel.setProperty(`${sPath}/status`, oStatus);
          this._oModel.setProperty(`${sPath}/message`, sMessage);

          //Bubbling the error
          throw oError;
        });
    },

    _postUpdateToHanaDb: async function (oConsumptionItem) {
      let that = this._oController,
        oSelectedOrder = that.getPodSelectionModel().selectedOrderData,
        oSelectedPhase = that.getPodSelectionModel().selectedPhaseData,
        sUrl = this.DB_BASE_URL + 'api/update/ConsolidatedPostingData';

      let oPayload = {
        plant: that.getPodController().getUserPlant(),
        order: oSelectedOrder.order,
        material: oSelectedOrder.materialName,
        phase: oSelectedPhase.phaseId,
        workcenter: oSelectedPhase.selectedWorkcenter,
        component: oConsumptionItem.component,
        erpSequence: oConsumptionItem.erpSequence,
        localSequence: oConsumptionItem.localSequence,
        batchNo: oConsumptionItem.batchNo,
        sfc: oConsumptionItem.sfc
      };

      return new Promise((resolve, reject) => that.ajaxPostRequest(sUrl, oPayload, resolve, reject));
    },

    _throttle: function (func, limit) {
      let inThrottle;
      return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      }.bind(this);
    }
  });
});
