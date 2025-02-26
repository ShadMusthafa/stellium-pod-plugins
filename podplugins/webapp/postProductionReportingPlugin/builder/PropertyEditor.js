sap.ui.define([
    "sap/dm/dme/podfoundation/control/PropertyEditor",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
    "sap/m/CheckBox",
    "sap/m/Label",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/dnd/DragDropInfo"
], function (PropertyEditor, Table, Column, CheckBox, Label, JSONModel, DragDropInfo) {
    "use strict";
    //If you are making any changes to the below DEFAULT_SEQUENCE_ARRAY. Please check the getVisibleSections method in PluginView controller
    const DEFAULT_SEQUENCE_ARRAY = [
        {"id": "MaterialConsumption",  "visible": true, "multipleReporting": true, "i18nKey": "materialComponents.header"},
        {"id": "QuantityConfirmation", "visible": true, "multipleReporting": true, "i18nKey": "quantityConfirmationTable.header"},
        {"id": "ActivityConfirmation", "visible": true, "multipleReporting": true, "i18nKey": "activityConfirmationTable.header"},
        {"id": "DataCollection",       "visible": true, "multipleReporting": false, "i18nKey": "dataCollection.header"}
    ];
    return PropertyEditor.extend("stellium.ext.podplugins.postProductionReportingPlugin.builder.PropertyEditor", {
        constructor: function (sId, mSettings) {
            PropertyEditor.apply(this, arguments);
            this.setI18nKeyPrefix("postProductionReportingConfig.");
            this.setResourceBundleName("stellium.ext.podplugins.postProductionReportingPlugin.i18n.builder");
            this.setPluginResourceBundleName("stellium.ext.podplugins.postProductionReportingPlugin.i18n.i18n");
        },

        addPropertyEditorContent: function (oPropertyFormContainer) {
            var oData = this.getPropertyData();
            oData.sequence = oData.sequence || DEFAULT_SEQUENCE_ARRAY.slice();
            // oData.useCurrentDateTime =  oData.useCurrentDateTime || false;
            oData.multipleReportingGR = oData.multipleReportingGR || true;
            oData.calculateGI = oData.calculateGI || false;

            this.addSwitch(oPropertyFormContainer, "prefillPlannedStartDate", oData);
            this.addSwitch(oPropertyFormContainer, "prefillPhaseDates", oData);
            this.addSwitch(oPropertyFormContainer, "showOrderHeaderInstructions", oData);
            this.addInputField(oPropertyFormContainer, "customField1", oData);
            this.addSequenceConfigTable(oPropertyFormContainer, "sequenceTable", oData);
            // this.addSwitch(oPropertyFormContainer, "useCurrentDateTime", oData);
            this.addSwitch(oPropertyFormContainer, "multipleReportingGR", oData);
            this.addSwitch(oPropertyFormContainer, "calculateGI", oData);
            this.addSwitch(oPropertyFormContainer, "allowFinalConfirmation", oData);
        },

        getDefaultPropertyData: function () {
            return {
                "prefillPlannedStartDate": true,
                "prefillPhaseDates": true,
                "showOrderHeaderInstructions": false,
                "customField1": "",
                "sequence": DEFAULT_SEQUENCE_ARRAY.slice(),
                // "useCurrentDateTime": false,
                "multipleReportingGR": true,
                "calculateGI": false,
                "allowFinalConfirmation": true
            };
        },
        addSequenceConfigTable: function (oPropertyFormContainer, sequenceTable, oData) {

            var oSequenceModel = new JSONModel(oData.sequence);
            const oTable = new Table({
                columns: this.getTableConfiguration(),
                selectionMode: sap.ui.table.SelectionMode.None,
                visibleRowCount: 4,
                dragDropConfig: [
                    new DragDropInfo({
                        sourceAggregation: "rows",
                        targetAggregation: "rows",
                        dropPosition: "On",
                        dragStart: "onDragStart",
                        drop: this.onDropSequence.bind(this)
                    })
                ]
            });
            oTable.setModel(oSequenceModel);
            oTable.bindAggregation("rows", {
                path: "/"
            });
            oPropertyFormContainer.addContent(oTable);
        },
        getTableConfiguration: function () {
            const oSectionColumn = new Column({
                name: "SECTION",
                label: new Label({
                    text: this.getLocalizedText("section")
                }),
                template: new Label({
                    wrapping: true,
                    text: {
                        path: 'i18nKey',
                        formatter: this.getText.bind(this)
                    }
                })
            });
            const oVisibleColumn = new Column({
                name: "VISIBLE",
                label: new Label({
                    text: this.getLocalizedText("visible")
                }),
                width: "65px",
                template: new CheckBox({
                    selected: "{visible}"
                })
            });
            const oMultipleReportingColumn = new Column({
                name: "MULTI_REPORTING",
                label: new Label({
                    text: this.getLocalizedText("multipleReporting")
                }),
                template: new CheckBox({
                    selected: "{multipleReporting}",
                    enabled: {
                        path: 'id',
                        formatter: this.multiReportingEnableHandler.bind(this)
                    }
                })
            });
            return [oSectionColumn, oVisibleColumn, oMultipleReportingColumn];
        },
        onDropSequence: function (oEvent) {
            const oDraggedControl = oEvent.getParameter("draggedControl");
            const oTargetControl = oEvent.getParameter("droppedControl");
            let oModelData = oDraggedControl.getBindingContext().getModel().getData();
            const actualIndex = parseInt(oDraggedControl.getId().split('').pop());
            const targetIndex = parseInt(oTargetControl.getId().split('').pop());
            let itemAtActualIndex = oModelData[actualIndex];
            oModelData.splice(actualIndex, 1);
            oModelData.splice(targetIndex, 0, itemAtActualIndex);
            oDraggedControl.getBindingContext().getModel().setData(oModelData);
        },
        getText: function (sValue) {
            return this.getLocalizedText(sValue);
        },
        multiReportingEnableHandler: function (sValue) {
           return sValue !== 'DataCollection';
        }
    });
});
