sap.ui.define(
  [
    'sap/dm/dme/podfoundation/controller/ListPluginViewController',
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/model/AjaxUtil',
    './../utils/formatter',
    'sap/ui/core/Fragment',
    'sap/m/MessageToast',
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator',
    'sap/dm/dme/message/ErrorHandler',
    'sap/m/MessageBox',
    'stellium/ext/podplugins/materialConsumptionPlugin/controller/MaterialBrowse',
    'stellium/ext/podplugins/materialConsumptionPlugin/controller/CalculateDialog.controller',
    'sap/dm/dme/controller/FormulaCalculatedInfo.controller',
    'stellium/ext/podplugins/materialConsumptionPlugin/controller/StorageLocationBrowse',
    'sap/dm/dme/logging/Logging',
    'sap/dm/dme/controller/GRPostController',
    'sap/dm/dme/types/QuantityType',
    'sap/dm/dme/serverevent/Topic',
    'sap/dm/dme/util/PlantSettings',
    'sap/dm/dme/formatter/DateTimeUtils',
    'stellium/ext/podplugins/materialConsumptionPlugin/controller/WeighDispenseHandler',
    'sap/dm/dme/formatter/NumberFormatter',
    'sap/ui/comp/filterbar/FilterBar',
    'sap/dm/dme/util/InventoryManagementSettings'
  ],
  function(
    ListPluginViewController,
    JSONModel,
    AjaxUtil,
    Formatter,
    Fragment,
    MessageToast,
    Filter,
    FilterOperator,
    ErrorHandler,
    MessageBox,
    MaterialBrowse,
    CalculateDialog,
    FormulaCalculatedInfo,
    StorageLocationBrowse,
    Logging,
    GRPostController,
    QuantityType,
    Topic,
    PlantSettings,
    DateTimeUtils,
    WeighDispenseHandler,
    NumberFormatter,
    FilterBar,
    InventoryManagementSettings
  ) {
    'use strict';
    var oLogger = Logging.getLogger('stellium.ext.podplugins.materialConsumptionPlugin.controller.PluginView');
    return ListPluginViewController.extend('stellium.ext.podplugins.materialConsumptionPlugin.controller.PluginView', {
      types: {
        quantity: new QuantityType()
      },
      DateTimeUtils: DateTimeUtils,
      oFormatter: Formatter,
      GRPostController: GRPostController,
      oCoBiProduct: {},
      parkedItemList: [],

      onInit: function() {
        if (ListPluginViewController.prototype.onInit) {
          ListPluginViewController.prototype.onInit.apply(this, arguments);
        }
        // Goods Issue Consume model
        this.consumeData = {
          shopOrder: '',
          batchId: '',
          operationActivity: '',
          bomComponentRef: '',
          material: '',
          materialDescription: '',
          storageLocation: '',
          storageLocationDesc: '',
          useFullHandlingUnit: false,
          handlingUnitNumber: '',
          shopOrderLocationRef: '',
          batchNumber: '',
          batchManaged: '',
          workCenter: '',
          avlBatchQty: '',
          expDate: '',
          inventory: '',
          isBomComponent: true,
          quantity: {
            value: '',
            unitOfMeasure: {
              uom: '',
              internalUom: '',
              shortText: '',
              longText: '',
              numerator: null,
              denominator: null
            }
          },
          userId: '',
          dateTime: '',
          recalculationEnabled: false,
          comments: '',
          calculatedData: null
        };

        this.alternateUomForSelectedMaterial = {};
        this.alternateUomsModel = new JSONModel();
        var oConsumeModel = new JSONModel(this.consumeData);
        this.getView().setModel(oConsumeModel, 'consumeModel');
        var oAddModel = new JSONModel(this.consumeData);
        this.getView().setModel(oAddModel, 'addModel');
        var oScanModel = new JSONModel(this.consumeData);
        this.getView().setModel(oScanModel, 'scanModel');
        // C5278086 Adding changes for W&D Start
        var oWeighingModel = new JSONModel(this.consumeData);
        this.getView().setModel(oWeighingModel, 'weighingModel');
        var oScanWeighingModel = new JSONModel(this.consumeData);
        this.getView().setModel(oScanWeighingModel, 'scanWeighingModel');
        var oAddWeighingModel = new JSONModel(this.consumeData);
        this.getView().setModel(oAddWeighingModel, 'addWeighingModel');
        // C5278086 Adding changes for W&D End
        this.isCommentValid = true;
        var oCoBiProductModel = new JSONModel();
        this.getView().setModel(oCoBiProductModel, 'coBiProductModel');
        this.characteristicsColumns = [];
        this.multiStorLocs = [];
        this.workinstructionsLoaded = 0;
        this.alternateBomComponentsLoaded = 0;
      },
      isSubscribingToNotifications: function() {
        return true;
      },

      /*
         * Return the function to be called when a WD Scale
         * notification message is received
         * @override
         */
      getNotificationMessageHandler: function(sTopic) {
        if (sTopic === Topic.WD_SCALE) {
          return this.handleWdScaleMessage;
        }
        return null;
      },

      handleWdScaleMessage: function(oMsg) {
        oLogger.info('Got Scale message: ', oMsg);
        const oScaleList = this.oWeighDispenseHandler.getCurrentWeighScaleList();
        // const sSelectedScale = oScaleList && oScaleList.getSelectedKey();
        const sSelectedScale = oScaleList && oScaleList.getValue();
        if (oMsg.resource === sSelectedScale) {
          this.oWeighDispenseHandler._initializeScale();
          this.oWeighDispenseHandler.setNewScaleValue((oMsg.quantity && oMsg.quantity.value) || 0);
          this.oWeighDispenseHandler.setNewTareWeightValue((oMsg.tareQuantity && oMsg.tareQuantity.value) || 0);
        } else {
          oLogger.error('Scale reading received: ', oMsg);
        }
      },

      onBeforeRendering: function() {
        this.oPluginConfiguration = this.getConfiguration();
        var viewModel = new JSONModel();
        viewModel.setData(this.oPluginConfiguration);
        this.getView().setModel(viewModel, 'configModel');
        this.getView().getModel('product').setSizeLimit(10000);
        var oCoBiProductSummaryList = new JSONModel();
        this.getView().setModel(oCoBiProductSummaryList, 'coBiProductSummaryList');
        var oPodSelectionModel = this.getPodSelectionModel();
        var isInvManaged = {
          isInventoryManaged: true
        };
        var that = this;
        InventoryManagementSettings._loadInventorySettings()
          .then(() => {
            that.isInventoryManaged = InventoryManagementSettings.getInventoryManagementEnabled();
            isInvManaged.isInventoryManaged = that.isInventoryManaged;
            var invManagedModel = new JSONModel();
            invManagedModel.setData(isInvManaged);
            that.getView().setModel(invManagedModel, 'invManagedModel');
          })
          .catch(function(sErrorMessage) {
            oLogger.error(sErrorMessage);
          });
        this.getCharcConfigData();
      },

      getCharcConfigData: function() {
        var that = this;
        var sCharcLongString = that.oPluginConfiguration.charcForAdvSearch;
        var charcList = [];
        var localeDesc;
        if (sCharcLongString && sCharcLongString !== '') {
          charcList = sCharcLongString.split(',');
        }
        if (charcList.length === 0) {
          that.charcForAdvancedSearch = charcList;
        } else {
          var sUrl = that.getClassificationDataSourceUri();
          AjaxUtil.post(
            sUrl + 'characteristics/findByCharcNames',
            charcList,
            function(oResponseData) {
              var oResponseCharcList = oResponseData.classificationCharacteristics;
              charcList = [];
              var locale = sap.ui.getCore().getConfiguration().getLocale().getLanguage();
              for (var i = 0; i < oResponseCharcList.length; i++) {
                localeDesc = that.getLocaleSpecificDescription(oResponseCharcList[i], locale);
                charcList.push({
                  name: oResponseCharcList[i].name,
                  description: localeDesc,
                  charcExternalId: oResponseCharcList[i].charcExternalId
                });
              }
              that.charcForAdvancedSearch = charcList;
            },
            function() {
              that.charcForAdvancedSearch = [];
            }
          );
        }
      },

      getLocaleSpecificDescription: function(oCharc, sLocale) {
        var sDesc = undefined;
        var sEnDesc = undefined;
        var i;
        for (i = 0; i < oCharc.characteristicDescriptionList.length; i++) {
          if (oCharc.characteristicDescriptionList[i].language.toLocaleLowerCase() === sLocale.toLocaleLowerCase()) {
            sDesc = oCharc.characteristicDescriptionList[i].characteristicDescription;
            break;
          }
          if (oCharc.characteristicDescriptionList[i].language.toLocaleLowerCase() === 'en') {
            sEnDesc = oCharc.characteristicDescriptionList[i].characteristicDescription;
          }
        }
        return sDesc || sEnDesc || oCharc.name;
      },

      onBeforeRenderingPlugin: function() {
        this.oWeighDispenseHandler = WeighDispenseHandler.getInstance(this);
        // get current user ID from plant user service
        this.loggedInUserDetails = this.getGlobalProperty('loggedInUserDetails') ? this.getGlobalProperty('loggedInUserDetails') : '';
        this.subscribe('phaseSelectionEvent', this.getMaterialConsumptionData, this);
        this.subscribe('WorkInstructionChangeEvent', this.getMaterialConsumptionData, this);
        this.subscribe('GoodsReceiptChangeEvent', this.getMaterialConsumptionData, this);
        this.subscribe('QuantityConfirmationChangeEvent', this.getMaterialConsumptionData, this);
        this.publish('requestForPhaseData', { source: this, sendToAllPages: true });
      },

      onTabItemSelected: function() {
        // just to fix scanner rendering issue on load
        if (this.oPluginConfiguration === undefined) {
          this.oPluginConfiguration = this.getConfiguration();
        }
        var isTabMatched = this.isMatchingTabCriterion();
        if (isTabMatched && this.oPluginConfiguration.autoOpenScanPopup && this.oPluginConfiguration.showScanButton) {
          if (!this.isScanDialogOpen) {
            this.handleOpenScanDialog();
          }
        }
      },

      onExit: function() {
        ListPluginViewController.prototype.onExit.apply(this, arguments);
        this.unsubscribe('phaseSelectionEvent', this.getMaterialConsumptionData, this);
        this.unsubscribe('WorkInstructionChangeEvent', this.getMaterialConsumptionData, this);
        this.unsubscribe('GoodsReceiptChangeEvent', this.getMaterialConsumptionData, this);
        this.unsubscribe('QuantityConfirmationChangeEvent', this.getMaterialConsumptionData, this);
      },

      isSideContent: function(oControl) {
        var oParent = oControl.getParent() || oControl.oContainer;
        if (oParent) {
          if (oParent.sParentAggregationName && oParent.sParentAggregationName === 'sideContent') {
            return true;
          } else if (oParent.sParentAggregationName && oParent.sParentAggregationName === 'mainContent') {
            if (oParent.getParent() && oParent.getParent().getEqualSplit() === true) return true;
            return false;
          } else {
            return this.isSideContent(oParent);
          }
        } else {
          return false;
        }
      },

      getCurrentModel: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.getModel('scanModel');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.getModel('addModel');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.getModel('consumeModel');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentModel();
        // C5278086 Adding changes for W&D End
      },

      getCurrentDialogId: function() {
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return 'scanDialog';
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return 'addDialog';
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return 'consumeDialog';
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentDialogId();
        // C5278086 Adding changes for W&D End
      },

      getCurrentSaveButton: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('giConfirmBtnScan');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('giConfirmBtnAdd');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.byId('giConfirmBtn');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentSaveButton();
        // C5278086 Adding changes for W&D End
      },

      getCurrentCancelButton: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('giCancelBtnScan');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('giCancelBtnAdd');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.byId('giCancelBtn');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentCancelButton();
        // C5278086 Adding changes for W&D End
      },

      getCurrentInputMaterialControl: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('inputMatNumScan');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('inputMatNumAdd');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentInputMaterialControl();
        //  C5278086 Adding changes for W&D End
      },

      getCurrentInputBatchIdControl: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('inputBatchIdScan');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('inputBatchIdAdd');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.byId('inputBatchId');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentInputBatchIdControl();
        // C5278086 Adding changes for W&D End
      },

      getCurrentInputQuantityControl: function() {
        return this.oWeighDispenseHandler.getCurrentInputQuantityControl();
      },

      getFormControl: function() {
        if (this.getCurrentForm()) {
          return this.getCurrentForm().getContent();
        }
      },

      getCurrentForm: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('scanMaterialForm');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('addMaterialForm');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.byId('consumeMaterialForm');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentForm();
        // C5278086 Adding changes for W&D End
      },

      getCurrentCommentsControl: function() {
        var oView = this.getView();
        if (this.isScanDialogOpen && this.isScanDialogOpen === true) return oView.byId('inputCommentsForScan');
        if (this.isAddDialogOpen && this.isAddDialogOpen === true) return oView.byId('inputCommentsAddMaterial');
        if (this.isConsumeDialogOpen && this.isConsumeDialogOpen === true) return oView.byId('inputCommentsForConsume');
        // C5278086 Adding changes for W&D Start
        return this.oWeighDispenseHandler.getCurrentCommentsControl();
        // C5278086 Adding changes for W&D End
      },

      getMaterialConsumptionData: function(sChannelId, sEventId, oData) {
        if (!oData.workInstruction && !oData.goodsReceipt && !oData.quantityConfirmation) {
          this.selectedDataInList = oData;
        }

        var oPodSelectionModel = this.getPodSelectionModel();
        this.setWeighRelevantFlag(oData);
        if (!oPodSelectionModel || !oPodSelectionModel.timeZoneId) {
          this.createMessage('missingInformation', MessageType.Error);
          return false;
        }

        this.plantTimeZoneId = oPodSelectionModel.timeZoneId;
        this.setAuthModel(this.selectedDataInList);
        this.getGiMaterialData(this.selectedDataInList);

        var oTable = this.byId('consumptionList');
        var poppinSize = (screen.width + 1).toString() + 'px';
        var demandPopin = this.isSideContent(oTable);
        var i;
        if (demandPopin === true) {
          for (i = 1; i < 5; i++) {
            oTable.getColumns()[i].setDemandPopin(true);
            oTable.getColumns()[i].setMinScreenWidth(poppinSize);
            if (i === 1) oTable.getColumns()[i].setPopinDisplay(sap.m.PopinDisplay.WithoutHeader);
            else oTable.getColumns()[i].setPopinDisplay(sap.m.PopinDisplay.Inline);
          }
        }
        // C5278086 Adding changes for W&D Start - WorkcenterInfo
        this._setWorkcenterData();
        // C5278086 Adding changes for W&D End - WorkcenterInfo
      },

      // Create an Auth Model for user work center authorization and bind to view
      setAuthModel: function(oData) {
        this.authModel = new JSONModel(oData);
        this.getView().setModel(this.authModel, 'authModel');
      },

      onSearch: function(oEvt) {
        // add filter for search
        var sQuery = oEvt.getParameter('newValue');
        if (sQuery && sQuery.length > 0) {
          var filterMaterial = new sap.ui.model.Filter('materialId/material', sap.ui.model.FilterOperator.Contains, sQuery);
          var filterDescription = new sap.ui.model.Filter('description', sap.ui.model.FilterOperator.Contains, sQuery);
          var filterBatch = new sap.ui.model.Filter('plannedBatchNumber', sap.ui.model.FilterOperator.Contains, sQuery);
          var filterLocation = new sap.ui.model.Filter('storageLocation/storageLocation', sap.ui.model.FilterOperator.Contains, sQuery);
          var allFilters = new sap.ui.model.Filter([filterMaterial, filterDescription, filterBatch, filterLocation]);
        }
        // update list binding
        var list = this.getView().byId('consumptionList');
        var binding = list.getBinding('items');
        binding.filter(allFilters);
      },

      getCurrentDateInPlantTimeZone: function() {
        return moment().tz(this.plantTimeZoneId).format('YYYY-MM-DD');
      },

      onChangePostingDate: function(oEvent) {
        var inputFieldId = oEvent.getSource().getId();
        var inputPostingDate = oEvent.getSource().getValue();
        ErrorHandler.clearErrorState(oEvent.getSource());
        //var oSaveBtn = this.getCurrentSaveButton();
        //oSaveBtn.setEnabled(false);
        // C5278086 Adding changes for W&D Start
        var oSaveBtn = this.getCurrentSaveButton();
        if (oSaveBtn === 'weighing' || oSaveBtn === 'scanWeighing' || oSaveBtn === 'addWeighing') {
          this.oWeighDispenseHandler.setWeighingSaveButtons(false);
        } else {
          // Normal Button Update
          oSaveBtn.setEnabled(false);
        }
        // C5278086 Adding changes for W&D End
        if (inputPostingDate > this.getCurrentDateInPlantTimeZone()) {
          ErrorHandler.setErrorState(sap.ui.getCore().byId(inputFieldId), this.getI18nText('FUTURE_DATE_NOT_ALLOWED'));
        } else {
          ErrorHandler.clearErrorState(oEvent.getSource());
          this._enableConfirmButton();
        }
      },

      showDetailsOfComponent: function(oEvent) {
        var oView = this.getView();
        var rowData = oEvent.getSource().getBindingContext().getObject();
        var oController = this;
        if (!this.byId('postingsDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.PostingsDialog',
            controller: this
          }).then(function(oDialog) {
            oDialog.setEscapeHandler(
              function(oPromise) {
                oController.onClosePostingsDialog();
                oPromise.resolve();
              }.bind(oController)
            );
            oView.addDependent(oDialog);
            oDialog.open();
            oController.fetchGiPostingDetails(rowData);
          });
        } else {
          this.byId('postingsDialog').open();
          this.fetchGiPostingDetails(rowData);
        }
      },

      showDetailsOfComponentCoBy: function(oEvent) {
        var selectedOrderData = {
          orderRef: this.selectedDataInList.selectedShopOrderRef,
          order: this.selectedDataInList.selectedShopOrder,
          sfc: this.selectedDataInList.selectedSfc,
          workcenter: this.selectedDataInList.workCenter.workcenter
        };

        var oParameters = {};
        oParameters.shopOrder = selectedOrderData.order;
        oParameters.sfc = selectedOrderData.sfc;
        oParameters.material = oEvent.getSource().getBindingContext('coBiProductModel').getObject().materialId.ref;

        oLogger.info('Calling GRController to handle postings popup for Co and By products');
        this.GRPostController.setController(this);
        this.GRPostController.setSelectedOrderData(selectedOrderData);
        this.GRPostController.showGRPostingsDialogs(oParameters);
      },

      showStorageLocationDetails: function(oEvent) {
        var oView = this.getView();
        var oController = this;
        var oModel = this.getCurrentModel();
        var isBatchManaged = oModel.getProperty('/batchManaged');
        var showQuantity = this.isInventoryManaged || !isBatchManaged;
        let sSelectedStorageLocation = (oEvent.getSource() && oEvent.getSource().getValue()) || '';
        oView.getModel('invManagedModel').setProperty('/showQuantity', showQuantity);
        if (!this.byId('storageLocationDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.StorageLocationDialog',
            controller: this
          }).then(function(oDialog) {
            oView.addDependent(oDialog);
            oDialog.open();
            oController.fetchStorageLocationDetails(sSelectedStorageLocation);
          });
        } else {
          this.byId('storageLocationDialog').open();
          this.fetchStorageLocationDetails(sSelectedStorageLocation);
        }
      },

      handleStorageLocationDetails: function(sStorageLocation) {
        var sUrl = '';
        var inventryUrl = this.getInventoryDataSourceUri();
        var oParameters = {};
        var oModel = this.getCurrentModel();
        if (this.isInventoryManaged) {
          sUrl = inventryUrl + 'inventory/findInventory';
          oParameters.materialRef = oModel.getProperty('/materialRef');
          oParameters.shopOrderRef = this.selectedDataInList.selectedShopOrderRef;
        } else if (sStorageLocation !== '') {
          sUrl = inventryUrl + 'inventory/inventoryStock';
          oParameters = {
            material: oModel.getProperty('/material'),
            inventoryStockType: '01',
            storageLocations: sStorageLocation
          };
        } else {
          sUrl = this.getInventoryODataDataSourceUri() + 'StorageLocations';
        }
        var that = this;
        that.byId('storageLocationDialog').setBusy(true);
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            that.storageLocationDetailsList = [];
            if (!that.isInventoryManaged) {
              that.handleStorageLocationData(oResponseData);
              oResponseData.content &&
                oResponseData.content.length > 0 &&
                oResponseData.content.forEach(e => {
                  that.storageLocationDetailsList.push({
                    storageLocation: { storageLocation: e.storageLocation },
                    remainingQuantity: e.quantity,
                    unitOfMeasure: {
                      uom: e.materialBaseUnit
                    }
                  });
                });
            } else {
              that.storageLocationDetailsList = oResponseData;
            }
            that.storageLocationModel = new JSONModel();
            that.storageLocationModel.setSizeLimit(that.storageLocationDetailsList.length);
            that.storageLocationModel.setData(that.storageLocationDetailsList);
            that.byId('storageLocationDialog').setModel(that.storageLocationModel, 'storageLocationModel');
            //triggering search in the storage location popup with value from the input field.
            if (that.isInventoryManaged) {
              that.onSearchStorageLocationListWithValue(sStorageLocation);
            }
            that.byId('storageLocationDialog').setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.storageLocationDetailsList = {};
          }
        );
      },
      fetchStorageLocationDetails: function(sStorageLocation) {
        let that = this;
        let oModel = this.getCurrentModel();
        if (oModel.getProperty('/storageLocation')) {
          that.getView().byId('storageLocationDialog')._oSearchField.setValue(oModel.getProperty('/storageLocation'));
        } else {
          that.getView().byId('storageLocationDialog')._oSearchField.setValue('');
        }
        this.handleStorageLocationDetails(sStorageLocation);
      },

      onGetStockForStorageLoc: function(oEvent) {
        var oSource = oEvent.getSource();
        var oObject = oSource.getBindingContext('storageLocationModel').getObject();
        var oStorageLocModel = this.byId('storageLocationDialog').getModel('storageLocationModel');
        this.byId('storageLocationDialog').setBusy(true);
        var oModel = this.getCurrentModel();
        var sUrl = this.getInventoryDataSourceUri() + 'inventory/inventoryStock';
        var oParameters = {};
        oParameters.material = oModel.getProperty('/material');
        var storLocs = [];
        storLocs.push(oObject.storageLocation.storageLocation);
        oParameters.storageLocations = storLocs.join(',');
        oParameters.inventoryStockType = '01';
        var oController = this;
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var stockDetails = oResponseData.content;
            oObject.remainingQuantity = stockDetails && stockDetails[0] ? stockDetails[0].quantity : 0;
            var sUom = stockDetails && stockDetails[0] ? stockDetails[0].materialBaseUnit : '';
            var uomObj = { uom: sUom };
            oObject.unitOfMeasure = uomObj;
            oStorageLocModel.refresh();
            oController.byId('storageLocationDialog').setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            oController.showErrorMessage(err, true, true);
            oController.byId('storageLocationDialog').setBusy(false);
            oStorageLocModel.refresh();
          }
        );
      },

      onSearchUserList: function(oEvent) {
        // add filter for search
        var aFilters = [];
        var oFilterWithAllProperties;
        var sQuery = oEvent.getParameter('newValue');
        if (sQuery && sQuery.length > 0) {
          var filter1 = new Filter('userId', FilterOperator.Contains, sQuery);
          var filter2 = new Filter('givenName', FilterOperator.Contains, sQuery);
          var filter3 = new Filter('familyName', FilterOperator.Contains, sQuery);
          aFilters.push(filter1, filter2, filter3);
          oFilterWithAllProperties = new Filter({
            filters: aFilters,
            and: false
          });
        }
        // update list binding
        var oList = this.byId('userListTable');
        var oBinding = oList.getBinding('items');
        oBinding.filter(oFilterWithAllProperties);
      },

      showBatchDetails: function(oEvent) {
        var oView = this.getView();
        this.characteristicsColumns = [];
        this.multiStorLocs = [];
        this.oPageable = this.oPageable || {};
        this.oPageable.page = 0;
        this.totalPaginationElems = null;
        var oBrowseType = oEvent.getSource().getParent().getAggregation('label').getText();
        var oResourceValue = this.getI18nText('storageLocation');
        if (oBrowseType === oResourceValue) {
          this.oSelectedBrowseType = 'StorageLocation';
        } else {
          this.oSelectedBrowseType = 'BatchNumber';
        }
        if (!this.byId('batchDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.BatchDialog',
            controller: this
          }).then(
            function(oDialog) {
              oDialog.setEscapeHandler(
                function(oPromise) {
                  this.onCloseBatchDialog();
                  this.characteristicsColumns = [];
                  oPromise.resolve();
                }.bind(this)
              );
              if (this.byId('batchDialog')) {
                oView.addDependent(oDialog);
                oDialog.open();
                this.executeAfterBatchPopupIsOpened();
              }
            }.bind(this)
          );
        } else {
          this.byId('batchDialog').open();
          this.executeAfterBatchPopupIsOpened();
        }
      },

      executeAfterBatchPopupIsOpened: function() {
        var oModel = this.getCurrentModel();
        var oDialogId = this.getCurrentDialogId();
        if (
          (oDialogId === 'consumeDialog' ||
            oDialogId === 'weighDialog' ||
            ((oDialogId === 'scanDialog' ||
              oDialogId === 'addDialog' ||
              oDialogId === 'scanWeighDialog' ||
              oDialogId === 'addWeighDialog') &&
              this.getCurrentInputMaterialControl().getValue())) &&
          !(!this.isInventoryManaged && (!oModel.getProperty('/storageLocation') || oModel.getProperty('/storageLocation') === ''))
        ) {
          if (this.oSelectedBrowseType === 'StorageLocation') {
            this.byId('batchDialog').setTitle(this.getI18nText('storageLocationDialogHeader'));
            this.fetchBatchDetails();
          } else {
            this.byId('batchDialog').setTitle(
              this.getI18nText('batchDialogHeaderWithMat', this.getCurrentModel().getProperty('/material'))
            );
            this.fetchBatchDetails();
          }
        } else {
          this.byId('batchDialog').setTitle(this.getI18nText('batchDialogHeader'));
          this.byId('batchDialog').setBusy(true);
          this.batchDetailsList = [];
          this.batchDetailsModel = this.batchDetailsModel || new JSONModel();
          this.createBatchTable(this.batchDetailsList, oDialogId === 'consumeDialog' || this.getCurrentInputMaterialControl().getValue());
        }
      },

      fetchBatchDetails: function() {
        var inventryUrl = this.getInventoryDataSourceUri();
        var oParameters = {};
        var oModel = this.getCurrentModel();
        var sUrl;
        if (this.isInventoryManaged) {
          oParameters.materialRef = oModel.getProperty('/materialRef');
          oParameters.shopOrderRef = this.selectedDataInList.selectedShopOrderRef;
          oParameters.emptyBatchNumberIgnored = true;
          sUrl = inventryUrl + 'inventory/findInventory';
        } else {
          this.oPageable = this.oPageable || {};
          this.oPageable.page = 0;
          oParameters = this.prepareInvStockParams(oModel);
          var storLocs = [];
          storLocs.push(oModel.getProperty('/storageLocation'));
          this.multiStorLocs = storLocs;
          oParameters.storageLocations = storLocs.join(',');
          sUrl = inventryUrl + 'inventory/inventoryStock';
        }
        this.getBatchDetailsForPopup(sUrl, oParameters);
      },

      _createBatchDetailsServiceCall: function() {
        var inventryUrl = this.getInventoryDataSourceUri();
        var oParameters = {};
        var oModel = this.getCurrentModel();
        var sUrl;
        if (this.isInventoryManaged) {
          oParameters.materialRef = oModel.getProperty('/materialRef');
          oParameters.shopOrderRef = this.selectedDataInList.selectedShopOrderRef;
          oParameters.emptyBatchNumberIgnored = true;
          sUrl = inventryUrl + 'inventory/findInventory';
        } else {
          this.oPageable = this.oPageable || {};
          this.oPageable.page = 0;
          oParameters = this.prepareInvStockParams(oModel);
          var storLocs = [];
          storLocs.push(oModel.getProperty('/storageLocation'));
          this.multiStorLocs = storLocs;
          oParameters.storageLocations = storLocs.join(',');
          sUrl = inventryUrl + 'inventory/inventoryStock';
        }

        return { sUrl, oParameters };
      },

      prepareInvStockParams: function(oModel) {
        var oParameters = {};
        if (this.oSelectedBrowseType === 'StorageLocation') {
          oParameters.material = oModel.getProperty('/material');
          oParameters.inventoryStockType = '01';
        } else {
          oParameters.material = oModel.getProperty('/material');
          oParameters.inventoryStockType = '01';
          oParameters.showCharacteristics = true;
          oParameters.pageSize = 20;
          oParameters.pageNumber = this.oPageable.page;
        }
        return oParameters;
      },

      queryNextPageList: function(oEvent) {
        if (oEvent.getParameters().reason === 'Growing' && this.totalPaginationElems > (this.oPageable.page + 1) * 20) {
          var oDialog = this.byId('batchDialog');
          let oFilterBar = this.byId('filterBar');
          this.oPageable.page++;
          var oModel = this.getCurrentModel();
          var oParameters = this.prepareInvStockParams(oModel);
          oParameters.storageLocations = this.multiStorLocs.join(',');
          if (oFilterBar.getBasicSearchValue()) {
            oParameters.fuzzyBatch = oFilterBar.getBasicSearchValue();
          }
          var sUrl = this.getInventoryDataSourceUri() + 'inventory/inventoryStock';
          this.doInvStockApiCall(oDialog, sUrl, oParameters, true);
        }
      },

      doInvStockApiCall: function(oDialog, sUrl, oParameters, isGrowing) {
        var that = this;
        oDialog.setBusy(true);
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var oData = oResponseData.content;
            that.prepareStockData(oData);
            that.batchDetailsList = isGrowing ? that.batchDetailsList.concat(oData) : oData;
            that.totalPaginationElems = oResponseData.totalElements;
            that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
            that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
            that.prepareData(that.batchDetailsList);
            that.batchDetailsModel.setData(that.batchDetailsList);
            that.setDataInBatchTable(that.batchDetailsList);
            that.setNumberOfItemsInBatchList();
            that.batchDetailsModel.updateBindings(true);
            oDialog.setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            oDialog.setBusy(false);
            that.onCloseBatchDialog();
            that.showErrorMessage(err, true, true);
            that.batchDetailsList = {};
          }
        );
      },

      getBatchDetailsForPopup: function(sUrl, oParameters) {
        var that = this;
        var oDialog = that.byId('batchDialog');
        oDialog.setBusy(true);
        return new Promise(
          function(resolve, reject) {
            AjaxUtil.get(
              sUrl,
              oParameters,
              function(oResponseData) {
                that.filteredRecords = that.filterRecordsWithZeroQuantity(oResponseData);
                that.batchDetailsList = that.filteredRecords;
                if (!that.isInventoryManaged) {
                  that.batchDetailsList = that.filteredRecords.content;
                  that.totalPaginationElems = oResponseData.totalElements;
                  that.prepareStockData(that.batchDetailsList);
                }
                that.batchDetailsModel = new JSONModel();
                that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
                //find max 5 characteristics sorted alphanumerically on the basis of characteristics name.
                that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
                that.batchDetailsModel.setData(that.batchDetailsList);
                //Create table dynamically where characteristics values along with batchId, quantity,
                //storage location and expiry date will be shown.
                that.createBatchTable(that.batchDetailsList, true);
              },
              function(oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                oDialog.setBusy(false);
                oDialog.close();
                that.showErrorMessage(err, true, true);
                that.batchDetailsList = {};
              }
            );
          }.bind(this)
        );
      },

      getBatchDetails: function(sUrl, oParameters) {
        var that = this;
        return new Promise(function(resolve, reject) {
          AjaxUtil.get(
            sUrl,
            oParameters,
            function(oResponseData) {
              that.filteredRecords = that.filterRecordsWithZeroQuantity(oResponseData);
              that.batchDetailsList = that.filteredRecords;
              if (!that.isInventoryManaged) {
                that.batchDetailsList = that.filteredRecords.content;
                that.totalPaginationElems = oResponseData.totalElements;
                that.prepareStockData(that.batchDetailsList);
              }
              that.batchDetailsModel = new JSONModel();
              that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
              //find max 5 characteristics sorted alphanumerically on the basis of characteristics name.
              that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
              that.batchDetailsModel.setData(that.batchDetailsList);
              that.prepareData(that.batchDetailsList);
              resolve(oResponseData);
            },
            function() {
              reject(...arguments);
            }
          );
        });
      },

      _enhanceCharacteristicsValues: function(oData) {
        oData.forEach(
          function(oLineItem) {
            let oBatchCharcValuesMap = this._getBatchCharcValuesMapFromValues(oLineItem);
            oLineItem.batchCharcValuesMap = this.characteristicsColumns.reduce(function(oPre, oNext) {
              let oCharcValue = oBatchCharcValuesMap && oBatchCharcValuesMap[oNext.name];
              if (!oPre[oNext.name]) {
                if (oCharcValue) {
                  oPre[oNext.name] = {
                    defaultBatchCharc: oCharcValue.defaultBatchCharc,
                    batchCharcValues: oCharcValue.batchCharcValues,
                    morePopoverLinkVisibility: oCharcValue.morePopoverLinkVisibility,
                    batchCharcValuesLength: oCharcValue.batchCharcValuesLength
                  };
                } else {
                  oPre[oNext.name] = {
                    defaultBatchCharc: { charcValue: null },
                    batchCharcValues: [],
                    morePopoverLinkVisibility: false,
                    batchCharcValuesLength: ''
                  };
                }
              }
              return oPre;
            }, {});
          }.bind(this)
        );
      },

      _getBatchCharcValuesMapFromValues: function(oLineItem) {
        return (
          oLineItem.batchCharcValues &&
          oLineItem.batchCharcValues
            .filter(function(oCharc) {
              return oCharc.charcValue !== '' && oCharc.charcValue !== null;
            })
            .reduce(function(oPre, oNext) {
              if (!oPre[oNext.charcName]) {
                oPre[oNext.charcName] = {
                  defaultBatchCharc: oNext,
                  batchCharcValues: []
                };
              }
              oPre[oNext.charcName].batchCharcValues.push(oNext);
              oPre[oNext.charcName].morePopoverLinkVisibility = oPre[oNext.charcName].batchCharcValues.length > 1;
              oPre[oNext.charcName].batchCharcValuesLength = oPre[oNext.charcName].batchCharcValues.length - 1;
              return oPre;
            }, {})
        );
      },

      findCharacteristicsToBeShown: function(oData) {
        this.characteristicsColumns = [];
        for (var i = 0; i < oData.length; i++) {
          if (oData[i].batchCharcValues && oData[i].batchCharcValues.length !== 0) {
            for (var j = 0; j < oData[i].batchCharcValues.length; j++) {
              //To check whether the characterisctic is already present in the array
              if (!this.isCharacteristicAlreadyPresent(oData[i].batchCharcValues[j].charcName)) {
                var characteristic = {};
                characteristic.name = oData[i].batchCharcValues[j].charcName;
                characteristic.desc = oData[i].batchCharcValues[j].charcDesc;
                characteristic.dataType = oData[i].batchCharcValues[j].dataType;
                this.characteristicsColumns.push(characteristic);
              }
            }
          }
        }
        //Sort alphanumerically in ascending order.
        this.characteristicsColumns.sort(function(a, b) {
          if (a.name < b.name) {
            return -1;
          }
          if (a.name > b.name) {
            return 1;
          }
          return 0;
        });
        //Filter only first 5 characteristics to be shown in the table.
        this.characteristicsColumns = this.characteristicsColumns.slice(0, 5);
        this._enhanceCharacteristicsValues(oData);
        //Build characteristics data to set it to a model.
        oData = this.setCharacteristicsDetails(oData);
        return oData;
      },

      isCharacteristicAlreadyPresent: function(charcName) {
        var isPresent = this.characteristicsColumns.find(function(charcDetails) {
          return charcDetails.name === charcName;
        });

        if (isPresent) return true;

        return false;
      },

      setCharacteristicsDetails: function(oData) {
        for (var i = 0; i < oData.length; i++) {
          for (var j = 1; j <= this.characteristicsColumns.length; j++) {
            let sCharcName = this.characteristicsColumns[j - 1].name;
            if (oData[i].batchCharcValuesMap[sCharcName]) {
              oData = this.buildCharacteristicsData(oData, i, j, oData[i].batchCharcValuesMap[sCharcName]['defaultBatchCharc']);
            }
          }
        }
        return oData;
      },

      buildCharacteristicsData: function(oData, i, j, assignmentValue) {
        oData[i]['charcValue' + j] = assignmentValue.charcValue ? assignmentValue.charcValue : undefined;
        oData[i]['charcUom' + j] = assignmentValue.uom;
        oData[i]['dataType' + j] = assignmentValue.dataType;
        return oData;
      },

      createBatchTable: function(oData, bMaterialGiven) {
        if (!this.batchDetailsModel) {
          this.batchDetailsModel = new JSONModel();
        }
        this.prepareData(oData);
        this.batchDetailsModel.setData(oData);

        var oFilterBar = this.byId('filterBar');

        oFilterBar.removeBasicSearch();
        let oBasicSearchField;
        if (this.isInventoryManaged) {
          oBasicSearchField = new sap.m.SearchField({
            showSearchButton: false,
            liveChange: function(oEvent) {
              this.onSearchBatchListWithValue(oEvent.getParameter('newValue'));
            }.bind(this)
          });
        } else {
          oBasicSearchField = new sap.m.SearchField({
            showSearchButton: false
          });
        }

        oFilterBar.destroyFilterGroupItems();
        oFilterBar.removeAllFilterGroupItems();
        oFilterBar.setBasicSearch(oBasicSearchField);
        if (bMaterialGiven && this.isInventoryManaged) {
          oFilterBar.setExpandAdvancedArea(false);
          oFilterBar.setShowGoButton(false);
          this.setDataInBatchTable(oData, bMaterialGiven);
        } else if (bMaterialGiven && !this.isInventoryManaged) {
          oFilterBar.setExpandAdvancedArea(true);
          oFilterBar.setShowGoButton(true);
          this.createStorLocFilter(oFilterBar, oData);
        } else {
          oFilterBar.setExpandAdvancedArea(true);
          oFilterBar.setShowGoButton(true);
          this.createAdvancedFilters(oFilterBar, oData);
        }
      },

      createStorLocFilter: function(oFilterBar, oData) {
        var oFilterGroupItem = [];
        var oInput = [];
        oFilterGroupItem[0] = new sap.ui.comp.filterbar.FilterGroupItem();
        oFilterGroupItem[0].setGroupName('Advanced');
        oFilterGroupItem[0].setName('storageLoc');
        oFilterGroupItem[0].setLabel(this.getI18nText('storageLocation'));
        oFilterGroupItem[0].setVisibleInAdvancedArea(true);

        oInput[0] = new sap.m.MultiInput();
        oInput[0].setName('storageLoc');
        oInput[0].setRequired(true);
        oInput[0].setValueHelpOnly(true);
        oInput[0].setShowValueHelp(true);
        var oModel = this.getCurrentModel();
        if (oModel.getProperty('/storageLocation') && oModel.getProperty('/storageLocation') !== '') {
          oInput[0].addToken(new sap.m.Token({ text: oModel.getProperty('/storageLocation') }));
        }
        oInput[0].attachValueHelpRequest(
          function() {
            StorageLocationBrowse.openMulti(
              oInput[0],
              '',
              function(oSelectedObjects) {
                oInput[0].destroyTokens();
                if (oSelectedObjects.length > 0) {
                  oSelectedObjects.forEach(function(item) {
                    oInput[0].addToken(new sap.m.Token({ text: item }));
                  });
                  oInput[0].setValueState('None');
                  oInput[0].setValueStateText('');
                }
              }.bind(this),
              this.getView().getModel('inventory')
            );
            // this.setSelectedDefaults();
          }.bind(this)
        );
        oFilterGroupItem[0].setControl(oInput[0]);
        oFilterBar.addFilterGroupItem(oFilterGroupItem[0]);
        this.setDataInBatchTable(oData, true);
        this.setNumberOfItemsInBatchList();
      },

      setSelectedDefaults: function() {
        var selectedItems = this.byId('resultTable').getSelectedItems();
        this.multiStorLocs.forEach(function(storLoc) {
          selectedItems.forEach(function(item) {
            if (storLoc === item.getBindingContext().getObject().storageLocation) {
              item.setSelected(true);
            }
          });
        });
      },

      createAdvancedFilters: function(oFilterBar, oData) {
        if (this.charcForAdvancedSearch.length > 0) {
          var charcFromConfig = this.charcForAdvancedSearch;
          var oFilterGroupItem = [];
          var oInput = [];
          oFilterGroupItem[0] = new sap.ui.comp.filterbar.FilterGroupItem();
          oFilterGroupItem[0].setGroupName('Advanced');
          oFilterGroupItem[0].setName('storageLoc');
          oFilterGroupItem[0].setLabel(this.getI18nText('storageLocation'));
          oFilterGroupItem[0].setVisibleInAdvancedArea(true);

          oInput[0] = new sap.m.Input();
          oInput[0].setName('storageLoc');
          oInput[0].setRequired(true);
          oInput[0].setValueHelpOnly(true);
          oInput[0].setShowValueHelp(true);
          oInput[0].attachValueHelpRequest(
            function() {
              StorageLocationBrowse.open(
                oInput[0],
                '',
                function(oSelectedObject) {
                  if (oSelectedObject) {
                    oInput[0].setValue(oSelectedObject.name);
                    oInput[0].setValueState('None');
                    oInput[0].setValueStateText('');
                  }
                }.bind(this),
                this.getView().getModel('inventory')
              );
            }.bind(this)
          );
          oFilterGroupItem[0].setControl(oInput[0]);
          oFilterBar.addFilterGroupItem(oFilterGroupItem[0]);

          for (var i = 0; i < charcFromConfig.length; i++) {
            oFilterGroupItem[i + 1] = new sap.ui.comp.filterbar.FilterGroupItem();
            oFilterGroupItem[i + 1].setGroupName('Advanced');
            oFilterGroupItem[i + 1].setName(charcFromConfig[i].name);
            oFilterGroupItem[i + 1].setLabel(charcFromConfig[i].description);
            oFilterGroupItem[i + 1].setEntityTypeName(charcFromConfig[i].charcExternalId); //Workaround to pass the charcExternalId to batchesByCharacteristics API
            oFilterGroupItem[i + 1].setVisibleInAdvancedArea(true);

            oInput[i + 1] = new sap.m.Input();
            oInput[i + 1].setName(charcFromConfig[i].name);
            oInput[i + 1].setRequired(false);
            oFilterGroupItem[i + 1].setControl(oInput[i + 1]);
            oFilterBar.addFilterGroupItem(oFilterGroupItem[i + 1]);
          }
          this.setDataInBatchTable(oData, false);
        } else {
          this.byId('batchDialog').setBusy(false);
          this.showErrorMessage(this.getI18nText('INVALID_CHARC_CONFIG'));
          this.byId('batchDialog').close();
          this.characteristicsColumns = [];
        }
      },

      setDataInBatchTable: function(oData, bMaterialGiven) {
        var oDialog = this.byId('batchDialog');
        var oTableMetadata = {
          visible: true,
          popinLayout: 'GridLarge',
          mode: 'SingleSelectMaster',
          selectionChange: [this.onSelectBatch, this]
        };
        if (!this.isInventoryManaged && this.getCurrentModel().getProperty('/material') !== '') {
          oTableMetadata.growing = true;
          oTableMetadata.growingThreshold = 20;
          oTableMetadata.growingScrollToLoad = true;
          oTableMetadata.updateStarted = [this.queryNextPageList, this];
        }
        if (sap.ui.getCore().byId('batchListTable')) {
          sap.ui.getCore().byId('batchListTable').destroy();
        }
        var oTable = new sap.m.Table('batchListTable', oTableMetadata);
        oTable.addStyleClass('tableContent');

        var headerTitle = new sap.m.Title('batchTableTitle', {
          text: '',
          level: 'H2'
        });
        var headerToolbar = new sap.m.Toolbar();
        headerToolbar.addContent(headerTitle);
        oTable.setHeaderToolbar(headerToolbar);

        var oColumnListItem = new sap.m.ColumnListItem('batchColumnListItem');
        var oColumnListItemBatchNumber = new sap.m.Text({
          text: '{batchDetailsModel>batchNumber}'
        });

        oColumnListItem.addCell(oColumnListItemBatchNumber);
        if (this.oSelectedBrowseType === 'StorageLocation') {
          var oColumnBatchNumber = new sap.m.Column({
            hAlign: 'Left',
            vAlign: 'Middle'
          }).setVisible(false);
        } else {
          var oColumnBatchNumber = new sap.m.Column({
            hAlign: 'Left',
            vAlign: 'Middle'
          });
        }
        var oHeaderControlBatchNumber = new sap.m.Text({
          text: '{i18n>batchNumber}'
        });
        oColumnBatchNumber.setHeader(oHeaderControlBatchNumber);
        oTable.addColumn(oColumnBatchNumber);

        if (this.getCurrentModel().getProperty('/material') === '') {
          var oColumnListItemMat = new sap.m.Text({
            text: '{batchDetailsModel>material/material}'
          });
          oColumnListItem.addCell(oColumnListItemMat);
          var oColumnMat = new sap.m.Column({
            hAlign: 'Left',
            vAlign: 'Middle'
          });
          var oHeaderControlMat = new sap.m.Text({
            text: '{i18n>MATERIAL}'
          });
          oColumnMat.setHeader(oHeaderControlMat);
          oTable.addColumn(oColumnMat);
        }

        var oColumnListItemStorageLocControl = new sap.m.Text({
          text: '{batchDetailsModel>storageLocation/storageLocation}'
        });
        oColumnListItem.addCell(oColumnListItemStorageLocControl);
        var oColumnStorageLoc = new sap.m.Column({
          hAlign: 'Left',
          vAlign: 'Middle'
        });
        var oHeaderControlStorageLoc = new sap.m.Text({
          text: '{i18n>storageLocation}'
        });
        oColumnStorageLoc.setHeader(oHeaderControlStorageLoc);
        oTable.addColumn(oColumnStorageLoc);

        // Added the Storage Location Description column : AD-006
        var oColumnListItemStorageDescControl = new sap.m.Text({
          text: '{batchDetailsModel>storageLocation/description}'
        });
        oColumnListItem.addCell(oColumnListItemStorageDescControl);

        var oColumnStorageDesc = new sap.m.Column({
          hAlign: 'Left',
          vAlign: 'Middle'
        });
        var oHeaderControlStorageDesc = new sap.m.Text({
          text: '{i18n>storageLocationDescription}'
        });
        oColumnStorageDesc.setHeader(oHeaderControlStorageDesc);
        oTable.addColumn(oColumnStorageDesc);

        var oColumnListItemQTYControl = new sap.m.Text({
          text: '{batchDetailsModel>qtyFormatted}'
        });
        oColumnListItem.addCell(oColumnListItemQTYControl);
        var oColumnQty = new sap.m.Column({
          hAlign: 'Right',
          vAlign: 'Middle'
        });
        var oHeaderControlQty = new sap.m.Text({
          text: '{i18n>QUANTITY}'
        });
        oColumnQty.setHeader(oHeaderControlQty);
        oTable.addColumn(oColumnQty);

        for (var i = 1; i <= this.characteristicsColumns.length; i++) {
          let sCharcName = this.characteristicsColumns[i - 1].name;
          let charcValueField = `batchCharcValuesMap/${sCharcName}/defaultBatchCharc/charcValue`;
          let charcUomField = `batchCharcValuesMap/${sCharcName}/defaultBatchCharc/charcUom`;
          let charcDataType = `batchCharcValuesMap/${sCharcName}/defaultBatchCharc/dataType`;
          var oColumnListItemControl = new sap.m.Text({
            text: {
              parts: ['batchDetailsModel>' + charcValueField, 'batchDetailsModel>' + charcUomField, 'batchDetailsModel>' + charcDataType],
              formatter: this.formatCharacteristics
            }
          }).addStyleClass('sapUiTinyMarginEnd');
          oColumnListItem.addCell(this._createBatchCharacteristicsColumn(oColumnListItemControl, sCharcName));
          var columnHeaderText = this.characteristicsColumns[i - 1].desc
            ? this.characteristicsColumns[i - 1].desc
            : this.characteristicsColumns[i - 1].name;
          var oColumn = new sap.m.Column({
            hAlign: 'Left',
            vAlign: 'Middle'
          });
          var oHeaderControl = new sap.m.Text({
            text: columnHeaderText
          });
          oColumn.setHeader(oHeaderControl);
          oTable.addColumn(oColumn);
        }

        var oColumnListItemExpDateControl = new sap.m.Text({
          text: '{batchDetailsModel>expiry}'
        });

        oColumnListItem.addCell(oColumnListItemExpDateControl);
        if (this.oSelectedBrowseType === 'StorageLocation') {
          var oColumnExpDate = new sap.m.Column({
            hAlign: 'Right',
            vAlign: 'Middle'
          }).setVisible(false);
        } else {
          var oColumnExpDate = new sap.m.Column({
            hAlign: 'Right',
            vAlign: 'Middle'
          });
        }
        var oHeaderExpDate = new sap.m.Text({
          text: '{i18n>expDate}'
        });
        oColumnExpDate.setHeader(oHeaderExpDate);
        oTable.addColumn(oColumnExpDate);

        oTable.bindItems('batchDetailsModel>/', oColumnListItem, null, null);
        oDialog.addContent(oTable);
        oTable.setModel(this.batchDetailsModel, 'batchDetailsModel');
        if (
          !this.isInventoryManaged &&
          this.getCurrentModel().getProperty('/material') !== '' &&
          this.totalPaginationElems > (this.oPageable.page + 1) * 20
        ) {
          oTable.getBindingInfo('items').binding.isLengthFinal = function() {
            return false;
          };
          oTable.setGrowingThreshold((this.oPageable.page + 1) * 20);
        } else if (
          !this.isInventoryManaged &&
          this.getCurrentModel().getProperty('/material') !== '' &&
          this.totalPaginationElems <= (this.oPageable.page + 1) * 20
        ) {
          oTable.getBindingInfo('items').binding.isLengthFinal = function() {
            return true;
          };
          oTable.setGrowing(false);
          oTable.setGrowingScrollToLoad(false);
        }
        this.setNumberOfItemsInBatchList();
        this.onSearchBatchListWithValue();
        oDialog.setBusy(false);
      },

      _createBatchCharacteristicsColumn: function(oColumn, sCharcName) {
        let that = this;
        return new sap.m.VBox({
          displayInline: true,
          items: [
            new sap.m.FlexBox({
              wrap: 'Wrap',
              displayInline: true,
              items: [
                oColumn,
                new sap.m.Link({
                  text: `{batchDetailsModel>batchCharcValuesMap/${sCharcName}/batchCharcValuesLength} ${that.getI18nText('more')}`,
                  press: function(oEvent) {
                    that._onMoreLinkPress(oEvent, sCharcName);
                  },
                  visible: `{batchDetailsModel>batchCharcValuesMap/${sCharcName}/morePopoverLinkVisibility}`
                })
              ]
            })
          ]
        });
      },

      _onMoreLinkPress: function(oEvent, sCharcName) {
        let oCtx = oEvent.getSource().getBindingContext('batchDetailsModel'),
          oControl = oEvent.getSource(),
          oView = this.getView();

        let oCharcValue = this.batchDetailsModel.getProperty(oCtx.getPath() + '/batchCharcValuesMap/' + sCharcName);
        if (oCharcValue.batchCharcValues.length > 0) {
          oCharcValue.dataType = oCharcValue.batchCharcValues[0].dataType;
          oCharcValue.uom = oCharcValue.batchCharcValues[0].uom;
          oCharcValue.decimalPlaces = oCharcValue.batchCharcValues[0].decimalPlaces;

          if (!this._batchCharcPopover) {
            this._batchCharcPopover = Fragment.load({
              id: oView.getId(),
              name: 'sap.dm.dme.browse.view.BatchPopover',
              controller: this
            }).then(
              function(oPopover) {
                oView.addDependent(oPopover);
                return oPopover;
              }.bind(this)
            );
          }
          oView.setModel(new JSONModel(oCharcValue), 'batchMorePopoverModel');
          this._batchCharcPopover.then(function(oPopover) {
            oPopover.openBy(oControl);
          });
        }
      },

      _charcNumberFormat: function(sValue, sUom, nDecimalPlaces) {
        let options = {
          maxFractionDigits: nDecimalPlaces,
          minFractionDigits: nDecimalPlaces
        };
        let sFormatedValue = NumberFormatter.dmcLocaleQuantityFormatterDisplay(sValue, '', options);
        return sFormatedValue && sUom ? sFormatedValue + ' ' + sUom : sFormatedValue;
      },

      prepareStockData: function(oData) {
        for (var i = 0; i < oData.length; i++) {
          var uomObj = {
            uom: oData[i].materialBaseUnit || null
          };
          var matObj = {
            material: oData[i].material
          };
          var storLocObj = {
            storageLocation: oData[i].storageLocation
          };
          oData[i].batchNumber = oData[i].batch;
          oData[i].remainingQuantity = oData[i].quantity;
          oData[i].unitOfMeasure = uomObj;
          oData[i].material = matObj;
          oData[i].storageLocation = storLocObj;
        }
      },

      prepareData: function(oData, bHealScen0Flag) {
        var i, sQtyFormatted, sExpiry;
        for (i = 0; i < oData.length; i++) {
          if (bHealScen0Flag) {
            var storLocObj = {
              storageLocation: oData[i].storageLocation
            };
            var uomObj = {
              uom: oData[i].materialBaseUnit
            };
            oData[i].remainingQuantity = oData[i].quantity;
            oData[i].unitOfMeasure = uomObj;
            oData[i].storageLocation = storLocObj;
          }
          sQtyFormatted = Formatter.formatBatchQuantityAdv(
            oData[i].remainingQuantity,
            oData[i].unitOfMeasure ? oData[i].unitOfMeasure.uom : null
          );
          oData[i].qtyFormatted = sQtyFormatted;
          if (oData[i].batch && oData[i].batch.shelfLifeExpirationDate) {
            sExpiry = Formatter.formatDate(oData[i].batch.shelfLifeExpirationDate);
          } else if (oData[i].expirationDate) {
            sExpiry = Formatter.formatDate(oData[i].expirationDate);
          } else if (oData[i].shelfLifeExpirationDate) {
            sExpiry = Formatter.formatDate(oData[i].shelfLifeExpirationDate);
          } else {
            sExpiry = '';
          }
          oData[i].expiry = sExpiry;
        }
      },

      filterRecordsWithZeroQuantity: function(oResponseData) {
        let i;
        let filteredRecords = [];

        if (this.isInventoryManaged) {
          for (i = 0; i < oResponseData.length; i++) {
            if (parseFloat(oResponseData[i].remainingQuantity.toFixed(3)) > 0) {
              filteredRecords.push(oResponseData[i]);
            }
          }
          return filteredRecords;
        }
        return oResponseData;
      },

      onGoAdvSearch: function(oEvent) {
        // validate and prepare payload
        var oDialog = this.byId('batchDialog');
        var oFilterBar = this.byId('filterBar');
        if (oFilterBar.getFilterGroupItems().length > 1) {
          if (oFilterBar.getFilterGroupItems()[0].getControl().getValue() === '') {
            oFilterBar.getFilterGroupItems()[0].getControl().setValueState('Error');
            oFilterBar.getFilterGroupItems()[0].getControl().setValueStateText(this.getI18nText('REQUIRED_STORAGE_LOC'));
            return;
          }
          var i;
          var characteristicInputs = [];
          for (var i = 1; i < oFilterBar.getFilterGroupItems().length; i++) {
            if (oFilterBar.getFilterGroupItems()[i].getControl().getValue() !== '') {
              characteristicInputs.push({
                charcName: oFilterBar.getFilterGroupItems()[i].getName(),
                charcValue: oFilterBar.getFilterGroupItems()[i].getControl().getValue(),
                charcExternalId: oFilterBar.getFilterGroupItems()[i].getEntityTypeName()
              });
            }
          }
          if (characteristicInputs.length === 0) {
            this.showErrorMessage(this.getI18nText('ONE_MANDATORY_CHARC'));
            return;
          }
          var payload = {
            characteristicInputs: characteristicInputs,
            inventoryStockType: '01',
            querySize: 20
          };

          //do service call
          var that = this;
          var sUrl = this.getInventoryDataSourceUri();
          var bHealScen0Flag = false;
          if (this.isInventoryManaged) {
            sUrl = sUrl + 'inventories/byStorageLocationAndCharacteristics';
            payload.storageLocation = oFilterBar.getFilterGroupItems()[0].getControl().getValue();
          } else {
            sUrl = sUrl + 'batches/batchesByCharacteristics';
            var storLocs = [];
            storLocs.push(oFilterBar.getFilterGroupItems()[0].getControl().getValue());
            payload.storageLocations = storLocs;
            bHealScen0Flag = true;
          }
          oDialog.setBusy(true);
          AjaxUtil.post(
            sUrl,
            payload,
            function(oResponseData) {
              that.batchDetailsList = oResponseData;
              that.batchDetailsModel = new JSONModel();
              that.batchDetailsModel.setSizeLimit(that.batchDetailsList.length);
              //find max 5 characteristics sorted alphanumerically on the basis of characteristics name.
              that.batchDetailsList = that.findCharacteristicsToBeShown(that.batchDetailsList);
              that.prepareData(that.batchDetailsList, bHealScen0Flag);
              that.batchDetailsModel.setData(that.batchDetailsList);
              //Create table dynamically where characteristics values along with batchId, quantity,
              that.setDataInBatchTable(that.batchDetailsList, false);
            },
            function(oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              oDialog.setBusy(false);
            }
          );
        } else {
          this.fetchBatchesWithStock(oDialog, oFilterBar);
        }
      },

      fetchBatchesWithStock: function(oDialog, oFilterBar) {
        if (oFilterBar.getFilterGroupItems()[0].getControl().getTokens().length < 1) {
          oFilterBar.getFilterGroupItems()[0].getControl().setValueState('Error');
          oFilterBar.getFilterGroupItems()[0].getControl().setValueStateText(this.getI18nText('REQUIRED_STORAGE_LOC'));
          return;
        }
        this.oPageable = this.oPageable || {};
        this.oPageable.page = 0;
        var oParameters = this.prepareInvStockParams(this.getCurrentModel());
        var storLocs = [];
        oFilterBar.getFilterGroupItems()[0].getControl().getTokens().forEach(function(token) {
          storLocs.push(token.getText());
        });
        this.multiStorLocs = storLocs;
        oParameters.storageLocations = storLocs.join(',');

        if (oFilterBar.getBasicSearchValue()) {
          oParameters.fuzzyBatch = oFilterBar.getBasicSearchValue();
        }

        var sUrl = this.getInventoryDataSourceUri() + 'inventory/inventoryStock';
        this.doInvStockApiCall(oDialog, sUrl, oParameters, false);
      },

      onSeachStorageLocationList: function(oEvt) {
        let sQuery = '';
        if (oEvt) {
          sQuery = oEvt.getParameter('value');
        }
        sQuery === '' ? this.handleStorageLocationDetails(sQuery) : this.onSearchStorageLocationListWithValue(sQuery);
      },
      onSeachStorageLocationListLiveChange: function(oEvt) {
        let sQuery = '';
        if (oEvt) {
          sQuery = oEvt.getParameter('value');
        }
        if (sQuery !== '') {
          this.onSearchStorageLocationListWithValue(sQuery);
        }
      },

      onSearchStorageLocationListWithValue: function(oValue) {
        var properties = ['inventoryId', 'storageLocation/storageLocation'];
        var list;
        var sLocBindings;
        if (this.getView()) {
          list = this.getView().byId('storageLocationDialog');
          sLocBindings = list.getBinding('items');
          this.handleSearchSloc(oValue, properties, sLocBindings);
        }
      },

      onSearchBatchListWithValue: function(oValue) {
        var properties = ['batchNumber', 'storageLocation/storageLocation', 'qtyFormatted', 'expiry'];
        //Search by characteristics values and uoms.
        for (var i = 1; i <= this.characteristicsColumns.length; i++) {
          properties.push('charcValue' + i);
          properties.push('charcUom' + i);
        }
        var list;
        var batchBindings;
        list = sap.ui.getCore().byId('batchListTable');
        batchBindings = list.getBinding('items');
        this.handleSearch(oValue, properties, batchBindings);
      },

      handleSearchSloc: function(oValue, propertiesArray, oBinding) {
        var aFilters = [],
          aCombinedFilters = [],
          filter,
          oFilterWithAllProperties;
        if (oValue && oValue.length > 0) {
          $.each(propertiesArray, function(oIndex, oObj) {
            filter = new sap.ui.model.Filter(oObj, sap.ui.model.FilterOperator.Contains, oValue);
            aFilters.push(filter);
          });
          oFilterWithAllProperties = new sap.ui.model.Filter({
            filters: aFilters,
            and: false
          });

          aCombinedFilters.push(oFilterWithAllProperties);
        }

        var oModel = this.getCurrentModel(),
          bBatchManaged = oModel.getProperty('/batchManaged'),
          sStorageLoc = oModel.getProperty('/storageLocation');
        if (sStorageLoc) {
          var oSLocFilter = new sap.ui.model.Filter({
            path: 'storageLocation/storageLocation',
            operator: 'EQ',
            value1: sStorageLoc
          });
          aCombinedFilters.push(oSLocFilter);
        }
        var oCombinedFilter = new sap.ui.model.Filter({
          filters: aCombinedFilters,
          and: true
        });
        oBinding.filter(oCombinedFilter);

        // oBinding.filter(oFilterWithAllProperties);
      },

      handleSearch: function(oValue, propertiesArray, oBinding) {
        var aFilters = [],
          aCombinedFilters = [],
          filter,
          oFilterWithAllProperties;
        if (oValue && oValue.length > 0) {
          $.each(propertiesArray, function(oIndex, oObj) {
            filter = new sap.ui.model.Filter(oObj, sap.ui.model.FilterOperator.Contains, oValue);
            aFilters.push(filter);
          });
          oFilterWithAllProperties = new sap.ui.model.Filter({
            filters: aFilters,
            and: false
          });
          aCombinedFilters.push(oFilterWithAllProperties);
        }

        var oModel = this.getCurrentModel(),
          bBatchManaged = oModel.getProperty('/batchManaged'),
          sStorageLoc = oModel.getProperty('/storageLocation'),
          oSLocFilter;

        if (sStorageLoc) {
          oSLocFilter = new sap.ui.model.Filter({
            path: 'storageLocation/storageLocation',
            operator: 'EQ',
            value1: this.getCurrentModel().getData().storageLocation
          });
          aCombinedFilters.push(oSLocFilter);
        }

        var oCombinedFilter = new sap.ui.model.Filter({
          filters: aCombinedFilters,
          and: true
        });

        oBinding.filter(oCombinedFilter);
        // oBinding.filter(oFilterWithAllProperties);
        this.setNumberOfItemsInBatchList();
      },

      setNumberOfItemsInBatchList: function() {
        let oTable = sap.ui.getCore().byId('batchListTable');
        let iLength = this.totalPaginationElems || oTable.getItems().length;
        if (iLength === 0) {
          sap.ui.getCore().byId('batchTableTitle').setText(this.getI18nText('items'));
        } else {
          sap.ui.getCore().byId('batchTableTitle').setText(this.getI18nText('items') + ' (' + iLength + ')');
        }
      },

      onSelectBatch: function(oEvent) {
        var oModel = this.getCurrentModel();
        var batchData = oEvent.getSource().getSelectedItem().getBindingContext('batchDetailsModel').getObject();
        sap.ui.getCore().byId('batchListTable').removeSelections(true);
        this.batchDataUpdateInModel(batchData, oModel);
        this.onCloseBatchDialog();
      },

      batchDataUpdateInModel: function(batchData, oModel) {
        if (batchData.unitOfMeasure) {
          oModel.setProperty(
            '/avlBatchQty',
            this.oFormatter.formatBatchQuantityAdv(batchData.remainingQuantity, batchData.unitOfMeasure.uom)
          );
        } else {
          oModel.setProperty('/avlBatchQty', this.oFormatter.formatBatchQuantityAdv(batchData.remainingQuantity, null));
        }
        oModel.setProperty('/expDate', batchData.modifiedDateTime);
        oModel.setProperty('/batchNumber', batchData.batchNumber);
        oModel.setProperty(
          '/storageLocation',
          batchData.storageLocation && batchData.storageLocation.storageLocation ? batchData.storageLocation.storageLocation : null
        );
        oModel.setProperty(
          '/storageLocationDesc',
          batchData.storageLocation && batchData.storageLocation.description ? batchData.storageLocation.description : null
        );
        oModel.setProperty(
          '/storageLocationRef',
          batchData.storageLocation && batchData.storageLocation.ref ? batchData.storageLocation.ref : null
        );
        oModel.setProperty('/shopOrderLocationRef', batchData.shopOrderLocRef);
        oModel.setProperty('/inventory', batchData.inventoryId);
        if (this.byId('filterBar') && this.byId('filterBar').getShowGoButton() && this.byId('filterBar').getFilterGroupItems().length > 1) {
          this.setMaterialAndOtherDetailsInModel(batchData.material, oModel);
        }
        this.isBatchNumberValid = true;
        var oWeighRelevantFlag = this.getView().getModel('authModel').getProperty('/weighRelevant');
        if (oWeighRelevantFlag) {
          this.onBatchChange(); //This call is overriding batch selection, hence skipping for non W&D
        }
        this._enableConfirmButton();
      },

      setMaterialAndOtherDetailsInModel: function(oMaterial, oModel) {
        if (!oMaterial.ref) {
          this.fetchDetailsOfMaterial(oMaterial, oModel);
        } else {
          this.proceedSetMaterialAndOtherDetailsInModel(oMaterial, oModel);
        }
      },

      fetchDetailsOfMaterial: function(oMaterial, oModel) {
        let that = this;
        let url =
          that.getProductDataSourceUri() +
          "Materials?$select=ref,material,description,version&$filter=(material eq '" +
          encodeURIComponent(oMaterial.material) +
          "' and currentVersion eq true)";
        let oParameters = {};
        AjaxUtil.get(
          url,
          oParameters,
          function(oResponseData) {
            oMaterial.description = oResponseData.value[0].description;
            oMaterial.ref = oResponseData.value[0].ref;
            oMaterial.version = oResponseData.value[0].version;
            that.proceedSetMaterialAndOtherDetailsInModel(oMaterial, oModel);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.byId('consumptionList').setBusy(false);
          }
        );
      },

      proceedSetMaterialAndOtherDetailsInModel: function(oMaterial, oModel) {
        var sDialogId = this.getCurrentDialogId();
        this.byId(sDialogId).setBusy(true);
        var selectedMaterial = oMaterial.material;
        var selectedMaterialRef = oMaterial.ref;
        var selectedMaterialDesc = oMaterial.description;
        var selectedMaterialVersion = oMaterial.version;

        //check if BOM component or not
        var i, bomItem;
        var isBOM = false;
        for (i = 0; i < this.itemList.lineItems.length; i++) {
          if (this.itemList.lineItems[i].materialId.ref === selectedMaterialRef && this.itemList.lineItems[i].isBomComponent === true) {
            isBOM = true;
            bomItem = this.itemList.lineItems[i];
            break;
          }
        }

        var bomComponentRef, isBatchManaged, defaultBatchId, oRemainingQuantity, selectedUom;
        var loggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';
        isBatchManaged = true;
        this.getCurrentDialogId() === 'addDialog'
          ? this.byId('storageLocationAdd').setEnabled(false)
          : this.byId('storageLocationScan').setEnabled(false);

        // UOM Model
        if (!this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
          this.getAlternateUoms(this.alternateUomForSelectedMaterial, selectedMaterial, selectedMaterialRef, selectedMaterialVersion);
        } else {
          this.alternateUomsModel.setData(this.alternateUomForSelectedMaterial[selectedMaterial]);
          this.getView().setModel(this.alternateUomsModel, 'unitModel');
        }

        // Other data
        if (isBOM === true) {
          bomComponentRef = bomItem.bomComponentRef;
          var consumedQuantity = bomItem.consumedQuantity.value ? bomItem.consumedQuantity.value : 0;
          var targetQuantity = bomItem.targetQuantity.value ? bomItem.targetQuantity.value : 0;
          oRemainingQuantity = consumedQuantity < targetQuantity ? targetQuantity - consumedQuantity : '';
          defaultBatchId = bomItem.plannedBatchNumber || '';

          selectedUom = bomItem.targetQuantity.unitOfMeasure.uom;
          this.consumedQuantityForSelectedMaterial = bomItem.consumedQuantity.value;
          this.upperThresholdForSelectedMaterial = bomItem.upperThresholdValue;
        } else {
          bomComponentRef = null;
          oRemainingQuantity = '';
          defaultBatchId = '';

          selectedUom = '';
          this.consumedQuantityForSelectedMaterial = undefined;
          this.upperThresholdForSelectedMaterial = undefined;
        }

        // Set the default values
        oModel.setProperty('/shopOrder', this.selectedDataInList.selectedShopOrder);
        if (this.selectedDataInList.orderSelectionType === 'PROCESS')
          oModel.setProperty('/operationActivity', this.selectedDataInList.phaseId);
        else oModel.setProperty('/operationActivity', this.selectedDataInList.operation.operation);
        oModel.setProperty('/bomComponentRef', bomComponentRef);
        oModel.setProperty('/batchId', this.selectedDataInList.selectedSfc);
        oModel.setProperty('/material', selectedMaterial);
        oModel.setProperty('/materialDescription', selectedMaterialDesc);
        oModel.setProperty('/workCenter', this.selectedDataInList.workCenter.workcenter);
        oModel.setProperty('/quantity/value', this.oFormatter.formatNumberWithThreeDecimals(oRemainingQuantity));
        oModel.setProperty('/quantity/unitOfMeasure/uom', selectedUom);
        oModel.setProperty('/userId', loggedInUser);
        if (loggedInUser) {
          this.isPostedByValid = true;
        } else {
          this.isPostedByValid = false;
        }
        oModel.setProperty('/batchManaged', isBatchManaged);
        oModel.setProperty('/materialRef', selectedMaterialRef);
        oModel.setProperty('/isBomComponent', isBOM);

        this.onQuantityLiveChange();
        this.byId(sDialogId).setBusy(false);
      },

      onSelectStorageLocation: function(oEvent) {
        var oModel = this.getCurrentModel();
        var sLocData = oEvent.getParameters().selectedItem.getBindingContext('storageLocationModel').getObject();
        if (this.isInventoryManaged || (!this.isInventoryManaged && !oModel.getProperty('/batchManaged'))) {
          if (sLocData.unitOfMeasure) {
            oModel.setProperty(
              '/avlBatchQty',
              this.oFormatter.formatBatchQuantityAdv(sLocData.remainingQuantity, sLocData.unitOfMeasure.uom)
            );
          } else {
            oModel.setProperty('/avlBatchQty', this.oFormatter.formatBatchQuantityAdv(sLocData.remainingQuantity, null));
          }
        } else {
          oModel.setProperty('/avlBatchQty', '');
        }
        oModel.setProperty('/storageLocation', sLocData.storageLocation ? sLocData.storageLocation.storageLocation : '');
        oModel.setProperty('/storageLocationDesc', sLocData.storageLocation ? sLocData.storageLocation.description : '');
        oModel.setProperty('/inventory', sLocData.inventoryId);
        this._enableConfirmButton();
      },

      onClosePostingsDialog: function() {
        var oTable = this.getView().byId('postingsTable');
        var oColumnListItem = this.getView().byId('postingDetailsCLItem');
        var oTableLength = oTable.getColumns().length;
        var oColumnListItemLength = oColumnListItem.getCells().length;
        for (var i = oTableLength; i > this.postingsTableColumnLength; i--) {
          oTable.removeColumn(oTable.getColumns()[i - 1]);
        }
        for (var j = oColumnListItemLength; j > oColumnListItemLength; j--) {
          oColumnListItem.removeCell(oColumnListItem.getCells()[j - 1]);
        }
        this.getView().byId('postingsDialog').close();
      },

      onCloseBatchDialog: function() {
        if (sap.ui.getCore().byId('batchListTable')) {
          sap.ui.getCore().byId('batchListTable').destroy();
        }
        this.getView().byId('batchDialog').close();
      },

      onCloseUserDialog: function() {
        this.getView().byId('userDialog').close();
      },

      showConsumePopup: function(oEvent) {
        this.isConsumeDialogOpen = true;
        var oView = this.getView();
        var oBindingObject = oEvent.getSource().getBindingContext().getObject();

        if (!this._validatePhaseStatus()) {
          MessageBox.error(this.getI18nText('phaseNotInActiveStatusErrMsg', [this.selectedDataInList.truncatedPhaseId]));
          return;
        }

        var selectedMaterial = oEvent.getSource().getBindingContext().getObject().materialId.material;
        // if (this._hasParkedItems() && !this._checkIfItemIsParked(selectedMaterial)) {
        //   MessageBox.error(this.getI18nText('processParkedItemsErrMsg', [this._getParkedMaterialList(), selectedMaterial]));
        //   return;
        // }

        var selectedMaterialRef = oEvent.getSource().getBindingContext().getObject().materialId.ref;
        var selectedMaterialVersion = oEvent.getSource().getBindingContext().getObject().materialId.version;
        var selectedMaterialDesc = oEvent.getSource().getBindingContext().getObject().description;
        var selectedMaterialType = oEvent.getSource().getBindingContext().getObject().materialType;
        var isBomComponent = oEvent.getSource().getBindingContext().getObject().isBomComponent;
        var storageLocationRef;
        var storageLocation;
        var storageLocationDesc = '';
        if (oEvent.getSource().getBindingContext().getObject().storageLocation) {
          storageLocationRef = oEvent.getSource().getBindingContext().getObject().storageLocation.ref;
          storageLocation = oEvent.getSource().getBindingContext().getObject().storageLocation.storageLocation;
          storageLocationDesc = oEvent.getSource().getBindingContext().getObject().storageLocation.description;
        } else {
          storageLocationRef = '';
          storageLocation = '';
        }
        var oCalculatableQuantities = this.determineTargetAndConsumedQty(oBindingObject);
        var consumedQuantity =
          oCalculatableQuantities && oCalculatableQuantities.consumedQuantity && oCalculatableQuantities.consumedQuantity.value
            ? oCalculatableQuantities.consumedQuantity.value
            : 0;
        var targetQuantity =
          oCalculatableQuantities && oCalculatableQuantities.targetQuantity && oCalculatableQuantities.targetQuantity.value
            ? oCalculatableQuantities.targetQuantity.value
            : 0;

        var oRemainingQuantity = consumedQuantity < targetQuantity ? targetQuantity - consumedQuantity : '';

        var isBatchManaged =
          oEvent.getSource().getBindingContext().getObject().batchManaged === undefined ||
          oEvent.getSource().getBindingContext().getObject().batchManaged === 'NONE'
            ? false
            : true;
        var defaultBatchId;
        if (isBatchManaged) {
          defaultBatchId = oEvent.getSource().getBindingContext().getObject().plannedBatchNumber || '';
        } else {
          defaultBatchId = this.getI18nText('notBatchManaged');
        }
        var selectedUom = oCalculatableQuantities.targetQuantity.uom.uom;
        var bomComponentRef = oEvent.getSource().getBindingContext().getObject().bomComponentRef;
        var loggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';
        this.consumedQuantityForSelectedMaterial = oEvent.getSource().getBindingContext().getObject().consumedQuantity.value;
        this.upperThresholdForSelectedMaterial = {
          value: oEvent.getSource().getBindingContext().getObject().upperThresholdValueToBeDisplayed,
          uom: oEvent.getSource().getBindingContext().getObject().thresholdValue.selectedTargetValue.unitOfMeasure.uom
        };

        // UOM Model
        if (!this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
          this.getAlternateUoms(
            this.alternateUomForSelectedMaterial,
            selectedMaterial,
            selectedMaterialRef,
            selectedMaterialVersion,
            'consume'
          );
        } else {
          this.alternateUomsModel.setData(this.alternateUomForSelectedMaterial[selectedMaterial]);
          this.getView().setModel(this.alternateUomsModel, 'unitModel');
          this.checkMaterialEWMManaged(selectedMaterialRef);
        }
        // Set the default values
        oView.getModel('consumeModel').setProperty('/shopOrder', this.selectedDataInList.selectedShopOrder);
        if (this.selectedDataInList.orderSelectionType === 'PROCESS')
          oView.getModel('consumeModel').setProperty('/operationActivity', this.selectedDataInList.phaseId);
        else oView.getModel('consumeModel').setProperty('/operationActivity', this.selectedDataInList.operation.operation);
        oView.getModel('consumeModel').setProperty('/bomComponentRef', bomComponentRef);
        oView.getModel('consumeModel').setProperty('/batchId', this.selectedDataInList.selectedSfc);
        oView.getModel('consumeModel').setProperty('/material', selectedMaterial);
        oView.getModel('consumeModel').setProperty('/materialDescription', selectedMaterialDesc);
        oView.getModel('consumeModel').setProperty('/materialType', selectedMaterialType);
        oView.getModel('consumeModel').setProperty('/batchNumber', defaultBatchId);
        oView.getModel('consumeModel').setProperty('/workCenter', this.selectedDataInList.workCenter.workcenter);
        oView.getModel('consumeModel').setProperty('/quantity/unitOfMeasure/uom', selectedUom);
        oView.getModel('consumeModel').setProperty('/userId', loggedInUser);
        oView.getModel('consumeModel').setProperty('/quantity/value', this.oFormatter.formatNumberWithThreeDecimals(oRemainingQuantity));
        if (loggedInUser) {
          this.isPostedByValid = true;
        } else {
          this.isPostedByValid = false;
        }
        oView.getModel('consumeModel').setProperty('/handlingUnitNumber', '');
        oView.getModel('consumeModel').setProperty('/useFullHandlingUnit', false);
        oView.getModel('consumeModel').setProperty('/batchManaged', isBatchManaged);
        oView.getModel('consumeModel').setProperty('/storageLocation', storageLocation);
        oView.getModel('consumeModel').setProperty('/storageLocationDesc', storageLocationDesc);
        oView.getModel('consumeModel').setProperty('/storageLocationRef', storageLocationRef);
        oView.getModel('consumeModel').setProperty('/materialRef', selectedMaterialRef);
        oView.getModel('consumeModel').setProperty('/isBomComponent', isBomComponent);
        oView.getModel('consumeModel').setProperty('/calculatedData', null);
        if (this.byId('inputPostingDate')) {
          this.byId('inputPostingDate').setValue(this.getCurrentDateInPlantTimeZone());
        }

        if (this.byId('consumeDialog')) {
          this.onQuantityLiveChange();
        }

        if (
          this.isInventoryManaged &&
          ((defaultBatchId && defaultBatchId !== this.getI18nText('notBatchManaged')) ||
            (!isBatchManaged && storageLocation && storageLocationRef))
        ) {
          this.prepareInventoryUrl(selectedMaterialRef, defaultBatchId, storageLocationRef, 'consumeDialog', false);
        } else if (
          !this.isInventoryManaged &&
          ((!isBatchManaged && storageLocation) ||
            (storageLocation && defaultBatchId && defaultBatchId !== this.getI18nText('notBatchManaged')))
        ) {
          this.isBatchNumberValid = true;
          this.getStockForDefaults(selectedMaterial, storageLocation, defaultBatchId, 'consumeDialog');
        } else {
          this._enableConfirmButton();
        }
        this._enableDisableCalculation();
      },

      showConsumePopupCoBy: function(oEvent) {
        var selectedComponent = oEvent.getSource().getBindingContext('coBiProductModel').getObject();
        var selectedMaterial = selectedComponent.materialId ? selectedComponent.materialId.material : null;
        var selectedMaterialVersion = selectedComponent.materialId ? selectedComponent.materialId.version : null;
        var selectedBatchID = selectedComponent.plannedBatchNumber;
        var selectedStorageLocation = selectedComponent.storageLocation ? selectedComponent.storageLocation.storageLocation : null;
        var selectedUom = selectedComponent.consumedQuantity ? selectedComponent.consumedQuantity.unitOfMeasure.uom : null;
        var selectedTargetQuantityValue = oEvent.getSource().getBindingContext('coBiProductModel').getObject().targetQuantity.value;
        var loggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';
        var selectedOrderData = {
          orderRef: this.selectedDataInList.selectedShopOrderRef,
          order: this.selectedDataInList.selectedShopOrder,
          sfc: this.selectedDataInList.selectedSfc,
          workcenter: this.selectedDataInList.workCenter.workcenter
        };

        this.GRPostController.setController(this);
        this.GRPostController.setSelectedOrderData(selectedOrderData);

        var oGRData = {};
        oGRData.material = selectedMaterial;
        oGRData.version = selectedMaterialVersion;
        oGRData.batchNumber = selectedBatchID;
        oGRData.storageLocation = selectedStorageLocation;
        oGRData.uom = selectedUom;
        oGRData.targetQuantityValue = selectedTargetQuantityValue;
        oGRData.loggedInUserEmail = loggedInUser;
        oGRData.loggedInUser = loggedInUser;
        oGRData.plantTimeZoneId = this.plantTimeZoneId;

        oLogger.info('Calling GRController to handle consume popup for Co and By products');
        this.GRPostController.showGoodsReceiptDialog(
          oGRData,
          function(oSelectedObject) {
            var oData = {
              selectedShopOrder: oSelectedObject.orderNumber,
              selectedSfc: this.selectedDataInList.selectedSfc,
              phaseId: this.selectedDataInList.phaseId,
              operation: {
                operation: this.selectedDataInList.operation.operation
              },
              stepId: this.selectedDataInList.stepId,
              orderSelectionType: this.selectedDataInList.orderSelectionType
            };
            oLogger.info('Fetching GI Material data');
            this.getGiMaterialData(oData);
          }.bind(this)
        );
      },

      getStockForDefaults: function(material, storageLocation, batch, sDialogId) {
        var that = this;
        if (that.byId(sDialogId)) {
          that.byId(sDialogId).setBusy(true);
        } else {
          that.byId('consumptionList').setBusy(true);
        }
        var oModel = this.getCurrentModel();
        var sUrl = this.getInventoryDataSourceUri() + 'inventory/inventoryStock';
        var oParameters = {};
        oParameters.material = material;
        var storLocs = [];
        storLocs.push(storageLocation);
        oParameters.storageLocations = storLocs.join(',');
        if (batch && batch !== this.getI18nText('notBatchManaged')) {
          oParameters.batch = batch;
        }
        oParameters.inventoryStockType = '01';
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var stockDetails = oResponseData.content;
            var remainingQuantity = stockDetails && stockDetails[0] ? stockDetails[0].quantity : 0;
            var sUom = stockDetails && stockDetails[0] ? stockDetails[0].materialBaseUnit : '';
            oModel.setProperty('/avlBatchQty', that.oFormatter.formatBatchQuantityAdv(remainingQuantity, sUom));
            if (that.byId(sDialogId)) {
              that.byId(sDialogId).setBusy(false);
            }
            that.byId('consumptionList').setBusy(false);
            that._enableConfirmButton();
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            if (that.byId(sDialogId)) {
              that.byId(sDialogId).setBusy(false);
            }
            that.byId('consumptionList').setBusy(false);
            oModel.refresh();
            that._enableConfirmButton();
          }
        );
      },

      prepareInventoryUrl: function(materialRef, batchId, storageLocationRef, oDialogId, isBatchChangeFlag) {
        var inventryUrl = this.getInventoryDataSourceUri();
        var oParameters = {};
        oParameters.materialRef = materialRef;
        if (batchId && batchId !== this.getI18nText('notBatchManaged')) {
          oParameters.batchNumber = batchId;
        }
        if (storageLocationRef) {
          oParameters.storageLocation = storageLocationRef.split(',')[1];
        }
        oParameters.shopOrderRef = this.selectedDataInList.selectedShopOrderRef;
        var sUrl = inventryUrl + 'inventory/findInventory';
        this.getBatchDetailsForDefaultBatch(sUrl, oParameters, oDialogId, batchId, isBatchChangeFlag);
      },

      getBatchDetailsForDefaultBatch: function(sUrl, oParameters, sDialogId, defaultBatchId, isBatchChangeFlag) {
        var that = this;
        if (that.byId(sDialogId)) {
          that.byId(sDialogId).setBusy(true);
        } else {
          that.byId('consumptionList').setBusy(true);
        }
        var oModel = this.getCurrentModel();
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            that.BatchDetails = oResponseData;
            if (that.BatchDetails.length > 0) {
              var oBatchToUse = that.getFirstCreatedBatch(that.BatchDetails);
              that.setValueToSLoc(sDialogId, oBatchToUse);
              if (defaultBatchId && defaultBatchId !== that.getI18nText('notBatchManaged')) {
                oModel.setProperty('/batchNumber', oBatchToUse.batchNumber);
              }
              if (oBatchToUse.unitOfMeasure) {
                oModel.setProperty(
                  '/avlBatchQty',
                  that.oFormatter.formatBatchQuantityAdv(oBatchToUse.remainingQuantity, oBatchToUse.unitOfMeasure.uom)
                );
              } else {
                oModel.setProperty('/avlBatchQty', that.oFormatter.formatBatchQuantityAdv(oBatchToUse.remainingQuantity, null));
              }
              oModel.setProperty('/expDate', oBatchToUse.modifiedDateTime);
              oModel.setProperty('/inventory', oBatchToUse.inventoryId);
              that.isBatchNumberValid = true;
              //if (isBatchChangeFlag)
              that._enableConfirmButton();
            } else {
              that.isInventoryManaged ? oModel.setProperty('/avlBatchQty', 0) : oModel.setProperty('/avlBatchQty', '');
              oModel.setProperty('/expDate', '');
              oModel.setProperty('/inventory', '');
              that.isBatchNumberValid = false;
              //if (isBatchChangeFlag)
              that._enableConfirmButton();
              if (that.isFreeText) {
                oModel.setProperty('/batchNumber', '');
                if (that.getCurrentDialogId() !== 'none') that.showErrorMessage(that.getI18nText('REQUIRED_BATCH_INPUT'));
              }
            }
            if (that.byId(sDialogId)) that.byId(sDialogId).setBusy(false);
            that.isFreeText = false;
            that.byId('consumptionList').setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            if (that.byId(sDialogId).isOpen()) {
              that.showErrorMessage(err, true, true);
            }
            if (that.byId(sDialogId)) that.byId(sDialogId).setBusy(false);
            that.byId('consumptionList').setBusy(false);
            that.BatchDetails = {};
          }
        );
      },

      setValueToSLoc: function(sDialogId, oBatchToUse) {
        if (oBatchToUse.storageLocation) {
          // set value in the sloc input with the sorted batch sloc
          let sLoc = oBatchToUse.storageLocation.storageLocation;
          let slocId;
          switch (sDialogId) {
            case 'scanDialog':
              slocId = this.byId('storageLocationScan');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            case 'addDialog':
              slocId = this.byId('storageLocationAdd');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            case 'consumeDialog':
              slocId = this.byId('storageLocation');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            case 'weighDialog':
              slocId = this.byId('inStorageLocation');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            case 'addWeighDialog':
              slocId = this.byId('inAddWeighStorageLocation');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            case 'scanWeighDialog':
              slocId = this.byId('inScanWeighStorageLocation');
              if (slocId) {
                slocId.setValue(sLoc);
              }
              break;

            default:
              break;
          }
        }
      },

      getFirstCreatedBatch: function(batches) {
        var oFirstCreatedBatch = batches[0];
        for (var i = 1; i < batches.length; i++) {
          if (
            !oFirstCreatedBatch.receiveDatetime ||
            (batches[i].receiveDatetime && oFirstCreatedBatch.receiveDatetime > batches[i].receiveDatetime)
          ) {
            oFirstCreatedBatch = batches[i];
          }
        }
        return oFirstCreatedBatch;
      },

      openMaterialConsumptionPopup: function(oView) {
        if (!this.byId('consumeDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.ConsumeDialog',
            controller: this
          }).then(
            function(oDialog) {
              oDialog.setEscapeHandler(
                function(oPromise) {
                  this.onCancelConsumeDialog();
                  oPromise.resolve();
                }.bind(this)
              );
              oView.addDependent(oDialog);
              oDialog.open();
              this.byId('inputPostingDate').setValue(this.getCurrentDateInPlantTimeZone());
              this.buildCustomFieldFormContent();
              this.onQuantityLiveChange();
            }.bind(this)
          );
        } else {
          this.byId('consumeDialog').open();
          this.byId('inputPostingDate').setValue(this.getCurrentDateInPlantTimeZone());
          this.buildCustomFieldFormContent();
        }
      },

      buildCustomFieldFormContent: function() {
        var currentForm = this.getCurrentForm();
        if (this.oPluginConfiguration && this.oPluginConfiguration.customField1) {
          var customFieldLabel1 = new sap.m.Label('customFieldLabel1', { text: this.oPluginConfiguration.customField1 });
          var customFieldValue1 = new sap.m.Input('customField1', {
            value: '',
            valueLiveUpdate: true,
            liveChange: this.onCustomFieldLiveChange.bind(this),
            layoutData: new sap.ui.layout.GridData({ span: 'XL4 L4 M4 S4' })
          });
          currentForm.addContent(customFieldLabel1);
          currentForm.addContent(customFieldValue1);
        }
      },

      onCustomFieldLiveChange: function(oEvent) {
        var oView = this.getView();
        var customFieldId = oEvent.getSource().getId();
        var customFieldData = oEvent.getSource().getValue();
        ErrorHandler.clearErrorState(oEvent.getSource());
        var oSaveBtn = this.getCurrentSaveButton();
        oSaveBtn && oSaveBtn.setEnabled && oSaveBtn.setEnabled(false);
        if (this.validateInputRegEx(customFieldData)) {
          this.buildCustomFieldData(customFieldId, customFieldData);
          this._enableConfirmButton();
        } else {
          ErrorHandler.setErrorState(sap.ui.getCore().byId(customFieldId), this.getI18nText('INVALID_INPUT'));
        }
      },

      buildCustomFieldData: function(customFieldId, customFieldValue) {
        if (!customFieldValue) {
          for (var i = 0; this.customFieldJson && i < this.customFieldJson.length; i++) {
            if (this.customFieldJson[i].id === customFieldId) {
              this.customFieldJson.splice(i, 1);
              break;
            }
          }
        } else {
          var customFieldData = {};
          if (this.customFieldJson && this.customFieldJson.length > 0) {
            var idAlreadyExist = false;
            for (var j = 0; j < this.customFieldJson.length; j++) {
              if (this.customFieldJson[j].id === customFieldId) {
                this.customFieldJson[j].value = customFieldValue;
                idAlreadyExist = true;
                break;
              }
            }
            if (!idAlreadyExist) {
              customFieldData.id = customFieldId;
              customFieldData.value = customFieldValue;
              this.customFieldJson.push(customFieldData);
            }
          } else {
            this.customFieldJson = [];
            customFieldData.id = customFieldId;
            customFieldData.value = customFieldValue;
            this.customFieldJson.push(customFieldData);
          }
        }
        if (this.customFieldJson) {
          this.customFieldJson.sort(function(x, y) {
            var a = x.id.toUpperCase();
            var b = y.id.toUpperCase();
            return a === b ? 0 : a > b ? 1 : -1;
          });
        }
      },

      onConfirmConsumeDialog: function(oEvent) {
        this._enableConfirmButton();
        // If the validation fails, do not proceed with posting
        if (!oEvent.getSource().getEnabled()) return;
        // Append Time
        var oModel = this.getCurrentModel();
        var selectedUom = oModel.getProperty('/quantity/unitOfMeasure/uom');
        var selectedInternalUom;
        var uomControlIndex = this.getCurrentDialogId() === 'consumeDialog' ? 16 : 13;
        if (oEvent.getSource().getParent().getContent().length === 1) {
          selectedInternalUom = oEvent
            .getSource()
            .getParent()
            .getContent()[0]
            .getContent()
            [uomControlIndex].getSelectedItem()
            .getBindingContext('unitModel')
            .getObject().internalUom;
          if (!selectedUom) selectedUom = oEvent.getSource().getParent().getContent()[0].getContent()[uomControlIndex].getSelectedKey();
        } else {
          selectedInternalUom = oEvent
            .getSource()
            .getParent()
            .getContent()[1]
            .getContent()
            [uomControlIndex].getSelectedItem()
            .getBindingContext('unitModel')
            .getObject().internalUom;
          if (!selectedUom) selectedUom = oEvent.getSource().getParent().getContent()[1].getContent()[uomControlIndex].getSelectedKey();
        }
        oModel.setProperty('/quantity/unitOfMeasure/uom', selectedUom);
        oModel.setProperty('/quantity/unitOfMeasure/internalUom', selectedInternalUom);

        var selectedMaterial = this.consumeData.material;
        var i, currentUoms;
        var numerator = 1;
        var denominator = 1;
        if (this.alternateUomForSelectedMaterial[selectedMaterial]) {
          currentUoms = this.alternateUomForSelectedMaterial[selectedMaterial];
          for (i = 0; i < currentUoms.length; i++) {
            if (currentUoms[i].uom === selectedUom) {
              numerator = currentUoms[i].numerator;
              denominator = currentUoms[i].denominator;
              break;
            }
          }
        }
        var quantityToBeconsumed = oModel.getProperty('/quantity/value') * (numerator / denominator);
        var totalQuantityToBeConsumed =
          (this.consumedQuantityForSelectedMaterial ? this.consumedQuantityForSelectedMaterial : 0) + quantityToBeconsumed;
        var upperThreshold = this.upperThresholdForSelectedMaterial
          ? this.convertToUom(selectedMaterial, this.upperThresholdForSelectedMaterial.value, this.upperThresholdForSelectedMaterial.uom)
          : null;

        if (upperThreshold !== null) {
          if (totalQuantityToBeConsumed > upperThreshold) {
            this.confirmPageLeave(
              oModel,
              function() {
                this.setDataToModelAndPostGi(oModel);
              }.bind(this)
            );
          } else {
            this.setDataToModelAndPostGi(oModel);
          }
        } else {
          this.setDataToModelAndPostGi(oModel);
        }
      },

      confirmPageLeave: function(oModel, fnProceed, fnCancel) {
        this._showMessageBox(oModel, function(bProceed) {
          if (bProceed) {
            fnProceed();
          } else if (fnCancel) {
            fnCancel();
          }
        });
      },

      _showMessageBox: function(oModel, fnCallback) {
        var oWarningMsg = this.getOverConsumptionWarningMessage(oModel);
        MessageBox.warning(oWarningMsg.message, {
          styleClass: 'sapUiSizeCompact',
          actions: [oWarningMsg.button, MessageBox.Action.CANCEL],
          onClose: function(oAction) {
            fnCallback(oAction === oWarningMsg.button);
          }
        });
      },

      /***
         * Returns the Unsaved Warning Message
         * @returns
         */
      getOverConsumptionWarningMessage: function(oModel) {
        var sWarningMsg = this.getI18nText('warningMessage', oModel.getProperty('/material'));
        return {
          message: sWarningMsg,
          button: this.getI18nText('proceed')
        };
      },

      setDataToModelAndPostGi: function(oModel) {
        //this.currentSaveBtn = this.getCurrentSaveButton();
        //this.currentSaveBtn.setEnabled(false);
        // Explanation: In the Weighing Screen are two Confirm Buttons so both have to be handled not only one.
        var oSaveBtn = this.getCurrentSaveButton();
        if (oSaveBtn === 'weighing' || oSaveBtn === 'scanWeighing' || oSaveBtn === 'addWeighing') {
          this.oWeighDispenseHandler.setWeighingSaveButtons(false);
        } else {
          // Normal Button Update
          oSaveBtn.setEnabled(false);
        }
        this.currentDialogId = this.getCurrentDialogId();
        this.byId(this.currentDialogId).setBusy(true);

        var postedDateTime = oModel.getProperty('/dateTime') + ' ' + '00' + ':' + '00' + ':' + '00';
        oModel.setProperty('/dateTime', postedDateTime);
        this.dataToBePosted = {
          shopOrder: this.consumeData.shopOrder,
          batchId: this.consumeData.batchId,
          operationActivity: this.consumeData.operationActivity,
          bomComponentRef: this.consumeData.bomComponentRef,
          material: this.consumeData.material,
          batchNumber:
            this.consumeData.batchNumber === this.getI18nText('notBatchManaged') || !this.consumeData.batchNumber
              ? null
              : this.consumeData.batchNumber,
          shopOrderLocationRef:
            this.consumeData.shopOrderLocationRef === undefined || this.consumeData.shopOrderLocationRef === ''
              ? null
              : this.consumeData.shopOrderLocationRef,
          workCenter: this.consumeData.workCenter,
          inventory: this.consumeData.inventory === '' || this.consumeData.materialType === 'PIPELINE' ? null : this.consumeData.inventory,
          isBomComponent: this.consumeData.isBomComponent,
          quantity: {
            value: this.consumeData.quantity.value,
            unitOfMeasure: {
              uom: this.consumeData.quantity.unitOfMeasure.internalUom, //As the API does not support UoM yet
              internalUom: this.consumeData.quantity.unitOfMeasure.internalUom,
              shortText: this.consumeData.quantity.unitOfMeasure.shortText,
              longText: this.consumeData.quantity.unitOfMeasure.longText,
              numerator: this.consumeData.quantity.unitOfMeasure.numerator,
              denominator: this.consumeData.quantity.unitOfMeasure.denominator
            }
          },
          useFullHandlingUnit: this.consumeData.useFullHandlingUnit,
          handlingUnitNumber: this.consumeData.handlingUnitNumber,
          storageLocation: this.consumeData.storageLocation,
          isInventoryManaged: this.isInventoryManaged,
          userId: this.consumeData.userId,
          dateTime: this.consumeData.dateTime,
          comments: this.consumeData.comments,
          calculatedData: this.consumeData.calculatedData,
          customFieldData: this.customFieldJson && this.customFieldJson.length > 0 ? JSON.stringify(this.customFieldJson) : null
        };
        var assemblyUrl = this.getAssemblyDataSourceUri();
        var sUrl = assemblyUrl + 'order/goodsIssue';
        this.postGiData(sUrl, this.dataToBePosted);
      },

      onCancelConsumeDialog: function() {
        this.isConsumeDialogOpen = false;
        var oFormLength = this.byId('consumeMaterialForm').getContent().length;
        for (var i = oFormLength; i > 23; i--) {
          this.byId('consumeMaterialForm').getContent()[i - 1].destroy();
        }
        this.byId('consumeDialog').close();
        this.resetFieldVerificationFlags();
        this._resetFields();
      },

      _resetFields: function() {
        this.byId('inputMatNum').setText('');
        this.byId('inputMatDesc').setText('');
        this.byId('inputBatchId').setValue('');
        this.byId('inputQuantity').setValue('');
        this.byId('storageLocation').setValue('');
        this.byId('inputUnit').setSelectedIndex(0);
        this.byId('inputPostedBy').setValue('');
        this.byId('inputPostingDate').setValue('');
        this.byId('avlQty').setText('');
        this.byId('inputCommentsForConsume').setValue('');
        this.customFieldJson = [];
        //this.byId("expDate").setText("");

        this.byId('giConfirmBtn').setEnabled(false);

        this.getView().getModel('consumeModel').setProperty('/calculatedData', null);

        ErrorHandler.clearErrorState(this.byId('inputQuantity'));
        ErrorHandler.clearErrorState(this.byId('inputBatchId'));
        ErrorHandler.clearErrorState(this.byId('inputPostedBy'));
        ErrorHandler.clearErrorState(this.byId('inputPostingDate'));
        ErrorHandler.clearErrorState(this.byId('inputCommentsForConsume'));
      },

      onQuantityLiveChange: function(oEvent) {
        var oModel = this.getCurrentModel();
        var oSaveBtn = this.getCurrentSaveButton();
        var oInputQuantityBtn = this.getCurrentInputQuantityControl();
        oSaveBtn.setEnabled(false);
        var batchNumber = oModel.getProperty('/batchNumber');
        // qty validation is taken care by qty type field. Removing all explicit regex checks
        // We only check if the inout is left blank
        this.isQuantityValid = !(oInputQuantityBtn.getValue() === '');
        if (batchNumber && this.isBatchNumberValid) {
          this.isBatchNumberValid = true;
        } else {
          this.isBatchNumberValid = false;
        }
        // Adding explicit delay because of parellel validation of qty fields
        setTimeout(this._enableConfirmButton.bind(this), 500);
      },

      _enableConfirmButton: function() {
        var isErrorStateExist = false;
        var oModel = this.getCurrentModel();

        // Call the new batch validation function - AD-006
        var sBatchNumber = oModel.getProperty('/batchNumber');
        if (sBatchNumber) {
          isErrorStateExist = !this._validateBatchSelection();
        }

        var oFormContent = this.getFormControl();
        // validation for initial popup opening
        if (!oFormContent) return;
        for (var k = 0; k < oFormContent.length; k++) {
          if (oFormContent[k].getValueState && oFormContent[k].getValueState() === 'Error') {
            isErrorStateExist = true;
            break;
          }
        }

        var oSaveBtn = this.getCurrentSaveButton();
        var postedBy = oModel.getProperty('/userId');
        var batchNumber = oModel.getProperty('/batchNumber') || oModel.getProperty('/useFullHandlingUnit');
        var bEnabledState = null;
        // Explanation: In the Weighing Screen are two Confirm Buttons so both have to be handled not only one.
        if (oModel.getProperty('/batchManaged')) {
          if (
            this.isBatchNumberValid &&
            batchNumber &&
            this.isQuantityValid &&
            this.isPostedByValid &&
            postedBy &&
            this.isCommentValid &&
            !isErrorStateExist
          ) {
            bEnabledState = true;
          } else {
            bEnabledState = false;
          }
        } else if (!oModel.getProperty('/batchManaged') && oModel.getProperty('/avlBatchQty')) {
          if (this.isQuantityValid && this.isPostedByValid && postedBy && this.isCommentValid && !isErrorStateExist) {
            bEnabledState = true;
          } else {
            bEnabledState = false;
          }
          // relax confirm btn check if component is non batch managed and is a pipeline material
        } else if (!oModel.getProperty('/batchManaged') && oModel.getProperty('/materialType') === 'PIPELINE') {
          if (this.isQuantityValid && this.isPostedByValid && postedBy && this.isCommentValid && !isErrorStateExist) {
            bEnabledState = true;
          } else {
            bEnabledState = false;
          }
        }

        if (bEnabledState !== null) {
          let oSaveBtn = this.getCurrentSaveButton();
          if (oSaveBtn === 'weighing' || oSaveBtn === 'scanWeighing' || oSaveBtn === 'addWeighing') {
            if (bEnabledState) {
              var oFormContent2 = this.oWeighDispenseHandler.getCurrentWeighingForm();
              isErrorStateExist = false;
              for (var k = 0; k < oFormContent2.length; k++) {
                if (oFormContent2[k].getValueState && oFormContent2[k].getValueState() === 'Error') {
                  isErrorStateExist = true;
                  break;
                }
              }
              if (isErrorStateExist) {
                bEnabledState = false;
              }
            }
            this.oWeighDispenseHandler.setWeighingSaveButtons(bEnabledState);
          } else {
            // Normal Button Update
            oSaveBtn.setEnabled(bEnabledState);
          }
        } else if (
          oModel.getProperty('/useFullHandlingUnit') &&
          this.isPostedByValid &&
          postedBy &&
          this.isCommentValid &&
          !isErrorStateExist
        ) {
          oSaveBtn.setEnabled(true);
        } else {
          oSaveBtn.setEnabled(false);
        }
      },
      getCoAndByProductInformation: function(oParameters, sUrl) {
        this.grQtyPromise = jQuery.Deferred();
        oLogger.info('Fetching GR Quantity data');
        this.byId('consumptionList').setBusy(true);
        this.byId('cOBigoodsReceiptList').setBusy(true);
        this.getGRQuantity(oParameters, this.handleCoBiProductData.bind(this));
        this.grQtyPromise
          .done(
            function(sResponse) {
              oLogger.info('Success: Fetched GR Quantity data. Fetching Gi Material Data');
              this.fetchGiMaterialData(sUrl, oParameters);
            }.bind(this)
          )
          .fail(
            function() {
              oLogger.info('Failed to fetch GR Quantity data');
              this.byId('consumptionList').setBusy(false);
              this.byId('cOBigoodsReceiptList').setBusy(false);
            }.bind(this)
          );
      },

      parseCoByProductDisplayData: function(oResponseData, that) {
        var aBiCoProducts = oResponseData.lineItems.filter(function(item) {
          return item.componentType === 'C' || item.componentType === 'B';
        });
        var oAllBiCoProducts = that.getView().getModel('coBiProductSummaryList').getData();
        aBiCoProducts.forEach(function(e, i) {
          var thresholdValuesToBeDisplayed = that.oFormatter.getUpperAndLowerThresholdValues(
            e.recipeComponentToleranceOver,
            e.recipeComponentToleranceUnder,
            e.toleranceOver,
            e.toleranceUnder,
            e.totalQtyEntryUom,
            e.totalQtyBaseUom,
            e.targetQuantity
          );
          var thresholdValuesToBeCalculated = that.oFormatter.getUpperAndLowerThresholdValues(
            e.recipeComponentToleranceOver,
            e.recipeComponentToleranceUnder,
            e.toleranceOver,
            e.toleranceUnder,
            null,
            null,
            e.targetQuantity
          );
          e.upperThresholdValueToBeDisplayed = thresholdValuesToBeDisplayed.upperValue;
          e.lowerThresholdValueToBeDisplayed = thresholdValuesToBeDisplayed.lowerValue;
          e.upperThresholdValue = thresholdValuesToBeCalculated.upperValue;
          e.lowerThresholdValue = thresholdValuesToBeCalculated.lowerValue;
          var materialDetails = that.getProductDetailsByComponentType(oAllBiCoProducts, e.materialId.ref, e.componentType);
          e.targetQuantity = materialDetails[0].targetQuantity;
          e.consumedQuantity = materialDetails[0].receivedQuantity;
        });
        aBiCoProducts && that.getView().getModel('coBiProductModel').setData(aBiCoProducts);
        return aBiCoProducts;
      },
      getGiMaterialData: function(oData) {
        var assemblyUrl = this.getAssemblyDataSourceUri();
        var oParameters = {};
        var order = oData.selectedShopOrder;
        var batchId = oData.selectedSfc;
        var operationActivity = oData.orderSelectionType === 'PROCESS' ? oData.phaseId : oData.operation.operation;
        oParameters.shopOrder = order;
        oParameters.batchId = batchId;
        oParameters.operationActivity = operationActivity;
        oParameters.stepId = oData.stepId;
        if (order) {
          var sUrl = assemblyUrl + 'order/goodsIssue/summary';
          if (this.oPluginConfiguration.showCoByProduct) {
            this.getCoAndByProductInformation(oParameters, sUrl);
          } else {
            this.byId('consumptionList').setBusy(true);
            this.fetchGiMaterialData(sUrl, oParameters);
          }
        }
      },
      handleCoBiProductData: function(oResponseData) {
        var that = this;
        var aCoProducts = oResponseData.lineItems.filter(function(item) {
          return item.type === 'C';
        });
        var aBiProducts = oResponseData.lineItems.filter(function(item) {
          return item.type === 'B';
        });
        that.getView().getModel('coBiProductSummaryList').setData({
          coProducts: aCoProducts,
          biProducts: aBiProducts
        });
        that.grQtyPromise.resolve('Done');
      },
      getGRQuantity: function(oSelectedOrder, oCallBack) {
        var inventoryUrl = this.getInventoryDataSourceUri();
        var oParameters = {};
        oParameters.shopOrder = oSelectedOrder.shopOrder;
        oParameters.sfc = oSelectedOrder.batchId;
        var sUrl = inventoryUrl + 'order/goodsReceipt/summary';
        this.fetchGrData(sUrl, oParameters, oCallBack);
      },
      fetchGrData: function(sUrl, oParameters, oCallBack) {
        var that = this;
        oLogger.info('Requesting GR Quantity data');
        AjaxUtil.get(sUrl, oParameters, oCallBack, function(oError, oHttpErrorMessage) {
          var err = oError ? oError : oHttpErrorMessage;
          that.showErrorMessage(err, true, true);
          that.itemtList = {};
          that.grQtyPromise.reject();
        });
      },

      formatMaterialConsumptionStatus: function(statusKey) {
        if (!statusKey) {
          return '';
        } else {
          return this.getI18nText(statusKey);
        }
      },

      fetchGiMaterialData: async function(sUrl, oParameters) {
        var that = this;
        this.allWorkInstructionsLoaded = false;
        this.allAlternateComponentsLoaded = false;
        var i, lineItem;
        oLogger.info('----->Executing fetchGiMaterialData');

        var oBatchCorrectionInfo = await that._getBatchCorrectionData().catch(oError => {
          return [];
        });

        //If batch correction items exist, then get the items applicable for selected phase
        this.batchCorrItems = [];
        if (oBatchCorrectionInfo && oBatchCorrectionInfo.content && oBatchCorrectionInfo.content.length > 0) {
          var sStepId = this.getPodSelectionModel().selectedPhaseData.stepId;
          this.batchCorrItems = oBatchCorrectionInfo.content.filter(oItem => oItem.phase === sStepId);
        }

        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            that.itemList = oResponseData;
            that.coAndByProducts = [];
            if (that.oPluginConfiguration.showCoByProduct) {
              var aBiCoProducts = that.parseCoByProductDisplayData(oResponseData, that);
            }
            for (i = that.itemList.lineItems.length - 1; i >= 0; i--) {
              if (that.itemList.lineItems[i].componentType === 'B' || that.itemList.lineItems[i].componentType === 'C') {
                lineItem = that.itemList.lineItems.splice(i, 1);
                that.coAndByProducts.push(lineItem[0].materialId.material);
              }
            }

            //Set the GI Model.
            that.giModel = that.giModel || new JSONModel();
            that.giModel.setSizeLimit(that.itemList.lineItems.length);

            //Apply the correction entries
            if (that.batchCorrItems.length > 0) {
              that.itemList.lineItems.forEach(oItem => {
                var oCorrItem = that.batchCorrItems.find(val => val.component === oItem.materialId.material);
                if (!oCorrItem) return;

                // oItem.toleranceOver = oCorrItem.approvedTUpper;
                // oItem.toleranceUnder = oCorrItem.approvedTLower;
                oItem.recipeComponentToleranceOver = oCorrItem.approvedTUpper;
                oItem.recipeComponentToleranceUnder = oCorrItem.approvedTLower;
                oItem.targetQuantity.value = oCorrItem.approvedQuantity;
                oItem.totalQtyEntryUom.value = oCorrItem.approvedQuantity;
                oItem.totalQtyBaseUom.value = oCorrItem.approvedQuantity;
              });
            }

            that.itemList.lineItems.forEach(e => {
              var thresholdValuesToBeDisplayed = that.getUpperAndLowerThresholdValues(
                e.recipeComponentToleranceOver,
                e.recipeComponentToleranceUnder,
                e.toleranceOver,
                e.toleranceUnder,
                e.totalQtyEntryUom,
                e.totalQtyBaseUom,
                e.targetQuantity
              );
              var thresholdValuesToBeCalculated = that.oFormatter.getUpperAndLowerThresholdValues(
                e.recipeComponentToleranceOver,
                e.recipeComponentToleranceUnder,
                e.toleranceOver,
                e.toleranceUnder,
                null,
                null,
                e.targetQuantity
              );
              e.upperThresholdValueToBeDisplayed = thresholdValuesToBeDisplayed.upperValue;
              e.lowerThresholdValueToBeDisplayed = thresholdValuesToBeDisplayed.lowerValue;
              e.upperThresholdValue = thresholdValuesToBeCalculated.upperValue;
              e.lowerThresholdValue = thresholdValuesToBeCalculated.lowerValue;
              e.thresholdValue = { selectedTargetValue: thresholdValuesToBeDisplayed.selectedTargetValue };
              e.showAlternateBomComponents = that.oPluginConfiguration.showAlternateBomComponents ? true : false;
              if (that.oPluginConfiguration.selectActionButtonId) {
                that.findWorkinstructions(e, that.itemList.lineItems.length);
              } else {
                e.showWorkInstructions = false;
              }
              if (that.oPluginConfiguration.showAlternateBomComponents) {
                that.findAlternateBomComponents(e, that.itemList.lineItems.length);
              } else {
                e.showAlternateBomComponents = false;
              }
            });
            // Set the count in the header text
            var title = {
              title: '',
              co_by_title: ''
            };
            that.titleModel = new JSONModel();
            that.titleModel.setSizeLimit(100);
            title.title = that.getI18nText('components') + ' (' + that.itemList.lineItems.length + ')';
            title.co_by_title = aBiCoProducts && that.getI18nText('co-by-title') + ' (' + aBiCoProducts.length + ')';
            that.titleModel.setData(title);
            that.byId('titleText').setModel(that.titleModel, 'testTitle');
            that.byId('cOByTitleText') && that.byId('cOByTitleText').setText(title.co_by_title);

            // Populate the table data
            that.giModel.setData(that.itemList);
            that.byId('consumptionList').setModel(that.giModel);
            that.byId('consumptionList').focus();
            if (
              that.itemList.lineItems.length === 0 ||
              (!that.oPluginConfiguration.selectActionButtonId && !that.oPluginConfiguration.showAlternateBomComponents)
            ) {
              that.byId('consumptionList').setBusy(false);
            }
            that.byId('cOBigoodsReceiptList').setBusy(false);
            var isTabMatched = that.isMatchingTabCriterion();
            // C5278086 Adding changes for W&D Start
            if (
              (that.isWeighingDialogOpen && that.isWeighingDialogOpen === true) ||
              (that.isScanWeighDialogOpen && that.isScanWeighDialogOpen === true) ||
              (that.isAddWeighDialogOpen !== undefined && that.isAddWeighDialogOpen === true)
            ) {
              that._refreshWeighingDialog(oResponseData);
              if (that.currentDialogId) {
                that.byId(that.currentDialogId).setBusy(false);
              }
            }
            // C5278086 Adding changes for W&D End
            if (isTabMatched && that.oPluginConfiguration.autoOpenScanPopup && that.oPluginConfiguration.showScanButton) {
              if (!that.isScanDialogOpen) {
                that.handleOpenScanDialog();
              }
            }

            that._checkBatchCorrectionCondition();
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.itemList = {};
            that.giModel = that.giModel || new JSONModel();
            that.giModel.setData(that.itemList);
            that.byId('consumptionList').setModel(that.giModel);
            that.byId('consumptionList').setBusy(false);
            that.byId('consumptionList').focus();
            that.byId('cOBigoodsReceiptList').setBusy(false);
          }
        );
      },

      findWorkinstructions: function(itemDetails, itemListCount) {
        var that = this;
        var componentRef = itemDetails.materialId.ref;
        var oParameters = {};
        oParameters.material = {
          ref: componentRef
        };
        var sUri = this.getWorkInstructionRestDataSourceUri();
        this.byId('consumptionList').setBusy(true);
        AjaxUtil.post(
          sUri + 'workInstructions/findByNonProductionContext',
          oParameters,
          function(oResponseData) {
            that.workinstructionsLoaded++;
            if (oResponseData && oResponseData.length > 0) {
              itemDetails.showWorkInstructions = true;
              itemDetails.noOfWorkinstructions = oResponseData.length;
            } else {
              itemDetails.showWorkInstructions = false;
            }
            that.giModel.refresh();
            that.closeBusyIndicatorAfterWorkInstructionsLoad(itemListCount);
          },
          function(oError, oHttpErrorMessage) {
            that.workinstructionsLoaded++;
            itemDetails.showWorkInstructions = false;
            that.giModel.refresh();
            that.closeBusyIndicatorAfterWorkInstructionsLoad(itemListCount);
          }
        );
      },

      closeBusyIndicatorAfterWorkInstructionsLoad: function(itemListCount) {
        if (this.workinstructionsLoaded === itemListCount) {
          this.workinstructionsLoaded = 0; //Resetting the value because the next summary load trigger start count again from 0.
          this.allWorkInstructionsLoaded = true;
          if (this.oPluginConfiguration.showAlternateBomComponents) {
            if (this.allAlternateComponentsLoaded) {
              this.byId('consumptionList').setBusy(false);
              this.byId('workInsAndAltBomCompCol').setVisible(true);
            }
          } else {
            this.byId('consumptionList').setBusy(false);
            this.byId('workInsAndAltBomCompCol').setVisible(true);
          }
        }
      },

      findAlternateBomComponents: function(itemDetails, itemListCount) {
        let that = this;
        if (itemDetails.bomComponentRef) {
          let productDataSourceUri = this.getProductDataSourceUri();
          let sUri =
            productDataSourceUri +
            "BomComponents('" +
            encodeURIComponent(itemDetails.bomComponentRef) +
            "')?$select=alternates&$expand=alternates($expand=material($select=ref,material,version,description))";
          this.byId('consumptionList').setBusy(true);
          AjaxUtil.get(
            sUri,
            null,
            function(oResponseData) {
              that.alternateBomComponentsLoaded++;
              if (oResponseData && oResponseData.alternates.length > 0) {
                itemDetails.showAlternateBomComponents = true;
                itemDetails.alternateBoms = oResponseData && oResponseData.alternates;
              } else {
                itemDetails.showAlternateBomComponents = false;
              }
              that.giModel.refresh();
              that.closeBusyIndicatorAfterAlternateComponentsLoad(itemListCount);
            },
            function(oError, oHttpErrorMessage) {
              that.alternateBomComponentsLoaded++;
              itemDetails.showAlternateBomComponents = false;
              that.giModel.refresh();
              that.closeBusyIndicatorAfterAlternateComponentsLoad(itemListCount);
            }
          );
        } else {
          this.alternateBomComponentsLoaded++;
          itemDetails.showAlternateBomComponents = false;
          this.giModel.refresh();
          this.closeBusyIndicatorAfterAlternateComponentsLoad(itemListCount);
        }
      },

      closeBusyIndicatorAfterAlternateComponentsLoad: function(itemListCount) {
        if (this.alternateBomComponentsLoaded === itemListCount) {
          this.alternateBomComponentsLoaded = 0; //Resetting the value because the next summary load should trigger count again from 0.
          this.allAlternateComponentsLoaded = true;
          if (this.oPluginConfiguration.selectActionButtonId) {
            if (this.allWorkInstructionsLoaded) {
              this.byId('consumptionList').setBusy(false);
              this.byId('workInsAndAltBomCompCol').setVisible(true);
            }
          } else {
            this.byId('consumptionList').setBusy(false);
            this.byId('workInsAndAltBomCompCol').setVisible(true);
          }
        }
      },

      getProductDetailsByComponentType: function(oAllBiCoProducts, materialRef, componentType) {
        if (componentType === 'C') {
          return oAllBiCoProducts.coProducts.filter(function(oProduct) {
            return materialRef === oProduct.materialId;
          });
        } else if (componentType === 'B') {
          return oAllBiCoProducts.biProducts.filter(function(oProduct) {
            return materialRef === oProduct.materialId;
          });
        }
      },

      isMatchingTabCriterion: function() {
        var ownerComponent = this.getOwnerComponent();
        if (ownerComponent.getId().indexOf('icontabfilter') !== -1) {
          var selectedKey = ownerComponent.oContainer.getParent().getParent().getSelectedKey() || '';
          if (selectedKey.toLowerCase().includes('materialconsumption')) {
            return true;
          }
          return false;
        }
        return true;
      },

      getParameters: function(oData, rowData) {
        var oParameters = {};
        var order = oData.selectedShopOrder;
        var batchId = oData.selectedSfc;
        var operationActivity = oData.orderSelectionType === 'PROCESS' ? oData.phaseId : oData.operation.operation;
        var bomComponentRef = rowData.bomComponentRef;
        var material = rowData.materialId.material;
        var batchManaged = rowData.batchManaged;
        var isBomComponent = rowData.isBomComponent;
        oParameters.shopOrder = order;
        oParameters.batchId = batchId;
        oParameters.operationActivity = operationActivity;
        oParameters.bomComponentRef = bomComponentRef;
        oParameters.material = material;
        oParameters.isNonBOMComponent = !isBomComponent;
        oParameters.page = this.iCurrentPage;
        oParameters.size = this.iCurrentOffset;
        oParameters.sort = 'createdDateTime,desc';
        return oParameters;
      },

      fetchGiPostingDetails: function(rowData) {
        this.byId('postingsTable').setBusy(true);
        this.iCurrentPage = 1;
        this.iCurrentOffset = 40;
        this.oCurrentRowData = rowData;
        var oData = this.selectedDataInList;
        var oParameters = this.getParameters(oData, rowData);
        var sUrl = this.getAssemblyDataSourceUri() + 'order/goodsIssue/details';
        this.getGiPostings(sUrl, oParameters, rowData.batchManaged);
        let oPostingsCountModel = new JSONModel({ totalCount: (rowData && rowData.assembledAndCanceledComponentsCount) || 0 });
        this.byId('postingsDialog') && this.byId('postingsDialog').setModel(oPostingsCountModel, 'postingsCountModel');
      },

      getGiPostings: function(sUrl, oParameters, batchManaged) {
        var that = this;

        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var oPostingTable = that.byId('postingsTable');
            that.postingsList = { details: oResponseData.content };
            //Show most recent GI posting on the top
            // that.postingsList.sort(function (a, b) {
            //     return new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime();
            // });
            that.postingsList.batchManaged = batchManaged;
            that.oPostingsModel = new JSONModel();
            that.oPostingsModel.setSizeLimit(that.postingsList.details.length);
            that.oPostingsModel.setData(that.postingsList);
            oPostingTable.setModel(that.oPostingsModel, 'postingsModel');
            that.postingsTableColumnLength = that.byId('postingsTable').getColumns().length;
            that.postingColumnListItemLength = that.byId('postingDetailsCLItem').getCells().length;
            that.buildCustomFieldColumns(that.postingsList, that.oPostingsModel);
            oPostingTable.setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.byId('postingsTable').setBusy(false);
            that.postingsList = {};
          }
        );
      },

      fetchMoreGiPostingDetails: function(oEvent) {
        var that = this;
        if (oEvent.getParameter('reason').toLowerCase() === 'growing' && !that.byId('postingsTable').getBusy()) {
          var sUrl = this.getAssemblyDataSourceUri() + 'order/goodsIssue/details';
          this.iCurrentPage++;
          var oParameters = this.getParameters(this.selectedDataInList, this.oCurrentRowData);
          that.byId('postingsTable').setBusy(true);
          AjaxUtil.get(
            sUrl,
            oParameters,
            function(oResponseData) {
              oResponseData.content.forEach(e => that.postingsList.details.push(e));
              var oPostingsModel = that.byId('postingsTable').getOwnModels()['postingsModel'];
              oPostingsModel.setSizeLimit(that.postingsList.details.length);
              oPostingsModel.setData(that.postingsList);
              that.buildCustomFieldColumns(that.postingsList, oPostingsModel);
              that.byId('postingsTable').setBusy(false);
            },
            function(oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.byId('postingsTable').setBusy(false);
            }
          );
        }
      },

      handlePostingsUpdateFinished: function(oEvent) {
        if (oEvent.getParameter('reason').toLowerCase() === 'growing') {
          this.fetchMoreGiPostingDetails(this.oCurrentRowData);
        }
      },

      buildCustomFieldColumns: function(giPostingsData, oPostingsModel) {
        giPostingsData.hasCustomColumn =
          giPostingsData.hasCustomColumn === true
            ? giPostingsData.hasCustomColumn
            : giPostingsData.details.find(item => ![null, undefined, ''].includes(item.customFieldData)) !== undefined;
        giPostingsData.customColumnName = this.oPluginConfiguration.customField1;
        oPostingsModel.updateBindings();
        oPostingsModel.refresh();
        this.getView().byId('postingsTable').rerender();
        /*
            To be used only if the scroll bar does not position properly
            var oPostingsTableScrollDelegate = this.byId("postingsDialog").getScrollDelegate();
            oPostingsTableScrollDelegate.scrollTo(0, oPostingsTableScrollDelegate.getScrollHeight()/2);
             */

        /*
            Previous logic. This logic creates a new column dynamically and add to the table.
            But in case of paginated data load this did not work. Also, has a side-effect of
            adding and additional Custom data column everytime the popup is opened.
            Kept commented, to use in case the pagination has to be removed and old logic has to be put back.
            var customFieldColumns = [];
            var oTable = this.getView().byId("postingsTable");
            var oColumnListItem = this.getView().byId("postingDetailsCLItem");
            var iStartIndex = 0;
            if(this.iCurrentPage > 0){
                iStartIndex = this.iCurrentPage * this.iCurrentOffset;
            }
            for (var i = iStartIndex; i < giPostingsData.length; i++) {
                if (giPostingsData[i].customFieldData) {
                    var customFieldJson = JSON.parse(giPostingsData[i].customFieldData);
                    for (var j = 0; j < customFieldJson.length; j++) {
                        var position = customFieldJson[j].id.slice(-1);
                        giPostingsData[i]["customFieldValue" + position] = customFieldJson[j].value;
                        if (!Object.values(customFieldColumns).includes(customFieldJson[j].id)) {
                            customFieldColumns.push(customFieldJson[j].id);
                        }
                    }
                }
            }
            customFieldColumns.sort();
            for (var k = 0; k < customFieldColumns.length; k++) {
                if (this.oPluginConfiguration && this.oPluginConfiguration[customFieldColumns[k]]) {
                    var customFieldValue = "customFieldValue" + customFieldColumns[k].slice(-1);
	@@ -2469,14 +2527,26 @@ sap.ui.define([
                        hAlign: "Center",
                        vAlign: "Middle"
                    });
                    if (!this.bCustomColumnAdded) {
                        //Do this only once
                        var oHeaderCustomField = new sap.m.Text({
                            text: this.oPluginConfiguration[customFieldColumns[k]]
                        });
                        oColumnCustomField.setHeader(oHeaderCustomField);
                        oTable.addColumn(oColumnCustomField);
                        this.bCustomColumnAdded = true;
                    }
                }
            }
            if(iStartIndex === 0) {
                oTable.bindItems("postingsModel>/", oColumnListItem, null, null);
            } else{
                var oPostingsModel = oTable.getOwnModels()["postingsModel"];
                oPostingsModel.updateBindings();
                oPostingsModel.refresh();
            }
             */
      },

      updateInventoryStock: function() {
        const oCurrentModel = this.getView().getModel('weighingModel');
        let sDefaultBatchId = oCurrentModel.getProperty('/batchNumber'),
          bIsBatchManaged = oCurrentModel.getProperty('/batchManaged'),
          sStorageLocation = oCurrentModel.getProperty('/storageLocation'),
          sStorageLocationRef = oCurrentModel.getProperty('/storageLocationRef'),
          sSelectedMaterialRef = oCurrentModel.getProperty('/materialRef'),
          sSelectedMaterial = oCurrentModel.getProperty('/material');
        this.getInventoryStockData(
          sDefaultBatchId,
          bIsBatchManaged,
          sStorageLocation,
          sStorageLocationRef,
          sSelectedMaterialRef,
          sSelectedMaterial
        );
      },

      postGiData: function(sUrl, oRequestData) {
        var that = this;
        AjaxUtil.post(
          sUrl,
          oRequestData,
          function(oResponseData) {
            //that.byId(that.currentDialogId).setBusy(false);
            // C5278086 Adding changes for W&D Start
            if (
              (that.isWeighingDialogOpen && that.isWeighingDialogOpen === true) ||
              (that.isScanWeighDialogOpen && that.isScanWeighDialogOpen === true) ||
              (that.isAddWeighDialogOpen !== undefined && that.isAddWeighDialogOpen === true)
            ) {
              if (that.sPopupClosingMethod !== 'AddWeight') {
                that.oWeighDispenseHandler.closeWeighingDialog();
              } else if (
                that.getCurrentModel() &&
                that.getCurrentModel().getProperty('/batchManaged') &&
                that.getCurrentModel().getProperty('/batchManaged') === true
              ) {
                that.openBatchClearPopup(oResponseData);
                that.updateInventoryStock();
              } else {
                that.updateInventoryStock();
              }
              that.sPopupClosingMethod = '';
            } else {
              that.byId(that.currentDialogId).setBusy(false);
            }
            // C5278086 Adding changes for W&D End
            if (that.isScanDialogOpen && that.isScanDialogOpen === true) that.onCancelScanDialog();
            if (that.isAddDialogOpen && that.isAddDialogOpen === true) that.onCancelAddDialog();
            if (that.isConsumeDialogOpen && that.isConsumeDialogOpen === true) that.onCancelConsumeDialog();
            MessageToast.show(that.getI18nText('GI_POST_SUCCESS'));
            that.getGiMaterialData(that.selectedDataInList);
          },
          function(oError, oHttpErrorMessage) {
            var oModel = that.getCurrentModel();
            var postedDateTime = oModel.getProperty('/dateTime').replace(' 00:00:00', '');
            oModel.setProperty('/dateTime', postedDateTime);
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err);
            that.byId(that.currentDialogId).setBusy(false);
            that.currentSaveBtn.setEnabled(true);
            // C5278086 Adding changes for W&D Start
            var oSaveBtn = that.getCurrentSaveButton();
            if (oSaveBtn === 'weighing' || oSaveBtn === 'scanWeighing' || oSaveBtn === 'addWeighing') {
              that.oWeighDispenseHandler.setWeighingSaveButtons(true);
            } else {
              // Normal Button Update
              oSaveBtn.setEnabled(true);
            }
            // C5278086 Adding changes for W&D End
          }
        );
      },

      getAlternateUoms: function(alternateUomForSelectedMaterial, material, materialRef, version, sFlag) {
        var that = this;
        this.byId('consumptionList').setBusy(true);
        this.fetchAlternateUoms(alternateUomForSelectedMaterial, material, materialRef, version, sFlag);
      },

      fetchAlternateUoms: function(alternateUomForSelectedMaterial, material, materialRef, version, sFlag) {
        let that = this;
        let url = that.getProductRestDataSourceUri() + 'materials/uoms';
        let oParameters = { material: material, version: version };
        AjaxUtil.get(
          url,
          oParameters,
          function(oResponseData) {
            alternateUomForSelectedMaterial[material] = oResponseData;
            if (alternateUomForSelectedMaterial[material].length > 0) {
              that.getConversionDetailsForUoms(alternateUomForSelectedMaterial, material, materialRef);
            }
            that.alternateUomsModel.setData(alternateUomForSelectedMaterial[material]);
            that.getView().setModel(that.alternateUomsModel, 'unitModel');
            that.byId('consumptionList').setBusy(false);
            if (sFlag && sFlag === 'consume') {
              that.checkMaterialEWMManaged(materialRef);
            }
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.byId('consumptionList').setBusy(false);
          }
        );
      },

      getConversionDetailsForUoms: function(alternateUomForSelectedMaterial, material, materialRef) {
        let that = this;
        let url =
          that.getProductDataSourceUri() +
          "Materials('" +
          encodeURIComponent(materialRef) +
          "')?$select=alternateUnitsOfMeasure&$expand=alternateUnitsOfMeasure($select=ref,uom,numerator,denominator)";
        let oParameters = {};
        var allUoms, i, j;
        AjaxUtil.get(
          url,
          oParameters,
          function(oResponseData) {
            allUoms = oResponseData.alternateUnitsOfMeasure;
            for (i = 0; i < alternateUomForSelectedMaterial[material].length; i++) {
              alternateUomForSelectedMaterial[material][i].numerator = 1;
              alternateUomForSelectedMaterial[material][i].denominator = 1;
              for (j = 0; j < allUoms.length; j++) {
                if (alternateUomForSelectedMaterial[material][i].uom === allUoms[j].uom) {
                  alternateUomForSelectedMaterial[material][i].numerator = allUoms[j].numerator;
                  alternateUomForSelectedMaterial[material][i].denominator = allUoms[j].denominator;
                  break;
                }
              }
            }
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
            that.byId('consumptionList').setBusy(false);
          }
        );
      },

      //handleOpenAddDialog: function() {
      handleOpenAddDialog: function() {
        var oView = this.getView();
        //  Extend WeighingScreen
        var sWorkcenter = oView.getModel('WorkcenterInfo').getProperty('/workcenter');
        var oWeighweighRelevantFlag = oView.getModel('authModel').getProperty('/weighRelevant');

        if (!this._validatePhaseStatus()) {
          MessageBox.error(this.getI18nText('phaseNotInActiveStatusErrMsg', [this.selectedDataInList.truncatedPhaseId]));
          return;
        }

        if (sWorkcenter !== undefined) {
          if (!oWeighweighRelevantFlag) {
            this.openAddDialog();
          } else {
            this.openWeighingAddDialog();
          }
        } else {
          this.openAddDialog();
        }
        //  Extend WeighingScreen
      },

      openAddDialog: function() {
        this.isAddDialogOpen = true;
        var oView = this.getView();
        var loggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';

        if (!this.byId('addDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.AddMaterial',
            controller: this
          }).then(
            function(oDialog) {
              oDialog.setEscapeHandler(
                function(oPromise) {
                  this.onCancelAddDialog();
                  oPromise.resolve();
                }.bind(this)
              );
              this.resetModel(oView.getModel('addModel'));
              oView.addDependent(oDialog);
              oDialog.open();
              this.byId('inputPostedByAdd').setValue(loggedInUser);
              this.byId('inputPostingDateAdd').setValue(this.getCurrentDateInPlantTimeZone());
              this.buildCustomFieldFormContent();
            }.bind(this)
          );
        } else {
          this.resetModel(oView.getModel('addModel'));
          this.byId('addDialog').open();
          this.byId('inputPostedByAdd').setValue(loggedInUser);
          this.byId('inputPostingDateAdd').setValue(this.getCurrentDateInPlantTimeZone());
          this.buildCustomFieldFormContent();
        }
      },

      onCancelAddDialog: function() {
        this.resetFieldVerificationFlags();
        this.resetAddDialogFields();
        this.isAddDialogOpen = false;
        var oFormLength = this.byId('addMaterialForm').getContent().length;
        // Fix to handle cancel dialog Add
        for (var i = oFormLength; i > 19; i--) {
          this.byId('addMaterialForm').getContent()[i - 1].destroy();
        }
        this.byId('storageLocationAdd').setEnabled(false);
        this.getView().byId('addDialog').close();
      },

      //handleOpenScanDialog: function() {
      handleOpenScanDialog: function() {
        var oView = this.getView();
        //  Extend WeighingScreen
        var sWorkcenter = oView.getModel('WorkcenterInfo').getProperty('/workcenter');
        var oWeighweighRelevantFlag = oView.getModel('authModel').getProperty('/weighRelevant');

        if (!this._validatePhaseStatus()) {
          MessageBox.error(this.getI18nText('phaseNotInActiveStatusErrMsg', [this.selectedDataInList.truncatedPhaseId]));
          return;
        }

        if (sWorkcenter !== undefined) {
          if (!oWeighweighRelevantFlag) {
            this.openScanDialog();
          } else {
            this.openWeighingScanDialog();
          }
        } else {
          this.openScanDialog();
        }
        //  Extend WeighingScreen
      },

      openScanDialog: function() {
        var oView = this.getView();
        this.isScanDialogOpen = true;
        // create dialog lazily
        if (!this.byId('scanDialog')) {
          // load asynchronous XML fragment
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.ScannerDialog',
            controller: this
          }).then(
            function(oDialog) {
              // connect dialog to the root view of this component (models, lifecycle)
              oDialog.setEscapeHandler(
                function(oPromise) {
                  this.onCancelScanDialog();
                  oPromise.resolve();
                }.bind(this)
              );
              this.setDetailedModel();
              oView.addDependent(oDialog);
              oDialog.open();
              this.byId('inputPostingDateScan').setValue(this.getCurrentDateInPlantTimeZone());
              this.buildCustomFieldFormContent();
              setTimeout(
                function() {
                  this.byId('inputMatNumScan').focus();
                }.bind(this),
                300
              );
            }.bind(this)
          );
        } else {
          this.setDetailedModel();
          this.byId('scanDialog').open();
          this.byId('inputPostingDateScan').setValue(this.getCurrentDateInPlantTimeZone());
          this.buildCustomFieldFormContent();
          setTimeout(
            function() {
              this.byId('inputMatNumScan').focus();
            }.bind(this),
            300
          );
        }
      },

      setDetailedModel: function() {
        var oView = this.getView();
        var oModel = this.getCurrentModel();
        this.resetModel(oModel);
        var sLoggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';
        oModel.setProperty('/userId', sLoggedInUser);
        if (sLoggedInUser) {
          this.isPostedByValid = true;
        } else {
          this.isPostedByValid = false;
        }
        this.focusMaterialInput();
      },

      onBatchLiveChange: function(oEvent) {
        if (this.isInventoryManaged) {
          var flag = oEvent.getParameters().value === '';
          this.getCurrentCancelButton().setEnabled(flag);
          //  Extend WeighingScreen
          var oBtnCancel = this.getCurrentCancelButton();
          if ((oBtnCancel !== 'weighing' && oBtnCancel !== 'scanWeighing') || oSaveBtn === 'addWeighing') oBtnCancel.setEnabled(flag);
          //  Extend WeighingScreen
        }
      },

      onBatchChange: function() {
        var sCurrentDialogId = this.getCurrentDialogId();
        this.byId(sCurrentDialogId).setBusy(true);
        var oBatchIdControl = this.getCurrentInputBatchIdControl();
        var oModel = this.getCurrentModel();
        var sBatchId = oBatchIdControl.getValue() || '';
        this.isFreeText = true;
        if (sBatchId === '' || !this.validateInputRegEx(sBatchId)) {
          oModel.setProperty('/avlBatchQty', '');
          oModel.setProperty('/expDate', '');
          oModel.setProperty('/batchNumber', '');
          oModel.setProperty('/storageLocation', '');
          oModel.setProperty('/storageLocationDesc', '');
          oModel.setProperty('/storageLocationRef', '');
          oModel.setProperty('/shopOrderLocationRef', '');
          oModel.setProperty('/inventory', '');
          this.isBatchNumberValid = false;
          this._enableConfirmButton();
          this.byId(sCurrentDialogId).setBusy(false);
          if (!this.validateInputRegEx(sBatchId) && this.getCurrentDialogId() !== 'none') {
            this.showErrorMessage(this.getI18nText('REQUIRED_BATCH_INPUT'));
          }
        } else {
          if (this.isInventoryManaged) {
            var sMaterialRef = oModel.getProperty('/materialRef');
            var sStorageLocRef = oModel.getProperty('/storageLocationRef');
            this.prepareInventoryUrl(sMaterialRef, sBatchId, sStorageLocRef, sCurrentDialogId, true);
            //  Extend WeighingScreen
            if (
              (this.isWeighingDialogOpen !== undefined && this.isWeighingDialogOpen === true) ||
              (this.isScanWeighDialogOpen !== undefined && this.isScanWeighDialogOpen === true) ||
              (this.isAddWeighDialogOpen !== undefined && this.isAddWeighDialogOpen === true)
            ) {
              if (this.isBatchNumberValid) {
                this.weighingBatchChanged();
              }
            }
            //  Extend WeighingScreen
          } else {
            this.isBatchNumberValid = true;
            var sMaterial = oModel.getProperty('/material');
            var sStorageLoc = oModel.getProperty('/storageLocation');
            this.getStockForDefaults(sMaterial, sStorageLoc, sBatchId, sCurrentDialogId);
          }
        }
        setTimeout(
          function() {
            //this.getCurrentCancelButton().setEnabled(true)
            //  Extend WeighingScreen
            var oBtnCancel = this.getCurrentCancelButton();
            if ((oBtnCancel !== 'weighing' && oBtnCancel !== 'scanWeighing') || oBtnCancel === 'addWeighing') oBtnCancel.setEnabled(true);
            //  Extend WeighingScreen
          }.bind(this),
          500
        );
      },

      validateMaterialInputRegEx: function(sInputValue) {
        //Regex for Valid Characters
        const regex = /^[A-Z0-9)(\/_@~#+.!$*=^\- ]+$/;
        let isValidInput = true;
        if (sInputValue) {
          if (!sInputValue.match(regex)) {
            isValidInput = false;
          }
        }
        return isValidInput;
      },

      validateInputRegEx: function(sInputValue) {
        //Regex for Valid Characters
        var regex = /^[A-Za-z0-9_@\-. ]+$/;
        var isValidInput = true;
        if (sInputValue) {
          if (!sInputValue.match(regex)) {
            isValidInput = false;
          }
        }
        return isValidInput;
      },

      handleLiveChangeScan: async function(oEvent) {
        var that = this;
        var flag = true;
        //  Extend WeighingScreen
        var oView = this.getView();
        var sCurrentDialogId = this.getCurrentDialogId();
        var oCurrentDialog = oView.byId(sCurrentDialogId);
        oCurrentDialog.setBusy(true);
        //  Extend WeighingScreen
        //that.byId("scanDialog").setBusy(true);
        //var scannedMat = that.byId("inputMatNumScan").getValue();

        var scannedMat = that.getCurrentInputMaterialControl().getValue();
        var oDialogSelected = this.getCurrentDialogId();
        var scannedMatDetails;
        var oMaterialInput = that.getCurrentInputMaterialControl();

        // if (!(scannedMat instanceof Object)) {
        //   var oMaterial = await this._getMaterialForEAN(scannedMat);
        //   oMaterialInput.setValue(oMaterial.material);
        // }

        // //QR code scan for material
        // try {
        //   var oMatParsed = JSON.parse(oMaterialInput.getValue());
        //   scannedMat = oMatParsed.Material;
        //   oMaterialInput.setValue(scannedMat);
        //   this.scannedMaterial = oMatParsed;
        // } catch (e) {}

        var oScannedValue;
        //Try to parse the scanned value to get JSON
        try {
          oScannedValue = JSON.parse(oMaterialInput.getValue());
        } catch (e) {}

        //If scanned value is JSON and not a number, extract material details
        //else scanned value is vendor material. Perform EAN to material conversion
        if (oScannedValue && isNaN(oScannedValue)) {
          scannedMat = oScannedValue.Material;
          oMaterialInput.setValue(scannedMat);
          this.scannedMaterial = oScannedValue;
        } else {
          this.scannedMaterial = {};
          var oMaterial = await this._getMaterialForEAN(scannedMat).catch((e)=>{});
          if(!oMaterial){
            this.showErrorMessage(that.getI18nText('INVALID_MATERIAL'));
            oMaterialInput.setValue('');
            oCurrentDialog.setBusy(false);
            return;
          }
          oMaterialInput.setValue(oMaterial.material);
          scannedMat = oMaterial.material;
        }

        if (!that.validateMaterialInputRegEx(scannedMat)) {
          flag = false;
          scannedMatDetails = {};
          that.setDetailedModel();
          if (that.getCurrentDialogId() !== 'none') {
            that.showErrorMessage(that.getI18nText('INVALID_MATERIAL'));
          }
          setTimeout(
            function() {
              that.byId('inputMatNumScan').focus();
            }.bind(that),
            300
          );
          that.byId(oDialogSelected).setBusy(false);
        } else if (that.coAndByProducts.length > 0) {
          that.coAndByProducts.forEach(function(e) {
            if (e === scannedMat) {
              flag = false;
              scannedMatDetails = {};
              that.setDetailedModel();
              that.showErrorMessage(that.getI18nText('consumeWarningForCoBy'));
              setTimeout(
                function() {
                  that.byId('inputMatNumScan').focus();
                }.bind(that),
                300
              );
              that.byId(oDialogSelected).setBusy(false);
            }
          });
        }
        if (flag) {
          let sUrl = that.getProductDataSourceUri() + "Materials?$filter=material eq '" + encodeURIComponent(scannedMat) + "'";
          let oParameters = {};
          AjaxUtil.get(
            sUrl,
            oParameters,
            function(oResponseData) {
              if (oResponseData.value.length === 0) {
                scannedMatDetails = {};
                that.setDetailedModel();
                if (that.getCurrentDialogId() !== 'none') {
                  that.showErrorMessage(that.getI18nText('INVALID_MATERIAL'));
                }
                setTimeout(
                  function() {
                    that.byId('inputMatNumScan').focus();
                  }.bind(that),
                  300
                );
              } else {
                for (var i = 0; i < oResponseData.value.length; i++) {
                  if (oResponseData.value[i].currentVersion) {
                    scannedMatDetails = oResponseData.value[i];
                    break;
                  }
                }
                if (!scannedMatDetails) {
                  scannedMatDetails = {};
                  that.setDetailedModel();
                  if (that.getCurrentDialogId() !== 'none') {
                    that.showErrorMessage(that.getI18nText('INVALID_MATERIAL'));
                  }
                  setTimeout(
                    function() {
                      that.byId('inputMatNumScan').focus();
                    }.bind(that),
                    300
                  );
                } else {
                  that.setPostMaterialSelectionDetails(scannedMatDetails, that.getView().getModel('scanModel'), oDialogSelected);
                }
              }
              that.byId(oDialogSelected).setBusy(false);
            },
            function(oError, oHttpErrorMessage) {
              that.byId(oDialogSelected).setBusy(false);
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.batchDetailsList = {};
            }
          );
        }
      },

      setPostMaterialSelectionDetails: function(oMaterial, oModel, sDialogId) {
        var selectedMaterial = oMaterial.material;
        var selectedMaterialRef = oMaterial.ref;
        var selectedMaterialDesc = oMaterial.description;
        var selectedMaterialVersion = oMaterial.version;
        var selectedMaterialType = oMaterial.materialType;
        var baseUoM = oMaterial.unitOfMeasure;

        //check if BOM component or not
        var i, bomItem;
        var isBOM = false;
        for (i = 0; i < this.itemList.lineItems.length; i++) {
          if (this.itemList.lineItems[i].materialId.ref === selectedMaterialRef && this.itemList.lineItems[i].isBomComponent === true) {
            isBOM = true;
            bomItem = this.itemList.lineItems[i];
            break;
          }
        }

        var bomComponentRef, storageLocationRef, storageLocation, isBatchManaged, defaultBatchId, oRemainingQuantity, selectedUom;
        var loggedInUser = this.loggedInUserDetails ? this.loggedInUserDetails.userId : '';
        if (isBOM === true) {
          bomComponentRef = bomItem.bomComponentRef;
          storageLocationRef = (bomItem.storageLocation && bomItem.storageLocation.ref) || '';
          storageLocation = (bomItem.storageLocation && bomItem.storageLocation.storageLocation) || '';
          isBatchManaged = bomItem.batchManaged === undefined || bomItem.batchManaged === 'NONE' ? false : true;

          var oCalculatableQuantities = this.determineTargetAndConsumedQty(bomItem);
          var consumedQuantity =
            oCalculatableQuantities && oCalculatableQuantities.consumedQuantity && oCalculatableQuantities.consumedQuantity.value
              ? oCalculatableQuantities.consumedQuantity.value
              : 0;
          var targetQuantity =
            oCalculatableQuantities && oCalculatableQuantities.targetQuantity && oCalculatableQuantities.targetQuantity.value
              ? oCalculatableQuantities.targetQuantity.value
              : 0;
          oRemainingQuantity = consumedQuantity < targetQuantity ? targetQuantity - consumedQuantity : '';
          //  Extend WeighingScreen
          var oInStorageLocation = this.getCurrentStorageLocationInput();
          if (isBatchManaged) {
            if (this.scannedMaterial && this.scannedMaterial.StockID) {
              defaultBatchId = this.scannedMaterial.StockID;
            } else {
              defaultBatchId = bomItem.plannedBatchNumber || '';
            }
            oInStorageLocation.setEnabled(false);
          } else {
            defaultBatchId = this.getI18nText('notBatchManaged');
            if (selectedMaterialType !== 'PIPELINE') {
              oInStorageLocation.setEnabled(true);
            } else {
              oInStorageLocation.setEnabled(false);
            }
          }
          //  Extend WeighingScreen
          // selectedUom = baseUoM;
          selectedUom = oCalculatableQuantities.targetQuantity.uom.internalUom || oCalculatableQuantities.targetQuantity.uom.uom;
          this.consumedQuantityForSelectedMaterial = bomItem.consumedQuantity.value;
          this.upperThresholdForSelectedMaterial = {
            value: bomItem.upperThresholdValueToBeDisplayed,
            uom: selectedUom
          };
        } else {
          bomComponentRef = null;
          storageLocationRef = oMaterial.productionStorageLocation ? oMaterial.productionStorageLocation.ref : '';
          storageLocation = oMaterial.productionStorageLocation ? oMaterial.productionStorageLocation.storageLocation : '';
          isBatchManaged = oMaterial.incrementBatchNumber === undefined || oMaterial.incrementBatchNumber === 'NONE' ? false : true;
          oRemainingQuantity = '';
          //  Extend WeighingScreen
          var oCurrentStorageLocationInput = this.getCurrentStorageLocationInput();
          //  Extend WeighingScreen
          if (isBatchManaged) {
            defaultBatchId = '';
            //  Extend WeighingScreen
            oCurrentStorageLocationInput.setEnabled(false);
            //  Extend WeighingScreen
          } else {
            defaultBatchId = this.getI18nText('notBatchManaged');
            if (selectedMaterialType !== 'PIPELINE') {
              //  Extend WeighingScreen
              oCurrentStorageLocationInput.setEnabled(true);
              //  Extend WeighingScreen
            } else {
              //  Extend WeighingScreen
              oCurrentStorageLocationInput.setEnabled(false);
              //  Extend WeighingScreen
            }
          }
          selectedUom = baseUoM;
          this.consumedQuantityForSelectedMaterial = undefined;
          this.upperThresholdForSelectedMaterial = undefined;
        }

        // Set the default values
        oModel.setProperty('/shopOrder', this.selectedDataInList.selectedShopOrder);
        if (this.selectedDataInList.orderSelectionType === 'PROCESS')
          oModel.setProperty('/operationActivity', this.selectedDataInList.phaseId);
        else oModel.setProperty('/operationActivity', this.selectedDataInList.operation.operation);
        oModel.setProperty('/bomComponentRef', bomComponentRef);
        oModel.setProperty('/batchId', this.selectedDataInList.selectedSfc);
        oModel.setProperty('/material', selectedMaterial);
        oModel.setProperty('/materialDescription', selectedMaterialDesc);
        oModel.setProperty('/materialType', selectedMaterialType);
        oModel.setProperty('/batchNumber', defaultBatchId);
        oModel.setProperty('/workCenter', this.selectedDataInList.workCenter.workcenter);
        oModel.setProperty('/quantity/value', this.oFormatter.formatNumberWithThreeDecimals(oRemainingQuantity));
        oModel.setProperty('/quantity/unitOfMeasure/uom', selectedUom);
        oModel.setProperty('/userId', loggedInUser);
        if (loggedInUser) {
          this.isPostedByValid = true;
        } else {
          this.isPostedByValid = false;
        }
        oModel.setProperty('/batchManaged', isBatchManaged);
        oModel.setProperty('/storageLocation', storageLocation);
        oModel.setProperty('/storageLocationRef', storageLocationRef);
        oModel.setProperty('/materialRef', selectedMaterialRef);
        oModel.setProperty('/isBomComponent', isBOM);
        oModel.setProperty('/avlBatchQty', '');
        oModel.setProperty('/expDate', '');
        oModel.setProperty('/inventory', '');
        if (sDialogId !== 'scanWeighDialog' && sDialogId !== 'addWeighDialog') {
          this.onQuantityLiveChange();
        } else {
          this.isQuantityValid = false;
        }

        // UOM Model
        if (!this.alternateUomForSelectedMaterial.hasOwnProperty(selectedMaterial)) {
          this.getAlternateUoms(this.alternateUomForSelectedMaterial, selectedMaterial, selectedMaterialRef, selectedMaterialVersion);
        } else {
          this.alternateUomsModel.setData(this.alternateUomForSelectedMaterial[selectedMaterial]);
          this.getView().setModel(this.alternateUomsModel, 'unitModel');
        }

        if (
          this.isInventoryManaged &&
          ((defaultBatchId && defaultBatchId !== this.getI18nText('notBatchManaged')) ||
            (!isBatchManaged && storageLocation && storageLocationRef))
        ) {
          this.prepareInventoryUrl(selectedMaterialRef, defaultBatchId, storageLocationRef, sDialogId, false);
        }

        //  Extend WeighingScreen
        if (sDialogId === 'scanWeighDialog' || sDialogId === 'addWeighDialog') {
          // Quantity Info
          var dConsumedQuantity = bomItem !== undefined ? (bomItem.consumedQuantity.value ? bomItem.consumedQuantity.value : 0) : 0;
          // C5278086 CHanges for Traget Quantity.
          var dTargetQuantity =
            bomItem !== undefined
              ? this.oFormatter.getValidQty(bomItem.totalQtyEntryUom, bomItem.totalQtyBaseUom, bomItem.targetQuantity)
              : 0;
          //var dTargetQuantity = (bomItem !== undefined) ?  (bomItem.targetQuantity.value) ? bomItem.targetQuantity.value : 0 : 0;
          this.consumedQuantityForSelectedMaterial = dConsumedQuantity;
          this.targetQuantityForSelectedMaterial = dTargetQuantity.value;

          //Material Tolerance
          var dUpperMaterialThresholdValue = bomItem !== undefined ? (bomItem.upperThresholdValue ? bomItem.upperThresholdValue : 0) : 0;
          var dLowerMaterialThresholdValue = bomItem !== undefined ? (bomItem.lowerThresholdValue ? bomItem.lowerThresholdValue : 0) : 0;
          this.upperThresholdForSelectedMaterial = dUpperMaterialThresholdValue;
          //Weighing Popup
          var dComponentToleranceOver =
            bomItem !== undefined ? (bomItem.recipeComponentToleranceOver ? bomItem.recipeComponentToleranceOver : 0) : 0;
          var dComponentToleranceUnder =
            bomItem !== undefined ? (bomItem.recipeComponentToleranceUnder ? bomItem.recipeComponentToleranceUnder : 0) : 0;
          oModel.setProperty('/tolerance', {
            upper: dComponentToleranceOver,
            upperThresholdValue: dUpperMaterialThresholdValue,
            lower: dComponentToleranceUnder,
            lowerThresholdValue: dLowerMaterialThresholdValue
          });

          var oConsumedQtyInfo = null,
            oTargetQtyInfo = null;
          if (bomItem !== undefined) {
            oConsumedQtyInfo = JSON.parse(JSON.stringify(bomItem.consumedQuantity));
            oTargetQtyInfo = JSON.parse(JSON.stringify(bomItem.targetQuantity));
          } else {
            oConsumedQtyInfo = {
              value: 0,
              unitOfMeasure: {
                internalUom: baseUoM,
                longText: null,
                shortText: null,
                uom: baseUoM
              }
            };
            oTargetQtyInfo = {
              value: 0,
              unitOfMeasure: {
                internalUom: baseUoM,
                longText: null,
                shortText: null,
                uom: baseUoM
              }
            };
          }
          oModel.setProperty('/TargetQuantity', oTargetQtyInfo);
          oModel.setProperty('/ConsumedQuantity', oConsumedQtyInfo);

          this.getWorkCenters();
          this.sScaleUnitOfMeasure = selectedUom;
        }
        //  Extend WeighingScreen
        //}
        //this._enableDisableCalculation();
      },

      onCancelScanDialog: function() {
        this.resetFieldVerificationFlags();
        this.resetScanDialogFields();
        this.isScanDialogOpen = false;
        var oFormLength = this.byId('scanMaterialForm').getContent().length;
        // Fix to handle cancel dialog scan
        for (var i = oFormLength; i > 19; i--) {
          this.byId('scanMaterialForm').getContent()[i - 1].destroy();
        }
        this.byId('storageLocationScan').setEnabled(false);
        this.byId('scanDialog').close();
      },

      resetFieldVerificationFlags: function() {
        this.isBatchNumberValid = false;
        this.isPostedByValid = false;
      },

      resetScanDialogFields: function() {
        this.byId('inputMatNumScan').setValue('');
        this.byId('inputMatDescScan').setText('');
        this.byId('inputBatchIdScan').setValue('');
        this.byId('storageLocationScan').setValue('');
        this.byId('avlQtyScan').setText('');
        this.byId('inputQuantityScan').setValue('');
        this.byId('inputUnitScan').setValue('');
        this.byId('inputPostedByScan').setValue('');
        this.byId('inputPostingDateScan').setValue('');
        this.byId('inputCommentsForScan').setValue('');
        this.customFieldJson = [];

        this.byId('giConfirmBtnScan').setEnabled(false);

        ErrorHandler.clearErrorState(this.byId('inputQuantityScan'));
        ErrorHandler.clearErrorState(this.byId('inputBatchIdScan'));
        ErrorHandler.clearErrorState(this.byId('inputPostedByScan'));
        ErrorHandler.clearErrorState(this.byId('inputPostingDateScan'));
        ErrorHandler.clearErrorState(this.byId('inputCommentsForScan'));
      },

      onConfirmandNext: function() {
        this.resetScanDialogFields();
      },

      resetModel: function(oModel) {
        var oView = this.getView();
        oModel.setProperty('/shopOrder', this.selectedDataInList.selectedShopOrder);
        if (this.selectedDataInList.orderSelectionType === 'PROCESS')
          oModel.setProperty('/operationActivity', this.selectedDataInList.phaseId);
        else oModel.setProperty('/operationActivity', this.selectedDataInList.operation.operation);
        oModel.setProperty('/bomComponentRef', '');
        oModel.setProperty('/batchId', this.selectedDataInList.selectedSfc);
        oModel.setProperty('/material', '');
        oModel.setProperty('/materialDescription', '');
        if (oView.getModel('consumeModel') === oModel) {
          oModel.setProperty('/batchNumber', this.getI18nText('notBatchManaged'));
          oModel.setProperty('/batchManaged', false);
          oModel.setProperty('/calculatedData', null);
        } else {
          oModel.setProperty('/batchNumber', '');
          oModel.setProperty('/batchManaged', true);
        }
        oModel.setProperty('/workCenter', this.selectedDataInList.workCenter.workcenter);
        oModel.setProperty('/avlBatchQty', '');
        oModel.setProperty('/quantity/value', '');
        oModel.setProperty('/quantity/unitOfMeasure/uom', '');
        oModel.setProperty('/quantity/unitOfMeasure/internalUom', '');
        oModel.setProperty('/userId', '');
        oModel.setProperty('/storageLocation', '');
        oModel.setProperty('/storageLocationDesc', '');
        oModel.setProperty('/storageLocationRef', '');
        oModel.setProperty('/materialRef', '');
        oModel.setProperty('/isBomComponent', true);
        oModel.setProperty('/comments', '');
        if (oView.getModel('unitModel')) {
          oView.getModel('unitModel').setData([]);
        }
      },

      onMaterialBrowse: function(oEvent) {
        var oMaterialNoField = oEvent.getSource();
        var flag = true;
        var oController = this;
        MaterialBrowse.open(oMaterialNoField, oMaterialNoField.getValue(), function(oSelectedObject) {
          if (oController.coAndByProducts.length > 0) {
            oController.coAndByProducts.forEach(function(e) {
              if (e === oSelectedObject.material) {
                flag = false;
                oMaterialNoField.setValue('');
                oController.showErrorMessage(oController.getI18nText('consumeWarningForCoBy'));
              }
            });
          }
          if (flag) {
            oMaterialNoField.setValue(oSelectedObject.material);
            //oController.setPostMaterialSelectionDetails(oSelectedObject, oController.getView().getModel("addModel"), "addDialog");
            //  Extend WeighingScreen
            var sCurrentDialogID = oController.getCurrentDialogId();
            var oCurrentModel = oController.getCurrentModel();
            if (
              (oController.isWeighingDialogOpen !== undefined && oController.isWeighingDialogOpen === true) ||
              (oController.isScanWeighDialogOpen !== undefined && oController.isScanWeighDialogOpen === true) ||
              (oController.isAddWeighDialogOpen !== undefined && oController.isAddWeighDialogOpen === true)
            ) {
              oCurrentModel.setProperty('/TaraWeight', '');
              oCurrentModel.setProperty('/TargetQuantity', null);
              oCurrentModel.setProperty('/ConsumedQuantity', null);
              oCurrentModel.setProperty('/TotalWeight', null);
              oCurrentModel.setProperty('/CurrentWeight', null);
              oCurrentModel.setProperty('/scaleList', null);
              oCurrentModel.setProperty('/ScaleUnitOfMeasure', '');
            }
            oController.setPostMaterialSelectionDetails(oSelectedObject, oCurrentModel, sCurrentDialogID);
            //  Extend WeighingScreen
          }
        });
      },

      resetAddDialogFields: function() {
        this.byId('inputMatNumAdd').focus();
        this.byId('inputMatNumAdd').setValue('');
        this.byId('inputMatDescAdd').setText('');
        this.byId('inputBatchIdAdd').setValue('');
        this.byId('storageLocationAdd').setValue('');
        this.byId('avlQtyAdd').setText('');
        this.byId('inputQuantityAdd').setValue('');
        this.byId('inputUnitAdd').setValue('');
        this.byId('inputPostedByAdd').setValue('');
        this.byId('inputPostingDateAdd').setValue('');
        this.byId('inputCommentsAddMaterial').setValue('');
        this.customFieldJson = [];

        this.byId('giConfirmBtnAdd').setEnabled(false);

        ErrorHandler.clearErrorState(this.byId('inputQuantityAdd'));
        ErrorHandler.clearErrorState(this.byId('inputBatchIdAdd'));
        ErrorHandler.clearErrorState(this.byId('inputPostedByAdd'));
        ErrorHandler.clearErrorState(this.byId('inputPostingDateAdd'));
        ErrorHandler.clearErrorState(this.byId('inputCommentsAddMaterial'));
      },

      /**
         * Open Calculate Quantity to Consume Dialog screen
         */
      onCalculateDialog: function(oEvent) {
        var oView = this.getView();
        var aComponents = oView.byId('consumptionList').getModel().getData().lineItems;
        var oFormula = oView.getModel('consumeModel').getData().formula;
        oFormula.resultContextRef = oView.getModel('consumeModel').getData().bomComponentRef;

        CalculateDialog.open(oView, oFormula, aComponents, this._calculateDialogCallBack.bind(this));
      },

      _calculateDialogCallBack: function(oResult) {
        var oView = this.getView();
        oView.getModel('consumeModel').setProperty('/quantity/value', oResult.result.toString());
        oView.getModel('consumeModel').setProperty('/calculatedData', oResult);

        var oQtyControl = this.getCurrentInputQuantityControl();
        oQtyControl.focus();
        this.onQuantityLiveChange();
      },

      /**
         * Enable/Disable Calculate button
         * @private
         */
      _enableDisableCalculation: function() {
        var that = this;
        var oView = that.getView();
        var sBomcomponentRef = oView.getModel('consumeModel').getProperty('/bomComponentRef');

        if (sBomcomponentRef) {
          let oParameters = {};
          let sUrl =
            that.getProductDataSourceUri() +
            "BomComponents('" +
            encodeURIComponent(sBomcomponentRef) +
            "')?$select=*&$expand=assemblyDataType($expand=dataFieldList($expand=dataField($expand=formula($expand=variables))))";
          AjaxUtil.get(
            sUrl,
            oParameters,
            function(oResponseData) {
              var oFormula = that._getFormula(oResponseData);
              oView.getModel('consumeModel').setProperty('/formula', oFormula.formula);
              oView.getModel('consumeModel').setProperty('/recalculationEnabled', oFormula.enableFormula);
            },
            function(oError, oHttpErrorMessage) {
              oView.getModel('consumeModel').setProperty('/formula', null);
              oView.getModel('consumeModel').setProperty('/recalculationEnabled', false);
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
            }
          );
        }
      },

      /**
         * Determine assigned formula to FORMULA data field
         * @param {oResponseData} Response of Bom Component ODATA request
         * @private
         */
      _getFormula: function(oResponseData) {
        var oFormula = {
          formula: null,
          enableFormula: false
        };
        if (oResponseData && oResponseData.assemblyDataType && oResponseData.assemblyDataType.dataFieldList) {
          var aDataFieldList = oResponseData.assemblyDataType.dataFieldList;
          var aFormulaDataFields = aDataFieldList.filter(function(oItem) {
            if (oItem.dataField.type === 'FORMULA') {
              return oItem.dataField;
            }
          });

          if (aFormulaDataFields.length > 0) {
            var aFormulas = [];
            aFormulaDataFields.forEach(function(oItem) {
              if (oItem.dataField.formula) {
                aFormulas.push(oItem.dataField.formula);
              }
            });

            if (aFormulas && aFormulas.length > 0) {
              aFormulas.sort(function(x, y) {
                var a = x.formulaName.toUpperCase();
                var b = y.formulaName.toUpperCase();
                return a === b ? 0 : a > b ? 1 : -1;
              });
              // On today there is no Use case for multiple assigned formula to Data Field
              // Return first Formula object
              oFormula.formula = aFormulas[0];
              if (oFormula.formula) {
                oFormula.enableFormula = true;
              }
            }
          } else {
            oFormula.formula = null;
            oFormula.enableFormula = false;
          }
        }
        return oFormula;
      },

      onCalculateIconPress: function(oEvent) {
        var sPath = oEvent.getSource().getParent().getParent().getParent().getBindingContextPath();
        var oCalculatedResult = oEvent.getSource().getModel('postingsModel').getObject(sPath).calculatedData;

        FormulaCalculatedInfo.openPopover(this.getOwnerComponent(), this.getView(), oEvent.getSource(), oCalculatedResult);
      },

      onChangeOfComments: function(oEvent) {
        var oCommentsControl = this.getCurrentCommentsControl();
        var sComment = oCommentsControl.getValue() || '';
        if (sComment === '' || sComment) {
          this.isCommentValid = true;
          ErrorHandler.clearErrorState(oEvent.getSource());
        }
        this._enableConfirmButton();
      },
      getUpperAndLowerThresholdValues: function(
        compThresholdUpper,
        compThresholdLower,
        bomThresholdUpper,
        bomThresholdLower,
        totalQtyEntryUom,
        totalQtyBaseUom,
        targetQuantity
      ) {
        var upperValue = 0,
          lowerValue = 0,
          thresholdValues = {};
        var targetValue = this.oFormatter.formatter
          ? this.oFormatter.formatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity)
          : this.oFormatter.getValidQty(totalQtyEntryUom, totalQtyBaseUom, targetQuantity);
        if ((!compThresholdUpper && !compThresholdLower && !bomThresholdUpper && !bomThresholdLower) || !targetValue.value) {
          thresholdValues.lowerValue = null;
          thresholdValues.upperValue = null;
        } else if (compThresholdUpper || compThresholdLower) {
          upperValue = compThresholdUpper ? targetValue.value + targetValue.value * (compThresholdUpper / 100) : targetValue.value;
          lowerValue = compThresholdLower ? targetValue.value - targetValue.value * (compThresholdLower / 100) : targetValue.value;
          thresholdValues.lowerValue = lowerValue;
          thresholdValues.upperValue = upperValue;
        } else if (bomThresholdUpper || bomThresholdLower) {
          upperValue = bomThresholdUpper ? targetValue.value + targetValue.value * (bomThresholdUpper / 100) : targetValue.value;
          lowerValue = bomThresholdLower ? targetValue.value - targetValue.value * (bomThresholdLower / 100) : targetValue.value;
          thresholdValues.lowerValue = lowerValue;
          thresholdValues.upperValue = upperValue;
        }
        thresholdValues.selectedTargetValue = targetValue;
        return thresholdValues;
      },
      determineTargetAndConsumedQty: function(oSelectedMaterial) {
        var returnObject = {
          targetQuantity: {
            type: 'totalQtyEntryUom',
            value: 0,
            uom: {}
          },
          consumedQuantity: {
            type: 'consumedQtyEntryUom',
            value: 0,
            uom: {}
          }
        };

        if (oSelectedMaterial && oSelectedMaterial.totalQtyEntryUom && oSelectedMaterial.totalQtyEntryUom.value) {
          returnObject.targetQuantity.type = 'totalQtyEntryUom';
          returnObject.targetQuantity.value = oSelectedMaterial.totalQtyEntryUom.value;
          returnObject.targetQuantity.uom = oSelectedMaterial.totalQtyEntryUom.unitOfMeasure;
        } else if (oSelectedMaterial && oSelectedMaterial.totalQtyBaseUom && oSelectedMaterial.totalQtyBaseUom.value) {
          returnObject.targetQuantity.type = 'totalQtyBaseUom';
          returnObject.targetQuantity.value = oSelectedMaterial.totalQtyBaseUom.value;
          returnObject.targetQuantity.uom = oSelectedMaterial.totalQtyBaseUom.unitOfMeasure;
        } else {
          returnObject.targetQuantity.type = 'targetQuantity';
          returnObject.targetQuantity.value = oSelectedMaterial.targetQuantity.value;
          returnObject.targetQuantity.uom = oSelectedMaterial.targetQuantity.unitOfMeasure;
        }

        if (
          returnObject.targetQuantity.type === 'totalQtyEntryUom' &&
          oSelectedMaterial.consumedQtyEntryUom &&
          oSelectedMaterial.consumedQtyEntryUom.value
        ) {
          // Take consumedQtyEntryUom's values
          returnObject.consumedQuantity.type = 'consumedQtyEntryUom';
          returnObject.consumedQuantity.value = oSelectedMaterial.consumedQtyEntryUom.value;
          returnObject.consumedQuantity.uom = oSelectedMaterial.consumedQtyEntryUom.unitOfMeasure;
        } else {
          // Take consumedQuantity for all other cases
          returnObject.consumedQuantity.type = 'other';
          returnObject.consumedQuantity.value = (oSelectedMaterial.consumedQuantity && oSelectedMaterial.consumedQuantity.value) || 0;
          returnObject.consumedQuantity.uom =
            (oSelectedMaterial.consumedQuantity && oSelectedMaterial.consumedQuantity.unitOfMeasure) || '';
        }
        return returnObject;
      },
      convertToUom: function(selectedMaterial, value, selectedUom) {
        var i, currentUoms;
        var numerator = 1;
        var denominator = 1;
        if (this.alternateUomForSelectedMaterial[selectedMaterial]) {
          currentUoms = this.alternateUomForSelectedMaterial[selectedMaterial];
          for (i = 0; i < currentUoms.length; i++) {
            if (currentUoms[i].uom === selectedUom) {
              numerator = currentUoms[i].numerator;
              denominator = currentUoms[i].denominator;
              break;
            }
          }
        }
        return parseFloat(value) * (numerator / denominator);
      },

      // Handling Unit related functions
      checkMaterialEWMManaged: function(sMaterialRef) {
        var oView = this.getView();
        var that = this;
        var sUrl = this.getInventoryDataSourceUri() + 'inventory/hasEwmManagedInventories';
        var oParameters = {};
        oParameters.materialRef = sMaterialRef;
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var bIsEWM = false;
            if (oResponseData && oResponseData.hasEwmManagedInventories) {
              bIsEWM = true;
            }
            oView.getModel('consumeModel').setProperty('/isEWM', bIsEWM);
            that.openMaterialConsumptionPopup(oView);
          },
          function(oError, oHttpErrorMessage) {
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
          }
        );
      },

      onHULiveChange: function(oEvent) {
        var oModel = this.getCurrentModel();
        oModel.setProperty('/batchNumber', '');
        oModel.setProperty('/inventory', '');
        oModel.setProperty('/avlBatchQty', '');
        oModel.setProperty('/useFullHandlingUnit', false);
        this.isBatchNumberValid = false;
        this.isQuantityValid = false;
        this.getCurrentSaveButton().setEnabled(false);
      },

      onFindHUInv: function() {
        let oView = this.getView();
        let oController = this;
        let oModel = oController.getCurrentModel();
        Fragment.load({
          id: oView.getId(),
          name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.HandlingUnitDialog',
          controller: this
        }).then(function(oDialog) {
          oView.addDependent(oDialog);
          oDialog.open();
          oDialog.setTitle(oController.getI18nText('batchDialogHeaderWithMat', oController.getCurrentModel().getProperty('/material')));
          oController.byId('HUSearch').setValue(oModel.getProperty('/handlingUnitNumber'));
          oController.fetchInvWithHU();
        });
      },

      fetchInvWithHU: function() {
        let HUModel = new JSONModel();
        this.getView().setModel(HUModel, 'HUModel');
        this.pageHU = 0;
        this.doHuApiCall(HUModel, false);
      },

      queryNextPageHU: function(oEvent) {
        if (oEvent.getParameters().reason === 'Growing' && this.totalPaginationElemsHU > (this.pageHU + 1) * 20) {
          this.pageHU++;
          this.doHuApiCall(this.getView().getModel('HUModel'), true);
        }
      },

      doHuApiCall: function(HUModel, isGrowing) {
        let that = this;
        let oTable = this.byId('HUList');
        let sUrl = this.getInventoryDataSourceUri() + 'inventory/findAvailable';
        let oParameters = this.prepareHUParams();
        let oDialog = that.byId('HUDialog');
        oDialog.setBusy(true);
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            if (oResponseData && oResponseData.content && oResponseData.content.length > 0) {
              that.totalPaginationElemsHU = oResponseData.totalElements;
              if (that.totalPaginationElemsHU > (that.pageHU + 1) * 20) {
                oTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return false;
                };
                oTable.setGrowingThreshold((that.pageHU + 1) * 20);
              } else {
                oTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return true;
                };
                oTable.setGrowing(false);
                oTable.setGrowingScrollToLoad(false);
              }
              let data = isGrowing ? HUModel.getData().concat(oResponseData.content) : oResponseData.content;
              HUModel.setData(data);
              HUModel.setSizeLimit(data.length);
              HUModel.refresh();
            } else {
              that.totalPaginationElemsHU = 0;
              HUModel.setData([]);
            }
            that.updateTableHeaderHUCount();
            that.onInvHUChange();
            oDialog.setBusy(false);
          },
          function(oError, oHttpErrorMessage) {
            oDialog.setBusy(false);
            var err = oError ? oError : oHttpErrorMessage;
            that.showErrorMessage(err, true, true);
          }
        );
      },

      prepareHUParams: function() {
        var oModel = this.getCurrentModel();
        var oParameters = {};
        oParameters.material = oModel.getProperty('/material');
        var tempMatDetails = oModel.getProperty('/materialRef').split(',');
        oParameters.materialVersion = tempMatDetails[tempMatDetails.length - 1];
        //this parameter is used to filter the records based on the serach by user.
        let crossFieldsSearchingKey = this.byId('HUSearch').getValue();
        if (crossFieldsSearchingKey) {
          oParameters.crossFieldsSearchingKey = crossFieldsSearchingKey;
        }
        oParameters.shopOrder = oModel.getProperty('/shopOrder');
        oParameters.operationRef =
          this.selectedDataInList && this.selectedDataInList.operation ? this.selectedDataInList.operation.ref : '';
        oParameters.phaseId = this.selectedDataInList ? this.selectedDataInList.phaseId : '';
        oParameters.stepId = this.selectedDataInList ? this.selectedDataInList.stepId : '';
        oParameters.page = this.pageHU;
        oParameters.size = 20;
        return oParameters;
      },

      //We are supporting fuzzy search here. With each and every input key, immediately the call will be triggered to
      //get the filtered data with pagination functionality intact.
      onSearchHUListWithVal: function() {
        this.fetchInvWithHU();
      },

      updateTableHeaderHUCount: function() {
        if (this.totalPaginationElemsHU === 0) {
          this.byId('HUListTitle').setText(this.getI18nText('items'));
        } else {
          this.byId('HUListTitle').setText(this.getI18nText('items') + ' (' + this.totalPaginationElemsHU + ')');
        }
      },

      onInvHUChange: function() {
        var okHUBtn = this.byId('okHU');
        var useFullHuBtn = this.byId('useFullHU');
        if (this.byId('HUList').getSelectedItems().length === 1) {
          var selectedHU = this.byId('HUList').getSelectedItem().getBindingContext('HUModel').getObject();
          okHUBtn.setEnabled(true);
          if (selectedHU.handlingUnitNumber) {
            useFullHuBtn.setEnabled(true);
          } else {
            useFullHuBtn.setEnabled(false);
          }
        } else {
          okHUBtn.setEnabled(false);
          useFullHuBtn.setEnabled(false);
        }
      },

      onOkHU: function() {
        var selectedHU = this.byId('HUList').getSelectedItem().getBindingContext('HUModel').getObject();
        var oModel = this.getCurrentModel();
        oModel.setProperty('/batchNumber', selectedHU.batchNumber);
        this.isBatchNumberValid = true;
        oModel.setProperty('/inventory', selectedHU.inventory);
        oModel.setProperty('/handlingUnitNumber', selectedHU.handlingUnitNumber);
        oModel.setProperty('/useFullHandlingUnit', false);
        if (selectedHU.availableQuantity.unitOfMeasure) {
          oModel.setProperty(
            '/avlBatchQty',
            this.oFormatter.formatBatchQuantityAdv(selectedHU.availableQuantity.value, selectedHU.availableQuantity.unitOfMeasure.uom)
          );
        } else {
          oModel.setProperty('/avlBatchQty', this.oFormatter.formatBatchQuantityAdv(selectedHU.availableQuantity.value, null));
        }
        this.onCancelHU();
        this._enableConfirmButton();
      },

      onClickUseFullHU: function() {
        var oModel = this.getCurrentModel();
        oModel.setProperty('/batchNumber', '');
        oModel.setProperty('/inventory', '');
        oModel.setProperty('/avlBatchQty', '');
        oModel.setProperty('/quantity/value', '');
        oModel.setProperty('/useFullHandlingUnit', true);
        var selectedHU = this.byId('HUList').getSelectedItem().getBindingContext('HUModel').getObject();
        oModel.setProperty('/handlingUnitNumber', selectedHU.handlingUnitNumber);
        this.onCancelHU();
        this.isBatchNumberValid = true;
        this.isQuantityValid = true;
        this._enableConfirmButton();
      },

      onCancelHU: function() {
        this.getView().byId('HUDialog').close();
        this.getView().byId('HUDialog').destroy();
      },

      onPressViewWorkinstructions: function(oEvent) {
        var oBindingObject = oEvent.getSource().getBindingContext().getObject();
        var selectedComponentRef = oBindingObject.materialId.ref;
        this.setGlobalProperty('compRefMatConsPlugin', selectedComponentRef);
        this.handleSelectAction(this.oPluginConfiguration);
      },

      onPressViewAlternateBoms: function(oEvent) {
        var oView = this.getView();
        var oBindingObject = oEvent.getSource().getBindingContext().getObject();
        var oController = this;
        if (!this.byId('alternateComponentsDialog')) {
          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.materialConsumptionPlugin.view.fragments.AlternateComponentsDialog',
            controller: this
          }).then(function(oDialog) {
            oDialog.setEscapeHandler(
              function(oPromise) {
                oController.onCloseAlternateComponentsDialog();
                oPromise.resolve();
              }.bind(oController)
            );
            oView.addDependent(oDialog);
            oDialog.open();
            var alternateComponentsModel = new JSONModel(oBindingObject);
            oController.byId('alternateComponentsTable').setModel(alternateComponentsModel, 'alternateComponentsModel');
          });
        } else {
          this.byId('alternateComponentsDialog').open();
          var alternateComponentsModel = new JSONModel(oBindingObject);
          oController.byId('alternateComponentsTable').setModel(alternateComponentsModel, 'alternateComponentsModel');
        }
      },

      onCloseAlternateComponentsDialog: function() {
        this.getView().byId('alternateComponentsDialog').close();
      },
      // C5278086 Adding changes for W&D Start
      showWeighingPopup: function(oEvent) {
        this.isWeighingDialogOpen = true;
        var oBindingObject = oEvent.getSource().getBindingContext().getObject();
        this._initWeighingHeaderModel(oBindingObject);

        if (!this._validatePhaseStatus()) {
          MessageBox.error(this.getI18nText('phaseNotInActiveStatusErrMsg', [this.selectedDataInList.truncatedPhaseId]));
          return;
        }

        if (!this.getConfiguration().allowWeighWithoutTolerance) {
          var oLineItem = oEvent.getSource().getBindingContext().getObject(),
            upperThresholdValue = parseFloat(oLineItem.upperThresholdValue),
            lowerThresholdValue = parseFloat(oLineItem.lowerThresholdValue);
          if (isNaN(upperThresholdValue) || isNaN(lowerThresholdValue)) {
            MessageBox.error(this.getI18nText('weighNotAllowedWithoutThresholdErrMsg'));
            return;
          }
        }

        // Init Functions
        this.getWorkCenters();

        //Laden View
        this.openWeighingDialog();
      },

      openWeighingDialog: function() {
        this.oWeighDispenseHandler.openWeighingDialog();
      },

      getScaleTareData: function(oView) {
        //TODO:
        var oScale = oView.byId('cmbScaleList');
        if (oScale.getItems().length > 0) {
          var oScaleSelect = oScale.getItems()[0].getKey();
          const oResourceID = 'ResourceBO:' + PlantSettings.getCurrentPlant() + ',' + oScaleSelect;
          const sRequestURL =
            this.getPlantDataSourceUri() +
            "Resources('" +
            encodeURIComponent(oResourceID) +
            "')?$select=*&$expand=resourceTypeResources($expand=resourceType),resourceTechnicalObjects,resourceEquipmentAssignments,resourceShifts($expand=shift($expand=shiftDefinitions)),bins";
          this.getScaleEquipmentID(sRequestURL, {});
        }
      },

      getScaleEquipmentID: function(sUrl, oParameters, oResource) {
        var that = this;
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            oResource.equipment = oResponseData.resourceEquipmentAssignments;
          },
          function(oError) {
            var sErroMsg = that.getI18nTextByKey('ErrMsgNoRelevantResourceType');
            that.showErrorMessage(sErroMsg);
          }
        );
      },

      afterWeighingDialogOpened: function(oEvent) {
        this.oWeighDispenseHandler._initScale();
      },

      getInventoryStockData: function(
        sDefaultBatchId,
        bIsBatchManaged,
        sStorageLocation,
        sStorageLocationRef,
        sSelectedMaterialRef,
        sSelectedMaterial
      ) {
        if (
          this.isInventoryManaged &&
          ((sDefaultBatchId && sDefaultBatchId !== this.getI18nText('notBatchManaged')) ||
            (!bIsBatchManaged && sStorageLocation && sStorageLocationRef))
        ) {
          this.prepareInventoryUrl(sSelectedMaterialRef, sDefaultBatchId, sStorageLocationRef, 'weighDialog', false);
        } else if (
          !this.isInventoryManaged &&
          ((!bIsBatchManaged && sStorageLocation) ||
            (sStorageLocation && sDefaultBatchId && sDefaultBatchId !== this.getI18nText('notBatchManaged')))
        ) {
          this.getStockForDefaults(sSelectedMaterial, sStorageLocation, sDefaultBatchId, 'weighDialog');
        }
      },

      _initWeighingHeaderModel: function(oBindingObject) {
        this.oWeighDispenseHandler._initWeighingHeaderModel(oBindingObject);
      },
      onWeighDialogCancel: function(oEvent) {
        this.oWeighDispenseHandler.closeWeighingDialog(oEvent);
      },

      onSelectScale: async function(oEvent) {
        var oScaleInput = this.oWeighDispenseHandler.getCurrentWeighScaleList();
        var selectedScale;
        try {
          var oSelectedResource = JSON.parse(oEvent.getParameter('newValue')),
            sSelectedAsset = oSelectedResource.asset;

          selectedScale = oSelectedResource.resource;
          oScaleInput.setValue(selectedScale);
        } catch (e) {
          selectedScale = oEvent.getParameter('newValue');
        }

        //Validate resource
        var oModel = this.getCurrentModel(),
          aScaleList = oModel.getProperty('/scaleList');
        var oResource = aScaleList.find(oScale => oScale.resource === selectedScale);

        if (!oResource) {
          oScaleInput.setValueState('Error');
          oScaleInput.setValueStateText(this.getI18nText('INVALID_RESOURCE'));
          return;
        } else {
          oScaleInput.setValueState('None');
          oScaleInput.setValueStateText('');
        }

        //Validate asset
        if (!sSelectedAsset) {
          this.oWeighDispenseHandler.onSelectScale(oEvent);
          return;
        }

        this._validateAsset(selectedScale, sSelectedAsset)
          .then(
            function(bIsAssetValid) {
              if (!bIsAssetValid) return;

              this.oWeighDispenseHandler.onSelectScale(oEvent);
            }.bind(this)
          )
          .catch(
            function(oError) {
              this.showErrorMessage('Error occured during asset validation');
            }.bind(this)
          );
      },
      onSetScaleZero: function(oEvent) {
        var oPluginConfiguration = this.oPluginConfiguration,
          sIndicatorName = oPluginConfiguration.charcSetZeroIndicator;
        if (sIndicatorName.length > 0) {
          var bWriteIndicatorSuccess = this.oWeighDispenseHandler.writeIndicator(sIndicatorName, true);
          if (bWriteIndicatorSuccess) {
            this.oWeighDispenseHandler.readTareValue();
          }
        } else {
          var sErroMsg = this.getI18nTextByKey('ErrMsgNoIndicatorForSetZero');
          this.showErrorMessage(sErroMsg);
        }
      },

      onSetScaleTare: function(oEvent) {
        var oPluginConfiguration = this.oPluginConfiguration,
          sIndicatorName = oPluginConfiguration.charcSetTareIndicator;
        if (sIndicatorName.length > 0) {
          var bWriteIndicatorSuccess = this.oWeighDispenseHandler.writeIndicator(sIndicatorName, true);
          if (bWriteIndicatorSuccess) {
            this.oWeighDispenseHandler.readTareValue();
          }
        } else {
          var sErroMsg = this.getI18nTextByKey('ErrMsgNoIndicatorForSetTare');
          this.showErrorMessage(sErroMsg);
        }
      },

      convertQuantityForCurrentMaterial: function(sFromUOM, sToUOM) {
        var dConversionFactor = 1;
        if (sFromUOM !== sToUOM) {
          var sCurrMaterial = this.consumeData.material,
            aAlternativeUOMS = this.alternateUomForSelectedMaterial[sCurrMaterial];
          if (aAlternativeUOMS.length > 0) {
            var oFromConversionObject = aAlternativeUOMS.find(oData => oData.internalUom === sFromUOM),
              oToConversionObject = aAlternativeUOMS.find(oData => oData.uom === sToUOM);
            if (oFromConversionObject !== undefined && oToConversionObject !== undefined) {
              var dSourceFactorFrom = oFromConversionObject.numerator / oFromConversionObject.denominator;
              var dTargetFactorTo = oToConversionObject.numerator / oToConversionObject.denominator;
              dConversionFactor = dSourceFactorFrom / dTargetFactorTo;
              this.oScaleUomNotMatched = false;
            } else {
              var sErrorMessage = this.getI18nTextByKey('ErrMsgNotAllAlternativeUOMsMaintained', [sFromUOM, sToUOM]);
              this.showErrorMessage(sErrorMessage);
              this.oScaleUomNotMatched = true;
              return undefined;
            }
          }
        }
        return dConversionFactor;
      },

      onWeighDialogConfirm: function(oEvent) {
        this.confirmWeight('Confirm');
      },

      onWeighDialogAddWeight: function(oEvent) {
        this.confirmWeight('AddWeight');
      },

      getConversionFactor: function(sSelectedMaterial, sSelectedUom) {
        const oConversionFactor = this.getInternalUom(sSelectedMaterial, sSelectedUom);
        if (oConversionFactor) {
          return oConversionFactor.numerator / oConversionFactor.denominator;
        }
        return 1;
      },
      getInternalUom: function(sSelectedMaterial, sSelectedUom) {
        if (this.alternateUomForSelectedMaterial[sSelectedMaterial]) {
          const aCurrentUoms = this.alternateUomForSelectedMaterial[sSelectedMaterial];
          return aCurrentUoms.find(currentUom => currentUom.uom === sSelectedUom);
        }
        oLogger.error('Cannot find conversion information' + sSelectedMaterial + ',' + sSelectedUom);
        return null;
      },
      confirmWeight: function(sPopup) {
        var that = this;

        this.sPopupClosingMethod = sPopup;
        var oModel = this.getCurrentModel();
        var sSelectedUom = oModel.getProperty('/quantity/unitOfMeasure/uom');
        oModel.setProperty('/quantity/unitOfMeasure/uom', sSelectedUom);
        oModel.setProperty('/quantity/unitOfMeasure/internalUom', sSelectedUom);

        var selectedMaterial = this.consumeData.material;
        var dConversionFactor = this.getConversionFactor(selectedMaterial, sSelectedUom);
        const oInternalUom = this.getInternalUom(selectedMaterial, sSelectedUom);
        if (!oInternalUom) {
          const sErrorMessage = this.getI18nTextByKey('ErrMsgNoInternalUOMsConversionFactorMaintainedForMaterial', [
            selectedMaterial,
            sSelectedUom
          ]);
          this.showErrorMessage(sErrorMessage);
          return;
        }
        this.consumeData.quantity.unitOfMeasure = JSON.parse(JSON.stringify(oInternalUom));
        var dQuantityToBeConsumed = parseFloat(oModel.getProperty('/quantity/value')) * dConversionFactor;
        var dActQuantityConsumed = this.consumedQuantityForSelectedMaterial
          ? this.consumedQuantityForSelectedMaterial * dConversionFactor
          : 0;
        var dTotalQuantityToBeConsumed = dActQuantityConsumed + dQuantityToBeConsumed;

        var oToleranceInfo = oModel.getProperty('/tolerance'),
          dThresholdBottom = undefined,
          dThresholdTop = undefined;

        if (oToleranceInfo) {
          dThresholdBottom = oToleranceInfo.lowerThresholdValue;
          dThresholdTop = oToleranceInfo.upperThresholdValue;
        }

        dThresholdBottom = parseFloat(dThresholdBottom * dConversionFactor);
        dThresholdTop = parseFloat(dThresholdTop * dConversionFactor);

        function consumeSetQuantity() {
          that.setDataToModelAndPostGi(oModel);
        }

        if (dQuantityToBeConsumed > 0) {
          if (dThresholdBottom !== undefined && dThresholdBottom > 0 && dThresholdTop !== undefined && dThresholdTop > 0) {
            if (dTotalQuantityToBeConsumed < dThresholdBottom || dTotalQuantityToBeConsumed > dThresholdTop) {
              var sSelectedMaterial = oModel.getProperty('/material', sSelectedMaterial),
                sWarningMsg = this.getI18nTextByKey('warningThreshold', [sSelectedMaterial]);

              MessageBox.warning(sWarningMsg, {
                styleClass: 'sapUiSizeCompact',
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function(sAction) {
                  if (sAction === 'OK') {
                    consumeSetQuantity();
                  }
                }
              });
            } else {
              consumeSetQuantity();
            }
          } else {
            consumeSetQuantity();
          }
        }
      },

      _refreshWeighingDialog: function(oResponseData) {
        var oView = this.getView();
        let oWeighingModel = this.getCurrentModel();
        oWeighingModel.setProperty('/quantity/value', '');
        this.isQuantityValid = false;

        let sBOMComponentRef = this.consumeData.bomComponentRef;
        var oMaterialObj = oResponseData.lineItems.find(oData => oData.bomComponentRef === sBOMComponentRef);

        if (oMaterialObj) {
          let dNewConsumedQty = oMaterialObj.consumedQuantity.value;

          if (dNewConsumedQty === undefined) {
            dNewConsumedQty = 0;
          }
          var sResponseUOM = oMaterialObj.consumedQuantity.unitOfMeasure.uom,
            sCurrentUOM = this.sScaleUnitOfMeasure,
            dConversionFactor = this.convertQuantityForCurrentMaterial(sResponseUOM, sCurrentUOM),
            dConvertedQty = dNewConsumedQty * dConversionFactor;
          this.consumedQuantityForSelectedMaterial = dConvertedQty;
          oWeighingModel.setProperty('/ConsumedQuantity/value', dConvertedQty);
          this.oWeighDispenseHandler._initializeScale();
        }
      },
      _resetBatchWeighingDialog: function() {
        var oView = this.getView();
        var oWeighingModel = this.getCurrentModel();
        var oInputBatch = this.getCurrentInputBatchIdControl();
        oInputBatch.setValue(null);
        oInputBatch.focus();
        oWeighingModel.setProperty('/batchNumber', '');
        oWeighingModel.setProperty('/avlBatchQty', '');
      },

      getWorkCenters: function() {
        const sWorkCenterObjectId = 'WorkCenterBO:' + PlantSettings.getCurrentPlant() + ',' + this.consumeData.workCenter;
        const sRequestURL =
          this.getPlantDataSourceUri() +
          "Workcenters('" +
          encodeURIComponent(sWorkCenterObjectId) +
          "')?" +
          '$expand=members($expand=childResource($expand=resourceShifts($expand=shift($select=ref));' +
          '$select=ref,resource,status,description,erpCapacityCategory))&$format=json';
        this.readWorkCenters(sRequestURL, {});
      },

      getResourceWithScaleEquipmentId: function(aMemberArray, aResourceArray) {
        var that = this;
        for (var i in aMemberArray) {
          var oCurrResource = aMemberArray[i].childResource;
          const sRequestURL =
            that.getPlantDataSourceUri() +
            "Resources('" +
            encodeURIComponent(oCurrResource.ref) +
            "')?$select=*&$expand=resourceTypeResources($expand=resourceType),resourceTechnicalObjects,resourceEquipmentAssignments,resourceShifts($expand=shift($expand=shiftDefinitions)),bins";
          that.getScaleEquipmentID(sRequestURL, {}, oCurrResource);
          if (oCurrResource.status === 'ENABLED') {
            aResourceArray.push(oCurrResource);
          }
        }
      },

      readWorkCenters: function(sUrl, oParameters) {
        var that = this;
        var oWeighingModel = this.getCurrentModel();

        var oPluginConfiguration = this.oPluginConfiguration;
        AjaxUtil.get(
          sUrl,
          oParameters,
          function(oResponseData) {
            var aMemberArray = oResponseData.members,
              aResourceArray = [];

            that.getResourceWithScaleEquipmentId(aMemberArray, aResourceArray);

            oWeighingModel.setProperty('/scaleList', aResourceArray);

            var oCMBScale = that.oWeighDispenseHandler.getCurrentWeighScaleList();
            if (oCMBScale !== undefined) {
              if (aResourceArray.length === 1) {
                let sSelKey = aResourceArray[0].resource;
                // oCMBScale.setSelectedKey(sSelKey);
                that.oWeighDispenseHandler._checkUpdateScale();
                that.oWeighDispenseHandler._setEnabledScaleButtons(true);
                this.aIndicatorData = null;
                var oPluginConfiguration = that.oPluginConfiguration,
                  bShowSetTare = oPluginConfiguration.showWeighingSetTare;
                if (bShowSetTare !== undefined && bShowSetTare === true) {
                  that.oWeighDispenseHandler.readTareValue();
                }
              } else {
                // oCMBScale.setSelectedKey(null);
              }
            }
          },
          function(oError) {
            var sErroMsg = that.getI18nTextByKey('ErrMsgNoRelevantResourceType');
            that.showErrorMessage(sErroMsg);
          }
        );
      },

      getI18nTextByKey: function(sTextKey, aParamArray) {
        var sText = '';
        let oResourceBundle = this.getView().getModel('i18n').getResourceBundle();

        if (sTextKey !== undefined && sTextKey !== null) {
          let bParamsAval = false;
          if (aParamArray !== undefined && aParamArray !== null) {
            if (aParamArray.length > 0) {
              bParamsAval = true;
            }
          }

          if (bParamsAval) {
            sText = oResourceBundle.getText(sTextKey, aParamArray);
          } else {
            sText = oResourceBundle.getText(sTextKey);
          }
        }
        return sText;
      },

      _setWorkcenterData: function() {
        var oView = this.getView();
        if (!oView.getModel('WorkcenterInfo')) {
          oView.setModel(new JSONModel(), 'WorkcenterInfo');
        }
        var oWorkcenterModel = oView.getModel('WorkcenterInfo');
        var oWorkcenterInfo = null;
        if (this.selectedDataInList !== undefined) {
          oWorkcenterInfo = JSON.parse(JSON.stringify(this.selectedDataInList.workCenter));
        }
        oWorkcenterModel.setData(oWorkcenterInfo);
      },

      weighingBatchChanged: function() {
        this.oWeighDispenseHandler._checkUpdateScale();
      },

      onSimulateData: function(oEvent) {
        this.openQuantityDialog();
      },

      openQuantityDialog: function() {
        if (!this.oQuantitySimulationDialog) {
          var that = this;

          function closeDialog() {
            that.oQuantitySimulationDialog.close();
            var oInQuantityInput = sap.ui.getCore().byId('inSimulatedQty');
            oInQuantityInput.setValue('');
          }

          function updateQuantityScale() {
            var oInQuantityInput = sap.ui.getCore().byId('inSimulatedQty');
            var sScaleInput = oInQuantityInput.getValue();
            if (sScaleInput.length > 0) {
              var dScaleQty = parseFloat(sScaleInput);
              var oPluginConfiguration = that.oPluginConfiguration,
                sIndicatorName = oPluginConfiguration.charcWeighingIndicatorName;
              if (sIndicatorName.length > 0) {
                that.oWeighDispenseHandler.writeIndicator(sIndicatorName, dScaleQty);
              } else {
                var sErroMsg = that.getI18nTextByKey('ErrMsgNoIndicatorForCurrentWeight');
                that.showErrorMessage(sErroMsg);
              }
            }
          }

          this.oQuantitySimulationDialog = new sap.m.Dialog({
            title: 'Simulate Quantity',
            content: [
              new sap.m.HBox({
                justifyContent: 'Center',
                alignItems: 'Center',
                items: [
                  new sap.m.Label({
                    text: 'Quantity to post:'
                  }).addStyleClass('sapUiTinyMarginEnd'),
                  new sap.m.Input({
                    id: 'inSimulatedQty',
                    width: '80%',
                    type: sap.m.InputType.Number
                  })
                ]
              })
            ],
            beginButton: new sap.m.Button({
              type: sap.m.ButtonType.Emphasized,
              text: 'Set Quantity',
              press: function() {
                updateQuantityScale();
                closeDialog();
              }.bind(this)
            }),
            endButton: new sap.m.Button({
              text: 'Cancle',
              press: function() {
                closeDialog();
              }.bind(this)
            })
          });
          this.getView().addDependent(this.oDefaultDialog);
        }
        this.oQuantitySimulationDialog.open();
      },
      // Scan Weighing Dialog
      getCurrentStorageLocationInput: function() {
        return this.oWeighDispenseHandler.getCurrentStorageLocationInput();
      },

      getCurrentWeighSimulateButton: function() {
        var oView = this.getView();
        if (this.isWeighingDialogOpen && this.isWeighingDialogOpen === true) return oView.byId('btnSimulate');
        if (this.isScanWeighDialogOpen && this.isScanWeighDialogOpen === true) return oView.byId('btnScanWeighSimulate');
        if (this.isAddWeighDialogOpen && this.isAddWeighDialogOpen === true) return oView.byId('btnAddWeighSimulate');
      },

      openWeighingScanDialog: function() {
        this.oWeighDispenseHandler.openWeighingScanDialog();
      },
      openWeighingAddDialog: function() {
        this.oWeighDispenseHandler.openWeighingAddDialog();
      },

      focusMaterialInput: function() {
        setTimeout(
          function() {
            var oInputField = this.getCurrentInputMaterialControl();
            oInputField.focus();
          }.bind(this),
          300
        );
      },

      focusBatchInputField: function() {
        setTimeout(
          function() {
            var oInputBatchField = this.oWeighDispenseHandler.getCurrentWeighBatchInput();
            oInputBatchField.focus();
          }.bind(this),
          300
        );
      },

      openBatchClearPopup: function(oResponseData) {
        var that = this;
        // Check Planned Batch
        let sInfoMsg = this.getI18nTextByKey('InfoBatchResetMessage');
        MessageBox.information(sInfoMsg, {
          styleClass: 'sapUiSizeCompact',
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasizedAction: MessageBox.Action.YES,
          initialFocus: MessageBox.Action.YES,
          onClose: function(sAction) {
            if (sAction === 'YES') {
              that._resetBatchWeighingDialog(oResponseData);
              that.focusBatchInputField();
            }
          }
        });
      },

      setWeighRelevantFlag: function(oData) {
        const oNotificationConfig = this.getNotificationsConfiguration();
        const bIsWeighDispenseTopicSubscribed = oNotificationConfig && oNotificationConfig.weighDispenseScaleNotification;
        const stepId = oData.stepId;
        const recipeArr = oData.recipeArray || [];
        const recipe = recipeArr.find(item => item.stepId === stepId);
        oData.weighRelevant =
          (bIsWeighDispenseTopicSubscribed && (recipe && recipe.recipeOperation && recipe.recipeOperation.weighRelevant)) || false;
      },
      // C5278086 Adding changes for W&D End.
      formatCharacteristics: function(sValueField, sUomField, sDataType) {
        if (['CHAR', 'NUM'].includes(sDataType) && sUomField) {
          return Formatter.showValueUptoThreeDecimalWithUom(sValueField, sUomField);
        } else if (sDataType === 'CHAR' && !sUomField) {
          return sValueField;
        } else if (sDataType === 'NUM' && !sUomField) {
          return Formatter.formatNumber(sValueField);
        } else if (sDataType === 'DATE') {
          return Formatter.formatDate(sValueField);
        } else {
          //Unknown type. No formatting
          return sValueField;
        }
      },
      formatCustomField: function(sCustomFieldPayload) {
        return ![null, undefined, ''].includes(sCustomFieldPayload) ? JSON.parse(sCustomFieldPayload)[0].value : '';
      },
      getStorageLocations: function(oResponseData) {
        let aStorageLocations = [];
        oResponseData.value &&
          oResponseData.value.length > 0 &&
          oResponseData.value.forEach(e => {
            aStorageLocations.push(e.storageLocation);
          });
        return aStorageLocations;
      },
      handleStorageLocationData: function(oResponseData) {
        let aStorageLocations = [];
        aStorageLocations = this.getStorageLocations(oResponseData, aStorageLocations);
        //Now we have storagelocations, call and get the remaining quantities
        aStorageLocations && aStorageLocations.length > 0 && this.handleStorageLocationDetails(aStorageLocations.join(','));
      },

      // To set Validation of lower expiry Batch - AD-006
      _validateBatchSelection: async function() {
        var oModel = this.getCurrentModel(),
          bIsBatchManaged = oModel.getProperty('/batchManaged'),
          sDefaultSloc = oModel.getProperty('/storageLocation'),
          sSelectedBatchId = oModel.getProperty('/batchNumber'),
          sSelectedMaterial = oModel.getProperty('/material'),
          oInput = this.getCurrentInputBatchIdControl();

        //If material is not batch managed, no batch validation
        if (!bIsBatchManaged) {
          return true;
        }

        //Fetch batch data if model is not set
        if (!this.batchDetailsModel || (this.scannedMaterial && this.scannedMaterial.StockID)) {
          var { sUrl, oParameters } = this._createBatchDetailsServiceCall();
          await this.getBatchDetails(sUrl, oParameters);
        }

        var aBatchDetails = this.batchDetailsModel.getData(),
          oSelectedBatch = aBatchDetails.find(oBatch => oBatch.batchNumber === sSelectedBatchId);

        //Check if selected batch exists in the model
        if (!oSelectedBatch) {
          oInput.setValueState('Error');
          oInput.setValueStateText(this.getI18nText('REQUIRED_BATCH_INPUT'));
          return false;
        }

        //Check if selected batch has expiry
        if (!oSelectedBatch.expiry) {
          oInput.setValueState('Error');
          oInput.setValueStateText(this.getI18nText('batchDoesNotHaveExpiryDateErrMsg', [sSelectedBatchId]));
          return false;
        }

        //If material has default sloc, ensure selected batch is in the default sloc
        if (sDefaultSloc && oSelectedBatch.storageLocation.storageLocation !== sDefaultSloc) {
          oInput.setValueState('Error');
          oInput.setValueStateText(this.getI18nText('batchNotInDefaultSlocErrMsg', [sSelectedBatchId, sDefaultSloc]));
          return false;
        }

        //Check if selected batch has lowest expiry in the batch list
        var aBatches = aBatchDetails.filter(oBatch => !!oBatch.expiry && oBatch.storageLocation.storageLocation === sDefaultSloc);
        var aDates = aBatches.map(oBatch => new Date(oBatch.expiry));
        var oLowestExpiryDate = new Date(Math.min(...aDates));
        var oLowestExpiryBatch = aBatches.find(oBatch => moment(oBatch.expiry).isSame(oLowestExpiryDate));

        if (!moment(oLowestExpiryDate).isSame(oSelectedBatch.expiry)) {
          oInput.setValueState('Error');
          oInput.setValueStateText(this.getI18nText('errorLowerBatchExpiry', [sSelectedMaterial, oLowestExpiryBatch.batchNumber]));
          return false;
        }

        //Reset the value states in case of validation pass
        oInput.setValueState('None');
        oInput.setValueStateText('');
        return true;
      },

      _validateAsset: function(sResourceId, sAssetId) {
        var sUrl = this.getPublicApiRestDataSourceUri() + '/resource/v2/resources';
        var oParams = {
          plant: this.getPodController().getUserPlant(),
          resource: sResourceId
        };

        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParams,
              function(oResponse) {
                var bIsResourceValid = false;
                if (oResponse && oResponse.length > 0 && oResponse[0].asset.name === sAssetId) {
                  bIsResourceValid = true;
                }

                var oResourceInput = this.oWeighDispenseHandler.getCurrentWeighScaleList();
                if (bIsResourceValid) {
                  oResourceInput.setValueState('None');
                  oResourceInput.setValueStateText('');
                } else {
                  oResourceInput.setValueState('Error');
                  oResourceInput.setValueStateText(this.getI18nText('INVALID_ASSET'));
                }

                resolve(bIsResourceValid);
              }.bind(this),
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      /**
       * If any of the table items have bom components meeting the 'Park' or 'Batch Correction' criteria,
       * show error message and navigate user back to order selection screen
       */
      _checkBatchCorrectionCondition: function() {
        if (!this.giModel) return;

        var sShopOrder = this.giModel.getProperty('/shopOrder'),
          aLineItems = this.giModel.getProperty('/lineItems');

        if (!aLineItems || aLineItems.length < 1) return;

        var aParkedItems = [],
          bBatchCorrectionFlag = false;

        for (var i = 0; i < aLineItems.length; i++) {
          //If there is no consumed qty or if consumed qty is 0 then continue
          if (!aLineItems[i].consumedQuantity.value || aLineItems[i].consumedQuantity.value <= 0) {
            continue;
          }

          //If the consumed quantity is equal to target quantity, then no validation requirement
          if (aLineItems[i].consumedQuantity.value === aLineItems[i].targetQuantity.value) {
            continue;
          }

          //If consumed qty is less than lower threshold, then mark as parked
          var lowerThreshold = aLineItems[i].lowerThresholdValue || 0;
          if (aLineItems[i].consumedQuantity.value < lowerThreshold) {
            aParkedItems.push(aLineItems[i]);
            continue;
          }

          //If consumed qty is greater than upper threshold, then mark as batch correction item
          var upperThreshold = aLineItems[i].upperThresholdValue || 0;
          if (aLineItems[i].consumedQuantity.value > upperThreshold) {
            bBatchCorrectionFlag = true;
            break;
          }
        }

        if (bBatchCorrectionFlag) {
          var sErrorMessage = this.getI18nText('batchCorrectionRequiredErrorMessage', [sShopOrder]);
          MessageBox.error(sErrorMessage, {
            onClose: function() {
              this._setSfcHoldStatus();
              window.history.go(-1);
            }.bind(this)
          });
          return;
        }

        this.parkedItemList = aParkedItems;

        if (aParkedItems && aParkedItems.length > 0) {
          var sWarningMsg = this.getI18nText('parkWarningMessage', [aParkedItems[0].materialId.material, sShopOrder]);
          MessageBox.warning(sWarningMsg);
        }
      },

      _setSfcHoldStatus: function() {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'sfc/v1/sfcs/hold';
        var oRequestBody = {
          plant: this.getPodController().getUserPlant(),
          sfcs: [this.selectedDataInList.selectedSfc],
          comments: 'On hold for batch correction',
          expectedReleaseDateTime: moment().add(1, 'days')
        };

        this.ajaxPostRequest(sUrl, oRequestBody);
      },

      _validatePhaseStatus: function() {
        if (this.selectedDataInList.status === 'ACTIVE') return true;
        return false;
      },

      _hasParkedItems: function() {
        return this.parkedItemList && this.parkedItemList.length > 0;
      },

      _checkIfItemIsParked: function(sMaterial) {
        return this.parkedItemList.find(oItem => oItem.materialId.material === sMaterial) ? true : false;
      },

      _getParkedMaterialList: function() {
        if (!this.parkedItemList && this.parkedItemList.length === 0) {
          return '';
        }

        return this.parkedItemList.map(oItem => oItem.materialId.material).join(',');
      },

      _getMaterialForEAN: function(sEAN) {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_35d60bbd-14c1-443d-b7a2-c724261d94ef&async=false';
        var oPayload = {
          ean: sEAN
        };

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oPayload, resolve, reject);
        });
      },

      _getBatchCorrectionData: function() {
        var sUrl =
          this.getPublicApiRestDataSourceUri() +
          '/pe/api/v1/process/processDefinitions/start?key=REG_04527345-c48f-44c1-9424-5b65503c18ed&async=false';
        var oSelection = this.getPodSelectionModel().getSelection();
        var oParams = {
          order: oSelection.getShopOrder().shopOrder,
          sfc: oSelection.getSfc()
        };
        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oParams, resolve, reject);
        });
      }
    });
  }
);
