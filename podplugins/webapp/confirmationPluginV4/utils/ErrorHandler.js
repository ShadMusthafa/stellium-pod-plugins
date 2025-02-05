sap.ui.define([
], function () {
    "use strict";

    function isInErrorState (oBinding) {
        const aMessages = oBinding.getDataState().getMessages();
        return aMessages.some(oMessage => oMessage.getType() === sap.ui.core.MessageType.Error);
    }

    function _validateControl (oControl) {
        let sValidatedInputProperty,
            oBinding,
            oType,
            oValue;

        sValidatedInputProperty = "value";
        oBinding = oControl.getBinding(sValidatedInputProperty);

        if (!oBinding) {
            sValidatedInputProperty = "selectedKey";
            oBinding = oControl.getBinding(sValidatedInputProperty);
            if (!oBinding) {
                return;
            }
        }

        if (isInErrorState(oBinding)) {
            return; // no need to validate the control if it's already in the error state
        }

        oType = oBinding.getType();
        if (!oType) {
            return;
        }

        oValue = oBinding.getExternalValue();
        oValue = oType.parseValue(oValue, oBinding.sInternalType);

        try {
            oType.validateValue(oValue);
        } catch (oException) {
            oControl.fireValidationError({
                element: oControl,
                property: sValidatedInputProperty,
                type: oType,
                newValue: oValue,
                exception: oException,
                message: oException.message
            });
        }
    }

    function convertArrayToString(aStrings) {
        if (aStrings && Array.isArray && Array.isArray(aStrings)) {
            let sMessage = "";
            if (aStrings.length > 0) {
                for (let i = 0; i < aStrings.length; i++) {
                    if (i > 0) {
                        sMessage = sMessage + "\n";
                    }
                    sMessage = sMessage + aStrings[i];
                }
            }
            return sMessage;
        }
        return aStrings;
    }

    return {
        FIELD_GROUP: {
            VALIDATED: "validated",
            KEY: "keyField"
        },

        /**
         * Validates all controls inside given container that have group id "validated"
         * @param oParentControl Container control e.g. Form
         */
        validateFormFields: function (oParentControl) {
            let aValidatedControls = oParentControl.getControlsByFieldGroupId(this.FIELD_GROUP.VALIDATED);

            for (let i = 0; i < aValidatedControls.length; i++) {
                _validateControl(aValidatedControls[i]);
            }
        },

        /**
         * Checks if Message Model contains any errors.
         * @returns {boolean} <code>true</code> if Message Model contains messages, <code>false</code> otherwise.
         */
        hasErrors: function () {
            let oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
            return oMessageModel.getData().length > 0;
        },

        /**
         * Processes incorrect input in oControl. Highlights control with red border, specifies error message
         * and fires validation error.
         * @param oControl control with value state
         * @param sMessage localized error message
         * @param [sSubtitle] localized message for subtitle
         * @param [oProperty] Name of control property to fire validation against. "value" by default.
         */
        setErrorState: function (oControl, sMessage, sSubtitle, oProperty) {
            oControl.setValueState(sap.ui.core.ValueState.Error);
            oControl.fireValidationError({
                element: oControl,
                property: oProperty || "value",
                message: sMessage
            });
            if (sSubtitle) {
                let oModel = sap.ui.getCore().getMessageManager().getMessageModel();
                let aMessages = oModel.getData();
                aMessages[aMessages.length - 1].additionalText = sSubtitle;
                oModel.refresh();
            }
        },

        /**
         * Processes correct input in oControl. Removes red highlighting and fires validation success.
         * @param oControl Control to clear value state from.
         * @param [oProperty] Name of control property to fire validation against. "value" by default.
         */
        clearErrorState: function (oControl, oProperty) {
            oControl.setValueState(sap.ui.core.ValueState.None);
            oControl.fireValidationSuccess({ element: oControl, property: oProperty || "value" });
        },

        /**
         * Converts an error object returned from a request and returns a string
         * @param oError Error object returned from a request
         * @return String error message
         */
        getErrorMessage: function (oError) {
            if (!oError) {
                return null;
            }
            if (Array.isArray && Array.isArray(oError)) {
                return convertArrayToString(oError);

            } else if (typeof oError === "string") {
                return oError;

            } else if (oError.message) {
                if (Array.isArray && Array.isArray(oError.message)) {
                    return convertArrayToString(oError.message);
                }
                return "" + oError.message;

            } else if (oError.error && oError.error.message) {
                if (Array.isArray && Array.isArray(oError.error.message)) {
                    return convertArrayToString(oError.error.message);
                }
                return "" + oError.error.message;
            }
            return null;
        }
    };
});
