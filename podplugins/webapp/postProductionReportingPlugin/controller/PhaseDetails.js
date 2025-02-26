sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/dm/dme/util/PlantSettings",
    "sap/dm/dme/formatter/DateTimeUtils"
], function (JSONModel, MessageToast, AjaxUtil, ErrorHandler, PlantSettings, DateTimeUtils) {
    "use strict";

    return {

        setController: function (sController) {
            this.oController = sController;
        },

        setPhaseDetails: function (oData) {
            oData.truncatedOperationId = oData.operation.operation;
            oData.truncatedPhaseId = oData.stepId ? oData.stepId : this.formatPhaseId(oData.phaseId);
            var startDateCtrl = sap.ui.core.Fragment.byId("PhaseDetails" + oData.truncatedPhaseId, "actualStartDate");
            var completeDateCtrl = sap.ui.core.Fragment.byId("PhaseDetails" + oData.truncatedPhaseId, "actualEndDate");
            if(!this.oController.oViewData['prefillPhaseDates']) {
                oData.tempStartDate = "";
                oData.tempEndDate = "";
                sap.ui.core.Fragment.byId("PhaseDetails" + oData.truncatedPhaseId, "startDateSave").setEnabled(false);
                sap.ui.core.Fragment.byId("PhaseDetails" + oData.truncatedPhaseId, "endDateSave").setEnabled(false);
            }
            else {
                oData.tempStartDate = (oData.actualStartDate) ? oData.actualStartDate : oData.scheduleStartDate;
                oData.tempEndDate = (oData.actualEndDate) ? oData.actualEndDate : oData.scheduleEndDate;
            }
            
            // Set the initial focused date to current plant time 
            var currentDateTimeInPlantTimeZone = this.oController.getCurrentDateTimeInPlantTimeZone();
            if(sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g,"T")
            }
            startDateCtrl.setInitialFocusedDateValue(new Date(currentDateTimeInPlantTimeZone));
            completeDateCtrl.setInitialFocusedDateValue(new Date(currentDateTimeInPlantTimeZone));
            
            var oModel = new JSONModel(oData);
            this.oController.phaseDetailsSubSection.setModel(oModel, "phaseDetails");
            this.oController.phaseDetailsSubSection.bindElement({path: "/", model: "phaseDetails"});
        },

        startPhaseOnSave: function (postPayload, modelData, oEvent) {
            const sProductionDataSourceUrl = this.oController.getProductionDataSourceUri();
 
            postPayload.stepId = modelData.stepId;
            let sUrl = '';
            if (oEvent.getSource().getText() === this.oController.getI18nText("update.btn")) {
                postPayload.updatedStartDateTime = this.oController.PhaseDetails.tempStartDate = modelData.tempStartDate;
                sUrl = sProductionDataSourceUrl + "operationActivity/updateStartTime";
            } else {
                postPayload.dateTimeUtc = this.oController.PhaseDetails.tempStartDate = modelData.tempStartDate;
                postPayload.dateTimeUtc = DateTimeUtils.dmcDateToUTCFormat(postPayload.dateTimeUtc, PlantSettings.getTimeZone());
                sUrl = sProductionDataSourceUrl + "orders/startOperationActivity";
            }
            this.oController.PhaseDetails.startPhase(sUrl, postPayload);
        },

        completePhaseOnSave: function (postPayload, modelData, oEvent) {
            const sProductionDataSourceUrl = this.oController.getProductionDataSourceUri();
           
            let sUrl = '';
            if (oEvent.getSource().getText() === this.oController.getI18nText("update.btn")) {
                postPayload.updatedCompleteDateTime = this.oController.PhaseDetails.tempEndDate = modelData.tempEndDate;
                sUrl = sProductionDataSourceUrl + "operationActivity/updateCompleteTime";
            } else {
                postPayload.actualStopDateTimeUtc = this.oController.PhaseDetails.tempEndDate = modelData.tempEndDate;

                // convert date time from Plant to UTC before persisting
                postPayload.actualStopDateTimeUtc = DateTimeUtils.dmcDateToUTCFormat(postPayload.actualStopDateTimeUtc, PlantSettings.getTimeZone());
                sUrl = sProductionDataSourceUrl + "completeOperationActivity";
            }
            this.oController.PhaseDetails.completePhase(sUrl, postPayload);
        },

        onSaveBtnPress: function (oEvent) {
            let isStartDateSaveBtnSource = (oEvent.getSource().getId().indexOf("startDateSave") !== -1);
            let modelData = oEvent.getSource().getModel("phaseDetails").getData();
            let inFuture;
            let dateInputField = oEvent.getSource().getParent().getFields()[0];

            if (isStartDateSaveBtnSource) {
                inFuture = this.PhaseDetails.validateChangeDateTime(modelData.tempStartDate);
            } else {
                inFuture = this.PhaseDetails.validateChangeDateTime(modelData.tempEndDate);
            }

            if (inFuture) {
                let date;

                if (isStartDateSaveBtnSource) {
                    date = "startDate";
                } else {
                    date = "endDate";
                }
                ErrorHandler.setErrorState(dateInputField, this.getI18nText("process." + date +".msg"));
                dateInputField.setValueStateText(this.getI18nText("process." + date +".msg"));
                return;
            }

            var postPayload = {
            sfc: this.selectedOrderData.sfc,
            operationActivity: modelData.phaseId,
            workCenter: modelData.workCenter.workcenter
            };
            if (isStartDateSaveBtnSource) {
                this.PhaseDetails.startPhaseOnSave(postPayload, modelData, oEvent);
            } else {
                this.PhaseDetails.completePhaseOnSave(postPayload, modelData, oEvent);
            }
        },

        validateChangeDateTime: function (sDate) {
            return sDate > this.oController.getCurrentDateTimeInPlantTimeZone();
        },

        startPhase: function (sUrl, postPayload) {
            this.oController.phaseDetailsSubSection.setBusy(true);
            AjaxUtil.post(
                sUrl, postPayload,
                function (oResponse) {
                    this.oController.setDataToPhaseSection(true);
                    MessageToast.show(this.oController.getI18nText("PhaseDetailsStartPhaseSuccess.msg"));
                    this.oController.phaseDetailsSubSection.setBusy(false);
                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                    this.oController.phaseDetailsSubSection.setBusy(false);
                }.bind(this)
            );
        },

        completePhase: function (sUrl, postPayload) {
            this.oController.phaseDetailsSubSection.setBusy(true);
            postPayload.finalConfirmation = this.oController.oPluginConfiguration.allowFinalConfirmation;
            AjaxUtil.post(
                sUrl, postPayload,
                function (oResponse) {
                    this.oController.quantityConfirmationSubSection.getModel("quantityModel").setProperty("/phaseCompleted", true);
                    this.oController.setDataToPhaseSection(true);
                    MessageToast.show(this.oController.getI18nText("PhaseDetailsEndPhaseSuccess.msg"));
                    this.oController.phaseDetailsSubSection.setBusy(false);
                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                    this.oController.phaseDetailsSubSection.setBusy(false);
                }.bind(this)
            );
        },

        handleChangeStartDateTime: function (oEvent) {
            this.PhaseDetails.handleChangeDateTime(oEvent, "startDate");
        },

        handleChangeEndDateTime: function (oEvent) {
            this.PhaseDetails.handleChangeDateTime(oEvent, "endDate");
        },

        handleChangeDateTime: function (oEvent, date) {
            var inputDate = oEvent.getSource().getValue();
            var oModel = oEvent.getSource().getModel("phaseDetails");
            var saveBtn = oEvent.getSource().getParent().getFields()[1];	    
		    ErrorHandler.clearErrorState(oEvent.getSource());
            saveBtn.setEnabled(false);
            // check if passed date is in future
		    if(inputDate > this.oController.getCurrentDateTimeInPlantTimeZone()){
                ErrorHandler.setErrorState(oEvent.getSource(), this.oController.getI18nText("process." + date +".msg"));
                oEvent.getSource().setValueStateText(this.oController.getI18nText("process." + date +".msg"));

            // cheek if end date is smaller than actual start date
            } else if(date === "endDate" && inputDate < oModel.getProperty("/actualStartDate") ) {
                ErrorHandler.setErrorState(oEvent.getSource(), this.oController.getI18nText("process.endDateNotValid.msg"));
                oEvent.getSource().setValueStateText(this.oController.getI18nText("process.endDateNotValid.msg"));
            } else{
                if (date === "startDate") {
                    oModel.setProperty("/tempStartDate", oEvent.getSource().getValue());
                } else {
                    oModel.setProperty("/tempEndDate", oEvent.getSource().getValue());
                }
                saveBtn.setEnabled(true); 
		    }
        },

        formatPhaseId: function(phaseId){	
        	if(phaseId){
            	var formattedPhaseId = phaseId.slice(phaseId.length - 4, phaseId.length);	
            	return formattedPhaseId;
        	}
        	return null;
        },

        onNavigateDP: function (oEvent) {
            var currentDateTimeInPlantTimeZone = this.getCurrentDateTimeInPlantTimeZone();
            if(sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g,"T")
            }
            oEvent.getSource().setInitialFocusedDateValue(new Date(currentDateTimeInPlantTimeZone));
        }
    }
});
