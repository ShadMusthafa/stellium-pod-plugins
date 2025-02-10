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
          isFiltersApplied: false,
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
          },
          lineItems: [],
          workCenters: []
        };

        this.materialsList = {};
        this.workCenters = {};

        this.getView().setModel(new JSONModel(oViewData), 'viewModel');
        this.getView().setModel(new JSONModel([]), 'resourceData');
        this.getView().setModel(new JSONModel({}), 'orderData');
        this.getView().setModel(new JSONModel([]), 'recipeData');
      },

      /**
     * @see PluginViewController.onBeforeRenderingPlugin()
     */
      onBeforeRenderingPlugin: function() {
        this.PPD_BASE_URL = this.getPublicApiRestDataSourceUri() + '/pe/api/v1/process/processDefinitions/start?';
      },

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

            this._getWorkCenterData(this.workCenters);

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
        var oFilterBar = oEvent.getSource();
        var oViewModel = this.getView().getModel('viewModel');
    
        var sOrderId = this.getView().byId('idOrderFilterInput').getValue();
        var sSFC = this.getView().byId('idSFCSelect').getSelectedKey();
    
        if (!sOrderId || !sSFC) {
            if (!sOrderId) {
                this.getView().byId('idOrderFilterInput').setValueState('Error');
                this.getView().byId('idOrderFilterInput').setValueStateText('Please enter an Order Number');
            }
            if (!sSFC) {
                this.getView().byId('idSFCSelect').setValueState('Error');
                this.getView().byId('idSFCSelect').setValueStateText('Please select an SFC');
            }
    
            // Hide the footer
            oViewModel.setProperty('/isFiltersApplied', false);
            return; // Stop execution if validation fails
        }
    
        // Reset ValueState only when both inputs are valid
        this.getView().byId('idOrderFilterInput').setValueState('None');
        this.getView().byId('idSFCSelect').setValueState('None');
    
        // Show the footer
        oViewModel.setProperty('/isFiltersApplied', true);
    
        // Fetch data
        this._getAssignmentData();
    },
       onTableItemsSelectionChange: function(oEvent) {
        var aSelectedRows = oEvent.getParameter('listItems');
        console.log(aSelectedRows);
      },

      onAssignedResourceChanged: async function(oEvent) {
        var oControl = oEvent.getSource(),
          oViewModel = this.getView().getModel('viewModel'),
          oSelectedContext = oControl.getBindingContext('viewModel'),
          oSelectedRowData = oSelectedContext.getObject(),
          oSelectedItem = oEvent.getParameter('selectedItem'),
          oResourceData = oSelectedItem.getBindingContext('viewModel').getObject();

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

        this._getResourceOccupancy(oResourceData.resource).then(oResourceOccupancy => {
          if (oResourceOccupancy['State_Signal'] !== 0) {
            ErrorHandler.setErrorState(
              oControl,
              this.getI18nText('resourceHasExistingOperatorAssignmentErrMsg', [oResourceData.resource, oResourceOccupancy.OperatorName]),
              'selectedKey'
            );
            return;
          }

          //Set selected resource to line item
          this._setLineItemResourceData(oViewModel, oSelectedContext.getPath(), oResourceData);
        });
      },

      onAssignedOperatorIdChange: function(oEvent) {
        var oControl = oEvent.getSource(),
          oLineItemContext = oControl.getBindingContext('viewModel'),
          oLineItemData = oLineItemContext.getObject(),
          sOperatorId = oControl.getValue(),
          aResourceList = this.getView().getModel('resourceData').getData();

        this._markItemAsDirty(oLineItemContext);

        ErrorHandler.clearErrorState(oControl);

        //If resource selection is made and no operator id is set, show error
        if (!sOperatorId && oLineItemData.resource) {
          ErrorHandler.setErrorState(oControl, this.getI18nText('requiredFieldErrMsg'));
          return;
        }

        this._getOperatorOccupancy(sOperatorId).then(
          function(oResponse) {
            //If outOperator array is empty, then operator does not have another assignment. No error
            if (oResponse.outOperator.length === 0) {
              return;
            }
            //outOperator array is not empty. Operator is already assigned. Show error
            ErrorHandler.setErrorState(
              oControl,
              this.getI18nText('operatorAssignedToOtherResourceErrMsg', [sOperatorId, oResponse.outOperator[0].RESOURCE])
            );
          }.bind(this)
        );
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
      },

      onCorrectionTimeInputChange: function(oEvent) {
        var oContext = oEvent.getSource().getBindingContext('viewModel');
        this._markItemAsDirty(oContext);
      },

      onRevokeResouceBtnPress: function(oEvent) {
        var oTable = this.getView().byId('idMassOpAsmtTable'),
          aSelectedItems = oTable.getSelectedItems();

        var aPromises = aSelectedItems.map(
          function(oItem) {
            var oViewModel = this.getView().getModel('viewModel');
            var oSelectedRowData = oItem.getBindingContext('viewModel').getObject();
            var sPath = oItem.getBindingContext('viewModel').getPath();
            return this._revokeResource(oSelectedRowData.resource).then(
              function() {
                this._setLineItemResourceData(oViewModel, sPath, {}, true);
              }.bind(this)
            );
          }.bind(this)
        );

        Promise.allSettled(aPromises).then(
          function() {
            // this._getAssignmentData();
            oTable.removeSelections(true);
          }.bind(this)
        );
      },

      onAddResouceBtnPress: function(oEvent) {
        // Get the context of the selected row from the event
        var oSelectedRowContext = oEvent.getSource().getBindingContext('viewModel');
        var oSelectedRowData = oSelectedRowContext.getObject();
    
        // Create a new row with the same component details
        var oNewRowItem = {
            ...oSelectedRowData, // Copy the component details
            isDirty: true,
            isNew: true,
            asset: '',
            resource: '',
            resourceType: '',
            operator: '',
            autoAcceptance: true,
            acceptanceDelay: this._getDefaultAcceptanceDelay(),
            correctionTime: this._getDefaultCorrectionTime(),
            lastModified: ''
        };
    
        // Add the new row to the line items
        var oModel = oSelectedRowContext.getModel();
        var aLineItems = oModel.getProperty('/lineItems');
        aLineItems.push(oNewRowItem);
    
        // Update the model
        oModel.setProperty('/lineItems', aLineItems);
        oModel.refresh(true);
      },
      onClearResourceBtnPress: function(oEvent) {
        // Get the context of the selected row from the event
        var oSelectedRowContext = oEvent.getSource().getBindingContext('viewModel');
        
        // Get the row's data object using the binding context
        var oSelectedRowData = oSelectedRowContext.getObject();
        
        // Reset the values of the selected row's fields to their default state
        Object.assign(oSelectedRowData, {
            isDirty: false,
            isNew: true,
            asset: '',
            resource: '',
            resourceType: '',
            operator: '',
            autoAcceptance: true,
            acceptanceDelay: this._getDefaultAcceptanceDelay(),
            correctionTime: this._getDefaultCorrectionTime(),
            lastModified: ''
        });
        
        // Update the model with the cleared data for the selected row
        var oModel = oSelectedRowContext.getModel();
        oModel.setProperty(oSelectedRowContext.getPath(), oSelectedRowData);  // Update the model with new cleared values
        
        // Refresh the model to ensure the UI is updated
        oModel.refresh(true);
    },
    onDeleteResourceBtnPress: function (oEvent) {
      // Get the context of the selected row from the event
      var oSelectedRowContext = oEvent.getSource().getBindingContext("viewModel");
  
      // Ensure the context is valid
      if (!oSelectedRowContext) {
          console.warn("No row context found for deletion.");
          return;
      }
  
      var oSelectedRowData = oSelectedRowContext.getObject();
      var oModel = oSelectedRowContext.getModel();
      var aLineItems = oModel.getProperty("/lineItems");
  
      // Check if the row has existing assignments
      if (oSelectedRowData.resource || oSelectedRowData.operator) {
          MessageBox.error("Cannot delete a row with existing assignments. Please revoke the resource first.");
          return;
      }
  
      // Ensure at least one row per BOM component remains
      var sComponent = oSelectedRowData.component;
      var aComponentRows = aLineItems.filter(oRow => oRow.component === sComponent);
  
      if (aComponentRows.length <= 1) {
         sap.m.MessageToast.show("At least one row per BOM component must remain.");
          return;
      }
  
      // Remove the selected row from the line items
      var iIndex = aLineItems.findIndex(oRow => oRow === oSelectedRowData);
      if (iIndex !== -1) {
          aLineItems.splice(iIndex, 1);
      }
  
      // Update the model and refresh the bindings
      oModel.setProperty("/lineItems", aLineItems);
      oModel.updateBindings(true);
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

        //Validate table items
        var oTable = this.getView().byId('idMassOpAsmtTable');
        oTable.getItems().forEach(oItem => {
          var oData = oItem.getBindingContext('viewModel').getObject(),
            aCells = oItem.getCells();

          if (!oData.isDirty && !oData.isNew) {
            return;
          }

          if (!oData.resource && !oData.operator) {
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

      _getWorkCenterData: function(oWorkCenters) {
        var aWorkCenters = Object.keys(oWorkCenters);
        var aPromises = aWorkCenters.map(oWorkCenter => {
          return new Promise((resolve, reject) => {
            var sUrl = this.getPublicApiRestDataSourceUri() + 'workcenter/v2/workcenters';
            var oParameters = {
              plant: this.getPodController().getUserPlant(),
              workCenter: oWorkCenter
            };
            this.ajaxGetRequest(sUrl, oParameters, resolve, reject);
          });
        });

        Promise.all(aPromises).then(aResponse => {
          aResponse.map(oResponse => {
            this.workCenters[oResponse[0].workCenter] = oResponse[0];
          });
        });
      },

      _getAssignmentData: async function() {
        var aResourceList = await this._getResourceData();
        //Consider only resources of type PORTIONING or FORMULATION
        var aValidResources = aResourceList.filter(oResource =>
          oResource.types.find(oType => oType.type === 'PORTIONING' || oType.type === 'FORMULATION')
        );
        var aResources = this._createCustomDataObject(aValidResources);
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

      _getResourceListForWorkCenter: function(aMembers) {
        var aResourceList = this.getView().getModel('resourceData').getProperty('/');
        return aResourceList.filter(oResource => {
          var isValidResource = oResource.types.find(oType => oType.type === 'PORTIONING' || oType.type === 'FORMULATION') ? true : false;
          if (!isValidResource) return false;

          var isWorkCenterMember = aMembers.find(oMember => oMember.resource.resource === oResource.resource);
          if (!isWorkCenterMember) return false;

          return true;
        });
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
        var oConfiguration = this.getConfiguration();
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
              componentVersion: component.bomComponent.material.version,
              asset: '',
              resource: '',
              resourceType: '',
              operator: '',
              autoAcceptance: true,
              acceptanceDelay: this._getDefaultAcceptanceDelay(),
              correctionTime: this._getDefaultCorrectionTime(),
              lastModified: '',
              operationActivity: phase.recipeOperation.operationActivity.operationActivity,
              bom: component.bomComponent.bom.bom,
              bomVersion: component.bomComponent.bom.version,
              sequence: component.bomComponent.sequence,
              userAssignments: this.workCenters[phase.workCenter].userAssignments,
              resourceList: this._getResourceListForWorkCenter(this.workCenters[phase.workCenter].members)
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

            if (oResource.customData) {
              oLineItem.autoAcceptance = oResource.customData.USE_AUTO_ACCEPTANCE === 'true';
              oLineItem.acceptanceDelay = oResource.customData.AUTOACCEPTANCEDELAY;
              oLineItem.operator = oResource.customData.OPERATOR;
              oLineItem.correctionTime = oResource.customData.CORRECTION_TIME;
            }

            oLineItem.existingAssignment = { ...oLineItem };
            aLineItems.push(oLineItem);
          });
        });

        this.getView().getModel('viewModel').setProperty('/lineItems', aLineItems);
        return aLineItems;
      },

      _saveResourceAssignments: function(aItems) {
        var aPromises = [];

        var aRequestItems = [];
        for (var i = 0; i < aItems.length; i++) {
          var oItem = aItems[i];
          aPromises.push(this._assignResource(oItem));
        }

        Promise.allSettled(aPromises).then(
          function() {
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

      _getResourceOccupancy: function(sResourceId) {
        var sUrl = this.PPD_BASE_URL + 'key=REG_f22f235e-1e89-4553-b952-7ac229b79065&async=false';
        var oPayload = {
          InPlant: this.getPodController().getUserPlant(),
          InResource: sResourceId
        };

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oPayload, resolve, reject);
        }).then(function(oResponse) {
          return oResponse.indicatorOutput.reduce((acc, val) => {
            acc[val.referenceName] = val.value;
            return acc;
          }, {});
        });
      },

      _getOperatorOccupancy: function(sOperatorId) {
        var sUrl = this.PPD_BASE_URL + 'key=REG_8f3da8b6-8b63-49a6-a45c-f13a029f7812&async=false';
        var oPayload = {
          InOperator: sOperatorId
        };

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oPayload, resolve, reject);
        });
      },

      _revokeResource: function(sResourceId) {
        var sUrl = this.PPD_BASE_URL + 'key=REG_c245216f-4e25-4b85-8593-ed44db51a531&async=false';
        var oPayload = {
          InPlant: this.getPodController().getUserPlant(),
          InResource: sResourceId
        };

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oPayload, resolve, reject);
        });
      },

      _assignResource: function(oItem) {
        var sUrl = this.PPD_BASE_URL + 'key=REG_e64981d3-2a78-4751-8e86-f796485f1db5&async=false';
        var oPayload = {
          InOrderStatus: this.selectedOrder.executionStatus,
          InHeaderMaterialDesc: this.selectedOrder.material.description,
          InHeaderMaterial: this.selectedOrder.material.material,
          InPlant: this.getPodController().getUserPlant(),
          InResource: oItem.resource,
          InMaterial: oItem.component,
          InWorkCenter: oItem.workCenter,
          InOperator: oItem.operator,
          InAutAcceptance: oItem.autoAcceptance,
          InAutoTimeDelay: oItem.acceptanceDelay,
          InSubWeighing: oItem.resourceType.find(oType => oType.type === 'PORTIONING') ? true : false,
          InSFC: this.selectedSFC,
          InOrderBO: this.selectedOrder.order,
          InOperationActivity: oItem.operationActivity,
          InUOM: 'KG', //TBD leave blank for now
          InERPSequence: oItem.sequence,
          InBOM: this.selectedOrder.bom.bom,
          InMaterialVersion: oItem.componentVersion,
          InBOMVersion: this.selectedOrder.bom.version,
          InCorrectionTime: oItem.correctionTime
        };

        return new Promise((resolve, reject) => {
          this.ajaxPostRequest(sUrl, oPayload, resolve, reject);
        });
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

      _setLineItemResourceData: function(oModel, sPath, oResourceData, bNew) {
        var oData = oModel.getProperty(sPath);
        // var oCustomData = oResourceData.customData;

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

        if (bNew) {
          oData.isNew = true;
          oData.operator = '';
          oData.autoAcceptance = true;
          oData.acceptanceDelay = this._getDefaultAcceptanceDelay();
          oData.correctionTime = this._getDefaultCorrectionTime();
        }

        oModel.setProperty(sPath, oData);
      },
      _getDefaultAcceptanceDelay : function() {
        var oConfiguration=this.getConfiguration();
        return oConfiguration && oConfiguration.defaultAcceptanceDelay ? oConfiguration.defaultAcceptanceDelay : 0;
      },

      _getDefaultCorrectionTime : function() {
        var oConfiguration=this.getConfiguration();
        return oConfiguration && oConfiguration.defaultCorrectionTime ? oConfiguration.defaultCorrectionTime : 0;
      }
    });

    return oPluginViewController;
  }
);
