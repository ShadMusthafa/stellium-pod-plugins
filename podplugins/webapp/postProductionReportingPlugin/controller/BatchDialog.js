sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "stellium/ext/podplugins/postProductionReportingPlugin/controller/StorageLocationBrowse"
], function(JSONModel, AjaxUtil, Fragment, Filter, FilterOperator, StorageLocationBrowse) {
    "use strict";

    return {

        setController: function(sController) {
            this.oController = sController;
        },

        showBatchDetails: function(item, shopOrderRef, fnPostSelectioncallback) {
            this.fnPostSelectioncallback = fnPostSelectioncallback;
            this.selectedItem = item;
            var oView = this.oController.getView();
            this.characteristicsColumns = [];
            this.multiStorLocs = [];
            this.itemText = this.oController.getI18nText("process.items");
            this.oPageable = this.oPageable || {};
            this.oPageable.page = 0;
            this.totalPaginationElems = null;
            if (!this.oController.byId("batchDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.BatchDialog",
                    controller: this
                }).then(function(oDialog) {
                    oDialog.setEscapeHandler(function(oPromise) {
                        this.onCloseBatchDialog();
                        oPromise.resolve();
                    }.bind(this));
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.onAfterRenderingBatchDialog(item, shopOrderRef);
                }.bind(this));
            } else {
                this.oController.byId("batchDialog").open();
                this.onAfterRenderingBatchDialog(item, shopOrderRef);
            }
        },

        onAfterRenderingBatchDialog: function(item, shopOrderRef) {
            var that = this;
            this.oController.byId("batchDialog").setTitle(this.oController.getI18nText("batchDialogHeaderWithMat", item.materialId.material));
            setTimeout(function() {
                that.fetchBatchDetails(item, shopOrderRef);
            }, 125);
        },

        fetchBatchDetails: function(item, shopOrderRef) {
            var inventryUrl = this.oController.getInventoryDataSourceUri();
            var oParameters = {};
            var sUrl;
            if (this.oController.isInventoryManaged) {
                oParameters.materialRef = item.materialId.ref;
                oParameters.shopOrderRef = shopOrderRef;
                oParameters.emptyBatchNumberIgnored = true;
                sUrl = inventryUrl + "inventory/findInventory";
                this.getBatchDetailsForPopup(sUrl, oParameters);
            } else if(!item.enteredStorageLoc || item.enteredStorageLoc === "") {
                this.characteristicsColumns = [];
                this.createBatchTable([]);
            } else {
                this.oPageable = {};
                this.oPageable.page = 0;
                oParameters = this.prepareInvStockParams(item);
                var storLocs = [];
                storLocs.push(item.enteredStorageLoc);
                this.multiStorLocs = storLocs;
                oParameters.storageLocations = storLocs.join(',');
                sUrl = inventryUrl + "inventory/inventoryStock";
                this.getBatchDetailsForPopup(sUrl, oParameters);
            }
        },

        prepareInvStockParams: function(item) {
            var oParameters = {};
            oParameters.material = item.materialId.material;
            oParameters.inventoryStockType = "01";
            oParameters.showCharacteristics = true;
            oParameters.pageSize = 20;
            oParameters.pageNumber = this.oPageable.page;
            return oParameters;
        },

        queryNextPageList: function(oEvent) {
            if (oEvent.getParameters().reason === "Growing" && this.totalPaginationElems > (this.oPageable.page+1)*20) {
                var oDialog = this.oController.byId("batchDialog");
                this.oPageable.page++;
                var oParameters = this.prepareInvStockParams(this.selectedItem);
                oParameters.storageLocations = this.multiStorLocs.join(',');
                var sUrl = this.oController.getInventoryDataSourceUri() + "inventory/inventoryStock";
                this.doInvStockApiCall(oDialog, sUrl, oParameters, true);
            }
        },

        doInvStockApiCall: function(oDialog, sUrl, oParameters, isGrowing) {
            var that = this;
            oDialog.setBusy(true);
            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                var oData = oResponseData.content;
                that.prepareStockData(oData);
                that.batchDetailsList = isGrowing ? that.batchDetailsList.concat(oData) : oData;
                that.totalPaginationElems = oResponseData.totalElements;
                that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
                that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
                that.prepareData(that.batchDetailsList);
                that.batchDetailsModel.setData(that.batchDetailsList);
                that.setDataInBatchTable(that.batchDetailsList);
                that.onSearchBatchListWithValue("");
                oDialog.setBusy(false);
            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                oDialog.setBusy(false);
                that.onCloseBatchDialog();
                that.showErrorMessage(err, true, true);
                that.batchDetailsList = {};
            });
        },

        getBatchDetailsForPopup: function(sUrl, oParameters) {
            var that = this;
            var oDialog = that.oController.byId("batchDialog");
            oDialog.setBusy(true);
            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                that.batchDetailsList = oResponseData;
                if (!that.oController.isInventoryManaged) {
                    that.batchDetailsList = oResponseData.content;
                    that.totalPaginationElems = oResponseData.totalElements;
                    that.prepareStockData(that.batchDetailsList);
                }
                that.batchDetailsModel = new JSONModel();
                that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
                //find max 5 characteristics sorted alphanumerically on the basis of characteristics name.
                that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
                that.batchDetailsModel.setData(that.batchDetailsList);
                //Create table dynamically where characteristics values along with batchId, quantity,
                //storage location and expiry date will be shown.
                that.createBatchTable(that.batchDetailsList);
                that.oController.byId("batchDialog").setBusy(false);
            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                oDialog.setBusy(false);
                oDialog.close();
                that.oController.showErrorMessage(err, true, true);
                that.batchDetailsList = {};
            });
        },

        findCharacteristicsToBeShown: function(oData) {

            this.characteristicsColumns = [];
            for (var i = 0; i < oData.length; i++) {
                if (oData[i].batchCharcValues && oData[i].batchCharcValues.length !== 0) {
                    for (var j = 0; j < oData[i].batchCharcValues.length; j++) {
                        //To check whether the characterisctic is already present in the array
                        if (!this.isCharacteristicAlreadyPresent(oData[i].batchCharcValues[j].charcName)) {
                            var characteristic = {};
                            characteristic.name = oData[i].batchCharcValues[j].charcName;
                            characteristic.desc = oData[i].batchCharcValues[j].charcDesc;
                            characteristic.dataType = oData[i].batchCharcValues[j].dataType;
                            this.characteristicsColumns.push(characteristic);
                        }
                    }
                }
            }
            //Sort alphanumerically in ascending order.
            this.characteristicsColumns.sort(function(a, b) {
                if (a.name < b.name) {
                    return -1;
                }
                if (a.name > b.name) {
                    return 1;
                }
                return 0;
            })
            //Filter only first 5 characteristics to be shown in the table.
            this.characteristicsColumns = this.characteristicsColumns.slice(0, 5);
            //Build characteristics data to set it to a model.
            oData = this.setCharacteristicsDetails(oData);
            return oData;

        },

        isCharacteristicAlreadyPresent: function(charcName) {

            var isPresent = this.characteristicsColumns.find(function(charcDetails) {
                return charcDetails.name === charcName;
            });

            if (isPresent)
                return true;

            return false;
        },

        setCharacteristicsDetails: function(oData) {
            for (var i = 0; i < oData.length; i++) {
                if (oData[i].batchCharcValues && oData[i].batchCharcValues.length !== 0) {
                    for (var j = 1; j <= this.characteristicsColumns.length; j++) {
                        for (var k = 0; k < oData[i].batchCharcValues.length; k++) {
                            if (this.characteristicsColumns[j - 1].name === oData[i].batchCharcValues[k].charcName) {
                                oData = this.buildCharacteristicsData(oData, i, j, oData[i].batchCharcValues[k]);
                                break;
                            }
                        }
                    }
                }
            }
            return oData;
        },

        buildCharacteristicsData: function(oData, i, j, assignmentValue) {

            if (j === 1) {
                oData[i].charcValue1 = assignmentValue.charcValue;
                oData[i].charcUom1 = assignmentValue.uom;
                oData[i].charcValFormatted1 = this.oController.formatter.showCharacteristicsValueWithUom(assignmentValue.charcValue, assignmentValue.uom);
            } else if (j === 2) {
                oData[i].charcValue2 = assignmentValue.charcValue;
                oData[i].charcUom2 = assignmentValue.uom;
                oData[i].charcValFormatted2 = this.oController.formatter.showCharacteristicsValueWithUom(assignmentValue.charcValue, assignmentValue.uom);
            } else if (j === 3) {
                oData[i].charcValue3 = assignmentValue.charcValue;
                oData[i].charcUom3 = assignmentValue.uom;
                oData[i].charcValFormatted3 = this.oController.formatter.showCharacteristicsValueWithUom(assignmentValue.charcValue, assignmentValue.uom);
            } else if (j === 4) {
                oData[i].charcValue4 = assignmentValue.charcValue;
                oData[i].charcUom4 = assignmentValue.uom;
                oData[i].charcValFormatted4 = this.oController.formatter.showCharacteristicsValueWithUom(assignmentValue.charcValue, assignmentValue.uom);
            } else if (j === 5) {
                oData[i].charcValue5 = assignmentValue.charcValue;
                oData[i].charcUom5 = assignmentValue.uom;
                oData[i].charcValFormatted5 = this.oController.formatter.showCharacteristicsValueWithUom(assignmentValue.charcValue, assignmentValue.uom);
            }

            return oData;
        },

        createBatchTable: function(oData) {
            if (!this.batchDetailsModel) {
                this.batchDetailsModel = new JSONModel();
            }
            this.prepareData(oData);
            this.batchDetailsModel.setData(oData);
            var oFilterBar = this.oController.byId("filterBar");
            var oBasicSearchField = new sap.m.SearchField({
                showSearchButton: false,
                liveChange: function(oEvent) {
                    this.onSearchBatchListWithValue(oEvent.getParameter('newValue'))
                }.bind(this)
            });
            oFilterBar.destroyFilterGroupItems();
            oFilterBar.removeAllFilterGroupItems();
            oFilterBar.setBasicSearch(oBasicSearchField);
            if (!this.oController.isInventoryManaged) {
                oFilterBar.setExpandAdvancedArea(true);
                oFilterBar.setShowGoButton(true);
                this.createStorLocFilter(oFilterBar, oData);
            } else {
                this.prepareData(oData);
                this.batchDetailsModel.setData(oData);
                this.setDataInBatchTable(oData);
            }
        },

        createStorLocFilter: function(oFilterBar, oData) {
            /*if(!this.oController.getView().getModel("multiStorLocsModel")) {
                var multiStorLocsModel = new JSONModel();
                this.oController.getView().setModel(multiStorLocsModel, "multiStorLocsModel");
            }*/
            var oFilterGroupItem = [];
            var oInput = [];
            oFilterGroupItem[0] = new sap.ui.comp.filterbar.FilterGroupItem();
            oFilterGroupItem[0].setGroupName("Advanced");
            oFilterGroupItem[0].setName("storageLoc");
            oFilterGroupItem[0].setLabel(this.oController.getI18nText("process.storLoc.col"));
            oFilterGroupItem[0].setVisibleInAdvancedArea(true);

            oInput[0] = new sap.m.MultiInput();
            oInput[0].setName("storageLoc");
            oInput[0].setRequired(true);
            oInput[0].setValueHelpOnly(true);
            oInput[0].setShowValueHelp(true);
            if(this.selectedItem.enteredStorageLoc !== "") {
                oInput[0].addToken(new sap.m.Token({ text: this.selectedItem.enteredStorageLoc }));
            }
            oInput[0].attachValueHelpRequest(function() {
                StorageLocationBrowse.openMulti(oInput[0], "", function(oSelectedObjects) {
                    oInput[0].destroyTokens();
                    if (oSelectedObjects.length > 0) {
                        oSelectedObjects.forEach(function(item) {
                            oInput[0].addToken(new sap.m.Token({ text: item }));
                        });
                        oInput[0].setValueState("None");
                        oInput[0].setValueStateText("");
                    }
                }.bind(this), this.oController.getView().getModel("inventory"));
                // this.setSelectedDefaults();
            }.bind(this));
            oFilterGroupItem[0].setControl(oInput[0]);
            oFilterBar.addFilterGroupItem(oFilterGroupItem[0]);
            this.setDataInBatchTable(oData, true);
            this.onSearchBatchListWithValue("");
        },

        setSelectedDefaults: function () {
            var selectedItems = this.byId("resultTable").getSelectedItems();
            this.multiStorLocs.forEach(function(storLoc) {
                selectedItems.forEach(function(item) {
                    if(storLoc === item.getBindingContext().getObject().storageLocation) {
                        item.setSelected(true);
                    }
                });
            });
        },

        setDataInBatchTable: function(oData) {
            var that = this;
            var oDialog = that.oController.byId("batchDialog");

            var oTableMetadata = {
                visible: true,
                popinLayout: "GridLarge",
                mode: "SingleSelectMaster",
                selectionChange: [this.onSelectBatch, this]
            };
            if (!this.oController.isInventoryManaged) {
                oTableMetadata.growing = true;
                oTableMetadata.growingThreshold = 20;
                oTableMetadata.growingScrollToLoad = true;
                oTableMetadata.updateStarted = [this.queryNextPageList, this];
            }
            if (sap.ui.getCore().byId("batchListTable")) {
                sap.ui.getCore().byId("batchListTable").destroy();
            }
            var oTable = new sap.m.Table("batchListTable", oTableMetadata);
            oTable.addStyleClass("tableContent");
            oTable.setAutoPopinMode(true);

            var headerTitle = new sap.m.Title("batchTableTitle", {
                text: "",
                level: "H2"
            });
            var headerToolbar = new sap.m.Toolbar();
            headerToolbar.addContent(headerTitle);
            oTable.setHeaderToolbar(headerToolbar);

            var oColumnListItem = new sap.m.ColumnListItem("batchColumnListItem");

            var oColumnListItemBatchNumber = new sap.m.Text({
                text: "{batchDetailsModel>batchNumber}"
            });
            oColumnListItem.addCell(oColumnListItemBatchNumber);
            var oColumnBatchNumber = new sap.m.Column({
                hAlign: "Left",
                vAlign: "Middle"
            });
            var oHeaderControlBatchNumber = new sap.m.Text({
                text: "{i18n>batchNumber.label}"
            });
            oColumnBatchNumber.setHeader(oHeaderControlBatchNumber);
            oTable.addColumn(oColumnBatchNumber);

            var oColumnListItemQty = new sap.m.Text({
                text: {
                    parts: ["batchDetailsModel>remainingQuantity", "batchDetailsModel>unitOfMeasure/uom"],
                    formatter: that.oController.formatter.showFormattedValueWithUomForSpecialUom.bind(that)
                }
            });
            oColumnListItem.addCell(oColumnListItemQty);
            var oColumnQuantity = new sap.m.Column({
                hAlign: "Right",
                vAlign: "Middle"
            });
            var oHeaderControlQuantity = new sap.m.Text({
                text: "{i18n>process.quantity.col}"
            });
            oColumnQuantity.setHeader(oHeaderControlQuantity);
            oTable.addColumn(oColumnQuantity);

            var oColumnListItemStorageLocControl = new sap.m.Text({
                text: "{batchDetailsModel>storageLocation/storageLocation}"
            });
            oColumnListItem.addCell(oColumnListItemStorageLocControl);
            var oColumnStorageLoc = new sap.m.Column({
                hAlign: "Left",
                vAlign: "Middle"
            });
            var oHeaderControlStorageLoc = new sap.m.Text({
                text: "{i18n>process.storLoc.col}"
            });
            oColumnStorageLoc.setHeader(oHeaderControlStorageLoc);
            oTable.addColumn(oColumnStorageLoc);

            for (var i = 1; i <= this.characteristicsColumns.length; i++) {
                var charcValueField = "charcValue" + i;
                var charcUomField = "charcUom" + i;
                var oColumnListItemControl = new sap.m.Text({
                    text: {
                        parts: ["batchDetailsModel>" + charcValueField, "batchDetailsModel>" + charcUomField],
                        formatter: that.oController.formatter.showCharacteristicsValueWithUom
                    }
                });
                oColumnListItem.addCell(oColumnListItemControl);
                var columnHeaderText = this.characteristicsColumns[i - 1].desc ? this.characteristicsColumns[i - 1].desc : this.characteristicsColumns[i - 1].name;
                var columnAllign = that.oController.formatter.getAllignment(this.characteristicsColumns[i - 1].dataType);
                var oColumn = new sap.m.Column({
                    hAlign: columnAllign,
                    vAlign: "Middle"
                });
                var oHeaderControl = new sap.m.Text({
                    text: columnHeaderText
                });
                oColumn.setHeader(oHeaderControl);
                oTable.addColumn(oColumn);
            }

            var oColumnListItemExpDateControl = new sap.m.Text({
                text: "{batchDetailsModel>expiry}"
            });
            oColumnListItem.addCell(oColumnListItemExpDateControl);
            var oColumnExpDate = new sap.m.Column({
                hAlign: "Right",
                vAlign: "Middle"
            });
            var oHeaderControl = new sap.m.Text({
                text: "{i18n>process.expDate}"
            });
            oColumnExpDate.setHeader(oHeaderControl);
            oTable.addColumn(oColumnExpDate);

            oTable.bindItems("batchDetailsModel>/", oColumnListItem, null, null);
            oDialog.addContent(oTable);
            oTable.setModel(this.batchDetailsModel, "batchDetailsModel");
            if (!this.oController.isInventoryManaged && this.totalPaginationElems > (this.oPageable.page + 1) * 20) {
                oTable.getBindingInfo("items").binding.isLengthFinal = function() {
                    return false;
                }
                oTable.setGrowingThreshold((this.oPageable.page + 1) * 20);
            } else if(!this.oController.isInventoryManaged &&  this.totalPaginationElems <= (this.oPageable.page+1) * 20) {
                oTable.getBindingInfo("items").binding.isLengthFinal = function () {
                    return true;
                }
                oTable.setGrowing(false);
                oTable.setGrowingScrollToLoad(false);
            }
            this.onSearchBatchListWithValue("");
            oDialog.setBusy(false);

        },

        prepareStockData: function(oData) {
            for (var i = 0; i < oData.length; i++) {
                var uomObj = {
                    uom: (oData[i].materialBaseUnit || null)
                };
                var matObj = {
                    material: oData[i].material
                };
                var storLocObj = {
                    storageLocation: oData[i].storageLocation
                };
                oData[i].batchNumber = oData[i].batch;
                oData[i].remainingQuantity = oData[i].quantity;
                oData[i].unitOfMeasure = uomObj;
                oData[i].material = matObj;
                oData[i].storageLocation = storLocObj;
            }
        },

        prepareData: function(oData) {

            for (let element of oData) {
                let sExpiry = '';
                element.qtyFormatted = this.oController.formatter.formatQtyWithDecimals(element.remainingQuantity, element.unitOfMeasure ? element.unitOfMeasure.uom : null);
                if (element.batch && element.batch.shelfLifeExpirationDate) {
                    sExpiry = this.oController.formatter.formatDate(element.batch.shelfLifeExpirationDate);
                } else if (element.expirationDate) {
                    sExpiry = this.oController.formatter.formatDate(element.expirationDate);
                } else if (element.shelfLifeExpirationDate) {
                    sExpiry = this.oController.formatter.formatDate(element.shelfLifeExpirationDate);
                } else {
                    sExpiry = "";
                }
                element.expiry = sExpiry;
            }
        },

        onGoAdvSearch: function(oEvent) {
            // validate and prepare payload
            var oDialog = this.oController.byId("batchDialog");
            var oFilterBar = this.oController.byId("filterBar");
            this.fetchBatchesWithStock(oDialog, oFilterBar);
        },

        fetchBatchesWithStock: function(oDialog, oFilterBar) {
            if (oFilterBar.getFilterGroupItems()[0].getControl().getTokens().length < 1) {
                oFilterBar.getFilterGroupItems()[0].getControl().setValueState("Error");
                oFilterBar.getFilterGroupItems()[0].getControl().setValueStateText(this.oController.getI18nText("storageLocationDialog.header"));
                return;
            }
            this.oPageable = this.oPageable || {};
            this.oPageable.page = 0;
            var oParameters = this.prepareInvStockParams(this.selectedItem);
            var storLocs = [];
            oFilterBar.getFilterGroupItems()[0].getControl().getTokens().forEach(function(token) {
                storLocs.push(token.getText());
            });
            this.multiStorLocs = storLocs;
            oParameters.storageLocations = storLocs.join(',');
            var sUrl = this.oController.getInventoryDataSourceUri() + "inventory/inventoryStock";
            this.doInvStockApiCall(oDialog, sUrl, oParameters, false);
        },

        onSearchBatchList: function(oEvt) {
            var sQuery = "";
            if (oEvt)
                sQuery = oEvt.getParameter("newValue");
            this.onSearchBatchListWithValue(sQuery);
        },

        onSearchBatchListWithValue: function(oValue) {

            var properties = ["batchNumber", "storageLocation/storageLocation", "batch/shelfLifeExpirationDate"];

            //Search by characteristics values and uoms.
            for (var i = 1; i <= this.characteristicsColumns.length; i++) {
                properties.push("charcValue" + i);
                properties.push("charcUom" + i);
            }

            var list;
            var batchBindings;
            if (this.oController) {
                list = sap.ui.getCore().byId("batchListTable");
                batchBindings = list.getBinding("items");
                this.oController.utils.handleSearch(oValue, properties, batchBindings, this.itemText, this.totalPaginationElems);
            } else {
                list = sap.ui.getCore().byId("batchListTable");
                batchBindings = list.getBinding("items");
                that.oController.utils.handleSearch(oValue, properties, batchBindings, this.itemText, this.totalPaginationElems);
            }
        },

        onSelectBatch: function(oEvent) {

            var batchData = oEvent.getSource().getSelectedItem().getBindingContext("batchDetailsModel").getObject();
            sap.ui.getCore().byId("batchListTable").removeSelections(true);
            this.onCloseBatchDialog();
            if (this.oController.BatchDialog.fnPostSelectioncallback) {
                this.oController.BatchDialog.fnPostSelectioncallback(batchData);
            }
        },

        onCloseBatchDialog: function() {

            if (sap.ui.getCore().byId("batchListTable")) {
                sap.ui.getCore().byId("batchListTable").destroy();
            }
            this.oController.byId("batchDialog").close();
        }
    }
});