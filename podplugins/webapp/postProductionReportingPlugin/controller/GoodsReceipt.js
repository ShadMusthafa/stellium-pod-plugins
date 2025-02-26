sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/ui/core/Fragment",
    "sap/ui/core/MessageType",
    "stellium/ext/podplugins/postProductionReportingPlugin/controller/MaterialBrowse",
    "sap/dm/dme/controller/GRPostController",
    "sap/dm/dme/browse/BatchControl",
    "sap/dm/dme/browse/StorageLocationBrowse"
], function (JSONModel, MessageBox, MessageToast, AjaxUtil, ErrorHandler, Fragment, MessageType, MaterialBrowse, GRPostController, BatchControl, StorageLocationBrowse) {
    "use strict";

    return {

        setController: function (sController) {
            this.oController = sController;
            GRPostController.setController(this.oController);
        },
        getGrData: function (updateFlag) {
            var saveBtn = this.oController.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false); //While navigating from one tab to another.
            var inventoryUrl = this.oController.getInventoryDataSourceUri();
            var oParameters = {};
            var order = this.oController.selectedOrderData.order;
            var sfc = this.oController.selectedOrderData.sfc;
            oParameters.shopOrder = order;
            oParameters.sfc = sfc;
            var sUrl = inventoryUrl + "order/goodsReceipt/summary";
            this.fetchGrData(sUrl, oParameters);
        },

        /***
         * Fetch GR Summary data
         */
        fetchGrData: function (sUrl, oParameters) {
            var that = this;
            this.oController.grSubSection.setBusy(true);
            AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
               // adding user work center authorization flag to response
                oResponseData.userAuthorizedForWorkCenter = (that.oController.authorizedUser !== null && that.oController.authorizedUser !== undefined) ? that.oController.authorizedUser : false;
                that.itemList = that.addPostingProperties(oResponseData);
                that.fetchRelatedUoMsAndProceed(oResponseData);
                // Populate the table data
                that.grModel = that.grModel || new sap.ui.model.json.JSONModel();
                that.grModel.setData(that.itemList);
                that.oController.grSubSection.setModel(that.grModel, "grModel");
                that.oController.grSubSection.setBusy(false);
            }, function (oError, oHttpErrorMessage) {
                that.oController.grSubSection.setBusy(false);
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.itemList = {};
            });
        },

        addPostingProperties: function (oResponse) {
            // Set the initial focused date to current plant time
            var currentDateTimeInPlantTimeZone = this.oController.getCurrentDateTimeInPlantTimeZone();
            if(sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g,"T")
            }
            for (var i = 0; i < oResponse.lineItems.length ; i++){
                oResponse.lineItems[i].value = "";
                switch (oResponse.lineItems[i].type) {
                    case "N":
                        oResponse.lineItems[i].category = this.oController.getI18nText("FINISHED_GOODS");
                        break;
                    case "C":
                        oResponse.lineItems[i].category = this.oController.getI18nText("CO_PRODUCTS");
                        break;
                    case "B":
                        oResponse.lineItems[i].category = this.oController.getI18nText("BY_PRODUCTS");
                        break;
                }
                if(!oResponse.lineItems[i].batchManaged || oResponse.lineItems[i].batchManaged === "NONE") {
                   oResponse.lineItems[i].enteredBatchNumber = this.oController.getI18nText("notBatchManaged");
                   oResponse.lineItems[i].isBatchManaged = false;
                } else {
                   oResponse.lineItems[i].enteredBatchNumber = oResponse.lineItems[i].batchNumber;
                   oResponse.lineItems[i].isBatchManaged = true;
                }
                oResponse.lineItems[i].enteredStorageLoc = oResponse.lineItems[i].storageLocation;
                oResponse.lineItems[i].selectedUoM = oResponse.lineItems[i].targetQuantity.unitOfMeasure.uom;
                oResponse.lineItems[i].baseUoM = oResponse.lineItems[i].targetQuantity.unitOfMeasure.uom;
                oResponse.lineItems[i].postingDateTime = this.oController.oReportInfoModel.getProperty("/selectedTime");
                oResponse.lineItems[i].customFieldValue = "";
                oResponse.lineItems[i].customFieldJson = [];
                oResponse.lineItems[i].focusedDateTime = new Date(currentDateTimeInPlantTimeZone);
                oResponse.lineItems[i].postedBy = this.oController.oReportInfoModel.getProperty("/selectedUser");
                oResponse.lineItems[i].removeEnabled = false;
                oResponse.lineItems[i].rowStatus = "None";
            }
            return oResponse;
        },

        fetchRelatedUoMsAndProceed: function (oResponse) {
            if (!this.alternateUomForSelectedMaterial) {
                this.alternateUomForSelectedMaterial = {};
            }
            var uomList = [];
            this.uomCount = 0;
            this.responseCount = 0;
            oResponse.lineItems.forEach(function (grSummary) {
                var uom = grSummary.targetQuantity.unitOfMeasure.uom;
                var selectedMaterial = grSummary.material;
                var selectedMaterialRef = grSummary.materialId;
                var selectedMaterialVersion = grSummary.version;
                if (!this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
                    this.uomCount++;
                    this.getAlternateUoms(this.alternateUomForSelectedMaterial, selectedMaterial, selectedMaterialRef, selectedMaterialVersion);
                }
            }.bind(this));
            this.checkResponseCount();
        },

        getAlternateUoms: function(alternateUomForSelectedMaterial, material, materialRef, version) {
            let that = this;
            let url = that.oController.getProductRestDataSourceUri() + "materials/uoms";
            let oParameters = {'material': material, 'version': version};
            AjaxUtil.get(url, oParameters, function(oResponseData){
                alternateUomForSelectedMaterial[material] = oResponseData;
                if(alternateUomForSelectedMaterial[material].length > 0) {
                	that.getConversionDetailsForUoms(alternateUomForSelectedMaterial, material, materialRef);
                }else {
                    that.responseCount++;
                    that.checkResponseCount();
                }
            },
            function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.grSubSection.setBusy(false);
            });
        },

        getConversionDetailsForUoms: function(alternateUomForSelectedMaterial, material, materialRef) {
            var that = this;
            var url = that.oController.getProductDataSourceUri() + "Materials('" + encodeURIComponent(materialRef) + "')?$select=alternateUnitsOfMeasure&$expand=alternateUnitsOfMeasure($select=ref,uom,numerator,denominator)";
            var oParameters = {};
            var allUoms, i, j;
            AjaxUtil.get(url, oParameters, function(oResponseData){
                allUoms = oResponseData.alternateUnitsOfMeasure;
                for(i=0; i<alternateUomForSelectedMaterial[material].length; i++) {
                	alternateUomForSelectedMaterial[material][i].numerator = 1;
        			alternateUomForSelectedMaterial[material][i].denominator = 1;
                	for(j=0; j<allUoms.length; j++) {
                		if(alternateUomForSelectedMaterial[material][i].uom === allUoms[j].uom) {
                			alternateUomForSelectedMaterial[material][i].numerator = allUoms[j].numerator;
                			alternateUomForSelectedMaterial[material][i].denominator = allUoms[j].denominator;
                			break;
                		}
                	}
                }
                that.responseCount++;
                that.checkResponseCount();
            },
            function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.grSubSection.setBusy(false);
            });
        },

        addFailedRows: function() {
            // Do not proceed if there are no failed API response
            if(!this.failedRows || this.failedRows.length == 0) {
                return;
            }

            var initialArrLength = this.itemList.lineItems.length;
            var replaceFlag = true;

            for(var k = 0; k < this.failedRows.length; k++) {
                this.itemList.lineItems = this.addRowToComponentsTable(this.itemList, this.failedRows[k], this.failedRows[k].itemId, k, replaceFlag);
                if(!replaceFlag) {
                    initialArrLength++;
                }
            }
        },

        addRowToComponentsTable : function(itemList, selectedItem, selectedIndex, failedItemIndex, replaceFlag){
            var lineItems = itemList.lineItems;
            var errorObj = $.extend({}, lineItems[selectedIndex]);
            errorObj.enteredStorageLoc = selectedItem.enteredStorageLoc;
            errorObj.enteredBatchNumber = (selectedItem.batchNumber) ? selectedItem.batchNumber : lineItems[selectedIndex].enteredBatchNumber;
            errorObj.value = selectedItem.quantity.value;
            errorObj.selectedUoM = selectedItem.quantity.unitOfMeasure.uom;
            errorObj.postingDateTime = selectedItem.dateTime;
            errorObj.postedBy = selectedItem.userId;
            errorObj.comments = selectedItem.comments;
            errorObj.rowStatus = "Error";

            if(replaceFlag === true){
                errorObj.actionBtnVisible = true;
                errorObj.removeEnabled = false;
                lineItems[selectedIndex] = errorObj;
            }else{
                errorObj.actionBtnVisible = false;
                errorObj.removeEnabled = true;
                lineItems.splice(selectedIndex + 1, 0, errorObj);
            }

            return lineItems;
        },

        checkResponseCount: function () {
            if (this.responseCount !== this.uomCount) {
                return;
            }
            if(this.itemList.lineItems){
                this.itemList.lineItems.forEach(function (grSummary) {
                    var uom = grSummary.targetQuantity.unitOfMeasure.uom;
                    var selectedMaterial = grSummary.material;
                    if (this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
                        grSummary.unitList = this.alternateUomForSelectedMaterial[selectedMaterial];
                    }
                }.bind(this));
                this.addFailedRows();
                var oModel = new JSONModel(this.itemList);
                this.oController.grSubSection.setModel(oModel, "grModel");
                this.oController.grSubSection.setBusy(false);
            }
        },

        onPressAdd: function (oEvent) {
            var oTableControl=oEvent.getSource().getParent().getParent().getParent();
            var oModel = oEvent.getSource().getModel("grModel");
            var grData = oModel.getData();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("grModel").getPath().substr(11));
            var selectedItem = grData.lineItems[selectedIndex];
            if (this.GoodsReceipt.getNumberOfRowsForGR(grData, selectedItem.material) >= 4) {
                return;
            }
            var grSummaryArr = grData.lineItems;
            this.GoodsReceipt.handleRowHighlight(oTableControl);
            this.GoodsReceipt.addRowOnPlusButtonClick(oModel, selectedItem, grSummaryArr, selectedIndex);
        },

        addRowOnPlusButtonClick : function(oModel, selectedItem, grSummaryArr, selectedIndex){
            var emptyObj = {
                batchManaged : selectedItem.batchManaged,
                receivedQuantity : {
                   value : selectedItem.receivedQuantity.value
                },
                baseUoM : selectedItem.baseUoM,
                description : selectedItem.description,
                enteredBatchNumber : selectedItem.enteredBatchNumber,
                enteredStorageLoc : selectedItem.enteredStorageLoc,
                material : selectedItem.material,
                materialRef : selectedItem.materialId,
                version : selectedItem.version,
                value : "",
                unitList: selectedItem.unitList,
                selectedUoM: selectedItem.selectedUoM,
                postingDateTime: selectedItem.postingDateTime,
                customFieldValue: "",
                customFieldJson: [],
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.postedBy,
                type: selectedItem.type,
                category: selectedItem.category,
                actionBtnVisible: false,
                removeEnabled: true,
                rowStatus: "None"
            };
            if(selectedIndex !== undefined)
                grSummaryArr.splice(selectedIndex + 1, 0, emptyObj);
            else
                grSummaryArr.splice(grSummaryArr.length, 0, emptyObj);
            oModel.getData().lineItems = grSummaryArr;
            oModel.refresh();
        },

        getNumberOfRowsForGR: function (grData, material) {
            var tempArr = [];
            tempArr = grData.lineItems.filter(function (obj) {
                return obj.material === material;
            })
            return tempArr.length;
        },

        onPressRemove: function (oEvent) {
            var oTableControl=oEvent.getSource().getParent().getParent().getParent();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("grModel").getPath().substr(11));
            var grSummaryArr = oEvent.getSource().getModel("grModel").getData().lineItems;
            grSummaryArr.splice(selectedIndex, 1);
            oEvent.getSource().getModel("grModel").getData().lineItems = grSummaryArr;
            oEvent.getSource().getModel("grModel").refresh();
            this.GoodsReceipt.handleRowHighlight(oTableControl);
            this.GoodsReceipt.enableConfirmButton();
        },

        handleRowHighlight: function(oTableControl){
            var oTableItems =  oTableControl.getItems().slice();
            oTableItems = oTableItems.filter(item=> !(item.mProperties && item.mProperties.title));
            oTableItems.forEach(function (row) {
                if(row.getHighlight()  === "Error"){
                    row.setHighlight("None")
            }
            });
        },
        handleChangeDateTime: function (oEvent) {
            var inputPostingDate = oEvent.getSource().getValue();
            var oModel = oEvent.getSource().getModel("grModel");
            var selectedPath = oEvent.getSource().getBindingContext("grModel").getPath();
            var saveBtn = this.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];

		    ErrorHandler.clearErrorState(oEvent.getSource());
		    saveBtn.setEnabled(false);
		    if(inputPostingDate > this.getCurrentDateTimeInPlantTimeZone()){
                ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText("process.postingDate.msg"));
                oEvent.getSource().setValueStateText(this.getI18nText("process.postingDate.msg"));
                this.GoodsReceipt.highlightRow(oEvent.getSource());
		    }else{
                ErrorHandler.clearErrorState(oEvent.getSource());
                oModel.setProperty(selectedPath + "/postingDateTime", oEvent.getSource().getValue());
                this.GoodsReceipt.highlightRow(oEvent.getSource());
		        this.GoodsReceipt.enableConfirmButton();
		    }
        },

        handleSelectChange: function (oEvent) {
            var oModel = oEvent.getSource().getModel("grModel");
            var selectedPath = oEvent.getSource().getBindingContext("grModel").getPath();
            var selectedUoM = oEvent.getSource().getList().getSelectedItem().getBindingContext("grModel").getObject().uom;
            oModel.setProperty(selectedPath + "/selectedUoM", selectedUoM);
        },

        onSaveBtnPress: function(oEvent){
            // Use arrays to store sloc and avlQty so that they can be fetched for failed records
            this.GoodsReceipt.sLocArr = [];
            var oTableControl = oEvent.getSource().getParent().getParent();
            var grData = oTableControl.getModel("grModel").getData();
            var oTableItems =  oTableControl.getItems().slice();
            oTableItems = oTableItems.filter(item=> !(item.mProperties && item.mProperties.title));
            var that = this;
            var postPayload = {
                triggerPoint: "POST_PRODUCTION_REPORT_POD_GOODS_RECEIPT",
                orderNumber: grData.shopOrder,
                lineItems: []
            };
            var isError = false;
            oTableItems.forEach(function (rowData) {
                that.GoodsReceipt.highlightRow(rowData.getCells()[5]);
                that.GoodsReceipt.enableConfirmButton();
            });
            grData.lineItems.forEach(function (grSummary, rowId) {
                if(grSummary.rowStatus === "None"){
                    return;
                }
                if(grSummary.rowStatus === "Error"){
                    isError=true;
                    return;
                }
                var selectedInternalUoM = grSummary.unitList.filter(list=> (list.uom === grSummary.selectedUoM))[0].internalUom;
                // We use the dmcDateToUTCFormat function to convert the selected time to UTC
                // When converting, we assume that the time and date is given in plant timezone. 
                // Therefore do not pass any timezone as the function takes the plant timezone by default if notexplicit timezone is passed
                var selectedDateTimeInUTC = that.DateTimeUtils.dmcDateToUTCFormat(grSummary.postingDateTime);
                var obj = {
                    "sfc": grData.sfc,
                    "material": grSummary.material,
                    "materialVersion": grSummary.version,
                    "batchNumber": (grSummary.enteredBatchNumber === that.getI18nText("notBatchManaged")) ? null : grSummary.enteredBatchNumber,
                    "storageLocation": grSummary.enteredStorageLoc,
                    "quantity": {
                        "value": grSummary.value,
                        "unitOfMeasure": {
                            "internalUnitOfMeasure": selectedInternalUoM
                        }
                    },
                    "postedBy": grSummary.postedBy,
                    "postingDate": selectedDateTimeInUTC,
                    "customFieldData": (grSummary.customFieldJson && grSummary.customFieldJson.length > 0) ? JSON.stringify(grSummary.customFieldJson) : null
                };
                postPayload.lineItems.push(obj);
                that.GoodsReceipt.sLocArr.push(grSummary.enteredStorageLoc);
             });
             if(postPayload.lineItems.length > 0 && isError === false){
                this.GoodsReceipt.postGrData(postPayload);}
        },
        postGrData : function(postPayload){
            this.saveBtn = this.oController.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            this.saveBtn.setEnabled(false);
            this.oController.grSubSection.setBusy(true);
            var inventoryUrl = this.oController.getInventoryDataSourceUri();
            var sUrl = inventoryUrl + "order/goodsReceipt";
            AjaxUtil.post(
                sUrl, postPayload,
                function (oResponse) {
                    var errorFlag = false;
                    errorFlag = this.handleErrors(oResponse, postPayload);
                    (errorFlag) ? MessageBox.error(this.oController.getI18nText("goodsReceiptPostingError.msg"))
                                : MessageToast.show(this.oController.getI18nText("goodsReceiptPostingSuccess.msg"));
                    this.getGrData(true);
                    this.oController.getGRQuantity();//Refresh order header GR quantity
                }.bind(this),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                    this.oController.grSubSection.setBusy(false);
                    this.saveBtn.setEnabled(true);
                }.bind(this)
            );
        },

        handleErrors: function (oResponse, postPayload) {
            this.failedRows = [];
            var errorFlag = false;
            oResponse.lineItems.forEach(function (response, nIndex) {
                if(response.error) {
                    errorFlag = true;
                    var errorMsg = (postPayload.lineItems[nIndex].sfc) ?
                        this.oController.getI18nText("goodsReceiptPostingErrorTitle.msg", [postPayload.lineItems[nIndex].material, postPayload.lineItems[nIndex].sfc, postPayload.lineItems[nIndex].inventoryId, postPayload.lineItems[nIndex].quantity.value + postPayload.lineItems[nIndex].quantity.unitOfMeasure.commercialUnitOfMeasure, postPayload.lineItems[nIndex].postedBy, this.oController.DateTimeUtils.formatDateTime(postPayload.lineItems[nIndex].postingDate)]) :
                        this.oController.getI18nText("goodsReceiptPostingErrorTitleNonBatch.msg", [postPayload.lineItems[nIndex].material, postPayload.lineItems[nIndex].inventoryId, postPayload.lineItems[nIndex].quantity.value + postPayload.lineItems[nIndex].quantity.unitOfMeasure.commercialUnitOfMeasure, postPayload.lineItems[nIndex].postedBy, this.oController.DateTimeUtils.formatDateTime(postPayload.lineItems[nIndex].postingDate)]);
                    this.oController.addMessage(MessageType.Error, errorMsg, response.message, response.message);
                    postPayload.lineItems[nIndex].enteredStorageLoc = this.sLocArr[response.itemId];
                    this.failedRows.push(postPayload.lineItems[nIndex]);
                }
            }.bind(this));
            return errorFlag;
        },

        onClearBtnPress: function (oEvent) {
            MessageBox.warning(this.getI18nText("goodsReceiptClearFields.confirm"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        this.GoodsReceipt.clearFields(this);
                        var saveBtn = this.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
                        saveBtn.setEnabled(false);
                    }
                }.bind(this)
            });
        },

        clearFields: function (that) {
            var grModel = that.grSubSection.getBlocks()[0].getModel("grModel");
            var grData = grModel.getData();
            var initialPath = "/lineItems/"
            for (var i = 0; i < grData.lineItems.length; i++) {
                if(grData.lineItems[i].enteredBatchNumber !== this.oController.getI18nText("notBatchManaged")) {
                    grModel.setProperty(initialPath + i + "/enteredBatchNumber", grData.lineItems[i].batchNumber);
                }
                grModel.setProperty(initialPath + i + "/enteredStorageLoc", grData.lineItems[i].storageLocation);
                grModel.setProperty(initialPath + i + "/value", "");
                grModel.setProperty(initialPath + i + "/postedBy", this.oController.oReportInfoModel.getProperty("/selectedUser"));
                grModel.setProperty(initialPath + i +"/postingDateTime", this.oController.oReportInfoModel.getProperty("/selectedTime"));
                grModel.setProperty(initialPath + i +"/customFieldJson", []);
                grModel.setProperty(initialPath + i +"/customFieldValue", "");
                grModel.setProperty(initialPath + i +"/selectedUoM", grData.lineItems[i].baseUoM);
                grModel.setProperty(initialPath + i +"/rowStatus", "None");
            }
        },

        onValueChange: function (oEvent) {
            var inputField = oEvent.getSource();
            // Adding explicit delay because of parallel validation of qty fields
            setTimeout(function() {
                this.GoodsReceipt.highlightRow(inputField);
                this.GoodsReceipt.enableConfirmButton();
            }.bind(this), 500);
        },

        highlightRow : function(oSource){
           var isErrorStateExist = false;
           var grData = oSource.getModel("grModel").getData();
           var selectedIndex = parseInt(oSource.getBindingContext("grModel").getPath().substr(11));
           var selectedItem = grData.lineItems[selectedIndex];
           var cells = oSource.getParent().getCells();
           for(var i=0; i < cells.length; i++){
             if(cells[i].getValueState && cells[i].getValueState() === "Error"){
                oSource.getParent().setHighlight("Error");
                isErrorStateExist = true;
                break;
             }
           }
           if(!isErrorStateExist){
              if((selectedItem.enteredBatchNumber && selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value) ||
                   (selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value && selectedItem.type === "PIPELINE"))
                oSource.getParent().setHighlight("Success");
              else
                oSource.getParent().setHighlight("None");
           }
        },

        enableConfirmButton: function(){
            var partialDataEnteredRow = 0;
            var noOfGoodsReceiptRows = 0;
            var validRowExist = false;
            var errorRowExist = false;
            var saveBtn = this.oController.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            var oTableContent = this.oController.grSubSection.getBlocks()[0].getItems();
            for(var i = 0; i < oTableContent.length; i++ ){
                if(oTableContent[i].getCells) {
                    noOfGoodsReceiptRows++;
                    if(oTableContent[i].getHighlight() === "Error"){
                        errorRowExist = true;
                        break;
                    } else if(oTableContent[i].getHighlight() === "None"){
                        partialDataEnteredRow++;
                    }
                }
            }
            if(partialDataEnteredRow === noOfGoodsReceiptRows || errorRowExist){
                saveBtn.setEnabled(false);
            } else {
                saveBtn.setEnabled(true);
            }
        },

        validatePositiveNumber: function (sInputValue) {
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

        showStorageLocDialog: function (oEvent) {
            var storageLocControl = oEvent.getSource();
            var oModel = storageLocControl.getModel("grModel");
            var grData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("grModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = grData.lineItems[selectedIndex];
            var selectedSloc = oModel.getProperty(selectedPath + "/enteredStorageLoc");
            StorageLocationBrowse.open(this.getView(), selectedSloc, function (oSelectedObject) {
                oModel.setProperty(selectedPath + "/enteredStorageLoc", oSelectedObject.name);
                this.GoodsReceipt.highlightRow(storageLocControl);
                this.GoodsReceipt.enableConfirmButton();
            }.bind(this), this.getView().getModel("inventory"));
        },

        onViewPostsBtnPress: function (oEvent) {
            var postButton = oEvent.getSource();
            var grData = postButton.getModel("grModel").getData();
            var selectedIndex = postButton.getBindingContext("grModel").getPath().substr(11);
            var selectedItem = grData.lineItems[selectedIndex];
            var oParameters = {};
            oParameters.shopOrder = grData.shopOrder;
            oParameters.sfc = grData.sfc;
            oParameters.material = selectedItem.materialId;
            oParameters.dontShowPrint = true;
            GRPostController.setSelectedOrderData(this.selectedOrderData);
            GRPostController.showGRPostingsDialogs(oParameters);
        },

        showBatchDialog: function (oEvent) {
            var batchControl = oEvent.getSource();
            var oModel = batchControl.getModel("grModel");
            var grData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("grModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = grData.lineItems[selectedIndex];
            BatchControl.setController(this.GoodsReceipt.oController);
            BatchControl.setParentController(this);
            var material = selectedItem.material;
            var materialRef = selectedItem.materialId;
            var plant = materialRef.split(":")[1].split(",")[0];
            BatchControl._batchBrowseOpen(material, plant, "", function (oBatchData) {
                oModel.setProperty(selectedPath + "/enteredBatchNumber", oBatchData.name);
                this.GoodsReceipt.highlightRow(batchControl);
                this.GoodsReceipt.enableConfirmButton();
            }.bind(this));
        },

        onExit: function () {
            GRPostController.onExit();
        },

        onCustomFieldLiveChange : function(oEvent){
            var customField =  oEvent.getSource();
            var oModel = customField.getModel("grModel");
            var selectedPath = customField.getBindingContext("grModel").getPath();
            var saveBtn = this.grSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var customFieldData = customField.getValue();
            oModel.setProperty(selectedPath + "/customFieldValue", customFieldData);
            ErrorHandler.clearErrorState(customField);
            if (this.utils.validateInputRegEx(customFieldData)) {
                var customFieldJson = this.utils.buildCustomFieldData(customFieldData);
                oModel.setProperty(selectedPath + "/customFieldJson", customFieldJson);
                this.GoodsReceipt.highlightRow(customField);
                this.GoodsReceipt.enableConfirmButton();
            }else{
                ErrorHandler.setErrorState(customField, this.getI18nText("INVALID_INPUT"));
                this.GoodsReceipt.highlightRow(customField);
            }
        }
    }
});
