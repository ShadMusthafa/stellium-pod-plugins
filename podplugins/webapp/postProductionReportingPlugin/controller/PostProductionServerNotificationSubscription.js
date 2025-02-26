sap.ui.define([
    "sap/dm/dme/podfoundation/serverevent/ServerNotificationSubscription",
    "stellium/ext/podplugins/postProductionReportingPlugin/controller/PostProductionNotificationConfig"
], function (ServerNotificationSubscription, PostProductionNotificationConfig) {
    "use strict";

    return ServerNotificationSubscription.extend("stellium.ext.podplugins.postProductionReportingPlugin.controller.PostProductionServerNotificationSubscription", {

        // Override to enable group subscription support.
        constructor: function(oViewController) {
            ServerNotificationSubscription.call(this, oViewController, true);
        },

        // Override to only create the Notifications object and not subscribe to the PodSelectionChanged event. Post-production
        // phase details loading triggers subscription update because subscriptions are based on phase planned work centers.
        init: function() {
            this._createNotificationsObject();
        },

        // Override to return the post production pod specific PostProductionNotificationConfig. PostProductionNotificationConfig restricts
        // subscriptions to only BACKFLUSH_FAILURE_MSG.
        _getNotificationConfiguration: function() {
            let oConfigData = this._getNotificationConfigurationData();
            return new PostProductionNotificationConfig(oConfigData);
        }
    });
});
