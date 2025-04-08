sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/controller/BrowseBase",
    "sap/dm/dme/formatter/StatusFormatter",
    "sap/dm/dme/formatter/ObjectTypeFormatter",
    "stellium/ext/podplugins/supervisorMaterialConsumptionPlugin/controller/ListFilterRoutingBrowse"
], function (JSONModel, BrowseBase, StatusFormatter, ObjectTypeFormatter, ListFilterRoutingBrowse) {
    "use strict";

    var RoutingBrowseType = BrowseBase.extend("stellium.ext.podplugins.supervisorMaterialConsumptionPlugin.controller.RoutingBrowse", {

        objectTypeFormatter: ObjectTypeFormatter,
        statusFormatter: StatusFormatter,

        /**
         * @override
         */
        populateSelectItems: function () {
            this.getDialog().setModel(new JSONModel(StatusFormatter.getStatusList()), "statusItems");
            this.getDialog().setModel(new JSONModel(ObjectTypeFormatter.getRoutingTypeList()), "routingTypeItems");
        },

        /**
         * @override
         */
        createResultData: function (oBindingContext,oClickedListItem) {
        	oBindingContext = oClickedListItem.getBindingContext("product");
            return {
                ref: oBindingContext.getProperty("ref"),
                name: oBindingContext.getProperty("routing"),
                version: oBindingContext.getProperty("version"),
                routingType: oBindingContext.getProperty("routingType")
            };
        },

        /**
         * @override
         */
        constructor: function (sId, mSettings) {
            this._oParentControl = mSettings.oParentControl;
            this._fnSelectionCallback = mSettings.fnSelectionCallback;
            this._sBaseId = mSettings.oParentControl.getId() + "--" + sId;
            this._oDialog = sap.ui.xmlfragment(this._sBaseId, mSettings.sFragmentName, this);
            if (mSettings.oModel) {
                this._oDialog.setModel(mSettings.oModel);
            }
            this._oParentControl.addDependent(this._oDialog);
            this.oFilterBySystem = new sap.ui.model.Filter({
                path: "routing",
                operator: sap.ui.model.FilterOperator.NE,
                value1: "_SYSTEM"
            });
            this._oListFilter = new ListFilterRoutingBrowse(this.extendFilterSettings(mSettings.oFilterSettings), this.oFilterBySystem);
            this.populateSelectItems();
            this.performDefaultFiltering(mSettings.sDefaultSearchValue);
            this._oDialog.open();
        },

        /**
         * @override
         */
        getExternalFilter: function () {
            return this.oFilterBySystem;
        },

        /**
         * @override
         */
        onFilterBarClear: function () {
            BrowseBase.prototype.onFilterBarClear.apply(this, arguments);
            this.onFilterBarChange();
        }

    });

    return {

        oBrowse: null,

        /**
         * Instantiates and opens value help dialog.
         * @param {sap.ui.core.Element} oParentControl - value help dialog will be set as dependent to it.
         * @param {String} sDefaultSearchValue - default value placed in a search field and a list is filtered by.
         * @param fnSelectionCallback - callback function called when user selects item in a list.
         */
        open: function (oParentControl, sDefaultSearchValue, fnSelectionCallback, oModel) {
            return new RoutingBrowseType("routingBrowse", {
                oModel: oModel,
                sFragmentName: "stellium.ext.podplugins.supervisorMaterialConsumptionPlugin.view.browse.RoutingBrowse",
                oParentControl: oParentControl,
                sDefaultSearchValue: sDefaultSearchValue,
                fnSelectionCallback: fnSelectionCallback,
                oFilterSettings: {
                    aLiveSearchProperties: ["routing", "description"],
                    sListBindingPath: "/Routings",
                    aVariantFilterInfo: [
                        { sFilterItemName: "routing" },
                        { sFilterItemName: "description" },
                        { sFilterItemName: "status" },
                        { sFilterItemName: "routingType" },
                        { sFilterItemName: "creationTimeRange", sSearchProperty: "createdDateTime" },
                        { sFilterItemName: "currentVersion", oFilterOperator: sap.ui.model.FilterOperator.Any }
                    ]
                }
            });
        }
    };
});
