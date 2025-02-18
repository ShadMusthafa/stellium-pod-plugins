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
    MessageBox,
    NumberFormat
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
                    value: '{data>Date}',
                    dataType: 'date'
                  }
                ],
                measures: [
                  {
                    name: 'Cost',
                    value: '{data>Cost}'
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

      onInit: function(oEvent) {
        // Call the base controller's onInit
        PluginViewController.prototype.onInit.apply(this, arguments);

        Format.numericFormatter(ChartFormatter.getInstance());

        var oView = this.getView();
        oView.setModel(new JSONModel(), 'data');
        //TODO: Remove below item and replace with service call
        var oMockData = {
          data: [
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/16/2013',
              Revenue: 4114672.47,
              Cost: 1651069.9
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/17/2013',
              Revenue: 4102263.56,
              Cost: 1612699.35
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/18/2013',
              Revenue: 4045931.36,
              Cost: 1634043.2
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/19/2013',
              Revenue: 4047479.25,
              Cost: 1641802.05
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/20/2013',
              Revenue: 3969401.16,
              Cost: 1670427.78
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/21/2013',
              Revenue: 3963544.2,
              Cost: 1632849.44
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/22/2013',
              Revenue: 3936925.15,
              Cost: 1612415.82
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/23/2013',
              Revenue: 3846673.51,
              Cost: 1605320.87
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/24/2013',
              Revenue: 3918483.35,
              Cost: 1599169.52
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/25/2013',
              Revenue: 3906454.86,
              Cost: 1569188.34
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/26/2013',
              Revenue: 3843918.94,
              Cost: 1602834.06
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/27/2013',
              Revenue: 3800927.24,
              Cost: 1648604.67
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/28/2013',
              Revenue: 3839956.23,
              Cost: 1635140.35
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/29/2013',
              Revenue: 3874721.9,
              Cost: 1608242.5
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/30/2013',
              Revenue: 3892956.92,
              Cost: 1661427.09
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '5/31/2013',
              Revenue: 3883927.82,
              Cost: 1610235.98
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/1/2013',
              Revenue: 3840835.51,
              Cost: 1619765.63
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/2/2013',
              Revenue: 3803715.03,
              Cost: 1621362.93
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/3/2013',
              Revenue: 3807732.69,
              Cost: 1656153.12
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/4/2013',
              Revenue: 3800870.4,
              Cost: 1607146.15
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/5/2013',
              Revenue: 3751635.84,
              Cost: 1618429.91
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/6/2013',
              Revenue: 3730524.12,
              Cost: 1625863.14
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/7/2013',
              Revenue: 3700685.31,
              Cost: 1624820.63
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/8/2013',
              Revenue: 3675058.1,
              Cost: 1577386.63
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/9/2013',
              Revenue: 3678103.35,
              Cost: 1552635.47
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/10/2013',
              Revenue: 3699091.17,
              Cost: 1525174.12
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/11/2013',
              Revenue: 3538825.56,
              Cost: 1525701.53
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/12/2013',
              Revenue: 3553949.33,
              Cost: 1596956.82
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/13/2013',
              Revenue: 3606987.64,
              Cost: 1647852.91
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/14/2013',
              Revenue: 3625783.31,
              Cost: 1717306.54
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/15/2013',
              Revenue: 3639028.77,
              Cost: 1736622.62
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/16/2013',
              Revenue: 3659304.17,
              Cost: 1778705
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/17/2013',
              Revenue: 3698389.75,
              Cost: 1799278.57
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/18/2013',
              Revenue: 3783396.39,
              Cost: 1877925.83
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/19/2013',
              Revenue: 3722990.45,
              Cost: 1891284.75
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/20/2013',
              Revenue: 3617619.97,
              Cost: 1836461.76
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/21/2013',
              Revenue: 3675695.82,
              Cost: 1860459.15
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/22/2013',
              Revenue: 3787026.87,
              Cost: 1881472.38
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/23/2013',
              Revenue: 3780119.17,
              Cost: 1870202.8
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/24/2013',
              Revenue: 3765919.53,
              Cost: 1882223.7
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/25/2013',
              Revenue: 3705075.73,
              Cost: 1821588.65
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/26/2013',
              Revenue: 3737867.28,
              Cost: 1844228.2
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/27/2013',
              Revenue: 3764829.25,
              Cost: 1806763.43
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/28/2013',
              Revenue: 3803953.75,
              Cost: 1827483.04
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/29/2013',
              Revenue: 3749147.69,
              Cost: 1729439.23
            },
            {
              FixedLimit: '1000000',
              FixedLimit2: '3000000',
              FixedLimit3: '4000000',
              UPPER_TOLERANCE: 2000000,
              LOWER_TOLERANCE: 0,
              Date: '6/30/2013',
              Revenue: 3784917.64,
              Cost: 1759307.38
            }
          ]
        };
        oView.setModel(new JSONModel(oMockData), 'mockdata');
      },

      onBeforeRendering: function(oEvent) {},

      onBeforeRenderingPlugin: function() {
        this.subscribe('PageChangeEvent', this.handlePageChangeEvent, this);

        //Trigger initial load of chart data
        this._loadChartData();
      },

      onAfterRendering: function(oEvent) {
        this._initChart(0);
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

      onRefreshIconPress: function() {
        this._loadChartData();
      },

      onConsumeChartPress: function() {
        this._initChart(0);
        this._loadChartData();
      },
      onTareChartPress: function() {
        this._initChart(1);
        // this._loadChartData();
        var oMockModel = this.getView().getModel('mockdata');
        this.getView().getModel('data').setData(oMockModel.getData());
      },

      _initChart: function(iIdx) {
        var oVizFrame = this.getView().byId('idVizFrame'),
          oModel = this.getView().getModel('data');

        oVizFrame.destroyDataset();
        oVizFrame.destroyFeeds();
        oVizFrame.setModel(oModel);

        var oSelectedChartProps = this.settingsModel.chartType.values[iIdx];
        oVizFrame.setVizType(oSelectedChartProps.vizType);

        var oDataSet = new FlattenedDataset(oSelectedChartProps.dataset);
        oVizFrame.setDataset(oDataSet);

        oVizFrame.setVizProperties(oSelectedChartProps.vizProperties);

        var aFeeds = [];
        switch (iIdx) {
          case 0:
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
                values: ['Actual', 'TargetUpper', 'TargetLower']
              })
            );
            break;
          case 1:
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
                values: ['Cost']
              })
            );
            break;
        }
        aFeeds.forEach(oFeed => oVizFrame.addFeed(oFeed));
      },

      _initPopover: function() {
        var oView = this.getView(),
          oVizFrame = oView.byId('idVizFrame'),
          oPopover = oView.byId('idPopOver');

        var oChartFormatter = ChartFormatter.getInstance();
        oChartFormatter.registerCustomFormatter('quantityKG', function(value) {
          return value ? value + ' KG' : '';
        });

        oPopover.connect(oVizFrame.getVizUid());
        oPopover.setFormatString({
          Actual: 'quantityKG',
          TargetUpper: 'quantityKG',
          TargetLower: 'quantityKG',
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
