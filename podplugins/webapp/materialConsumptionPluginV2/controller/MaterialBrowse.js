sap.ui.define([
    "sap/dm/dme/controller/BrowseBase",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/formatter/StatusFormatter",
    "sap/dm/dme/formatter/ObjectTypeFormatter",
    "stellium/ext/podplugins/materialConsumptionPluginV2/controller/BomBrowse",
    "stellium/ext/podplugins/materialConsumptionPluginV2/controller/RoutingBrowse"
], function (BrowseBase, JSONModel, StatusFormatter, ObjectTypeFormatter, BomBrowse, RoutingBrowse) {
    "use strict";

    var MaterialBrowseType = BrowseBase.extend("stellium.ext.podplugins.materialConsumptionPluginV2.controller.MaterialBrowse", {

        statusFormatter: StatusFormatter,
        objectTypeFormatter: ObjectTypeFormatter,
        oMaterialBrowseDialog: undefined,

        /**
         * @override
         */
        populateSelectItems: function () {
            this.getDialog().setModel(new JSONModel(this.statusFormatter.getStatusList()), "materialStatusItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getProcurementTypeList()), "procurementTypeItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getMaterialTypeList()), "materialTypeItems");
            this.getDialog().setModel(new JSONModel(this.objectTypeFormatter.getMaterialTypeList()), "mrpControllerItems");
        },

        /**
         * @override
         */
        createResultData: function (oBindingContext,oClickedListItem) {
            oBindingContext = oClickedListItem.getBindingContext("product");
        	return {
        	    ref: oBindingContext.getProperty("ref"),
        	    material: oBindingContext.getProperty("material"),
                description: oBindingContext.getProperty("description"),
                materialType: oBindingContext.getProperty("materialType"),
        	    incrementBatchNumber: oBindingContext.getProperty("incrementBatchNumber"),
                version: oBindingContext.getProperty("version"),
                unitOfMeasure: oBindingContext.getProperty("unitOfMeasure"),
        	    productionStorageLocation: {
    			    ref: oBindingContext.getProperty("productionStorageLocation/ref"),
    			    plant: oBindingContext.getProperty("productionStorageLocation/plant"),
    			    storageLocation: oBindingContext.getProperty("productionStorageLocation/storageLocation")
    		    }
           };
        },

        onBomBrowse: function (oEvent) {
            var sValue = oEvent.getSource().getValue();
            BomBrowse.open(this.getDialog(), sValue, function (oSelectedObject) {
                this.byId("bomFilter").setValue(oSelectedObject.name);
                this.onFilterBarChange();
            }.bind(this));
        },

        onRoutingBrowse: function (oEvent) {
            var sValue = oEvent.getSource().getValue();
            RoutingBrowse.open(this.getDialog(), sValue, function (oSelectedObject) {
                this.byId("routingFilter").setValue(oSelectedObject.name);
                this.onFilterBarChange();
            }.bind(this));
        }
    });

    return {

        /**
         * Instantiates and opens value help dialog.
         * @param {sap.ui.core.Element} oParentControl - value help dialog will be set as dependent to it.
         * @param {String} sDefaultSearchValue - default value placed in a search field and a list is filtered by.
         * @param fnSelectionCallback - callback function called when user selects item in a list.
         */
        open: function (oParentControl, sDefaultSearchValue, fnSelectionCallback) {
            return new MaterialBrowseType("materialBrowse", {

                sFragmentName: "stellium.ext.podplugins.materialConsumptionPluginV2.view.browse.materialBrowse",
                oParentControl: oParentControl,
                sDefaultSearchValue: sDefaultSearchValue,
                fnSelectionCallback: fnSelectionCallback,
                oFilterSettings: {
                    aLiveSearchProperties: ["material"],
                    sListBindingPath: "/Materials",
                    sResultTableId: "resultTableAddMat",
                    aVariantFilterInfo: [
                        { sFilterItemName: "material" },
                        { sFilterItemName: "description" },
                        { sFilterItemName: "unitOfMeasure" },
                        { sFilterItemName: "bom", sSearchProperty: "bom/bom" },
                        { sFilterItemName: "routing", sSearchProperty: "routing/routing" },
                        { sFilterItemName: "dataToCollectAtAssembly", sSearchProperty: "assemblyDataType/dataType" },
                        { sFilterItemName: "materialGroup", sSearchProperty: "materialGroup/materialGroup" },
                        { sFilterItemName: "status" },
                        { sFilterItemName: "materialType" },
                        { sFilterItemName: "procurementType" },
                        { sFilterItemName: "lotSize", oFilterOperator: sap.ui.model.FilterOperator.EQ },
                        { sFilterItemName: "creationTimeRange", sSearchProperty: "createdDateTime" },
                        { sFilterItemName: "currentVersion", oFilterOperator: sap.ui.model.FilterOperator.Any },
                        { sFilterItemName: "mrpController" }
                    ]
                }
            });
        }
    };
});
