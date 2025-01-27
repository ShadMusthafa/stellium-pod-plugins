sap.ui.define([
    "sap/dm/dme/model/AjaxUtil"
], function (AjaxUtil) {
    "use strict";

    return {
        postCreateWipOrder: async ({
            sPackingUnitId,
            sPlant,
            sServiceRoot
        }) => {
            const sUrlSuffix = "wipPackingUnits/sendEwmStorageRequest";
            return new Promise((resolve, reject) => {
                AjaxUtil.post(`${sServiceRoot}${sUrlSuffix}`, {
                    plant: sPlant,
                    id: sPackingUnitId
                }, (oResponse) => {
                    resolve(oResponse.id);
                },
                (oError, sError) => {
                    if (oError && oError.error) {
                        reject(oError.error.message);
                    } else {
                        reject(sError);
                    }
                });
            });
        }
    };
});
