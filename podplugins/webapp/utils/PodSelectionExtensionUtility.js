sap.ui.define(
  [
    'sap/ui/base/Object',
    'sap/m/Button',
    'sap/m/Input',
    'sap/m/MessageBox',
    'sap/m/MessageToast',
    'sap/m/ToolbarSpacer',
    'sap/ui/comp/filterbar/FilterGroupItem',
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/util/PodUtility'
  ],
  function(BaseObject, Button, Input, MessageBox, MessageToast, ToolbarSpacer, FilterGroupItem, JSONModel, PodUtility) {
    'use strict';
    return BaseObject.extend('stellium.ext.podplugins.utils.PodSelectionExtensionUtility', {
      constructor: function() {
        this.aCustomFilters = [];
      },

      setPluginEventExtension: function(oExtension) {
        return (this.oPluginEventExtension = oExtension);
      },

      getCoreExtension: function(oExtension) {
        return this.oPluginEventExtension.getCoreExtension();
      },

      loadOverflowToolbar: function(fnFunction, fnContext) {
        let bShowHelp = this.getCoreExtension().getConfigurationValue('showHelp');
        if (bShowHelp) {
          let oOverflowToolbar = this.getCoreExtension().getOverflowToolbar();
          oOverflowToolbar.setVisible(true);
          oOverflowToolbar.addContent(new ToolbarSpacer());
          this.addActionButton(oOverflowToolbar, 'Emphasized', 'Help', fnFunction, fnContext);
        }
      },

      loadFilterBar: function(fnFunction, fnContext) {
        let bShowFilter = this.getCoreExtension().getConfigurationValue('showFilter');
        if (bShowFilter) {
          let oFilterBar = this.getCoreExtension().getFilterBar();
          let sSuggestionPath = 'suppliers>/SupplierCollection';
          let sItemTextBinding = '{suppliers>SupplierName}';
          let oInputFilter = this.createInputFilter(
            'customSupplierFilter',
            'Text',
            '{/supplierName}',
            'Supplier',
            0,
            '200px',
            sSuggestionPath,
            sItemTextBinding,
            fnFunction,
            fnContext
          );
          this.addFilter(oFilterBar, oInputFilter, 'INTERNAL_GROUP', 'SUPPLIER_NAME', 'Supplier', 'Supplier Name');
          this.aCustomFilters[this.aCustomFilters.length] = oInputFilter;
        }
      },

      loadCustomChargeStatusFilter: function(fnFunction, fnContext) {
        let bShowCustomChargeStatusFilter = this.getCoreExtension().getConfigurationValue('showCustomChargeStatus');
        if (!bShowCustomChargeStatusFilter) return;
        let oFilterBar = this.getCoreExtension().getFilterBar();
        let oInputFilter = new Input('customChargeStatus', {
          type: 'Text',
          value: 'Hold',
          editable: false,
          change: [fnFunction, fnContext]
        });

        this.addFilter(oFilterBar, oInputFilter, 'INTERNAL_GROUP', 'CUSTOM_CHARGE_STATUS', 'Charge Status', 'SFC Status');
        this.aCustomFilters[this.aCustomFilters.length] = oInputFilter;
      },

      addActionButton: function(oToolbar, sType, sText, fnFunction, fnContext) {
        let oActionButton = new Button({
          type: sType,
          text: sText,
          press: [fnFunction, fnContext]
        });
        oToolbar.addContent(oActionButton);
      },

      createInputFilter: function(
        sId,
        sType,
        sBinding,
        sPlaceHolder,
        sMaxLength,
        sWidth,
        sSuggestionPath,
        sItemTextBinding,
        fnFunction,
        fnContext
      ) {
        let bShowSuggestion = false;
        if (PodUtility.isNotEmpty(sSuggestionPath)) {
          bShowSuggestion = true;
        }
        let oSuggestionItems = null;
        if (PodUtility.isNotEmpty(sItemTextBinding)) {
          oSuggestionItems = {
            path: sSuggestionPath,
            template: new sap.ui.core.Item({ text: sItemTextBinding })
          };
        }
        return new Input(sId, {
          type: sType,
          value: sBinding,
          placeholder: sPlaceHolder,
          maxLength: sMaxLength,
          width: sWidth,
          showSuggestion: bShowSuggestion,
          showValueHelp: false,
          change: [fnFunction, fnContext],
          suggestionItems: oSuggestionItems
        });
      },

      addFilter: function(oFilterBar, oFilterControl, sGroupName, sName, sLabel, sTooltip) {
        let oFilterGroupItem = new FilterGroupItem({
          groupName: sGroupName,
          visibleInFilterBar: true,
          partOfCurrentVariant: false,
          mandatory: false,
          name: sName,
          label: sLabel,
          labelTooltip: sTooltip,
          visible: true
        });
        oFilterGroupItem.setControl(oFilterControl);
        oFilterBar.addFilterGroupItem(oFilterGroupItem);
      },

      getCustomFilterControls: function() {
        return this.aCustomFilters;
      },

      showMessage: function(sTitle, sMessage, sDetails) {
        MessageBox.information(sMessage, {
          title: sTitle,
          id: 'messageBoxId1',
          details: sDetails,
          contentWidth: '100px'
        });
      },

      showMessageToast: function(sMessage) {
        MessageToast.show(sMessage);
      },

      getJsonData: function(sPath) {
        let oModel = new JSONModel();
        oModel.loadData(sap.ui.require.toUrl(sPath), null, false);
        return oModel.getData();
      }
    });
  }
);
