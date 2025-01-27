sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "stellium/ext/podplugins/packingPlugin/controller/extensions/PluginEventExtensionConstants",
    "stellium/ext/podplugins/packingPlugin/controller/extensions/Wrappers"
], function (ControllerExtension, Constants, Wrappers) {
    "use strict";

    /**
     * Constructor for the Packing plugin Event Extension.
     * The following functions can be overridden by custom extensions:
     *<pre>
     *    onPackingUnitChangeEvent()
     *    onPackPressEvent()
     *    onUnpackPressEvent()
     * @class
     * <code>stellium.ext.podplugins.packingPluginToshif.controller.extensions.PluginEventExtension</code> provides
     * functions that handles plugin events.  Custom extensions can be created to
     * override or modify core behaviour.
     *
     * @extends sap.ui.core.mvc.ControllerExtension
     *
     * @constructor
     * @public
     * @alias stellium.ext.podplugins.packingPluginToshif.controller.extensions.PluginEventExtension
     */
    let PluginEventExtension = ControllerExtension.extend("stellium.ext.podplugins.packingPluginToshif.controller.extensions.PluginEventExtension", {
        metadata: {
            methods: {
                onPackingUnitChangeEvent: { "final": false, "public": true },
                onPackPressEvent: { "final": false, "public": true },
                onUnpackPressEvent: { "final": false, "public": true }
            }
        }
    });

    /**
     * Event handler for Packing Unit Update event.  This function
     * can be overridden by custom extensions as follows for OverrideExecution.Instead,
     * OverrideExecution.Before and OverrideExecution.After.
     *
     * @param { oPackingUnit } Payload Packing Unit Payload Object
     * @returns {Promise} Must always return a Promise.
     * If overridden then returns the overridden promise result.
     * If executed before then the overridden return value is ignored.
     * If executed after then the core execution logic is executed, the overridden
     * event handler is called regardless of the resolved/failed core Promise result.
     * @public
     */
    PluginEventExtension.prototype.onPackingUnitChangeEvent = function ({ oPackingUnit }) {
        return Wrappers.fnMetaAsyncEventBinder.call(this, {
            sEventName: Constants.ON_PACKING_UNIT_CHANGE_EVENT,
            baseExecContext: this.base,
            aArgs: arguments,
            fnBaseFunction: this.base.processPackingUnitChangeEvent,
            oCustomExtension: this._getCustomExtension()
        });
    };

    /**
     * Event handler for the event when user presses Pack button.
     * The core logic uses another event onPackingUnitChangeEvent to notify extension when
     * the packing unit is about to be updated and the whole payload is prepared.
     * If this event handler is extended <strong>Instead</strong> then the core onPackingUnitChangeEvent is not called.
     * @public
     */
    PluginEventExtension.prototype.onPackPressEvent = function () {
        Wrappers.fnMetaEventBinder.call(this, {
            sEventName: Constants.ON_PACK_PRESS_EVENT,
            baseExecContext: this.base,
            aArgs: arguments,
            fnBaseFunction: this.base.processOnPackPressEvent,
            oCustomExtension: this._getCustomExtension()
        });
    };

    /**
     * Event handler for the event when user presses Unpack button.
     * The core logic uses another event onPackingUnitChangeEvent to notify extension when
     * the packing unit is about to be updated and the whole payload is prepared.
     * If this event handler is extended <strong>Instead</strong> then the core onPackingUnitChangeEvent is not called.
     * @public
     */
    PluginEventExtension.prototype.onUnpackPressEvent = function () {
        Wrappers.fnMetaEventBinder.call(this, {
            sEventName: Constants.ON_UNPACK_PRESS_EVENT,
            baseExecContext: this.base,
            aArgs: arguments,
            fnBaseFunction: this.base.processOnUnpackPressEvent,
            oCustomExtension: this._getCustomExtension()
        });
    };

    PluginEventExtension.prototype._getCustomExtension = function () {
        if (!this._oCustomExtension) {
            this._oCustomExtension = this.base.getCustomControllerExtension(this, Constants.EXTENSION_NAME);
        }
        return this._oCustomExtension;
    };

    return PluginEventExtension;
});
