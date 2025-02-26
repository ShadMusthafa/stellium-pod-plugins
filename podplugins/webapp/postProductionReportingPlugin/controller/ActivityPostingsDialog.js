sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment",
], function (JSONModel, AjaxUtil, Fragment) {
    "use strict";

    return {

        setController: function (sController) {
            this.oController = sController;
        },

        /**
        * Show the Activity Postings dialog  which contains list of activity postings per user sorted by creation date
        * @param {Object} oParams - Object containing activity details for fetch API 
        * @param {String} activityText - Activity desccription 
        */       
        showActivityPostingsDialog: function (oParams, activityText) {
            var oView = this.oController.getView();
            if (!this.oController.byId("ActivityPostingsDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.ActivityPostingsDialog",
                    controller: this.oController
                }).then(function (oDialog) {
                    oDialog.setEscapeHandler(function(oPromise) {
                        this.onCloseActivityPostingsDialog();
                        oPromise.resolve();
                    }.bind(this));
                    oView.addDependent(oDialog);
                    this.oController.byId("ActivityTextColumn").setText(activityText || oParams.activityId);
                    oDialog.open();
                    this.onAfterRenderingActivityPostingDialog (oParams);
                }.bind(this));
            } else {
                this.oController.byId("ActivityTextColumn").setText(activityText || oParams.activityId);
                this.oController.byId("ActivityPostingsDialog").open();
                this.onAfterRenderingActivityPostingDialog (oParams);
            }
        },

        onAfterRenderingActivityPostingDialog: function (oParams) {
            var that = this;
            setTimeout(function() {
                that.fetchReportedActivityConfirmationData(oParams);
            }, 125);
        },

        /***
         * Fetch posting details as per the params passed
         */
        fetchReportedActivityConfirmationData: function (oParams) {
            var oView = this.oController.getView();
            var that = this;
            var sUrl = this.oController.getActivityConfirmationRestDataSourceUri() + "activityconfirmation/postings/details/phase";            
			this.oController.byId("ActivityDetailsTable").setBusy(true);
			AjaxUtil.get(sUrl, oParams, function (oResponseData) {
				that.reportedActivityConfirmationList = oResponseData;
				var viewActivityReportModel = new JSONModel(that.reportedActivityConfirmationList);
                var postingTable = that.oController.byId("ActivityDetailsTable")
                var postingTableCLItem= that.oController.byId("actConfirmationPostingDetailsCLItem")
                postingTable.setModel(viewActivityReportModel, "viewActivityReportModel");
                that.postingsTableColumnLength = postingTable.getColumns().length;
                that.postingColumnListItemLength = postingTableCLItem.getCells().length;
                var oColumnListItem = that.oController.utils.buildCustomFieldColumns(that.reportedActivityConfirmationList.activityDetails, postingTable, postingTableCLItem, that.oController.oPluginConfiguration,"viewActivityReportModel");
                postingTable.bindItems("viewActivityReportModel>/activityDetails", oColumnListItem, null, null);
                postingTable.setBusy(false);
			}, function (oError, oHttpErrorMessage) {
				var err = oError ? oError : oHttpErrorMessage;
				that.oController.showErrorMessage(err, true, true);
				that.reportedActivityConfirmationList =  {};
				that.oController.byId("ActivityDetailsTable").setBusy(false);
			})
        },
        
        /***
         * Close the dialog on click of close button
         */
        onCloseActivityPostingsDialog: function () {
            var oTable = this.oController ? this.oController.byId("ActivityDetailsTable") : this.byId("ActivityDetailsTable");
            var oColumnListItem = this.oController ? this.oController.byId("actConfirmationPostingDetailsCLItem") : this.byId("actConfirmationPostingDetailsCLItem");
            var postingsTableColumnLength = this.oController ? this.oController.ActivityPostingsDialog.postingsTableColumnLength : this.ActivityPostingsDialog.postingsTableColumnLength;
            var postingColumnListItemLength = this.oController ? this.oController.ActivityPostingsDialog.postingColumnListItemLength : this.ActivityPostingsDialog.postingColumnListItemLength;
            var oTableLength = oTable.getColumns().length;
            var oColumnListItemLength = oColumnListItem.getCells().length;
            for(var i=oTableLength; i > postingsTableColumnLength; i--){
                oTable.removeColumn(oTable.getColumns()[i-1]);
            }
            for(var j=oColumnListItemLength; j > postingColumnListItemLength; j--){
                oColumnListItem.removeCell(oColumnListItem.getCells()[j-1]);
            }
            var oDialog = this.oController ?  this.oController.byId("ActivityPostingsDialog") :  this.byId("ActivityPostingsDialog");
            oDialog.close()
        },

    }
});