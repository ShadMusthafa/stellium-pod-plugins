sap.ui.define([
    "sap/dm/dme/podfoundation/extension/PluginControllerExtension",
    "sap/ui/core/mvc/OverrideExecution",
    "sap/dm/dme/podfoundation/controller/extensions/LifecycleExtensionConstants",
	"sap/ui/model/json/JSONModel",
    "sap/dm/dme/podfoundation/util/PodUtility"
], function (PluginControllerExtension, OverrideExecution, LifecycleConstants, JSONModel, PodUtility) {
    "use strict";

    return PluginControllerExtension.extend("stellium.ext.podplugins.orderPodSelectionExtensionProvider.LifecycleExtension", {
        constructor: function (oExtensionUtilities, oExtensionUtility) {
            this._oExtensionUtilities = oExtensionUtilities;
            this._oExtensionUtility = oExtensionUtility;
            this._bInitialized = false;
        },
     
        getOverrideExecution: function(sOverrideMember) {
            if (sOverrideMember === LifecycleConstants.ON_BEFORE_RENDERING) {
                return OverrideExecution.After;
            } else if (sOverrideMember === LifecycleConstants.ON_BEFORE_RENDERING_PLUGIN) {
                return OverrideExecution.After;
            } else if (sOverrideMember === LifecycleConstants.ON_AFTER_RENDERING) {
                return OverrideExecution.After;
            } else if (sOverrideMember === LifecycleConstants.ON_EXIT) {
                return OverrideExecution.After;
            };
            return null;
        },
        
        /**
         * Returns the name of the core extension this overrides
         *
         * @returns {string} core extension name
         * @public
         */
        getExtensionName: function () {
            return LifecycleConstants.EXTENSION_NAME;
        },

        onBeforeRendering: function(oEvent){
            if (!this._bInitialized) {
                let oConfiguration = this.getController().getConfiguration();
                if (oConfiguration) {
                    if (typeof oConfiguration.logToConsole !== "undefined") {
                        this._oExtensionUtilities.setLogToConsole(oConfiguration.logToConsole);
                    } else {
                        this._oExtensionUtilities.setLogToConsole(false);
                    }
                }
                // let oData = this._oExtensionUtility.getJsonData("sap/example/plugins/model/SuppliersModel.json");
                // let oModel = new JSONModel();
                // oModel.setData(oData);
                // this.getController().getView().setModel(oModel, "suppliers");
            }
            this._oExtensionUtilities.logMessage("LifecycleExtension.onBeforeRendering: Order POD Selection extension");
        },

        onBeforeRenderingPlugin: function(oEvent){
            this._oExtensionUtilities.logMessage("LifecycleExtension.onBeforeRenderingPlugin: Order POD Selection extension");
        },

        onAfterRendering: function(oEvent){
            this._oExtensionUtilities.logMessage("LifecycleExtension.onAfterRendering: Order POD Selection extension");
            let that = this;
            setTimeout(function() {
                // that._oExtensionUtility.loadOverflowToolbar(that.onHelpPress, that);
                that._oExtensionUtility.loadFilterBar(that.onCustomFilterPress, that);

                //Set values to original sfcStatusFilter control and publish events 
                that.getController().byId('sfcStatusFilter').setSelectedKeys(['404']);
                that.getController().byId('sfcStatusFilter').fireChange()
                that.getController().byId('sfcStatusFilter').fireChangeEvent()
                that.getController().publishChangeEvent("sfcStatusFilterChangeEvent",{"source": this, "selectedStatuses": ['404']});
                
                //Create and load the custom SFC status filter
                that._oExtensionUtility.loadCustomChargeStatusFilter(that.onCustomFilterPress, that);
            }, 1000);
        },

        onExit: function(oEvent){
            this._oExtensionUtilities.logMessage("LifecycleExtension.onExit: Order POD Selection extension");
        },

		onHelpPress: function (oEvent) {
            this._oExtensionUtility.showMessage("Help", "Select filters and press 'Go'", "To retrieve the order list, load required filters and press 'Go'");
		},

		onCustomFilterPress: function (oEvent) {
            let oInputField = oEvent.getSource();
            let sSupplier = oInputField.getValue();
            let oPodSelectionModel = this.getController().getPodSelectionModel();
            if (oPodSelectionModel) {
                if (!oPodSelectionModel.customData) {
                    oPodSelectionModel.customData = {};
                }
            }
            oPodSelectionModel.customData.supplier = sSupplier;
            if (PodUtility.isNotEmpty(sSupplier)) {
                this._oExtensionUtility.showMessageToast("Supplier '" + sSupplier + "' selected");
            }
		}
    })
});