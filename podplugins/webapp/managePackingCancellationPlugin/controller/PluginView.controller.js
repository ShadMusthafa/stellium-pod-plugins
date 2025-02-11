sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/dm/dme/util/PlantSettings',
    'sap/base/Log',
    'sap/m/TablePersoController',
    'sap/m/Token',
    '../util/formatter',
    "sap/ui/core/Fragment",
  ],
  function(JSONModel, PluginViewController, PlantSettings, Log, TablePersoController, Token, Formatter, Fragment) {
    'use strict';

    var oLogger = Log.getLogger('resourceListPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.managePackingCancellationPlugin.controller.PluginView',
      {
        metadata: {
          properties: {}
        },

        formatter: Formatter,

        onInit: function() {
          PluginViewController.prototype.onInit.apply(this, arguments);

          // Set initial focused date values for filters
          const oStartDateInput = this.byId('idPlannedStartInput'),
            oEndDateInput = this.byId('idPlannedEndInput'),
            oCurrentDate = new Date();

          oStartDateInput.setInitialFocusedDateValue(
            new Date(oCurrentDate.getFullYear(), oCurrentDate.getMonth(), oCurrentDate.getDate(), 0, 0, 0)
          );

          oEndDateInput.setInitialFocusedDateValue(
            new Date(oCurrentDate.getFullYear(), oCurrentDate.getMonth(), oCurrentDate.getDate(), 23, 59, 59)
          );

          // Pageable settings
          this.oPageable = {
            size: 20,
            page: 0
          };

          //Create table personalization se`rvice
          const TablePersonalizeService = {
            oData: {
              _persoSchemaVersion: '1.0',
              aColumns: []
            },

            getPersData: function() {
              const oDeferred = new jQuery.Deferred();
              if (!this._oBundle) {
                this._oBundle = this.oData;
              }
              const oBundle = this._oBundle;
              oDeferred.resolve(oBundle);
              return oDeferred.promise();
            },

            setPersData: function(oBundle) {
              const oDeferred = new jQuery.Deferred();
              this._oBundle = oBundle;
              oDeferred.resolve();
              return oDeferred.promise();
            }
          };
          TablePersonalizeService.getPersData();
          TablePersonalizeService.setPersData({});

          // Initialize table settings
          this._oTableSettings = new TablePersoController({
            table: this.byId('idOrdersTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          // Set up models
          this.getView().setModel(new JSONModel([]), 'masterList');
          this.getView().setModel(new JSONModel({}), 'filterBarModel');
          this.getView().setModel(new JSONModel({ title: '' }), 'orderListTitle');

          // Set plant timezone
          // this._sPlantTimeZoneId = d.getTimeZone();

          // Set refresh flag
          this.refresh = true;
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {
          // Add a validator to the 'sfcFilter' control
          this.byId('idSFCFilterInput').addValidator(function(input) {
            return new Token({
              key: input.text,
              text: input.text
            });
          });

          // Store the route arguments
          this.onOrdersSearch(false);
        },

        onExit: function() {
          PluginViewController.prototype.onExit.apply(this, arguments);
        },

        onBeforeRendering: function() {},

        onAfterRendering: function() {},

        onRouteMatched: function(event) {
          // Add a validator to the 'sfcFilter' control
          this.byId('idSFCFilterInput').addValidator(function(input) {
            return new Token({
              key: input.text,
              text: input.text
            });
          });

          // Store the route arguments
          this._oRouterArgs = event.getParameter('arguments');
          this.onOrdersSearch(false);
        },

        onDateChange: function(oEvent) {
          const plannedStartDate = this.byId('idPlannedStartInput').getDateValue();
          const plannedCompleteDate = this.byId('idPlannedEndInput').getDateValue();
          const sourceControl = oEvent.oSource;

          if (plannedStartDate && plannedCompleteDate && plannedCompleteDate < plannedStartDate) {
            // If the completion date is before the start date, show an error state
            sourceControl.setValueState('Error');
            sourceControl.setValueStateText(this.getI18nText('message.startDateBeforeCompletionDate'));
          } else {
            // Clear any error states
            this.byId('idPlannedStartInput').setValueState('None');
            this.byId('idPlannedEndInput').setValueState('None');
          }
        },

        onOrdersSearch: function(oEvent) {
          if (oEvent) {
            this.page = 0;
          }

          var oOrdersTable = this.byId('idOrdersTable');
          oOrdersTable.setBusyIndicatorDelay(0);
          oOrdersTable.setBusy(true);

          // Get the locale string from the SAP core configuration
          let locale = sap.ui.getCore().getConfiguration().getLocale().toLocaleString();

          // Construct the data source URL
          //   let dataSourceUri = this.getOwnerComponent().getDataSourceUriByName('demand-RestSource');
          let dataSourceUri = this.getDemandRestDataSourceUri();
          let sUrl =
            dataSourceUri +
            'cancellation/postings?sort=createdDateTime,desc&locale=' +
            locale +
            '&size={pageSize}&page={page}' +
            this._getFilters();

          // Replace placeholders with actual values
          sUrl = sUrl.replace('{pageSize}', 20).replace('{page}', oEvent ? 0 : this.page);

          // Make the GET request
          this.ajaxGetRequest(
            sUrl,
            {},
            function(response) {
              const content = response.content || [];
              // this.getView().getModel('MasterList').setProperty('/', { value: content });

              let currentDataLength = this.getView().getModel('masterList').getData().length;

              if (currentDataLength === 0 || oEvent) {
                this.getView().getModel('masterList').setData(content);
              } else {
                this.getView()
                  .getModel('masterList')
                  .setData(this.getView().getModel('masterList').getData().concat(content));
              }

              let totalElements = response.totalElements;
              const title = this.getI18nText('order.list.title', [totalElements]);

              this.getView().getModel('orderListTitle').setProperty('/title', title);

              currentDataLength = this.getView().getModel('masterList').getData().length;

              if (currentDataLength === +totalElements) {
                oOrdersTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return true;
                };
                oOrdersTable.setGrowingTriggerText('');
              } else {
                oOrdersTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return false;
                };
                const growingText = this.getI18nText('growingTriggerText', [currentDataLength, totalElements]);
                oOrdersTable.setGrowingTriggerText(growingText);
              }

              oOrdersTable.setBusy(false);
            }.bind(this)
            // this._requestFailure.bind(this)
          );
        },

        onOrderListSettingsBtnPress: function() {
          this._oTableSettings.openDialog();
        },

        onBeforeTableUpdate: function(oEvent) {
          if (oEvent.getParameters().reason === 'Growing') {
            this.page++;
            this.onOrdersSearch();
          }
        },

        onListItemPress: function(oEvent) {
          const sPath = oEvent.getSource().getBindingContextPath();
          const oShopOrder = this.getView().getModel('masterList').getProperty(sPath);

          this.getOwnerComponent().displayTarget('OrderDetail', {
            '?query': {
              sfcRef: oShopOrder.sfcRef,
              sfc: oShopOrder.sfcIdentifier,
              shopOrder: oShopOrder.shopOrder.shopOrder,
              material: oShopOrder.shopOrder.actualMaterial && encodeURIComponent(oShopOrder.shopOrder.actualMaterial.name),
              materialVersion: oShopOrder.shopOrder.actualMaterial && oShopOrder.shopOrder.actualMaterial.version,
              materialDescription:
                oShopOrder.shopOrder.actualMaterial && encodeURIComponent(oShopOrder.shopOrder.actualMaterial.defaultDescription),
              plannedBatch: oShopOrder.shopOrder.batchNumber || '',
              executionStatus: oShopOrder.shopOrder.executionStatus
            }
          });
        },

        _getFilters: function() {
          const filters = [];
          const filterData = {};

          // Get the search payload value and encode it
          let freeSearchValue = encodeURIComponent(this.byId('idOrderSF').getValue());

          // Get the SFC filter tokens and map them to their keys
          const sfcTokens = this.byId('idSFCFilterInput').getTokens().map(function(token) {
            return token.getKey();
          });

          // Get the planned start and complete date values
          const plannedStartDate = this.byId('idPlannedStartInput').getDateValue();
          const plannedCompleteDate = this.byId('idPlannedEndInput').getDateValue();

          // Ensure locale is loaded (though it seems unused here)
          sap.ui.getCore().getConfiguration().getLocale().toLocaleString();

          // Add free search value to filters if present
          if (freeSearchValue) {
            filters.push('freeSearch=' + freeSearchValue);
          }

          // Add SFC filters if tokens are present
          if (sfcTokens.length) {
            filterData.sfcs = sfcTokens;
            const sfcKeys = sfcTokens.join(',');
            filters.push('sfcs=' + sfcKeys);
          }

          // Add planned start date filter if present
          if (plannedStartDate) {
            filterData.plannedStartDateFilter = plannedStartDate.toISOString();
            filters.push('orderPlannedStartDate=' + this.getPlantDate(plannedStartDate));
          }

          // Add planned complete date filter if present
          if (plannedCompleteDate) {
            filterData.plannedCompleteDateFilter = plannedCompleteDate.toISOString();
            filters.push('orderPlannedEndDate=' + this.getPlantDate(plannedCompleteDate));
          }

          // Return the filters as a URL query string if any filters are present
          return filters.length ? '&' + filters.join('&') : '';
        },

        getPlantDate: function(oDate) {
          if (typeof oDate !== 'string' && oDate) {
            // Get the time zone, default to 'Africa/Bamako' if not available
            let timeZone = PlantSettings.getTimeZone && PlantSettings.getTimeZone();
            timeZone = timeZone || 'Africa/Bamako';

            // Format the date using the specified time zone
            return moment.tz(Formatter.dateFormat(oDate, 'yyyy-MM-dd hh:mm:ss'), timeZone).utc().format();
          }
          // Return the input as-is if it's a string or falsy
          return oDate;
        },
        onOrderListGroupingBtnPress: function () {
          var oView = this.getView();
          if (!this._oFilterDialog) {
              Fragment.load({
                  id: oView.getId(),
                  name: "stellium.ext.podplugins.managePackingCancellationPlugin.view.fragments.GroupSettingsDialog",
                  controller: this
              }).then(function (oDialog) {
                  this._oFilterDialog = oDialog;
                  oView.addDependent(this._oFilterDialog);
                  this._oFilterDialog.open();
              }.bind(this));
          } else {
              this._oFilterDialog.open();
          }
      },
      
      onConfirmGroup: function (oEvent) {
          var oTable = this.byId("idOrdersTable");
          var mParams = oEvent.getParameters();
          var sGroupKey;
          if (mParams.groupItem) {
              sGroupKey = mParams.groupItem.getKey();
          } else {
              oTable.getBinding("items").sort(null);
              return;
          }
          var oBinding = oTable.getBinding("items");
          oBinding.sort(new sap.ui.model.Sorter(sGroupKey, mParams.groupDescending, function (oContext) {
              var sValue;        
              if (sGroupKey === "shopOrder") {
                  sValue = oContext.getProperty(sGroupKey + "/shopOrder");
              } else {
                  sValue = oContext.getProperty(sGroupKey);
              }
              return {
                  key: sValue,
                  text: sValue,
              };
          }));
      },
      
      onCancelGroup: function () {
          sap.m.MessageToast.show("Group action canceled.");
      },


      }
    );

    return oPluginViewController;
  }
);
