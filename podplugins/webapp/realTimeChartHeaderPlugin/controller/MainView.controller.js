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

    return PluginViewController.extend('stellium.ext.podplugins.realTimeChartPlugin.controller.MainView', {
      settingsModel: {
        chartType: {
          name: 'Chart Type',
          defaultSelected: '0',
          values: [
            {
              key: '0',
              name: 'Line Chart with Dynamic Value Axis',
              vizType: 'timeseries_line',
              value: ['Revenue'],
              dataset: {
                dimensions: [
                  {
                    name: 'Date',
                    value: '{CONSUMPTION_DATE}',
                    dataType: 'date'
                  }
                ],
                measures: [
                  {
                    name: 'Actual',
                    // value: '{QUANTITY}'
                    value: '{QTY_IN_KG}'
                  },
                  {
                    name: 'TargetUpper',
                    // value: '{UPPER_TOLERANCE}'
                    value: '{UPPER_TOL_IN_KG}'
                  },
                  {
                    name: 'TargetLower',
                    // value: '{LOWER_TOLERANCE}'
                    value: '{LOWER_TOL_IN_KG}'
                  }
                ],
                data: {
                  path: '/data'
                }
              },
              vizProperties: {
                plotArea: {
                  window: {
                    start: 'firstDataPoint',
                    end: 'lastDataPoint'
                  },
                  dataLabel: {
                    formatString: ChartFormatter.DefaultPattern.SHORTFLOAT_MFD2,
                    visible: false
                  }
                },
                valueAxis: {
                  visible: true,
                  label: {
                    formatString: ChartFormatter.DefaultPattern.SHORTFLOAT
                  },
                  title: {
                    visible: false
                  }
                },
                timeAxis: {
                  title: {
                    visible: false
                  },
                  levels: ['second', 'minute', 'hour', 'day', 'month', 'year']
                },
                title: {
                  visible: false
                },
                interaction: {
                  syncValueAxis: true
                }
              }
            }
          ]
        }
      },

      onInit: function(oEvent) {
        // Call the base controller's onInit
        PluginViewController.prototype.onInit.apply(this, arguments);

        Format.numericFormatter(ChartFormatter.getInstance());

        var oView = this.getView();
        oView.setModel(new JSONModel(), 'data');
      },

      onBeforeRendering: function(oEvent) {},

      onBeforeRenderingPlugin: function() {
        this.subscribe('PageChangeEvent', this.handlePageChangeEvent, this);

        //Trigger initial load of chart data
        this._loadChartData();
      },

      onAfterRendering: function(oEvent) {
        this._initChart();
        this._initPopover();
      },

      onExit: function() {
        this.unsubscribe('PageChangeEvent', this.handlePageChangeEvent, this);
      },

      handlePageChangeEvent: function(sChannelId, sEventId, oData) {
        if (oData.page === 'CHARTPAGE') {
          this._loadChartData();
        }
      },

      onRefreshIconPress:function(){
        this._loadChartData();
      },

      _initChart: function() {
        var oVizFrame = this.getView().byId('idVizFrame'),
          oModel = this.getView().getModel('data');

        oVizFrame.destroyDataset();
        oVizFrame.destroyFeeds();
        oVizFrame.setModel(oModel);

        var oSelectedChartProps = this.settingsModel.chartType.values[0];
        oVizFrame.setVizType(oSelectedChartProps.vizType);

        var oDataSet = new FlattenedDataset(oSelectedChartProps.dataset);
        oVizFrame.setDataset(oDataSet);

        oVizFrame.setVizProperties(oSelectedChartProps.vizProperties);

        var feedTimeAxis = new FeedItem({
          uid: 'timeAxis',
          type: 'Dimension',
          values: ['Date']
        });

        var feedValueAxis = new FeedItem({
          uid: 'valueAxis',
          type: 'Measure',
          values: ['Actual', 'TargetUpper', 'TargetLower']
        });

        oVizFrame.addFeed(feedTimeAxis);
        oVizFrame.addFeed(feedValueAxis);
      },

      _initPopover: function() {
        var oView = this.getView(),
          oVizFrame = oView.byId('idVizFrame'),
          oPopover = oView.byId('idPopOver');
        oPopover.connect(oVizFrame.getVizUid());
        oPopover.setFormatString({
          Quantity: ChartFormatter.DefaultPattern.STANDARDFLOAT,
          Date: 'dd/MM/yyyy hh:mm:ss'
        });
      },

      _loadChartData: function() {
        var oView = this.getView(),
          sUrl = 'https://dbapicall.cfapps.eu20-001.hana.ondemand.com/api/get/realTimeConsumptionData';

        //Get the selected resource and create service payload
        var oPodSelectionModel = this.getPodSelectionModel(),
          oSelectedResource = oPodSelectionModel.stelSelectedResourceData,
          formattedDate = moment().subtract(1, 'days').utc().format('YYYY-MM-DD HH:mm:ss');

        var oPayload = {
          plant: this.getPodController().getUserPlant(),
          order: oSelectedResource.customData.ORDER,
          operator: oSelectedResource.customData.OPERATOR,
          component: oSelectedResource.customData.MATERIAL,
          resource: oSelectedResource.resource,
          fromDateAndTime: formattedDate
        };

        this.ajaxPostRequest(
          sUrl,
          oPayload,
          oResponse => {
            var oModel = oView.getModel('data');
            oModel.setProperty('/data', oResponse);
          },
          oError => {
            console.error(...arguments);
            MessageBox.error(this.getI18nText('dataFetchErrMsg'));
          }
        );
      }
    });
  }
);
