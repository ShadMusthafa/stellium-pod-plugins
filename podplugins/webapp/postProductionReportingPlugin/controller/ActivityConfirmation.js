sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/ui/core/MessageType"
], function (JSONModel, MessageBox, MessageToast, AjaxUtil, ErrorHandler, MessageType) {
    "use strict";

    return {

        setController: function (sController) {
            this.oController = sController;
        },
        getActivityConfirmationData: function (updateFlag) {
            var oSubSection = this.oController.activityConfirmationSubSection;
            var saveBtn = oSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var orderData = this.oController.selectedOrderData;
            this.workcenter = oSubSection.workcenter;
            if(!updateFlag) {
                this.failedRows = [];
            }

            oSubSection.setBusy(true);
            let url = this.oController.getActivityConfirmationRestDataSourceUri() +
                "activityconfirmation/postings/aggregates/phase";
            let oParameters = {'shopOrder': orderData.order, 'batchId': orderData.sfc, 'operationActivity': oSubSection.phaseId, 'workCenter': this.workcenter.workcenter, 'stepId' :  oSubSection.stepId};
            AjaxUtil.get(
                url,
                oParameters,
                function (oResponse) {
                    oResponse.activitySummary.sort(function (x, y) {
                        var a = x.sequence;
                        var b = y.sequence;
                        var c = x.activityId.toUpperCase();
                        var d = y.activityId.toUpperCase();
                        return a === b ? (c === d ? 0 : c > d ? 1 : -1) : a > b ? 1 : -1;
                    });
                    oResponse = this.addPostingProperties(oResponse);
                    this.actResponse = oResponse;
                    this.fetchRelatedUoMsAndProceed(oResponse);
                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, true, true);
                    oSubSection.setBusy(false);
                }.bind(this)
            );
        },

        addPostingProperties: function (oResponse) {
            // Set the initial focused date to current plant time
            var currentDateTimeInPlantTimeZone = this.oController.getCurrentDateTimeInPlantTimeZone();
            if(sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g,"T")
            }
            oResponse.activitySummary.forEach(function (summary) {
                    summary.value = "";
                    summary.selectedUoM = summary.targetQuantity.unitOfMeasure.internalUom;
                    summary.postingDateTime = this.oController.oReportInfoModel.getProperty("/selectedTime");
                    summary.customFieldJson = [];
                    summary.customFieldValue = "";
                    summary.postedBy = this.oController.oReportInfoModel.getProperty("/selectedUser");
                    summary.removeEnabled = false;
                    summary.focusedDateTime = new Date(currentDateTimeInPlantTimeZone);
            }.bind(this));
            return oResponse;
        },

        fetchRelatedUoMsAndProceed: function (oResponse) {
            if (!this.uomMap) {
                this.uomMap = {};
            }

            var uomList = [];
            this.uomCount = 0;
            this.responseCount = 0;

            oResponse.activitySummary.forEach(function (actSummary) {
                var uom = actSummary.targetQuantity.unitOfMeasure.internalUom;
                if (!this.uomMap.hasOwnProperty(uom) && uomList.indexOf(uom) === -1) {
                    this.uomCount++;
                    uomList.push(uom);
                    this.fetchAlternateUoMs(uom);
                }
            }.bind(this));

            this.checkResponseCount();
        },

        fetchAlternateUoMs: function (uom) {
            var productRestUrl = this.oController.getProductRestDataSourceUri();
            var sUrl = productRestUrl + "uoms/allRelatedUoms?uom=" + uom;
            var that = this;
            AjaxUtil.get(sUrl, null, function (oResponseData) {
                var uomList = oResponseData;
                for (var i = 0; i < uomList.length; i++) {
                    if (!that.uomMap.hasOwnProperty(uomList[i].uom)) {
                        that.uomMap[uomList[i].uom] = uomList;
                    }
                }
                that.responseCount++;
                that.checkResponseCount();
            }, function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.responseCount++;
                that.checkResponseCount();
            });
        },

        checkResponseCount: function () {
            if (this.responseCount !== this.uomCount) {
                return;
            }

            this.actResponse.activitySummary.forEach(function (actSummary) {
                var uom = actSummary.targetQuantity.unitOfMeasure.uom;
                actSummary.selectedUoM = actSummary.targetQuantity.unitOfMeasure.internalUom;
                if (this.uomMap.hasOwnProperty(uom)) {
                    actSummary.unitList = this.uomMap[uom];
                }
            }.bind(this));

            // Add entries to the table if any previous API call failed
            this.addFailedRows();
            var oModel = new JSONModel(this.actResponse);
            this.oController.activityConfirmationSubSection.setModel(oModel, "activityModel");
            this.oController.activityConfirmationSubSection.setBusy(false)
        },

        addFailedRows: function() {
            // Do not proceed if there are no failed API response
            if(!this.failedRows || this.failedRows.length == 0) {
                return;
            }

            var initialArrLength = this.actResponse.activitySummary.length;
            var replaceFlag = true;

            for(var k = 0; k < this.failedRows.length; k++) {
                // check if the previous element in the failedRow has the same activty ID,
                // If yes, then do not replace the parent response element, just add to it
                // If No, then replace the row with the error obj
                if(k !== 0 && (this.failedRows[k].activityId === this.failedRows[k - 1].activityId)) {
                    replaceFlag = false;
                } else {
                    replaceFlag = true;
                }

                // Loop through the Activity list and check if an element is found with the same ActId as the failedRow element
                // If yes, Then add or replace the row in Act List with the failed row element
                var selectedIndex = 0;
                for(var i = 0; i < initialArrLength; i++) {
                    if(this.failedRows[k].activityId === this.actResponse.activitySummary[i].activityId) {
                        selectedIndex = i;
                    }
                }

                this.actResponse.activitySummary = this.addRowToActivityTable(this.actResponse, this.failedRows[k], selectedIndex, replaceFlag);
                if(!replaceFlag) {
                    initialArrLength++;
                }

            }
        },

        addRowToActivityTable: function (actData, selectedItem, selectedIndex, replaceFlag) {
            var actSummaryArr = actData.activitySummary;
            var errorObj = {
                activityId: selectedItem.activityId,
                activityText: selectedItem.activityText,
                targetQuantity: actSummaryArr[selectedIndex].targetQuantity,
                actualQuantity: actSummaryArr[selectedIndex].actualQuantity,
                unitList: actSummaryArr[selectedIndex].unitList,
                selectedUoM: selectedItem.quantity.unitOfMeasure.internalUom,
                value: selectedItem.quantity.value,
                postingDateTime: selectedItem.postingDate,
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.postedBy,
                finalConfirmation: false,
                rowStatus: "Error"
            };

            if(replaceFlag === true) {
                errorObj.actionBtnVisible = true;
                errorObj.removeEnabled = false;
                actSummaryArr[selectedIndex] = errorObj;
            } else {
                errorObj.actionBtnVisible = false;
                errorObj.removeEnabled = true;
                actSummaryArr.splice(selectedIndex + 1, 0, errorObj);
            }

            return actSummaryArr;
        },

        onPressAdd: function (oEvent) {
            var actData = oEvent.getSource().getModel("activityModel").getData();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("activityModel").getPath().substr(17));
            var selectedItem = actData.activitySummary[selectedIndex];
            if (this.ActivityConfirmation.getNumberOfRowsForActivity(actData, selectedItem.activityId) >= 4) {
                return;
            }
            var actSummaryArr = oEvent.getSource().getModel("activityModel").getData().activitySummary;
            var emptyObj = {
                activityId: selectedItem.activityId,
                activityText: selectedItem.activityText,
                targetQuantity: selectedItem.targetQuantity,
                actualQuantity: selectedItem.actualQuantity,
                unitList: selectedItem.unitList,
                selectedUoM: selectedItem.selectedUoM,
                value: "",
                postingDateTime: selectedItem.postingDateTime,
                customFieldJson: [],
                customFieldValue: "",
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.postedBy,
                actionBtnVisible: false,
                removeEnabled: true,
                finalConfirmation: false
            };
            actSummaryArr.splice(selectedIndex + 1, 0, emptyObj);
            oEvent.getSource().getModel("activityModel").getData().activitySummary = actSummaryArr;
            oEvent.getSource().getModel("activityModel").refresh();
        },

        getNumberOfRowsForActivity: function (actData, activityId) {
            var tempArr = [];
            tempArr = actData.activitySummary.filter(function (obj) {
                return obj.activityId === activityId;
            })
            return tempArr.length;
        },

        onPressRemove: function (oEvent) {
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("activityModel").getPath().substr(17));
            var actSummaryArr = oEvent.getSource().getModel("activityModel").getData().activitySummary;
            actSummaryArr.splice(selectedIndex, 1);
            oEvent.getSource().getModel("activityModel").getData().activitySummary = actSummaryArr;
            oEvent.getSource().getModel("activityModel").refresh();
            this.ActivityConfirmation._enableConfirmButton();
        },

        handleChangeDateTime: function (oEvent) {
            var inputPostingDate = new Date(oEvent.getSource().getValue());
            var oModel = oEvent.getSource().getModel("activityModel");
            var selectedPath = oEvent.getSource().getBindingContext("activityModel").getPath();
            var saveBtn = this.activityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
		    ErrorHandler.clearErrorState(oEvent.getSource());
            saveBtn.setEnabled(false);
            if(isNaN(inputPostingDate.getTime())) {
                ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText("process.postingDateInvalid.msg"));
                oEvent.getSource().setValueStateText(this.getI18nText("process.postingDateInvalid.msg"));
            }
		    else if(inputPostingDate > new Date(this.getCurrentDateTimeInPlantTimeZone())){
                ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText("process.postingDate.msg"));
                oEvent.getSource().setValueStateText(this.getI18nText("process.postingDate.msg"));

		    }else{
                ErrorHandler.clearErrorState(oEvent.getSource());
                oModel.setProperty(selectedPath + "/postingDateTime", oEvent.getSource().getValue());
            }
            this.ActivityConfirmation.highlightRow(oEvent.getSource());
            this.ActivityConfirmation._enableConfirmButton();
        },

        handleSelectChange: function (oEvent) {
            var oSelectCtrl = oEvent.getSource();
            var oModel = oSelectCtrl.getModel("activityModel");
            var selectedPath = oSelectCtrl.getBindingContext("activityModel").getPath();
            var selectedUoM = oSelectCtrl.getList().getSelectedItem().getBindingContext("activityModel").getObject().internalUom;
            oModel.setProperty(selectedPath + "/selectedUoM", selectedUoM);
            this.ActivityConfirmation.highlightRow(oSelectCtrl);
		    this.ActivityConfirmation._enableConfirmButton();
        },

        onViewPostsBtnPress: function (oEvent) {
            var oParams = {};
            oParams.shopOrder = this.selectedOrderData.order;
            oParams.batchId = this.selectedOrderData.sfc;
            oParams.operationActivity = this.activityConfirmationSubSection.phaseId;
            oParams.stepId = this.activityConfirmationSubSection.stepId;
            oParams.workCenter = this.activityConfirmationSubSection.workcenter.workcenter;
            oParams.activityId = oEvent.getSource().getBindingContext("activityModel").getObject().activityId;
            var activityText = oEvent.getSource().getBindingContext("activityModel").getObject().activityText;

            this.ActivityPostingsDialog.setController(this);
            this.ActivityPostingsDialog.showActivityPostingsDialog(oParams, activityText);
        },


        onSaveBtnPress: function (oEvent) {
            var actData = oEvent.getSource().getParent().getParent().getModel("activityModel").getData();
            var isError = false;
            var oTableControl = oEvent.getSource().getParent().getParent();
            var postPayload = {
                "activityList": []
            };
            actData.activitySummary.forEach(function (actSummary, rowId) {
                if(oTableControl.getItems()[rowId].getCells()[4].getValueState() === "Error"){
                    isError = true;
                    this.ActivityConfirmation.highlightRow(oTableControl.getItems()[rowId].getCells()[3]);
                    this.ActivityConfirmation._enableConfirmButton();
                    return;
                }
                if(oTableControl.getItems()[rowId].getCells()[4].getValue() === ""){
                    this.ActivityConfirmation.highlightRow(oTableControl.getItems()[rowId].getCells()[3]);
                    this.ActivityConfirmation._enableConfirmButton();
                    return;
                }
                // Do not add the model obj to payload if value is empty
                if(actSummary.value === "") {
                    return;
                }
                var obj = {
                    "itemId": rowId,
                    "shopOrder": actData.shopOrder,
                    "batchId": actData.batchId,
                    "operationActivity": actData.operationActivity,
                    "stepId": actData.stepId,
                    "workCenter": actData.workCenter,
                    "activityId": actSummary.activityId,
                    "activityText": actSummary.activityText,
                    "postedBy": actSummary.postedBy,
                    "postingDate": this.formatter.formatPlantDateTimeToUTCTimeZone(actSummary.postingDateTime),
                    "quantity": {
                        "value": actSummary.value,
                        "unitOfMeasure": {
                            "uom": "",
                            "internalUom": actSummary.selectedUoM,
                            "shortText": "",
                            "longText": ""
                        }
                    },
                    "customFieldData": (actSummary.customFieldJson && actSummary.customFieldJson.length > 0) ? JSON.stringify(actSummary.customFieldJson) : null,
                    "finalConfirmation": actSummary.finalConfirmation
                }
                postPayload.activityList.push(obj);
            }.bind(this));
            if(postPayload.activityList.length > 0 && isError === false){
                oEvent.getSource().setEnabled(false);
                this.activityConfirmationSubSection.setBusy(true);
                AjaxUtil.post(
                    this.getActivityConfirmationRestDataSourceUri() + "activityconfirmation/batchconfirm", postPayload,
                    function (oResponse) {
                        this.ActivityConfirmation.handleErrors(oResponse, postPayload) ? MessageBox.error(this.getI18nText("activityConfirmationPostingError.msg"))
                                    : MessageToast.show(this.getI18nText("activityConfirmationPostingSuccess.msg"));
                        this.ActivityConfirmation.getActivityConfirmationData(true);
                        this.setDataToPhaseSection(true);
                    }.bind(this),
                    function (oError, oHttpErrorMessage) {
                        var err = oError ? oError : oHttpErrorMessage;
                        this.showErrorMessage(err, false, true);
                        this.activityConfirmationSubSection.setBusy(false);
                    }.bind(this)
                );
            }
        },

        handleErrors: function (oResponse, postPayload) {
            var errorFlag = false;
            this.failedRows = [];
            oResponse.forEach(function (response) {
                if(response.statusCode !== "200") {
                    errorFlag = true;
                    this.oController.addMessage(MessageType.Error,
                        this.oController.getI18nText("activityConfirmationPostingErrorTitle.msg", [response.activityId, response.quantity.value, this.oController.DateTimeUtils.formatDateTime(response.postingDate)]),
                        response.errorMessage.error.message, "");
                    this.failedRows.push(postPayload.activityList[response.itemId]);
                }
            }.bind(this));
            return errorFlag;
        },

        onClearBtnPress: function (oEvent) {
            MessageBox.warning(this.getI18nText("activityConfirmationClearFields.confirm"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        this.ActivityConfirmation.clearFields(this);
                    }
                }.bind(this)
            });
        },

        clearFields: function (that) {
            // Disable the save Btn
            that.activityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2].setEnabled(false);
            var actModel = that.activityConfirmationSubSection.getBlocks()[0].getModel("activityModel")
            var actData = actModel.getData();
            var initialPath = "/activitySummary/"
            for (var i = 0; i < actData.activitySummary.length; i++) {
                actModel.setProperty(initialPath + i + "/value", "");
                actModel.setProperty(initialPath + i + "/postedBy", this.oController.oReportInfoModel.getProperty("/selectedUser"));
                actModel.setProperty(initialPath + i +"/postingDateTime", this.oController.oReportInfoModel.getProperty("/selectedTime"));
                actModel.setProperty(initialPath + i +"/customFieldJson", []);
                actModel.setProperty(initialPath + i +"/customFieldValue", "");
                actModel.setProperty(initialPath + i +"/selectedUoM", actData.activitySummary[i].targetQuantity.unitOfMeasure.internalUom);
                actModel.setProperty(initialPath + i +"/finalConfirmation", false);
                actModel.setProperty(initialPath + i +"/rowStatus", "None");
            }
        },

        onValueChange: function (oEvent) {
            var inputField = oEvent.getSource();
            // Adding explicit delay because of parallel validation of qty fields
            setTimeout(function() {
                this.ActivityConfirmation.highlightRow(inputField);
                this.ActivityConfirmation._enableConfirmButton();
            }.bind(this), 500);
        },

        highlightRow: function (oSource) {
            var isErrorStateExist = false;
            var actData = oSource.getModel("activityModel").getData();
            var selectedIndex = parseInt(oSource.getBindingContext("activityModel").getPath().substr(17));
            var selectedItem = actData.activitySummary[selectedIndex];
            var oParent = oSource.getParent();
            if (!oParent) {
                // this is null after OPA tests
                return;
            }

            var cells = oParent.getCells();
            for (var i = 0; i < cells.length; i++) {
                if (cells[i].getValueState && cells[i].getValueState() === "Error") {
                    oParent.setHighlight("Error");
                    isErrorStateExist = true;
                    break;
                }
            }

            if (!isErrorStateExist) {
                if (selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value && selectedItem.selectedUoM) {
                    oParent.setHighlight("Success");
                } else {
                    oParent.setHighlight("None");
                }
            }
        },

        _enableConfirmButton: function () {
            var partialDataEnteredRow = 0;
            var errorRowExist = false;
            var oToolbar = this.oController.activityConfirmationSubSection.getBlocks()[0].getHeaderToolbar();
            if (!oToolbar) {
                // can be null when running OPA tests
                return;
            }
            var saveBtn = oToolbar.getContent()[2];
            var oTableContent = this.oController.activityConfirmationSubSection.getBlocks()[0].getItems();
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

        onCustomFieldLiveChange : function(oEvent){
            var customField =  oEvent.getSource();
            var oModel = customField.getModel("activityModel");
            var selectedPath = customField.getBindingContext("activityModel").getPath();
            var saveBtn = this.activityConfirmationSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var customFieldData = customField.getValue();
            oModel.setProperty(selectedPath + "/customFieldValue", customFieldData);
            ErrorHandler.clearErrorState(customField);
            if (this.utils.validateInputRegEx(customFieldData)) {
                var customFieldJson = this.utils.buildCustomFieldData(customFieldData);
                oModel.setProperty(selectedPath + "/customFieldJson", customFieldJson);
                this.ActivityConfirmation.highlightRow(customField);
                this.ActivityConfirmation._enableConfirmButton();
            }else{
                ErrorHandler.setErrorState(customField, this.getI18nText("INVALID_INPUT"));
                this.ActivityConfirmation.highlightRow(customField);
            }
        }
    }
});
