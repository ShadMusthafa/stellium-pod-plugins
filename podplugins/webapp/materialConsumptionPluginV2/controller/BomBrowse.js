sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/dm/dme/controller/BrowseBase",
  "stellium/ext/podplugins/materialConsumptionPluginV2/controller/ComponentBrowse",
  "sap/dm/dme/formatter/StatusFormatter",
  "sap/dm/dme/formatter/ObjectTypeFormatter"
], function (JSONModel, BrowseBase, ComponentBrowse, StatusFormatter, ObjectTypeFormatter) {
  "use strict";

  var BomBrowseType = BrowseBase.extend("stellium.ext.podplugins.materialConsumptionPluginV2.controller.BomBrowse", {

      objectTypeFormatter: ObjectTypeFormatter,
      statusFormatter: StatusFormatter,

      /**
       * @override
       */
      populateSelectItems: function () {
          this.getDialog().setModel(new JSONModel(StatusFormatter.getStatusList()), "statusItems");
          this.getDialog().setModel(new JSONModel(ObjectTypeFormatter.getBomTypeList()), "bomTypeItems");
      },

      /**
       * @override
       */
      createResultData: function (oBindingContext,oClickedListItem) {
        oBindingContext = oClickedListItem.getBindingContext("product");
          return {
              ref: oBindingContext.getProperty("ref"),
              name: oBindingContext.getProperty("bom"),
              version: oBindingContext.getProperty("version")
          };
      },

      /**
       * @override
       */
      getExternalFilter: function () {
          var sName = this.byId("componentFilter").getValue();
          var sVersion = this.byId("componentVersionFilter").getValue();
          return this._createFilterByComponent(sName, sVersion);
      },

      onComponentBrowse: function (oEvent) {
          var sValue = oEvent.getSource().getValue();
          ComponentBrowse.open(this.getDialog(), sValue, function (oSelectedObject) {
              this.byId("componentFilter").setValue(oSelectedObject.name);
              this.byId("componentVersionFilter").setValue(oSelectedObject.version);
              this.onFilterBarChange();
          }.bind(this));
      },

      _createFilterByComponent: function (sName, sVersion) {
          var oFilterByName;
          var oFilterByVersion;
          var oConditionFilter;
          var oFilter;

          if (sName) {
              oFilterByName = new sap.ui.model.Filter({
                  path: "item/material/material",
                  operator: sap.ui.model.FilterOperator.StartsWith,
                  value1: sName
              });
          }

          if (sVersion) {
              oFilterByVersion = new sap.ui.model.Filter({
                  path: "item/material/version",
                  operator: sap.ui.model.FilterOperator.StartsWith,
                  value1: sVersion
              });
          }

          if (sName && sVersion) {
              oConditionFilter = new sap.ui.model.Filter([oFilterByName, oFilterByVersion], true);
          } else if (sName) {
              oConditionFilter = oFilterByName;
          } else if (sVersion) {
              oConditionFilter = oFilterByVersion;
          }

          if (oConditionFilter) {
              oFilter = new sap.ui.model.Filter({
                  path: "components",
                  operator: sap.ui.model.FilterOperator.Any,
                  variable: "item",
                  condition: oConditionFilter
              });
          }

          return oFilter;
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
          return new BomBrowseType("bomBrowse", {

              oModel: oModel,
              sFragmentName: "stellium.ext.podplugins.materialConsumptionPluginV2.view.browse.BomBrowse",
              oParentControl: oParentControl,
              sDefaultSearchValue: sDefaultSearchValue,
              fnSelectionCallback: fnSelectionCallback,
              oFilterSettings: {
                  aLiveSearchProperties: ["bom", "description"],
                  sListBindingPath: "/Boms",
                  aVariantFilterInfo: [
                      { sFilterItemName: "bom" },
                      { sFilterItemName: "description" },
                      { sFilterItemName: "status" },
                      { sFilterItemName: "bomType" },
                      { sFilterItemName: "creationTimeRange", sSearchProperty: "createdDateTime" },
                      { sFilterItemName: "currentVersion", oFilterOperator: sap.ui.model.FilterOperator.Any }
                  ]
              }
          });
      }
  };
});
