sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/format/NumberFormat",
    "sap/dm/dme/formatter/DateTimeUtils",
    "sap/dm/dme/formatter/NumberFormatter",
    "sap/dm/dme/constants/DMCConstants",
    "sap/dm/dme/util/PlantSettings"
], function(DateFormat, NumberFormat, DateTimeUtils,NumberFormatter, DMCConstants, PlantSettings) {
    var formatter = {

        formatTitle: function(orderSelectionType, showMultipleSfcsEnabled, order, sfc) {
            if(showMultipleSfcsEnabled === true) {
                if(orderSelectionType === 'PROCESS') {
                    return this.getI18nText('orderID') + ' - ' + order + ' / ' + this.getI18nText('chargeID') + ' - ' + sfc;
                } else {
                    return this.getI18nText('orderID') + ' - ' + order + ' / ' + this.getI18nText('sfcID') + ' - ' + sfc;
                }
            } else {
                return this.getI18nText('orderID') + ' - ' + order;
            }
        },

        formatDate: function(startDate, completionDate) {
            if (startDate && completionDate) {
                return DateTimeUtils.dmcFormatDateInterval(startDate, completionDate);
            } else if (startDate) {
                return this.formatDateTime(startDate);
            }
            return "";
        },

        formatDateTime: function(vDate) {
            var timezone=DateTimeUtils.getBrowserTimezone();
            var parseDate=DateTimeUtils.dmcParseDate(vDate);
            var formattedDate=DateTimeUtils.dmcDateTimeFormatterFromUTC(parseDate,timezone);
            return formattedDate;
        },

        formatDateTimeFromUTC: function(vDate) {
            if(!vDate) return;
            var parseDate = vDate.replace(/ /g,"T").concat("Z");
            return DateTimeUtils.dmcDateTimeFormatterFromUTC(parseDate);
        },

        //This is used for data collection list plugin, display date time in the view post popup.
        dmcDateTimeFormatterFromUTC: function(dateTime){
            var formattedDateTime = DateTimeUtils.dmcDateTimeFormatterFromUTC(dateTime, null, "medium");
            return formattedDateTime;
        },

        formatUTCDateTimeToPlantTimeZone: function(vDate) {
            var parseDate=DateTimeUtils.dmcParseDate(vDate);
            return DateTimeUtils.dmcDateTimeFormatterFromUTC(DateTimeUtils.dmcDateToUTCFormat(parseDate, "UTC"));
        },

        //We are converting plant time to UTC time and the format should be "yyyy-MM-dd HH:mm:ss" as the API expects
        //in this format only. Also DateTimeUtils doesn't have a function to get the UTC date time in above format.
        formatPlantDateTimeToUTCTimeZone : function (date){
            let postedDateTime = new Date(moment.tz(date, PlantSettings.getTimeZone()).format());
            return DateFormat.getDateInstance({ pattern: "yyyy-MM-dd HH:mm:ss", UTC: true }).format(postedDateTime);
        },

        getDateTimeInPlantTimeZone: function(dateTime) {
            var sdate = DateTimeUtils.dmcDateToUTCFormat(dateTime,"UTC");
            return DateTimeUtils.dmcDateTimeFormatterFromUTC(sdate, PlantSettings.getTimeZone(), null);
        },

        showActivityIdWithText: function(activityId, activityText) {
            if (activityText) {
                return activityId + " (" + activityText + ")";
            }
            return activityId;
        },

        getPercentValue: function(plannedQty, completedQty, plannedQtyInProductionUom, completedQtyInProductionUom, productionCommercialUom) {

            var actualPlannedQty, actualCompletedQty;
            if (plannedQtyInProductionUom && productionCommercialUom) {
                actualPlannedQty = plannedQtyInProductionUom;
                actualCompletedQty = completedQtyInProductionUom;
            } else {
                actualPlannedQty = plannedQty;
                actualCompletedQty = completedQty;
            }
            var percentValue = (parseFloat(actualCompletedQty) / parseFloat(actualPlannedQty)) * 100;
            return Math.floor(percentValue);
        },

        getPercentValueForGR: function(plannedQty, completedQty) {
            var percentValue = (parseFloat(completedQty) / parseFloat(plannedQty)) * 100;
            return Math.floor(percentValue);
        },

        getDisplayValue: function(plannedQty, completedQty, plannedQtyInProductionUom, completedQtyInProductionUom, baseCommercialUom, productionCommercialUom, oController) {
            var pQty, cQty, actualPlannedQty, actualCompletedQty, actualUom;
            if (plannedQtyInProductionUom && productionCommercialUom) {
                actualPlannedQty = plannedQtyInProductionUom;
                actualCompletedQty = completedQtyInProductionUom;
                actualUom = productionCommercialUom;
            } else {
                actualPlannedQty = plannedQty;
                actualCompletedQty = completedQty;
                actualUom = baseCommercialUom;
            }

            pQty = (actualPlannedQty) ? NumberFormatter.dmcLocaleQuantityFormatterDisplay(actualPlannedQty) : 0;
            cQty = (actualCompletedQty) ? NumberFormatter.dmcLocaleQuantityFormatterDisplay(actualCompletedQty) : 0;

            if (!actualUom) {
                actualUom = "";
            }
            if (oController) {
                return oController.getI18nText("GRquantityValue", [cQty, pQty, actualUom]);
            }
            return this.getI18nText("GRquantityValue", [cQty, pQty, actualUom]);
        },

        getValidTargetQty : function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity){
            if(totalQtyEntryUom && totalQtyEntryUom.value){
                return totalQtyEntryUom
            } else if(totalQtyBaseUom && totalQtyBaseUom.value){
                return totalQtyBaseUom;
            } else {
                return targetQuantity;
            }
        },

        getValidConsumedQty : function (consumedQtyEntryUom, consumedQuantity){
            if(consumedQtyEntryUom && consumedQtyEntryUom.value){
                return consumedQtyEntryUom;
            } else {
                return consumedQuantity;
            }
        },

        getPercentValueForMatCons: function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity, consumedQtyEntryUom, consumedQuantity) {
            var plannedQty = (this.formatter ? this.formatter.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) : this.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity));
            var completedQty = (this.formatter ? this.formatter.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity) : this.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity));
            if(!(completedQty && completedQty.value) || !(plannedQty && plannedQty.value)){
                return 0;
            }else{
                var percentValue = (parseFloat(completedQty.value) / parseFloat(plannedQty.value)) * 100;
                return Math.floor(percentValue);
            }
        },

        getDisplayValueForMatCons: function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity, consumedQtyEntryUom, consumedQuantity, oController) {
            var pQty, cQty, plannedQty, completedQty, unitOfMeasure;
            if (this.formatter) {
                plannedQty = this.formatter.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
                completedQty = this.formatter.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity);
            } else {
                plannedQty = this.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
                completedQty = this.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity);
            }

            if (plannedQty && plannedQty.unitOfMeasure && plannedQty.unitOfMeasure.uom) {
                unitOfMeasure = plannedQty.unitOfMeasure.uom;
            }else{
                unitOfMeasure = "";
            }
            if (this.formatter) {
                pQty = this.formatter.formatQtyWithDecimals(plannedQty, unitOfMeasure);
                cQty = this.formatter.formatQtyWithDecimals(completedQty, unitOfMeasure);
            } else {
                pQty = this.formatQtyWithDecimals(plannedQty, unitOfMeasure);
                cQty = this.formatQtyWithDecimals(completedQty, unitOfMeasure);
            }
            if (oController) {
                return oController.getI18nText("GRquantityValue", [cQty, pQty, unitOfMeasure]);
            }
            return this.getI18nText("GRquantityValue", [cQty, pQty, unitOfMeasure]);
        },

        formatQtyWithDecimals : function (quantityParam, uom) {
            let formattedQty;
            let quantity;
            if (quantityParam && quantityParam.hasOwnProperty("value")) {
                quantity = quantityParam;
            } else {
                quantity = ![null, undefined, ''].includes(quantityParam) ? {value: quantityParam}: quantityParam;
            }
            // To display decimals for UoM PC
            if(DMCConstants.uomEach.includes(uom) && (quantity.value && (quantity.value)%1 !== 0)){
                let NumInstance = NumberFormat.getFloatInstance({
                    decimals: 3
                }, sap.ui.getCore().getConfiguration().getLocale());
                formattedQty = NumInstance.format(quantity.value)
            } else {
               formattedQty = (quantity && (quantity.value)) ? NumberFormatter.dmcLocaleQuantityFormatterDisplay(quantity.value, uom) : 0;
            }
            return formattedQty;
        },

        getDisplayValueForGR: function(plannedQty, completedQty, unitOfMeasure, oController) {
            var pQty, cQty;
            pQty = (plannedQty) ? NumberFormatter.dmcLocaleQuantityFormatterDisplay(plannedQty) : 0;
            cQty = (completedQty) ?  NumberFormatter.dmcLocaleQuantityFormatterDisplay(completedQty) : 0;
            if (!unitOfMeasure) {
                unitOfMeasure = "";
            }
            if (oController) {
                return oController.getI18nText("GRquantityValue", [cQty, pQty, unitOfMeasure]);
            }
            return this.getI18nText("GRquantityValue", [cQty, pQty, unitOfMeasure]);
        },

        formatNumber: function(inputNumber) {

            var NumInstance = NumberFormat.getFloatInstance({
                decimals: 3
            }, sap.ui.getCore().getConfiguration().getLocale());

            return NumInstance.format(inputNumber);
        },

        formatSectionTitle: function(operation, phaseId, oController) {

            if (operation) {
                if (phaseId) {
                    return oController.getI18nText("operation") + " " + operation + " - " + oController.getI18nText("phase") + " " + phaseId;
                }
                return oController.getI18nText("operation") + " " + operation;
            }
            return null;
        },

        getUpperAndLowerThresholdValues: function(compThresholdUpper, compThresholdLower, bomThresholdUpper, bomThresholdLower, totalQtyEntryUom, totalQtyBaseUom, targetQuantity) {

            var upperValue = 0,
                lowerValue = 0,
                thresholdValues = {};
            var targetValue = (this.formatter ? this.formatter.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) : this.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity));
            if ((!compThresholdUpper && !compThresholdLower && !bomThresholdUpper && !bomThresholdLower) || !targetValue.value) {
                thresholdValues.lowerValue = null;
                thresholdValues.upperValue = null;
            }
            if (compThresholdUpper || compThresholdLower) {
                upperValue = (compThresholdUpper ? (targetValue.value + (targetValue.value * (compThresholdUpper / 100))) : targetValue.value);
                lowerValue = (compThresholdLower ? (targetValue.value - (targetValue.value * (compThresholdLower / 100))) : targetValue.value);
                thresholdValues.lowerValue = lowerValue;
                thresholdValues.upperValue = upperValue;

            } else if (bomThresholdUpper || bomThresholdLower) {
                upperValue = (bomThresholdUpper ? (targetValue.value + (targetValue.value * (bomThresholdUpper / 100))) : targetValue.value);
                lowerValue = (bomThresholdLower ? (targetValue.value - (targetValue.value * (bomThresholdLower / 100))) : targetValue.value);
                thresholdValues.lowerValue = lowerValue;
                thresholdValues.upperValue = upperValue;
            }

            return thresholdValues;
        },

        getThresholdValues: function(upperValue, lowerValue, consumedQtyEntryUom, consumedQuantity) {

            if (!upperValue && !lowerValue) {
                return null;
            }
            var completedQty = (this.formatter ? this.formatter.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity) : this.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity));
            if (completedQty && completedQty.unitOfMeasure && completedQty.unitOfMeasure.uom) {
                return NumberFormatter.dmcLocaleFloatNumberFormatter(lowerValue) + " - " + NumberFormatter.dmcLocaleQuantityFormatterDisplay(upperValue) + " " + completedQty.unitOfMeasure.uom;
            } else {
                return NumberFormatter.dmcLocaleFloatNumberFormatter(lowerValue) + " - " + NumberFormatter.dmcLocaleQuantityFormatterDisplay(upperValue)
            }

        },

        getMergeKey: function(material, matDesc, backflushEnabled, backFlushText) {

            if (backflushEnabled) {
                return material + "\n" + matDesc + "\n" + backFlushText;
            }
            return material + "\n" + matDesc;
        },

        getDCMergeKey: function(group, ver, desc) {
            return group + ver + "\n" + desc;
        },

        isRequired: function(param, isReq) {
            return isReq == "*" ? param + isReq : param;
        },

        getDisplayStorageLoc: function(backflushEnabled, batchManaged, matType, isInv) {
            if (backflushEnabled || (batchManaged && batchManaged !== "NONE") || matType === "PIPELINE")
                return false;
            return true;
        },

        getDisplayBatchID: function(backflushEnabled, batchManaged, matType, sloc, isInv) {

            if (backflushEnabled || !batchManaged || batchManaged === "NONE" || matType === "PIPELINE")
                return false;
            return true;
        },

        getDisplayBatchIDForGR : function(batchManaged, matType, isAutoGr){
            if((matType === "N" && isAutoGr) || !batchManaged || batchManaged === "NONE"){
                return false;
            }
            return true;
        },

        isGrFieldEnabled: function (materialType, isAutoGr, isMultipleReportingGR) {

            //for all the usages except for the + button the isMultipleReportingGR is not relevant, hence the undefined check was added
            if (isMultipleReportingGR === true || isMultipleReportingGR === undefined) {
                if (materialType === "N" && isAutoGr) {
                    return false;
                }
                return true;
            }
            return false;
        },

        showValue: function(value, uom) {
            if([null, undefined, ''].includes(value)){
                value = 0;
            }

            if (uom)
                return NumberFormatter.dmcLocaleQuantityFormatterDisplay(value) + " " + uom;
            else
                return NumberFormatter.dmcLocaleQuantityFormatterDisplay(value);
        },

        showValueWithUom: function(value, uom) {
            if (value === null) {
                value = 0;
            }

            var NumInstance = NumberFormat.getFloatInstance({
                decimals: 3
            }, sap.ui.getCore().getConfiguration().getLocale());

            if (uom)
                return NumInstance.format(value) + " " + uom;

            return NumInstance.format(value);
        },

        showCharacteristicsValueWithUom: function(value, uom) {
            if (value !== null && uom) {
                return value + " " + uom;
            }
            return value;
        },

        formatBatchQuantityAdv: function(qty, uom) {

            if (qty === null) {
                qty = 0;
            }

            var NumInstance = NumberFormat.getFloatInstance({
                decimals: 3
            }, sap.ui.getCore().getConfiguration().getLocale());

            if (uom)
                return NumInstance.format(qty) + " " + uom;

            return NumInstance.format(qty);
        },

        getAllignment: function(sDataType) {
            if (sDataType === "NUM" || sDataType === "DATE") {
                return "End";
            }
            return "Begin";
        },

        formatSingleDate: function(oDate) {
            var DateInstance = DateFormat.getDateInstance({
                style: "medium",
                locale: sap.ui.getCore().getConfiguration().getLanguage()
            });
            if (oDate == null) {
                return null;
            } else {
                return DateInstance.format(new Date(oDate));
            }
        },

        getOrderQtyColorCode: function(completedQty, plannedQty) {

            var pQty = (plannedQty) ? parseFloat(plannedQty) : 0;
            var cQty = (completedQty) ? parseFloat(completedQty) : 0;

            if (cQty === 0)
                return "None";

            if (cQty < pQty)
                return "Warning";
            else
                return "Success";
        },

        getMatPostedQtyColorCode: function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity, consumedQtyEntryUom, consumedQuantity, lowerThresholdValue) {

            var plannedQty = (this.formatter ? this.formatter.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) : this.getValidTargetQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity));
            var completedQty = (this.formatter ? this.formatter.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity) : this.getValidConsumedQty(consumedQtyEntryUom, consumedQuantity));
            var tQty = (plannedQty && plannedQty.value) ? parseFloat(plannedQty.value) : 0;
            var cQty = (completedQty && completedQty.value) ? parseFloat(completedQty.value) : 0;
            var lowerValue = (lowerThresholdValue) ? parseFloat(lowerThresholdValue) : 0;

            if (cQty === 0)
                return "None";

            if (lowerValue) {
                if (cQty < lowerValue)
                    return "Warning";
                else
                    return "Success"
            } else {
                if (cQty < tQty)
                    return "Warning";
                else
                    return "Success";
            }
        },

        getGRPostedQtyColorCode: function(consQty, tgtQty, lowerThresholdValue) {

            var tQty = (tgtQty) ? parseFloat(tgtQty) : 0;
            var cQty = (consQty) ? parseFloat(consQty) : 0;
            var lowerValue = (lowerThresholdValue) ? parseFloat(lowerThresholdValue) : 0;

            if (cQty === 0)
                return "None";

            if (lowerValue) {
                if (cQty < lowerValue)
                    return "Warning";
                else
                    return "Success"
            } else {
                if (cQty < tQty)
                    return "Warning";
                else
                    return "Success";
            }
        },

        showUpdateBtnStorLoc: function(qty, isInv) {
            if (!isInv && (qty === undefined || qty === null || qty === "")) {
                return true;
            }
            return false;
        },

        showQtyStorLoc: function(qty, isInv) {
            if (!isInv && (qty === undefined || qty === null || qty === "")) {
                return false;
            }
            return true;
        },

        showRefreshBtnStorLoc: function(qty, isInv) {
            if (isInv || (!isInv && (qty === undefined || qty === null || qty === ""))) {
                return false;
            }
            return true;
        },
        addButtonVisible: function (aSequence, sFragment) {
            return aSequence.filter(frag=> frag.id=== sFragment).map(frag=> frag.multipleReporting).pop();
        },
        getOrderStatus: function(statusKey) {
            return this.getI18nText(statusKey);
        },
        formatActivityConfirmationStatus: function (statusKey) {
            return !statusKey ? '': this.getI18nText(statusKey);
        },
        formatConfirmationStatus: function (value) {
            if (!value) {
                return ""
            } else if (value == "SENT_TO_S4" || value == "PENDING" || value == "POSTED_IN_DM") {
                return this.getI18nText("posted")
            } else if (value == "CANCELLED_IN_DM") {
                return this.getI18nText("cancelled")
            }
        },
        showFormattedValueWithUom: function (value, uom) {
            if (!value) {
                return null;
            }
            if (uom) {
                return NumberFormatter.dmcLocaleQuantityFormatterDisplay(value, uom) + " " + uom;
            } else {
                return NumberFormatter.dmcLocaleQuantityFormatterDisplay(value);
            }
        },
        showFormattedValueWithUomForSpecialUom: function (value, uom) {
            if ([null, undefined, ''].includes(value)) {
                return 0;
            }
            let oFormatter = this.oController && this.oController.formatter || this.formatter;
            if (uom) {
                return (oFormatter && oFormatter.formatQtyWithDecimals(value, uom) || this.formatQtyWithDecimals(value, uom)) + " " + uom;
            } else {
                return NumberFormatter.dmcLocaleQuantityFormatterDisplay(value);
            }
        },
        parseNumber: function (fNumber) {
            return NumberFormatter.dmcLocaleNumberParser(fNumber);
        },

        isDecimalValidationSuccessful: function (value, uom){
            let formattedValue = NumberFormatter.dmcLocaleQuantityFormatterDisplay(value ,uom);
            return !!(formattedValue);
        }
    };
    return formatter;
});