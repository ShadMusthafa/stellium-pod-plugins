sap.ui.define([
    "sap/ui/base/Object",
    "sap/dm/dme/formatter/NumberFormatter"
], function (BaseObject, NumberFormatter) {
    "use strict";

    var CalculatedInfoPopoverType = BaseObject.extend("stellium.ext.podplugins.materialConsumptionPlugin.controller.CalculatedInfoPopover", {

        constructor: function (sId, mSettings) {
            this._oOwnerComponent = mSettings.oOwnerComponent;
            this._oParentControl = mSettings.oParentControl;
            this._sBaseId = mSettings.oParentControl.getId() + "--" + sId;
            this._oSource = mSettings.oSource;
            this._oModelView = mSettings.oModel;

            if (!this._oCalculatedInfoPopoverView) {
                this._oCalculatedInfoPopoverView = sap.ui.xmlfragment(this._sBaseId, "stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.CalculatedInfo", this);
                this._oParentControl.addDependent(this._oCalculatedInfoPopoverView);
                var that = this;
                this._oCalculatedInfoPopoverView.attachAfterClose(function () {
                    that._afterClose();
                });
            }
            this._init();
            this._oCalculatedInfoPopoverView.openBy(this._oSource);
        },

        /**
         * Initialize Calculate Quantity to Consume dialog screen
         * @private
         */
        _init: function () {
            if (this._oModelView) {
                this._generateFields(this._oModelView);
            }
        },

        /**
         * Creates variables fields based on calculated result
         * @param {oCalculatedResult} Calculated result object
         * @private
         */
        _generateFields: function (oCalculatedResult) {
            var that = this;
            var oRowHbox;
            var oVBox = new sap.m.VBox();

            oCalculatedResult.fields.forEach(function (oField) {
                // create HBox row with two fields, each in own VBox
                oRowHbox = that._createRowHbox(oField.fieldName, NumberFormatter.dmcLocaleFloatNumberFormatter(oField.fieldValue));

                oVBox.addItem(oRowHbox);
            });
            that._createResultAndCommentsFields(oVBox, oCalculatedResult);

            that._oCalculatedInfoPopoverView.addContent(oVBox);
        },

        /**
         * Creates Result and Comments fields
         * @param {oContainer} Container for fields
         * @param {oCalculatedResult} Calculated result object
         * @private
         */
        _createResultAndCommentsFields: function (oContainer, oCalculatedResult) {
            // create HBox row for result
            var sFieldName = this._oParentControl.getController().getI18nText("calculatedResult.calculatedQty.lbl");
            var oRowHbox = this._createRowHbox(sFieldName, NumberFormatter.dmcLocaleFloatNumberFormatter(oCalculatedResult.result), "Bold");
            oContainer.addItem(oRowHbox);

            // create comments field;
            oRowHbox = new sap.m.HBox();
            var oRowVBox = new sap.m.VBox({
                width: "100%"
            });
            sFieldName = this._oParentControl.getController().getI18nText("calculateQTYtoConsume.comments.lbl");
            oRowVBox.addItem(new sap.m.Label({ text: sFieldName }));
            oRowHbox.addItem(oRowVBox);
            oContainer.addItem(oRowHbox);

            oRowHbox = new sap.m.HBox();
            oRowVBox = new sap.m.VBox({
                width: "100%"
            });
            var oTextControl = new sap.m.TextArea({
                value: oCalculatedResult.comments,
                editable: false,
                width: "100%",
                height: "100%",
                showExceededText: false,
                growing: true,
                growingMaxLines: 4
            });
            oRowVBox.addItem(oTextControl);
            oRowHbox.addItem(oRowVBox);
            oContainer.addItem(oRowHbox);
        },

        /**
         * Creates Row
         * @param {sFieldName} Field name
         * @param {sFieldValue} Field value
         * @param {sDesigned} design property
         * @private
         */
        _createRowHbox: function (sFieldName, sFieldValue, sDesigned) {
            sDesigned = sDesigned || "Standard";
            var oRowHbox;
            var oRowVBox;
            var oLabel;
            var oText;
            oRowHbox = new sap.m.HBox();
            oRowVBox = new sap.m.VBox({
                width: "70%"
            });
            oLabel = new sap.m.Label({ text: sFieldName, design: sDesigned });
            oRowVBox.addItem(oLabel);
            oRowHbox.addItem(oRowVBox);

            oRowVBox = new sap.m.VBox({
                width: "30%"
            });
            oText = new sap.m.Text({
                text: sFieldValue,
                textAlign: "End",
                width: "100%"
            });
            oRowVBox.addItem(oText);
            oRowHbox.addItem(oRowVBox);

            return oRowHbox;
        },

        _afterClose: function () {
            if (this._oCalculatedInfoPopoverView) {
                this._oCalculatedInfoPopoverView.destroy();
            }
        }
    });

    return {
        /**
         * Instantiates and opens the dialog.
         * @param {sap.ui.core.Element} oView the parent view this dialog will be set as dependent.
         * @param {Object} oParentControl - Parent Control.
         * @param {Object} oSource - source object that initiate screen.
         * @param {Object} oModel - Data Model.
         */
        openPopover: function (oOwnerComponent, oParentControl, oSource, oModel) {
            return new CalculatedInfoPopoverType("calculatedInfoPopover", {
                oOwnerComponent: oOwnerComponent,
                oParentControl: oParentControl,
                oSource: oSource,
                oModel: oModel
            });
        }
    };
});
