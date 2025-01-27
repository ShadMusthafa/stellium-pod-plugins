sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "stellium/ext/podplugins/packingPlugin/controller/extensions/CreateExtensionConstants",
    "stellium/ext/podplugins/packingPlugin/controller/CreatePackDialog",
    "stellium/ext/podplugins/packingPlugin/controller/extensions/Wrappers"
], function (ControllerExtension, CreateConstants, CreatePackDialog, Wrappers) {
    "use strict";

    /**
     * Constructor for the Packing Plugin Create Extension.
     * The following functions can be overridden by custom extensions:
     *<pre>
     *    createPackDialog()
     * </pre>
     *
     * @class
     * <code>stellium.ext.podplugins.packingPluginToshif.controller.extensions.CreateExtension</code> provides
     * functions that creates the list table and toolbar.  Custom extensions can be created to
     * override or modify core behaviour.
     *
     * @extends sap.ui.core.mvc.ControllerExtension
     *
     * @constructor
     * @public
     * @alias stellium.ext.podplugins.packingPluginToshif.controller.extensions.CreateExtension
     */
    let CreateExtension = ControllerExtension.extend("stellium.ext.podplugins.packingPluginToshif.controller.extensions.CreateExtension", {
        metadata: {
            methods: {
                createPackDialog: {
                    "final": false,
                    "public": true
                }

            }
        },
        constructor: function (sId, mSettings) {
            ControllerExtension.call(this, arguments);
        }
    });

    /**
     * Creates a CreatePackDialog used to provide UI for the user to create new Packing Unit ID.
     *
     * This function can be overridden by custom extensions as follows:
     *
     * <pre>
     *   For OverrideExecution.Instead:
     *      The oPackingUnitController object provides access to PluginViewController.
     *      This function must return the object with <code>open</code> method.
     *      <code>open</code> method is called by core plugin to show the dialog UI.
     *
     *      You can show any UI when the open method is called.
     *      Use following example code to update core plugin table once the Packing Unit is created.
     *    <code>
     *           this.getPackingCreateDialog().close();
     *           this.oParentController.showSuccessMessage(sMessage, true, true);
     *           this.oParentController.loadPackingUnitsList();
     *    </code>
     *
     *      createPackDialog: function(oPackingUnitController) {}
     *
     *   For OverrideExecution.Before:
     *      Method is called to notify extension developers that the standard CreatePackDialog is about to
     *      be created. You can setup some flags or call additional events here.
     *      The UI might not yet be opened. Return value is ignored. Standard CreatePackDialog
     *      <code>stellium.ext.podplugins.packingPluginToshif.controller.CreatePackdialog</code> will be used as a dialog.
     *
     *      createPackDialog: function(oPackingUnitController) {}
     *
     *   For OverrideExecution.After:
     *      Method is called to notify extension developers that the standard CreatePackDialog was just created.
     *      You can setup some flags or call additional events here.
     *      The UI might not yet be opened. Return value is ignored. Standard CreatePackDialog
     *      <code>stellium.ext.podplugins.packingPluginToshif.controller.CreatePackdialog</code> will be used as a dialog.
     *
     *      createPackDialog: function(oPackingUnitController) {}
     *</pre>
     *
     * @param {object} oPackingUnitController PackingUnits controller.
     * @returns {object} Object containing with following methods:
     *<pre>
     *   {
     *        open: a function called by core plugin to show the Create Pack UI.
     *   }
     *</pre>
     * @throws Error if error occurs during dialog creation
     * @public
     */
    CreateExtension.prototype.createPackDialog = function (oPackingUnitController) {
        return Wrappers.fnMetaCreateFnBinder({
            sEventName: CreateConstants.CREATE_PACK_DIALOG,
            oCustomExtension: this._getCustomExtension(),
            aArgs: [ oPackingUnitController ],
            fnBaseFunction: this._createStandardDialog,
            baseExecContext: this
        });
    };

    CreateExtension.prototype._createStandardDialog = function (oPackingUnitController) {
        const oDialog = new CreatePackDialog(oPackingUnitController);
        return oDialog;
    };

    CreateExtension.prototype._getCustomExtension = function () {
        if (!this._oCustomExtension) {
            this._oCustomExtension = this.base.getCustomControllerExtension(this, CreateConstants.EXTENSION_NAME);
        }
        return this._oCustomExtension;
    };

    return CreateExtension;
});
