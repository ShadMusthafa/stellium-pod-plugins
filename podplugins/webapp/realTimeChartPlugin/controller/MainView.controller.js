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
    'sap/m/MessageBox',
    'sap/ui/core/format/NumberFormat'
  ],
  function (PluginViewController, JSONModel, MessageToast, FlattenedDataset, FeedItem, ChartFormatter, Format, Filter, FilterOperator, MessageBox, NumberFormat) {
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
                  },
                  {
                    name: 'BomUpper',
                    value: '{BOM_UPPER_TOL}'
                  },
                  {
                    name: 'BomLower',
                    value: '{BOM_LOWER_TOL}'
                  }
                ],
                data: {
                  path: '/data'
                }
              },
              vizProperties: {
                plotArea: {
                  window: {
                    start: null,
                    end: 'lastDataPoint'
                  },
                  dataLabel: {
                    formatString: ChartFormatter.DefaultPattern.SHORTFLOAT_MFD2,
                    visible: false
                  },
                  adjustScale: true
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
            },
            {
              key: '1',
              name: 'Scatter Plot with time axis',
              vizType: 'timeseries_scatter',
              value: ['Revenue'],
              dataset: {
                dimensions: [
                  {
                    name: 'Date',
                    value: '{tareData>CONSUMPTION_DATE}',
                    dataType: 'date'
                  }
                ],
                measures: [
                  {
                    name: 'Quantity',
                    value: '{tareData>TARE_ACTUAL_WEIGHT}'
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
                  },
                  adjustScale: true
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
                  levels: ['day', 'month', 'year']
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

      onInit: function (oEvent) {
        // Call the base controller's onInit
        PluginViewController.prototype.onInit.apply(this, arguments);

        Format.numericFormatter(ChartFormatter.getInstance());

        var oView = this.getView();
        oView.setModel(new JSONModel({ data: [] }), 'data');
        oView.setModel(new JSONModel({ data: [] }), 'tareData');

        this.selectedChart = 0; //Consumption chart selected by default
      },

      onBeforeRendering: function (oEvent) {},

      onBeforeRenderingPlugin: function () {
        this.subscribe('PageChangeEvent', this.handlePageChangeEvent, this);

        //Trigger initial load of chart data
        this._loadChartData();

        //Auto refresh the data after 5minutes
        this.refreshInterval = setInterval(() => {
          // this.onRefreshIconPress();
          this._refreshChartData();
          console.log('Refreshing chart data');
        }, 5 * 60 * 1000);
      },

      onAfterRendering: function (oEvent) {
        this._initChart(0);
        this._initPopover();
      },

      onExit: function () {
        this.unsubscribe('PageChangeEvent', this.handlePageChangeEvent, this);
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      },

      handlePageChangeEvent: function (sChannelId, sEventId, oData) {
        //TODO: Change chart type to 'Consumption'
        if (oData.page === 'CHARTPAGE') {
          this._loadChartData();
        }
      },

      onChartContainerDimensionChange: function (oEvent) {
        var iSelectedKey = parseInt(oEvent.getSource().getSelectedKey());
        this.selectedChart = iSelectedKey;
        switch (iSelectedKey) {
          case 0:
            this._loadChartData();
            this._initChart(0);
            break;

          case 1:
            // var oMockModel = this.getView().getModel('mockdata');
            // this.getView().getModel('data').setData(oMockModel.getData());
            this._loadTareData();
            this._initChart(1);
            break;
        }
      },

      onRefreshIconPress: function () {
        this._refreshChartData();
        // this._loadChartData();
        // this._loadTareData();
        // this.publish('stelReloadChartData', {
        //   source: this,
        //   sendToAllPages: true
        // });
      },

      _refreshChartData: function () {
        switch (this.selectedChart) {
          case 0:
            this._loadChartData();
            break;

          case 1:
            this._loadTareData();
            break;
        }

        this.publish('stelReloadChartData', {
          source: this,
          sendToAllPages: true
        });
      },

      onConsumeChartPress: function () {
        this._loadChartData();
        this._initChart(0);
      },
      onTareChartPress: function () {
        this._initChart(1);
        // this._loadChartData();
        var oMockModel = this.getView().getModel('mockdata');
        this.getView().getModel('data').setData(oMockModel.getData());
      },

      _initChart: function (iIdx) {
        var oVizFrame = this.getView().byId('idVizFrame'),
          oModel = this.getView().getModel('data');

        oVizFrame.destroyDataset();
        oVizFrame.destroyFeeds();
        // oVizFrame.setModel(oModel);

        var aFeeds = [];
        switch (iIdx) {
          case 0:
            var oConsumptionModel = this.getView().getModel('data');
            oVizFrame.setModel(oConsumptionModel);
            aFeeds.push(
              new FeedItem({
                uid: 'timeAxis',
                type: 'Dimension',
                values: ['Date']
              })
            );
            aFeeds.push(
              new FeedItem({
                uid: 'valueAxis',
                type: 'Measure',
                values: ['Actual', 'TargetUpper', 'TargetLower', 'BomUpper', 'BomLower']
              })
            );
            break;
          case 1:
            var oTareModel = this.getView().getModel('tareData');
            oVizFrame.setModel(oTareModel);
            aFeeds.push(
              new FeedItem({
                uid: 'timeAxis',
                type: 'Dimension',
                values: ['Date']
              })
            );
            aFeeds.push(
              new FeedItem({
                uid: 'valueAxis',
                type: 'Measure',
                values: ['Quantity']
              })
            );
            break;
        }

        var oSelectedChartProps = this.settingsModel.chartType.values[iIdx];
        oVizFrame.setVizType(oSelectedChartProps.vizType);

        var oDataSet = new FlattenedDataset(oSelectedChartProps.dataset);
        oVizFrame.setDataset(oDataSet);

        oVizFrame.setVizProperties(oSelectedChartProps.vizProperties);
        aFeeds.forEach((oFeed) => oVizFrame.addFeed(oFeed));
      },

      _initPopover: function () {
        var oView = this.getView(),
          oVizFrame = oView.byId('idVizFrame'),
          oPopover = oView.byId('idPopOver');

        var oChartFormatter = ChartFormatter.getInstance();
        oChartFormatter.registerCustomFormatter('quantityKG', function (value) {
          return value ? value + ' KG' : '';
        });

        oPopover.connect(oVizFrame.getVizUid());
        oPopover.setFormatString({
          Actual: 'quantityKG',
          TargetUpper: 'quantityKG',
          TargetLower: 'quantityKG',
          BomUpper: 'quantityKG',
          BomLower: 'quantityKG',
          Quantity: 'quantityKG',
          Date: 'dd/MM/yyyy hh:mm:ss'
        });
      },

      _loadChartData: function () {
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
          (oResponse) => {
            // var oModel = oView.getModel('data');
            // oModel.setProperty('/data', oResponse);
            // oModel.refresh(true);
            // this._initChart(this.selectedChart);
            var oModel = new JSONModel({ data: oResponse });
            oView.setModel(oModel, 'data');
            this._initChart(this.selectedChart);
          },
          (oError) => {
            console.error(...arguments);
            MessageBox.error(this.getI18nText('dataFetchErrMsg'));
          }
        );
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
            // var oModel = oView.getModel('tareData');
            // oModel.setProperty('/data', oResponse);
            // oModel.refresh(true);
            var oModel = new JSONModel({ data: oResponse });
            oView.setModel(oModel, 'tareData');
            this._initChart(this.selectedChart);
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
