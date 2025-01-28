sap.ui.define(
  [
    'sap/dm/dme/podfoundation/controller/ListPluginViewController',
    'stellium/ext/podplugins/packingPlugin/controller/CreatePackDialog',
    'stellium/ext/podplugins/packingPlugin/util/PackingPluginFormatter',
    'sap/dm/dme/formatter/GeneralFormatter',
    'sap/dm/dme/formatter/StatusFormatter',
    'sap/dm/dme/formatter/ObjectTypeFormatter',
    'sap/dm/dme/service/ServiceClient',
    'sap/dm/dme/types/BrowserDateTimeType',
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/controller/ListFilter',
    'stellium/ext/podplugins/packingPlugin/controller/browse/PuMaterialBrowse',
    'sap/base/security/encodeURL',
    'sap/dm/dme/message/ErrorHandler',
    'stellium/ext/podplugins/packingPlugin/controller/extensions/PluginEventExtension',
    'sap/dm/dme/podfoundation/controller/extensions/NotificationExtension',
    'sap/dm/dme/podfoundation/controller/extensions/LifecycleExtension',
    'stellium/ext/podplugins/packingPlugin/controller/extensions/CreateExtension'
  ],
  function(
    ListPluginViewController,
    CreatePackDialog,
    PackingPluginFormatter,
    GeneralFormatter,
    StatusFormatter,
    ObjectTypeFormatter,
    ServiceClient,
    BrowserDateTimeType,
    JSONModel,
    ListFilter,
    PuMaterialBrowse,
    encodeURL,
    ErrorHandler,
    PluginEventExtension,
    NotificationExtension,
    LifecycleExtension,
    CreateExtension
  ) {
    'use strict';
    const PUBLIC_FINAL = { public: true, final: true };
    const PUBLIC_NOT_FINAL = { public: true, final: false };

    return ListPluginViewController.extend('stellium.ext.podplugins.packingPlugin.controller.PackingUnits', {
      // extension interface
      metadata: {
        methods: {
          onPackingUnitChangeEvent: PUBLIC_NOT_FINAL,
          onPackPressEvent: PUBLIC_NOT_FINAL,
          onUnpackPressEvent: PUBLIC_NOT_FINAL,
          handleOnBeforeRendering: PUBLIC_FINAL,
          handleOnBeforeRenderingPlugin: PUBLIC_FINAL,
          handleOnAfterRendering: PUBLIC_FINAL,
          handleOnExit: PUBLIC_FINAL,
          getSelectedPackingUnitData: PUBLIC_FINAL,
          findMaterialData: PUBLIC_FINAL,
          setControlErrorState: PUBLIC_FINAL,
          createPackDialog: PUBLIC_NOT_FINAL
        }
      },
      generalFormatter: GeneralFormatter,
      oEventBus: sap.ui.getCore().getEventBus(),
      oServiceClient: new ServiceClient(),
      packingPluginFormatter: PackingPluginFormatter,
      statusFormatter: StatusFormatter,
      types: { browserdatetime: new BrowserDateTimeType() },
      sMaterialFilterRef: '', // must not be null or undefined. Use empty string instead.

      /***
       * Lifecycle Core functions & Extensions
       ***/
      onBeforeRendering: function() {
        this.lifecycleExtension.onBeforeRendering();
      },

      /**
       * Setup the main models, flags and formatters.
       *
       * @override
       */
      handleOnBeforeRendering: function() {
        this.getView().setModel(
          new JSONModel({
            availableObjectsSelectedTab: 'availableSfcsTab',
            availableSfcsListLength: 0,
            availableSfcsSearchValue: null,
            assignedObjectsListLength: 0,
            assignedObjectsSearchValue: null,
            availableSfcsSelectedAndValid: false,
            assignedItemsSelected: false,
            packingUnitsLength: 0,
            availablePusLength: 0
          }),
          'viewModel'
        );
        ObjectTypeFormatter.init(this.getOwnerComponent().getModel('i18n-objectType').getResourceBundle());
        StatusFormatter.init(this.getOwnerComponent().getModel('i18n-status').getResourceBundle());
        // load packing unit list by odata
        this.loadPackingUnitsList();
        this.initializeUnitsListFilterBar();
      },

      /**
       * @see sap.dm.dme.podfoundation.controller.PluginViewController#onBeforeRenderingPlugin
       * @override
       */
      onBeforeRenderingPlugin: function() {
        this.lifecycleExtension.onBeforeRenderingPlugin();
      },

      onAfterRendering: function() {
        this.lifecycleExtension.onAfterRendering();
      },

      /**
       * @override
       */
      onExit: function() {
        ListPluginViewController.prototype.onExit.apply(this, arguments);
        this.lifecycleExtension.onExit();
      },

      initializeUnitsListFilterBar: function() {
        let oUnitsList = this.byId('packingUnitsList');
        let oUnitsListFilterBar = this.byId('packingUnitsListFilterBar');
        let oUnitsListSearchField = this.byId('packingUnitsSearch');

        this.oUnitsListFilter = new ListFilter({
          aLiveSearchProperties: ['number'],
          sLiveSearchFieldId: oUnitsListSearchField.getId(),
          oListBinding: oUnitsList.getBinding('items'),
          sListBindingPath: '/GetPackingsList()',
          oFilterBar: oUnitsListFilterBar,
          aVariantFilterInfo: [
            {
              sFilterItemName: 'availableSfcsShopOrderFilterItem',
              sSearchProperty: 'shopOrder',
              oFilterOperator: sap.ui.model.FilterOperator.Contains
            },
            {
              sFilterItemName: 'materialFilterItem',
              sSearchProperty: 'material',
              oFilterOperator: sap.ui.model.FilterOperator.Contains
            }
          ]
        });
      },

      /**
       * The "pluginEventExtension" extension definition.  The "pluginEventExtension"
       * is responsible for implementing the plugin event listener functions
       */
      pluginEventExtension: PluginEventExtension,

      /**
       * The "notificationExtension" extension definition.  The "notificationExtension"
       * is responsible for implementing the extensions for suporting custom notifications
       */
      notificationExtension: NotificationExtension,

      /**
       * The "LifecycleExtension" extension definition.  The "LifecycleExtension"
       * is responsible for implementing the lifecycle functions
       */
      lifecycleExtension: LifecycleExtension,

      /**
       * The "CreateExtension" extension definition.  The "CreateExtension"
       * is responsible for implementing the core function
       */
      createExtension: CreateExtension,

      /**
       * @override sap.dm.dme.podfoundation.controller.PluginViewController#getNotificationExtension
       */
      getNotificationExtension: function() {
        return this.notificationExtension;
      },

      onFilterBarValueChange: function() {
        this.loadPackingUnitsList();
      },

      onClosePluginPress: function() {
        if (this._sDisplayType === 'popup_modal') {
          this.closePlugin(this);
        } else {
          this.navigateToMainPage();
        }
      },

      onPackingUnitPressed: function(oEvent) {
        this.getOwnerComponent().displayTarget('packingUnitDetails', this.getSelectedPackingUnitData(oEvent));
      },

      onCreatePackingUnitPressed: function() {
        // if (!this.oDialog) {
        //   this.oDialog = this.createPackDialog();
        // }

        // this.oDialog.open();
        const Order = this.getPodSelectionModel().getSelection().getShopOrder().shopOrder;
        const Operation = this.getPodSelectionModel().getSelection().getSfcData().operation;
        const SFC = this.getPodSelectionModel().getSelection().getSfcData().sfc;
        window.open(`https://djn-s4dev.daajan.com:44300/sap/bc/ui2/flp?sap-system-login-oninputprocessing=onProceed&sap-urlscheme=http&sap-client=110&sap-language=EN#ZHU02-create?sap-ui-tech-hint=GUI?Order=${Order}&Operation=${Operation}&Username=Lohith&SFC=${SFC}&Phase=0001`, "_blank");

      },

      /**
       *
       * @returns {"sap.ui.base.Object"} Instance of a sap.ui.base.Object
       * @public
       */
      createPackDialog: function() {
        return this.createExtension.createPackDialog(this);
      },

      onPackingUnitsSearch: function() {
        this.loadPackingUnitsList();
      },

      /**
       * Returns { id, status } of the selected Packing Unit item in the table
       * @param {Object} oEvent SAPUI5 press Event payload.
       * @returns {{id: string, status: string}} ID and Status of the selected Packing Unit.
       * @public
       */
      getSelectedPackingUnitData: function(oEvent) {
        let oSelectedItem = oEvent.getSource().getSelectedItem();
        let oBindingContext = oSelectedItem.getBindingContext('packing');

        return { id: oBindingContext.getProperty('id'), status: oBindingContext.getProperty('status') };
      },

      getViewModel: function() {
        return this.getView().getModel('viewModel');
      },

      // Work Center POD and Operation POD return different getResource objects.
      // WC POD returns a string with resource name, while Operation POD returns an object with resource name.
      getResourceFromPodSelectionModel: function(oPodSelectionModel) {
        const oResource = oPodSelectionModel.getResource();
        if (!oResource) {
          return '';
        }

        if (oResource.resource) {
          return oResource.resource;
        }

        return oResource;
      },

      loadPackingUnitsList: function(sSearchValue) {
        let oPodSelectionModel = this.getPodSelectionModel();

        let sResource = this.getResourceFromPodSelectionModel(oPodSelectionModel);
        let sQuery = sSearchValue || this.byId('packingUnitsSearch').getValue();

        const sFilter = this.createFilterArgumentParam(sResource);

        let oUnitsList = this.byId('packingUnitsList');
        let oUnitsListItem = this.byId('unitsListItem');
        let sErrorMessage = this.getI18nText('error.packingUnitsFetchFail.msg');

        // resource in function call should be empty and its value should be in filter
        let sUrl = `packing>/GetPackingsList(resource='',number='${sQuery}',order='',material='')`;

        const oBindParams = {
          path: sUrl,
          template: oUnitsListItem,
          events: {
            dataRequested: function() {
              oUnitsList.setBusy(true);
            },
            dataReceived: function(oResponse) {
              oUnitsList.setNoDataText(oResponse.getParameter('error') ? sErrorMessage : null);
              oUnitsList.setBusy(false);
            }
          },
          sorter: new sap.ui.model.Sorter('modifiedDateTime', true)
        };

        if (sFilter) {
          oBindParams.parameters = { $filter: sFilter };
        }
        oUnitsList.bindItems(oBindParams);
      },

      onPackingUnitsListUpdate: function() {
        let oPodSelectionModel = this.getPodSelectionModel();
        let sResource = this.getResourceFromPodSelectionModel(oPodSelectionModel);
        let sQuery = this.byId('packingUnitsSearch').getValue();

        const sFilter = this.createFilterArgument(sResource);

        // resource in function call should be empty and its value should be in filter
        let sUrl = `${this.getPackingODataSourceUri()}GetPackingsList(resource='',number='${sQuery}',order='',material='')/$count${sFilter}`;

        return this.oServiceClient.get(sUrl, null).then(oResponse => {
          this.getView().getModel('viewModel').setProperty('/packingUnitsLength', oResponse);
        });
      },

      onMaterialBrowse: function(oEvent) {
        let oMaterialField = oEvent.getSource();
        let oModel = this.getOwnerComponent().getModel('product');
        const sFilterQuery =
          "(materialType eq com.sap.mes.odata.MaterialType'PACKAGING' or materialType eq" +
          " com.sap.mes.odata.MaterialType'RETURNABLE_PACKAGING') and currentVersion eq true";
        PuMaterialBrowse.open(
          this.getView(),
          oMaterialField.getValue(),
          oSelectedObject => {
            this.sMaterialFilterRef = oSelectedObject.ref;
            oMaterialField.setValue(oSelectedObject.name);
            oMaterialField.setValueState(sap.ui.core.ValueState.None);
            this.loadPackingUnitsList();
          },
          oModel,
          sFilterQuery
        );
      },

      /**
       * Create full Filter statement for the OData request
       * @param sResource
       * @returns {string} full filter with material or resource in filter statements. The values are encoded.
       */
      createFilterArgument: function(sResource) {
        const sMaterialRef = this.sMaterialFilterRef;
        if (!sResource && !sMaterialRef) {
          return '';
        }

        if (this.sMaterialFilterRef && !sResource) {
          return `?$filter=contains(material,'${encodeURIComponent(sMaterialRef)}')`;
        }

        if (!this.sMaterialFilterRef && sResource) {
          return `?$filter=resource eq '${encodeURIComponent(sResource)}'`;
        }

        if (this.sMaterialFilterRef && sResource) {
          return `?$filter=contains(material,'${encodeURIComponent(sMaterialRef)}') and resource eq '${encodeURIComponent(sResource)}'`;
        }
      },

      /**
       * Creates a filter parameter for bindItems function call.
       * Used with OData bindings.
       * @param sResource
       * @returns {string} filter with material or resource in filter statements. The values are not encoded.
       */
      createFilterArgumentParam: function(sResource) {
        const sMaterialRef = this.sMaterialFilterRef;
        if (!sResource && !sMaterialRef) {
          return '';
        }

        if (this.sMaterialFilterRef && !sResource) {
          return `contains(material,'${sMaterialRef}')`;
        }

        if (!this.sMaterialFilterRef && sResource) {
          return `resource eq '${sResource}'`;
        }

        if (this.sMaterialFilterRef && sResource) {
          return `contains(material,'${sMaterialRef}') and resource eq '${sResource}'`;
        }
      },

      onUnitsListFilterBarClear: function() {
        const oMaterialField = this.byId('unitsListMaterialFilter');
        oMaterialField.setValue('');
        this.sMaterialFilterRef = '';
        this.loadPackingUnitsList();
      },

      /**
       * Uses sMaterialInputValue as an input for search via production service
       * for given material. Ignores string cases.
       * @param {String} sMaterialInputValue Material name (or part of it). Can be upper or lower case.
       * @returns {Promise} resolves with either found material or with null (if not found). Rejects if the network fails.
       * @public
       */
      findMaterialData: function(sMaterialInputValue) {
        const sUrl = `${this.getProductDataSourceUri()}Materials`;
        const sQuery =
          `$filter=(material eq '${encodeURL(sMaterialInputValue.toUpperCase())}')` +
          ` and (materialType eq com.sap.mes.odata.MaterialType'PACKAGING' or materialType eq` +
          ` com.sap.mes.odata.MaterialType'RETURNABLE_PACKAGING') and currentVersion eq true`;

        return this.oServiceClient.get(sUrl, sQuery).then(oResponse => {
          if (oResponse.value.length > 0 && oResponse.value[0].material.toUpperCase() === sMaterialInputValue.toUpperCase()) {
            return oResponse.value[0];
          } else {
            return null;
          }
        });
      },

      onMaterialSelectionChange: function(oEvent) {
        const oMaterialInput = oEvent.getSource();
        const sMaterialInputValue = oMaterialInput.getValue();
        oMaterialInput.setValueState(sap.ui.core.ValueState.None);

        if (sMaterialInputValue) {
          return this.findMaterialData(sMaterialInputValue)
            .then(oMaterial => {
              if (oMaterial) {
                this.sMaterialFilterRef = oMaterial.ref;
                oMaterialInput.setValue(oMaterial.material);
                this.loadPackingUnitsList();
              } else {
                this.sMaterialFilterRef = '';
                this.setControlErrorState(oMaterialInput);
              }
            })
            .catch(oError => {
              this.showErrorMessage(oError);
              this.sMaterialFilterRef = '';
              this.setControlErrorState(oMaterialInput);
            });
        } else {
          this.sMaterialFilterRef = '';
          this.loadPackingUnitsList();
          return Promise.resolve();
        }
      },

      setControlErrorState: function(oControl, sMessageId) {
        ErrorHandler.setErrorState(oControl);
        if (sMessageId) {
          oControl.setValueStateText(this.getI18nText(sMessageId));
        }
      }
    });
  }
);
