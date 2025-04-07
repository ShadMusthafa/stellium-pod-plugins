sap.ui.define(['sap/ui/model/resource/ResourceModel', 'sap/dm/dme/podfoundation/control/PropertyEditor'], function(
  ResourceModel,
  PropertyEditor
) {
  'use strict';

  return PropertyEditor.extend('stellium.ext.podplugins.materialConsumptionPlugin.builder.PropertyEditor', {
    constructor: function(sId, mSettings) {
      PropertyEditor.apply(this, arguments);
      this.setI18nKeyPrefix('materialConsumptionConfig.');
      this.setResourceBundleName('stellium.ext.podplugins.materialConsumptionPlugin.i18n.builder');
      this.setPluginResourceBundleName('stellium.ext.podplugins.materialConsumptionPlugin.i18n.i18n');
    },

    addPropertyEditorContent: function(oPropertyFormContainer) {
      var oData = this.getPropertyData();

      this.addSwitch(oPropertyFormContainer, 'showAddButton', oData);
      this.addSwitch(oPropertyFormContainer, 'showScanButton', oData);
      this.addSwitch(oPropertyFormContainer, 'autoOpenScanPopup', oData);
      this.addSwitch(oPropertyFormContainer, 'allowFreeTextForBatch', oData);
      this.addSwitch(oPropertyFormContainer, 'showCoByProduct', oData);
      this.addSwitch(oPropertyFormContainer, 'showAlternateBomComponents', oData);

      this.addInputField(oPropertyFormContainer, 'charcForAdvSearch', oData);
      this.addInputField(oPropertyFormContainer, 'customField1', oData);

      this.addSwitch(oPropertyFormContainer, 'allowWeighWithoutTolerance', oData);

      this._oActionButtonSelect = this.initializedActionButtons(oPropertyFormContainer, 'selectActionButtonId', oData);
      //For Weigh-Dispense
      this.addSwitch(oPropertyFormContainer, 'showWeighingSetZero', oData);
      this.addSwitch(oPropertyFormContainer, 'showWeighingConfirm', oData);
      this.addSwitch(oPropertyFormContainer, 'showWeighingAddWeight', oData);
      this.addInputField(oPropertyFormContainer, 'charcSetZeroIndicator', oData);
      this.addSwitch(oPropertyFormContainer, 'showWeighingSetTare', oData);
      this.addInputField(oPropertyFormContainer, 'charcSetTareIndicator', oData);
      this.addInputField(oPropertyFormContainer, 'charcTareWeightIndicator', oData);
      this.addInputField(oPropertyFormContainer, 'charcWeighingIndicatorName', oData);
      this.addInputField(oPropertyFormContainer, 'charcUOMIndicatorName', oData);
      // End of For Weigh-Dispense
    },

    handleInputChange: function(sDataFieldName, sValue, oSource) {
      var oData = this.getPropertyData();
      if (sDataFieldName !== 'customField1') {
        var isValid = this.validateInputRegEx(sValue);
        if (!isValid) {
          oSource.setValueState(sap.ui.core.ValueState.Error);
          oSource.setValueStateText(this.getI18nText('materialConsumptionConfig.invalidCharcName'));
        } else if (sValue.split(',').length > 4) {
          oSource.setValueState(sap.ui.core.ValueState.Error);
          oSource.setValueStateText(this.getI18nText('materialConsumptionConfig.charcNameLimit'));
        } else {
          oData[sDataFieldName] = sValue;
          oSource.setValueState(sap.ui.core.ValueState.None);
          oSource.setValueStateText('');
        }
      } else {
        oData[sDataFieldName] = sValue;
      }
    },

    validateInputRegEx: function(sInputValue) {
      //Regex for Valid Characters
      var regex = /^[A-Za-z0-9_,]+$/;
      var isValidInput = true;
      if (sInputValue) {
        if (!sInputValue.match(regex)) {
          isValidInput = false;
        }
      }
      return isValidInput;
    },

    handleSelectChange: function(sDataFieldName, sSelectionValue) {
      var oData = this.getPropertyData();
      oData[sDataFieldName] = sSelectionValue;
    },

    handleSwitchChange: function(sDataName, bSelected) {
      var oData = this.getPropertyData();
      oData[sDataName] = bSelected;
    },

    getDefaultPropertyData: function() {
      var oData = {
        showAddButton: true,
        showScanButton: true,
        autoOpenScanPopup: false,
        allowFreeTextForBatch: false,
        charcForAdvSearch: '',
        showCoByProduct: false,
        customField1: '',
        selectActionButtonId: '',
        showAlternateBomComponents: false,
        allowWeighWithoutTolerance: true,
        showWeighingSetZero: false,
        showWeighingConfirm: false,
        showWeighingAddWeight: false,
        showWeighingSetTare: false
      };
      return oData;
    }
  });
});
