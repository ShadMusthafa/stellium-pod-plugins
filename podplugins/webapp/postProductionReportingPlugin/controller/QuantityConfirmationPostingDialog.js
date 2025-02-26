sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment"
], function (JSONModel, AjaxUtil, Fragment) {
    "use strict";

    return {
        setController: function (sController) {
            this.oController = sController;
        },

        /**
        * Show the Quantity Confirmation Postings dialog  which contains list of quantity postings per user sorted by creation date
        * @param {Object} oParams - Object containing quantity details for fetch API 
        */       
        showQuantityConfirmationPostings: function (oParams, quantityType) {
            var oView = this.oController.getView();
            if (!this.oController.byId("QuantityPostingsDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.QuantityConfirmationPostings",
                    controller: this.oController
                }).then(function (oDialog) {
                    oDialog.setEscapeHandler(function(oPromise) {
                        this.onCloseQuantityPostingsDialog();
                        oPromise.resolve();
                    }.bind(this));
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.onAfterRenderingQuantityConfirmationDialog(oParams, quantityType);
                }.bind(this));
            } else {
                this.oController.byId("QuantityPostingsDialog").open();
                this.onAfterRenderingQuantityConfirmationDialog(oParams, quantityType);
            }
        },

        onAfterRenderingQuantityConfirmationDialog: function (oParams, quantityType) {
            var that = this;
            setTimeout(function() {
                that.fetchReportedQuantityConfirmationData(oParams, quantityType);
            }, 125);
        },

        /***
         * Fetch posting details as per the params passed
         */
        fetchReportedQuantityConfirmationData: function (oParams, quantityType) {
            var oView = this.oController.getView();
            var that = this;
            that.quantityType = quantityType;
            var sUrl = this.oController.getProductionDataSourceUri() + "quantityConfirmation/details";            
			this.oController.byId("QuantityDetailsTable").setBusy(true);
			AjaxUtil.get(sUrl, oParams, function (oResponseData) {
                oResponseData.quantityType = that.quantityType === that.oController.getI18nText("process.yield.col") ? "Yield" : "Scrap"; //Setting this value as on the basis of this, column visibility is set in QuantityConfirmationPostings fragment.
                //DIGMANEXE-52565 #Do not show scrap rows for Yield postings and vice versa
                oResponseData.details = oResponseData.details.filter(function(reportedQty) {
                    if(oResponseData.quantityType === "Yield" && reportedQty.yieldQuantity !== null) {
                        return reportedQty;
                    } else if(oResponseData.quantityType === "Scrap" && reportedQty.scrapQuantity !== null) {
                        return reportedQty;
                    }
                });
				that.reportedQuantityConfirmationList = oResponseData;
                var viewQuantityReportModel = new JSONModel(that.reportedQuantityConfirmationList);
                var postingTable = that.oController.byId("QuantityDetailsTable")
                var postingTableCLItem= that.oController.byId("QuantityDetailsCLItem")
                postingTable.setModel(viewQuantityReportModel, "viewQuantityReportModel");
                that.postingsTableColumnLength = postingTable.getColumns().length;
                that.postingColumnListItemLength = postingTableCLItem.getCells().length;
                var oColumnListItem = that.oController.utils.buildCustomFieldColumns(that.reportedQuantityConfirmationList.details, postingTable, postingTableCLItem, that.oController.oPluginConfiguration,"viewQuantityReportModel");
                postingTable.bindItems("viewQuantityReportModel>/details", oColumnListItem, null, null);
                postingTable.setBusy(false);
			}, function (oError, oHttpErrorMessage) {
				var err = oError ? oError : oHttpErrorMessage;
				that.oController.showErrorMessage(err, true, true);
				that.reportedQuantityConfirmationList =  {};
				that.oController.byId("QuantityDetailsTable").setBusy(false);
			})
        },
        
        /***
         * Close the dialog on click of close button
         */
        onCloseQuantityPostingsDialog: function () {
            var oTable = this.oController ? this.oController.byId("QuantityDetailsTable") : this.byId("QuantityDetailsTable");
            var oColumnListItem = this.oController ? this.oController.byId("QuantityDetailsCLItem") : this.byId("QuantityDetailsCLItem");
            var postingsTableColumnLength = this.oController ? this.oController.QuantityConfirmationPostingDialog.postingsTableColumnLength : this.QuantityConfirmationPostingDialog.postingsTableColumnLength;
            var postingColumnListItemLength = this.oController ? this.oController.QuantityConfirmationPostingDialog.postingColumnListItemLength : this.QuantityConfirmationPostingDialog.postingColumnListItemLength;
            var oTableLength = oTable.getColumns().length;
            var oColumnListItemLength = oColumnListItem.getCells().length;
            for(var i=oTableLength; i > postingsTableColumnLength; i--){
                oTable.removeColumn(oTable.getColumns()[i-1]);
            }
            for(var j=oColumnListItemLength; j > postingColumnListItemLength; j--){
                oColumnListItem.removeCell(oColumnListItem.getCells()[j-1]);
            }
            var oDialog = this.oController ?  this.oController.byId("QuantityPostingsDialog") :  this.byId("QuantityPostingsDialog");
            oDialog.close()
        },

    }
});