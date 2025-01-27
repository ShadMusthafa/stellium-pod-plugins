sap.ui.define([], function () {
    "use strict";

    return {
        fnMetaEventBinder: ({ sEventName, baseExecContext, aArgs, fnBaseFunction, oCustomExtension }) => {
            if (oCustomExtension) {
                if (oCustomExtension.isOverridingFunction(sEventName)) {
                    // return the result of overridden function. Must be Promise.
                    return oCustomExtension.executeFunction(sEventName, aArgs);
                }
                if (oCustomExtension.isExecutionBefore(sEventName)) {
                    // ignore the result of "Before" execution
                    oCustomExtension.executeFunction(sEventName, aArgs);
                }
            }

            // call native function
            fnBaseFunction.apply(baseExecContext, aArgs);
            if (oCustomExtension && oCustomExtension.isExecutionAfter(sEventName)) {
                oCustomExtension.executeFunction(sEventName, aArgs);
            }
        },

        fnMetaAsyncEventBinder: ({ sEventName, baseExecContext, aArgs, fnBaseFunction, oCustomExtension }) => {
            if (oCustomExtension) {
                if (oCustomExtension.isOverridingFunction(sEventName)) {
                    // return the result of overridden function. Must be Promise.
                    return oCustomExtension.executeFunction(sEventName, aArgs);
                }
                if (oCustomExtension.isExecutionBefore(sEventName)) {
                    // ignore the result of "Before" execution
                    oCustomExtension.executeFunction(sEventName, aArgs);
                }
            }

            // call native function, wait on result and trigger After function
            return fnBaseFunction.apply(baseExecContext, aArgs).finally(function () {
                if (oCustomExtension && oCustomExtension.isExecutionAfter(sEventName)) {
                    return oCustomExtension.executeFunction(sEventName, aArgs);
                }
                return Promise.resolve();
            });
        },

        fnMetaCreateFnBinder: ({ sEventName, baseExecContext, aArgs, fnBaseFunction, oCustomExtension }) => {
            if (oCustomExtension) {
                if (oCustomExtension.isOverridingFunction(sEventName)) {
                    // return the result of overridden function. Must be Promise.
                    return oCustomExtension.executeFunction(sEventName, aArgs);
                }
                if (oCustomExtension.isExecutionBefore(sEventName)) {
                    // ignore the result of "Before" execution
                    oCustomExtension.executeFunction(sEventName, aArgs);
                }
            }

            // call native function
            const oResult = fnBaseFunction.apply(baseExecContext, aArgs);
            if (oCustomExtension && oCustomExtension.isExecutionAfter(sEventName)) {
                oCustomExtension.executeFunction(sEventName, aArgs);
            }

            return oResult;
        }
    };
}, true);
