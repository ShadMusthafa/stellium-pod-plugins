sap.ui.define([
    "sap/dm/dme/controller/ListFilter",
    "sap/dm/dme/controller/FilterFactory",
    "sap/dm/dme/controller/FilterBarExecutor"
], function (ListFilter, FilterFactory, FilterBarExecutor) {
    "use strict";

    return ListFilter.extend("sap.dm.dme.plugins.orderPodSelectionPlugin.controller.ListFilterRoutingBrowse", {

        /**
         * @override
         */
        constructor: function (mSettings, oFilter) {
            ListFilter.prototype.constructor.apply(this, arguments);
            this._oAdditionalFilter = oFilter;
        },

        /**
         * @override
         */
        filterBySearchValue: function (sSearchValue) {
            var aFilter = this._createBasicSearchFilter(sSearchValue);

            if (this._oDefaultFilter) {
                aFilter.push(this._oDefaultFilter);
            }

            aFilter.push(this._oAdditionalFilter);
            this._oListBinding.filter(aFilter);
        }

    });
}, true);
