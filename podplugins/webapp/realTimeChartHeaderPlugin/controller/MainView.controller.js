sap.ui.define(
  [
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/ui/model/json/JSONModel',
    'sap/m/MessageToast',
    'sap/viz/ui5/data/FlattenedDataset',
    'sap/viz/ui5/controls/common/feeds/FeedItem',
    'sap/viz/ui5/format/ChartFormatter',
    'sap/viz/ui5/api/env/Format',
    'sap/ui/model/Filter',
    'sap/ui/model/FilterOperator',
    'sap/m/MessageBox'
  ],
  function (PluginViewController, JSONModel, MessageToast, FlattenedDataset, FeedItem, ChartFormatter, Format, Filter, FilterOperator, MessageBox) {
    'use strict';

    return PluginViewController.extend('stellium.ext.podplugins.realTimeChartHeaderPlugin.controller.MainView', {
      onInit: function (oEvent) {
        PluginViewController.prototype.onInit.apply(this);

        this.selectedOrderData = {};
        this.selectedPhaseData = {};

        var oView = this.getView();
        oView.setModel(
          new JSONModel({
            orderIdFieldVisible: true,
            componentIdFieldVisible: true,
            operatorIdFieldVisible: true,
            resourceIdFieldVisible: true,
            passPortionVisible: true,
            failPortionVisible: true,
            cumulativeCountVisible: true,
            consequtiveCountVisible: true
          }),
          'headerInformationConfig'
        );
        oView.setModel(new JSONModel(), 'headerData');
      },

      onBeforeRenderingPlugin: function () {
        this.subscribe('stelReloadChartData', this.handleReloadEvent, this);
        this.subscribe('PageChangeEvent', this.handlePageChangeEvent, this);
        this.updateHeaderInfo();
      },

      onExit: function () {
        this.unsubscribe('stelReloadChartData', this.handleResourceSelectionEvent, this);
        this.unsubscribe('PageChangeEvent', this.handlePageChangeEvent, this);
      },

      handlePageChangeEvent: function (sChannelId, sEventId, oData) {
        if (oData.page === 'CHARTPAGE') {
          this.updateHeaderInfo();
        }
      },

      handleReloadEvent: function (sChannelId, sEventId, oData) {
        this.updateHeaderInfo();
      },

      updateHeaderInfo: function () {
        //Get the selected resource and create service payload
        var oPodSelectionModel = this.getPodSelectionModel(),
          oSelectedResource = oPodSelectionModel.stelSelectedResourceData;
        var oHeaderData = {
          plant: this.getPodController().getUserPlant(),
          order: oSelectedResource.customData.ORDER,
          operator: oSelectedResource.customData.OPERATOR,
          component: oSelectedResource.customData.MATERIAL,
          resource: oSelectedResource.resource,
          passPortion: 0,
          failPortion: 0,
          cumulativeCount: 0,
          consequtiveCount: 0
        };
        this.getView().getModel('headerData').setData(oHeaderData);
        this._fetchHeaderData();
        this._loadTareData();
      },

      updatePanelExpanded: function (oViewData) {
        let oPluginContainer = this.byId('idRealTimeHeaderPluginPanel');
        let bPanelExpanded = true;
        if (oPluginContainer && oPluginContainer.getExpanded) {
          bPanelExpanded = oPluginContainer.getExpanded();
        }
        let oView = this.getView();
        let oConfigModel = oView.getModel('headerInformationConfig');
        let oConfigData = oConfigModel.getData();
        if (!oConfigData) {
          oConfigData = {};
          oConfigModel.setData(oConfigData);
        }
        oConfigData.panelExpanded = bPanelExpanded;
        if (oViewData) {
          oViewData.panelExpanded = bPanelExpanded;
        }
      },

      _fetchHeaderData: function () {
        var oPodSelectionModel = this.getPodSelectionModel(),
          oSelectedResource = oPodSelectionModel.stelSelectedResourceData;

        var sPlant = this.getPodController().getUserPlant(),
          sOperator = oSelectedResource.customData.OPERATOR,
          sOrder = oSelectedResource.customData.ORDER,
          sComponent = oSelectedResource.customData.MATERIAL;

        var sUrl = `https://dbapicall.cfapps.eu20-001.hana.ondemand.com/api/get/consumptionAnalysis?plant=${sPlant}&operator=${sOperator}&orderNo=${sOrder}&component=${sComponent}`;
        $.ajax({
          url: sUrl,
          type: 'GET',
          success: function (oResponseData) {
            console.log('Header Data fetch response ->', oResponseData);

            if (!oResponseData || oResponseData.length < 1) {
              return;
            }

            var oHeaderModel = this.getView().getModel('headerData'),
              oData = oResponseData[0];

            oHeaderModel.setProperty('/passPortion', oData.PASS_TOTAL);
            oHeaderModel.setProperty('/failPortion', oData.FAIL_TOTAL);
            oHeaderModel.setProperty('/portionCount', oData.PASS_TOTAL + oData.FAIL_TOTAL);
            oHeaderModel.setProperty('/cumulativeCount', oData.CUMULATIVE_FAIL_PORTION);
            oHeaderModel.setProperty('/consequtiveCount', oData.CONSECUTIVE_FAIL_COUNT);
            oHeaderModel.refresh(true);
          }.bind(this),
          error: function (oError) {
            console.error('Error in Header data API call', oError);
          }
        });
      },

      _loadTareData: function () {
        var oView = this.getView(),
          oPodSelectionModel = this.getPodSelectionModel(),
          oSelectedResource = oPodSelectionModel.stelSelectedResourceData;

        var sUrl = `https://dbapicall.cfapps.eu20-001.hana.ondemand.com/api/get/tareData`;
        var oParams = {
          plant: this.getPodController().getUserPlant(),
          resource: oSelectedResource.resource,
          operator: oSelectedResource.customData.OPERATOR,
          orderNo: oSelectedResource.customData.ORDER,
          component: oSelectedResource.customData.MATERIAL
        };

        this.ajaxGetRequest(
          sUrl,
          oParams,
          (oResponse) => {
            var oModel = oView.getModel('headerData');
            oModel.setProperty('/tareCount', oResponse.length);
          },
          (oError) => {
            console.error(...arguments);
            MessageBox.error(this.getI18nText('dataFetchErrMsg'));
          }
        );
      }
    });
  }
);
