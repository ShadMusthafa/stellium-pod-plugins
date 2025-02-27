sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/dm/dme/podfoundation/controller/ListPluginViewController",
  "sap/dm/dme/formatter/NumberFormatter",
  "sap/dm/dme/formatter/DateTimeUtils",
  "sap/dm/dme/browse/BatchControl",
  "sap/dm/dme/browse/StorageLocationBrowse",
  "./UserSelectionDialog",
  "./ActivityPostingsDialog",
  "./ActivityConfirmation",
  "./QuantityConfirmation",
  "./QuantityConfirmationPostingDialog",
  "./MaterialComponents",
  "./GoodsReceipt",
  "./DataCollection",
  "sap/dm/dme/controller/GRPostController",
  "./StorageLocationDialog",
  "./BatchDialog",
  "./MaterialComponentsPostingDialog",
  "./PhaseDetails",
  "../utils/Formatter",
  "../utils/Utils",
  "sap/ui/core/Fragment",
  "sap/dm/dme/model/AjaxUtil",
  "sap/dm/dme/podfoundation/util/PodUtility",
  "sap/m/MessageToast",
  "sap/uxap/ObjectPageSubSection",
  "sap/uxap/ObjectPageSection",
  "sap/dm/dme/serverevent/Topic",
  "sap/ui/core/MessageType",
  "sap/dm/dme/types/QuantityType",
  "stellium/ext/podplugins/postProductionReportingPlugin/controller/PostProductionServerNotificationSubscription"
], function (JSONModel, ListPluginViewController, NumberFormatter, DateTimeUtils, BatchControl, StorageLocationBrowse, UserSelectionDialog, ActivityPostingsDialog, ActivityConfirmation, QuantityConfirmation, QuantityConfirmationPostingDialog, MaterialComponents, GoodsReceipt, DataCollection, GRPostController, StorageLocationDialog, BatchDialog, MaterialComponentsPostingDialog, PhaseDetails, Formatter, Utils, Fragment, AjaxUtil, PodUtility, MessageToast, ObjectPageSubSection, ObjectPageSection, Topic, MessageType, QuantityType, PostProductionServerNotificationSubscription) {
  "use strict";

  var oLogger = PodUtility.getLogger("stellium.ext.podplugins.postProductionReportingPlugin.PluginViewController");
  return ListPluginViewController.extend("stellium.ext.podplugins.postProductionReportingPlugin.controller.PluginView", {

      BatchControl: BatchControl,
      StorageLocationBrowse: StorageLocationBrowse,
      UserSelectionDialog: UserSelectionDialog,
      ActivityPostingsDialog: ActivityPostingsDialog,
      ActivityConfirmation: ActivityConfirmation,
      QuantityConfirmation: QuantityConfirmation,
      QuantityConfirmationPostingDialog: QuantityConfirmationPostingDialog,
      MaterialComponents: MaterialComponents,
      GoodsReceipt: GoodsReceipt,
      DataCollection: DataCollection,
      GRPostController: GRPostController,
      StorageLocationDialog: StorageLocationDialog,
      BatchDialog: BatchDialog,
      MaterialComponentsPostingDialog: MaterialComponentsPostingDialog,
      PhaseDetails: PhaseDetails,
      NumberFormatter: NumberFormatter,
      DateTimeUtils: DateTimeUtils,
      formatter: Formatter,
      utils: Utils,
      types: {
          quantity: new QuantityType()
      },
      onInit: function () {

          var that = this;
          ListPluginViewController.prototype.onInit.apply(this, arguments);
          //Fix for belize plus theme
          sap.ui.getCore().attachThemeChanged(function () {
              that.changeBackgroundColorAccordingToTheme();
          });

          this.selectedTheme = sap.ui.getCore().getConfiguration().getTheme();
          this._bHeaderExpanded = true;
          this._phaseListWorkCentersForSubscription = [];
      },

      onBeforeRenderingPlugin: function () {
          this.subscribe("orderSelectionEvent", this.setDataToPlugin, this);
          this.publish("requestForOrderData", { "source": this, "sendToAllPages": true});
      },

      onBeforeRendering: function () {
          this.oViewData = this.getConfiguration();
          this.oPluginConfiguration = this.getConfiguration();
          this.getView().setModel(new JSONModel(), "configuration");
          this.getView().getModel("configuration").setData(this.oPluginConfiguration);
          var oPodSelectionModel = this.getPodSelectionModel();
          this.isInventoryManaged = oPodSelectionModel.getIsInventoryManaged();
          var isInvManaged = {
              isInventoryManaged: this.isInventoryManaged
          };
          var invManagedModel = new JSONModel();
          invManagedModel.setData(isInvManaged);
          this.getView().setModel(invManagedModel, "invManagedModel");
      },

      onAfterRendering: function () {

      },

      isSubscribingToNotifications: function () {
          return true;
      },

      createServerNotificationSubscription: function() {
          return new PostProductionServerNotificationSubscription(this);
      },

      getNotificationContextData: function() {
          let oContextData = {};
          oContextData.workCenter = this._phaseListWorkCentersForSubscription;
          return oContextData;
      },

      _updateProductionProcessNotifications: function(oPhaseListData) {
          // Create production process subscriptions for all planned work centers in the phase list.
          this.getPodSelectionModel().setProductionProcessWorkCenters(this._getPhasePlannedWorkCenters(oPhaseListData));
          let oDelegate = this.getPodController().getProcessController().getProcessNotificationDelegate();
          if (oDelegate && oDelegate.updateNotificationSubscriptions) {
            // check to fix issue when running OPA tests locally
              oDelegate.updateNotificationSubscriptions();
          }
      },

      _updatePhaseListNotifications: function(oPhaseListData) {

          this._phaseListWorkCentersForSubscription = this._getPhasePlannedWorkCenters(oPhaseListData);
          this._getServerNotificationSubscription()._updateNotificationSubscriptions();
      },

      _getPhasePlannedWorkCenters: function(oPhaseListData) {
          let aWorkCenters = [];
          for(const oPhaseData of oPhaseListData) {
              aWorkCenters.push(oPhaseData.workCenter.workcenter);
          }
          return aWorkCenters.toString();
      },

      /*
       * Return the function to be called when a BACKFLUSH_FAILURE_MSG
       * notification message is received
       * @override
       */
      getNotificationMessageHandler: function (sTopic) {
          if (sTopic === Topic.BACKFLUSH_FAILURE_MSG) {
              return this.handleBackflushFailureMessages;
          }
          return null;
      },

      handleBackflushFailureMessages: function (oMsg) {

          if (this.selectedOrderData.erpAutoGRStatus) {
              this.getGRQuantity(); //Refresh goods receipt quantity in the Order Card.
          }
          MaterialComponents.getGiMaterialData(); //Refresh material consumption section.
          if (oMsg.failureMessages && oMsg.failureMessages.length > 0) {
              var notificationMessage = "";
              oMsg.failureMessages.forEach(function (errorMessage) {
                  if (errorMessage) {
                      notificationMessage += "\n" + errorMessage;
                  }
              });
              this.addMessage(MessageType.Error, this.getI18nText("BACKFLUSH_FAILURE_MESSAGE"), notificationMessage);
          } else {
              this.addMessage(MessageType.Success, this.getI18nText("BACKFLUSH_POSTED_SUCCESSFULLY"));
          }
      },

      adjustAnchorBarCSSChanges: function (anchorBarId) {

          var items = (this.byId("postProductionReportingPageLayout") ? this.byId("postProductionReportingPageLayout").getControlsByFieldGroupId("") : []);
          if (this.byId("postProductionReportingPageLayout")) {
              if (this.selectedTheme === "sap_belize_plus")
                  this.addStyleClassToAnchorBar(items, anchorBarId);
              else
                  this.removeStyleClassFromAnchorBar(items, anchorBarId);
          }
      },

      addStyleClassToAnchorBar: function (items, anchorBarId) {
          for (var i = 0; i < items.length; i++) {
              if ((items[i].sId).includes("anchBar")) {
                  var anchorBarId = items[i].getParent().sId + "-" + anchorBarId;
                  var globalId = this.createId(anchorBarId);
                  var element = document.getElementById(globalId);
                  if (element) {
                      var styleName = "title";
                      var arr = element.className.split(" ");
                      if (arr.indexOf(styleName) == -1) {
                          element.className += " " + styleName;
                      }
                  }
                  break;
              }
          }
      },

      removeStyleClassFromAnchorBar: function (items, anchorBarId) {

          for (var i = 0; i < items.length; i++) {
              if ((items[i].sId).includes("anchBar")) {
                  var anchorBarId = items[i].getParent().sId + "-" + anchorBarId;
                  var element = document.getElementById(anchorBarId);
                  if (element)
                      element.className = element.className.replace(/\btitle\b/g, "");
                  break;
              }
          }
      },

      changeBackgroundColorAccordingToTheme: function () {

          this.selectedTheme = sap.ui.getCore().getConfiguration().getTheme();
          var anchorBarId = this.findCurrentAnchorBarId();
          this.adjustAnchorBarCSSChanges(anchorBarId);
          if (this.byId("postProductionReportingPageLayout")) {
              if (this.selectedTheme === "sap_belize_plus") {
                  this.byId("postProductionReportingPageLayout").getHeaderTitle().addStyleClass("title");
                  this.byId("postProductionReportingPageLayout").getHeaderContent()[0].addStyleClass("header");
              } else {
                  this.byId("postProductionReportingPageLayout").getHeaderTitle().removeStyleClass("title");
                  this.byId("postProductionReportingPageLayout").getHeaderContent()[0].removeStyleClass("header");
              }
              this.adjustCollapseAndPinButtonCSSChanges();
          }
      },

      adjustCollapseAndPinButtonCSSChanges: function () {
          var items = (this.byId("postProductionReportingPageLayout") ? this.byId("postProductionReportingPageLayout").getControlsByFieldGroupId("") : []);
          for (var i = 0; i < items.length; i++) {
              if ((items[i].sId).includes("collapseBtn")) {
                  this.removeAndAddStyleClass(items[i].sId, true);
                  break;
              }
          }
          for (var i = 0; i < items.length; i++) {
              if ((items[i].sId).includes("pinBtn")) {
                  this.removeAndAddStyleClass(items[i].sId, false);
                  break;
              }
          }
      },

      removeAndAddStyleClass: function (sId, isCollapseButton) {
          if (this.selectedTheme === "sap_fiori_3") {
              if (isCollapseButton) {
                  this.byId(sId).removeStyleClass("collapseBtnStyleBelize");
                  this.byId(sId).addStyleClass("collapseBtnStyleFiori3");
              } else {
                  this.byId(sId).removeStyleClass("pinBtnStyleBelize");
                  this.byId(sId).addStyleClass("pinBtnStyleFiori3");
              }
          } else {
              if (isCollapseButton) {
                  this.byId(sId).removeStyleClass("collapseBtnStyleFiori3");
                  this.byId(sId).addStyleClass("collapseBtnStyleBelize");
              } else {
                  this.byId(sId).removeStyleClass("pinBtnStyleFiori3");
                  this.byId(sId).addStyleClass("pinBtnStyleBelize");
              }
          }
      },

      findCurrentAnchorBarId: function () {
          if (this._bHeaderExpanded)
              return "anchorBar";
          else
              return "stickyAnchorBar";
      },

      onTitleSelectorPressed: function (oEvent) {
          this._bHeaderExpanded = !this._bHeaderExpanded;
          var anchorBarId = this.findCurrentAnchorBarId();
          this.adjustAnchorBarCSSChanges(anchorBarId);
      },

      setDataToPlugin: function (sChannelId, sEventId, oData) {
          this.setControllerToFragments();
          UserSelectionDialog.userListAll = undefined;
          this.setDataToOrderHeaderInfo(oData);
          this.setDataToPhaseSection();
      },

      setControllerToFragments: function () {
          QuantityConfirmation.setController(this);
          ActivityConfirmation.setController(this);
          PhaseDetails.setController(this);
          MaterialComponents.setController(this);
          GoodsReceipt.setController(this);
          DataCollection.setController(this);
          StorageLocationDialog.setController(this);
          BatchDialog.setController(this);
          MaterialComponentsPostingDialog.setController(this);
      },

      getGRQuantity: function () {
          this.objPage.getHeaderContent()[0].setBusy(true);
          var inventoryUrl = this.getInventoryDataSourceUri();
          var oParameters = {};
          var order = this.selectedOrderData.order;
          var sfc = this.selectedOrderData.sfc;
          oParameters.shopOrder = order;
          oParameters.sfc = sfc;
          var sUrl = inventoryUrl + "order/goodsReceipt/summary";
          this.fetchGrData(sUrl, oParameters);
      },

      /***
       * Fetch GR Summary data
       */
      fetchGrData: function (sUrl, oParameters) {
          var that = this;
          AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
              that.itemtList = oResponseData;
              that.objPage.getModel("orderData").setProperty("/completedQtyInProductionUom", that.itemtList.receivedQuantity.value);
              that.objPage.getModel("orderData").setProperty("/plannedQtyInProductionUom", that.itemtList.targetQuantity.value);
              that.objPage.getModel("orderData").setProperty("/sfcCompletedQtyInProductionUom", that.itemtList.lineItems[0].receivedQuantity.value);
              that.objPage.getModel("orderData").setProperty("/sfcPlannedQtyInProductionUom", that.itemtList.lineItems[0].targetQuantity.value);
              that.objPage.getModel("orderData").refresh();
              that.objPage.getHeaderContent()[0].setBusy(false);
          }, function (oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.itemtList = {};
              that.objPage.getHeaderContent()[0].setBusy(false);
          });
      },

      setDataToOrderHeaderInfo: function (oData) {
          this.selectedOrderData = oData;
          this.objPage = this.byId("postProductionReportingPageLayout");
          var selectedOrderDataModel = new JSONModel();
          selectedOrderDataModel.setData(this.selectedOrderData);
          this.objPage.setModel(selectedOrderDataModel, "orderData");
          // fetch the Order Header Instructions and add it to orderModel
          this.getOrderHeaderText();
      },

      assembleSectionsByVisibility: function (aVisibleSections, materialComponentsSubSection, phaseObjPageSection,
                                              activityConfirmationSubSection, quantityConfirmationSubSection,
                                              DataCollectionSubSection) {
          aVisibleSections.forEach(visibleSection => {
              switch (visibleSection) {
                  case "MaterialConsumption":
                      materialComponentsSubSection && phaseObjPageSection.addSubSection(materialComponentsSubSection);
                      break;
                  case "ActivityConfirmation":
                      activityConfirmationSubSection && phaseObjPageSection.addSubSection(activityConfirmationSubSection);
                      break;
                  case "QuantityConfirmation":
                      quantityConfirmationSubSection && phaseObjPageSection.addSubSection(quantityConfirmationSubSection);
                      break;
                  case "DataCollection":
                      DataCollectionSubSection && phaseObjPageSection.addSubSection(DataCollectionSubSection);
                      break;
                  default:
                      break;
              }
          });
      },

      getVisibleSections: function () {
          const that = this;
          const oPodConfig = that.getView().getModel("configuration").getData();
          //In case the existing POD does not have the sequencing.
          if(!oPodConfig.sequence){
              oPodConfig.sequence = [
                  {"id": "MaterialConsumption",  "visible": true, "multipleReporting": true, "i18nKey": "materialComponents.header"},
                  {"id": "QuantityConfirmation", "visible": true, "multipleReporting": true, "i18nKey": "quantityConfirmationTable.header"},
                  {"id": "ActivityConfirmation", "visible": true, "multipleReporting": true, "i18nKey": "activityConfirmationTable.header"},
                  {"id": "DataCollection",       "visible": true, "multipleReporting": false, "i18nKey": "dataCollection.header"}
              ];
          }
          return oPodConfig.sequence && oPodConfig.sequence.filter(section => section.visible === true).map(section => section.id);
      },

      setDataToPhaseSection: function (updateFlag) {
          var sUrl, pathParams;
          var oParameters = {};
          var that = this;
          sUrl = this.getWorklistDataSourceUri() + "orders/" + jQuery.sap.encodeURL(this.selectedOrderData.orderRef);
          pathParams = "/recipes/" + jQuery.sap.encodeURL(this.selectedOrderData.routingRef) + "/phases?ref=" + jQuery.sap.encodeURL(this.selectedOrderData.sfcRef);
          that.objPage = that.byId("postProductionReportingPageLayout");
          that.objPage.setBusy(true);
          AjaxUtil.get(sUrl + pathParams, oParameters, function (oResponseData) {
              if (!updateFlag) {
                  that.objPage.destroySections();
                  let oPodModel = that.getPodSelectionModel();
                  oPodModel.setSelectedPhaseWorkCenter("");
                  that.setGlobalProperty("selectedPhaseResource", "");
                  oPodModel.clearOperations();
              }
              that.phaseList = oResponseData;
              that.phaseList.sort(function (a, b) {
                  return a.phaseId - b.phaseId
              });
              that.phaseListModel = that.phaseListModel || new JSONModel();
              that.phaseListModel.setData(that.phaseList);
              that.byId("postProductionReportingPageLayout").setModel(that.phaseListModel, "phaseListModel");
              if (!updateFlag) {
                  that.createReportInfoSection();
              }
              const aVisibleSections = that.getVisibleSections();
              if (that.phaseList.length !== 0 && !updateFlag) {
                  for (var i = 0; i < that.phaseList.length; i++) {
                      var stepId = that.phaseList[i].stepId;
                      var sectionTitle = that.formatter.formatSectionTitle(that.phaseList[i].operation.operation, that.phaseList[i].stepId, that);

                      //A message strip has been added to Phase Info fragment according to the mockup. Development of rest part is still pending.
                      var oPhaseDetailsFragment = sap.ui.xmlfragment("PhaseDetails" + stepId, "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.PhaseDetails", that);
                      that.getView().addDependent(oPhaseDetailsFragment);
                      var phaseObjPageSubSection = new ObjectPageSubSection("PhaseDetailsSubSection" + stepId, {
                          titleUppercase: false
                      });
                      phaseObjPageSubSection.addBlock(oPhaseDetailsFragment);

                      if(aVisibleSections.includes("ActivityConfirmation")) {
                          // Addding activityConfirmation fragment
                          var activityConfirmationFragment = sap.ui.xmlfragment("activityConfirmation" + stepId, "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.ActivityConfirmation", that);
                          that.getView().addDependent(activityConfirmationFragment);
                          var activityConfirmationSubSection = new ObjectPageSubSection("ActivityConfirmationSubSection" + stepId, {
                              titleUppercase: false
                          });
                          activityConfirmationSubSection.stepId = stepId;
                          activityConfirmationSubSection.phaseId = that.phaseList[i].phaseId;
                          activityConfirmationSubSection.workcenter = that.phaseList[i].workCenter;
                          activityConfirmationSubSection.addBlock(activityConfirmationFragment);
                      }

                      if(aVisibleSections.includes("QuantityConfirmation")) {
                          // Addding quantityConfirmation fragment
                          var quantityConfirmationFragment = sap.ui.xmlfragment("quantityConfirmation" + stepId, "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.QuantityConfirmation", that);
                          that.getView().addDependent(quantityConfirmationFragment);
                          var quantityConfirmationSubSection = new ObjectPageSubSection("QuantityConfirmationSubSection" + stepId, {
                              titleUppercase: false
                          });
                          quantityConfirmationSubSection.stepId = stepId;
                          quantityConfirmationSubSection.phaseId = that.phaseList[i].phaseId;
                          quantityConfirmationSubSection.workcenter = that.phaseList[i].workCenter;
                          quantityConfirmationSubSection.erpAutoGr = that.phaseList[i].erpAutoGr;
                          quantityConfirmationSubSection.addBlock(quantityConfirmationFragment);
                      }
                      if(aVisibleSections.includes("DataCollection")) {
                          var DataCollectionFragment = sap.ui.xmlfragment("DataCollection" + stepId, "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.DataCollection", that);
                          that.getView().addDependent(DataCollectionFragment);
                          var DataCollectionSubSection = new ObjectPageSubSection("DataCollectionSubSection" + stepId, {
                              titleUppercase: false
                          });
                          DataCollectionSubSection.addBlock(DataCollectionFragment);
                      }
                      if(aVisibleSections.includes("MaterialConsumption")) {
                          var materialComponentsFragment = sap.ui.xmlfragment("materialComponents" + stepId, "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.MaterialComponents", that);
                          that.getView().addDependent(materialComponentsFragment);
                          var materialComponentsSubSection = new ObjectPageSubSection("MaterialComponentsSubSection" + stepId, {
                              titleUppercase: false
                          });
                          materialComponentsSubSection.addBlock(materialComponentsFragment);
                      }
                      var phaseObjPageSection = new ObjectPageSection("PhaseDetailsEntrySection" + stepId, {
                          title: sectionTitle,
                          showTitle: true,
                          titleUppercase: false
                      });
                      phaseObjPageSection.addSubSection(phaseObjPageSubSection);
                      that.assembleSectionsByVisibility(aVisibleSections, materialComponentsSubSection,
                          phaseObjPageSection, activityConfirmationSubSection,quantityConfirmationSubSection,
                          DataCollectionSubSection);

                      that.objPage.addSection(phaseObjPageSection);

                      var oPhaseDetailsModel = new JSONModel();
                      oPhaseDetailsModel.setData(that.phaseList[i]);
                      that.objPage.setModel(oPhaseDetailsModel, "PhaseDetailsEntrySection" + stepId);
                  }
              }
              if (!updateFlag) {
                //   that.createGrSection();
                  that._bHeaderExpanded = true;
                  that.changeBackgroundColorAccordingToTheme();
              } else {
                  that.updatePhaseDetailsSection(oResponseData);
              }
              that._updateProductionProcessNotifications(oResponseData);
              that._updatePhaseListNotifications(oResponseData);
              that.objPage.setBusy(false);
          }, function (oError, oHttpErrorMessage) {
              var err = oError || oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.objPage.setBusy(false);
          });
      },

      getOrderHeaderText: function () {
          // Do not fetch header instructions when the plugin config "Show order header instructions" is false
          // This is always false for Default Post Prod POD 
          if (!this.oPluginConfiguration.showOrderHeaderInstructions) return;
          var demandUrl = this.getDemandRestDataSourceUri();
          var sUrl = demandUrl + "shopOrders/findHeaderTextByShopOrderRef";
          var oParameters = {
              shopOrder: this.selectedOrderData.order
          };
          var that = this;
          AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
              // Display the text as per the response after trimming the starting and trailing spaces
              // This is for S4HC header text where Line Breaks are not supported from the API
              if (typeof oResponseData === 'string') {
                  that.objPage.getModel("orderData").setProperty("/headerText", oResponseData.trim());
              }
                  // For S4OP scenarios, check if array item has empty TDLINE, this means that there is a line break.
              // In this case we only add a line break. Or else we add the string in TDLINE and append a line break after that,
              else {
                  var headerText = "";
                  // using old-school for loop for stability in order of iteration and old browser support(ES5)
                  for (var i = 0; i < oResponseData.length; i++) {
                      headerText = (oResponseData[i].TDLINE === "") ? headerText.concat("\n") : headerText.concat(oResponseData[i].TDLINE + "\n");
                  }
                  that.objPage.getModel("orderData").setProperty("/headerText", headerText);
              }
          }, function (oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              // This error block will only be executed if there is no header text configured. (In normal scenarios)
              // Instead of throwing an error, we log it since we don't want the user to get blocked if he has not configured any order header text
              oLogger.error(err.error.message);
          });
      },


      createGrSection: function () {
          var goodsReceiptFragment = sap.ui.xmlfragment("goodsReceipt", "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.GoodsReceipt", this);
          this.getView().addDependent(goodsReceiptFragment);
          var goodsReceiptSubSection = new ObjectPageSubSection("GoodsReceiptSubSection", {
              titleUppercase: false
          });
          goodsReceiptSubSection.addBlock(goodsReceiptFragment);
          var GoodsReceiptSection = new ObjectPageSection("GoodsReceiptSection", {
              title: (this.getI18nText("goodsReceipt")),
              showTitle: true,
              titleUppercase: false
          });
          GoodsReceiptSection.addSubSection(goodsReceiptSubSection);
          this.objPage.addSection(GoodsReceiptSection);
      },

      updatePhaseDetailsSection: function (oResponseData) {
          oResponseData.forEach(function (phase) {
              if (phase.phaseId === this.selectedSectionData.phaseId) {
                  PhaseDetails.setPhaseDetails(phase);
                  return;
              }
          }.bind(this))
      },

      setAllWorkcenters: function () {
          var distinctArr = [];
          this.phaseList.forEach(function (phase) {
              if (!distinctArr.includes(phase.workCenter.ref)) {
                  distinctArr.push(phase.workCenter.ref);
              }
          });
          this.allWorkcenters = distinctArr;
          this.checkAuthorized();
      },

      checkAuthorized: function () {
          this.authorizedUser = false;
          if (!this.loggedInUserDetails) {
              this.prepareReportInfoModel();
              return;
          }
          var filterStringForWorkcenters = "";
          this.allWorkcenters.forEach(function (oWorkcenterRef, oIndex) {
              if (oIndex < this.allWorkcenters.length - 1) {
                  filterStringForWorkcenters += "ref eq ('" + oWorkcenterRef + "') or "
              } else {
                  filterStringForWorkcenters += "ref eq ('" + oWorkcenterRef + "')"
              }
          }.bind(this));
          var plantUrl = this.getPlantDataSourceUri();
          var sUrl = plantUrl + "Workcenters?$expand=userWorkCenters($expand=user($select=ref,userId))&$filter=" + encodeURIComponent(filterStringForWorkcenters);
          var that = this;
          that.objPage.setBusy(true);
          AjaxUtil.get(sUrl, null, function (oResponseData) {
              var distinctUsers = UserSelectionDialog.fetchDistinctUsersFromMultipleWC(oResponseData);
              distinctUsers.forEach(function (user) {
                  if (that.loggedInUserDetails.userId === user.userId) {
                      that.authorizedUser = true;
                      return;
                  }
              });
              that.prepareReportInfoModel();
              that.objPage.setBusy(false);
          }, function (oError, oHttpErrorMessage) {
              that.objPage.setBusy(false);
              var err = oError ? oError : oHttpErrorMessage;
              that.oController.showErrorMessage(err, true, true);
          });

      },

      prepareReportInfoModel: function () {
          this.oReportInfoModel = this.oReportInfoModel || new JSONModel();
          //to display - format of UI date picker 
          var oData = {
              "selectedTime": this.oViewData['prefillPlannedStartDate'] ? this.formatter.formatDateTime(moment(this.selectedOrderData.plannedStartDate).tz(this.getPodSelectionModel().getTimeZoneId())) : "",
              "selectedUser": (this.loggedInUserDetails && this.authorizedUser) ? this.loggedInUserDetails.userId : ""
          };
          this.oReportInfoModel.setData(oData);
          this.getView().setModel(this.oReportInfoModel, "ReportInfoSection");
          this.setReportInfoDataFromModel();
          //to store - format for model storing "YYYY-MM-DD HH:mm:ss"
          if (this.oReportInfoModel.getProperty("/selectedTime") !== "") {
              var sFormattedDate = moment(this.selectedOrderData.plannedStartDate).tz(this.getPodSelectionModel().getTimeZoneId()).format("YYYY-MM-DD HH:mm:ss");
              this.oReportInfoModel.setProperty("/selectedTime", sFormattedDate);
          }
      },

      handleChangeReportInfoDate: function (oEvent) {
          if (oEvent.getParameter("valid")) {
              this.resetState();
          } else {
              oEvent.getSource().setValueState("Error");
              oEvent.getSource().setValueStateText(this.getI18nText("invalidInput"));
              Fragment.byId("ReportInfoDialog", "saveReportInfo").setEnabled(false);
          }
      },

      handleApplyReportInfoData: function () {
          var sSelectedTime = Fragment.byId("ReportInfoDialog", "inputCmnPostDateTime").getValue();
          var sSelectedUser = Fragment.byId("ReportInfoDialog", "inputCmnPostUser").getValue();
          this.setChangesToReportInfoModel(sSelectedTime, sSelectedUser);
          this.showSuccessMessage(this.getI18nText("defaultSettingsApplySuccess"), true, false);
      },

      handleResetReportInfoData: function () {
          this.prepareReportInfoModel();
          this.showSuccessMessage(this.getI18nText("defaultSettingsApplySuccess"), true, false);
      },

      setChangesToReportInfoModel: function (sSelectedTime, sSelectedUser) {
          this.oReportInfoModel.setProperty("/selectedTime", sSelectedTime);
          this.oReportInfoModel.setProperty("/selectedUser", sSelectedUser);
          this.resetState();
      },

      setReportInfoDataFromModel: function () {
          var sSelectedTime = this.oReportInfoModel.getProperty("/selectedTime");
          var sSelectedUser = this.oReportInfoModel.getProperty("/selectedUser");
          Fragment.byId("ReportInfoDialog", "inputCmnPostDateTime").setValue(sSelectedTime);
          Fragment.byId("ReportInfoDialog", "inputCmnPostUser").setValue(sSelectedUser);
          this.resetState();
      },

      resetState: function () {
          Fragment.byId("ReportInfoDialog", "inputCmnPostDateTime").setValueState("None");
          Fragment.byId("ReportInfoDialog", "inputCmnPostDateTime").setValueStateText("");
        //   Fragment.byId("ReportInfoDialog", "saveReportInfo").setEnabled(true);
      },

      showUserDialogRI: function () {
          var oControl = Fragment.byId("ReportInfoDialog", "inputCmnPostUser");
          UserSelectionDialog.setController(this);
          UserSelectionDialog.showUserSelectionDialog(this.allWorkcenters, function (oSelectedUser) {
              oControl.setValue(oSelectedUser.userId);
          }, true);
      },

      onSelectPostedByUser: function (oEvent) {
          var selectedUser = oEvent.getSource().getSelectedItem().getBindingContext("userModel").getObject();
          this.byId("userListTable").removeSelections(true);
          Fragment.byId("ReportInfoDialog", "inputCmnPostUser").setValue(selectedUser.userId);
          this.onCloseUserDialog();
      },

      createReportInfoSection: function () {
          this.objPage.setBusy(true);
          var oReportInfoFragment = sap.ui.xmlfragment("ReportInfoDialog", "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.ReportInfo", this);
          this.getView().addDependent(oReportInfoFragment);
          // Set the initial focused date to current plant time
          var currentDateTimeInPlantTimeZone = this.getCurrentDateTimeInPlantTimeZone();
          if (sap.ui.Device.browser.name === "sf") {
              currentDateTimeInPlantTimeZone = currentDateTimeInPlantTimeZone.replace(/ /g, "T")
          }
          Fragment.byId("ReportInfoDialog", "inputCmnPostDateTime").setInitialFocusedDateValue(new Date(currentDateTimeInPlantTimeZone));
          var globalLoggedInUser = this.getGlobalProperty("loggedInUserDetails");
          this.loggedInUserDetails = globalLoggedInUser ? globalLoggedInUser : {};
          this.setAllWorkcenters();
          var reportInfoObjPageSubSection = new ObjectPageSubSection("ReportInfoSubSection", {
              titleUppercase: false
          });
          reportInfoObjPageSubSection.addBlock(oReportInfoFragment);
          var reportInfoObjPageSection = new ObjectPageSection("ReportInfoSection", {
              title: (this.getI18nText("reportInfoTitle")),
              showTitle: true,
              titleUppercase: false
          });
          reportInfoObjPageSection.addSubSection(reportInfoObjPageSubSection);
          this.objPage.addSection(reportInfoObjPageSection);
          this.objPage.setSelectedSection(reportInfoObjPageSection);
      },

      onNavigateToSection: function (oEvent) {
          var sectionId = oEvent.getSource().getSelectedSection();
          this.selectedSectionData = oEvent.getSource().getModel(sectionId) ? oEvent.getSource().getModel(sectionId).getData() : {};
          let oPodModel = this.getPodSelectionModel();
          if(this.selectedSectionData && this.selectedSectionData.workCenter){
              oPodModel.setSelectedPhaseWorkCenter(this.selectedSectionData.workCenter.workcenter);
              this.setGlobalProperty("selectedPhaseResource", this.selectedSectionData.resource.resource);
              this.setOperationActivityDataToPodSelectionModel(oPodModel);
          }else{
              oPodModel.setSelectedPhaseWorkCenter("");
              this.setGlobalProperty("selectedPhaseResource", "");
              oPodModel.clearOperations();
          }
          //  fetch the selected section obj
          var selectedSection = oEvent.getSource().getSections().filter(function (obj) {
              return obj.sId === sectionId
          });
          selectedSection[0].getSubSections().forEach(function (obj) {
              //  fetch the activity confirmation subsection obj
              if (obj.sId.includes("ActivityConfirmation")) {
                  this.activityConfirmationSubSection = obj;
              } else if (obj.sId.includes("MaterialComponents")) {
                  this.materialComponentsSubSection = obj;
              } else if (obj.sId.includes("QuantityConfirmation")) {
                  this.quantityConfirmationSubSection = obj;
              } else if (obj.sId.includes("DataCollection")) {
                  this.DataCollectionSubSection = obj;
              }
              if (obj.sId.includes("PhaseDetails")) {
                  this.phaseDetailsSubSection = obj;
              }
          }.bind(this));

          if (sectionId === "ReportInfoSection") {
              this.setReportInfoDataFromModel();
          } else if (sectionId === "GoodsReceiptSection") {
              this.grSubSection = selectedSection[0].getSubSections()[0];
              GoodsReceipt.getGrData();
          } else {
              //DIGMANEXE-52567 #fetching phase data from API at every icon tab bar click to fix stale start and end phase date
              this.setDataToPhaseSection(true);
              const aVisibleSections = this.getVisibleSections();
              aVisibleSections.includes("MaterialConsumption") && MaterialComponents.getGiMaterialData();
              PhaseDetails.setPhaseDetails(this.selectedSectionData);
              aVisibleSections.includes("QuantityConfirmation") && QuantityConfirmation.getQuantityConfirmationData();
              aVisibleSections.includes("ActivityConfirmation") && ActivityConfirmation.getActivityConfirmationData();
              aVisibleSections.includes("DataCollection") && DataCollection.getDataCollectionData();
          }
      },

      setOperationActivityDataToPodSelectionModel: function (oPodModel) {
          let operationActivityModelData = {};
          operationActivityModelData.operationRef = this.selectedSectionData.operation.ref;
          operationActivityModelData.operation = (this.selectedOrderData.orderSelectionType === "PROCESS") ? this.selectedSectionData.phaseId : this.selectedSectionData.operation.operation;
          operationActivityModelData.recipeArray = this.selectedSectionData.recipeArray;
          operationActivityModelData.workCenter = this.selectedSectionData.workCenter;
          operationActivityModelData.stepId = this.selectedSectionData.stepId;
          oPodModel.clearOperations();
          oPodModel.addOperation(operationActivityModelData);
      },

      getCurrentDateTimeInPlantTimeZone: function () {
          this.plantTimeZoneId = this.getPodSelectionModel().timeZoneId;
          return moment().tz(this.plantTimeZoneId).format("YYYY-MM-DD HH:mm:ss");
      },

      onExit: function () {
          ListPluginViewController.prototype.onExit.apply(this, arguments);
          this.unsubscribe("orderSelectionEvent", this);
          GoodsReceipt.onExit();
      }

  });
});