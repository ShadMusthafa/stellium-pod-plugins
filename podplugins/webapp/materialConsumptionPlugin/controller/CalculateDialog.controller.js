sap.ui.define([
  "sap/ui/base/Object",
  "sap/ui/model/json/JSONModel",
  "sap/dm/dme/model/AjaxUtil",
  "sap/dm/dme/formatter/NumberFormatter",
  "sap/ui/model/odata/type/Decimal"
], function (BaseObject, JSONModel, AjaxUtil, NumberFormatter, Decimal) {
  "use strict";

  var PHASE_COMPONENTS_MODEL = "phaseComponents";
  var USERSPECIFIC_FIELDS_MODEL = "userSpecificFields";
  var USERSPECIFIC_VARIABLES_MODEL = "userSpecificVariables";
  var HINT_MODEL = "hint";
  const oFieldValueConstraints = NumberFormatter.dmcLocaleDecimalConstraints();

  var CalculateDialogType = BaseObject.extend("stellium.ext.podplugins.materialConsumptionPlugin.controller.CalculateDialog", {

      fieldValueDecimalType: new Decimal(null, oFieldValueConstraints),

      constructor: function (sId, mSettings) {
          this.oView = mSettings.oParentView;
          this._fnCallback = mSettings.fnSaveCallback;
          this._oFormula = mSettings.oFormula;
          this._aComponents = mSettings.aComponents;

          this._sBaseId = mSettings.oParentView.getId() + "--" + sId;
          this._oDialog = sap.ui.xmlfragment(this._sBaseId, "stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.CalculateDialog", this);
          this._getView().addDependent(this._getDialog());
          this._getDialog().open();
          this._init();
      },

      /**
       * Initialize Calculate Quantity to Consume dialog screen
       * @private
       */
      _init: function () {
          this._getDialog().setModel(new JSONModel({
              value: "",
              enable: false
          }), HINT_MODEL);

          this._getDialog().setModel(new JSONModel([]), USERSPECIFIC_VARIABLES_MODEL);

          this._generateUserSpecificFields();
          this._getComponents();
      },

      /**
       * Handles the dialog close event. Fired on pressing Esc keyboard button too.
       */
      onCalculateCancel: function (oEvent) {
          this.dialogClose();
      },

      /**
       * Close Calculate Quantity to Consume dialog screen
       */
      dialogClose: function () {
          this._getView().removeDependent(this._getDialog());
          this._getDialog().destroy();
          this.destroy();
      },

      _getView: function () {
          return this.oView;
      },

      _getDialog: function () {
          return this._oDialog;
      },

      /**
       * Handles the clear event. Fired on pressing Clear button.
       *  Clear comments field and user specific fields
       */
      onCalculateClear: function () {
          var aVariables = this._getDialog().getModel(USERSPECIFIC_VARIABLES_MODEL).getData();
          this._clearUserSpecificFields(aVariables);
      },

      /**
       * Clear User Specific fields on Consume dialog screen
       * @param {aFields} fields array
       * @private
       */
      _clearUserSpecificFields: function (aFields) {
          var that = this;
          aFields.forEach(function (oVariable) {
              var sProperty = "/" + oVariable.fieldName;
              that._getDialog().getModel(USERSPECIFIC_FIELDS_MODEL).setProperty(sProperty, "");
          });
          that._getDialog().getModel(USERSPECIFIC_FIELDS_MODEL).setProperty("/comments", "");
      },

      /**
       * Handles the calculate event. Fired on pressing Calculate button.
       */
      onCaclulate: function () {
          this._calculate();
      },

      /**
       * Performs calculate
       * @private
       */
      _calculate: function () {
          var aVariables = this._getDialog().getModel(USERSPECIFIC_VARIABLES_MODEL).getData();
          var aResultVariables = this._validateEnteredValues(aVariables);
          if (aResultVariables.length > 0 || aVariables.length === 0) {
              var oPayload = {};
              oPayload.formulaName = this._oFormula.formulaName;
              oPayload.resultContextRef = this._oFormula.resultContextRef;
              var oVariables = {};
              aResultVariables.forEach(function (oVariable) {
                  oVariables[oVariable.name] = oVariable.value;
              });
              oPayload.variableValues = oVariables;
              this._performCalculatePostRequest(oPayload, this._calculationSuccess.bind(this));
          }
      },

      /**
       * Performs calculate Post Request
       * @param {oParameters} payload
       * @param {fnSuccessCallback} callback function for successful request
       * @private
       */
      _performCalculatePostRequest: function (oParameters, fnSuccessCallback) {
          var that = this;
          var sUrl = that._getView().getController().getProductRestDataSourceUri() + "formula/calculate";
          that._getDialog().setBusy(true);

          AjaxUtil.post(sUrl, oParameters,
              function (oResponseData) {
                  that._getDialog().setBusy(false);
                  fnSuccessCallback(oResponseData);
              },
              function (oError, oHttpErrorMessage) {
                  that._getDialog().setBusy(false);
                  var err = oError || oHttpErrorMessage;
                  that._getView().getController().showErrorMessage(err, true, true);
              }
          );
      },

      /**
       * Validates entered values into User Specific fields
       * @param {aVariables} variables array
       * @private
       */
      _validateEnteredValues: function (aVariables) {
          var aResult = [];
          var aEmptyFields = [];
          aVariables.forEach(function (oVariable) {
              var sProperty = oVariable.fieldName;
              var sFieldValue = this._getFieldValue(sProperty);
              if (!sFieldValue) {
                  aEmptyFields.push(sProperty);
              } else {
                  var oVariableValue = {};
                  oVariableValue.name = sProperty;
                  oVariableValue.value = sFieldValue;
                  aResult.push(oVariableValue);
              }
          }, this);

          if (aEmptyFields.length > 0) {
              aResult = [];
              var oParentController = this._getView().getController();
              oParentController.showErrorMessage(oParentController.getI18nText("missingRequiredUserValues", [ aEmptyFields ]), false, false);
          }
          return aResult;
      },

      _getFieldValue: function (sProperty) {
          var oFieldsModelData = this._getDialog().getModel(USERSPECIFIC_FIELDS_MODEL).getData();
          var sResult;
          oFieldsModelData.variables.some(function (item) {
              if(item.fieldName === sProperty) {
                  sResult = item.fieldValue;
                  return true;
              }
          })
          return sResult;
      },


      /**
       * Callback function for successful request
       * @param {oResponseData} response
       * @private
       */
      _calculationSuccess: function (oResponseData) {
          var oResult = {};
          var oField = {};
          var oDialog = this._getDialog();
          var aVariables = oDialog.getModel(USERSPECIFIC_VARIABLES_MODEL).getData();
          aVariables.forEach(function (oVariable) {
              oField[oVariable.fieldName] = this._getFieldValue(oVariable.fieldName);
          },this);
          oResult.formulaId = this._oFormula.ref;
          oResult.fields = oField;
          oResult.result = Math.floor(oResponseData * 1000) / 1000;
          oResult.comments = oDialog.getModel(USERSPECIFIC_FIELDS_MODEL).getProperty("/comments");
          oResult.resultContextRef = this._oFormula.resultContextRef;
          this.dialogClose();
          this._fnCallback(oResult);
      },

      /**
       * Adds user specific fields to screen
       * @private
       */
      _generateUserSpecificFields: function () {
          var aVariables = this._oFormula.variables
              .filter(function (oItem) {
                  if (oItem.userSpecific) {
                      return oItem;
                  }
              });
          this._getDialog().setModel(new JSONModel(aVariables), USERSPECIFIC_VARIABLES_MODEL);
          this._generateUserSpecificFieldsModel(aVariables);
      },

      /**
       * Creates user specific fields based on formula variables
       * @param {aVariables} formula variables array
       * @private
       */
      _generateUserSpecificFieldsModel: function (aVariables) {
          var oFieldsModel = {
              variables: []
          };

          aVariables.forEach(function (oVariable) {
              var oField = {};
              oField.fieldName = oVariable.fieldName;
              oField.fieldValue = null;
              oFieldsModel.variables.push(oField);
          });
          this._getDialog().setModel(new JSONModel(oFieldsModel), USERSPECIFIC_FIELDS_MODEL);
      },

      /**
       * Get components of current phase
       * @private
       */
      _getComponents: function () {
          this._getDialog().setModel(new JSONModel(this._aComponents), PHASE_COMPONENTS_MODEL);
      },

      /**
       * Handles the change event of select control.
       *  Set hint about consumed qty
       */
      onComponentsChange: function (oEvent) {
          var sKey = oEvent.getParameter("selectedItem").getKey();
          var aComponentData = this._getView().byId("consumptionList").getModel().getData().lineItems
              .filter(function (oItem) {
                  if (oItem.bomComponentRef === sKey) {
                      return oItem;
                  }
              });

          this._getDialog().getModel(HINT_MODEL).setProperty("/value", aComponentData[0].consumedQuantity.value);
          this._getDialog().getModel(HINT_MODEL).setProperty("/enable", !!aComponentData[0].consumedQuantity.value);
      }
  });

  return {
      /**
       * Instantiates and opens the dialog.
       * @param {sap.ui.core.Element} oView the parent view this dialog will be set as dependent.
       * @param {Object} oFormula - Formula object.
       * @param fnSaveCallback - callback function called when user presses save.
       */
      open: function (oView, oFormula, aComponents, fnSaveCallback) {
          return new CalculateDialogType("calculate", {
              oParentView: oView,
              oFormula: oFormula,
              aComponents: aComponents,
              fnSaveCallback: fnSaveCallback
          });
      }
  };
});
