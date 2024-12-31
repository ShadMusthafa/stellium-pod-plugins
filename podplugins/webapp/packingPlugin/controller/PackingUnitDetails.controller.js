sap.ui.define([
    "stellium/ext/podplugins/packingPlugin/controller/PackingUnits.controller",
    "stellium/ext/podplugins/packingPlugin/controller/AssignDestinationDialog",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/json/JSONModel",
    "stellium/ext/podplugins/packingPlugin/util/SfcAllowedStatuses",
    "stellium/ext/podplugins/packingPlugin/util/PluginDefaultSettings",
    "stellium/ext/podplugins/packingPlugin/util/UserAction",
    "stellium/ext/podplugins/packingPlugin/controller/wip/WipValidators",
    "sap/dm/dme/featureflag/FeatureFlagSettings", 
    "stellium/ext/podplugins/packingPlugin/controller/wip/WipOrderCreate",
], function (PackingUnitsController, AssignDestinationDialog, MessageBox, Filter, JSONModel, SfcAllowedStatuses,
    PluginDefaultSettings, UserAction, WipValidators, FeatureFlagSettings, WipOrderCreate) {
    "use strict";

    let sOrderExistsProperty = "/orderExists";

    return PackingUnitsController.extend("stellium.ext.podplugins.packingPlugin.controller.PackingUnitDetails", {
        oUserAction: new UserAction(),
        onInit: function () {
            this.getOwnerComponent().getTargets().getTarget("packingUnitDetails").attachDisplay(this.onRouteMatched, this);
        },

        onRouteMatched: function (oEvent) {
            let oSelectedUnitData = oEvent.getParameter("data");
            this.initializeUnitAuxData(oSelectedUnitData);
        },

        onBeforeRendering: function () {
            this.setForceDispatch();
            this.loadUnitData().then(this.onUnitDataSuccessResponse.bind(this));
            this.setAssignDestinationButtonVisibility();
            this.initWIPFeature();
            this.clearMessages();
        },

        initializeUnitAuxData: function (oUnitData) {
            oUnitData.capacity = this.getInitialUnitCapacityValues();
            this.getView().setModel(new JSONModel(oUnitData), "auxData");
        },

        getInitialUnitCapacityValues: function () {
            return {
                quantity: { maximumQuantity: null },
                volume: { maximumVolume: null, volumeUnit: null },
                weight: { maximumWeight: null, weightUnit: null }
            };
        },

        setAssignDestinationButtonVisibility: function () {
            let sUnitStatus = this.getUnitData().status;
            this.getViewModel().setProperty("/assignDestinationVisible", this.bForceDispatch && (sUnitStatus !== "UNLOADED"));
        },

        loadUnitData: function () {
            let sUnitId = this.getUnitData().id;
            const bIsWIPEnabled = this.getConfigOrDefaultProperty("showWIPButton");
            let sUrl = `${this.getPackingRestDataSourceUri()}packingUnits/${sUnitId}?readOperation=${bIsWIPEnabled}`;
            return this.oServiceClient.get(sUrl, null);
        },

        onUnitDataSuccessResponse: function (oUnitData) {
            this.getAuxModel().setData(oUnitData);
            this.checkUnitCapacity(oUnitData.capacity);
            this.getViewModel().setProperty("/isCreatedFromCarrier", !!oUnitData.carrier);
            this.oUserAction.setAdd();
            this.aMovedContent = null;
        },

        checkUnitCapacity: function (oUnitCapacityData) {
            if (!oUnitCapacityData) {
                return;
            }

            let bUnitQtyAvailable = oUnitCapacityData.quantity.maximumQuantity > 0;
            let bUnitVolumeAvailable = oUnitCapacityData.volume.maximumVolume > 0 && !!oUnitCapacityData.volume.volumeUnit;
            let bUnitWeightAvailable = oUnitCapacityData.weight.maximumWeight > 0 && !!oUnitCapacityData.weight.weightUnit;

            let bUnitContentQtyAvailable = oUnitCapacityData.quantity.contentQuantity !== null;
            let bUnitContentVolumeAvailable = oUnitCapacityData.volume.contentVolume !== null;
            let bUnitContentWeightAvailable = oUnitCapacityData.weight.contentWeight !== null;

            let bUnitQtyCapacityWarning = bUnitQtyAvailable && !bUnitContentQtyAvailable;
            let bUnitVolumeCapacityWarning = bUnitVolumeAvailable && !bUnitContentVolumeAvailable;
            let bUnitWeightCapacityWarning = bUnitWeightAvailable && !bUnitContentWeightAvailable;

            if (bUnitQtyCapacityWarning || bUnitVolumeCapacityWarning || bUnitWeightCapacityWarning) {
                this.showInvalidCapacityMessage();
            }
        },

        showInvalidCapacityMessage: function () {
            let sText = this.getI18nText("warning.capacityValidationDisabled.msg");

            if (this.oUserAction.isAdd() || this.oUserAction.isRemove()) {
                this.showMessage(sText, false, true, "Warning");
            } else {
                this.addMessage("Warning", null, sText);
            }
        },

        onUnloadPress: function () {
            // if resource type is SFC, fetch transport order info
            if (this.bForceDispatch) {
                return this.getTransportOrder()
                    .then(this.processTransportOrderOnUnload.bind(this))
                    .catch(this.showErrorMessage.bind(this));
            } else {
                return this.unloadPackingUnit(false);
            }
        },

        /**
         * @param {Object} oTransportOrderData - could be null if Transport Order not exists
         * Should perform pre-check as system cannot unload the packing unit if Transport Order exists and its status
         * is not CONFIRMED or CANCELLED
         */
        processTransportOrderOnUnload: function (oTransportOrderData) {
            if (oTransportOrderData && (oTransportOrderData.status !== "CONFIRMED") && (oTransportOrderData.status !== "CANCELLED")) {
                this.showUnitUnloadWarningMessage();
            } else {
                this.unloadPackingUnit(false);
            }
        },

        showUnitUnloadWarningMessage: function () {
            let sProceedBtnTxt = this.getI18nText("packingUnitDetails.packItems.unload.dialog.proceed.btn");
            MessageBox.warning(this.getI18nText("warning.orderExistsOnUnload.msg"), {
                actions: [sProceedBtnTxt, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    if (sAction === sProceedBtnTxt) {
                        this.unloadPackingUnit(true);
                    }
                }.bind(this)
            });
        },

        onPackPress: function () {
            this.pluginEventExtension.onPackPressEvent();
        },

        processOnPackPressEvent: function () {
            // if resource type is SFC, fetch transport order info
            this.oUserAction.setPack();
            if (this.bForceDispatch) {
                return this.getTransportOrder()
                    .then(this.processTransportOrderOnPack.bind(this))
                    .catch(this.showErrorMessage.bind(this));
            } else {
                return this.savePackingUnit();
            }
        },

        /**
         * @param {Object} oTransportOrderData - could be null if Transport Order not exists
         * Should perform pre-check as system cannot unload the packing unit if Transport Order exists and its status
         * is PICKED or CONFIRMED
         */
        processTransportOrderOnPack: function (oTransportOrderData) {
            this.getViewModel().setProperty(sOrderExistsProperty, !!oTransportOrderData);
            if (oTransportOrderData && (oTransportOrderData.status === "PICKED" || oTransportOrderData.status === "CONFIRMED")) {
                this.showErrorMessage(this.getI18nText("error.orderExistsOnPack.msg"));
            } else {
                this.oUserAction.setPack();
                this.savePackingUnit();
            }
        },

        onUnpackPress: function () {
            return this.pluginEventExtension.onUnpackPressEvent();
        },

        onWIPPress: async function () {
            const oAuxData = this.getAuxModel().getData();
            const oMaterial = oAuxData.material;

            const bIsMaterialTypeValid = WipValidators.validateReturnablePackage(oAuxData).bIsValid;
            const oSfcInQueueValidationResult = WipValidators.validateSfcsInQueue(oAuxData);
            const oSameShopOrderValidationResult = WipValidators.validateSameShopOrders(oAuxData);
            const oSfcPartialSfcQtyValidationResult = WipValidators.validateFullSfcQtyPacked(oAuxData);
            const oPackingUnitsValidationResult = WipValidators.validatePackingUnitsPacked(oAuxData);
            const oSameOperationValidationResult = WipValidators.validateSfcOperations(oAuxData);

            const aValidationResults = [];

            if (!bIsMaterialTypeValid) {
                const sMaterial = oMaterial.material;
                const sVersion = oMaterial.version;
                let sText = this.getI18nText("packingUnitDetails.wip.isReturnablePackaging.msg", [sMaterial, sVersion]);

                aValidationResults.push(sText);
            }

            if (!oSfcInQueueValidationResult.bIsValid) {
                const sAllWrongSfcs = oSfcInQueueValidationResult.aSfcsNotInQueue.join(", ");
                let sText;
                let sI18nKey;
                const bOnlyOneSfc = oSfcInQueueValidationResult.aSfcsNotInQueue.length === 1;
                sI18nKey = bOnlyOneSfc ? "packingUnitDetails.wip.sfcNotInQueue.msg" : "packingUnitDetails.wip.sfcsNotInQueue.msg";
                sText = this.getI18nText(sI18nKey, [sAllWrongSfcs]);

                aValidationResults.push(sText);
            }

            if (!oSameShopOrderValidationResult.bIsValid) {
                const sI18nKey = "packingUnitDetails.wip.sfcsNotFromSameOrder.msg";
                const sText = this.getI18nText(sI18nKey);
                aValidationResults.push(sText);
            }

            if (!oSfcPartialSfcQtyValidationResult.bIsValid) {
                const sAllPartiallyPackedSfcs = oSfcPartialSfcQtyValidationResult.aSfcs.join(", ");
                let sText;
                let sI18nKey;
                const bOnlyOneSfc = oSfcPartialSfcQtyValidationResult.aSfcs.length === 1;
                sI18nKey = bOnlyOneSfc ? "packingUnitDetails.wip.sfcNotFullyPacked.msg" : "packingUnitDetails.wip.sfcsNotFullyPacked.msg";
                sText = this.getI18nText(sI18nKey, [sAllPartiallyPackedSfcs]);
                aValidationResults.push(sText);
            }

            if (!oPackingUnitsValidationResult.bIsValid) {
                const sPackingUnitNumbers = oPackingUnitsValidationResult.aPackedUnits.join(", ");
                let sText = this.getI18nText("packingUnitDetails.wip.packedPackingUnitNotAllowed.msg", [sPackingUnitNumbers]);
                aValidationResults.push(sText);
            }

            if (!oSameOperationValidationResult.bIsValid) {
                const sSfcs = oSameOperationValidationResult.aSfcs.join(", ");
                const sOperation = oSameOperationValidationResult.sOperation;

                let sText = this.getI18nText("packingUnitDetails.wip.sfcsNotFromSameOperation.msg", [sSfcs, sOperation]);
                aValidationResults.push(sText);
            }

            this.getViewModel().setProperty("/canWipPress", true);

            if (aValidationResults.length === 0) {
                const sServiceRoot = this.getPackingRestDataSourceUri();
                try {
                    const sId = await WipOrderCreate.postCreateWipOrder({
                        sServiceRoot,
                        sPlant: oAuxData.plant,
                        sPackingUnitId: oAuxData.id
                    });
                    const sMsg = this.getI18nText("packingUnitDetails.wipCreated.msg", sId);
                    this.showMessage(sMsg, true, false, "Success");
                    this.getViewModel().setProperty("/canWipPress", false);
                }
                catch (sError) {
                    this.showErrorMessage(this.getI18nText("packingUnitDetails.wipCreateFailed.msg", [sError || ""]), false, true, "Error");
                }
            } else {
                this.showMessage(aValidationResults.join("\n"), false, true, "Error");
                return Promise.reject();
            }
        },

        processOnUnpackPressEvent: function () {
            if (this.bForceDispatch) {
                return this.getTransportOrder()
                    .then(this.processTransportOrderOnUnpack.bind(this))
                    .catch(this.showErrorMessage.bind(this));
            } else {
                this.oUserAction.setUnpack();
                this.savePackingUnit();
            }
        },

        processTransportOrderOnUnpack: function (oTransportOrderData) {
            this.getViewModel().setProperty(sOrderExistsProperty, !!oTransportOrderData);
            if (oTransportOrderData && (oTransportOrderData.status === "PICKED" || oTransportOrderData.status === "CONFIRMED")) {
                this.showErrorMessage(this.getI18nText("error.orderExistsOnUnpack.msg"));
            } else {
                this.oUserAction.setUnpack();
                this.savePackingUnit();
            }
        },

        onFinishPress: function () {
            this.clearMessages();
            this.byId("assignedObjectsSearch").setValue(null);
            this.oEventBus.publish("resetUnitDetails", { bFinish: true });
            this.getOwnerComponent().displayTarget("packingUnits");
        },

        onFinalizeUnpack: function () {
            return this.loadUnitData().then(this.onUnitDataSuccessResponse.bind(this));
        },

        getTransportOrder: function () {
            let oPackingUnit = this.getAuxModel().getData();
            const sInnerUrl = "findLogisticsOrderByReferenceNumberAndType?referenceType=PACKING_UNIT";
            let sUrl = `${this.getLogisticsRestDataSourceUri()}${sInnerUrl}&referenceNumber=${oPackingUnit.number}`;
            return this.oServiceClient.get(sUrl);
        },

        onAssignedObjectsListUpdate: function (oEvent) {
            let iLength = oEvent.getSource().getBinding("items").getLength();
            this.getViewModel().setProperty("/assignedObjectsListLength", iLength);
        },

        /*
         * Move an object from the assigned table to the available table.
         */
        onMoveToAvailable: function () {
            let oAssignedObjectsTable = this.getAssignedObjectsTable();
            let bRemoveAllItems = this.getViewModel().getProperty("/allAssignedItemsSelected");
            let aAssignedItemsContexts = oAssignedObjectsTable.getBinding("items").getContexts();
            let aUnitContent = this.getUnitContentData();
            this.aMovedContent = bRemoveAllItems ? aAssignedItemsContexts : oAssignedObjectsTable.getSelectedContexts();

            if (this.aMovedContent.length > 0) {
                let aIndexes = this.aMovedContent.map(function (oItem) {
                    return aAssignedItemsContexts.indexOf(oItem);
                });
                // ~-1 = 0 - faulty, ~0,1... = -1,-2... - truthy
                this.aMovedContent = aUnitContent.filter(function (oItem, iIndex) {
                    return !~aIndexes.indexOf(iIndex);
                });
                oAssignedObjectsTable.removeSelections();
                this.oUserAction.setRemove();
                this.savePackingUnit();
            }
        },

        onAssignedObjectsSearch: function (oEvent) {
            let sValue = oEvent.getParameter("newValue");
            let oFilter = new Filter("sfc/sfc", sap.ui.model.FilterOperator.Contains, sValue);
            this.getAssignedObjectsTable().getBinding("items").filter([ oFilter ]);
        },

        /**
         *
         * @param {String} sPackingUnitStatus PU Status.
         * @param {[String]} aAllowedStatuses Array of allowed SFC statuses
         * @param {boolean} allowMixedOperations A flag for mixed operations allowance.
         * @param {boolean} allowMixedOrders A flag for Mixed Orders allowance.
         * @param {boolean} allowAddConformantSfcToNonConformantPackingUnit A flag to allow conformant SFC in NC Packing
         * @returns {object} Payload for PU pack call
         * @private
         */
        _createPayloadForUpdate: function (
            { sPackingUnitStatus, aAllowedStatuses = [],
                allowMixedOperations = true, allowMixedOrders = true,
                allowAddConformantSfcToNonConformantPackingUnit = true
            }) {
            let oFetchedPackingUnit = this.getAuxModel().getData();
            let bReturnablePackaging = oFetchedPackingUnit.material.materialType === "RETURNABLE_PACKAGING";
            let bResourceLocation = bReturnablePackaging && oFetchedPackingUnit.currentLocation;
            let bWorkCenterLocation = bReturnablePackaging && oFetchedPackingUnit.workCenterLocation;
            let bStorageLocation = bReturnablePackaging && oFetchedPackingUnit.storageLocation;
            let aAssignedObjects = this.getAuxModel().getProperty("/content");

            return {
                id: oFetchedPackingUnit.id,
                content: this.convertContentData(aAssignedObjects).map(this.convertAssignedObjectAuxData.bind(this)),
                carrier: bReturnablePackaging ? { carrierNumber: oFetchedPackingUnit.carrier.carrierNumber } : null,
                currentLocation: bResourceLocation ? { resource: oFetchedPackingUnit.currentLocation.resource } : null,
                workCenterLocation: bWorkCenterLocation
                    ? { workCenter: oFetchedPackingUnit.workCenterLocation.workcenter } : null,
                storageLocation: bStorageLocation
                    ? { storageLocation: oFetchedPackingUnit.storageLocation.storageLocation } : null,
                material: { ref: oFetchedPackingUnit.material.ref },
                number: oFetchedPackingUnit.number,
                packingType: bReturnablePackaging ? oFetchedPackingUnit.packingType : null,
                plant: oFetchedPackingUnit.plant,
                status: sPackingUnitStatus,
                modifiedDateTime: oFetchedPackingUnit.modifiedDateTime,
                allowedSfcStatuses: aAllowedStatuses,
                allowMixedOperations,
                allowMixedOrders,
                allowAddConformantSfcToNonConformantPackingUnit
            };
        },

        convertContentData: function (aAssignedObjects) {
            if (this.oUserAction.isAdd()) {
                return aAssignedObjects.concat(this.aMovedContent || []);
            } else if (this.oUserAction.isRemove()) {
                return this.aMovedContent || [];
            }
            return aAssignedObjects;
        },

        convertAssignedObjectAuxData: function (oAssignedObject) {
            return {
                sfc: oAssignedObject.sfc ? { ref: oAssignedObject.sfc.ref } : null,
                packingUnit: oAssignedObject.packingUnit ? {
                    id: oAssignedObject.packingUnit.id,
                    material: { ref: oAssignedObject.packingUnit.material.material }
                } : null,
                quantity: oAssignedObject.packingUnit ? 1 : oAssignedObject.quantity,
                id: oAssignedObject.id || null
            };
        },

        savePackingUnit: function () {
            const oUserAction = this.oUserAction;
            this.setUnitsListViewBusy(true);
            this.clearMessages();
            const bAllowAll = oUserAction.isRemove() || oUserAction.isUnpack();
            const aAllowedStatuses = SfcAllowedStatuses
                .createAllowedSfcStatusesPayload( {
                    allowAll: bAllowAll,
                    aConfigStatuses: this.getConfiguration().allowedSfcStatusesForPacking
                });

            const oAllRules = this.createRulesSetForPayload({ allowAll: bAllowAll });
            const sPackingUnitStatus = oUserAction.toPackingUnitStatus();
            this.oSavePayload = this._createPayloadForUpdate(
                {
                    ...oAllRules,
                    sPackingUnitStatus,
                    aAllowedStatuses,
                });
            return this.pluginEventExtension.onPackingUnitChangeEvent({ oPackingUnit: this.oSavePayload });
        },

        processPackingUnitChangeEvent: function ({ oPackingUnit }) {
            const sUrl = `${this.getPackingRestDataSourceUri()}packingUnits/${oPackingUnit.id}`;
            const isPackUnpack = this.oUserAction.isPack() || this.oUserAction.isUnpack();
            const fnOnSuccess = isPackUnpack ? this.onUnitSaveSuccess : this.updatePackingUnitData;

            this._createCPIServiceRequest(oPackingUnit);
            
            return this.oServiceClient.put(sUrl, oPackingUnit)
                .then(fnOnSuccess.bind(this))
                .catch(this.onUnitSaveError.bind(this));
            
        },

        _createCPIServiceRequest: function(oPackingUnit){
            var oView = this.getView(),
                oAuxModel = oView.getModel('auxData'),
                oData= oAuxModel.getData(),
                oPayloadData = [];
            
            oPayloadData = oData.content.map(oItem=>{
                return {
                    "site" : oData.plant,
                    "orderNo" : oItem.sfc.shopOrder.shopOrder,
                    "orderStatus" : 0,
                    "headerMat" : oItem.sfc.material.material,
                    "description" : oItem.sfc.material.description,
                    "packUnit" : oData.number,
                    "packStatus" : oPackingUnit.status,
                    "qty" : oItem.quantity,
                    "uom" : oItem.unitOfMeasure
                  }
            });

            var oPayload = {
                StartParams: oPayloadData
            }
            console.log('CPI service payload', oPayload);
            
            var sUrl = this.getPublicApiRestDataSourceUri() + "/pe/api/v1/process/processDefinitions/start?key=REG_fcfb5385-e4a6-4534-9504-55f95dfced22";
            this.ajaxPostRequest(sUrl, oPayload, function(oResponse){
                Log.info(oResponse);
            }, function(){
                Log.error(...arguments)
            })
        },

        unloadPackingUnit: function (bCancelLogisticsOrder) {
            let oUnitData = this.getUnitData();
            let sUrl = `${this.getPackingRestDataSourceUri()}packingUnits/unload?packingUnitId=${oUnitData.id}&cancelLogisticsOrder=${bCancelLogisticsOrder}`;

            return this.oServiceClient.put(sUrl, null)
                .then(this.onUnitUnloadSuccess.bind(this))
                .catch(this.onUnitUnloadError.bind(this));
        },

        onSaveUnitWithoutDestinationSuccess: function (oResponseData) {
            this.showSaveSuccessMessage();
            this._updatePackingUnitTable(oResponseData);
        },

        showSaveSuccessMessage: function () {
            let sMessageKey;
            let vMessageArg = this.getSaveSuccessMsgArg();

            if (this.oUserAction.isAdd()) {
                sMessageKey = "success.itemsPacked.msg";
            } else if (this.oUserAction.isRemove()) {
                sMessageKey = "success.itemsRemoved.msg";
            } else if (this.oUserAction.isPack()) {
                sMessageKey = "success.unitPacked.msg";
            } else if (this.oUserAction.isUnpack()) {
                sMessageKey = "success.unitUnpacked.msg";
            }

            this.showMessage(this.getI18nText(sMessageKey, [ vMessageArg ]), true);
        },

        getSaveSuccessMsgArg: function () {
            let iUnitContentLength = this.getUnitContentData().length;
            if (this.oUserAction.isPack() || this.oUserAction.isUnpack()) {
                return this.oSavePayload.number;
            } else {
                return this.oUserAction.isRemove() ? (iUnitContentLength - this.aMovedContent.length) : this.aMovedContent.length;
            }
        },

        onUnitSaveError: function (oError) {
            this.showErrorMessage(oError);
            this.setUnitsListViewBusy(false);
            this.getAvailableObjectsTable().removeSelections(true);
            this.loadUnitData().then(this.refreshUnitDataOnSaveError.bind(this));
        },

        refreshUnitDataOnSaveError: function (oUnitData) {
            this.getAuxModel().setData(oUnitData);
            this.getViewModel().setProperty("/isCreatedFromCarrier", !!oUnitData.carrier);
        },

        onUnitUnloadSuccess: function (oResponseData) {
            let oUnitData = this.getUnitData();
            this.showMessage(this.getI18nText("packingUnitDetails.packItems.unloaded.msg", [ oUnitData.number ]), true);
            this._updatePackingUnitTable(oResponseData);
        },

        onUnitUnloadError: function (oError) {
            this.showErrorMessage(oError);
            this.setUnitsListViewBusy(false);
        },

        onSaveUnitWithDestinationSuccess: function (oResponseData) {
            this.setUnitsListViewBusy(false);
            this.getViewModel().setProperty("/assignDestinationVisible", true);
            this.getAuxModel().setData(oResponseData);
            // waits for the assign destination button to render before opening the assign destination dialog.
            this.onAssignDestinationPress();
        },

        onUnitSaveSuccess: function (oResponseData) {
            if (oResponseData.status === "CLOSED" && !this.getViewModel().getProperty(sOrderExistsProperty)) {
                // the packing is in closed status and not exist logistics order
                this.checkIsAssignDestinationAvailable(oResponseData)
                    .then(this.onSaveUnitWithDestinationSuccess.bind(this))
                    .catch(this.onSaveUnitWithoutDestinationSuccess.bind(this));
            } else {
                this.onSaveUnitWithoutDestinationSuccess(oResponseData);
            }
        },

        updatePackingUnitData: function (oResponseData) {
            this.setUnitsListViewBusy(false);
            this.getViewModel().setProperty("/availableSfcsSelectedAndValid", false);
            this.getViewModel().setProperty("/assignedItemsSelected", false);
            this.oEventBus.publish("resetUnitDetails");

            this.showSaveSuccessMessage();
            this.onUnitDataSuccessResponse(oResponseData);
        },

        _updatePackingUnitTable: function (oResponse) {
            this.setUnitsListViewBusy(false);
            this.oUserAction.setAction();
            this.aMovedContent = null;
            // return back to PU List if PU was packed
            let sUnitStatus = oResponse && oResponse.status;
            if (sUnitStatus === "OPEN") {
                this.onFinalizeUnpack();
            } else {
                this.onFinishPress();
            }
        },

        getAssignedObjectsTable: function () {
            return this.byId("assignedObjects");
        },

        getAvailableObjectsTable: function () {
            return this.byId("availableObjects");
        },

        checkIsAssignDestinationAvailable: function (oResponseData) {
            return new Promise(function (fnResolve, fnReject) {
                if (oResponseData.status === "CLOSED" && oResponseData.currentLocation && oResponseData.currentLocation.resource) {
                    this.fetchResource(oResponseData.currentLocation.ref).then(function (oResourceData) {
                        let bUnitManualForceDispatch = oResourceData.forceDispatch &&
                            oResourceData.defaultEngine === "MANUAL" && oResourceData.requestItem === "PACKING_UNIT";
                        bUnitManualForceDispatch ? fnResolve(oResponseData) : fnReject(oResponseData);
                    }).catch(function () {
                        this.showErrorMessage(this.getI18nText("packingUnitDetails.getCurrentLocationResource.error"));
                        fnReject(oResponseData);
                    }.bind(this));
                } else {
                    fnReject(oResponseData);
                }
            }.bind(this));
        },

        fetchResource: function (sResource) {
            let sUrl = this.getPlantDataSourceUri() + "Resources('" + encodeURIComponent(sResource) + "')" +
                "?$select=*&$expand=resourceTypeResources($expand=resourceType),resourceTechnicalObjects," +
                "resourceEquipmentAssignments,resourceShifts($expand=shift($expand=shiftDefinitions)),bins";
            return this.oServiceClient.get(sUrl, null);
        },

        setForceDispatch: function () {
            this.bForceDispatch = this.getLogisticsRestDataSourceUri() !== "dme/pod/dme/logistics-ms/";
        },

        /** ********* Assign Destinations **************/
        onAssignDestinationPress: function () {
            if (!this.oAssignDestinationDialog) {
                this.oAssignDestinationDialog = new AssignDestinationDialog(this);
            }
            this.oAssignDestinationDialog.open();
        },

        getViewModel: function () {
            return this.getView().getModel("viewModel");
        },

        getAuxModel: function () {
            return this.getView().getModel("auxData");
        },

        getUnitData: function () {
            return this.getAuxModel().getData();
        },

        setUnitsListViewBusy: function (bBusy) {
            this.getViewModel().setProperty("/unitsListViewBusy", bBusy);
        },

        getUnitContentData: function () {
            return this.getAuxModel().getProperty("/content");
        },

        setUnitContentData: function (aNewUnitContent) {
            this.getAuxModel().setProperty("/content", aNewUnitContent);
        },

        onAssignedItemSelected: function (oEvent) {
            let bAssignedItemsSelected = this.getAssignedObjectsTable().getSelectedItems().length > 0;
            this.getViewModel().setProperty("/assignedItemsSelected", bAssignedItemsSelected);
            this.getViewModel().setProperty("/allAssignedItemsSelected", !!oEvent.getParameter("selectAll"));
        },

        /**
         * Created the POD Plugin flags ruleset.
         * For Remove/Unpack actions (allowAll == true) we set all rules to true.
         * @param {boolean} allowAll True to allow all rules. Otherwise, read from POD config
         * @returns {{allowMixedOrders: boolean, allowAddConformantSfcToNonConformantPackingUnit: boolean, allowMixedOperations: boolean}} Payload with all flags
         */
        createRulesSetForPayload: function ({ allowAll = true }) {
            if (allowAll) {
                return {
                    allowMixedOperations: true,
                    allowMixedOrders: true,
                    allowAddConformantSfcToNonConformantPackingUnit: true
                };
            }
            const allowMixedOperations = this.getConfigOrDefaultProperty("allowMixedOperations");
            const allowMixedOrders = this.getConfigOrDefaultProperty("allowMixedOrders");
            const allowAddConformantSfcToNonConformantPackingUnit = this.getConfigOrDefaultProperty("allowAddConformantSfcToNonConformantPackingUnit");

            return {
                allowMixedOperations,
                allowMixedOrders,
                allowAddConformantSfcToNonConformantPackingUnit
            };
        },

        /**
         * Reads Plugin Configuration. If present - returns array of SFC statuses configuration.
         * If absent - returns default settings.
         * @returns {[{value: boolean, key: string}]} Array of configured SFC statuses. Or default if nothing was configured.
         */
        getConfigOrDefaultSfcStatuses: function () {
            return this.getConfiguration().allowedSfcStatusesForPacking || SfcAllowedStatuses.getDefault();
        },

        /**
         * Returns POD plugin settings value. If not yet setup - returns default value
         * @param {string} sConfigName Plugin Property Configuration name
         * @returns {boolean} whether setting is true or false
         */
        getConfigOrDefaultProperty: function (sConfigName) {
            const oConfig = this.getConfiguration();
            const bFlag = oConfig[sConfigName];
            return (bFlag === undefined ? PluginDefaultSettings[sConfigName] : bFlag);
        },

        initWIPFeature: async function () {
            const bWIPEnabled = !!this.getConfigOrDefaultProperty("showWIPButton");
            let bIsFeatureEnabled;
            try {
                bIsFeatureEnabled = await FeatureFlagSettings.checkFeature("packing_wip_order");
            } catch (exception) {
                bIsFeatureEnabled = false;
            }
            this.getViewModel().setProperty("/isWIPEnabled", bWIPEnabled && bIsFeatureEnabled);
            this.getViewModel().setProperty("/canWipPress", true);
        }
    });
});
