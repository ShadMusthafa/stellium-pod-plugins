sap.ui.define([
    "stellium/ext/podplugins/materialConsumptionPlugin/controller/CommonConsumeHandler",
    "./../utils/formatter",
    "sap/ui/core/Fragment",
    "sap/dm/dme/logging/Logging",
    "sap/m/MessageToast",
    "sap/dm/dme/model/AjaxUtil",
], function (CommonConsumeHandler, Formatter, Fragment, Logging, MessageToast, AjaxUtil) {
    "use strict";
    const oLogger = Logging.getLogger("stellium.ext.podplugins.materialConsumptionPlugin.controller.WeighDispenseHandler");
    var WeighDispenseHandler = CommonConsumeHandler.extend("stellium.ext.podplugins.materialConsumptionPlugin.controller.WeighDispenseHandler", {

        constructor: function (oController) {
            this.oMaterialConsumptionController = oController;
        },

        _initializeScale: function (bTakeCurrentWeight) {

            var oView = this.oMaterialConsumptionController.getView();
            var oBoxVizLegend = this.getCurrentWeighVizLegend();
            oBoxVizLegend.setVisible(true);


            var oWeighingModel = this.getCurrentModel(),
                dCurrentWeight = 0;
            if (bTakeCurrentWeight !== undefined && bTakeCurrentWeight) {
                dCurrentWeight = parseFloat(oWeighingModel.getProperty("/quantity/value"));
            }

            var dTargetQuantityValue = this.targetQuantityForSelectedMaterial,
                oTargetQty = oWeighingModel.getProperty("/TargetQuantity"),
                sTargetQtyUOM = oTargetQty.unitOfMeasure.uom;

            // Data Fetch Total Weight
            var aTotalWeightData = [
                {
                    Name: "TotalWeight",
                    Target: dTargetQuantityValue,
                    CurrentWeight: dCurrentWeight,
                    ConsumedWeight: this.consumedQuantityForSelectedMaterial,
                    UOM: sTargetQtyUOM
                }
            ];
            oWeighingModel.setProperty("/TotalWeight", aTotalWeightData);

            // VizProperties Total Weight
            var oTotalWeightData = aTotalWeightData[0],
                dScaleRange = oTotalWeightData.Target * 4;
            var oVizFrameTotalWeight = this.getCurrentVizFrameTotal();
            var oVizPropTotalWeightPlotArea = {
                plotArea: {
                    primaryScale: {
                        fixedRange: true,
                        minValue: 0,
                        maxValue: dScaleRange
                    },
                    colorPalette: ['#91C8F6', '#427CAC'],
                    referenceLine: {
                        line: {
                            valueAxis: [
                                {
                                    value: oTotalWeightData.Target,
                                    color: 'sapUiPositiveElement',
                                    visible: true,
                                    label: {
                                        background: 'sapUiPositiveElement',
                                        text: this.getI18nTextByKey("VFRefLineTarget") + " = " + Formatter.formatNumber(oTotalWeightData.Target) + " " + oTotalWeightData.UOM,
                                        visible: true
                                    }
                                }
                            ]
                        }
                    }
                }
            };
            oVizFrameTotalWeight.setVizProperties(oVizPropTotalWeightPlotArea);
            oVizFrameTotalWeight.getDataset().getMeasures()[0].setUnit(sTargetQtyUOM);
            oVizFrameTotalWeight.getDataset().getMeasures()[1].setUnit(sTargetQtyUOM);

            // Data Fetch Current Weight
            var dTargetQuantityValue = this.targetQuantityForSelectedMaterial,
                dConsumedQuantityValue = this.consumedQuantityForSelectedMaterial,
                oQuantityInfo = oWeighingModel.getProperty("/quantity"),
                sQtyUOM = oQuantityInfo.unitOfMeasure.uom,
                dNewTarget = 0,
                aRefLinesArray = [];

            if (dConsumedQuantityValue) {
                let dCalcResult = dTargetQuantityValue - dConsumedQuantityValue;
                dNewTarget = parseFloat(dCalcResult.toFixed(3));
            } else {
                dNewTarget = dTargetQuantityValue;
            }

            if (dNewTarget > 0) {
                var oToleranceInfo = oWeighingModel.getProperty("/tolerance"),
                    dToleranceBottom = 0,
                    dToleranceTop = 0;

                if (oToleranceInfo) {
                    dToleranceBottom = oToleranceInfo.lowerThresholdValue;
                    dToleranceTop = oToleranceInfo.upperThresholdValue;
                }

                if (dConsumedQuantityValue > 0) {
                    dToleranceBottom = dToleranceBottom - dConsumedQuantityValue;
                    dToleranceTop = dToleranceTop - dConsumedQuantityValue;
                }

                if (dToleranceBottom > 0) {
                    aRefLinesArray.push({
                        value: dToleranceBottom,
                        color: 'sapUiCriticalElement',
                        visible: true,
                        label: {
                            background: 'sapUiCriticalElement',
                            text: "",
                            visible: true
                        }
                    });
                }

                aRefLinesArray.push({
                    value: dNewTarget,
                    color: 'sapUiPositiveElement',
                    visible: true,
                    label: {
                        background: 'sapUiPositiveElement',
                        text: this.getI18nTextByKey("VFRefLineTarget") + " = " + Formatter.formatNumber(dNewTarget) + " " + sQtyUOM,
                        visible: true
                    }
                });

                if (dToleranceTop > 0) {
                    aRefLinesArray.push({
                        value: dToleranceTop,
                        color: 'sapUiCriticalElement',
                        visible: true,
                        label: {
                            background: 'sapUiCriticalElement',
                            text: "",
                            visible: true
                        }
                    });
                }
            }

            var aCurrentWeightData = [
                {
                    Name: "CurrentWeight",
                    Target: dTargetQuantityValue,
                    CurrentWeight: dCurrentWeight,
                    UOM: sQtyUOM
                }
            ];

            oWeighingModel.setProperty("/CurrentWeight", aCurrentWeightData);

            // VizProperties Current Weight
            var dCurrentTarget = (dNewTarget > 0) ? dNewTarget : dTargetQuantityValue;
            dCurrentTarget = (dToleranceTop > 0 && dToleranceTop > dNewTarget) ? dToleranceTop : dNewTarget;
            dCurrentTarget = (dCurrentTarget > 0) ? dCurrentTarget : dTargetQuantityValue;
            var dCurrentScaleMax = dCurrentTarget + (dCurrentTarget / 100 * 20);

            var oVizFrameCurrentWeight = this.getCurrentVizFrameCurrent();
            var oVizPropCurrentWeightPlotArea = {
                plotArea: {
                    primaryScale: {
                        fixedRange: true,
                        minValue: 0,
                        maxValue: dCurrentScaleMax
                    },
                    colorPalette: ['#91C8F6'],
                    referenceLine: {
                        line: {
                            valueAxis: aRefLinesArray
                        }
                    }
                }
            };
            oVizFrameCurrentWeight.setVizProperties(oVizPropCurrentWeightPlotArea);
            oVizFrameCurrentWeight.getDataset().getMeasures()[0].setUnit(sQtyUOM);
        },

        _initWeighingHeaderModel: function (oBindingObject) {
            var oView = this.oMaterialConsumptionController.getView();
            var oWeighingModel = oView.getModel("weighingModel");
            var sSelectedMaterial = oBindingObject.materialId.material;
            var sSelectedMaterialDesc = oBindingObject.description;
            var sSelectedMaterialRef = oBindingObject.materialId.ref;
            var sSelectedMaterialVersion = oBindingObject.materialId.version;
            var sSelectedMaterialType = oBindingObject.materialType;
            var bIsBomComponent = oBindingObject.isBomComponent;
            var sStorageLocationRef;
            var sStorageLocation;
            if (oBindingObject.storageLocation) {
                sStorageLocationRef = oBindingObject.storageLocation.ref;
                sStorageLocation = oBindingObject.storageLocation.storageLocation;
            } else {
                sStorageLocationRef = "";
                sStorageLocation = "";
            }

            // Batch Info
            var bIsBatchManaged = (oBindingObject.batchManaged === undefined || oBindingObject.batchManaged === "NONE") ? false : true;
            var sDefaultBatchId;
            if (bIsBatchManaged) {
                sDefaultBatchId = oBindingObject.plannedBatchNumber || "";
            } else {
                sDefaultBatchId = this.oMaterialConsumptionController.getI18nText("notBatchManaged");
            }

            // BOM Info
            var sSelectedUom = Formatter.getValidQty(oBindingObject.totalQtyEntryUom, oBindingObject.totalQtyBaseUom, oBindingObject.targetQuantity).unitOfMeasure.uom;
            var sBOMComponentRef = oBindingObject.bomComponentRef;

            // User Info
            var sLoggedInUser = this.getLoggedInUser();
            this.oMaterialConsumptionController.isPostedByValid = sLoggedInUser && sLoggedInUser.length > 0;
            this.oMaterialConsumptionController.isQuantityValid = true;

            // UOM Model
            if (!this.oMaterialConsumptionController.alternateUomForSelectedMaterial.hasOwnProperty(sSelectedMaterial)) {
                this.oMaterialConsumptionController.getAlternateUoms(this.oMaterialConsumptionController.alternateUomForSelectedMaterial, sSelectedMaterial, sSelectedMaterialRef, sSelectedMaterialVersion, "weighing");
            } else {
                this.oMaterialConsumptionController.alternateUomsModel.setData(this.oMaterialConsumptionController.alternateUomForSelectedMaterial[sSelectedMaterial]);
                oView.setModel(this.oMaterialConsumptionController.alternateUomsModel, "unitModel");
            }

            // Quantity Info
            var dConsumedQuantity = Formatter.getValidConsumedQty(oBindingObject.consumedQuantity, oBindingObject.consumedQtyEntryUom);
            // C5278086 Changes for Target Quantity.
            var dTargetQuantity = Formatter.getValidQty(oBindingObject.totalQtyEntryUom, oBindingObject.totalQtyBaseUom, oBindingObject.targetQuantity);
            this.consumedQuantityForSelectedMaterial = dConsumedQuantity && dConsumedQuantity.value || 0;
            this.targetQuantityForSelectedMaterial = dTargetQuantity && dTargetQuantity.value || 0;

            //Material Tolerance
            var dUpperMaterialThresholdValue = (oBindingObject.upperThresholdValueToBeDisplayed) ? oBindingObject.upperThresholdValueToBeDisplayed : 0;
            var dLowerMaterialThresholdValue = (oBindingObject.lowerThresholdValueToBeDisplayed) ? oBindingObject.lowerThresholdValueToBeDisplayed : 0;
            this.upperThresholdForSelectedMaterial = dUpperMaterialThresholdValue;

            // Set the Model values
            oWeighingModel.setProperty("/shopOrder", this.oMaterialConsumptionController.selectedDataInList.selectedShopOrder);
            let sOperationActivity = '';
            if (this.oMaterialConsumptionController.selectedDataInList.orderSelectionType === "PROCESS")
                sOperationActivity = this.oMaterialConsumptionController.selectedDataInList.phaseId
            else
                sOperationActivity = this.oMaterialConsumptionController.selectedDataInList.operation.operation;
            oWeighingModel.setProperty("/operationActivity", sOperationActivity);
            oWeighingModel.setProperty("/phaseId", this.oMaterialConsumptionController.selectedDataInList.truncatedPhaseId);

            oWeighingModel.setProperty("/material", sSelectedMaterial);
            oWeighingModel.setProperty("/materialRef", sSelectedMaterialRef);
            oWeighingModel.setProperty("/materialVersion", sSelectedMaterialVersion);
            oWeighingModel.setProperty("/materialDescription", sSelectedMaterialDesc);
            oWeighingModel.setProperty("/materialType", sSelectedMaterialType);
            oWeighingModel.setProperty("/batchId", this.oMaterialConsumptionController.selectedDataInList.selectedSfc);
            oWeighingModel.setProperty("/batchNumber", sDefaultBatchId);
            oWeighingModel.setProperty("/batchManaged", bIsBatchManaged);
            oWeighingModel.setProperty("/workCenter", this.oMaterialConsumptionController.selectedDataInList.workCenter.workcenter);
            oWeighingModel.setProperty("/quantity/unitOfMeasure/uom", sSelectedUom);
            oWeighingModel.setProperty("/quantity/value", "");
            this.oMaterialConsumptionController.isQuantityValid = false;
            oWeighingModel.setProperty("/storageLocation", sStorageLocation);
            oWeighingModel.setProperty("/storageLocationRef", sStorageLocationRef);
            oWeighingModel.setProperty("/bomComponentRef", sBOMComponentRef);
            oWeighingModel.setProperty("/isBomComponent", bIsBomComponent);
            oWeighingModel.setProperty("/userId", sLoggedInUser);
            oWeighingModel.setProperty("/dateTime", this.getCurrentDateInPlantTimeZone());
            this.oMaterialConsumptionController.getInventoryStockData(sDefaultBatchId, bIsBatchManaged, sStorageLocation, sStorageLocationRef, sSelectedMaterialRef, sSelectedMaterial);


            //Weighing Popup
            oWeighingModel.setProperty("/tolerance", {
                "upper": oBindingObject.recipeComponentToleranceOver,
                "upperThresholdValue": dUpperMaterialThresholdValue,
                "lower": oBindingObject.recipeComponentToleranceUnder,
                "lowerThresholdValue": dLowerMaterialThresholdValue
            });

            var oConsumedQtyInfo = JSON.parse(JSON.stringify(dConsumedQuantity)),
                oTargetQtyInfo = JSON.parse(JSON.stringify(dTargetQuantity));

            oWeighingModel.setProperty("/TaraWeight", 0);
            oWeighingModel.setProperty("/TargetQuantity", oTargetQtyInfo);
            oWeighingModel.setProperty("/ConsumedQuantity", oConsumedQtyInfo);
            this.oMaterialConsumptionController.sScaleUnitOfMeasure = sSelectedUom;
        },
        _initScale: function () {

            this._resetWeighingDialog();
            var oWeighingModel = this.getCurrentModel();
            var oStandardVizProperties = {
                title: {
                    visible: false
                },
                valueAxis: {
                    label: {
                        visible: true
                    },
                    title: {
                        visible: false
                    }
                },
                categoryAxis: {
                    label: {
                        visible: false
                    },
                    title: {
                        visible: true
                    }
                },
                legend: {
                    visible: false
                },
                plotArea: {
                    dataLabel: {
                        visible: true
                    },
                    dataPointSize: {
                        min: 55,
                        max: 55
                    }
                }
            };
            oWeighingModel.setProperty("/TotalWeight", null);

            var oVizFrameTotalWeight = this.getCurrentVizFrameTotal();
            oStandardVizProperties.categoryAxis.title.text = this.getI18nTextByKey("VFTitleTotalWeight");
            oVizFrameTotalWeight.setVizProperties(oStandardVizProperties);

            oWeighingModel.setProperty("/CurrentWeight", null);

            var oVizFrameCurrentWeight = this.getCurrentVizFrameCurrent();
            oStandardVizProperties.categoryAxis.title.text = this.getI18nTextByKey("VFTitleCurrentWeight");
            oVizFrameCurrentWeight.setVizProperties(oStandardVizProperties);
        },
        onSelectScale: function (oEvent) {
            this.aIndicatorData = null;
            var oCurrentModel = this.getCurrentModel();
            oCurrentModel.setProperty("/TaraWeight", "");

            this._setVizFrameEnabled(true);
            this._checkUpdateScale();
            this._setEnabledScaleButtons(true);
            var oPluginConfiguration = this.oMaterialConsumptionController.oPluginConfiguration,
                bShowSetTare = oPluginConfiguration.showWeighingSetTare;
            if (bShowSetTare !== undefined && bShowSetTare === true) {
                this.readTareValue();
            }
        },
        _setVizFrameEnabled: function (bStatus) {
            const oView = this.getView();
            oView.byId('beforeScaleWeighPopupStatusContainer') && oView.byId('beforeScaleWeighPopupStatusContainer').setVisible(!bStatus);
            oView.byId('vizFrameWeighPopupParentContainer') && oView.byId('vizFrameWeighPopupParentContainer').setVisible(bStatus);

            oView.byId('beforeScaleScannerWeighMaterialPopupStatusContainer') && oView.byId('beforeScaleScannerWeighMaterialPopupStatusContainer').setVisible(!bStatus);
            oView.byId('vizFrameScannerWeighMaterialPopupParentContainer') && oView.byId('vizFrameScannerWeighMaterialPopupParentContainer').setVisible(bStatus);

            oView.byId('beforeScaleAddWeighMaterialPopupStatusContainer') && oView.byId('beforeScaleAddWeighMaterialPopupStatusContainer').setVisible(!bStatus);
            oView.byId('vizFrameAddWeighMaterialPopupParentContainer') && oView.byId('vizFrameAddWeighMaterialPopupParentContainer').setVisible(bStatus);
        },
        _checkUpdateScale: function () {
            var oInBatch = this.getCurrentWeighBatchInput(),
                sBatchValue = oInBatch.getValue(),
                oInStorageLocation = this.getCurrentStorageLocationInput(),
                sStorageLocation = oInStorageLocation.getValue(),
                oCMBScale = this.getCurrentWeighScaleList(),
                // sScaleValue = oCMBScale.getSelectedKey(),
                sScaleValue = oCMBScale.getValue(),
                bBatchValid = false,
                bStorageLocValid = false,
                bScaleValid = false;
            const oCurrentModel = this.getCurrentModel();
            if (oCurrentModel.getProperty("/batchManaged")) {
                if (sBatchValue.length > 0 && this.oMaterialConsumptionController.isBatchNumberValid) {
                    bBatchValid = true;
                    bStorageLocValid = true;
                }
            } else {
                bBatchValid = true;
                if (sStorageLocation.length > 0) {
                    bStorageLocValid = true;
                }
            }

            if (sScaleValue.length > 0) {
                bScaleValid = true;
            }

            const bIsPipelineMaterial = (oCurrentModel.getProperty("/materialType") && oCurrentModel.getProperty("/materialType") === "PIPELINE") || false;
            if (bBatchValid && (bStorageLocValid || bIsPipelineMaterial) && bScaleValid) {
                this._initializeScale();
                var that = this;
                this.setWeighPopUpVizFrameBusyState(true);
                this.readUnitOfMeasure().done(that.readAcutalScaleValue.bind(that));
            }
        },
        _resetWeighingDialog: function () {
            var oBoxVizLegend = this.getCurrentWeighVizLegend();
            oBoxVizLegend.setVisible(false);
            var oTxtAreaComments = this.getCurrentWeighCommentsArea();
            oTxtAreaComments.setValue("");
            this.setWeighingSaveButtons(false);

            this.setWeighPopUpVizFrameBusyState(false);
            var oCMBScale = this.getCurrentWeighScaleList();
            // oCMBScale.setSelectedKey(null);
            oCMBScale.setValue(null);
            this.customFieldJson = [];

        },

        closeWeighingDialog: function (oEvent) {
            var oView = this.getView(),
                oWeighingDialog = oView.byId(this.getCurrentDialogId()),
                oWeighingModel = this.getCurrentModel();
            oWeighingDialog.close();
            oWeighingDialog.setBusy(false);
            this.resetModel(oWeighingModel);
            this.oMaterialConsumptionController.sScaleUnitOfMeasure = "";
            this._setEnabledScaleButtons(false);
            this._resetWeighingDialog();

            var sCurrentDialogID = this.getCurrentDialogId();
            if (sCurrentDialogID === "weighDialog") {
                this.oMaterialConsumptionController.isWeighingDialogOpen = false;
            } else if (sCurrentDialogID === "scanWeighDialog") {
                this.oMaterialConsumptionController.isScanWeighDialogOpen = false;
            } else {
                this.oMaterialConsumptionController.isAddWeighDialogOpen = false;
                oView.byId("inAddWeighMatNum").setValue("");
            }
            oWeighingDialog && oWeighingDialog.destroy();
        },

        _setEnabledScaleButtons: function (bEnabledState) {
            var oPluginConfiguration = this.oMaterialConsumptionController.oPluginConfiguration;
            var bSetZeroVisible = oPluginConfiguration.showWeighingSetZero;
            if (bSetZeroVisible) {
                var oBtnSetZero = this.getCurrentSetZeroButton();
                oBtnSetZero.setEnabled(bEnabledState);
            }
            
            var bSetTareVisible = oPluginConfiguration.showWeighingSetTare;
            if (bSetTareVisible) {
                var oBtnSetTare = this.getCurrentSetTareButton();
                oBtnSetTare.setEnabled(bEnabledState);
            }
        },
        setWeighingSaveButtons: function (bEnabledState) {
            let oBtnConfirm = this.getCurrentWeightConfirmButton(),
                oBtnAddWeight = this.getCurrentWeightAddWeightButton();
            oBtnConfirm.setEnabled(bEnabledState);
            oBtnAddWeight.setEnabled(bEnabledState);
        },
        readTareValue: function () {
            const oPluginConfiguration = this.oMaterialConsumptionController.oPluginConfiguration,
                sIndicatorTaraWeight = oPluginConfiguration.charcTareWeightIndicator;
            if (sIndicatorTaraWeight !== undefined && sIndicatorTaraWeight.length > 0) {
                this.readIndicator(sIndicatorTaraWeight, "setTare");
            } else {
                const sErroMsg = this.getI18nTextByKey("ErrMsgNoIndicatorForTaraWeight");
                this.showErrorMessage(sErroMsg);
            }
        },

        readUnitOfMeasure: function () {
            var oPluginConfiguration = this.oMaterialConsumptionController.oPluginConfiguration,
                sIndicatorName = oPluginConfiguration.charcUOMIndicatorName;
            var readUomPromise = jQuery.Deferred();
            if (sIndicatorName !== undefined && sIndicatorName.length > 0) {
                this.readIndicator(sIndicatorName, "getUOM", readUomPromise);
                return readUomPromise;
            } else {
                this.setWeighPopUpVizFrameBusyState(false);
                var sErroMsg = this.getI18nTextByKey("ErrMsgNoIndicatorForUnitOfMeasure");
                this.showErrorMessage(sErroMsg);
            }
        },

        readAcutalScaleValue: function () {
            var oPluginConfiguration = this.oMaterialConsumptionController.oPluginConfiguration,
                sIndicatorName = oPluginConfiguration.charcWeighingIndicatorName;
            if (sIndicatorName !== undefined && sIndicatorName.length > 0) {
                this.readIndicator(sIndicatorName, "getActualWeight");
            } else {
                var sErroMsg = this.getI18nTextByKey("ErrMsgNoIndicatorForUnitOfMeasure");
                this.showErrorMessage(sErroMsg);
            }
        },
        setDetailedModel: function () {
            var oModel = this.getCurrentModel();
            this.resetModel(oModel);
            let sLoggedInUser = this.getLoggedInUser();
            oModel.setProperty("/userId", sLoggedInUser);
            this.oMaterialConsumptionController.isPostedByValid = sLoggedInUser && sLoggedInUser.length > 0;
            this.focusMaterialInput();
        },
        openWeighingDialog: function () {

            var oView = this.getView(),
                oWeighingDialog = oView.byId("weighDialog");
            if (!oWeighingDialog) {
                let sPopupPath = "stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.WeighPopup";
                Fragment.load({
                    id: oView.getId(),
                    name: sPopupPath,
                    controller: this.oMaterialConsumptionController
                }).then(function (oDialog) {
                    this.buildCustomFieldFormContent();
                    oDialog.setEscapeHandler(this.closeWeighingDialog);
                    oView.addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this.buildCustomFieldFormContent();
                oWeighingDialog.open();
            }

        },
        openWeighingScanDialog: function () {
            var oView = this.getView(),
                oScanWeighingDialog = oView.byId("scanWeighDialog");
            this.oMaterialConsumptionController.isScanWeighDialogOpen = true;
            let oModel = this.getCurrentModel();
            if (!oScanWeighingDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.ScannerWeighDialog",
                    controller: this.oMaterialConsumptionController
                }).then(function (oDialog) {
                    this.setCurrentUserAndDate(oModel);
                    oDialog.setEscapeHandler(this.closeWeighingDialog);
                    this.setDetailedModel();
                    this.buildCustomFieldFormContent();
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.focusMaterialInput();
                }.bind(this));
            } else {
                this.setDetailedModel();
                this.buildCustomFieldFormContent();
                oScanWeighingDialog.open();
                this.focusMaterialInput();
            }
            this.setCurrentUserAndDate(oModel);
        },
        setCurrentUserAndDate: function (oCurrentModel) {
            var sLoggedInUser = this.getLoggedInUser();
            oCurrentModel.setProperty("/dateTime", this.getCurrentDateInPlantTimeZone());
            oCurrentModel.setProperty("/userId", sLoggedInUser);
            this.oMaterialConsumptionController.isPostedByValid = sLoggedInUser && sLoggedInUser.length > 0;
        },
        openWeighingAddDialog: function () {
            var oView = this.getView(),
                oAddWeighingDialog = oView.byId("addWeighDialog");
            this.oMaterialConsumptionController.isAddWeighDialogOpen = true;
            var oCurrentModel = this.getCurrentModel();
            if (!oAddWeighingDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.AddWeighMaterial",
                    controller: this.oMaterialConsumptionController
                }).then(function (oDialog) {
                    this.resetModel(oCurrentModel);
                    this.setCurrentUserAndDate(oCurrentModel);
                    oDialog.setEscapeHandler(this.closeWeighingDialog);
                    this.buildCustomFieldFormContent();
                    oView.addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this.resetModel(oCurrentModel);
                this.buildCustomFieldFormContent();
                oAddWeighingDialog.open();
            }
            this.setCurrentUserAndDate(oCurrentModel);
        },
        setNewScaleValue: function (sCurrentQuantity) {
            var oWeighingModel = this.getCurrentModel(),
                oWeighingPropTotal = oWeighingModel.getProperty("/TotalWeight"),
                oWeighingPropCurrent = oWeighingModel.getProperty("/CurrentWeight"),
                oDataCurrent = JSON.parse(JSON.stringify(oWeighingPropCurrent)),
                oDataTotal = JSON.parse(JSON.stringify(oWeighingPropTotal)),
                dNewValue = parseFloat(sCurrentQuantity);
            oWeighingModel.setProperty("/quantity/value", sCurrentQuantity);
            oDataCurrent[0].CurrentWeight = dNewValue;
            oDataTotal[0].CurrentWeight = dNewValue;
            oWeighingModel.setProperty("/CurrentWeight", oDataCurrent);
            oWeighingModel.setProperty("/TotalWeight", oDataTotal);

            this.checkWeighingQuantity();
        },
        checkWeighingQuantity: function () {
            var oView = this.getView(),
                oWeighingModel = this.getCurrentModel(),
                bQuantityValid = false;
            if (oWeighingModel) {
                var sQuantity = oWeighingModel.getProperty("/quantity/value");
                //Negative and zero quantity checks are removed as there are chances that the scale could read
                // either of these
                bQuantityValid = sQuantity !== undefined && parseFloat(sQuantity) > 0;
            }

            this.oMaterialConsumptionController.isQuantityValid = bQuantityValid;
            if (bQuantityValid) {
                this.oMaterialConsumptionController._enableConfirmButton();
            } else {
                this.setWeighingSaveButtons(false);
            }
        },
        setNewTareWeightValue: function (dCurrentTareWeight) {
            var oWeighingModel = this.getCurrentModel();
            oWeighingModel.setProperty("/TaraWeight", Formatter.parseNumber(Formatter.formatNumber(dCurrentTareWeight)));
        },

        getEquipmentID: function () {
            var oCMBScale = this.getCurrentWeighScaleList(),
                oCurrWeighingModel = this.getCurrentModel();
            if (oCurrWeighingModel) {
                // var sResource = oCMBScale.getSelectedKey(),
                var sResource = oCMBScale.getValue(),
                    oResourceObject = oCurrWeighingModel.getProperty("/scaleList").find(oData => oData.resource === sResource);
                if (Object.keys(oResourceObject).length > 0 && oResourceObject.equipment && oResourceObject.equipment.length > 0) {
                    return oResourceObject.equipment[0].equipmentId;
                } else {
                    const sErrorMsg = this.getI18nTextByKey("wd.validScaleRequired", [sResource]);
                    MessageToast.show(sErrorMsg);
                    this.setWeighButtons(false);
                    this.setWeighPopUpVizFrameBusyState(false);
                }
                return [];
            }
        },
        getIndicatorIDs: function (sIndicatorName, sMethod, aParams) {
            var that = this;
            let sRequestURL;
            if (!this.oMaterialConsumptionController.aIndicatorData) {
                var sEquipmentID = this.getEquipmentID();
                sRequestURL = "../sapdmdmepod/dmi/machinemodel/v1.0/eabmindicator/asset(" + sEquipmentID + ")/indicators";
                var oParameters = {};
                AjaxUtil.get(sRequestURL, oParameters, function (aResponseData) {
                        that.oMaterialConsumptionController.aIndicatorData = aResponseData;
                        if (sMethod === "writeIndicator") {
                            var oValue = aParams[0];
                            that.writeIndicator(sIndicatorName, oValue);
                        } else if (sMethod === "readIndicator") {
                            var sProzessafterCallback = aParams[0];
                            that.readIndicator(sIndicatorName, sProzessafterCallback, aParams.length > 1 ? aParams[1] : null);
                        }
                    },
                    function (oError) {
                        oLogger.error("Cannot find the scale Indicators for equipment Id ", sEquipmentID, ". Please check Machine Model configuration.");
                        let sErrorMsg = that.getI18nTextByKey("wd.validScaleConfigRequired");
                        MessageToast.show(sErrorMsg);
                        that.oWeighDispenseHandler.setWeighPopUpVizFrameBusyState(false);
                    });
                return "FetchDetails";
            } else {
                let oIndicatorObj, oResponse;

                function findIndicator(indicatorArray) {
                    let sStructureToAssetTypePathId, sNamedAssociationPathId;

                    for (const element of indicatorArray) {
                        if (element.structureToAssetTypePathId) {
                            sStructureToAssetTypePathId = element.structureToAssetTypePathId;
                        }

                        if (element.namedAssociationPathId) {
                            sNamedAssociationPathId = element.namedAssociationPathId;
                        }

                        if (element.properties) {
                            const oIndicators = element.properties;
                            oIndicatorObj = oIndicators.find(indicator => indicator.referenceName === sIndicatorName);

                            if (oIndicatorObj) {

                                oResponse = {
                                    referenceName: oIndicatorObj.referenceName,
                                    structureToAssetTypeReferencePathId: sStructureToAssetTypePathId,
                                    referencePathId: sNamedAssociationPathId || null
                                };
                                return;
                            }
                        }
                        if (element.nestedStructures) {
                            findIndicator(element.nestedStructures);
                        }
                    }
                }

                findIndicator(this.oMaterialConsumptionController.aIndicatorData);

                if (oIndicatorObj !== undefined && Object.keys(oIndicatorObj).length > 0) {
                    return oResponse;
                } else {
                    let sErrorMsg = this.getI18nTextByKey("ErrMsgNoIndicatorInformation", [sIndicatorName]);
                    this.showErrorMessage(sErrorMsg);
                    this.setWeighPopUpVizFrameBusyState(false);
                    return "NoIndicatorFound";
                }
            }
        },
        readIndicator: function (sIndicator, sProzessafterCallback, optionalPromise) {
            var sEquipmentID = this.getEquipmentID();
            if (sEquipmentID.length > 0) {
                var aParamArray = [
                    sProzessafterCallback,
                    optionalPromise
                ];
                var oIndicatorObj = this.getIndicatorIDs(sIndicator, "readIndicator", aParamArray);
                if (oIndicatorObj !== "FetchDetails") {
                    if (oIndicatorObj !== "NoIndicatorFound") {
                        let sRequestURL, oRequestObject;
                        sRequestURL = "../sapdmdmepod/dmi/machinemodel-runtime/v1.0/asset(" + sEquipmentID + ")/indicators/readData";
                        oRequestObject = {
                            "mode": "2",
                            "selectedIndicatorInputs": [
                                {
                                    "referenceName": oIndicatorObj.referenceName,
                                    "referencePathId": oIndicatorObj.referencePathId,
                                    "structureToAssetTypeReferencePathId": oIndicatorObj.structureToAssetTypeReferencePathId
                                }
                            ]
                        };
                        this.readIndicatorAjax(sRequestURL, oRequestObject, sIndicator, sProzessafterCallback, optionalPromise);
                    } else {
                        this.setWeighButtons(false);
                    }
                }
            }
        },
        readIndicatorAjax: function (sUrl, oRequestData, sIndicator, sProzessafterCallback, optionalPromise) {
            var that = this;

            AjaxUtil.post(sUrl, oRequestData, function (oResponseData) {
                var sSuccessCode = oResponseData.querySuccess;
                if (sSuccessCode !== undefined && sSuccessCode !== false) {
                    function checkResponseAval() {
                        return oResponseData?.series[0]?.points[0]?.value !== undefined;
                    }

                    if (checkResponseAval()) {
                        switch (sProzessafterCallback) {
                            case "setTare":
                                var dCurrentTareWeight = oResponseData.series[0].points[0].value;
                                var oCurrentModel = that.getCurrentModel();
                                if (dCurrentTareWeight === undefined) {
                                    dCurrentTareWeight = 0;
                                }
                                if (oCurrentModel) {
                                    if (that.oMaterialConsumptionController.oScaleUomNotMatched === false) {
                                        oCurrentModel.setProperty("/TaraWeight", 0);
                                    } else {
                                        oCurrentModel.setProperty("/TaraWeight", Formatter.parseNumber(Formatter.formatNumber(dCurrentTareWeight)));
                                    }
                                }
                                break;
                            case "getUOM":
                                var sNewUOM = oResponseData.series[0].points[0].value;
                                let bUpdatedUom = that.updateWeighingPopupUOM(sNewUOM);
                                if (optionalPromise && bUpdatedUom) {
                                    optionalPromise.resolve(sNewUOM);
                                } else {
                                    that.setWeighPopUpVizFrameBusyState(false);
                                }
                                break;
                            case "getActualWeight":
                                var sCurrentQuantity = oResponseData.series[0].points[0].value.toFixed(3);
                                that.setNewScaleValue(sCurrentQuantity);
                                that.setWeighPopUpVizFrameBusyState(false);
                                break;
                            default:
                                break;
                        }
                    } else {
                        let sErrorMsg = oResponseData.logMessages[0].Text;
                        that.showErrorMessage(that.getI18nTextByKey("ErrMsgReadIndicatorFailed", [sIndicator, sErrorMsg]));
                    }
                } else {
                    let sErrorMsg = oResponseData.logMessages[0].message;
                    that.showErrorMessage(that.getI18nTextByKey("ErrMsgReadIndicatorFailed", [sIndicator, sErrorMsg]));
                }
            }, oError => {
                oLogger.error(oError);
                that.showErrorMessage(that.getI18nTextByKey("wd.validScaleConfigRequired"));
                that.setWeighPopUpVizFrameBusyState(false);
            });
        },

        updateWeighingPopupUOM: function (sNewUOM) {
            var sOldUOMForDialog = this.oMaterialConsumptionController.sScaleUnitOfMeasure.toString(),
                oCurrentModel = this.getCurrentModel();

            this.oMaterialConsumptionController.sScaleUnitOfMeasure = sNewUOM;
            if (oCurrentModel) {
                oCurrentModel.setProperty("/ScaleUnitOfMeasure", sNewUOM);
            }
            if (sNewUOM !== undefined && sNewUOM.length > 0) {
                var dConversionFactor = this.oMaterialConsumptionController.convertQuantityForCurrentMaterial(sOldUOMForDialog, sNewUOM);
                // Search Conversion Factor
                if (dConversionFactor && dConversionFactor >= 0) {
                    //Always update the Displayed Uom To Scale Uom

                    // Convert Target Qty
                    var dConvTargetQty = this.targetQuantityForSelectedMaterial * dConversionFactor,
                        dConvActTargetQty = oCurrentModel.getProperty("/TargetQuantity/value") * dConversionFactor;
                    this.targetQuantityForSelectedMaterial = dConvTargetQty;
                    oCurrentModel.setProperty("/TargetQuantity/value", dConvActTargetQty);
                    oCurrentModel.setProperty("/TargetQuantity/unitOfMeasure/uom", sNewUOM);
                    oCurrentModel.setProperty("/TargetQuantity/unitOfMeasure/internalUom", sNewUOM);

                    // Convert Consume Qty
                    var dConvConsumeQty = this.consumedQuantityForSelectedMaterial * dConversionFactor,
                        dConvActConsumeQty = oCurrentModel.getProperty("/ConsumedQuantity/value") * dConversionFactor;
                    this.consumedQuantityForSelectedMaterial = dConvConsumeQty;
                    oCurrentModel.setProperty("/ConsumedQuantity/value", dConvActConsumeQty);
                    oCurrentModel.setProperty("/ConsumedQuantity/unitOfMeasure/uom", sNewUOM);
                    oCurrentModel.setProperty("/ConsumedQuantity/unitOfMeasure/internalUom", sNewUOM);

                    // Convert Tare Qty
                    var dConvActTareWeight = oCurrentModel.getProperty("/TaraWeight") * dConversionFactor;
                    oCurrentModel.setProperty("/TaraWeight", Formatter.parseNumber(Formatter.formatNumber(dConvActTareWeight)));

                    // Convert actual Qty
                    var dConvActWeight = parseFloat(oCurrentModel.getProperty("/quantity/value")) * dConversionFactor;
                    oCurrentModel.setProperty("/quantity/value", dConvActWeight.toString());
                    oCurrentModel.setProperty("/quantity/unitOfMeasure/uom", sNewUOM);

                    // Convert Tolerance
                    var dConvNewToleranceUpperThreshold = oCurrentModel.getProperty("/tolerance/upperThresholdValue") * dConversionFactor,
                        dConvNewToleranceLowerThreshold = oCurrentModel.getProperty("/tolerance/lowerThresholdValue") * dConversionFactor;
                    oCurrentModel.setProperty("/tolerance/upperThresholdValue", dConvNewToleranceUpperThreshold);
                    oCurrentModel.setProperty("/tolerance/lowerThresholdValue", dConvNewToleranceLowerThreshold);

                    this._initializeScale(true);
                    return true;
                }
            }
            oLogger.error("Conversion factor cannot be found for ", sOldUOMForDialog, sNewUOM);
            return false;

        },
        writeIndicator: function (sIndicator, oValue) {
            var bSuccess = true,
                sEquipmentID = this.getEquipmentID();
            if (sEquipmentID.length > 0) {
                var aParamArray = [
                    oValue
                ];
                var oIndicatorObj = this.getIndicatorIDs(sIndicator, "writeIndicator", aParamArray);
                if (oIndicatorObj !== "FetchDetails") {
                    if (oIndicatorObj !== "NoIndicatorFound") {
                        let sRequestURL;
                        sRequestURL = "../sapdmdmepod/dmi/machinemodel-runtime/v1.0/asset(" + sEquipmentID + ")/indicators/storeData";
                        oIndicatorObj["value"] = oValue;
                        var aRequestArray = [oIndicatorObj];
                        this.writeIndicatorAjax(sRequestURL, aRequestArray, sIndicator);
                    } else {
                        bSuccess = false;
                    }
                }
            }
            return bSuccess;
        },

        writeIndicatorAjax: function (sUrl, oRequestData, sIndicator) {
            var that = this;

            AjaxUtil.post(sUrl, oRequestData, function (oResponseData) {
                let sSuccessCode = oResponseData[0].successStatus || oResponseData[0].success,
                    sErrorMessage = oResponseData[0].logMessageText;
                if (sSuccessCode === undefined || sSuccessCode === false) {
                    that.showErrorMessage(that.getI18nTextByKey("ErrMsgWriteIndicatorFailed", [sIndicator, sErrorMessage]));
                } else {
                    MessageToast.show(that.getI18nText("InfoMsgWriteIndicatorSuccess", [sIndicator]));
                }

            });
        },

    });
    return {
        getInstance: function (oController) {
            return new WeighDispenseHandler(oController);

        }
    };
});