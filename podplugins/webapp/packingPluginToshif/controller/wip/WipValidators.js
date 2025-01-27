sap.ui.define([], function () {
    "use strict";

    return {
        validateReturnablePackage: (oAuxData) => {
            const oMaterial = oAuxData.material;
            const bIsReturnablePackaging = oMaterial.materialType !== "RETURNABLE_PACKAGING";
            return { bIsValid: bIsReturnablePackaging };
        },

        validateSfcsInQueue: (oAuxData) => {
            const aSfcContent = oAuxData.content.filter((oContent) => !!oContent.sfc).map((oContent) => oContent.sfc);

            const aSfcsNotInQueue = [];
            aSfcContent.forEach((oSfc) => {
                if (oSfc.status !== "IN_QUEUE") {
                    aSfcsNotInQueue.push((oSfc.sfc));
                }
            });

            return {
                bIsValid: aSfcsNotInQueue.length < 1,
                aSfcsNotInQueue
            };
        },

        validateSameShopOrders: (oAuxData) => {
            const aSfcContent = oAuxData.content.filter((oContent) => !!oContent.sfc).map((oContent) => oContent.sfc);

            const oShopOrderSet = new Set();

            aSfcContent.forEach((oSfc) => {
                if (oSfc.shopOrder?.shopOrder) {
                    oShopOrderSet.add(oSfc.shopOrder.shopOrder);
                }
            });

            return {
                bIsValid: oShopOrderSet.size < 2,
                aShopOrders: Array.from(oShopOrderSet)
            };
        },

        validateFullSfcQtyPacked: (oAuxData) => {
            const aSfcContent = oAuxData.content.filter((oContent) => !!oContent.sfc);

            const oSfcsQtyMap = aSfcContent.reduce((oSfcsQtyMap, oSfc) => {
                const sSfc = oSfc.sfc.sfc;
                if (oSfcsQtyMap[sSfc]) {
                    oSfcsQtyMap[sSfc].packedQuantity += oSfc.quantity;
                } else {
                    oSfcsQtyMap[sSfc] = { quantity: oSfc.sfc.quantity, packedQuantity: oSfc.quantity };
                }
                return oSfcsQtyMap;
            }, {});

            const aInvalidSfcs = [];
            for (const [sSfc, oSfc] of Object.entries(oSfcsQtyMap)) {
                if (oSfc.quantity !== oSfc.packedQuantity) {
                    aInvalidSfcs.push(sSfc);
                }
            }

            return {
                bIsValid: aInvalidSfcs.length === 0,
                aSfcs: aInvalidSfcs
            };
        },

        validatePackingUnitsPacked: (oAuxData) => {
            const aPackedUnits = oAuxData.content.filter((oContent) => !!oContent.packingUnit).map((oUnit) => oUnit.packingUnit.number);

            return {
                bIsValid: aPackedUnits.length === 0,
                aPackedUnits
            };
        },

        validateSfcOperations: (oAuxData) => {
            const aSfcContent = oAuxData.content.filter((oContent) => !!oContent.sfc).map((oContent) => oContent.sfc);

            const aSfcsOnDifferentOperations = [];

            let sOperation;
            aSfcContent.forEach((oSfc) => {
                if (!sOperation) {
                    sOperation = oSfc.operation;
                } else {
                    if (sOperation !== oSfc.operation) {
                        aSfcsOnDifferentOperations.push(oSfc.sfc);
                    }
                }
            });

            return {
                bIsValid: aSfcsOnDifferentOperations.length === 0,
                aSfcs: aSfcsOnDifferentOperations,
                sOperation
            };
        }
    };
});
