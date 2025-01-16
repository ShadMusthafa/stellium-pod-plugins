sap.ui.define([], function() {
  'use strict';

  return {
    setErrorState: function(oControl, sMessage, oProperty) {
      oControl.setValueState(sap.ui.core.ValueState.Error);
      oControl.fireValidationError({
        element: oControl,
        property: oProperty || 'value',
        message: sMessage
      });
    },

    clearErrorState: function(oControl, oProperty) {
      oControl.setValueState(sap.ui.core.ValueState.None);
      oControl.fireValidationSuccess({ element: oControl, property: oProperty || 'value' });
    },

    hasErrors: function() {
      let oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
      return oMessageModel.getData().length > 0;
    },

    clearAllErrors: function() {
      sap.ui.getCore().getMessageManager().removeAllMessages();
    }
  };
});
