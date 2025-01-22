sap.ui.define(['sap/dm/dme/constants/DMCConstants', 'sap/dm/dme/formatter/NumberFormatter'], function(DMCConstants, DMENumberFormatter) {
  return {
    getValidTargetValues: function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) {
      var validTargetQty = this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
      return validTargetQty.value;
    },

    getValidQty: function(totalQtyEntryUom, totalQtyBaseUom, targetQuantity) {
      if (totalQtyEntryUom && totalQtyEntryUom.value) {
        return totalQtyEntryUom;
      } else if (totalQtyBaseUom && totalQtyBaseUom.value) {
        return totalQtyBaseUom;
      } else {
        return targetQuantity;
      }
    },

    getValidConsumedQty: function(consumedQuantity, consumedQtyEntryUom) {
      if (consumedQtyEntryUom && ![null, undefined, ''].includes(consumedQtyEntryUom.value)) {
        return consumedQtyEntryUom;
      } else {
        return consumedQuantity;
      }
    },

    formatQtyWithDecimals: function(quantity, uom) {
      var formattedQty;
      // To display decimals for UoM PC
      if (DMCConstants.uomEach.includes(uom) && (quantity && quantity % 1 != 0)) {
        var NumInstance = NumberFormat.getFloatInstance(
          {
            decimals: 3
          },
          sap.ui.getCore().getConfiguration().getLocale()
        );
        formattedQty = NumInstance.format(quantity);
      } else {
        formattedQty = DMENumberFormatter.dmcLocaleQuantityFormatterDisplay(quantity ? quantity : 0, uom);
      }
      return formattedQty;
    },

    formatQty: function(quantity) {
      if (isNaN(quantity)) return;
      var NumInstance = NumberFormat.getFloatInstance(
        {
          decimals: 3
        },
        sap.ui.getCore().getConfiguration().getLocale()
      );
      return NumInstance.format(quantity);
    },

    getActualValue: function(consumedQuantity, consumedQtyEntryUom) {
      var consumedQuantity = this.oFormatter.getValidConsumedQty(consumedQuantity, consumedQtyEntryUom);
      var actualValue = this.oFormatter.formatQtyWithDecimals(consumedQuantity.value, consumedQuantity.unitOfMeasure.uom);
      return actualValue + ' ' + consumedQuantity.unitOfMeasure.uom;
    },

    stateFormatter: function(sStatus) {
      switch (sStatus) {
        case 'PARKED':
          return 'Warning';
        case 'BATCH_CORRECTION':
          return 'Error';
        default:
          return 'None';
      }
    },

    statusTextFormatter: function(sStatus) {
      switch (sStatus) {
        case 'PARKED':
          return 'Parked';
        case 'BATCH_CORRECTION':
          return 'Batch Correction';
        default:
          return '';
      }
    }
  };
});
