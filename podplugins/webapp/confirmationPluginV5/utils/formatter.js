sap.ui.define(
  [
    'sap/m/GroupHeaderListItem',
    'sap/dm/dme/util/PlantSettings',
    'sap/ui/core/MessageType',
    'sap/ui/core/ValueState',
    'sap/ui/core/format/DateFormat',
    'sap/ui/core/format/NumberFormat'
  ],
  function (GroupHeaderListItem, PlantSettings, MessageType, ValueState, DateFormat, NumberFormat) {
    'use strict';
    const REASON_CODE_PATH_SEPARATOR = ' /\n';
    const REASON_CODE_MAX_DEPTH = 10;
    return {
      init: function (oBundle) {
        // This method intentionally left empty
      },

      createActivityLabelForPopup: function (activityLabel, unitText) {
        return activityLabel + ' / ' + unitText;
      },

      enablePostingsButton: function (value) {
        if (value === 0 || value === null) {
          return false;
        }
        return true;
      },

      formatReportButton: function (userAuthorizedForWorkCenter, isActivityExist, isDone) {
        return userAuthorizedForWorkCenter && isActivityExist && !isDone;
      },
      showValueRemaining: function (targetQuantity,actualQuantity) {
        if (targetQuantity !== undefined && actualQuantity !== undefined) {
          const diff = targetQuantity - actualQuantity;
          return diff.toFixed(3);
        }
        return null;
      
    },
      showValueWithUom: function(sValue, sUOM) {
        if (!sValue) {
          return '0';
        }

        let oIntNumberFormat = NumberFormat.getIntegerInstance({
          groupingEnabled: true,
          style: 'standard',
          parseAsString: true
        });

        var iFormattedValue = oIntNumberFormat.format(sValue.toString());

        return sUOM ? `${iFormattedValue} ${sUOM}` : iFormattedValue;
      },

    formatDate: function(oDate) {
      var DateInstance = DateFormat.getDateInstance({
        style: 'medium',
        locale: sap.ui.getCore().getConfiguration().getLanguage()
      });
      if (oDate == null) {
        return null;
      } else {
        return DateInstance.format(new Date(oDate));
      }
    },

    //We are converting plant time to UTC time and the format should be "yyyy-MM-dd HH:mm:ss" as the API expects
    //in this format only. Also DateTimeUtils doesn't have a function to get the UTC date time in above format.
    formatPlantDateTimeToUTCTimeZone: function(dateTime) {
      let postedDateTime = new Date(moment.tz(dateTime, PlantSettings.getTimeZone()).format());
      return DateFormat.getDateInstance({ pattern: 'yyyy-MM-dd HH:mm:ss', UTC: true }).format(postedDateTime);
    },

    scrapQuantityEnabled: function(scrapQuantity) {
      return scrapQuantity > 0;
    },

    formatNumber: function(inputNumber) {
      var NumInstance = NumberFormat.getFloatInstance(
        {
          decimals: 3
        },
        sap.ui.getCore().getConfiguration().getLocale()
      );

      return NumInstance.format(inputNumber);
    },

    parseNumberFromString: function(sQuantity) {
      if (sQuantity === '') {
        return '';
      }
      var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance(
        new sap.ui.core.Locale(sap.ui.getCore().getConfiguration().getLocale().toLocaleString())
      );
      return oFloatFormat.parse(sQuantity);
    },
    statusColorFormatter: function(status) {
      let state = 'Success';
      switch (status) {
        case 'CANCELLED_IN_DM':
          state = 'Error';
          break;
      }
      return state;
    },

    enablePostingsButton: function(value1, value2) {
      if ((value1 === 0 || value1 === null) && (value2 === 0 || value2 === null)) {
        return false;
      }
      return true;
    },

    formatReasonCodePath: function(oReasonCode, oParentCodes) {
      let aPath = [];
      if (oReasonCode && oParentCodes) {
        aPath.push(oReasonCode.timeElement.timeElementName + ' (' + oReasonCode.timeElement.description + ')');
        for (let i = 1; i <= REASON_CODE_MAX_DEPTH; i++) {
          let sProp = 'reasonCode' + i;
          if (!oReasonCode[sProp]) {
            break;
          }
          let sText = oReasonCode[sProp];
          if (oParentCodes[sProp]) {
            sText += ' (' + oParentCodes[sProp].description + ')';
          }
          aPath.push(sText);
        }
      }
      return aPath.join(REASON_CODE_PATH_SEPARATOR);
    }
  };
  }
);
