sap.ui.define(['sap/dm/dme/podfoundation/control/PropertyEditor'], function(PropertyEditor) {
  'use strict';

  const aResourceStatus = [
    {
      key: 'UNKNOWN',
      value: false
    },
    {
      key: 'PRODUCTIVE',
      value: true
    },
    {
      key: 'SCHEDULED_DOWN',
      value: false
    },
    {
      key: 'UNSCHEDULED_DOWN',
      value: false
    },
    {
      key: 'ENABLED',
      value: true
    },
    {
      key: 'DISABLED',
      value: false
    }
  ];

  const aResourceStatusTexts = [
    'enum.resource.status.unknown',
    'enum.resource.status.productive',
    'enum.resource.status.scheduledDown',
    'enum.resource.status.unscheduledDown',
    'enum.resource.status.enabled',
    'enum.resource.status.disabled'
  ];

  const sAllowedStatusesForAssignment = 'allowedResourceStatusesForAssignment';
  const sDefaultAcceptanceDelay = 'defaultAcceptanceDelay';
  const sDefaultCorrectionTime = 'defaultCorrectionTime';

  var oPropertyEditor = PropertyEditor.extend('stellium.ext.podplugins.massOperatorAssignmentPlugin.builder.PropertyEditor', {
    constructor: function(sId, mSettings) {
      PropertyEditor.apply(this, arguments);
      this.setI18nKeyPrefix('massOperatorAssignmentPlugin.');
      this.setResourceBundleName('stellium.ext.podplugins.massOperatorAssignmentPlugin.i18n.builder');
      this.setPluginResourceBundleName('stellium.ext.podplugins.massOperatorAssignmentPlugin.i18n.i18n');
    },

    addPropertyEditorContent: function(oPropertyFormContainer) {
      var oData = this.getPropertyData();
      this.addSwitch(oPropertyFormContainer, 'closeButtonVisible', oData);

      if (oData[sAllowedStatusesForAssignment] === undefined) {
        oData[sAllowedStatusesForAssignment] = this.getDefaultPropertyData()[sAllowedStatusesForAssignment];
      }
      this.addMultiComboBox(oPropertyFormContainer, sAllowedStatusesForAssignment, oData, aResourceStatus, aResourceStatusTexts, true);

      this.addInputField(oPropertyFormContainer, sDefaultAcceptanceDelay, 1);
      this.addInputField(oPropertyFormContainer, sDefaultCorrectionTime, 1);
    },

    getDefaultPropertyData: function() {
      var oData = {
        closeButtonVisible: false,
        allowedResourceStatusesForAssignment: aResourceStatus,
        defaultAcceptanceDelay: 1,
        defaultCorrectionTime: 1
      };

      return oData;
    },

    /**
     * Handles MultiComboBox control change event
     * Update the appropriate property with new true/false 'value' properties.
     * @param {string} sDataFieldName name of data property
     * @param {Array.<{key: Object, value: bool}>} aSelectionValues selection value
     * @protected
     */
    handleMultiComboBoxChange: function(sDataFieldName, aSelectionValues) {
      aSelectionValues = aSelectionValues || [];
      let oData = this.getPropertyData();
      //   oData[sDataFieldName] = aSelectionValues;
      const aDefaultValues = this.getDefaultPropertyData()[sDataFieldName] || [];
      oData[sDataFieldName] = aDefaultValues.map(oItem => ({
        key: oItem.key,
        value: aSelectionValues.includes(oItem.key)
      }));
    }
  });

  return oPropertyEditor;
});
