sap.ui.define(['sap/ui/model/json/JSONModel', 'sap/dm/dme/podfoundation/controller/PluginViewController', 'sap/base/Log'], function(
  JSONModel,
  PluginViewController,
  Log
) {
  'use strict';

  var oLogger = Log.getLogger('resourceListPlugin', Log.Level.INFO);

  var oPluginViewController = PluginViewController.extend('stellium.ext.podplugins.resourceListPlugin.controller.PluginView', {
    metadata: {
      properties: {}
    },

    onInit: function() {
      if (PluginViewController.prototype.onInit) {
        PluginViewController.prototype.onInit.apply(this, arguments);
      }

      var oView = this.getView();
      oView.setModel(new JSONModel(), 'resourceData');
      oView.setModel(new JSONModel(), 'workCenterData');
      oView.setModel(new JSONModel(), 'data');
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

    onBeforeRendering: function() {
      this._getWorkCenterAssignments();
    },

    onAfterRendering: function() {},

    resourceStatusTextFormatter: function(sStatus) {
      if (!sStatus) return;
      switch (sStatus) {
        case 'ENABLED':
          return this.getI18nText('enum.resource.status.enabled');
        case 'UNKNOWN':
          return this.getI18nText('enum.resource.status.unknown');
        case 'PRODUCTIVE':
          return this.getI18nText('enum.resource.status.productive');
        case 'SCHEDULED_DOWN':
          return this.getI18nText('enum.resource.status.scheduledDown');
        case 'UNSCHEDULED_DOWN':
          return this.getI18nText('enum.resource.status.unscheduledDown');
        case 'DISABLED':
          return this.getI18nText('enum.resource.status.disabled');
      }
    },

    resourceStatusIconFormatter: function(sStatus) {
      if (!sStatus) return;
      switch (sStatus) {
        case 'ENABLED':
          return 'sap-icon://sys-enter-2';
        case 'UNKNOWN':
        case 'PRODUCTIVE':
        case 'SCHEDULED_DOWN':
        case 'UNSCHEDULED_DOWN':
        case 'DISABLED':
          return 'sap-icon://error';
      }
    },

    resourceStatusStatusFormatter: function(sStatus) {
      if (!sStatus) return;
      switch (sStatus) {
        case 'ENABLED':
          return 'Success';
        case 'UNKNOWN':
        case 'PRODUCTIVE':
        case 'SCHEDULED_DOWN':
        case 'UNSCHEDULED_DOWN':
        case 'DISABLED':
          return 'Error';
      }
    },

    _getWorkCenterAssignments: async function() {
      //Get resource data
      var aResources = await this._getResourceData().then(aResources => {
        return this._createCustomDataObject(aResources);
      });

      this.getView().getModel('resourceData', aResources);

      //Get Workcenter data
      var aWorkCenters = await this._getWorkCenterData();
      this.getView().getModel('workCenterData', aWorkCenters);

      var aLineItems = [];
      for (var i = 0; i < aWorkCenters.length; i++) {
        var oWorkCenter = aWorkCenters[i];
        oWorkCenter.members.forEach(oMember => {
          if (!oMember.resource && !oMember.resource.resource) return;

          oMember.resource = aResources.find(oResource => oResource.resource === oMember.resource.resource);
          var oCustomData = oMember.resource.customData;
          aLineItems.push({
            workCenter: oWorkCenter.workCenter,
            workCenterDesc: oWorkCenter.description,
            resource: oMember.resource.resource,
            resourceType: oMember.resource.types,
            resourceStatus: oMember.resource.status,
            operator: oCustomData ? oCustomData.OPERATOR : '',
            order: oCustomData ? oCustomData.ORDER : '',
            component: oCustomData ? oCustomData.MATERIAL : '',
            componentDesc: oCustomData ? oCustomData.MATERIAL_DESC : ''
          });
        });
      }
      this.getView().getModel('data').setProperty('/lineItems', aLineItems);
    },

    _getResourceData: function() {
      var sUrl = this.getPublicApiRestDataSourceUri() + '/resource/v2/resources';
      var oParamters = {
        plant: this.getPodController().getUserPlant()
      };
      return new Promise((resolve, reject) => {
        this.ajaxGetRequest(sUrl, oParamters, resolve, reject);
      });
    },

    _getWorkCenterData: function() {
      var sUrl = this.getPublicApiRestDataSourceUri() + 'workcenter/v2/workcenters';
      var oParameters = {
        plant: this.getPodController().getUserPlant()
      };
      return new Promise((resolve, reject) => {
        this.ajaxGetRequest(sUrl, oParameters, resolve, reject);
      });
    },

    _createCustomDataObject: function(aData) {
      return aData.map(oItem => {
        var oCustomData = oItem.customValues.reduce((acc, val) => {
          acc[val.attribute] = val.value;
          return acc;
        }, {});
        oItem.customData = oCustomData;
        return oItem;
      });
    }
  });

  return oPluginViewController;
});
