sap.ui.define([ "sap/dm/dme/podfoundation/component/production/ProductionUIComponent" ], function(ProductionUIComponent) {
  "use strict";

  var Component = ProductionUIComponent.extend("stellium.ext.podplugins.materialConsumptionPluginV2.Component", {
      metadata : {
          manifest : "json"
      },

      init : function() {
          ProductionUIComponent.prototype.init.apply(this, arguments);
      },

      destroy : function() {
          ProductionUIComponent.prototype.destroy.apply(this, arguments);
      }

  });

  return Component;
});
