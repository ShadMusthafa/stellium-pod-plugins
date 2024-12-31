sap.ui.define([
  'sap/m/GroupHeaderListItem',
  'sap/ui/core/MessageType',
  'sap/ui/core/ValueState',
  'sap/ui/core/format/DateFormat',
  'sap/ui/core/format/NumberFormat',
  'sap/dm/dme/constants/DMCConstants',
  "sap/dm/dme/formatter/NumberFormatter",
  "sap/dm/dme/formatter/DateTimeUtils"
], function (GroupHeaderListItem, MessageType, ValueState, DateFormat, NumberFormat, DMCConstants, DMENumberFormatter, DateTimeUtils) {
  "use strict";

  var oResourceBundle;

  return {
      init: function (oBundle) {
          oResourceBundle = oBundle;
      },

      getScaleColor: function (reqd, actual) {
          if (reqd === actual) {
              return sap.m.ValueColor.Good;
          } else {
              return sap.m.ValueColor.Critical;
          }
      },

      getRequiredQuantity: function (reqd, uom, label) {
          var reqdValue = this.oFormatter ? DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(reqd, uom) :  DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(reqd, uom);
          return label + ": " + reqdValue +" " +uom ;
      },

      getQuantityUnitLabel: function (quantity, unit) {
          return quantity + " / " + unit;
      },

      formatDate: function (oDate) {
    if(oDate && sap.ui.Device.browser.name === "sf") {
      oDate = oDate.replace(/ /g,"T")
    }
          if (oDate == null) {
              return null;
          } else {
              var timeZone=DateTimeUtils.getBrowserTimezone();
               var parseDate=DateTimeUtils.dmcParseDate(oDate);
              var formattedDate=DateTimeUtils.dmcDateFormatterFromUTC(parseDate, timeZone);
               return formattedDate;
          }
      },

      formatConsumeButton : function(userAuthorizedForWorkCenter, backflushEnabled, isWeighRelevant) {

          if(userAuthorizedForWorkCenter && !isWeighRelevant){
              if(backflushEnabled){
                  return false;
              }
              return true;
          }
          return false;
      },

      formatHeaderButtons : function(userAuthorizedForWorkCenter, showButton) {

        if(showButton){
          if(userAuthorizedForWorkCenter){
            return true;
          }
          return false;
        }
        return false;
      },

      showValueWithUom: function (value, uom) {
        if(value === null){
          value = 0;
        }
          if (uom){
              return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(value)+" " +uom;
          }
          return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(value);
      },

      showValueUptoThreeDecimalWithUom: function (value, uom) {
        if(value === null){
          return 0;
        }
          if (uom){
              return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(value, uom)+" " +uom;
          }
          return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(value);
      },

      formatNumber: function (inputNumber) {
          return DMENumberFormatter.dmcLocaleFloatNumberFormatter(inputNumber);
      },

      formatNumberWithThreeDecimals: function(inputNumber){

        var NumInstance = NumberFormat.getFloatInstance({
          decimals: 3
        }, sap.ui.getCore().getConfiguration().getLocale());

          var returnValue;
          var decimals = (inputNumber!=Math.floor(inputNumber))?(inputNumber.toString()).split('.')[1].length:0;
          if(decimals > 3) {
              returnValue = NumInstance.format(inputNumber);
          }
          else {
              returnValue = inputNumber.toString();
          }
          return returnValue;
      },

      getUpperAndLowerThresholdValues : function(compThresholdUpper, compThresholdLower, bomThresholdUpper, bomThresholdLower, totalQtyEntryUom, totalQtyBaseUom, targetQuantity){

        var upperValue = 0, lowerValue = 0, thresholdValues = {};
        var targetValue = (this.formatter ? this.formatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) : this.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity));
        if((!compThresholdUpper && !compThresholdLower && !bomThresholdUpper && !bomThresholdLower) || !targetValue.value){
          thresholdValues.lowerValue = null;
          thresholdValues.upperValue = null;
        }else if(compThresholdUpper || compThresholdLower){
          upperValue = (compThresholdUpper ? (targetValue.value + (targetValue.value * (compThresholdUpper / 100))) : targetValue.value);
          lowerValue = (compThresholdLower ? (targetValue.value - (targetValue.value * (compThresholdLower / 100))) : targetValue.value);
          thresholdValues.lowerValue = lowerValue;
          thresholdValues.upperValue = upperValue;

        }else if(bomThresholdUpper || bomThresholdLower){
          upperValue = (bomThresholdUpper ? (targetValue.value + (targetValue.value * (bomThresholdUpper / 100))) : targetValue.value);
          lowerValue = (bomThresholdLower ? (targetValue.value - (targetValue.value * (bomThresholdLower / 100))) : targetValue.value);
          thresholdValues.lowerValue = lowerValue;
          thresholdValues.upperValue = upperValue;
        }

        return thresholdValues;
      },

       getValidQty : function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity){

           if(totalQtyEntryUom && totalQtyEntryUom.value){
               return totalQtyEntryUom

           } else if(totalQtyBaseUom && totalQtyBaseUom.value){
               return totalQtyBaseUom;

           } else {
               return targetQuantity;
           }
       },

       getValidTargetValues : function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity){
           var validTargetQty = this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
           return validTargetQty.value;
       },

       getValidRequiredQuantity : function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity , label){
          var validTargetQty = this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
          var requiredQuantity = this.oFormatter.formatQtyWithDecimals(validTargetQty.value, validTargetQty.unitOfMeasure.uom)
          return requiredQuantity+" "+ validTargetQty.unitOfMeasure.uom;
       },

       getValidConsumedQty : function (consumedQuantity, consumedQtyEntryUom){
           if (consumedQtyEntryUom && ![null, undefined, ''].includes(consumedQtyEntryUom.value)) {
                return consumedQtyEntryUom;
            } else {
                return consumedQuantity;
            }
       },

       getValidConsumedQtyValue : function (consumedQuantity, consumedQtyEntryUom) {
            var consumedQuantity = this.oFormatter.getValidConsumedQty(consumedQuantity, consumedQtyEntryUom);
            return (consumedQuantity.value) ? consumedQuantity.value : 0;
       },

       getColor : function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity, consumedQuantity, consumedQtyEntryUom){

           var reqdQty = this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
           var consumedQuantity = this.oFormatter.getValidConsumedQty(consumedQuantity, consumedQtyEntryUom);

           return this.oFormatter.getScaleColor(reqdQty.value, consumedQuantity.value);
       },

       getActualValue : function (consumedQuantity, consumedQtyEntryUom) {
          var consumedQuantity = this.oFormatter.getValidConsumedQty(consumedQuantity, consumedQtyEntryUom);
          var actualValue = this.oFormatter.formatQtyWithDecimals(consumedQuantity.value, consumedQuantity.unitOfMeasure.uom)
          return actualValue +" "+consumedQuantity.unitOfMeasure.uom;
      },

       formatQtyWithDecimals : function (quantity, uom) {
          var formattedQty;
          // To display decimals for UoM PC
          if(DMCConstants.uomEach.includes(uom) && (quantity && (quantity)%1 != 0)){
              var NumInstance = NumberFormat.getFloatInstance({
                  decimals: 3
              }, sap.ui.getCore().getConfiguration().getLocale());
              formattedQty = NumInstance.format(quantity)
          } else {
             formattedQty = DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(quantity?quantity:0, uom);
          }
          return formattedQty;
       },

      getThresholdValues : function(upperValue, lowerValue, totalQtyEntryUom, totalQtyBaseUom, targetQuantity){

          var validTargetQty = this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
          var uom = validTargetQty.unitOfMeasure.uom;

        if(!upperValue && !lowerValue){
          return null;
        }
        if(uom){
            if(DMCConstants.uomEach.includes(uom)){
                var NumInstance = NumberFormat.getFloatInstance({
                      decimals: 3
                  }, sap.ui.getCore().getConfiguration().getLocale());
                  return NumInstance.format(lowerValue) + " - " + NumInstance.format(upperValue) +" "+uom;
            }else {
                return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(lowerValue, uom) + " - " +DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(upperValue, uom)+ " " + uom;
            }
      }else{
              return DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(lowerValue) + " - " +DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(upperValue);
      }
      },

  formatBatchQuantityAdv: function(qty, uom){

          if(qty === null){
          qty = 0;
        }

          var NumInstance = NumberFormat.getFloatInstance({
          decimals: 3
        }, sap.ui.getCore().getConfiguration().getLocale());

        if(uom)
          return  NumInstance.format(qty) + " " + uom;

        return NumInstance.format(qty);
  },

  getValueHelpOnly: function (allowFreeText, sMaterial) {
          if(sMaterial !== "")
              return !allowFreeText;
          return true;
  },

  getGroupHeader: function (sComponentType) {
    if (sComponentType.key === "B") {
      return new GroupHeaderListItem({
        title: this.getI18nText('co-by-byProduct'),
        upperCase: false
      }).addStyleClass("sapDmeFontWeightNormal");
    } else if (sComponentType.key === "C") {
      return new GroupHeaderListItem({
        title: this.getI18nText('co-by-coProduct'),
        upperCase: false
      }).addStyleClass("sapDmeFontWeightNormal");
    }
  },

  getEnabledStorageLoc: function(batchManaged, material, materialType, isInv, isEWM){
    if((isInv && isEWM) || materialType === "PIPELINE") {
        return false;
    }
    return (!batchManaged);
  },

  showUpdateBtnStorLoc: function(qty, isInv) {
      if(!isInv && (qty === undefined || qty === null || qty === "")) {
          return true;
      }
      return false;
  },

  showQtyStorLoc: function(qty, isInv) {
      if(!isInv && (qty === undefined || qty === null || qty === "")) {
          return false;
      }
      return true;
  },

  showRefreshBtnStorLoc: function(qty, isInv) {
      if(isInv || (!isInv && (qty === undefined || qty === null || qty === ""))) {
          return false;
      }
      return true;
  },

      getBatchInputEnable: function(batchManaged, material, materialType, sloc, isInv, isEWM) {
          if((isInv && isEWM) || !batchManaged || materialType === "PIPELINE" || (!isInv && material !== "" && sloc === "")) {
              return false;
          }
          return true;
      },

      getQtyEnable: function(bUseFullHU) {
          return !bUseFullHU;
      },

      parseNumber: function (fNumber) {
          return DMENumberFormatter.dmcLocaleNumberParser(fNumber);
      },

      formatWeighButton : function(userAuthorizedForWorkCenter, backflushEnabled, isWeighRelevant) {

          if(userAuthorizedForWorkCenter && isWeighRelevant){
              if(backflushEnabled){
                  return false;
              }
              return true;
          }
          return false;
      },
      formatUTCDateTimeToPlantTimeZone: function(vDate) {
          var parseDate=DateTimeUtils.dmcParseDate(vDate);
          return DateTimeUtils.dmcDateTimeFormatterFromUTC(DateTimeUtils.dmcDateToUTCFormat(parseDate, "UTC"));
      },
  };
});
