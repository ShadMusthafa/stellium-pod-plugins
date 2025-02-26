sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (JSONModel, AjaxUtil, Fragment, Filter, FilterOperator) {
    "use strict";

    return {

        setController: function (sController) {
            this.oController = sController;
        },

        /**
        * Show the user selection dialog  which contains of users assigned to a particular work center
        * @param {Array} workCenterRefList - List of Workcenter Ref for which the assigned list of user are to be obtained
        * @param {Function} fnPostSelectioncallback - callback method to handle the selected User object
        */       
        showUserSelectionDialog: function (workCenterRefList, fnPostSelectioncallback, bAll) {
            this.fnPostSelectioncallback = fnPostSelectioncallback;
            this.selectedWorkCenterRefList = workCenterRefList;
            var oView = this.oController.getView();
            var oUserDialog = this.oController.byId("userSelectionDialog");
            if (!oUserDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.UserSelectionDialog",
                    controller: this.oController
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.onAfterRenderingUserDialog(oDialog, bAll);
                }.bind(this));
            } else {
                oUserDialog.open();
                this.onAfterRenderingUserDialog(oUserDialog, bAll);
            }
        },

        onAfterRenderingUserDialog: function (oDialog,  bAll) {
            var that = this;
            setTimeout(function() {
                that.oController.byId("userSearch").setValue("");
                if (bAll && that.userListAll) {
                    that.userList = that.userListAll;
                    that.setDataToUserDialog();
                } else {
                    that.fetchUsersAuthorizedForCurrentWorkCenter(bAll);
                }
            }, 125);
        },

        /***
         * Get the list of users from Plant oData service
         */
        fetchUsersAuthorizedForCurrentWorkCenter: function (bAll) {
            this.filterStringForWorkcenters = this.filterStringForUsers = "";
            this.buildFIlterStringForWorkcenters(this.selectedWorkCenterRefList);
            var plantUrl = this.oController.getPlantDataSourceUri();
            var sUrl = plantUrl + "Workcenters?$expand=userWorkCenters($expand=user($select=ref,userId))&$filter=" + encodeURIComponent(this.filterStringForWorkcenters);
            var that = this;
            that.oController.byId("userSelectionDialog").setBusy(true);
            AjaxUtil.get(sUrl, null, function (oResponseData) {
                var distinctUsers = that.fetchDistinctUsersFromMultipleWC(oResponseData);
                that.buildFIlterStringForUsers(distinctUsers);
                that.fetchDetailsOfAuthorizedUsers(oResponseData, bAll);
            }, function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.byId("userSelectionDialog").setBusy(false);
            });
        },

        /***
         * Get the list of distinct users from the wc api response
         */
        fetchDistinctUsersFromMultipleWC: function (oResponseData) {
            var distinctArr = [];
            for(var i = 0; i<oResponseData.value.length; i++) {
                oResponseData.value[i].userWorkCenters.forEach(function(user) {
                    if(!distinctArr.includes(user.user)){
                        distinctArr.push(user.user);
                    }
                });              
            }
            return distinctArr;
        },

        /***
         * Build an oData Filter string with the list of Workcenter ID passed
         */
        buildFIlterStringForWorkcenters: function (oResponseData) {
            oResponseData.forEach(function (oWorkcenterRef, oIndex) {
                if(oIndex < oResponseData.length - 1) {
                    this.filterStringForWorkcenters += "ref eq ('"+ oWorkcenterRef +"') or "
                } else {
                    this.filterStringForWorkcenters += "ref eq ('"+ oWorkcenterRef +"')"
                }
            }.bind(this));
        },

        /***
         * Build an oData Filter string with the list of User ID fetched from the workcenter API
         */
        buildFIlterStringForUsers: function (oResponseData) {
            oResponseData.forEach(function (oUser, oIndex) {
                if(oIndex < oResponseData.length - 1) {
                    this.filterStringForUsers += "userId eq ('"+ oUser.userId +"') or "
                } else {
                    this.filterStringForUsers += "userId eq ('"+ oUser.userId +"')"
                }
            }.bind(this));
        },

        /***
         * Get all the user details for the given list of user ID
         */
        fetchDetailsOfAuthorizedUsers: function (oData, bAll) {
            var plantUrl = this.oController.getPlantDataSourceUri();
            var sUrl = plantUrl + "Users?$select=ref,userId,givenName,familyName&$filter="+ this.filterStringForUsers;
            var that = this;
            that.oController.byId("userSelectionDialog").setBusy(true);
            AjaxUtil.get(sUrl, null, function (oResponseData) {
                that.userList = oResponseData.value;
                if(bAll) {
                    that.userListAll = that.userList;
                }
                that.setDataToUserDialog();
            }, function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.byId("userSelectionDialog").setBusy(false);
            });
        },

        /***
         * Get all the user details for the given list of user ID
         */
        setDataToUserDialog: function() {
            this.userModel = new JSONModel();
            this.userModel.setSizeLimit(this.userList.length);
            this.userModel.setData(this.userList);
            this.oController.byId("userListTable").setModel(this.userModel, "userModel");
            this.oController.byId("userSelectionDialog").setBusy(false);
        },

        /***
         * Handle search functionality in the dialog
         */
        onSearchUserList: function (oEvent) {
			// add filter for search
			var aFilters = [], oFilterWithAllProperties;
            var sQuery = oEvent.getParameter("newValue");
			if (sQuery && sQuery.length > 0) {
                var filter1 = new Filter("userId", FilterOperator.Contains, sQuery);
                var filter2 = new Filter("givenName", FilterOperator.Contains, sQuery);
				var filter3 = new Filter("familyName", FilterOperator.Contains, sQuery);
                aFilters.push(filter1, filter2, filter3);
                oFilterWithAllProperties = new Filter({ filters: aFilters, and: false });
			}
			// update list binding
			var oList = this.byId("userListTable");
            var oBinding = oList.getBinding("items");
            oBinding.filter(oFilterWithAllProperties);
        },

        /***
         * Select user handler to invoke the callback passed by the parent controller
         */
        onSelectUser: function(oEvent) {
            var selectedUser = oEvent.getSource().getSelectedItem().getBindingContext("userModel").getObject();
            this.byId("userListTable").removeSelections(true);
            this.byId("userSelectionDialog").close();
            if(this.UserSelectionDialog.fnPostSelectioncallback) {
                this.UserSelectionDialog.fnPostSelectioncallback(selectedUser);
            }
        },

        /***
         * Close the dialog on click of close button
         */
        onCloseUserSelectionDialog: function () {
            this.getView().byId("userSelectionDialog").close();
        },

    }
});