sap.ui.define([], function () {
    "use strict";

    const fnGetDefault = () => [
        { key: "NEW", value: false },
        { key: "IN_QUEUE", value: true },
        { key: "ACTIVE", value: true },
        { key: "DONE", value: true },
        { key: "HOLD", value: false }
    ];

    const fnGetAllSfcStatuses = () => fnGetDefault().map(({ key, value }) => ({
        key: key,
        value: true
    }));

    return {
        getDefault: fnGetDefault,

        getAllSfcStatuses: fnGetAllSfcStatuses,

        /**
         * Creates payload ready JSON for statuses section.
         * @param {boolean} allowAll true if all statuses should be allowed
         * @param {[]} aConfigStatuses Array of statuses from POD Config
         * @returns {(string|*)[]} Array of allowed statuses
         */
        createAllowedSfcStatusesPayload: ({ allowAll = true, aConfigStatuses = []}) => {
            const aFromConfig = aConfigStatuses.length > 0 ? aConfigStatuses : fnGetDefault();
            const aStatuses = allowAll ? fnGetAllSfcStatuses() : aFromConfig;
            return aStatuses.filter(oStatus => oStatus.value).map(oStatus => oStatus.key);
        }
    };
}, true);
