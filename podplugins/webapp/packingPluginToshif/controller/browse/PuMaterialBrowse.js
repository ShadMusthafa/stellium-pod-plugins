sap.ui.define([
    "sap/dm/dme/controller/BrowseBase",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/formatter/StatusFormatter",
    "sap/dm/dme/formatter/ObjectTypeFormatter"
], function (BrowseBase, JSONModel, StatusFormatter, ObjectTypeFormatter) {
    "use strict";

    let MaterialBrowseType = BrowseBase.extend("stellium.ext.podplugins.packingPluginToshif.controller.browse.PuMaterialBrowse", {

        statusFormatter: StatusFormatter,
        objectTypeFormatter: ObjectTypeFormatter,

        constructor: function (sId, mSettings) {
            BrowseBase.prototype.constructor.apply(this, arguments);
            this.onFilterBarChange();
            this.performDefaultFiltering(mSettings.sDefaultSearchValue);
            this.initializeDialogModel();
        },

        initializeDialogModel: function () {
            this.getDialog().setModel(new JSONModel({ listLength: 0 }), "materialBrowseModel");
        },

        populateSelectItems: function () {
            this.getDialog().setModel(new JSONModel(this.statusFormatter.getStatusList()), "materialStatusItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getProcurementTypeList()), "procurementTypeItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getMaterialTypeList()), "materialTypeItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getMaterialTypeList()), "mrpControllerItems");
        },

        createResultData: function (oBindingContext) {
            return {
                ref: oBindingContext.getProperty("ref"),
                name: oBindingContext.getProperty("material"),
                version: oBindingContext.getProperty("version"),
                materialType: oBindingContext.getProperty("materialType")
            };
        },

        onListUpdate: function () {
            let oDialogModel = this.getDialog().getModel("materialBrowseModel");
            let iLength = this.getListBinding().getLength();
            oDialogModel.setProperty("/listLength", iLength);
        }
    });

    return {
        open: function (oParentControl, sDefaultSearchValue, fnSelectionCallback, oModel, sDefaultFilter) {
            return new MaterialBrowseType("materialBrowse", {
                oModel: oModel,
                sFragmentName: "stellium.ext.podplugins.packingPluginToshif.view.fragment.PuMaterialBrowse",
                oParentControl: oParentControl,
                sDefaultSearchValue: sDefaultSearchValue,
                fnSelectionCallback: fnSelectionCallback,
                oFilterSettings: {
                    aLiveSearchProperties: [ "material" ],
                    sListBindingPath: "/Materials",
                    aVariantFilterInfo: [
                        { sFilterItemName: "material" },
                        /* disabled due to central issue
                        { sFilterItemName: "description" }, */
                        { sFilterItemName: "unitOfMeasure" },
                        { sFilterItemName: "status" },
                        { sFilterItemName: "procurementType" },
                        { sFilterItemName: "currentVersion", oFilterOperator: sap.ui.model.FilterOperator.Any }
                    ],
                    oDefaultFilter: sDefaultFilter
                }
            });
        }
    };
});
