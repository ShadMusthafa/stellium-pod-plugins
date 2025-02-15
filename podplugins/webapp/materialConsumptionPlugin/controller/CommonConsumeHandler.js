sap.ui.define([
    "sap/ui/base/Object",
], function (Object) {
    "use strict";
    var CommonConsumeHandler = Object.extend("stellium.ext.podplugins.materialConsumptionPlugin.controller.CommonConsumeHandler", {
        constructor: function () {
        }
    });

    CommonConsumeHandler.prototype.oMaterialConsumptionController = null;
    CommonConsumeHandler.prototype.getView = function () {
        return this.oMaterialConsumptionController && this.oMaterialConsumptionController.getView();
    }
    CommonConsumeHandler.prototype.getCurrentModel = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.getModel("weighingModel");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.getModel("scanWeighingModel");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.getModel("addWeighingModel");
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentDialogId = function () {
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return "weighDialog";
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return "scanWeighDialog";
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return "addWeighDialog";
        // C5278086 Adding changes for W&D End
        return "none";
    };

    CommonConsumeHandler.prototype.getCurrentSaveButton = function () {
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return "weighing";
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return "scanWeighing";
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return "addWeighing";
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentCancelButton = function () {
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return "weighing";
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return "scanWeighing";
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return "addWeighing";
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentInputMaterialControl = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighMatNum");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighMatNum");
        //  C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentInputHuControl = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("idHandlingUnitScanInput");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighMatNum");
        //  C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentInputBatchIdControl = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("inBatchIDWeighing");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighBatchID");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighBatchID");
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentInputQuantityControl = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isScanDialogOpen && this.oMaterialConsumptionController.isScanDialogOpen === true)
            return oView.byId("inputQuantityScan");
        if (this.oMaterialConsumptionController.isAddDialogOpen && this.oMaterialConsumptionController.isAddDialogOpen === true)
            return oView.byId("inputQuantityAdd");
        if (this.oMaterialConsumptionController.isConsumeDialogOpen && this.oMaterialConsumptionController.isConsumeDialogOpen === true)
            return oView.byId("inputQuantity");
    };

    CommonConsumeHandler.prototype.getFormControl = function () {
        if (this.getCurrentForm()) {
            return this.getCurrentForm().getContent();
        }
    };

    CommonConsumeHandler.prototype.getCurrentForm = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("weighMaterialForm");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("scanWeighMaterialForm");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("addWeighMaterialForm");
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentCommentsControl = function () {
        const oView = this.getView();
        // C5278086 Adding changes for W&D Start
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("inWeighingComments");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighComments").getContent();
        // C5278086 Adding changes for W&D End
    };

    CommonConsumeHandler.prototype.getCurrentWeighBatchInput = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("inBatchIDWeighing");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighBatchID");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighBatchID");
    };

    CommonConsumeHandler.prototype.getCurrentStorageLocationInput = function () {
        var oView = this.getView();
        if (this.oMaterialConsumptionController.isAddDialogOpen && this.oMaterialConsumptionController.isAddDialogOpen === true)
            return oView.byId("storageLocationAdd");
        if (this.oMaterialConsumptionController.isScanDialogOpen && this.oMaterialConsumptionController.isScanDialogOpen === true)
            return oView.byId("storageLocationScan");
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("inStorageLocation");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighStorageLocation");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighStorageLocation");
        if (this.oMaterialConsumptionController.isConsumeDialogOpen && this.oMaterialConsumptionController.isConsumeDialogOpen === true)
            return oView.byId("storageLocation");
        
    };

    CommonConsumeHandler.prototype.getCurrentWeighScaleList = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("cmbScaleList")
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("cmbScanWeighScaleList");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("cmbAddWeighScaleList");
    };

    CommonConsumeHandler.prototype.getCurrentWeighVizLegend = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("vizLineLegend");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("vizLineScanWeighLegend");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("vizLineAddWeighLegend");
    };

    CommonConsumeHandler.prototype.getCurrentVizFrameTotal = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("vizFrameTotalWeight");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("vizFrameScanWeighTotalWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("vizFrameAddWeighTotalWeight");
    };

    CommonConsumeHandler.prototype.getCurrentVizFrameCurrent = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("vizFrameCurrentWeight");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("vizFrameScanWeighCurrentWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("vizFrameAddWeighCurrentWeight");
    };

    CommonConsumeHandler.prototype.getCurrentSetZeroButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnSetZero")
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighSetZero");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighSetZero");
    };

    CommonConsumeHandler.prototype.getCurrentConfirmButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnConfirmWeight")
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighConfirmWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighConfirmWeight");
    };

    CommonConsumeHandler.prototype.getCurrentAddWeightButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnAddWeight")
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighAddWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighAddWeight");
    };

    CommonConsumeHandler.prototype.getCurrentSetTareButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnSetTare")
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighSetTare");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighSetTare");
    };
    CommonConsumeHandler.prototype.getCurrentWeighCommentsArea = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("inWeighingComments");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("inScanWeighComments");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("inAddWeighComments");
    };

    CommonConsumeHandler.prototype.getCurrentWeighingForm = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("weighMaterialForm2").getContent();
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("scanWeighMaterialForm2").getContent();
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("addWeighMaterialForm2").getContent();
    };

    CommonConsumeHandler.prototype.getCurrentWeightConfirmButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnConfirmWeight");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighConfirmWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighConfirmWeight");
    };

    CommonConsumeHandler.prototype.getCurrentWeightAddWeightButton = function () {
        const oView = this.getView();
        if (this.oMaterialConsumptionController.isWeighingDialogOpen && this.oMaterialConsumptionController.isWeighingDialogOpen === true)
            return oView.byId("btnAddWeight");
        if (this.oMaterialConsumptionController.isScanWeighDialogOpen && this.oMaterialConsumptionController.isScanWeighDialogOpen === true)
            return oView.byId("btnScanWeighAddWeight");
        if (this.oMaterialConsumptionController.isAddWeighDialogOpen && this.oMaterialConsumptionController.isAddWeighDialogOpen === true)
            return oView.byId("btnAddWeighAddWeight");
    };
    CommonConsumeHandler.prototype.getI18nTextByKey = function (sTextKey, aParamArray) {
        return this.oMaterialConsumptionController && this.oMaterialConsumptionController.getI18nTextByKey(sTextKey, aParamArray);
    };
    CommonConsumeHandler.prototype.getI18nText = function (sTextKey, aParamArray) {
        return this.oMaterialConsumptionController && this.oMaterialConsumptionController.getI18nTextByKey(sTextKey, aParamArray);
    };
    CommonConsumeHandler.prototype.showErrorMessage = function (oError, bShowAsToast, bAddToMessagePopover, sMessageType) {
        this.oMaterialConsumptionController && this.oMaterialConsumptionController.showErrorMessage(oError, bShowAsToast, bAddToMessagePopover, sMessageType);
    };
    CommonConsumeHandler.prototype.focusMaterialInput = function () {
        this.oMaterialConsumptionController && this.oMaterialConsumptionController.focusMaterialInput();
    };
    CommonConsumeHandler.prototype.focusHandlingUnitInput = function () {
        this.oMaterialConsumptionController && this.oMaterialConsumptionController.focusHandlingUnitInput();
    };
    CommonConsumeHandler.prototype.buildCustomFieldFormContent = function () {
        this.oMaterialConsumptionController && this.oMaterialConsumptionController.buildCustomFieldFormContent();
    };
    CommonConsumeHandler.prototype.resetModel = function (oModel) {
        this.oMaterialConsumptionController && this.oMaterialConsumptionController.resetModel(oModel);
    };
    CommonConsumeHandler.prototype.getCurrentDateInPlantTimeZone = function () {
        return this.oMaterialConsumptionController && this.oMaterialConsumptionController.getCurrentDateInPlantTimeZone.call(this.oMaterialConsumptionController);
    };
    CommonConsumeHandler.prototype.getLoggedInUser = function () {
        return this.oMaterialConsumptionController.loggedInUserDetails && this.oMaterialConsumptionController.loggedInUserDetails.userId || '';
    };
    CommonConsumeHandler.prototype.setWeighButtons = function (bStatus) {
        const oView = this.getView();
        oView.byId('btnConfirmWeight') && oView.byId('btnConfirmWeight').setEnabled(bStatus);
        oView.byId('btnAddWeight') && oView.byId('btnAddWeight').setEnabled(bStatus);

        oView.byId('btnAddWeighConfirmWeight') && oView.byId('btnAddWeighConfirmWeight').setEnabled(bStatus);
        oView.byId('btnAddWeighAddWeight') && oView.byId('btnAddWeighAddWeight').setEnabled(bStatus);

        oView.byId('btnScanWeighConfirmWeight') && oView.byId('btnScanWeighConfirmWeight').setEnabled(bStatus);
        oView.byId('btnScanWeighAddWeight') && oView.byId('btnScanWeighAddWeight').setEnabled(bStatus);
    };
    CommonConsumeHandler.prototype.setWeighPopUpVizFrameBusyState = function (bState) {
        const oView = this.getView();
        oView.byId('weighMaterialForm') && oView.byId('weighMaterialForm').setBusy(bState);
        oView.byId('scanWeighMaterialForm') && oView.byId('scanWeighMaterialForm').setBusy(bState);
        oView.byId('addWeighMaterialForm') && oView.byId('addWeighMaterialForm').setBusy(bState);

        oView.byId('vizFrameTotalWeight') && oView.byId('vizFrameTotalWeight').setBusy(bState);
        oView.byId('vizFrameCurrentWeight') && oView.byId('vizFrameCurrentWeight').setBusy(bState);
        oView.byId('vizFrameAddWeighTotalWeight') && oView.byId('vizFrameAddWeighTotalWeight').setBusy(bState);
        oView.byId('vizFrameAddWeighCurrentWeight') && oView.byId('vizFrameAddWeighCurrentWeight').setBusy(bState);

        oView.byId('vizFrameScanWeighTotalWeight') && oView.byId('vizFrameScanWeighTotalWeight').setBusy(bState);
        oView.byId('vizFrameScanWeighCurrentWeight') && oView.byId('vizFrameScanWeighCurrentWeight').setBusy(bState);
    };

    return CommonConsumeHandler;
});
