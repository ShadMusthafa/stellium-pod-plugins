sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/browse/ResourceBrowse",
    "sap/dm/dme/browse/WorkCenterBrowse",
    "sap/dm/dme/formatter/EnumFormatter",
    "sap/dm/dme/formatter/ObjectTypeFormatter",
    "sap/dm/dme/message/ErrorHandler",
    "sap/dm/dme/service/ServiceClient",
    "sap/dm/dme/podfoundation/model/PodType",
    "stellium/ext/podplugins/packingPlugin/controller/browse/PuMaterialBrowse"
], function (BaseObject, Fragment, JSONModel, ResourceBrowse, WorkCenterBrowse, EnumFormatter, ObjectTypeFormatter,
    ErrorHandler, ServiceClient, PodType, PuMaterialBrowse) {
    "use strict";

    let sCurrentLocation = "/currentLocation";
    let sPackingMaterialType = "/packagingMaterialType";
    const sI18nErrorMaterialNotSelected = "packingUnits.materialIsNotSelected.error";
    const sPackingMaterialRef = "/packingMaterialRef";
    const sReturnablePackaging = "RETURNABLE_PACKAGING";

    return BaseObject.extend("stellium.ext.podplugins.packingPluginToshif.controller.CreatePackDialog", {
        enumFormatter: EnumFormatter,
        objectTypeFormatter: ObjectTypeFormatter,
        bAutogenerateId: false,

        /**
         * Constructor for the Create Pack Dialog. Instance must contain <code>open</code> method
         * that is called by the core functionality to show the user Create Pack UI.

         * @extends sap.ui.base.Object
         *
         * @constructor
         * @param {PackingUnitsController} oParentController PackingUnit Controller. Used to read all the models.
         * @public
         * @alias stellium.ext.podplugins.packingPluginToshif.controller.CreatePackDialog
         */
        constructor: function (oParentController) {
            this.oParentController = oParentController;
        },

        /**
         * Used to show the UI with Create Pack functionality to the user.
         * @public
         */
        open: function () {
            this.oParentView = this.oParentController.getView();
            this.bAutogenerateId = this.oParentController.getConfiguration().autogenerateId;
            Fragment.load({
                id: this.oParentController.getView().getId(),
                name: "stellium.ext.podplugins.packingPluginToshif.view.fragment.CreatePackDialog",
                controller: this
            }).then(this.initAndOpenDialog.bind(this));
        },

        initAndOpenDialog: function (oDialog) {
            let oEnumBundle = this.oParentView.getModel("i18n-enum").getResourceBundle();
            let oObjectTypeBundle = this.oParentView.getModel("i18n-objectType").getResourceBundle();
            this.oParentView.addDependent(oDialog);
            EnumFormatter.init(oEnumBundle);
            ObjectTypeFormatter.init(oObjectTypeBundle);
            this.initializeDialogModels(oDialog);
            oDialog.open();
        },

        initializeDialogModels: function (oDialog) {
            oDialog.setModel(new JSONModel({
                carrierId: null,
                unitId: null,
                packingMaterialRef: null,
                packagingMaterialType: null,
                currentLocation: this.getDefaultCurrentLocation(),
                sourceLocationType: this.getDefaultSourceLocationType()
            }));

            let sUrl = `${this.oParentController.getPackingRestDataSourceUri()}carriers`;
            return this.oParentController.oServiceClient.get(sUrl).then(function (aCarriersList) {
                oDialog.setModel(new JSONModel(aCarriersList), "carriersList");
            });
        },

        getDefaultSourceLocationType: function () {
            let oPodSelectionModel = this.oParentController.getPodSelectionModel();
            return oPodSelectionModel.getPodType() === PodType.Order ? "WORKCENTER" : "RESOURCE";
        },

        getDefaultCurrentLocation: function () {
            let oPodSelectionModel = this.oParentController.getPodSelectionModel();
            let oWorkCenter = oPodSelectionModel.getWorkCenter();
            let oResource = oPodSelectionModel.getResource();

            return this.getDefaultSourceLocationType() === "WORKCENTER" ? oWorkCenter : (oResource && oResource.resource);
        },

        fillDefaultPackingId: function () {
            if (!this.bAutogenerateId) {
                return;
            }

            if (this.canGenerateId()) {
                this.onGeneratePressed();
            } else {
                this.getDialogModel().setProperty("/unitId", null);
            }
        },

        canGenerateId: function () {
            const bHasMaterialDefined = this.getDialogModel().getProperty(sPackingMaterialRef);
            let bValidCarrier = true;
            let bValidCurrentLocation = true;
            const bReturnablePackaging = this.getDialogModel().getProperty("/packagingMaterialType") === sReturnablePackaging;
            if (bReturnablePackaging) {
                bValidCarrier = this.validateSelectedCarrierId(false);
                bValidCurrentLocation = !!this.getValidatedCurrentLocation(false);
            }

            return bValidCarrier && bHasMaterialDefined && bValidCurrentLocation;
        },

        onCreatePackDialogPress: function () {
            let oPackingUnitIdInput = this.getDialogControlById("packId");
            let oCreateDialogData = this.getDialogModel().getData();
            let bReturnablePackaging = oCreateDialogData.packagingMaterialType === sReturnablePackaging;

            if (!this.validateDialogData(oPackingUnitIdInput, bReturnablePackaging)) {
                return;
            }

            this.clearControlErrorState(oPackingUnitIdInput);
            let oPayload = this.createPayloadForNewUnit(oCreateDialogData, bReturnablePackaging);
            this.createPacking(oPayload);
        },

        createPayloadForNewUnit: function (oCreateDialogData, bReturnablePackaging) {
            let sLocationType = this.getDialogModel().getProperty("/sourceLocationType");
            return {
                carrier: bReturnablePackaging ? { carrierNumber: oCreateDialogData.carrierId } : null,
                currentLocation: bReturnablePackaging && (sLocationType === "RESOURCE")
                    ? { resource: oCreateDialogData.currentLocation } : null,
                workCenterLocation: bReturnablePackaging && (sLocationType === "WORKCENTER")
                    ? { workCenter: oCreateDialogData.currentLocation } : null,
                number: this.getDialogModel().getProperty("/unitId"),
                status: "OPEN",
                material: { ref: this.getValidatedMaterialRef() },
                packingType: bReturnablePackaging ? this.getPackingType() : null,
                content: []
            };
        },

        clearCurrentLocationField: function () {
            this.getDialogModel().setProperty("/currentLocation", null);
        },

        createPacking: function (oPayload) {
            let sUrl = this.oParentController.getPackingRestDataSourceUri() + "packingUnits";
            this.oParentController.clearMessages();
            new ServiceClient().post(sUrl, oPayload)
                .then(function () {
                    let sMessage = this.oParentController.getI18nText("packingUnits.create.msg", oPayload.number);
                    this.getPackingCreateDialog().close();
                    this.oParentController.showSuccessMessage(sMessage, true, true);
                    this.oParentController.loadPackingUnitsList();
                }.bind(this))
                .catch(function (oError) {
                    this.oParentController.showErrorMessage(oError, false, true);
                }.bind(this));
        },

        validateDialogData: function (oPackingUnitIdInput, bReturnablePackaging) {
            let bValidMaterial = !!this.getValidatedMaterialRef();
            let bValidUnitId = this.validatePackingUnitId(this.getDialogModel().getProperty("/unitId"));
            let bValidCarrier = true;
            let bValidCurrentLocation = true;

            if (bReturnablePackaging) {
                bValidCarrier = this.validateSelectedCarrierId(true);
                bValidCurrentLocation = !!this.getValidatedCurrentLocation(true);
            }

            return bValidCarrier && bValidMaterial && bValidCurrentLocation && bValidUnitId;
        },

        validatePackingUnitId: function (sPackingId) {
            this.clearControlErrorState(this.getUnitIdControl());
            let sMessageKey;

            if (!sPackingId) {
                sMessageKey = "packingUnits.packingUnitIdIsNotSpecified.error";
            }

            if (sMessageKey) {
                this.setControlErrorState(this.getUnitIdControl(), sMessageKey);
            }

            return !sMessageKey;
        },

        validateSelectedCarrierId: function (bMarkControlErrorState) {
            let oControl = this.getDialogControlById("carrierId");
            let bIsValid = !!oControl.getSelectedItem();
            if (!bIsValid && bMarkControlErrorState) {
                oControl.setValueState(sap.ui.core.ValueState.Error);
            }
            return bIsValid;
        },

        onCancelCreatePackDialogPress: function () {
            this.getPackingCreateDialog().close();
        },

        onAfterClose: function () {
            let oDialog = this.getPackingCreateDialog();
            this.oParentController.getView().removeDependent(oDialog);
            oDialog.destroy();
            this.oParentController.oDialog = null;
        },

        getValidatedMaterialRef: function () {
            let oMaterialInput = this.getDialogControlById("materialId");
            let sSelectedMaterialRef = this.getDialogModel().getProperty(sPackingMaterialRef);
            if (!sSelectedMaterialRef) {
                this.setControlErrorState(oMaterialInput, sI18nErrorMaterialNotSelected);
                return null;
            }
            ErrorHandler.clearErrorState(oMaterialInput);
            return sSelectedMaterialRef;
        },

        setControlErrorState: function (oControl, sMessageId) {
            ErrorHandler.setErrorState(oControl);
            if (sMessageId) {
                oControl.setValueStateText(this.oParentController.getI18nText(sMessageId));
            }
        },

        clearControlErrorState: function (oControl) {
            ErrorHandler.clearErrorState(oControl);
        },

        getValidatedCurrentLocation: function (bMarkControlErrorState) {
            let sType = this.getDialogModel().getProperty("/sourceLocationType");
            let sControlId = sType === "RESOURCE" ? "currentLocationResource" : "currentLocationWorkcenter";
            let sCurrentLocationField = this.getDialogControlById(sControlId);
            let sCurrentLocationValue = this.getDialogModel().getProperty(sCurrentLocation);
            if (!sCurrentLocationValue && bMarkControlErrorState) {
                this.setControlErrorState(sCurrentLocationField, "error.emptyCurrentLocation.msg");
            }
            return sCurrentLocationValue;
        },

        onGeneratePressed: function () {
            let sMaterialRef = this.getValidatedMaterialRef();
            if (!sMaterialRef) {
                return;
            }
            this.getPackingCreateDialog().setBusy(true);

            let sUri = this.oParentController.getNumberingRestDataSourceUri() + "identifiers/generate/untracked";

            new ServiceClient().post(sUri, this.getGeneratePayload())
                .then(this.onGenerateUnitIdSuccessResponse.bind(this))
                .catch(this.onGenerateUnitIdErrorResponse.bind(this));
        },

        getGeneratePayload: function () {
            let oDialogModelData = this.getDialogModel().getData();
            let bReturnablePackaging = oDialogModelData.packagingMaterialType === "RETURNABLE_PACKAGING";
            return {
                eventName: "PACKING_UNIT_NUMBER",
                numberOfIdentifiers: 1,
                objectsToMatch: {
                    MATERIAL_NAME: oDialogModelData.packagingMaterialName,
                    MATERIAL_VERSION: oDialogModelData.packagingMaterialVer
                },
                extensionParameters: {
                    CARRIER_ID: oDialogModelData.carrierId || null,
                    RESOURCE: bReturnablePackaging && (oDialogModelData.sourceLocationType === "RESOURCE")
                        ? (oDialogModelData.currentLocation || null) : null,
                    WORK_CENTER: bReturnablePackaging && (oDialogModelData.sourceLocationType === "WORKCENTER")
                        ? (oDialogModelData.currentLocation || null) : null,
                    PACKING_TYPE: bReturnablePackaging ? (this.getPackingType() || null) : null
                }
            };
        },

        onCarrierChange: function (oEvent) {
            let oCarrierComboBox = oEvent.getSource();
            oCarrierComboBox.setValueState(sap.ui.core.ValueState.None);
            let oSelectedItem = oCarrierComboBox.getSelectedItem();

            if (!oSelectedItem) {
                this.selectMaterial(null);
                this.getDialogModel().setProperty(sPackingMaterialType, "PACKING");
            } else {
                let oContext = oSelectedItem.getBindingContext("carriersList");
                this.selectMaterial(oContext.getProperty("material"));
            }

            // call in next event loop cycle to give time fill the model properties
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.fillDefaultPackingId();
                    resolve();
                }, 0);
            });
        },

        selectMaterial: function (oMaterialData) {
            this.getDialogModel().setProperty(sPackingMaterialRef, oMaterialData ? oMaterialData.ref : null);
            this.getDialogModel().setProperty("/packagingMaterialName", oMaterialData ? oMaterialData.material || oMaterialData.name : null);
            this.getDialogModel().setProperty(sPackingMaterialType, oMaterialData ? oMaterialData.materialType : null);
            this.getDialogModel().setProperty("/packagingMaterialVer", oMaterialData ? oMaterialData.version : null);
        },

        onUnitCreateMaterialBrowse: function (oEvent) {
            const oMaterialInput = oEvent.getSource();
            const sFilterQuery = "(materialType eq com.sap.mes.odata.MaterialType'PACKAGING' or materialType eq" +
                " com.sap.mes.odata.MaterialType'RETURNABLE_PACKAGING') and currentVersion eq true";
            PuMaterialBrowse.open(this.oParentView, oMaterialInput.getValue(), oSelectedMaterial => {
                let oCarrierSelect = this.getDialogControlById("carrierId");
                this.selectMaterial(oSelectedMaterial);
                oCarrierSelect.setSelectedItem(null);
                this.fillDefaultPackingId();
            }, this.oParentView.getModel("product"), sFilterQuery);
        },

        onResourceBrowse: function (oEvent) {
            let oCurrentLocationInput = oEvent.getSource();
            ResourceBrowse.open(this.oParentView, oCurrentLocationInput.getValue(),
                function (oSelectedObject) {
                    this.getDialogModel().setProperty(sCurrentLocation, oSelectedObject.name);
                    this.clearControlErrorState(oCurrentLocationInput);
                    this.fillDefaultPackingId();
                }.bind(this), this.oParentView.getModel("plant"));
        },

        onWorkCenterBrowse: function (oEvent) {
            let oCurrentLocationInput = oEvent.getSource();
            WorkCenterBrowse.open(this.oParentView, oCurrentLocationInput.getValue(),
                function (oSelectedObject) {
                    this.getDialogModel().setProperty(sCurrentLocation, oSelectedObject.name);
                    this.clearControlErrorState(oCurrentLocationInput);
                    this.fillDefaultPackingId();
                }.bind(this), this.oParentView.getModel("plant"));
        },

        onMaterialSelectionChange: function (oEvent) {
            const oMaterialInput = oEvent.getSource();
            const sMaterialInputValue = oMaterialInput.getValue();
            this.clearControlErrorState(oMaterialInput);
            if (!sMaterialInputValue) {
                this.selectMaterial(null);
                this.setControlErrorState(oMaterialInput, sI18nErrorMaterialNotSelected);
                return;
            }

            return this.oParentController.findMaterialData(sMaterialInputValue).then((oMaterial) => {
                this.selectMaterial(oMaterial);
                if (oMaterial) {
                    const oCarrierSelect = this.getDialogControlById("carrierId");
                    oCarrierSelect.setSelectedItem(null);
                    this.fillDefaultPackingId();
                } else {
                    this.setControlErrorState(oMaterialInput, sI18nErrorMaterialNotSelected);
                }
            }).catch((oError) => {
                this.oParentController.showErrorMessage(oError);
                this.selectMaterial(null);
                this.setControlErrorState(oMaterialInput, sI18nErrorMaterialNotSelected);
            });
        },

        getPackingType: function () {
            let oRadioBtnGroup = this.getDialogControlById("packagingTypeRbtnGrp");
            let iSelectedIndex = oRadioBtnGroup.getSelectedIndex();
            return iSelectedIndex === 0 ? "CONFORMANT" : "NONCONFORMANT";
        },

        onGenerateUnitIdSuccessResponse: function (oResponse) {
            this.getPackingCreateDialog().setBusy(false);
            this.getDialogModel().setProperty("/unitId", oResponse.identifiers[0]);
            this.getUnitIdControl().setValueState(sap.ui.core.ValueState.None);
        },

        onGenerateUnitIdErrorResponse: function () {
            this.getPackingCreateDialog().setBusy(false);
            ErrorHandler.setErrorState(this.getUnitIdControl(), this.oParentController.getI18nText(
                "packingUnits.createPackingUnitDialog.generateId.error"));
        },

        getDialogControlById: function (sId) {
            return this.oParentController.byId(sId);
        },

        getUnitIdControl: function () {
            return this.getDialogControlById("packId");
        },

        getPackingCreateDialog: function () {
            return this.oParentController.byId("createPackDialog");
        },

        getDialogModel: function () {
            return this.getPackingCreateDialog().getModel();
        }
    });
});
