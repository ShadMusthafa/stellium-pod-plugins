sap.ui.define([
    "sap/dm/dme/podfoundation/component/production/ProductionUIComponent"
], function(ProductionUIComponent) {
    "use strict";

    /**
     * 
     */
    var Component = ProductionUIComponent.extend("stellium.ext.podplugins.postProductionReportingPlugin.Component", {
        metadata : {
            manifest : "json"
        }
    });

    return Component;
});