sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/ui/core/Fragment",
    "sap/ui/core/MessageType",
    "stellium/ext/podplugins/postProductionReportingPlugin/controller/MaterialBrowse",
    "stellium/ext/podplugins/postProductionReportingPlugin/utils/Formatter",
    "sap/dm/dme/types/QuantityType"
], function(JSONModel, MessageBox, MessageToast, AjaxUtil, ErrorHandler, Fragment, MessageType, MaterialBrowse, Formatter, QuantityType) {
    "use strict";

    return {

        setController: function(sController) {
            this.oController = sController;
        },

        getGiMaterialData: function(updateFlag) {
            var saveBtn = this.oController.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false); //While navigating from one tab to another.
            var assemblyUrl = this.oController.getAssemblyDataSourceUri();
            this.oSectionData = this.oController.selectedSectionData;
            this.orderData = this.oController.selectedOrderData;
            if (!updateFlag) {
                this.failedRows = [];
            }

            var oParameters = {};
            oParameters.shopOrder = this.orderData.order;
            oParameters.batchId = this.orderData.sfc;
            oParameters.operationActivity = this.oSectionData.phaseId;
            oParameters.stepId = this.oSectionData.stepId;
            if (oParameters.shopOrder) {
                var sUrl = assemblyUrl + "order/goodsIssue/summary";
                this.oController.materialComponentsSubSection.setBusy(true);
                this.fetchGiMaterialData(sUrl, oParameters);
            }
        },

        fetchGiMaterialData: function(sUrl, oParameters) {
            var that = this;
            var i, lineItem;
            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                that.coAndByProducts = [];
                if (oResponseData.lineItems.length > 0) {
                    for (i = oResponseData.lineItems.length - 1; i >= 0; i--) {
                        if (oResponseData.lineItems[i].componentType === "B" || oResponseData.lineItems[i].componentType === "C") {
                            lineItem = oResponseData.lineItems.splice(i, 1);
                            that.coAndByProducts.push(lineItem[0].materialId.material);
                        }
                    }
                    oResponseData = that.addPostingProperties(oResponseData);
                    that.actualItemSummary = oResponseData.lineItems;
                    that.itemList = oResponseData;
                    that.itemList.lineItems.forEach(function(e, i) {
                        var thresholdValues = that.oController.formatter.getUpperAndLowerThresholdValues(e.recipeComponentToleranceOver, e.recipeComponentToleranceUnder, e.toleranceOver, e.toleranceUnder, e.totalQtyEntryUom, e.totalQtyBaseUom, e.targetQuantity);
                        e.upperThresholdValue = thresholdValues.upperValue;
                        e.lowerThresholdValue = thresholdValues.lowerValue;
                        e.enteredStorageLoc = e.storageLocation && e.storageLocation.storageLocation || null;
                    });
                    that.fetchRelatedUoMsAndProceed(oResponseData);
                } else {
                    that.actualItemSummary = oResponseData.lineItems;
                    that.itemList = oResponseData;
                    that.addFailedRows();
                    var oModel = new JSONModel(that.itemList);
                    that.oController.materialComponentsSubSection.setModel(oModel, "matConsModel");
                    that.oController.materialComponentsSubSection.setBusy(false);
                }
                // Set the count in the header text
                /*                that.titleModel = new sap.ui.model.json.JSONModel();
                                that.titleModel.setSizeLimit(100);
                                title.title = that.getI18nText("components") + " (" + that.itemList.lineItems.length + ")";
                                that.titleModel.setData(title);
                                that.byId("titleText").setModel(that.titleModel, "testTitle")*/
                ;
                // Populate the table data


            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.itemList = {};
                that.oController.materialComponentsSubSection.setBusy(false);
            });
        },

        addPostingProperties: function(oResponse) {
            // Set the initial focused date to current plant time
            var currentDateTimeInPlantTimeZone = this.oController.getCurrentDateTimeInPlantTimeZone();
            if (sap.ui.Device.browser.name === "sf") {
                currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g, "T")
            }
            for (var i = 0; i < oResponse.lineItems.length; i++) {
                oResponse.lineItems[i].value = "";
                if (!oResponse.lineItems[i].batchManaged || oResponse.lineItems[i].batchManaged === "NONE")
                    oResponse.lineItems[i].enteredBatchNumber = this.oController.getI18nText("notBatchManaged");
                else
                    oResponse.lineItems[i].enteredBatchNumber = "";
                oResponse.lineItems[i].enteredStorageLoc = "";
                oResponse.lineItems[i].inventory = "";
                oResponse.lineItems[i].avlBatchQty = "";
                oResponse.lineItems[i].shopOrderLocationRef = "";
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

        fetchRelatedUoMsAndProceed: function(oResponse) {
            if (!this.alternateUomForSelectedMaterial) {
                this.alternateUomForSelectedMaterial = {};
            }

            var uomList = [];
            this.uomCount = 0;
            this.responseCount = 0;

            oResponse.lineItems.forEach(function(matConsSummary) {
                var uom = matConsSummary.targetQuantity.unitOfMeasure.uom;
                var selectedMaterial = matConsSummary.materialId.material;
                var selectedMaterialRef = matConsSummary.materialId.ref;
                var selectedMaterialVersion = matConsSummary.materialId.version;
                if (!this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
                    this.uomCount++;
                    this.getAlternateUoms(this.alternateUomForSelectedMaterial, selectedMaterial, selectedMaterialRef, selectedMaterialVersion);
                }
            }.bind(this));

            if (this.oController.oPluginConfiguration.calculateGI) {
                const oSelectedOrderData = this.oController.selectedOrderData;
                this.getAlternateUoms(this.alternateUomForSelectedMaterial, oSelectedOrderData.material.material, oSelectedOrderData.materialRef, oSelectedOrderData.materialVersion);
            }

            this.checkResponseCount();
            this.resetProposalStatus(this.oController.materialComponentsSubSection.getBlocks()[0]);
        },

        getAlternateUoms: function(alternateUomForSelectedMaterial, material, materialRef, version, oModel, selectedItem, oData) {
            let that = this;
            that.addMaterialData = selectedItem;
            let url = that.oController.getProductRestDataSourceUri() + "materials/uoms";
            let oParameters = {'material': material, 'version': version};
            AjaxUtil.get(url, oParameters, function(oResponseData) {
                    alternateUomForSelectedMaterial[material] = oResponseData;
                    if (alternateUomForSelectedMaterial[material].length > 0) {
                        that.getConversionDetailsForUoms(alternateUomForSelectedMaterial, material, materialRef, oModel, selectedItem, oData);
                    } else if (!that.addMaterialData || !that.addMaterialData.isAddMaterial) {
                        that.responseCount++;
                        that.checkResponseCount();
                    } else {
                        that.addMaterialData.unitList = [];
                        that.addRowOnPlusButtonClick(oModel, that.addMaterialData, oData);
                        that.oController.materialComponentsSubSection.setBusy(false);
                    }
                },
                function(oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    that.oController.showErrorMessage(err, true, true);
                    if (!that.addMaterialData || !that.addMaterialData.isAddMaterial) {
                        that.responseCount++;
                        that.checkResponseCount();
                    } else {
                        that.oController.materialComponentsSubSection.setBusy(false);
                    }

                });
        },

        getConversionDetailsForUoms: function(alternateUomForSelectedMaterial, material, materialRef, oModel, selectedItem, oData) {
            let that = this;
            that.addMaterialData = selectedItem;
            let url = that.oController.getProductDataSourceUri() + "Materials('" + encodeURIComponent(materialRef) + "')?$select=alternateUnitsOfMeasure&$expand=alternateUnitsOfMeasure($select=ref,uom,numerator,denominator)";
            let oParameters = {};
            let allUoms, i, j;
            AjaxUtil.get(url, oParameters, function(oResponseData) {
                    allUoms = oResponseData.alternateUnitsOfMeasure;
                    for (i = 0; i < alternateUomForSelectedMaterial[material].length; i++) {
                        alternateUomForSelectedMaterial[material][i].numerator = 1;
                        alternateUomForSelectedMaterial[material][i].denominator = 1;
                        for (j = 0; j < allUoms.length; j++) {
                            if (alternateUomForSelectedMaterial[material][i].uom === allUoms[j].uom) {
                                alternateUomForSelectedMaterial[material][i].numerator = allUoms[j].numerator;
                                alternateUomForSelectedMaterial[material][i].denominator = allUoms[j].denominator;
                                break;
                            }
                        }
                    }
                    if (!that.addMaterialData || !that.addMaterialData.isAddMaterial) {
                        that.responseCount++;
                        that.checkResponseCount();
                    } else {
                        that.addMaterialData.unitList = that.alternateUomForSelectedMaterial[material];
                        that.addRowOnPlusButtonClick(oModel, that.addMaterialData, oData);
                        that.oController.materialComponentsSubSection.setBusy(false);
                    }

                },
                function(oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    that.oController.showErrorMessage(err, true, true);
                    if (!that.addMaterialData || !that.addMaterialData.isAddMaterial) {
                        that.responseCount++;
                        that.checkResponseCount();
                    } else {
                        that.oController.materialComponentsSubSection.setBusy(false);
                    }
                });
        },

        addFailedRows: function() {
            // Do not proceed if there are no failed API response
            if (!this.failedRows || this.failedRows.length == 0) {
                return;
            }

            var initialArrLength = this.itemList.lineItems.length;
            var replaceFlag = true;

            for (var k = 0; k < this.failedRows.length; k++) {
                // check if the failed material is a non-bom component
                // if yes, then do not show that row as an error
                if (this.failedRows[k].bomComponentRef === null) {
                    continue;
                }

                // check if the previous element in the failedRow has the same bomComponent ID,
                // If yes, then do not replace the parent response element, just add to it
                // If No, then replace the row with the error obj
                if (k !== 0 && (this.failedRows[k].bomComponentRef === this.failedRows[k - 1].bomComponentRef)) {
                    replaceFlag = false;
                } else {
                    replaceFlag = true;
                }

                // Loop through the BOM Item list and check if an element is found with the same bomCompID as the failedRow element
                // If yes, Then add or replace the row in Item List with the failed row element
                var selectedIndex = 0;
                for (var i = 0; i < initialArrLength; i++) {
                    if (this.failedRows[k].bomComponentRef === this.itemList.lineItems[i].bomComponentRef) {
                        selectedIndex = i;
                    }
                }

                this.itemList.lineItems = this.addRowToComponentsTable(this.itemList, this.failedRows[k], selectedIndex, k, replaceFlag);
                if (!replaceFlag) {
                    initialArrLength++;
                }

            }
        },

        addRowToComponentsTable: function(itemList, selectedItem, selectedIndex, failedItemIndex, replaceFlag) {
            var lineItems = itemList.lineItems;
            var errorObj = $.extend({}, lineItems[selectedIndex]);
            errorObj.enteredStorageLoc = selectedItem.enteredStorageLoc;
            errorObj.avlBatchQty = selectedItem.avlBatchQty;
            errorObj.enteredBatchNumber = (selectedItem.batchNumber) ? selectedItem.batchNumber : lineItems[selectedIndex].enteredBatchNumber;
            errorObj.inventory = selectedItem.inventory;
            errorObj.value = selectedItem.quantity.value;
            errorObj.selectedUoM = selectedItem.quantity.unitOfMeasure.uom;
            errorObj.postingDateTime = selectedItem.dateTime;
            errorObj.postedBy = selectedItem.userId;
            errorObj.comments = selectedItem.comments;
            errorObj.rowStatus = "Error";

            if (replaceFlag === true) {
                errorObj.actionBtnVisible = true;
                errorObj.removeEnabled = false;
                lineItems[selectedIndex] = errorObj;
            } else {
                errorObj.actionBtnVisible = false;
                errorObj.removeEnabled = true;
                lineItems.splice(selectedIndex + 1, 0, errorObj);
            }

            return lineItems;
        },

        checkResponseCount: function() {
            if (this.responseCount !== this.uomCount) {
                return;
            }
            if (this.itemList.lineItems) {
                this.itemList.lineItems.forEach(function(matConsSummary) {
                    var uom = matConsSummary.targetQuantity.unitOfMeasure.uom;
                    var selectedMaterial = matConsSummary.materialId.material;
                    if (this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
                        matConsSummary.unitList = this.alternateUomForSelectedMaterial[selectedMaterial];
                    }
                }.bind(this));
                this.addFailedRows();
                var oModel = new JSONModel(this.itemList);
                this.oController.materialComponentsSubSection.setModel(oModel, "matConsModel");
                this.oController.materialComponentsSubSection.setBusy(false);
            }
        },

        prepareInventoryUrl: function(materialRef, batchId, oModel, selectedPath, sBatchField) {
            var inventryUrl = this.oController.getInventoryDataSourceUri();
            this.oController.materialComponentsSubSection.setBusy(true);
            var oParameters = {};
            oParameters.materialRef = materialRef;
            oParameters.batchNumber = batchId;
            var sUrl = inventryUrl + "inventory/findInventory";
            this.getBatchDetailsForDefaultBatch(sUrl, oParameters, oModel, selectedPath, sBatchField);
        },

        getBatchDetailsForDefaultBatch: function(sUrl, oParameters, oModel, selectedPath, sBatchField) {
            var that = this;

            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                that.BatchDetails = oResponseData;
                if (that.BatchDetails.length > 0) {
                    var oBatchToUse = that.getFirstCreatedBatch(that.BatchDetails);
                    that.setValueToSLoc(oModel, selectedPath, oBatchToUse);
                    oModel.setProperty(selectedPath + "/enteredBatchNumber", oBatchToUse.batchNumber);
                    oModel.setProperty(selectedPath + "/inventory", oBatchToUse.inventoryId);
                    oModel.setProperty(selectedPath + "/avlBatchQty", oBatchToUse.remainingQuantity);
                    oModel.setProperty(selectedPath + "/shopOrderLocationRef", oBatchToUse.shopOrderLocRef);
                } else {
                    that.setEmptyBatch(oModel, selectedPath);
                    that.oController.showErrorMessage(that.oController.getI18nText("process.inventory_does_not_exist.msg"));
                }
                ErrorHandler.clearErrorState(sBatchField);
                that.highlightRow(sBatchField);
                that.enableConfirmButton();
                that.oController.materialComponentsSubSection.setBusy(false);
            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.setEmptyBatch(oModel, selectedPath);
                ErrorHandler.clearErrorState(sBatchField);
                that.highlightRow(sBatchField);
                that.enableConfirmButton();
                that.oController.materialComponentsSubSection.setBusy(false);
                that.BatchDetails = {};
            });
        },

        setEmptyBatch: function(oModel, selectedPath) {

            oModel.setProperty(selectedPath + "/enteredBatchNumber", "");
            oModel.setProperty(selectedPath + "/enteredStorageLoc", "");
            oModel.setProperty(selectedPath + "/inventory", "");
            oModel.setProperty(selectedPath + "/avlBatchQty", "");
            oModel.setProperty(selectedPath + "/shopOrderLocationRef", "");
        },

        setValueToSLoc: function(oModel, selectedPath, oBatchToUse) {
            if (oBatchToUse.storageLocation)
                oModel.setProperty(selectedPath + "/enteredStorageLoc", oBatchToUse.storageLocation.storageLocation);
            else
                oModel.setProperty(selectedPath + "/enteredStorageLoc", "");
        },

        getFirstCreatedBatch: function(batches) {
            var oFirstCreatedBatch = batches[0];
            for (var i = 1; i < batches.length; i++) {
                if (!oFirstCreatedBatch.receiveDatetime || batches[i].receiveDatetime && oFirstCreatedBatch.receiveDatetime > batches[i].receiveDatetime) {
                    oFirstCreatedBatch = batches[i];
                }
            }
            return oFirstCreatedBatch;
        },

        onBatchChange: function(oEvent) {

            var oModel = oEvent.getSource().getModel("matConsModel");
            var matConsData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("matConsModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = matConsData.lineItems[selectedIndex];
            var saveBtn = this.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];

            var sBatchField = oEvent.getSource();
            var sBatchId = oEvent.getSource().getValue();
            ErrorHandler.clearErrorState(sBatchField);
            saveBtn.setEnabled(false);

            if (!sBatchId) {
                ErrorHandler.clearErrorState(sBatchField);
                this.MaterialComponents.highlightRow(sBatchField);
                this.MaterialComponents.enableConfirmButton();
            } else if (sBatchId && !this.MaterialComponents.validateInputRegEx(sBatchId)) {
                ErrorHandler.setErrorState(sBatchField, this.getI18nText("process.enter_valid_batch.msg"));
                sBatchField.setValueStateText(this.getI18nText("process.enter_valid_batch.msg"));
                this.MaterialComponents.highlightRow(sBatchField);
            } else {
                var sMaterialRef = selectedItem.materialId.ref;
                this.MaterialComponents.prepareInventoryUrl(sMaterialRef, sBatchId, oModel, selectedPath, sBatchField);
            }
        },

        validateInputRegEx: function(sInputValue) {
            //Regex for Valid Characters
            var regex = /^[A-Za-z0-9_@\-. ]+$/;
            var isValidInput = true;
            if (sInputValue) {
                if (!sInputValue.match(regex)) {
                    isValidInput = false;
                }
            }
            return isValidInput;
        },

        onPressAdd: function(oEvent) {
            var oModel = oEvent.getSource().getModel("matConsModel");
            var matConsData = oModel.getData();
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("matConsModel").getPath().substr(11));
            var selectedItem = matConsData.lineItems[selectedIndex];
            if (this.MaterialComponents.getNumberOfRowsForMatCons(matConsData, selectedItem.materialId.material) >= 4) {
                return;
            }
            var matConsSummaryArr = oModel.getData().lineItems;
            this.MaterialComponents.addRowOnPlusButtonClick(oModel, selectedItem, matConsSummaryArr, selectedIndex);

        },

        addRowOnPlusButtonClick: function(oModel, selectedItem, matConsSummaryArr, selectedIndex) {
        let defaultStorageLocation = (selectedItem.storageLocation !== undefined)?selectedItem.storageLocation.storageLocation: selectedItem.enteredStorageLoc;
            var emptyObj = {
                backflushEnabled: selectedItem.backflushEnabled,
                batchManaged: selectedItem.batchManaged,
                bomComponentRef: selectedItem.bomComponentRef,
                componentType: selectedItem.componentType,
                consumedQuantity: {
                    value: selectedItem.consumedQuantity.value
                },
                baseUoM: selectedItem.baseUoM,
                description: selectedItem.description,
                plannedBatchNumber: selectedItem.plannedBatchNumber,
                enteredStorageLoc: defaultStorageLocation,
                materialId: {
                    material: selectedItem.materialId.material,
                    ref: selectedItem.materialId.ref
                },
                value: "",
                unitList: selectedItem.unitList,
                selectedUoM: selectedItem.selectedUoM,
                postingDateTime: selectedItem.postingDateTime,
                customFieldValue: "",
                customFieldJson: [],
                focusedDateTime: selectedItem.focusedDateTime,
                postedBy: selectedItem.postedBy,
                isBomComponent: selectedItem.isBomComponent,
                materialType: selectedItem.materialType
            };
            if (selectedItem.isAddMaterial) {
                emptyObj.actionBtnVisible = true;
                emptyObj.removeEnabled = false;
                emptyObj.rowStatus = "None";
            } else {
                emptyObj.actionBtnVisible = false;
                emptyObj.removeEnabled = true;
                emptyObj.rowStatus = "None";
            }
            if (selectedItem.enteredBatchNumber === this.oController.getI18nText("notBatchManaged"))
                emptyObj.enteredBatchNumber = this.oController.getI18nText("notBatchManaged");
            else
                emptyObj.enteredBatchNumber = "";

            if (selectedIndex !== undefined)
                matConsSummaryArr.splice(selectedIndex + 1, 0, emptyObj);
            else
                matConsSummaryArr.splice(matConsSummaryArr.length, 0, emptyObj);

            oModel.getData().lineItems = matConsSummaryArr;
            oModel.refresh();
            MessageToast.show(this.oController.getI18nText("nonBOMComponentAddedInMaterialConsumtionTable.msg"));
        },

        getNumberOfRowsForMatCons: function(matConsData, material) {
            var tempArr = [];
            tempArr = matConsData.lineItems.filter(function(obj) {
                return obj.materialId.material === material;
            })
            return tempArr.length;
        },

        onPressRemove: function(oEvent) {
            var selectedIndex = parseInt(oEvent.getSource().getBindingContext("matConsModel").getPath().substr(11));
            var matConsSummaryArr = oEvent.getSource().getModel("matConsModel").getData().lineItems;
            matConsSummaryArr.splice(selectedIndex, 1);
            oEvent.getSource().getModel("matConsModel").getData().lineItems = matConsSummaryArr;
            oEvent.getSource().getModel("matConsModel").refresh();
            this.MaterialComponents.enableConfirmButton();
        },

        handleChangeDateTime: function(oEvent) {
            var inputPostingDate = oEvent.getSource().getValue();
            var oModel = oEvent.getSource().getModel("matConsModel");
            var selectedPath = oEvent.getSource().getBindingContext("matConsModel").getPath();
            var saveBtn = this.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];

            ErrorHandler.clearErrorState(oEvent.getSource());
            saveBtn.setEnabled(false);
            if (inputPostingDate > this.getCurrentDateTimeInPlantTimeZone()) {
                ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText("process.postingDate.msg"));
                oEvent.getSource().setValueStateText(this.getI18nText("process.postingDate.msg"));
                this.MaterialComponents.highlightRow(oEvent.getSource());
            } else {
                ErrorHandler.clearErrorState(oEvent.getSource());
                oModel.setProperty(selectedPath + "/postingDateTime", oEvent.getSource().getValue());
                this.MaterialComponents.highlightRow(oEvent.getSource());
                this.MaterialComponents.enableConfirmButton();
            }
        },

        handleSelectChange: function(oEvent) {
            var oModel = oEvent.getSource().getModel("matConsModel");
            var selectedPath = oEvent.getSource().getBindingContext("matConsModel").getPath();
            var selectedUoM = oEvent.getSource().getList().getSelectedItem().getBindingContext("matConsModel").getObject().uom;
            oModel.setProperty(selectedPath + "/selectedUoM", selectedUoM);
        },

        onSaveBtnPress: function(oEvent) {
            // Use arrays to store sloc and avlQty so that they can be fetched for failed records
            this.MaterialComponents.sLocArr = [];
            this.MaterialComponents.avlBatchQtyArr = [];
            var isError = false;
            var oTableControl = oEvent.getSource().getParent().getParent();
            var matConsData = oTableControl.getModel("matConsModel").getData();
            var that = this;
            var postPayload = {
                componentList: []
            };
            matConsData.lineItems.forEach(function(matConsSummary, rowId) {
                if(oTableControl.getItems()[rowId].getCells()[6].getValueState() === "Error" ){
                    isError = true;
                    that.MaterialComponents.highlightRow(oTableControl.getItems()[rowId].getCells()[6]);
                    that.MaterialComponents.enableConfirmButton();
                    return;
                }
                if(oTableControl.getItems()[rowId].getCells()[6].getValue() === ""){
                    that.MaterialComponents.highlightRow(oTableControl.getItems()[rowId].getCells()[6]);
                    that.MaterialComponents.enableConfirmButton();
                    return;
                }

                if (oTableControl.getItems()[rowId].getCells()[6].getValueState() === "Information") {
                    oTableControl.getItems()[rowId].getCells()[6].setValueState("None");
                }

                if (matConsSummary.rowStatus === "None") {
                    return;
                }
                var selectedInternalUoM = oTableControl.getItems()[rowId].getCells()[7].getSelectedItem().getBindingContext("matConsModel").getObject().internalUom;

                var obj = {
                    "itemId": rowId,
                    "shopOrder": that.MaterialComponents.orderData.order,
                    "batchId": that.MaterialComponents.orderData.sfc,
                    "operationActivity": that.MaterialComponents.oSectionData.phaseId,
                    "workCenter": that.MaterialComponents.oSectionData.workCenter.workcenter,
                    "bomComponentRef": matConsSummary.bomComponentRef,
                    "material": matConsSummary.materialId.material,
                    "materialType": matConsSummary.materialType,
                    "batchNumber": (matConsSummary.enteredBatchNumber === that.getI18nText("notBatchManaged")) ? null : matConsSummary.enteredBatchNumber,
                    "storageLocation": matConsSummary.enteredStorageLoc,
                    "isInventoryManaged": that.isInventoryManaged,
                    "shopOrderLocationRef": (!matConsSummary.shopOrderLocationRef) ? null : matConsSummary.shopOrderLocationRef,
                    "inventory": (!matConsSummary.inventory || matConsSummary.materialType === "PIPELINE") ? null : matConsSummary.inventory,
                    "isBomComponent": matConsSummary.isBomComponent,
                    "quantity": {
                        "value": matConsSummary.value,
                        "unitOfMeasure": {
                            "uom": selectedInternalUoM,
                            "internalUom": selectedInternalUoM,
                            "shortText": "",
                            "longText": "",
                            "numerator": "",
                            "denominator": ""
                        }
                    },
                    "userId": matConsSummary.postedBy,
                    "dateTime": matConsSummary.postingDateTime,
                    "customFieldData": (matConsSummary.customFieldJson && matConsSummary.customFieldJson.length >0) ? JSON.stringify(matConsSummary.customFieldJson) : null,
                    "comments": ""
                };
                postPayload.componentList.push(obj);
                that.MaterialComponents.sLocArr.push(matConsSummary.enteredStorageLoc);
                that.MaterialComponents.avlBatchQtyArr.push(matConsSummary.avlBatchQty);
            });
            if(postPayload && postPayload.componentList.length > 0 && isError === false){
                this.MaterialComponents.checkThresholdAndProceed(postPayload);
            }
        },

        checkThresholdAndProceed: function(postPayload) {

            var totalQuantityToBeConsumed = [];

            for (var i = 0; i < this.actualItemSummary.length; i++) {
                var temp = {};
                temp.upperThresholdValue = this.actualItemSummary[i].upperThresholdValue;
                if (temp.upperThresholdValue) {
                    temp.totalValue = (this.actualItemSummary[i].consumedQuantity.value) ? this.actualItemSummary[i].consumedQuantity.value : 0;
                    for (var k = 0; k < postPayload.componentList.length; k++) {
                        if (this.actualItemSummary[i].materialId.material === postPayload.componentList[k].material) {
                            var fraction = this.getNumeratorAndDenominator(postPayload.componentList[k].material, postPayload.componentList[k].quantity.unitOfMeasure.uom);
                            var quantityToBeConsumed = parseFloat(postPayload.componentList[k].quantity.value) * (fraction.numerator / fraction.denominator);
                            temp.totalValue = temp.totalValue + quantityToBeConsumed;
                            temp.material = this.actualItemSummary[i].materialId.material;
                        }
                    }
                    if (temp.material) {
                        totalQuantityToBeConsumed.push(temp);
                    }
                }
            }

            this.checkBeforeThrowingWarning(totalQuantityToBeConsumed, postPayload);
        },

        checkBeforeThrowingWarning: function(totalQuantityToBeConsumed, postPayload) {
            if (totalQuantityToBeConsumed.length > 0)
                this.throwWarningsIfThresholdExceed(totalQuantityToBeConsumed, postPayload);
            else
                this.postGiData(postPayload);
        },

        throwWarningsIfThresholdExceed: function(totalQuantityToBeConsumed, postPayload) {

            var materialText = "";
            for (var i = 0; i < totalQuantityToBeConsumed.length; i++) {
                if (totalQuantityToBeConsumed[i].totalValue > totalQuantityToBeConsumed[i].upperThresholdValue) {
                    materialText = materialText + totalQuantityToBeConsumed[i].material + ",";
                }
            }

            if (materialText) {
                materialText = materialText.substring(0, materialText.length - 1);
                this.confirmPageLeave(materialText, function() {
                    this.postGiData(postPayload);
                }.bind(this));
            } else {
                this.postGiData(postPayload);
            }

        },

        postGiData: function(postPayload) {

            this.saveBtn = this.oController.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            this.saveBtn.setEnabled(false);
            this.oController.materialComponentsSubSection.setBusy(true);
            var assemblyUrl = this.oController.getAssemblyDataSourceUri();
            var sUrl = assemblyUrl + "order/goodsIssue/batchconfirm";

            AjaxUtil.post(
                sUrl, postPayload,
                function(oResponse) {
                    this.handleErrors(oResponse, postPayload) ? MessageBox.error(this.oController.getI18nText("goodsIssuePostingError.msg")):
                     MessageToast.show(this.oController.getI18nText("goodsIssuePostingSuccess.msg"));
                    this.getGiMaterialData(true);
                }.bind(this),
                function(oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                    this.oController.materialComponentsSubSection.setBusy(false);
                    this.saveBtn.setEnabled(true);
                }.bind(this)
            );

        },

        handleErrors: function(oResponse, postPayload) {
            this.failedRows = [];
            var errorFlag = false;
            oResponse.forEach(function(response) {
                if (response.statusCode !== "200") {
                    errorFlag = true;
                    var errorMsg = (response.batchNumber) ?
                        this.oController.getI18nText("goodsIssuePostingErrorTitle.msg", [response.material, response.batchNumber, response.inventory, response.quantity.value + response.quantity.unitOfMeasure.uom, response.userId, this.oController.DateTimeUtils.formatDateTime(response.dateTime)]) :
                        this.oController.getI18nText("goodsIssuePostingErrorTitleNonBatch.msg", [response.material, response.inventory, response.quantity.value + response.quantity.unitOfMeasure.uom, response.userId, this.oController.DateTimeUtils.formatDateTime(response.dateTime)]);

                    this.oController.addMessage(MessageType.Error, errorMsg, response.errorMessage, response.errorMessage);
                    postPayload.componentList[response.itemId].enteredStorageLoc = this.sLocArr[response.itemId];
                    postPayload.componentList[response.itemId].avlBatchQty = this.avlBatchQtyArr[response.itemId];
                    this.failedRows.push(postPayload.componentList[response.itemId]);
                }
            }.bind(this));
            return errorFlag;
        },


        confirmPageLeave: function(materialText, fnProceed, fnCancel) {

            this._showMessageBox(materialText, function(bProceed) {
                if (bProceed) {
                    fnProceed();
                } else if (fnCancel) {
                    fnCancel();
                }
            });

        },

        _showMessageBox: function(materialText, fnCallback) {
            var oWarningMsg = this.getOverConsumptionWarningMessage(materialText);
            MessageBox.warning(oWarningMsg.message, {
                styleClass: "sapUiSizeCompact",
                actions: [oWarningMsg.button, MessageBox.Action.CANCEL],
                onClose: function(oAction) {
                    fnCallback(oAction === oWarningMsg.button);
                }
            });
        },

        /***
         * Returns the Unsaved Warning Message
         * @returns
         */
        getOverConsumptionWarningMessage: function(materialText) {
            var sWarningMsg = this.oController.getI18nText("process.threshold.msg", materialText);
            return {
                message: sWarningMsg,
                button: this.oController.getI18nText("process.proceed.button")
            };
        },

        getNumeratorAndDenominator: function(material, selectedUom) {

            var fraction = {};
            var currentUoms;
            if (this.alternateUomForSelectedMaterial[material]) {
                currentUoms = this.alternateUomForSelectedMaterial[material];
                for (var i = 0; i < currentUoms.length; i++) {
                    if (currentUoms[i].uom === selectedUom) {
                        fraction.numerator = currentUoms[i].numerator;
                        fraction.denominator = currentUoms[i].denominator;
                        break;
                    }
                }
            } else {
                fraction.numerator = 1;
                fraction.denominator = 1;
            }
            return fraction;
        },

        onClearBtnPress: function(oEvent) {
            MessageBox.warning(this.getI18nText("materialComponentsClearFields.confirm"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function(sAction) {
                    if (sAction === "OK") {
                        this.MaterialComponents.clearFields(this);
                        var saveBtn = this.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
                        saveBtn.setEnabled(false);
                    }
                }.bind(this)
            });
        },

        clearFields: function(that) {
            var matConsModel = that.materialComponentsSubSection.getBlocks()[0].getModel("matConsModel");
            var matConsData = matConsModel.getData();
            var initialPath = "/lineItems/"
            for (var i = 0; i < matConsData.lineItems.length; i++) {
                if (matConsData.lineItems[i].enteredBatchNumber !== "")
                    matConsModel.setProperty(initialPath + i + "/enteredStorageLoc", "");
                if (matConsData.lineItems[i].enteredBatchNumber !== this.oController.getI18nText("notBatchManaged"))
                    matConsModel.setProperty(initialPath + i + "/enteredBatchNumber", "");
                matConsModel.setProperty(initialPath + i + "/inventory", "");
                matConsModel.setProperty(initialPath + i + "/avlBatchQty", "");
                matConsModel.setProperty(initialPath + i + "/shopOrderLocationRef", "");
                matConsModel.setProperty(initialPath + i + "/value", "");
                matConsModel.setProperty(initialPath + i + "/postedBy", this.oController.oReportInfoModel.getProperty("/selectedUser"));
                matConsModel.setProperty(initialPath + i + "/postingDateTime", this.oController.oReportInfoModel.getProperty("/selectedTime"));
                matConsModel.setProperty(initialPath + i + "/customFieldValue", "");
                matConsModel.setProperty(initialPath + i + "/customFieldJson", []);
                matConsModel.setProperty(initialPath + i + "/selectedUoM", matConsData.lineItems[i].baseUoM);
                matConsModel.setProperty(initialPath + i + "/rowStatus", "None");
            }
            //Reset proposed quantity's Information state
            //If the quantity value was filled via Proposal, the state will be changed to Information.
            //This has to be overridden on Clear.
            this.resetProposalStatus(that.materialComponentsSubSection.getBlocks()[0]);

        },

        onValueChange: function(oEvent) {
            var inputField = oEvent.getSource();
            //Add as part of the Material Consumption Proposal:
            //If the quantity value was filled via Proposal, the state will be changed to Information.
            //This Information state has to be overridden when the user manually enters a value.
            if(inputField.getValueState() === "Error"){
                inputField.setValueState("None");
            }
            // Adding explicit delay because of parallel validation of qty fields
            setTimeout(function() {
                this.MaterialComponents.highlightRow(inputField);
                this.MaterialComponents.enableConfirmButton();
            }.bind(this), 500);
        },

        highlightRow: function(oSource) {
            var isErrorStateExist = false;
            var matConsData = oSource.getModel("matConsModel").getData();
            var selectedIndex = parseInt(oSource.getBindingContext("matConsModel").getPath().substr(11));
            var selectedItem = matConsData.lineItems[selectedIndex];
            var cells = oSource.getParent().getCells();
            for (var i = 0; i < cells.length; i++) {
                if (cells[i].getValueState && cells[i].getValueState() === "Error") {
                    oSource.getParent().setHighlight("Error");
                    isErrorStateExist = true;
                    break;
                }
            }
            if (!isErrorStateExist) {
                if ((selectedItem.enteredBatchNumber && selectedItem.avlBatchQty && selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value) ||
                    (selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value && selectedItem.materialType === "PIPELINE"))
                    oSource.getParent().setHighlight("Success");
                else
                    oSource.getParent().setHighlight("None");
            }
        },

        enableConfirmButton: function() {
            var partialDataEnteredRow = 0;
            var validRowExist = false;
            var errorRowExist = false;
            var saveBtn = this.oController.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            var oTableContent = this.oController.materialComponentsSubSection.getBlocks()[0].getItems();
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

        validatePositiveNumber: function(sInputValue) {
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

        showStorageLocDialog: function(oEvent) {
            var storageLocControl = oEvent.getSource();
            var oModel = storageLocControl.getModel("matConsModel");
            var matConsData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("matConsModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = matConsData.lineItems[selectedIndex];
            var isBatchManaged = !(!selectedItem.batchManaged || selectedItem.batchManaged === "NONE");
            var showQuantity = this.isInventoryManaged || !isBatchManaged;
            var oView = this.getView();
            oView.getModel("invManagedModel").setProperty("/showQuantity", showQuantity);
            this.StorageLocationDialog.setController(this);
            this.StorageLocationDialog.showStorageLocationDetails({
                    materialId: selectedItem.materialId,
                    storageLocation: (selectedItem.enteredStorageLoc && selectedItem.enteredStorageLoc.length > 0) ? selectedItem.enteredStorageLoc : (selectedItem.storageLocation && selectedItem.storageLocation.storageLocation || null)
                },
                function (sLocData) {
                    if (this.isInventoryManaged || (!this.isInventoryManaged && !isBatchManaged)) {
                        if (sLocData.unitOfMeasure) {
                            oModel.setProperty(selectedPath + "/avlBatchQty", this.formatter.showValue(sLocData.remainingQuantity, sLocData.unitOfMeasure.uom));
                        } else {
                            oModel.setProperty(selectedPath + "/avlBatchQty", this.formatter.showValue(sLocData.remainingQuantity));
                        }
                    } else {
                        oModel.setProperty(selectedPath + "/avlBatchQty", "");
                    }
                    oModel.setProperty(selectedPath + "/enteredStorageLoc", (sLocData.storageLocation ? sLocData.storageLocation.storageLocation : ""));
                    oModel.setProperty(selectedPath + "/inventory", sLocData.inventoryId);
                    this.MaterialComponents.highlightRow(storageLocControl);
                    this.MaterialComponents.enableConfirmButton();
                }.bind(this));
        },

        onViewPostsBtnPress: function(oEvent) {

            var postButton = oEvent.getSource();
            var oModel = postButton.getModel("matConsModel");
            var matConsData = oModel.getData();
            var selectedPath = postButton.getBindingContext("matConsModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = matConsData.lineItems[selectedIndex];

            var oParameters = {};
            var batchManaged = selectedItem.batchManaged;
            oParameters.shopOrder = this.MaterialComponents.orderData.order;
            oParameters.batchId = this.MaterialComponents.orderData.sfc;
            oParameters.operationActivity = this.MaterialComponents.oSectionData.phaseId;
            oParameters.bomComponentRef = selectedItem.bomComponentRef;
            oParameters.material = selectedItem.materialId.material;
            oParameters.isNonBOMComponent = !selectedItem.isBomComponent;
            oParameters.page = 1;
            oParameters.size = 40;
            oParameters.sort = "createdDateTime,desc";

            this.MaterialComponentsPostingDialog.rowData = selectedItem;
            this.MaterialComponentsPostingDialog.setController(this);
            this.MaterialComponentsPostingDialog.showDetailsOfComponent(oParameters, batchManaged);
        },

        onAddNonBomMaterial: function(oEvent) {
            var matConsModel = oEvent.getSource().getParent().getParent().getModel("matConsModel");
            var oMaterialNoField = oEvent.getSource();
            var flag = true;
            var that = this;
            MaterialBrowse.open(oMaterialNoField, "", function(oSelectedObject) {
                that.materialComponentsSubSection.setBusy(true);
                if (that.MaterialComponents.coAndByProducts.length > 0) {
                    that.MaterialComponents.coAndByProducts.forEach(function(e) {
                        if (e === oSelectedObject.material) {
                            flag = false;
                            that.showErrorMessage(that.getI18nText("consumeWarningForCoBy"));
                        }
                    })
                }
                if (flag)
                    that.MaterialComponents.setPostMaterialSelectionDetails(oSelectedObject, matConsModel);
                else
                    that.materialComponentsSubSection.setBusy(false);
            });
        },

        setPostMaterialSelectionDetails: function(oMaterial, matConsModel) {

            var selectedMaterialRef = oMaterial.ref;
            var selectedMaterial = oMaterial.material;
            var selectedMaterialVersion = oMaterial.version;
            //check if component is already present
            for (var i = 0; i < this.actualItemSummary.length; i++) {
                if (this.actualItemSummary[i].materialId.ref === selectedMaterialRef) {
                    MessageToast.show(this.oController.getI18nText("goodsIssueAddNonBom.componentAlreadyExist", selectedMaterial));
                    this.oController.materialComponentsSubSection.setBusy(false);
                    return;
                }
            }

            var selectedMaterialDetails = {};
            selectedMaterialDetails.batchManaged = (oMaterial.incrementBatchNumber === undefined || oMaterial.incrementBatchNumber === "NONE") ? false : true;
            selectedMaterialDetails.bomComponentRef = null;
            selectedMaterialDetails.consumedQuantity = {
                    value: ""
                },
                selectedMaterialDetails.description = oMaterial.description;
            selectedMaterialDetails.materialId = {
                    material: oMaterial.material,
                    ref: oMaterial.ref
                },
                selectedMaterialDetails.baseUoM = oMaterial.unitOfMeasure;
            selectedMaterialDetails.selectedUoM = oMaterial.unitOfMeasure;
            selectedMaterialDetails.postingDateTime = this.oController.oReportInfoModel.getProperty("/selectedTime");
            selectedMaterialDetails.postedBy = this.oController.oReportInfoModel.getProperty("/selectedUser");
            selectedMaterialDetails.isBomComponent = false;
            selectedMaterialDetails.materialType = oMaterial.materialType;
            selectedMaterialDetails.isAddMaterial = true;
            if (!selectedMaterialDetails.batchManaged)
                selectedMaterialDetails.enteredBatchNumber = this.oController.getI18nText("notBatchManaged");
            else
                selectedMaterialDetails.enteredBatchNumber = "";

            if (!this.alternateUomForSelectedMaterial) {
                this.alternateUomForSelectedMaterial = {};
            }

            this.getAlternateUoms(this.alternateUomForSelectedMaterial, selectedMaterial, selectedMaterialRef, selectedMaterialVersion, matConsModel, selectedMaterialDetails, matConsModel.getData().lineItems);
        },

        showBatchDialog: function(oEvent) {
            var batchControl = oEvent.getSource();
            var oModel = batchControl.getModel("matConsModel");
            var matConsData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("matConsModel").getPath();
            var selectedIndex = selectedPath.substr(11);
            var selectedItem = matConsData.lineItems[selectedIndex];
            this.BatchDialog.setController(this);
            this.BatchDialog.showBatchDetails(selectedItem, this.MaterialComponents.orderData.orderRef, function(oBatchData) {
                this.MaterialComponents.setValueToSLoc(oModel, selectedPath, oBatchData);
                oModel.setProperty(selectedPath + "/enteredBatchNumber", oBatchData.batchNumber);
                oModel.setProperty(selectedPath + "/inventory", oBatchData.inventoryId);
                oModel.setProperty(selectedPath + "/avlBatchQty", oBatchData.remainingQuantity);
                oModel.setProperty(selectedPath + "/shopOrderLocationRef", oBatchData.shopOrderLocRef);
                this.MaterialComponents.highlightRow(batchControl);
                this.MaterialComponents.enableConfirmButton();
            }.bind(this));
        },

        onCustomFieldLiveChange : function(oEvent){
            var customField =  oEvent.getSource();
            var oModel = customField.getModel("matConsModel");
            var selectedPath = customField.getBindingContext("matConsModel").getPath();
            var saveBtn = this.materialComponentsSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            var customFieldData = customField.getValue();
            oModel.setProperty(selectedPath + "/customFieldValue", customFieldData);
            ErrorHandler.clearErrorState(customField);
            if (this.MaterialComponents.validateInputRegEx(customFieldData)) {
                var customFieldJson = this.utils.buildCustomFieldData(customFieldData);
                oModel.setProperty(selectedPath + "/customFieldJson", customFieldJson);
                this.MaterialComponents.highlightRow(customField);
                this.MaterialComponents.enableConfirmButton();
            }else{
                ErrorHandler.setErrorState(customField, this.getI18nText("INVALID_INPUT"));
                this.MaterialComponents.highlightRow(customField);
            }
        },
        enableAddButton: function (bBackFlushEnabled, aSequence) {
            const bIsVisible = Formatter.addButtonVisible(aSequence, "MaterialConsumption");
            if (bIsVisible) {
                return !bBackFlushEnabled;
            }
            return bIsVisible;
        },
        calculateConsumables: function (oEvent, oQuantityModel) {
            const oController = this.oController;
            const oMaterialComponent = oController.MaterialComponents;
            const aItems = oQuantityModel.getData() && oQuantityModel.getData().quantSummary || [];
            const oOrderData = oMaterialComponent.orderData;
            const oPhaseDetails = oController.phaseDetailsSubSection.getModel('phaseDetails').getData();

            const sCalculateUrl = oController.getAssemblyDataSourceUri() + "order/goodsIssue/calculate";
            const oCalculatePayload = {
                "shopOrder": oOrderData.order,
                "operationActivity": oPhaseDetails.operation,
                "sfcId": oOrderData.sfc,
                "materialId": {
                    "ref": oOrderData.material.ref,
                    "plant": "",
                    "material": oOrderData.material.material,
                    "version": oOrderData.material.version
                },
                "routingId": oOrderData.routing,
                "stepId": oPhaseDetails.stepId,
                "shopOrderPlannedQuantityInBaseUom": {
                    "value": parseFloat(oOrderData.plannedQty),
                    "unitOfMeasure": {
                        "uom": oOrderData.baseInternalUom
                    }
                },
                "bomRef": oOrderData.bomRef,
                "goodsIssueCalculateItems": []
            };
            aItems.forEach(item => {
                oCalculatePayload.goodsIssueCalculateItems.push({
                    "toBeConsumedQuantity": {
                        "value": parseFloat(item.value),
                        "unitOfMeasure": {
                            "uom": item.selectedUoM
                        }
                    }
                });
            });
            this.oController.materialComponentsSubSection.setBusy(true);
            this.resetProposalStatus(this.oController.materialComponentsSubSection.getBlocks()[0]);
            AjaxUtil.post(sCalculateUrl, oCalculatePayload, oMaterialComponent.handleCalculatePayload.bind(this),
                function (oError, oHttpErrorMessage) {
                    this.oController.materialComponentsSubSection.setBusy(false);
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                }.bind(this));

        },

        handleCalculatePayload: function (oResponseData) {
            var that = this;
            let oMatConsModelData = this.oController.materialComponentsSubSection.getModel('matConsModel').getData();
            let oMatConsModelDataItems = oMatConsModelData.lineItems;
            let aMaterialAlreadyModifiedMap = [];
            let aMaterialAlreadyModified = [];
            let aErredIndexes = [];
            /*
            If the user has already added multiple rows to the Material Consumption Table, remove all the duplicate rows
            for each material. To this single row for each material, the proposed quantity is populated.
             */
            oMatConsModelDataItems.forEach((material, iRowIndex) => {
                if (!aMaterialAlreadyModifiedMap.includes(material.materialId.ref)) {
                    const oMatchedResponse = oResponseData.find(responseItem => (material.materialId.ref === responseItem.material && !material.backflushEnabled));
                    if(oMatchedResponse) {
                        let oQuantity;
                        if (oMatchedResponse.entryUomQuantity && oMatchedResponse.entryUomQuantity.value && this.isUomInUnitList(oMatchedResponse.entryUomQuantity.unitOfMeasure.uom, material.unitList)) {
                            oQuantity = oMatchedResponse.entryUomQuantity;
                        } else {
                            oQuantity = oMatchedResponse.baseUomQuantity;
                        }
                        let isValid = that.checkValidQuantity(oQuantity.value, oQuantity.unitOfMeasure.uom);
                        if (!isValid) {
                            let sErrorMessage = this.oController.getI18nText("goodsReceipt.proposal.invalidQuantityProposed", [oQuantity.value, oQuantity.unitOfMeasure.uom, material.description]);
                            that.oController.showErrorMessage(sErrorMessage, true, true);
                            aErredIndexes.push(iRowIndex);
                        }
                        material.value = oQuantity.value;
                        material.selectedUoM = oQuantity.unitOfMeasure.uom;
                    }
                    aMaterialAlreadyModifiedMap.push(material.materialId.ref);
                    aMaterialAlreadyModified.push(material);
                }
            });
            oMatConsModelData.items = aMaterialAlreadyModified;
            oMatConsModelData.lineItems = aMaterialAlreadyModified;
            this.oController.materialComponentsSubSection.getModel('matConsModel').setData(oMatConsModelData);

            this.oController.MaterialComponents.highlightAllRows(this.oController.materialComponentsSubSection, aErredIndexes);
            this.oController.MaterialComponents.enableConfirmButton();
            this.oController.materialComponentsSubSection.setBusy(false);
        },

        highlightAllRows: function (oSource, aErredIndexes) {
            let bIsErrorStateExist = false;
            let matConsData = oSource.getModel("matConsModel").getData();
            oSource.getBlocks()[0].getItems().forEach((rowItem, iRowIndex) => {
                let selectedItem = matConsData.items[iRowIndex];
                let cells = rowItem.getCells();
                for (let i = 0; i < cells.length; i++) {
                    if (cells[i].getValueState && cells[i].getValueState() === "Error") {
                        oSource.getParent().setHighlight("Error");
                        bIsErrorStateExist = true;
                        break;
                    }
                    /*Add as part of the Material Consumption Proposal: If the quantity value was filled via Proposal, the state will be changed to Information.
                    This Information state has to be overridden when the user manually enters a value.*/
                    if (i === 6 && !aErredIndexes.includes(iRowIndex) && ![null, undefined, ''].includes(selectedItem.value)
                        && (selectedItem.bomComponentRef && selectedItem.bomComponentRef !== '')) {
                        cells[i].setValueState("Information");
                    } else if (i === 6 && aErredIndexes.includes(iRowIndex) && ![null, undefined, ''].includes(selectedItem.value)
                        && (selectedItem.bomComponentRef && selectedItem.bomComponentRef !== '')) {
                        cells[i].setValueState("Error");
                        bIsErrorStateExist = true;
                    }
                }
                if (!bIsErrorStateExist) {
                    if ((selectedItem.enteredBatchNumber && selectedItem.avlBatchQty && selectedItem.postedBy
                            && selectedItem.postingDateTime && selectedItem.value)
                        || (selectedItem.postedBy && selectedItem.postingDateTime && selectedItem.value
                            && selectedItem.materialType === "PIPELINE")) {
                        rowItem.setHighlight("Success");
                    } else {
                        rowItem.setHighlight("None");
                    }
                } else if (bIsErrorStateExist) {
                    rowItem.setHighlight("Error");
                }
            });
        },
        isUomInUnitList: function (sUom, aUnitList) {
            // There are chances that the UOM is there as Entry Uom in Bom Components, but it is not there in list of UOMs fetched for the material.
            return aUnitList.find(unit => unit.uom === sUom) !== undefined;
        },
        resetProposalStatus: function (oQuantityConfirmationTable) {
            oQuantityConfirmationTable && oQuantityConfirmationTable.getItems() && oQuantityConfirmationTable.getItems().forEach(item => {
                let oQuantityCell = item.getCells()[6];
                oQuantityCell.setValueState("None");
            });
        },
        checkValidQuantity: function (value, uom) {
            const oQuantityType = new QuantityType();
            try {
                oQuantityType.validateValue(['' + value, uom]);
            } catch (e) {
                //If the quantity does not match for the Uom
                return false;
            }
            return true;
        }
    }
});