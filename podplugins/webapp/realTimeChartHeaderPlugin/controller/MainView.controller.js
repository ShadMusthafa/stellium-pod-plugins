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
  function(
    PluginViewController,
    JSONModel,
    MessageToast,
    FlattenedDataset,
    FeedItem,
    ChartFormatter,
    Format,
    Filter,
    FilterOperator,
    MessageBox
  ) {
    'use strict';

    return PluginViewController.extend('stellium.ext.podplugins.realTimeChartHeaderPlugin.controller.MainView', {
      onInit: function(oEvent) {
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

      onBeforeRenderingPlugin: function() {
        this.updateHeaderInfo();
      },

      onExit: function() {
        this.unsubscribe('stelResourceSelectionEvent', this.handleResourceSelectionEvent, this);
      },

      handlePageChangeEvent: function(sChannelId, sEventId, oData) {
        if (oData.page === 'CHARTPAGE') {
          this.updateHeaderInfo();
        }
      },

      updateHeaderInfo: function() {
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
      },

      updatePanelExpanded: function(oViewData) {
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
      }
    });
  }
);
