sap.ui.define([
    "sap/dm/dme/controller/BrowseBase",
    "stellium/ext/podplugins/supervisorMaterialConsumptionPlugin/utils/formatter"
], function (BrowseBase, Formatter) {
    "use strict";

    var StorageLocationBrowseType = BrowseBase.extend("stellium.ext.podplugins.supervisorMaterialConsumptionPlugin.controller.StorageLocationBrowse", {
        formatter: Formatter,

        /**
         * @override
         */
        createResultData: function (oBindingContext) {
            return {
                ref: oBindingContext.getProperty("id"),
                name: oBindingContext.getProperty("storageLocation")
            };
        },

        onOK: function (oEvent) {
            if (this._fnSelectionCallback) {
                var selectedItems = this.byId("resultTable").getSelectedItems();
                var selects = [];
                selectedItems.forEach(function(item) {
                    selects.push(item.getBindingContext().getObject().storageLocation);
                });
                this._oDialog.close();
                this._fnSelectionCallback(selects);
                this._fnSelectionCallback = null;
            }
        }
    });

    return {

        /**
         * Instantiates and opens value help dialog.
         * @param {sap.ui.core.Element} oParentControl - value help dialog will be set as dependent to it.
         * @param {String} sDefaultSearchValue - default value placed in a search field and a list is filtered by.
         * @param fnSelectionCallback - callback function called when user selects item in a list.
         */
        open: function (oParentControl, sDefaultSearchValue, fnSelectionCallback, oModel) {
            return new StorageLocationBrowseType("storageLocationBrowse", {
                oModel: oModel,
                sFragmentName: "stellium.ext.podplugins.supervisorMaterialConsumptionPlugin.view.browse.StorageLocationsBrowse",
                oParentControl: oParentControl,
                sDefaultSearchValue: sDefaultSearchValue,
                fnSelectionCallback: fnSelectionCallback,
                oFilterSettings: {
                    aLiveSearchProperties: ["storageLocation"]
                }
            });
        },
        openMulti: function (oParentControl, sDefaultSearchValue, fnSelectionCallback, oModel) {
             return new StorageLocationBrowseType("storageLocationBrowse", {
                oModel: oModel,
                sFragmentName: "stellium.ext.podplugins.supervisorMaterialConsumptionPlugin.view.browse.StorageLocationsBrowseMulti",
                oParentControl: oParentControl,
                sDefaultSearchValue: sDefaultSearchValue,
                fnSelectionCallback: fnSelectionCallback,
                oFilterSettings: {
                    aLiveSearchProperties: ["storageLocation"]
                }
            });
        }
    };
});
