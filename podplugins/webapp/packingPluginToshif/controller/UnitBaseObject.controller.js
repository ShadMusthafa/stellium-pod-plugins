sap.ui.define([
    "stellium/ext/podplugins/packingPlugin/controller/PackingUnitDetails.controller",
    "sap/ui/model/Filter"
], function (PackingUnitDetailsController, Filter) {
    "use strict";

    return PackingUnitDetailsController.extend("stellium.ext.podplugins.packingPluginToshif.controller.UnitBaseObjectController", {
        refreshAvailableList: function (oAvailableList, oListFilter, bFinish) {
            let oAvailableListItemsBinding = oAvailableList.getBinding("items");

            if (bFinish && oListFilter) {
                oAvailableList.removeAllItems();
                oListFilter.clearFilters();
            } else if (oAvailableListItemsBinding) {
                oAvailableListItemsBinding.refresh();
            }

            oAvailableList.removeSelections();
        },

        configureListFilterBarSearchLayout: function (oListFilterBar) {
            if (oListFilterBar) {
                oListFilterBar.setBasicSearch(oListFilterBar.removeContent(oListFilterBar.getBasicSearch()));
            }
        },

        _filterAvailableObjects: function (aFilters) {
            let sSelectedTab = this.getViewModel().getProperty("/availableObjectsSelectedTab");
            if (sSelectedTab === "availableSfcsTab") {
                this.oAvailableSfcsListFilter.filterBySearchAndBar(aFilters);
            } else {
                this.oAvailableUnitsListFilter.filterBySearchAndBar(aFilters);
            }
        },

        createStatusFilters: function (sKey, aAllowedStatuses) {
            let aFilters = [];
            if (sKey === "ALL") {
                aFilters = aAllowedStatuses.map(function (sStatusKey) {
                    return new Filter("status", sap.ui.model.FilterOperator.EQ, sStatusKey);
                });
            } else {
                aFilters.push(new Filter("status", sap.ui.model.FilterOperator.EQ, sKey));
            }
            return aFilters;
        },

        getAvailableSfcsList: function () {
            return this.byId("availableObjects");
        },

        onAssignedObjectsSearch: function (oEvent) {
            let sValue = oEvent.getParameter("newValue");
            let oFilter = new Filter("sfc/sfc", sap.ui.model.FilterOperator.Contains, sValue);
            this._getAssignedObjectsTable().getBinding("items").filter([ oFilter ]);
        }
    });
});
