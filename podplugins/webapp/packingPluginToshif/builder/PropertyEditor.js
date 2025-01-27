sap.ui.define(
  [
    'sap/ui/model/resource/ResourceModel',
    'sap/dm/dme/podfoundation/control/PropertyEditor',
    'stellium/ext/podplugins/packingPlugin/util/PluginDefaultSettings',
    'sap/dm/dme/featureflag/FeatureFlagSettings'
  ],
  function(ResourceModel, PropertyEditor, PluginDefaultSettings, FeatureFlagSettings) {
    'use strict';

    const sAllowedSfcPropertyName = 'allowedSfcStatusesForPacking';
    const sAllowFromDiffOperations = 'allowMixedOperations';
    const sAllowMixedOrders = 'allowMixedOrders';
    const sShowWIPButton = 'showWIPButton';
    const sAllowAddConformantSfcToNonConformantPackingUnit = 'allowAddConformantSfcToNonConformantPackingUnit';
    const aValidTexts = [
      'enum.sfc.status.new',
      'enum.sfc.status.inQueue',
      'enum.sfc.status.active',
      'enum.sfc.status.done',
      'enum.sfc.status.hold'
    ];

    var oPropertyEditor = PropertyEditor.extend('stellium.ext.podplugins.packingPluginToshif.builder.PropertyEditor', {
      constructor: function(sId, mSettings) {
        PropertyEditor.apply(this, arguments);
        this.setI18nKeyPrefix('packingPlugin.');
        this.setResourceBundleName('stellium.ext.podplugins.packingPluginToshif.i18n.builder');
        this.setPluginResourceBundleName('stellium.ext.podplugins.packingPluginToshif.i18n.i18n');
      },

      handleSelectChange: function(sDataName, sSelectionValue) {
        let oData = this.getPropertyData();
        oData[sDataName] = sSelectionValue;
      },

      addPropertyEditorContent: function(oPropertyFormContainer) {
        let oData = this.getPropertyData();
        const oCustomExtension = this.getCustomExtension();
        if (oCustomExtension) {
          oCustomExtension.addPropertyEditorContentBefore(oPropertyFormContainer, oData);
        }

        if (oData[sAllowedSfcPropertyName] === undefined) {
          oData[sAllowedSfcPropertyName] = this.getDefaultPropertyData()[sAllowedSfcPropertyName];
        }
        if (oData[sAllowFromDiffOperations] === undefined) {
          oData[sAllowFromDiffOperations] = this.getDefaultPropertyData()[sAllowFromDiffOperations];
        }
        if (oData[sAllowMixedOrders] === undefined) {
          oData[sAllowMixedOrders] = this.getDefaultPropertyData()[sAllowMixedOrders];
        }

        if (oData[sShowWIPButton] === undefined) {
          oData[sShowWIPButton] = this.getDefaultPropertyData()[sShowWIPButton];
        }
        if (oData[sAllowAddConformantSfcToNonConformantPackingUnit] === undefined) {
          oData[sAllowAddConformantSfcToNonConformantPackingUnit] = this.getDefaultPropertyData()[
            sAllowAddConformantSfcToNonConformantPackingUnit
          ];
        }
        const aDefault = PluginDefaultSettings.allowedSfcStatusesForPacking;
        this.addSwitch(oPropertyFormContainer, 'autogenerateId', oData);
        this.addSwitch(oPropertyFormContainer, sAllowFromDiffOperations, oData);
        this.addSwitch(oPropertyFormContainer, sAllowMixedOrders, oData);
        this.addSwitch(oPropertyFormContainer, sAllowAddConformantSfcToNonConformantPackingUnit, oData);
        this.addMultiComboBox(oPropertyFormContainer, sAllowedSfcPropertyName, oData, aDefault, aValidTexts, true);

        FeatureFlagSettings.checkFeature('packing_wip_order').then(bIsEnabled => {
          if (bIsEnabled) {
            this.addSwitch(oPropertyFormContainer, sShowWIPButton, oData);
          }
        });

        if (oCustomExtension) {
          oCustomExtension.addPropertyEditorContentAfter(oPropertyFormContainer, oData);
        }
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
        const aDefaultValues = this.getDefaultPropertyData()[sDataFieldName] || [];
        oData[sDataFieldName] = aDefaultValues.map(oItem => ({
          key: oItem.key,
          value: aSelectionValues.includes(oItem.key)
        }));
      },

      getDefaultPropertyData: function() {
        let oData = Object.assign({}, PluginDefaultSettings);

        const oCustomExtension = this.getCustomExtension();
        if (oCustomExtension) {
          oData = oCustomExtension.getDefaultPropertyData(oData);
        }

        return oData;
      }
    });

    return oPropertyEditor;
  }
);
