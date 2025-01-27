sap.ui.define([
    "stellium/ext/podplugins/packingPlugin/controller/UnitBaseObject.controller",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/controller/ListFilter",
    "sap/ui/model/Filter",
    "stellium/ext/podplugins/packingPlugin/controller/browse/PuMaterialBrowse",
    "stellium/ext/podplugins/packingPlugin/util/UserAction"
], function (UnitBaseObjectController, JSONModel, ListFilter, Filter, PuMaterialBrowse, UserAction) {
    "use strict";

    return UnitBaseObjectController.extend("stellium.ext.podplugins.packingPluginToshif.controller.AvailableUnitsList", {
        oAvailableUnitsListFilter: null,

        onInit: function () {
            this.oEventBus.subscribe("resetUnitDetails", this.onClearAndRefresh, this);
        },

        onClearAndRefresh: function (sChannelId, sEventId, oData) {
            this.refreshAvailableList(this.getAvailableUnitsList(), this.oAvailableUnitsListFilter, oData.bFinish);
        },

        onBeforeRendering: function () {
            const oAvailableUnitsListFilterBar = this.byId("availableUnitsFilterBar");
            this.loadAvailableUnitsList();
            this.oAvailableUnitsListFilter = new ListFilter({
                aLiveSearchProperties: [ "number" ],
                sLiveSearchFieldId: this.getAvailableUnitsSearchField().getId(),
                oListBinding: this.getAvailableUnitsList().getBinding("items"),
                sListBindingPath: "/GetPackablePackingList(id='0')",
                oFilterBar: oAvailableUnitsListFilterBar,
                aVariantFilterInfo: []
            });
            this.configureListFilterBarSearchLayout(oAvailableUnitsListFilterBar);
            this.oAvailableUnitsListFilter.clearFilters();
        },

        loadAvailableUnitsList: function () {
            let sUnitId = this.getUnitData().id;
            let oAvailableUnitsList = this.getAvailableUnitsList();
            let oAvailableUnitsListItem = this.getView().byId("availableUnitsList");

            oAvailableUnitsList.bindItems({
                path: `packing>/GetPackablePackingList(id='${sUnitId}')`,
                parameters: { $count: true },
                events: {
                    dataRequested: function () { oAvailableUnitsList.setBusy(true); },
                    dataReceived: function () { oAvailableUnitsList.setBusy(false); }
                },
                template: oAvailableUnitsListItem
            });
        },

        onExit: function () {
            UnitBaseObjectController.prototype.onExit.apply(this, arguments);
            this.oEventBus.unsubscribe("resetUnitDetails", this.onClearAndRefresh, this);
        },

        onAvailableUnitsSearch: function (oEvent) {
            this._filterAvailableObjects(this._getAvailablePuExternalFilters());
        },

        _getAvailablePuExternalFilters: function () {
            let aExternalFilters = [];
            let sMaterial = this.getViewModel().getProperty("/availableUnitsMaterialFilterRef");
            if (this.getAvailableUnitsMaterialFilter().getValue() && sMaterial) {
                aExternalFilters.push(new Filter("material", sap.ui.model.FilterOperator.EQ, sMaterial));
            }
            return aExternalFilters;
        },

        onPuMaterialBrowse: function () {
            let oProductModel = this.getOwnerComponent().getModel("product");
            let sFilterQuery = "materialType eq com.sap.mes.odata.MaterialType'PACKAGING'";
            PuMaterialBrowse.open(this.getView(), null, function (oSelectedObject) {
                this.getAvailableUnitsMaterialFilter().setValue(oSelectedObject.name);
                this.getViewModel().setProperty("/availableUnitsMaterialFilterRef", oSelectedObject.ref);
                this.onAvailablePusFilterValueChange();
            }.bind(this), oProductModel, sFilterQuery);
        },

        onAvailableUnitsFiltersClear: function () {
            this.oAvailableUnitsListFilter.clearFilters();
            this._filterAvailableObjects(this._getAvailablePuExternalFilters());
        },

        onAvailablePuListUpdateFinished: function (oEvent) {
            let iListLength = oEvent.getParameter("total");
            this.getViewModel().setProperty("/availablePusLength", iListLength);
        },

        onAvailablePusFilterValueChange: function () {
            this._filterAvailableObjects(this._getAvailablePuExternalFilters());
        },

        getAvailableUnitsList: function () {
            return this.byId("availablePackingUnitsTable");
        },

        getAvailableUnitsSearchField: function () {
            return this.byId("availablePusSearch");
        },

        getAvailableUnitsMaterialFilter: function () {
            return this.byId("availablePusMaterialFilter");
        },

        onMoveToAssigned: function () {
            let oAvailableObjectsTable = this.getAvailableUnitsList();
            this.aMovedContent = oAvailableObjectsTable.getSelectedContexts();

            if (this.aMovedContent.length > 0) {
                this.aMovedContent = this.convertSelectedUnits(this.aMovedContent);
                this.addUnitsToUnit();
            }
        },

        addUnitsToUnit: function () {
            this.oUserAction.setAdd();
            this.savePackingUnit();
        },

        convertSelectedUnits: function (aSelectedContexts) {
            return aSelectedContexts.map(function (oSelectedContext) {
                return {
                    packingUnit: {
                        id: oSelectedContext.getProperty("id"),
                        material: { material: oSelectedContext.getProperty("material") },
                        number: oSelectedContext.getProperty("number"),
                        status: oSelectedContext.getProperty("status")
                    }
                };
            });
        }
    });
});
