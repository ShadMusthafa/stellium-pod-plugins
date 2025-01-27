sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/browse/WorkCenterBrowse",
    "sap/dm/dme/browse/ResourceBrowse",
    "sap/dm/dme/browse/StorageLocationBrowse",
    "sap/dm/dme/formatter/EnumFormatter",
    "sap/dm/dme/podfoundation/model/PodType",
    "sap/ui/model/Filter",
    "sap/dm/dme/formatter/DateTimeUtils",
    "sap/dm/dme/types/PlantDateTimeType"
], function (BaseObject, Fragment, JSONModel, WorkCenterBrowse, ResourceBrowse, StorageLocationBrowse, EnumFormatter,
    PodType, Filter, DateTimeUtils, PlantDateTimeType) {
    "use strict";

    let sDestination = "/destination";
    let sDestinationTypeKey = "/destinationType";

    return BaseObject.extend("stellium.ext.podplugins.packingPluginToshif.controller.AssignDestinationDialog", {
        enumFormatter: EnumFormatter,
        DateTimeUtils: DateTimeUtils,
        types: { plantdatetime: new PlantDateTimeType() },

        constructor: function (oParentController) {
            this.oParentController = oParentController;
        },

        open: function () {
            this.oParentView = this.oParentController.getView();
            Fragment.load({
                id: this.oParentView.getId(),
                name: "stellium.ext.podplugins.packingPluginToshif.view.fragment.AssignDestination",
                controller: this
            }).then(this.initAndOpenDialog.bind(this));
        },

        initAndOpenDialog: function (oDialog) {
            let oEnumBundle = this.oParentView.getModel("i18n-enum").getResourceBundle();
            EnumFormatter.init(oEnumBundle);
            this.oParentView.addDependent(oDialog);
            this.initializeDialogModel(oDialog);
            oDialog.open();
        },

        inputValueSuggestions: function (oEvent) {
            let sTerm = oEvent.getParameter("suggestValue");
            let aFilters = [];
            let sDestinationType = this.getDialogModel().getProperty(sDestinationTypeKey);

            if (sTerm) {
                let oDescriptionFilter = new Filter("description", sap.ui.model.FilterOperator.Contains, sTerm);
                let sFilterOption = this._getFilterOption(sDestinationType);
                let oFilter = new Filter(sFilterOption, sap.ui.model.FilterOperator.Contains, sTerm);

                aFilters.push(oFilter, oDescriptionFilter);
            }

            let oSuggestionBinding = oEvent.getSource().getBinding("suggestionItems");
            oSuggestionBinding.filter(aFilters);
        },

        destinationTypeChange: function () {
            this.getDialogModel().setProperty(sDestination, null);
        },

        initializeDialogModel: function (oDialog) {
            oDialog.setModel(new JSONModel({
                destination: null,
                dueTime: null,
                destinationType: this.getDefaultDestinationType(),
                dmcDateTimePickerValueFormat: DateTimeUtils.dmcDateValueFormat()
            }));
        },

        getDefaultDestinationType: function () {
            let sPodType = this.oParentController.getPodSelectionModel().getPodType();
            return sPodType === PodType.Order ? "WORK_CENTER" : "RESOURCE";
        },

        onDueTimeDateTimePickerChange: function (oEvent) {
            let oDueTimeDateTimePicker = oEvent.getSource();
            oDueTimeDateTimePicker.setValueState(oDueTimeDateTimePicker.isValidValue() ? "None" : "Error");
        },

        onAssignDestinationPress: function () {
            if (!this.validateData()) {
                return;
            }

            this.setBusy(true);
            let sUrl = this.oParentController.getLogisticsRestDataSourceUri() + "sendLogisticsOrderEvent";

            this.oParentController.oServiceClient.post(sUrl, this.createPayloadForLogisticsOrder())
                .then(this.onAssignDestinationSuccess.bind(this))
                .catch(this.onAssignDestinationError.bind(this));
        },

        createPayloadForLogisticsOrder: function () {
            let sUnitNumber = this.oParentController.getUnitData().number;
            let oModel = this.getDialogModel();
            return {
                actionType: "PU_ASSIGN_DESTINATION",
                orderType: "TRANSPORT",
                origin: "AUTOMATIC",
                referenceNumber: sUnitNumber,
                referenceType: "PACKING_UNIT",
                destinationType: oModel.getProperty(sDestinationTypeKey),
                destinationLocation: oModel.getProperty(sDestination),
                dueDateTime: oModel.getProperty("/dueTime") || null
            };
        },

        onAssignDestinationSuccess: function () {
            this.setBusy(false);
            this.showSuccessMessage(this.getI18nText("packingUnitDetails.assignDestination.assigned.msg"));
            this.oParentController._updatePackingUnitTable(this.oParentController.getUnitContentData());
            this.onCancelPress();
        },

        onAssignDestinationError: function (oError) {
            this.showErrorMessage(oError);
            this.setBusy(false);
        },

        validateData: function () {
            let sMessageKey;
            let bValidDestination = !!this.getDialogModel().getProperty(sDestination);

            if (!bValidDestination) {
                sMessageKey = "packingUnitDetails.assignDestination.resource.notvalid";
            }

            if (!sMessageKey) {
                let oDueTime = this.getDialogControlById("dueTime");
                if (oDueTime.getValueState() === "Error") {
                    sMessageKey = "packingUnitDetails.assignDestination.dueTime.notvalid";
                }
            }

            if (sMessageKey) {
                this.showErrorMessage(this.getI18nText(sMessageKey));
            }

            return !sMessageKey;
        },

        onCancelPress: function () {
            this.getAssignDestinationDialog().close();
        },

        onAfterClose: function () {
            let oAssignDestinationDialog = this.getAssignDestinationDialog();

            this.oParentView.removeDependent(oAssignDestinationDialog);
            oAssignDestinationDialog.destroy();
            this.oParentController.oAssignDestinationDialog = null;
        },

        onResourceBrowse: function (oEvent) {
            let oInput = oEvent.getSource();
            ResourceBrowse.open(this.oParentView, oInput.getValue(), function (oSelectedObject) {
                this.getDialogModel().setProperty(sDestination, oSelectedObject.name);
            }.bind(this), this.oParentView.getModel("plant"));
        },

        onWorkCenterBrowse: function (oEvent) {
            let oInput = oEvent.getSource();
            WorkCenterBrowse.open(this.oParentView, oInput.getValue(), function (oSelectedObject) {
                this.getDialogModel().setProperty(sDestination, oSelectedObject.name);
            }.bind(this), this.oParentView.getModel("plant"));
        },


        onStorageLocationBrowse: function (oEvent) {
            let oInput = oEvent.getSource();
            StorageLocationBrowse.open(this.oParentView, oInput.getValue(), function (oSelectedObject) {
                this.getDialogModel().setProperty(sDestination, oSelectedObject.name);
            }.bind(this), this.oParentView.getModel("inventory"));
        },

        getDialogControlById: function (sId) {
            return this.oParentController.byId(sId);
        },

        showSuccessMessage: function (sMessage) {
            this.oParentController.showSuccessMessage(sMessage, true);
        },

        showErrorMessage: function (sMessage) {
            this.oParentController.showErrorMessage(sMessage);
        },

        getI18nText: function (sKey) {
            return this.oParentController.getI18nText(sKey);
        },

        setBusy: function (bBusy) {
            this.oParentView.setBusy(bBusy);
        },

        getAssignDestinationDialog: function () {
            return this.oParentController.byId("assignDestinationDialog");
        },

        getDialogModel: function () {
            return this.getAssignDestinationDialog().getModel();
        },

        _getFilterOption: function (sDestinationType) {
            if (sDestinationType === "RESOURCE") {
                return "resource";
            }
            return sDestinationType === "WORK_CENTER" ? "workcenter" : "storageLocation";
        }
    });
});
