sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function(JSONModel, AjaxUtil, Fragment, Filter, FilterOperator) {
    "use strict";

    return {

        setController: function(sController) {
            this.oController = sController;
        },


        onSeachStorageLocationList: function (oEvt) {
            var sQuery = '';
            if (oEvt) {
                sQuery = oEvt.getParameter("value");
            }
            sQuery === '' ? this.StorageLocationDialog.fetchStorageLocationDetails(sQuery) : this.StorageLocationDialog.onSearchStorageLocationListWithValue(sQuery);
        },
        onSeachStorageLocationListLive: function (oEvt) {
            var sQuery = '';
            if (oEvt) {
                sQuery = oEvt.getParameter("value");
            }
            if(sQuery !== '') {
                this.StorageLocationDialog.onSearchStorageLocationListWithValue(sQuery);
            }
        },

        onSearchStorageLocationListWithValue: function(oValue) {
            var properties = ["inventoryId", "storageLocation/storageLocation"];
            var list;
            var sLocBindings;
            if (this.oController) {
                list = this.oController.byId("storageLocationDialog");
                sLocBindings = list.getBinding("items");
                this.oController.utils.handleSearch(oValue, properties, sLocBindings);
            }
        },

        showStorageLocationDetails: function(oMaterial, fnPostSelectioncallback) {
            let material = oMaterial.materialId;
            this.fnPostSelectioncallback = fnPostSelectioncallback;
            this.selectedMaterialRef = material.ref;
            this.selectedMaterial = material.material;
            var oView = this.oController.getView();
            if (!this.oController.byId("storageLocationDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.StorageLocationDialog",
                    controller: this.oController
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.onAfterRenderingStorageLocationDialog(oMaterial.storageLocation);
                }.bind(this));
            } else {
                this.oController.byId("storageLocationDialog").open();
                this.onAfterRenderingStorageLocationDialog(oMaterial.storageLocation);
            }
        },

        onAfterRenderingStorageLocationDialog: function(sStorageLocation) {
            var that = this;
            setTimeout(function() {
                that.oController.byId("storageLocationDialog")._oSearchField.setValue(sStorageLocation || '');
                that.fetchStorageLocationDetails(sStorageLocation);
            }, 125);
        },

        getStorageLocations: function (oResponseData) {
            let aStorageLocations = [];
            oResponseData.value && oResponseData.value.length > 0 && oResponseData.value.forEach(e => {
                aStorageLocations.push(e.storageLocation);
            });
            return aStorageLocations;
        },
        handleStorageLocationData: function (oResponseData) {
            let aStorageLocations = [];
            aStorageLocations = this.getStorageLocations(oResponseData, aStorageLocations);
            //Now we have storagelocations, call and get the remaining quantities
            aStorageLocations && aStorageLocations.length > 0 && this.fetchStorageLocationDetails(aStorageLocations.join(','));
        },
        fetchStorageLocationDetails: function(sStorageLocation) {
            let sUrl;
            let oParameters = {};
            if (this.oController.isInventoryManaged) {
                sUrl = this.oController.getInventoryDataSourceUri() + "inventory/findInventory";
                oParameters.materialRef = this.selectedMaterialRef;
            } else if (!['', undefined, null].includes(sStorageLocation)) {
                sUrl = this.oController.getInventoryDataSourceUri() + "inventory/inventoryStock";
                oParameters={
                    material: this.selectedMaterial,
                    inventoryStockType: '01',
                    storageLocations: sStorageLocation
                }
            } else{
                sUrl = this.oController.getInventoryODataDataSourceUri() + "StorageLocations";
            }
            var that = this;
            that.oController.byId("storageLocationDialog").setBusy(true);
            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                that.storageLocationDetailsList = [];
                if (!that.oController.isInventoryManaged) {
                    that.handleStorageLocationData(oResponseData);
                    oResponseData.content && oResponseData.content.length > 0 && oResponseData.content.forEach(function(e) {
                        that.storageLocationDetailsList.push({
                            storageLocation: {storageLocation: e.storageLocation},
                            remainingQuantity: e.quantity,
                            unitOfMeasure: {
                                uom: e.materialBaseUnit
                            }
                        });
                    });
                } else {
                    that.storageLocationDetailsList = oResponseData;
                }
                that.storageLocationModel = new JSONModel();
                that.storageLocationModel.setSizeLimit(that.storageLocationDetailsList.length);
                that.storageLocationModel.setData(that.storageLocationDetailsList);
                that.oController.byId("storageLocationDialog").setModel(that.storageLocationModel, "storageLocationModel");
                //triggering search in the storage location popup with value from the input field.
                if(that.oController.isInventoryManaged){
                    that.onSearchStorageLocationListWithValue(sStorageLocation);
                }
                that.oController.byId("storageLocationDialog").setBusy(false);
            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.storageLocationDetailsList = {};
            });
        },

        onSelectStorageLocation: function(oEvent) {

            var sLocData = oEvent.getParameters().selectedItem.getBindingContext("storageLocationModel").getObject();
            if (this.StorageLocationDialog.fnPostSelectioncallback) {
                this.StorageLocationDialog.fnPostSelectioncallback(sLocData);
            }
        },

        onGetStockForStorageLoc: function(oEvent) {
            var oSource = oEvent.getSource();
            var oObject = oSource.getBindingContext("storageLocationModel").getObject();
            var oStorageLocModel = this.byId("storageLocationDialog").getModel("storageLocationModel");
            this.byId("storageLocationDialog").setBusy(true);
            var sUrl = this.getInventoryDataSourceUri() + "inventory/inventoryStock";
            var oParameters = {};
            oParameters.material = this.StorageLocationDialog.selectedMaterial;
            var storLocs = [];
            storLocs.push(oObject.storageLocation.storageLocation);
            oParameters.storageLocations = storLocs.join(',');
            oParameters.inventoryStockType = "01";
            var oController = this;
            AjaxUtil.get(sUrl, oParameters, function(oResponseData) {
                var stockDetails = oResponseData.content;
                oObject.remainingQuantity = (stockDetails && stockDetails[0]) ? stockDetails[0].quantity : 0;
                var uomObj = { uom: (stockDetails && stockDetails[0]) ? stockDetails[0].materialBaseUnit : "" };
                oObject.unitOfMeasure = uomObj;
                oStorageLocModel.refresh();
                oController.byId("storageLocationDialog").setBusy(false);
            }, function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                oController.showErrorMessage(err, true, true);
                oController.byId("storageLocationDialog").setBusy(false);
                oStorageLocModel.refresh();
            });
        }
    }
});
