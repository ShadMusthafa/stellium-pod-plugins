sap.ui.define([
    "sap/dm/dme/formatter/GeneralFormatter",
    "sap/dm/dme/formatter/NumberFormatter",
    "sap/dm/dme/constants/DMCConstants"
], function (GeneralFormatter, NumberFormatter, DMCConstants) {
    "use strict";

    function _formatWithUom (oValue, sUom) {
        return sUom ? `${oValue} ${sUom}` : (oValue || "0");
    }

    return {
        formatContentQuantity: function (nLength) {
            return nLength ? NumberFormatter.formatFloatNumber(nLength) : 0;
        },

        getObjectName: function (oPackingUnitContent) {
            let sTitleKey = oPackingUnitContent.sfc ? oPackingUnitContent.sfc.sfc
                : oPackingUnitContent.packingUnit.number;
            return GeneralFormatter.getTitle(sTitleKey);
        },

        getObjectType: function (oPackingUnitContent) {
            return oPackingUnitContent.sfc ? this.getI18nText("enum.packedItemType.SFC")
                : this.getI18nText("enum.packedItemType.PackingUnit");
        },

        getShopOrderName: function (oPackingUnitContent) {
            return oPackingUnitContent.sfc ? oPackingUnitContent.sfc.shopOrder.shopOrder
                : "";
        },

        getMaterialName: function (oPackingUnitContent) {
            return oPackingUnitContent.sfc ? oPackingUnitContent.sfc.material.material
                : oPackingUnitContent.packingUnit.material.material;
        },

        getMaterialDescription: function (oPackingUnitContent) {
            return oPackingUnitContent.sfc ? oPackingUnitContent.sfc.material.description
                : oPackingUnitContent.packingUnit.material.description;
        },

        getMaterialType: function (sMaterialType) {
            switch (sMaterialType) {
            case "PACKAGING": return this.getI18nText("packing.materialType.packaging");
            case "RETURNABLE_PACKAGING": return this.getI18nText("packing.materialType.returnable");
            default: return sMaterialType;
            }
        },

        getPackingTypeText: function (sPackingTypeText) {
            switch (sPackingTypeText) {
            case "CONFORMANT": return this.getI18nText("enum.packageType.conformant");
            case "NONCONFORMANT": return this.getI18nText("enum.packageType.nonconformant");
            default: return null;
            }
        },

        getStatusState: function (sStatusText) {
            switch (sStatusText) {
            case "IN_QUEUE": return "sap-icon://circle-task-2";
            case "HOLD": return "sap-icon://status-negative";
            case "ACTIVE": return "sap-icon://color-fill";
            case "NEW": return "sap-icon://rhombus-milestone-2";
            case "DONE": return "sap-icon://complete";
            default: return "circle-task-2";
            }
        },

        getIconColor: function (sStatusText) {
            switch (sStatusText) {
            case "IN_QUEUE": return "Neutral";
            case "ACTIVE": return "Positive";
            case "DONE": return "Positive";
            default: return "Neutral";
            }
        },

        getUnitStatusIcon: function (sStatusText) {
            switch (sStatusText) {
            case "CLOSED": return "sap-icon://status-negative";
            case "UNLOADED": return "sap-icon://status-critical";
            default: return "sap-icon://status-positive";
            }
        },

        getUnitStatusIconColor: function (sStatusText) {
            switch (sStatusText) {
            case "CLOSED": return "Negative";
            case "UNLOADED": return "Critical";
            default: return "Positive";
            }
        },

        /**
         * Prints qty and UoM together
         * Automatically converts double values to integer if UoM is not-dividable (EA, PC, etc)
         * @param sSfcQty
         * @param sMaterialUom
         * @param sOrderUom
         * @param sErpOrderUom
         * @returns {string|*}
         */
        getSfcQtyWithUom: function (sSfcQty, sMaterialUom, sOrderUom, sErpOrderUom) {
            sSfcQty = sSfcQty || "0";
            let sUom = sMaterialUom || sOrderUom || sErpOrderUom;
            let sFormattedQty = NumberFormatter.dmcLocaleQuantityFormatterDisplay(sSfcQty, sUom, {
                minFractionDigits: 0, maxFractionDigits: 3 });

            if (!sFormattedQty && (DMCConstants.uomEach.indexOf(sUom) >= 0)) {
                sFormattedQty = NumberFormatter.dmcLocaleFloatNumberFormatter(sSfcQty, {
                    minFractionDigits: 0, maxFractionDigits: 3 });
            }
            return _formatWithUom(sFormattedQty, sUom);
        },

        /**
         * Reads packing unit content object data.
         * Find Unit of Measure depending on packing unit type - SFC or another packing unit.
         * @param {Object} oUnitObjectData part of response for packing unit details
         * @returns {String} first is qty value and second element is Unit of Measure (if found)
         */
        getAssignedQtyWithUom: function (oUnitObjectData) {
            let iSfcQty = oUnitObjectData.quantity;
            let bIsSfc = !!oUnitObjectData.sfc;
            let sRootUom = oUnitObjectData.unitOfMeasure;
            let sMaterialUom = bIsSfc ? oUnitObjectData.sfc.material.unitOfMeasure : null;
            let sOrderUom = bIsSfc ? oUnitObjectData.sfc.shopOrder.productionUnitOfMeasure : null;
            let sErpOrderUom = bIsSfc ? oUnitObjectData.sfc.shopOrder.erpUnitOfMeasure : null;
            let sSfcUom = sMaterialUom || sOrderUom || sErpOrderUom;

            let sPackingUnitUom = oUnitObjectData.packingUnit && oUnitObjectData.packingUnit.material.unitOfMeasure;

            let sUom = sRootUom || sSfcUom || sPackingUnitUom;
            let sFormattedQty = Number.isInteger(iSfcQty) ? NumberFormatter.dmcLocaleIntNumberFormatter(iSfcQty) : NumberFormatter.dmcLocaleFloatNumberFormatter(iSfcQty);
            return _formatWithUom(sFormattedQty, sUom);
        },

        getNullableCapacityValue: function (fCapacityValue) {
            return fCapacityValue !== null ? parseFloat(fCapacityValue) : null;
        },

        getCapacityPercentageValue: function (fCurrentCapacity, fAllowedCapacity) {
            let fResult = (fCurrentCapacity * 100) / fAllowedCapacity;
            return isNaN(fResult) ? 0 : parseFloat(fResult.toFixed(3));
        },

        getCapacityDisplayValue: function (fCurrentCapacity, fAllowedCapacity) {
            let fResult = (fCurrentCapacity * 100) / fAllowedCapacity;
            let sDisplayValue = isNaN(fResult) ? 0 : parseFloat(fResult.toFixed(3));
            return sDisplayValue + "%";
        },

        getCapacityDisplayText: function (sDisplayTextKey, fCurrentCapacity, sCapacityUom, fMaximumCapacity) {
            fCurrentCapacity = (fCurrentCapacity >= 0) && (fCurrentCapacity !== null) ? parseFloat(fCurrentCapacity.toFixed(3)) : 0;
            let fDisplayedCurrentCapacity = NumberFormatter.dmcLocaleFloatNumberFormatter(fCurrentCapacity, {
                maxFractionDigits: 3, minFractionDigits: 0 });
            let fDisplayedMaximumCapacity = NumberFormatter.dmcLocaleFloatNumberFormatter(fMaximumCapacity, {
                maxFractionDigits: 3, minFractionDigits: 0 });
            return this.getI18nText(sDisplayTextKey, [fDisplayedCurrentCapacity, sCapacityUom, fDisplayedMaximumCapacity]);
        },

        getSfcQtyDisplayText: function (sDisplayTextKey, fCurrentCapacity, fMaximumCapacity) {
            fCurrentCapacity = (fCurrentCapacity >= 0) && (fCurrentCapacity !== null) ? parseFloat(fCurrentCapacity.toFixed(3)) : 0;
            let fDisplayedCurrentCapacity = NumberFormatter.dmcLocaleFloatNumberFormatter(fCurrentCapacity, {
                maxFractionDigits: 3, minFractionDigits: 0 });
            let fDisplayedMaximumCapacity = NumberFormatter.dmcLocaleFloatNumberFormatter(fMaximumCapacity, {
                maxFractionDigits: 3, minFractionDigits: 0 });
            return this.getI18nText(sDisplayTextKey, [fDisplayedCurrentCapacity, fDisplayedMaximumCapacity]);
        },

        /**
         *
         * @param {String} sUom Unit of Measure
         * @returns {boolean} returns true if Unit of Measure can have frictional part. False otherwise.
         */
        isNonDividableUoM: function (sUom) {
            return DMCConstants.uomEach.indexOf(sUom) >= 0;
        }
    };
}, true);
