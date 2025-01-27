sap.ui.define([
    "./SfcAllowedStatuses" ],
function (SfcAllowedStatuses) {
    "use strict";

    return {
        autogenerateId: false,
        allowedSfcStatusesForPacking: SfcAllowedStatuses.getDefault(),
        allowMixedOperations: true,
        allowMixedOrders: true,
        allowAddConformantSfcToNonConformantPackingUnit: true,
        showWIPButton: false
    };
}, true);
