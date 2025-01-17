sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/base/Log',
    'sap/m/MessageBox',
    '../util/ErrorHandler'
  ],
  function(JSONModel, PluginViewController, Log, MessageBox, ErrorHandler) {
    'use strict';

    var oLogger = Log.getLogger('massOperatorAssignmentPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend('stellium.ext.podplugins.massOperatorAssignmentPlugin.controller.PluginView', {
      metadata: {
        properties: {}
      },

      onInit: function() {
        if (PluginViewController.prototype.onInit) {
          PluginViewController.prototype.onInit.apply(this, arguments);
        }

        var oViewData = {
          isDirty: false,
          tableHeaderBtn: {
            assign: {
              enabled: false
            },
            revoke: {
              enabled: false
            },
            add: {
              enabled: false
            },
            remove: {
              enabled: false
            }
          }
        };

        this.materialsList = {};

        this.getView().setModel(new JSONModel(oViewData), 'viewModel');
        this.getView().setModel(new JSONModel([]), 'resourceData');
        this.getView().setModel(new JSONModel({}), 'orderData');
        this.getView().setModel(new JSONModel([]), 'recipeData');
      },

      /**
     * @see PluginViewController.onBeforeRenderingPlugin()
     */
      onBeforeRenderingPlugin: function() {},

      onExit: function() {
        if (PluginViewController.prototype.onExit) {
          PluginViewController.prototype.onExit.apply(this, arguments);
        }
      },

      onBeforeRendering: function() {},

      onAfterRendering: function() {},

      onOrderInputChange: function(oEvent) {
        var sOrderId = oEvent.getParameter('newValue');

        if (!sOrderId) {
          //Clear the order model
          this.getView().getModel('orderData').setData({});
          return;
        }

        this.getView().byId('idOrderFilterInput').setValueState('None');
        this.getView().byId('idSFCSelect').setValueState('None');

        this._getOrderDetails(sOrderId).then(
          function(oOrderData) {
            this.selectedOrder = oOrderData;
            var aSFCs = oOrderData.sfcs.map(sSFC => {
              return {
                sfc: sSFC
              };
            });
            oOrderData.sfcs = aSFCs;
            this.selectedSFC = aSFCs[0].sfc;

            this.workCenters = oOrderData.workCenters.reduce((acc, val) => {
              acc[val.workCenter] = val;
              return acc;
            }, {});

            this.getView().getModel('orderData').setData(oOrderData);
          }.bind(this)
        );
      },

      onSFCSelectionChange: function(oEvent) {
        var sSFC = oEvent.getSource().getSelectedKey(),
          bIsDirty = this.getView().getModel('viewModel').getProperty('/isDirty');

        this.selectedSFC = sSFC;
      },

      onFBSearch: function(oEvent) {
        var oFilterBar = oEvent.getSource(),
          aMandatoryItems = oFilterBar.getFilterGroupItems().filter(oItem => oItem.getMandatory());

        var aInvalidItems = aMandatoryItems.filter(oItem => {
          var oControl = oItem.getControl(),
            bIsValid = false;

          if (oControl.getValue) {
            bIsValid = oControl.getValue() !== '';
          } else if (oControl.getSelectedKey) {
            bIsValid = oControl.getSelectedKey() != '';
          }

          if (!bIsValid) {
            oControl.setValueState('Error');
            oControl.setValueStateText('Please fill required fields');
          } else {
            oControl.setValueState('None');
            oControl.setValueStateText('');
          }

          return !bIsValid;
        });

        if (aInvalidItems.length === 0) {
          this._getAssignmentData();
        }
      },

      onTableItemsSelectionChange: function(oEvent) {
        var aSelectedRows = oEvent.getParameter('listItems');
        console.log(aSelectedRows);
      },

      onAssignedResourceChanged: function(oEvent) {
        var oControl = oEvent.getSource(),
          oViewModel = this.getView().getModel('viewModel'),
          oSelectedContext = oControl.getBindingContext('viewModel'),
          oSelectedRowData = oSelectedContext.getObject(),
          oSelectedItem = oEvent.getParameter('selectedItem'),
          oResourceData = oSelectedItem.getBindingContext('resourceData').getObject();

        this._markItemAsDirty(oSelectedContext);
        ErrorHandler.clearErrorState(oControl, 'selectedKey');

        //Clear resource data from lineItem
        this._setLineItemResourceData(oViewModel, oSelectedContext.getPath(), {});

        //Get allowed statuses for resource assignment
        var aAllowedStatuses = this.getConfiguration().allowedResourceStatusesForAssignment.reduce((acc, val) => {
          if (val.value) acc.push(val.key);
          return acc;
        }, []);

        //Validate resource status
        if (!aAllowedStatuses.includes(oResourceData.status)) {
          ErrorHandler.setErrorState(oControl, this.getI18nText('resourceStatusInvalidErrMsg', [oResourceData.status]), 'selectedKey');
          return;
        }

        //Validate resource assignment
        if (oResourceData.customData.ORDER) {
          ErrorHandler.setErrorState(
            oControl,
            this.getI18nText('ResourceAssignedToOtherOrderErrMsg', [oResourceData.customData.ORDER]),
            'selectedKey'
          );
          return;
        }

        //Set selected resource to line item
        this._setLineItemResourceData(oViewModel, oSelectedContext.getPath(), oResourceData);
      },

      onAssignedOperatorIdChange: function(oEvent) {
        var oControl = oEvent.getSource(),
          oLineItemContext = oControl.getBindingContext('viewModel'),
          oLineItemData = oLineItemContext.getObject(),
          sOperatorId = oControl.getValue(),
          aResourceList = this.getView().getModel('resourceData').getData();

        this._markItemAsDirty(oLineItemContext);

        ErrorHandler.clearErrorState(oControl);

        if (!sOperatorId) {
          ErrorHandler.setErrorState(oControl, this.getI18nText('requiredFieldErrMsg'));
          return;
        }

        //Check if operator is assigned to other resource or not
        var oResourceForOperator = aResourceList.find(oItem => oItem.customData && oItem.customData.OPERATOR === sOperatorId);
        if (oResourceForOperator) {
          ErrorHandler.setErrorState(oControl, this.getI18nText('operatorAlreadyAssignedErrMsg', [oResourceForOperator.resource]));
        } else {
          ErrorHandler.clearErrorState(oControl);
        }
      },

      onAutoAcceptanceModeChange: function(oEvent) {
        var oViewModel = this.getView().getModel('viewModel'),
          oContext = oEvent.getSource().getBindingContext('viewModel'),
          sPath = oContext.getPath(),
          oSelectedRowData = oViewModel.getProperty(sPath),
          sSelectedKey = oEvent.getSource().getSelectedKey();

        if (sSelectedKey === 'auto') {
          oSelectedRowData.autoAcceptance = true;
        } else {
          oSelectedRowData.autoAcceptance = false;
          oSelectedRowData.acceptanceDelay = 0;
        }

        oViewModel.setProperty(sPath, oSelectedRowData);
        this._markItemAsDirty(oContext);
      },

      onAutoAcceptanceDelayChange: function(oEvent) {
        var oContext = oEvent.getSource().getBindingContext('viewModel');
        this._markItemAsDirty(oContext);

        // var oInput = oEvent.getSource(),
        //   iAcceptanceDelay = oEvent.getParameter('newValue');

        // //Check if the entered value is a positive non-zero integer
        // var regex = /^0*[1-9]\d*$/;
        // if (!regex.test(iAcceptanceDelay)) {
        //   ErrorHandler.setErrorState(oInput, this.getI18nText('inputPositiveNonZeroErrMsg'));
        // } else {
        //   ErrorHandler.clearValueState(oInput);
        // }
      },

      onRevokeResouceBtnPress: function(oEvent) {
        var oTable = this.getView().byId('idMassOpAsmtTable'),
          aSelectedItems = oTable.getSelectedItems();

        var aPromises = aSelectedItems.map(
          function(oItem) {
            var oSelectedRowData = oItem.getBindingContext('viewModel').getObject();
            var oRequestBody = {
              plant: this.getPodController().getUserPlant(),
              resource: oSelectedRowData.resource,
              modifiedDateTime: oSelectedRowData.resourceLastModifiedAt
            };
            oRequestBody.customValues = this._createCustomValuesForResource(oSelectedRowData, true);
            return this._patchResourceServiceCall(oRequestBody);
          }.bind(this)
        );

        Promise.allSettled(aPromises).then(
          function() {
            this._getAssignmentData();
            oTable.removeSelections(true);
          }.bind(this)
        );
      },

      onAddResouceBtnPress: function(oEvent) {
        var oSelectedRowData = oEvent.getSource().getBindingContext('viewModel').getObject();
        var oNewRowItem = {
          ...oSelectedRowData,
          isDirty: true,
          isNew: true,
          asset: '',
          resource: '',
          resourceType: '',
          operator: '',
          autoAcceptance: false,
          acceptanceDelay: 0,
          correctionTime: '',
          lastModified: ''
        };

        var oViewModel = this.getView().getModel('viewModel'),
          aTableItems = oViewModel.getProperty('/lineItems');
        aTableItems.push(oNewRowItem);
        oViewModel.setProperty('/lineItems', aTableItems);
      },

      autoAcceptanceFormatter: function(bIsAutoAcceptance) {
        if (bIsAutoAcceptance) return 'auto';
        return 'manual';
      },

      dateTimeFormatter: function(oDate) {
        if (!oDate) return;
        return moment(oDate).format('YYYY-MM-DD HH:mm:ss');
      },

      onSaveAssignmentsPress: function(oEvent) {
        var oViewModel = this.getView().getModel('viewModel'),
          aItems = oViewModel.getProperty('/lineItems');

        if (ErrorHandler.hasErrors()) {
          return MessageBox.error(this.getI18nText('fixErrorsBeforeSaveErrMsg'));
        }

        var oTable = this.getView().byId('idMassOpAsmtTable');
        oTable.getItems().forEach(oItem => {
          var oData = oItem.getBindingContext('viewModel').getObject(),
            aCells = oItem.getCells();

          if (!oData.isDirty && !oData.isNew) {
            return;
          }

          if (!oData.resource) {
            ErrorHandler.setErrorState(aCells[3], this.getI18nText('requiredFieldErrMsg'), 'selectedKey');
          }

          if (!oData.operator) {
            ErrorHandler.setErrorState(aCells[5], this.getI18nText('requiredFieldErrMsg'));
          }

          if (oData.autoAcceptance && parseInt(oData.acceptanceDelay) < 1) {
            ErrorHandler.setErrorState(aCells[7], this.getI18nText('inputPositiveNonZeroErrMsg'));
          }
        });

        if (ErrorHandler.hasErrors()) {
          return MessageBox.error(this.getI18nText('fixErrorsBeforeSaveErrMsg'));
        }

        var aItemsForServiceCall = aItems.filter(oItem => oItem.isDirty);
        this._saveResourceAssignments(aItemsForServiceCall);
      },

      onCancelAssignmentsPress: function(oEvent) {
        this._getAssignmentData(this.selectedOrder.order);
        this.getView().getModel('viewModel').setProperty('/isDirty', false);
      },

      /**
     * Fetches resource data from DM API endpoint using a GET request.
     *
     * @returns {Promise<any>} A Promise that resolves with the response data from the API or rejects with an error.
     */
      _getResourceData: function() {
        var sUrl = this.getPublicApiRestDataSourceUri() + '/resource/v2/resources';
        var oParamters = {
          plant: this.getPodController().getUserPlant()
        };
        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParamters,
              function() {
                resolve(...arguments);
              },
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      _getBomData: function(sBomId, sBomType = 'SHOP_ORDER') {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'bom/v1/boms';
        var oParamters = {
          plant: this.getPodController().getUserPlant(),
          bom: sBomId,
          type: sBomType
        };
        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParamters,
              function() {
                resolve(...arguments);
              },
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      _getOrderDetails: function(sOrderId) {
        var sUrl = this.getPublicApiRestDataSourceUri() + 'order/v1/orders';
        var oParamters = {
          plant: this.getPodController().getUserPlant(),
          order: sOrderId
        };
        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParamters,
              function() {
                resolve(...arguments);
              },
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      _getOrderRoutingData: function(sRecipeId, sRecipeType = 'SHOP_ORDER') {
        var sUrl = this.getPublicApiRestDataSourceUri() + '/recipe/v1/recipes';
        var oParamters = {
          plant: this.getPodController().getUserPlant(),
          recipe: sRecipeId,
          recipeType: sRecipeType
        };
        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParamters,
              function() {
                resolve(...arguments);
              },
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      _getAssignmentData: async function() {
        var aResourceList = await this._getResourceData();
        var aResources = this._createCustomDataObject(aResourceList);
        this.getView().getModel('resourceData').setData(aResources);

        ErrorHandler.clearAllErrors();

        if (aResources.length > 100) {
          this.getView().getModel('resourceData').setSizeLimit(aResources.length);
        }

        this._getOrderRoutingData(this.selectedOrder.order)
          .then(
            function(aRecipeData) {
              return this._createTableLineItems(aRecipeData);
            }.bind(this)
          )
          .then(
            function(aLineItems) {
              var oMaterials = aLineItems.reduce((acc, val) => {
                acc[val.component] = '';
                return acc;
              }, {});

              var aMaterials = Object.keys(oMaterials);
              var aPromises = aMaterials.map(oMaterial => this._getDetailsForMaterial(oMaterial));
              Promise.all(aPromises).then(this._handleMaterialDataFetch.bind(this));
            }.bind(this)
          );
      },

      _handleMaterialDataFetch: function(aMaterials) {
        this.materialsList = aMaterials.reduce((acc, val) => {
          acc[val.material] = val;
          return acc;
        }, {});

        var aLineItems = this.getView().getModel('viewModel').getProperty('/lineItems');
        for (var oItem of aLineItems) {
          oItem.componentDesc = this.materialsList[oItem.component].description;
        }
        this.getView().getModel('viewModel').setProperty('/lineItems', aLineItems);
      },

      _getResourceListForComponent: function(sOrderId, sSFC, sComponent) {
        var oResourceModel = this.getView().getModel('resourceData'),
          aResourceList = oResourceModel.getProperty('/');

        return aResourceList.filter(
          oResource =>
            oResource.customData.ORDER === sOrderId && oResource.customData.SFC === sSFC && oResource.customData.MATERIAL === sComponent
        );
      },

      _getDetailsForMaterial: function(sMaterial) {
        var sUrl =
          this.getProductDataSourceUri() +
          "Materials?$select=ref,material,description,version&$filter=(material eq '" +
          encodeURIComponent(sMaterial) +
          "' and currentVersion eq true)";
        var oParameters = {};

        return new Promise(
          function(resolve, reject) {
            this.ajaxGetRequest(
              sUrl,
              oParameters,
              function(oResponse) {
                resolve(oResponse.value[0]);
              },
              function() {
                reject(...arguments);
              }
            );
          }.bind(this)
        );
      },

      _createTableLineItems: function(aData) {
        var aRecipeItems = aData.flatMap(recipe =>
          recipe.phases.flatMap(phase =>
            phase.recipePhaseComponentList.map(component => ({
              isDirty: false,
              isNew: false,
              workCenter: phase.workCenter,
              workCenterDesc: this.workCenters[phase.workCenter].description,
              phaseId: phase.phaseId,
              component: component.bomComponent.material.material,
              componentDesc: '',
              asset: '',
              resource: '',
              resourceType: '',
              operator: '',
              autoAcceptance: false,
              acceptanceDelay: 0,
              correctionTime: '',
              lastModified: '',
              operationActivity: phase.recipeOperation.operationActivity.operationActivity,
              bom: component.bomComponent.bom.bom,
              bomVersion: component.bomComponent.bom.version
            }))
          )
        );

        var aLineItems = [];
        aRecipeItems.forEach(oItem => {
          var aResources = this._getResourceListForComponent(this.selectedOrder.order, this.selectedSFC, oItem.component);

          //If there are no resources assigned then show line
          if (aResources.length === 0) {
            oItem.isNew = true;
            aLineItems.push(oItem);
            return;
          }

          //If there are assigned resources, then show multiple lines per item
          aResources.forEach(oResource => {
            var oLineItem = jQuery.extend(true, {}, oItem);
            oLineItem.resource = oResource.resource;
            oLineItem.resourceType = oResource.types;
            oLineItem.lastModified = moment(oResource.modifiedDateTime).toDate();
            oLineItem.resourceLastModifiedAt = moment(oResource.modifiedDateTime).toDate();

            if (oResource.asset) {
              oLineItem.asset = oResource.asset.name;
            }

            if (!oResource.customData) {
              aLineItems.push(oLineItem);
              return;
            }

            oLineItem.autoAcceptance = oResource.customData.USE_AUTO_ACCEPTANCE === 'true';
            oLineItem.acceptanceDelay = oResource.customData.AUTOACCEPTANCEDELAY;
            oLineItem.operator = oResource.customData.OPERATOR;
            aLineItems.push(oLineItem);
          });
        });

        this.getView().getModel('viewModel').setProperty('/lineItems', aLineItems);
        return aLineItems;
      },

      _saveResourceAssignments: function(aItems) {
        var aPromises = [];

        aPromises = aItems.map(oItem => {
          var oRequestBody = {
            plant: this.getPodController().getUserPlant(),
            resource: oItem.resource,
            customValues: this._createCustomValuesForResource(oItem),
            modifiedDateTime: oItem.resourceLastModifiedAt
          };

          return this._patchResourceServiceCall(oRequestBody);
        });

        Promise.allSettled(aPromises).then(
          function(aData) {
            this._getAssignmentData(this.selectedOrder.order);
            this.getView().getModel('viewModel').setProperty('/isDirty', false);
          }.bind(this)
        );
      },

      _markItemAsDirty: function(oContext) {
        var oObject = oContext.getObject();
        oObject.isDirty = true;

        var oViewModel = this.getView().getModel('viewModel');
        oViewModel.setProperty('/isDirty', true);
      },

      _patchResourceServiceCall: function(oBody) {
        var sUrl = this.getPublicApiRestDataSourceUri() + '/resource/v2/resources';
        return new Promise(
          function(resolve, reject) {
            this.ajaxPatchRequest(sUrl, oBody, function() {
              resolve(...arguments);
            }), function() {
              reject(...arguments);
            };
          }.bind(this)
        );
      },

      _createCustomValuesForResource: function(oItem, bClearValues) {
        var customValues = [];

        if (bClearValues) {
          return [
            {
              attribute: 'OPERATOR',
              value: ''
            },
            {
              attribute: 'AUTOACCEPTANCEDELAY',
              value: ''
            },
            {
              attribute: 'USE_AUTO_ACCEPTANCE',
              value: ''
            },
            {
              attribute: 'MATERIAL',
              value: ''
            },
            {
              attribute: 'USE_SUBSTRACTIVE_WEIGHING',
              value: ''
            },
            {
              attribute: 'BOM',
              value: ''
            },
            {
              attribute: 'BOM_VERSION',
              value: ''
            },
            {
              attribute: 'MATERIAL_VERSION',
              value: ''
            },
            {
              attribute: 'ORDER',
              value: ''
            },
            {
              attribute: 'SFC',
              value: ''
            },
            {
              attribute: 'OPERATION_ACTIVITY',
              value: ''
            },
            {
              attribute: 'WORK_CENTER',
              value: ''
            },
            {
              attribute: 'CURRENT_UOM',
              value: ''
            },
            {
              attribute: 'ERP_BOM',
              value: ''
            },
            {
              attribute: 'ERP_SEQUENCE',
              value: ''
            }
          ];
        }

        customValues.push({
          attribute: 'OPERATOR',
          value: oItem.operator
        });

        customValues.push({
          attribute: 'AUTOACCEPTANCEDELAY',
          value: oItem.acceptanceDelay
        });
        customValues.push({
          attribute: 'USE_AUTO_ACCEPTANCE',
          value: oItem.autoAcceptance
        });
        customValues.push({
          attribute: 'MATERIAL',
          value: oItem.component
        });
        customValues.push({
          attribute: 'USE_SUBSTRACTIVE_WEIGHING',
          value: ''
        });
        customValues.push({
          attribute: 'BOM',
          value: oItem.bom
        });
        customValues.push({
          attribute: 'BOM_VERSION',
          value: oItem.bomVersion
        });
        customValues.push({
          attribute: 'MATERIAL_VERSION',
          value: ''
        });
        customValues.push({
          attribute: 'ORDER',
          value: this.selectedOrder.order
        });
        customValues.push({
          attribute: 'SFC',
          value: this.selectedSFC
        });
        customValues.push({
          attribute: 'OPERATION_ACTIVITY',
          value: oItem.operationActivity
        });
        customValues.push({
          attribute: 'WORK_CENTER',
          value: oItem.workCenter
        });
        customValues.push({
          attribute: 'CURRENT_UOM',
          value: ''
        });
        customValues.push({
          attribute: 'ERP_BOM',
          value: ''
        });
        customValues.push({
          attribute: 'ERP_SEQUENCE',
          value: ''
        });

        return customValues;
      },

      /**
     * Processes an array of data objects and maps custom values to a `customData` property on each object.
     *
     * @param {Array<Object>} aData - The array of data objects to process. Each object should have a `customValues` property.
     * @returns {Array<Object>} A new array where each object includes a `customData` property, which is an object 
     *                          mapping attributes to their corresponding values.
     */
      _createCustomDataObject: function(aData) {
        return aData.map(oItem => {
          var oCustomData = oItem.customValues.reduce((acc, val) => {
            acc[val.attribute] = val.value;
            return acc;
          }, {});
          oItem.customData = oCustomData;
          return oItem;
        });
      },

      _setLineItemResourceData: function(oModel, sPath, oResourceData) {
        var oData = oModel.getProperty(sPath);
        var oCustomData = oResourceData.customData;

        oData = {
          ...oData,
          resource: oResourceData.resource || '',
          resourceType: oResourceData.types || '',
          lastModified: oResourceData.modifiedDateTime ? moment(oResourceData.modifiedDateTime).toDate() : '',
          resourceLastModifiedAt: oResourceData.modifiedDateTime ? moment(oResourceData.modifiedDateTime).toDate() : '',
          asset: oResourceData.asset ? oResourceData.asset.name : ''
          // autoAcceptance: oCustomData ? oCustomData.USE_AUTO_ACCEPTANCE === 'true' : 'false',
          // acceptanceDelay: oCustomData ? oCustomData.AUTOACCEPTANCEDELAY : 0
          // operator: oCustomData ? oCustomData.OPERATOR || ''
        };

        oModel.setProperty(sPath, oData);
      }
    });

    return oPluginViewController;
  }
);
