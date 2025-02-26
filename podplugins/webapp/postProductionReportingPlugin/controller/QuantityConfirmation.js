sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/MessageType",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/dm/dme/util/PlantSettings"
], function (JSONModel, MessageBox, MessageToast, MessageType, AjaxUtil, ErrorHandler, PlantSettings) {
    "use strict";

    return {
        setController: function (sController) {
            this.oController = sController;
        },


        getQuantityConfirmationData: function (updateFlag) {
            var oSubSection = this.oController.quantityConfirmationSubSection;
            var saveBtn = oSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var orderData = this.oController.selectedOrderData;
            this.workcenter = oSubSection.workcenter;
            if(!updateFlag) {
                this.failedRows = [];
            }

            // Set the initial focused date to current plant time
            var currentDateTimeInPlantTimeZone = this.oController.getCurrentDateTimeInPlantTimeZone();
            if(sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g,"T")
            }

            oSubSection.setBusy(true);
            AjaxUtil.get(
                this.oController.getProductionDataSourceUri() +
                "quantityConfirmation/summary?shopOrder=" + orderData.order +
                "&batchId=" + orderData.sfc +
                "&phase=" + oSubSection.phaseId +
                "&stepId=" + oSubSection.stepId,
                null,
                function (oResponse) {
                    var phaseCompletedFlag = this.oController.phaseDetailsSubSection.getModel("phaseDetails").getProperty("/done");
                    oResponse.erpAutoGr = this.oController.quantityConfirmationSubSection.erpAutoGr;
                    oResponse["quantSummary"] = [oResponse.totalYieldQuantity, oResponse.totalScrapQuantity];
                    oResponse.quantSummary[0]["quantityText"] = this.oController.getI18nText("process.yield.col");
                    oResponse.quantSummary[1]["quantityText"] = this.oController.getI18nText("process.scrap.col");

                    oResponse.quantSummary[0]["finalConfirmation"] = false;
                    oResponse.quantSummary[1]["finalConfirmation"] = false;

                    oResponse.quantSummary[0]["removeEnabled"] = false;
                    oResponse.quantSummary[1]["removeEnabled"] = false;

                    oResponse.quantSummary[0]["checkBtn"] = true;
                    oResponse.quantSummary[1]["checkBtn"] = false;

                    oResponse.quantSummary[0]["batchIn"] = (oResponse.batchManaged === "ORDER") ? true : false;
                    oResponse.quantSummary[1]["batchIn"] = false;

                    oResponse.quantSummary[0]["storLocIn"] = true;
                    oResponse.quantSummary[1]["storLocIn"] = false;

                    oResponse.quantSummary[0]["quantity"] = oResponse.totalYieldQuantity.value;
                    oResponse.quantSummary[1]["quantity"] = oResponse.totalScrapQuantity.value;

                    oResponse.quantSummary[0]["value"] = oResponse.quantSummary[1]["value"] = "";

                    oResponse.quantSummary[0]["postingDateTime"] = this.oController.oReportInfoModel.getProperty("/selectedTime");
                    oResponse.quantSummary[1]["postingDateTime"] = this.oController.oReportInfoModel.getProperty("/selectedTime");

                    oResponse.quantSummary[0]["customFieldJson"] = [];
                    oResponse.quantSummary[1]["customFieldJson"] = [];

                    oResponse.quantSummary[0]["customFieldValue"] = "";
                    oResponse.quantSummary[1]["customFieldValue"] = "";

                    oResponse.quantSummary[0]["focusedDateTime"] = new Date(currentDateTimeInPlantTimeZone);
                    oResponse.quantSummary[1]["focusedDateTime"] = new Date(currentDateTimeInPlantTimeZone);

                    oResponse.quantSummary[0]["postedBy"] = this.oController.oReportInfoModel.getProperty("/selectedUser");
                    oResponse.quantSummary[1]["postedBy"] = this.oController.oReportInfoModel.getProperty("/selectedUser");

                    oResponse.quantSummary[0]["selectedUoM"] = this.oController.selectedOrderData.baseCommercialUom;
                    oResponse.quantSummary[1]["selectedUoM"] = this.oController.selectedOrderData.baseCommercialUom;

                    this.fetchRelatedUoMsAndProceed(oResponse);

                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, true, true);
                    oSubSection.setBusy(false);
                }.bind(this)
            );
        },

        onViewPostsBtnPress: function (oEvent) {
            var quantityType = oEvent.getSource().getBindingContext("quantityModel").getObject().quantityText;
            var oParams = {};
            oParams.shopOrder = this.selectedOrderData.order;
            oParams.batchId = this.selectedOrderData.sfc;
            oParams.phase = this.quantityConfirmationSubSection.phaseId;

            this.QuantityConfirmationPostingDialog.setController(this);
            this.QuantityConfirmationPostingDialog.showQuantityConfirmationPostings(oParams, quantityType);
        },

        addFailedRows: function() {
            // Do not proceed if there are no failed API response
            if(!this.failedRows || this.failedRows.length == 0) {
                return;
            }

            var initialArrLength = this.oResponse.quantSummary.length;
            var replaceFlag = true;

            for(var k = 0; k < this.failedRows.length; k++) {
                // check if the previous element in the failedRow has the same activty ID,
                // If yes, then do not replace the parent response element, just add to it
                // If No, then replace the row with the error obj
                if(k !== 0 && (this.failedRows[k].quantityText === this.failedRows[k - 1].quantityText)) {
                    replaceFlag = false;
                } else {
                    replaceFlag = true;
                }

                // Loop through the Activity list and check if an element is found with the same ActId as the failedRow element
                // If yes, Then add or replace the row in Act List with the failed row element
                var selectedIndex = 0;
                for(var i = 0; i < initialArrLength; i++) {
                    if(this.failedRows[k].quantityText === this.oResponse.quantSummary[i].quantityText) {
                        selectedIndex = i;
                    }
                }

                this.oResponse.quantSummary = this.addRowToQuantityTable(this.oResponse, this.failedRows[k], selectedIndex, replaceFlag);
                if(!replaceFlag) {
                    initialArrLength++;
                }

            }

            const sPlantTimeZoneId = this.oController.plantTimeZoneId;

            for (let oQuantSummary of this.oResponse.quantSummary) {
                let dt = this.oController.DateTimeUtils.dmcDateToUTCFormat(oQuantSummary.postingDateTime, 'UTC');
                oQuantSummary.postingDateTime = moment(dt).tz(sPlantTimeZoneId).format('YYYY-MM-DD HH:mm:ss');
            }
        },

        addRowToQuantityTable: function (quantData, selectedItem, selectedIndex, replaceFlag) {
            var quantSummaryArr = quantData.quantSummary;
            var errorObj = {
                quantityText: selectedItem.quantityText,
                quantity: quantSummaryArr[selectedIndex].quantity,
                unitOfMeasure: quantSummaryArr[selectedIndex].unitOfMeasure,
                postingDateTime: selectedItem.dateTime,
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.userId,
                finalConfirmation: selectedItem.finalConfirmation,
                rowStatus: "Error"
            };
            if (selectedItem.quantityText == this.oController.getI18nText("process.yield.col")) {
                errorObj.value = selectedItem.yieldQuantity.value;
                errorObj.selectedUoM = selectedItem.yieldQuantity.unitOfMeasure.uom;
                errorObj.batchNumber =  selectedItem.batchNumber;
                errorObj.storageLocation =  selectedItem.storageLocation;
                errorObj.batchIn = (quantData.batchManaged === "ORDER") ? true : false;
                errorObj.storLocIn = true;
            } else {
                errorObj.value = selectedItem.scrapQuantity.value;
                errorObj.selectedUoM = selectedItem.scrapQuantity.unitOfMeasure.uom;
                errorObj.batchIn = false;
                errorObj.storLocIn = false;
            }

            if(replaceFlag === true) {
                errorObj.actionBtnVisible = true;
                errorObj.removeEnabled = false;
                quantSummaryArr[selectedIndex] = errorObj;
            } else {
                errorObj.actionBtnVisible = false;
                errorObj.removeEnabled = true;
                quantSummaryArr.splice(selectedIndex + 1, 0, errorObj);
            }

            return quantSummaryArr;
        },


        onPressAdd: function (oEvent) {
            var quantData = oEvent.getSource().getModel("quantityModel").getData();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("quantityModel").getPath().substr(14));
            var selectedItem = quantData.quantSummary[selectedIndex];
            if (this.QuantityConfirmation.getNumberOfRowsForQuantity(quantData, selectedItem.quantityText) >= 4) {
                return;
            }
            var quantArray = oEvent.getSource().getModel("quantityModel").getData().quantSummary;
            var emptyObj = {
                value: "",
                quantityText: selectedItem.quantityText,
                selectedUoM: selectedItem.selectedUoM,
                unitOfMeasure: selectedItem.unitOfMeasure,
                actionBtnVisible: false,
                postingDateTime: selectedItem.postingDateTime,
                customFieldJson: [],
                customFieldValue: "",
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.postedBy,
                removeEnabled: true
            };
            if (selectedItem.quantityText == this.getI18nText("process.yield.col")) {
                emptyObj.checkBtn = true;
                emptyObj.batchIn = (quantData.batchManaged === "ORDER") ? true : false;
                emptyObj.storLocIn = true;
            } else {
                emptyObj.checkBtn = false;
                emptyObj.batchIn = false;
                emptyObj.storLocIn = false;
            }

            quantArray.splice(selectedIndex + 1, 0, emptyObj);
            oEvent.getSource().getModel("quantityModel").getData().quantSummary = quantArray;
            oEvent.getSource().getModel("quantityModel").refresh();
        },

        getNumberOfRowsForQuantity: function (quantData, quantityText) {
            var tempArr = [];
            tempArr = quantData.quantSummary.filter(function (obj) {
                return obj.quantityText === quantityText;
            })
            return tempArr.length;
        },

        onPressRemove: function (oEvent) {
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("quantityModel").getPath().substr(14));
            var quantArray = oEvent.getSource().getModel("quantityModel").getData().quantSummary;
            quantArray.splice(selectedIndex, 1);
            oEvent.getSource().getModel("quantityModel").getData().quantSummary = quantArray;
            oEvent.getSource().getModel("quantityModel").refresh();
            this.QuantityConfirmation.enableConfirmButton();
        },

        onValueChange: function (oEvent) {
            var inputField = oEvent.getSource();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("quantityModel").getPath().substr(14));
            // Validate the selected date with Complete phase date
            var DateTimeCtrlForCurrentRow = this.quantityConfirmationSubSection.getBlocks()[0].getItems()[selectedIndex].getCells()[7];
            var DateTimeValueForCurrentRow = oEvent.getSource().getBindingContext("quantityModel").getObject().postingDateTime;
            this.QuantityConfirmation.validateDateTime(DateTimeCtrlForCurrentRow, DateTimeValueForCurrentRow);

            // Adding explicit delay because of parallel validation of qty fields
            setTimeout(function() {
                this.QuantityConfirmation.highlightRow(inputField);
                this.QuantityConfirmation.enableConfirmButton();
            }.bind(this), 500);
        },

        handleChangeDateTime: function (oEvent) {
            this.QuantityConfirmation.validateDateTime(oEvent.getSource(), oEvent.getSource().getValue());
        },

        validateDateTime: function (dateTimeCtrl, dateTimeValue) {
            var that = this.oController || this;
            var inputPostingDate = new Date(dateTimeValue);
            var phaseStartDate = that.phaseDetailsSubSection.getModel("phaseDetails").getProperty("/actualStartDate");
            var phaseStartDateObj = (phaseStartDate) ? new Date(phaseStartDate) : null;
            var phaseCompleteDate = that.phaseDetailsSubSection.getModel("phaseDetails").getProperty("/actualEndDate");
            var phaseCompleteDateObj = (phaseCompleteDate) ? new Date(phaseCompleteDate) : null;

            var oModel = dateTimeCtrl.getModel("quantityModel");
            var selectedPath = dateTimeCtrl.getBindingContext("quantityModel").getPath();
            var saveBtn = that.quantityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            ErrorHandler.clearErrorState(dateTimeCtrl);
            saveBtn.setEnabled(false);
            if(isNaN(inputPostingDate.getTime())) {
                ErrorHandler.setErrorState(dateTimeCtrl, that.getI18nText("process.postingDateInvalid.msg"));
                dateTimeCtrl.setValueStateText(that.getI18nText("process.postingDateInvalid.msg"));
            }
            else if (inputPostingDate > new Date(that.getCurrentDateTimeInPlantTimeZone())) {
                ErrorHandler.setErrorState(dateTimeCtrl, that.getI18nText("process.postingDate.msg"));
                dateTimeCtrl.setValueStateText(that.getI18nText("process.postingDate.msg"));
            }
            else if (phaseStartDateObj && (inputPostingDate < phaseStartDateObj)) {
                ErrorHandler.setErrorState(dateTimeCtrl, that.getI18nText("process.postingDateBefore.msg"));
                dateTimeCtrl.setValueStateText(that.getI18nText("process.postingDateBefore.msg"));
            }
            else if (phaseCompleteDateObj && (inputPostingDate > phaseCompleteDateObj)) {
                ErrorHandler.setErrorState(dateTimeCtrl, that.getI18nText("process.postingDateAfter.msg"));
                dateTimeCtrl.setValueStateText(that.getI18nText("process.postingDateAfter.msg"));
            }
            else {
                ErrorHandler.clearErrorState(dateTimeCtrl);
                oModel.setProperty(selectedPath + "/postingDateTime", dateTimeValue);
            }

            this.highlightRow(dateTimeCtrl);
            this.enableConfirmButton();
        },

        handleSelectChange: function (oEvent) {
            var oModel = oEvent.getSource().getModel("quantityModel");
            var selectedPath = oEvent.getSource().getBindingContext("quantityModel").getPath();
            var selectedUoM = oEvent.getSource().getList().getSelectedItem().getBindingContext("quantityModel").getObject().uom;
            oModel.setProperty(selectedPath + "/selectedUoM", selectedUoM);
            this.QuantityConfirmation.highlightRow(oEvent.getSource());
            this.QuantityConfirmation.enableConfirmButton();
        },

        _validatePositiveNumber: function (sInputValue) {
            //Regex for Valid Numbers(10 digits before decimal and 3 digits after decimal)
            var regex = /^\s*(?=.*[1-9])\d{0,10}(?:\.\d{1,3})?\s*$/;
            var isValidInput = true;

            if (sInputValue) {
                if (!sInputValue.match(regex)) {
                    isValidInput = false;
                }
            }

            return isValidInput;
        },

        highlightRow: function (oSource) {
            var isErrorStateExist = false;
            var quantityData = oSource.getModel("quantityModel").getData();
            var selectedIndex = parseInt(oSource.getBindingContext("quantityModel").getPath().substr(14));
            var selectedItem = quantityData.quantSummary[selectedIndex];
            var cells = oSource.getParent().getCells();
            for (var i = 0; i < cells.length; i++) {
                if (cells[i].getValueState && cells[i].getValueState() === "Error") {
                    oSource.getParent().setHighlight("Error");
                    isErrorStateExist = true;
                    break;
                }
            }
            if (!isErrorStateExist) {
                if (selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value && selectedItem.selectedUoM && this.checkAutoGRFields(selectedItem, quantityData))
                    oSource.getParent().setHighlight("Success");
                else
                    oSource.getParent().setHighlight("None");
            }
        },

        checkAutoGRFields: function(selectedItem, quantityData) {
            if(this.oController.quantityConfirmationSubSection.erpAutoGr && selectedItem.quantityText === this.oController.getI18nText("process.yield.col")) {
                if(quantityData.batchManaged === "ORDER"){
                    if(selectedItem.batchNumber && selectedItem.storageLocation) {
                        return true;
                    }
                }else if(selectedItem.storageLocation){
                   return true;
                }
                return false;
            } else {
                return true;
            }
        },

        enableConfirmButton: function () {
            var partialDataEnteredRow = 0;
            var errorRowExist = false;
            var saveBtn = this.oController.quantityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            var oTableContent = this.oController.quantityConfirmationSubSection.getBlocks()[0].getItems();
            for (var i = 0; i < oTableContent.length; i++) {
                if (oTableContent[i].getHighlight() === "Error") {
                    errorRowExist = true;
                    break;
                } else if (oTableContent[i].getHighlight() === "None") {
                    partialDataEnteredRow++;
                }
            }
            if (partialDataEnteredRow === oTableContent.length || errorRowExist) {
                saveBtn.setEnabled(false);
            } else {
                saveBtn.setEnabled(true);
            }
        },

        showBatchDialog: function (oEvent) {
            var oModel = oEvent.getSource().getModel("quantityModel");
            var selectedPath = oEvent.getSource().getBindingContext("quantityModel").getPath();
            var oControl = oEvent.getSource();
            this.BatchControl.setController(this);
            this.postData = oModel.getData();
            var material = this.selectedOrderData.materialName;
            var plant = PlantSettings.getCurrentPlant();
            this.BatchControl._batchBrowseOpen(material, plant, "", function (selectedBatch) {
                oModel.setProperty(selectedPath + "/batchNumber", selectedBatch.name);
                if (selectedBatch.storageLocation) {
                    oModel.setProperty(selectedPath + "/storageLocation", selectedBatch.storageLocation);
                }
                this.QuantityConfirmation.highlightRow(oControl);
                this.QuantityConfirmation.enableConfirmButton();
            }.bind(this));
        },

        showStorageLocDialog: function (oEvent) {
            var oModel = oEvent.getSource().getModel("quantityModel");
            var selectedPath = oEvent.getSource().getBindingContext("quantityModel").getPath();
            var oControl = oEvent.getSource();
            this.StorageLocationBrowse.open(this.getView(), "", function (oSelectedObject) {
                if (oSelectedObject) {
                    oModel.setProperty(selectedPath + "/storageLocation", oSelectedObject.name);
                }
                this.QuantityConfirmation.highlightRow(oControl);
                this.QuantityConfirmation.enableConfirmButton();
            }.bind(this), this.getView().getModel("inventory"));
        },

        fetchRelatedUoMsAndProceed: function (oResponse) {
            this.oResponse = oResponse;
            var surl = this.oController.getProductRestDataSourceUri() + "materials/uoms";
            var oParameters = {};
            oParameters.material = oResponse.material;
            oParameters.version = oResponse.version;

            AjaxUtil.get(surl, oParameters, function (unitData) {
                this.oResponse.unitList = unitData;
                this.oResponse.phaseCompleted = this.oController.phaseDetailsSubSection.getModel("phaseDetails").getProperty("/done");
                this.addFailedRows();
                var oModel = new JSONModel(this.oResponse);
                this.oController.quantityConfirmationSubSection.setModel(oModel, "quantityModel");
                this.oController.quantityConfirmationSubSection.rerender();
                this.oController.quantityConfirmationSubSection.setBusy(false);
            }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, true, true);
                    this.oController.quantityConfirmationSubSection.setBusy(false);
                }.bind(this));

        },

        onSaveBtnPress: function (oEvent) {
            var quantData = oEvent.getSource().getParent().getParent().getModel("quantityModel").getData();
            var oTableControl = oEvent.getSource().getParent().getParent();
            var postPayload = [];
            var isError=false;
            quantData.quantSummary.forEach(function (quantSummary,rowId) {
                if(oTableControl.getItems()[rowId].getCells()[5].getValueState() === "Error"){
                    isError=true;
                    this.QuantityConfirmation.highlightRow(oTableControl.getItems()[rowId].getCells()[5]);
                    this.QuantityConfirmation.enableConfirmButton();
                    return;
                }
                if(oTableControl.getItems()[rowId].getCells()[5].getValue() === ""){
                    this.QuantityConfirmation.highlightRow(oTableControl.getItems()[rowId].getCells()[5]);
                    this.QuantityConfirmation.enableConfirmButton();
                    return;
                }
                // Do not add the model obj to payload if value is empty
                if(quantSummary.value === "") {
                    return;
                }

                var oDate = moment.tz(quantSummary.postingDateTime, PlantSettings.getTimeZone());
                var postingDateInUTC = oDate.utc().format("yyyy-MM-DD HH:mm:ss");

                var obj = {
                    "itemId": rowId,
                    "shopOrder": quantData.shopOrder,
                    "batchId": quantData.batchId,
                    "batchNumber": quantSummary.batchNumber,
                    "storageLocation": quantSummary.storageLocation,
                    "phase": quantData.phase,
                    "workCenter": this.selectedSectionData.workCenter.workcenter,
                    "userId": quantSummary.postedBy,
                    "dateTime": postingDateInUTC,
                    "customFieldData" : (quantSummary.customFieldJson && quantSummary.customFieldJson.length) ? JSON.stringify(quantSummary.customFieldJson) : null,
                    "finalConfirmation": quantSummary.finalConfirmation
                }

                if(quantSummary.quantityText === this.getI18nText("process.yield.col")) {
                    obj.yieldQuantity = {
                        "value": quantSummary.value,
                        "unitOfMeasure": {
                            "uom": quantSummary.selectedUoM,
                            "shortText": "",
                            "longText": ""
                        }
                    }
                } else {
                    obj.scrapQuantity = {
                        "value": quantSummary.value,
                        "unitOfMeasure": {
                            "uom": quantSummary.selectedUoM,
                            "shortText": "",
                            "longText": ""
                        }
                    }
                }
                postPayload.push(obj);
            }.bind(this));
            if (postPayload.length > 0 && isError === false){
                oEvent.getSource().setEnabled(false);
                this.quantityConfirmationSubSection.setBusy(true);
                AjaxUtil.post(
                    this.getProductionDataSourceUri() + "quantityConfirmation/batchConfirm", postPayload,
                    function (oResponse) {
                        var errorFlag = false;
                        this.QuantityConfirmation.handleErrors(oResponse, postPayload) ? MessageBox.error(this.getI18nText("quantityConfirmationPostingError.msg"))
                                    : this.showSuccessMessage(this.getI18nText("quantityConfirmationPostingSuccess.msg"), true, false);
                        this.QuantityConfirmation.getQuantityConfirmationData(true);
                        this.setDataToPhaseSection(true);
                        // DIGMANEXE-52981 #Refresh GR quantity for AutoGR
                        if(this.quantityConfirmationSubSection.erpAutoGr){
                            this.getGRQuantity();
                            this.publish("refreshOrderQtyForAutoGR",this);
                        }
                    }.bind(this),
                    function (oError, oHttpErrorMessage) {
                        var err = oError ? oError : oHttpErrorMessage;
                        this.showErrorMessage(err, false, true);
                        this.quantityConfirmationSubSection.setBusy(false);
                    }.bind(this)
                );
            }
        },

        handleErrors: function (oResponse, postPayload) {
            this.failedRows = [];
            var errorFlag = false;
            oResponse.forEach(function (response) {
                if(response.type === "E") {
                    var itemId = response.itemId;
                    var confirmationType = (postPayload[itemId].yieldQuantity) ? this.oController.getI18nText("process.yield.col") : this.oController.getI18nText("process.scrap.col");
                    errorFlag = true;
                    this.oController.addMessage(
                        MessageType.Error,
                        this.oController.getI18nText(
                            "quantityConfirmationPostingErrorTitle.msg",
                            [
                                confirmationType,
                                (confirmationType === this.oController.getI18nText("process.yield.col")) ? postPayload[itemId].yieldQuantity.value : postPayload[itemId].scrapQuantity.value,
                                this.oController.DateTimeUtils.formatDateTime(postPayload[itemId].dateTime)
                            ]
                        ),
                        response.message,
                        response.message
                    )
                    postPayload[response.itemId].quantityText = confirmationType;
                    this.failedRows.push(postPayload[response.itemId]);
                }
            }.bind(this));
            return errorFlag;
        },

        onClearBtnPress: function () {
            MessageBox.warning(this.getI18nText("quantityConfirmationClearFields.confirm"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        this.QuantityConfirmation.clearFields(this);
                    }
                }.bind(this)
            });
        },

        clearFields: function (that) {
            // Disable the save Btn
            that.quantityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2].setEnabled(false);
            var quantityModel = that.quantityConfirmationSubSection.getBlocks()[0].getModel("quantityModel");
            var quantityData = quantityModel.getData();
            var initialPath = "/quantSummary/"
            for (var i = 0; i < quantityData.quantSummary.length; i++) {
                quantityModel.setProperty(initialPath + i + "/value", "");
                quantityModel.setProperty(initialPath + i + "/postedBy", this.oController.oReportInfoModel.getProperty("/selectedUser"));
                quantityModel.setProperty(initialPath + i +"/postingDateTime", this.oController.oReportInfoModel.getProperty("/selectedTime"));
                quantityModel.setProperty(initialPath + i +"/customFieldJson", []);
                quantityModel.setProperty(initialPath + i +"/customFieldValue", "");
                quantityModel.setProperty(initialPath + i +"/selectedUoM", this.oController.selectedOrderData.baseCommercialUom);
                quantityModel.setProperty(initialPath + i +"/batchNumber", "");
                quantityModel.setProperty(initialPath + i +"/storageLocation", "");
                quantityModel.setProperty(initialPath + i +"/finalConfirmation", false);
                quantityModel.setProperty(initialPath + i +"/rowStatus", "None");
            }
        },

        onCustomFieldLiveChange : function(oEvent){
            var customField =  oEvent.getSource();
            var oModel = customField.getModel("quantityModel");
            var selectedPath = customField.getBindingContext("quantityModel").getPath();
            var saveBtn = this.quantityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var customFieldData = customField.getValue();
            oModel.setProperty(selectedPath + "/customFieldValue", customFieldData);
            ErrorHandler.clearErrorState(customField);
            if (this.utils.validateInputRegEx(customFieldData)) {
                var customFieldJson = this.utils.buildCustomFieldData(customFieldData);
                oModel.setProperty(selectedPath + "/customFieldJson", customFieldJson);
                this.QuantityConfirmation.highlightRow(customField);
                this.QuantityConfirmation.enableConfirmButton();
            }else{
                ErrorHandler.setErrorState(customField, this.getI18nText("INVALID_INPUT"));
                this.QuantityConfirmation.highlightRow(customField);
            }
        },

        onCalculateBtnPress: function (oEvent) {
            const oController = this.GRPostController.oController;
            const aVisibleSections = oController.getVisibleSections();
            let oCalculateButtonEvent = oEvent;
            let oQuantityModel = oCalculateButtonEvent.getSource().getModel("quantityModel")
            if (aVisibleSections.includes("MaterialConsumption")) {
                MessageBox.information(this.getI18nText("goodsReceipt.proposal.confirm"), {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === "OK") {
                            oController.MaterialComponents.calculateConsumables(oCalculateButtonEvent, oQuantityModel);
                        }
                    }.bind(this)
                });
            } else {
                oController.showErrorMessage(this.getI18nText("gr.msg.materialConsumptionNotEnabled"), true, false);
            }
        },

        onFinalConfBtnPress: function (oEvent) {
            this.quantityConfirmationSubSection.setBusy(true);
            var url = this.getProductionDataSourceUri() + "quantityConfirmation/v1/reportOperationActivityFinalConfirmation";
            var postPayload = {
                "plant": this.loggedInUserDetails.plant,
                "shopOrder": this.selectedOrderData.order,
                "sfc": this.selectedOrderData.sfc,
                "operationActivity": this.selectedSectionData.phaseId
            };
            AjaxUtil.post(
                url, postPayload,
                function () {
                    this.showSuccessMessage(this.getI18nText("quantityConfirmationFinalConf.msg"), true, false);
                    this.quantityConfirmationSubSection.setBusy(false);
                    this.setDataToPhaseSection(true);
                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.showErrorMessage(err, false, true);
                    this.quantityConfirmationSubSection.setBusy(false);
                }.bind(this)
            );

        }
    }
});
