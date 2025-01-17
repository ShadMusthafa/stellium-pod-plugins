sap.ui.define(
  [
    'sap/dm/dme/podfoundation/extension/PluginExtensionProvider',
    'stellium/ext/podplugins/orderPodSelectionExtensionProvider/LifecycleExtension',
    "stellium/ext/podplugins/orderPodSelectionExtensionProvider/PluginEventExtension",
    "stellium/ext/podplugins/orderPodSelectionExtensionProvider/PropertyEditorExtension",
    'stellium/ext/podplugins/utils/ExtensionUtilities',
    'stellium/ext/podplugins/utils/PodSelectionExtensionUtility'
  ],
  function(
    PluginExtensionProvider,
    LifecycleExtension,
    PluginEventExtension,
    PropertyEditorExtension,
    ExtensionUtilities,
    ExtensionUtility
  ) {
    'use strict';
    return PluginExtensionProvider.extend('stellium.ext.podplugins.orderPodSelectionExtensionProvider.ExtensionProvider', {
      constructor: function() {
        this.oExtensionUtilities = new ExtensionUtilities();
        this.oExtensionUtility = new ExtensionUtility();
      },
      getExtensions: function() {
        let oLifecycleExtension = new LifecycleExtension(this.oExtensionUtilities, this.oExtensionUtility);
        let oPluginEventExtension = new PluginEventExtension(this.oExtensionUtilities, this.oExtensionUtility);
        this.oExtensionUtility.setPluginEventExtension(oPluginEventExtension);
        let oPropertyEditorExtension = new PropertyEditorExtension(this.oExtensionUtilities);
        return [oLifecycleExtension, oPluginEventExtension, oPropertyEditorExtension];
        // return [oLifecycleExtension];
      }
    });
  }
);
