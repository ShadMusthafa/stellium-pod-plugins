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

        showDetailsOfComponent: function (oParameters, batchManaged) {
            var oView = this.oController.getView();
            if (!this.oController.byId("materialComponentsPostingsDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.MaterialComponentsPosting",
                    controller: this.oController
                }).then(function (oDialog) {
                    oDialog.setEscapeHandler(function(oPromise) {
                        this.onCloseMaterialComponentsPostingsDialog();
                        oPromise.resolve();
                    }.bind(this));
                    oView.addDependent(oDialog);
                    oDialog.open();
                    this.onAfterRenderingGiPostingDialog(oParameters, batchManaged);
                }.bind(this));
            } else {
                this.oController.byId("materialComponentsPostingsDialog").open();
                this.onAfterRenderingGiPostingDialog(oParameters, batchManaged);
            }

        },

        onAfterRenderingGiPostingDialog: function (oParameters, batchManaged) {
            var that = this;
            setTimeout(function() {
                that.fetchGiPostingDetails(oParameters, batchManaged);
            }, 125);
        },


        /***
         * Close the dialog on click of close button
         */
        onCloseMaterialComponentsPostingsDialog: function () {
            var oTable = this.oController ? this.oController.byId("materialComponentsPostingsTable") : this.byId("materialComponentsPostingsTable");
            var oColumnListItem = this.oController ? this.oController.byId("materialComponentsPostingDetailsCLItem") : this.byId("materialComponentsPostingDetailsCLItem");
            var postingsTableColumnLength = this.oController ? this.oController.MaterialComponentsPostingDialog.postingsTableColumnLength : this.MaterialComponentsPostingDialog.postingsTableColumnLength;
            var postingColumnListItemLength = this.oController ? this.oController.MaterialComponentsPostingDialog.postingColumnListItemLength : this.MaterialComponentsPostingDialog.postingColumnListItemLength;
            var oTableLength = oTable.getColumns().length;
            var oColumnListItemLength = oColumnListItem.getCells().length;
            for(var i=oTableLength; i > postingsTableColumnLength; i--){
                oTable.removeColumn(oTable.getColumns()[i-1]);
            }
            for(var j=oColumnListItemLength; j > postingColumnListItemLength; j--){
                oColumnListItem.removeCell(oColumnListItem.getCells()[j-1]);
            }
            var oDialog = this.oController ?  this.oController.byId("materialComponentsPostingsDialog") :  this.byId("materialComponentsPostingsDialog");
            oDialog.close()
        },

        fetchGiPostingDetails: function (oParameters, batchManaged) {

            this.oController.byId("materialComponentsPostingsTable").setBusy(true);
            var assemblyUrl = this.oController.getAssemblyDataSourceUri();
            var sUrl = assemblyUrl + "order/goodsIssue/details";
            this.getGiPostings(sUrl, oParameters, batchManaged);
        },

        getGiPostings: function (sUrl, oParameters, batchManaged) {
            var that = this;
            this.oController.iCurrentPage = oParameters.page;
            AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
                that.postingsList = {details: oResponseData.content};
                that.postingsList.batchManaged = batchManaged;
                that.oPostingsModel = new JSONModel();
                that.oPostingsModel.setSizeLimit(that.postingsList.details.length);
                that.oPostingsModel.setData(that.postingsList);
                var postingTable = that.oController.byId("materialComponentsPostingsTable");
                var postingTableCLItem= that.oController.byId("materialComponentsPostingDetailsCLItem")
                postingTable.setModel(that.oPostingsModel, "matCompPostingsModel");
                that.postingsTableColumnLength = postingTable.getColumns().length;
                that.postingColumnListItemLength = postingTableCLItem.getCells().length;
                var oColumnListItem = that.oController.utils.buildCustomFieldColumns(that.postingsList.details, postingTable, postingTableCLItem, that.oController.oPluginConfiguration,"matCompPostingsModel");
                that.oPostingsModel.updateBindings();
                that.oPostingsModel.refresh();
                postingTable.rerender();
                postingTable.setBusy(false);
            }, function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.byId("materialComponentsPostingsTable").setBusy(false);
                that.postingsList = {};
            });
        },

        fetchMoreGiPostingDetails: function (oEvent) {
            var that = this;
            if (oEvent.getParameter("reason").toLowerCase() === "growing" && !that.byId("materialComponentsPostingsTable").getBusy()) {
                var sUrl = that.getAssemblyDataSourceUri() + "order/goodsIssue/details";
                this.iCurrentPage++;
                var oParameters = that.MaterialComponentsPostingDialog.getParameters(that.MaterialComponents, that.MaterialComponentsPostingDialog.rowData);
                that.byId("materialComponentsPostingsTable").setBusy(true);
                AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
                    var oPostingsTable = that.byId("materialComponentsPostingsTable");
                    oResponseData.content.forEach(e => that.MaterialComponentsPostingDialog.postingsList.details.push(e));
                    var oPostingsModel = oPostingsTable.getOwnModels()["matCompPostingsModel"];
                    oPostingsModel.setSizeLimit(that.MaterialComponentsPostingDialog.postingsList.details.length);
                    oPostingsModel.setData(that.MaterialComponentsPostingDialog.postingsList);
                    that.utils.buildCustomFieldColumns(that.MaterialComponentsPostingDialog.postingsList, oPostingsModel);
                    oPostingsModel.updateBindings();
                    oPostingsModel.refresh();
                    oPostingsTable.rerender();
                    oPostingsTable.setBusy(false);
                }, function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    that.showErrorMessage(err, true, true);
                    that.byId("materialComponentsPostingsTable").setBusy(false);
                });
            }
        },
        getParameters: function (oMaterialComponents, rowData) {
            var oData = oMaterialComponents.orderData;
            var oParameters = {};
            var order = oData.order;
            var batchId = oData.sfc;
            var operationActivity = (oData.orderSelectionType === "PROCESS") ? oMaterialComponents.oSectionData.phaseId : oData.operation.operation;
            var bomComponentRef = rowData.bomComponentRef;
            var material = rowData.materialId.material;
            var batchManaged = rowData.batchManaged;
            var isBomComponent = rowData.isBomComponent;
            oParameters.shopOrder = order;
            oParameters.batchId = batchId;
            oParameters.operationActivity = operationActivity;
            oParameters.bomComponentRef = bomComponentRef;
            oParameters.material = material;
            oParameters.isNonBOMComponent = !isBomComponent;
            oParameters.page = this.oController.iCurrentPage;
            oParameters.size = 40;
            oParameters.sort = "createdDateTime,desc";
            return oParameters;
        },

        formatMaterialConsumptionStatus: function (statusKey) {
            if (!statusKey) {
                return '';
            } else {
                return this.getI18nText(statusKey);
            }
        },

    }
});

