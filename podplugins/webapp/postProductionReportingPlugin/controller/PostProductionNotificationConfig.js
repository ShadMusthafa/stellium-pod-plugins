/**
 * Post Production POD notification configuration allowing BACKFLUSH_FAILURE_MSG events. For PP_ACTION, it is taken
 * care separately.
 */
sap.ui.define([
    "sap/dm/dme/serverevent/NotificationConfig",
    "sap/dm/dme/serverevent/Topic"
], function (NotificationConfig, Topic) {
    "use strict";

    return NotificationConfig.extend("stellium.ext.podplugins.postProductionReportingPlugin.controller.PostProductionNotificationConfig", {

        _addTopics: function(oNotificationConfigData) {
            let aTopics = [];
            //Backflush notification event is always true if subscription for the workcenter is enabled.
            //Hence, not checking for backflushFailureMessageNotification explicitly.
            aTopics.push(Topic.BACKFLUSH_FAILURE_MSG);
            return aTopics;
        }
    });
});
