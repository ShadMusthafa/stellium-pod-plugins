/**
 * Constants for Create Extension
 */
sap.ui.define(function () {
    "use strict";

    return {

        /**
         * Name for the Create extension
         */
        EXTENSION_NAME: "createExtension",

        /**
         * This function creates the CreatePackDialog used to create new Packing Unit item.
         * The function argument is the PackingUnitsController stellium.ext.podplugins.packingPluginToshif.controller.CreatePackDialog
         * <pre>
         *   For OverrideExecution.Instead:
         *      createPackDialog: function(oPackingUnitsController) {}
         *
         *   For OverrideExecutionBefore:
         *      createPackDialog: function(oPackingUnitsController) {}
         *
         *   For OverrideExecution.After:
         *      createPackDialog: function(oPackingUnitsController) {}
         *</pre>
         */
        CREATE_PACK_DIALOG: "createPackDialog"
    };
});
