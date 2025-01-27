sap.ui.define([
    "stellium/ext/podplugins/packingPlugin/controller/UnitBaseObject.controller",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/controller/ListFilter",
    "sap/dm/dme/podfoundation/model/PodType",
    "sap/dm/dme/types/QuantityType",
    "sap/dm/dme/formatter/NumberFormatter",
    "sap/dm/dme/browse/ShopOrderBrowse",
    "stellium/ext/podplugins/packingPlugin/controller/browse/PuMaterialBrowse",
    "sap/m/MessageBox"
], function (UnitBaseObjectController, JSONModel, ListFilter, PodType, QuantityType, NumberFormatter, ShopOrderBrowse,
    PuMaterialBrowse, MessageBox) {
    "use strict";

    const aSfcI18nMapping = {
        ALL: "enum.status.ALL",
        IN_QUEUE: "enum.status.IN_QUEUE",
        DONE: "enum.status.DONE",
        NEW: "enum.status.NEW",
        ACTIVE: "enum.status.ACTIVE",
        DONE_HOLD: "enum.status.DONE_HOLD",
        HOLD: "enum.status.HOLD",
        RETURNED: "enum.status.RETURNED"
    };

    return UnitBaseObjectController.extend("stellium.ext.podplugins.packingPluginToshif.controller.AvailableSfcsList", {
        types: {
            quantity: new QuantityType()
        },

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "partialQtyData");
            this.oEventBus.subscribe("resetUnitDetails", this.onClearAndRefresh, this);
            this.subscribe("orderSelectionEvent", this.onOrderSelectionEvent, this);
        },

        onClearAndRefresh: function (sChannelId, sEventId, oData) {
            this.refreshAvailableList(this.getAvailableSfcsList(), this.oAvailableSfcsListFilter, oData.bFinish);
        },

        onBeforeRendering: function () {
            const oAvailableSfcsListFilterBar = this.byId("availableSfcsPageFilterBar");
            this.oAvailableSfcsListFilter = new ListFilter({
                aLiveSearchProperties: [ "sfc" ],
                sLiveSearchFieldId: this.getAvailableSfcsSearchField().getId(),
                oListBinding: this.getAvailableSfcsList().getBinding("items"),
                sListBindingPath: "/GetSfcList()",
                oFilterBar: oAvailableSfcsListFilterBar,
                aVariantFilterInfo: [
                    { sFilterItemName: "availableSfcsShopOrderFilterItem", sSearchProperty: "shopOrder", oFilterOperator: sap.ui.model.FilterOperator.Contains },
                    { sFilterItemName: "availableSfcsMaterialFilterItem", sSearchProperty: "material", oFilterOperator: sap.ui.model.FilterOperator.Contains }
                ]
            });

            this.configureListFilterBarSearchLayout(oAvailableSfcsListFilterBar);
            this.setAllowedSfcStatuses();
            this.oAvailableSfcsListFilter.clearFilters();
            setTimeout(function(){
                this.runInitialFilters();
            }.bind(this), 1000);
        },

        onExit: function () {
            UnitBaseObjectController.prototype.onExit.apply(this, arguments);
            this.unsubscribe("orderSelectionEvent", this.onOrderSelectionEvent, this);
            this.oEventBus.unsubscribe("resetUnitDetails", this.onClearAndRefresh, this);
        },

        runInitialFilters: function () {
            const bRun = this.filterSfcsListWithSelectedOrder();
            if (!bRun) {
                this.getAvailableSfcsList().getBinding("items").filter(this.getExternalFilters());
            }
        },

        onAvailableSfcsLiveSearch: function (oEvent) {
            this._filterAvailableObjects(this.getExternalFilters());
        },

        _availableObjectsTableFiltersCleanup: function () {
            var oOrderFilterInput = this.getView().byId('availableSfcsShopOrderFilter');
            //Clear filters
            this.oAvailableSfcsListFilter.clearFilters();
            
            //Set the shopOrder value to the fitlerbar
            var oSelection = this.getPodSelectionModel().getSelection(),
                oShopOrderSelection = oSelection.getShopOrder();
            oOrderFilterInput.setValue(oShopOrderSelection.shopOrder);

            this._filterAvailableObjects(this.getExternalFilters());
        },

        filterSfcsListWithSelectedOrder: function () {
            let bIsOrderPod = this.getPodSelectionModel().getPodType() === PodType.Order;
            let oPodSelection = this.getPodSelectionModel().getSelection();
            let oOrderData = bIsOrderPod && oPodSelection ? oPodSelection.getShopOrder() : null;
            let sSelectedTab = this.getViewModel().getProperty("/availableObjectsSelectedTab");
            let bFilterCalled = false;
            if (oOrderData && (sSelectedTab === "availableSfcsTab")) {
                this.getViewModel().setProperty("/availableSfcsShopOrder", oOrderData.shopOrder);
                this._filterAvailableObjects(this.getExternalFilters());
                bFilterCalled = true;
            } 
            return bFilterCalled;
        },

        /**
         * Returns Unit of Measure from three different possible fields
         * @param {Object} oData object from GetSfcList response
         * @returns {String} Unit of Measure
         */
        getUomFromPackingData: function (oData) {
            return oData.getProperty("materialUnitOfMeasure") ||
                oData.getProperty("shopOrderUnitOfMeasure") ||
                oData.getProperty("shopOrderERPUnitOfMeasure");
        },

        partialQtyFormatter: function (sDefaultQty, sRef, sMaterialUom, sOrderUom, sErpOrderUom) {
            let sUom = sMaterialUom || sOrderUom || sErpOrderUom;
            let sFormattedDefaultQty = NumberFormatter.dmcLocaleQuantityFormatterDisplay(sDefaultQty, sUom, {
                minFractionDigits: 0, maxFractionDigits: 3 });
            let dExisting = this.getPartialQtyDataModel().getProperty("/" + sRef);
            let sFormattedExistingQty = NumberFormatter.dmcLocaleQuantityFormatterDisplay(dExisting, sUom, {
                minFractionDigits: 0, maxFractionDigits: 3 });

            if (!sFormattedDefaultQty && this.packingPluginFormatter.isNonDividableUoM(sUom)) {
                sFormattedDefaultQty = NumberFormatter.dmcLocaleFloatNumberFormatter(sDefaultQty, {
                    minFractionDigits: 0, maxFractionDigits: 3 });
            }

            return sFormattedExistingQty || sFormattedDefaultQty;
        },

        /**
         * Validates whether user input for partial qty is
         * - inside limits
         * - has correct decimal separators
         * - is a number
         * @param {string} sDefaultQty available quantity in SFC
         * @param {string} sRef Ref ID for the SFC
         * @returns {sap.ui.core.ValueState} SAPUI5 Control Value State
         */
        partialQtyValidator: function (sDefaultQty, sRef) {
            let dDefaultQty = NumberFormatter.dmcLocaleNumberParser(sDefaultQty);
            let dExisting = this.getPartialQtyDataModel().getProperty("/" + sRef);
            if (dExisting === undefined) {
                return sap.ui.core.ValueState.None;
            } else {
                return this.isPartialQtyInRange(dExisting, dDefaultQty) ? sap.ui.core.ValueState.None : sap.ui.core.ValueState.Error;
            }
        },

        getPartialQtyDataModel: function () {
            return this.getView().getModel("partialQtyData");
        },

        convertSelectedSfcs: function (aSelectedItems) {
            return aSelectedItems.map(function (oSelectedItem) {
                let sQuantity = this.partialQtyFormatter(
                    oSelectedItem.getProperty("availableQuantity"),
                    oSelectedItem.getProperty("ref"),
                    oSelectedItem.getProperty("materialUnitOfMeasure"),
                    oSelectedItem.getProperty("shopOrderUnitOfMeasure"),
                    oSelectedItem.getProperty("shopOrderERPUnitOfMeasure")
                );
                let dQuantity = NumberFormatter.dmcLocaleNumberParser(sQuantity);
                return {
                    quantity: dQuantity,
                    sfc: {
                        ref: oSelectedItem.getProperty("ref"),
                        sfc: oSelectedItem.getProperty("sfc"),
                        shopOrder: { shopOrder: oSelectedItem.getProperty("shopOrder") },
                        material: {
                            material: oSelectedItem.getProperty("material"),
                            description: oSelectedItem.getProperty("materialDescription")
                        },
                        status: oSelectedItem.getProperty("status")
                    }
                };
            }.bind(this));
        },

        onAvailableObjectsListUpdate: function (oEvent) {
            let iListLength = oEvent.getParameter("actual");
            this.getViewModel().setProperty("/availableSfcsListLength", iListLength);
        },

        setAllowedSfcStatuses: function () {
            const aAllowedSetting = this.getConfigOrDefaultSfcStatuses();
            const aSfcStatuses = aAllowedSetting.filter((oStatus) => oStatus.value);
            this.getViewModel().setProperty("/allowedSfcStatuses", [{ key: "ALL", value: true }, ...aSfcStatuses]);
        },

        getAllowedSfcStatuses: function () {
            const aAllowedSetting = this.getConfigOrDefaultSfcStatuses();
            return aAllowedSetting.filter((oStatus) => oStatus.value).map(oStatus => oStatus.key);
        },

        /**
         * Converts allowed SFC status into translatable label for UI
         * @param { { key: string, value: boolean } } oSfcStatus Sfc Status setting
         * @returns {string} translated SFC status
         */
        sfcStatusTranslation: function (oSfcStatus) {
            const oI18nModel = this.getView().getModel("i18n-status");
            const sI18nKey = aSfcI18nMapping[oSfcStatus.key];
            const sTranslated = oI18nModel.getProperty(sI18nKey);
            return sTranslated;
        },

        /*
         * Move an object from the available table to the assigned table.
         */
        onMoveToAssigned: function () {
            let oAvailableSfcsList = this.getAvailableSfcsList();
            this.aMovedContent = oAvailableSfcsList.getSelectedContexts();

            var aAllowedStatuses = this.getAllowedSfcStatuses();

            //Only SFCs with status 'DONE' will be considered for packing
            var bIsValidSFCforPacking = this.aMovedContent.every(function(oContext){
                var oSFCData = oContext.getObject();
                // return aAllowedStatuses.find(status=> oSFCData.status === status);
                return oSFCData.status === 'DONE'
            });

            if(!bIsValidSFCforPacking){
                // MessageBox.error("Packing only allowed for SFCs with status: "+ aAllowedStatuses.join(', '));
                MessageBox.error("Packing only allowed for SFCs with status: DONE");
                return;
            }

            if (this.aMovedContent.length > 0) {
                this.aMovedContent = this.convertSelectedSfcs(this.aMovedContent);
                this.getView().getModel("partialQtyData").setData({});
                this.addSfcsToUnit();
            }
        },

        addSfcsToUnit: function () {
            this.oUserAction.setAdd();
            this.savePackingUnit();
        },

        onAvailableSfcsFilterValueChange: function () {
            this._filterAvailableObjects(this.getExternalFilters());
        },

        getExternalFilters: function () {
            const sSelectedStatusKey = this._getAvailableSfcsStatusFilter().getSelectedKey();
            const aAllowedStatuses = this.getAllowedSfcStatuses();
            return this.createStatusFilters(sSelectedStatusKey, aAllowedStatuses);
        },

        onFilterAvailableSfcsByMaterial: function () {
            let oProductModel = this.getView().getModel("product");
            let sFilterQuery = "status eq com.sap.mes.odata.Status'RELEASABLE'";
            PuMaterialBrowse.open(this.getView(), null, function (oSelectedMaterial) {
                this.getViewModel().setProperty("/availableSfcsMaterial", oSelectedMaterial.name);
                this._filterAvailableObjects(this.getExternalFilters());
            }.bind(this), oProductModel, sFilterQuery);
        },

        onFilterAvailableSfcsByOrder: function () {
            let oDemandModel = this.getView().getModel("demand");
            let oProductModel = this.getView().getModel("product");
            ShopOrderBrowse.open(this.getView(), null, function (oSelectedOrder) {
                this.getViewModel().setProperty("/availableSfcsShopOrder", oSelectedOrder.name);
                this._filterAvailableObjects(this.getExternalFilters());
            }.bind(this), oDemandModel, oProductModel);
        },

        /**
         * Processes input from Input control.
         * Sets the state of the control to Success or Error depending on the input partial quantity.
         * Calls onSfcItemSelected in order to recalculate availability of Add button
         * @param {Object} oEvent SAPUI5 event.
         */
        partialQuantityChange: function (oEvent) {
            let oControl = oEvent.getSource();
            let oRow = oControl.getBindingContext("packing");
            let sUom = this.getUomFromPackingData(oRow);
            let oPartialModel = this.getPartialQtyDataModel();
            let dNewValue = NumberFormatter.dmcLocaleNumberParser(oEvent.getParameter("value"));
            let sRef = oRow.getProperty("ref");

            let dQuantity = parseFloat(oRow.getProperty("availableQuantity"));
            let bIsValid = this.isPartialQtyValid(dNewValue, dQuantity, oRow.getProperty("quantityRestriction"), sUom);
            let sNewState = bIsValid ? sap.ui.core.ValueState.None : sap.ui.core.ValueState.Error;

            oControl.setValueState(sNewState);
            oPartialModel.setProperty("/" + sRef, dNewValue);
            this.getAvailableSfcsList().setSelectedItem(oControl.getParent());
            this.onSfcItemSelected();
        },

        isPartialQtyValid: function (dPartialValue, dQty, sQtyRestriction, sUom) {
            return this.isPartialQtyInRange(dPartialValue, dQty) && this.validateRestriction(dPartialValue, sQtyRestriction, sUom);
        },

        /**
         * Validates all restrictions for values such as:
         * - not dividable UoM
         * - wrong decimal separator based on Locale
         * @param {Number} nValue Qty value (integer or float)
         * @param {string} sQtyRestriction Material Qty Restrictions
         * @param {string} sUom Unit of Measure
         * @returns {boolean} true if validate false otherwise.
         */
        validateRestriction: function (nValue, sQtyRestriction, sUom) {
            let bNonDividableUom = this.packingPluginFormatter.isNonDividableUoM(sUom);
            // check for integer via % 1 != 0
            let bCannotBeDivided = nValue % 1 !== 0 && bNonDividableUom;
            // return immediately as Material Qty Restrictions should not be even validated
            if (bCannotBeDivided) {
                return false;
            }
            switch (sQtyRestriction) {
            case "ONLY_1_0":
                return Number.isInteger(nValue) && nValue === 1;
            case "WHOLE_NUMBER":
                return Number.isInteger(nValue);
            case "ANY_NUMBER":
                // 0.001 is a global lower limit in DME.
                return nValue >= 0.001;
            default: return true;
            }
        },

        /**
         * Checks whether partial quantity is in allowed range between 0..MaxQty
         * @param {Number} dPartial partial quantity provided by user
         * @param {number} dAvailable max available quantity
         * @returns {boolean} true if in range, false otherwise
         */
        isPartialQtyInRange: function (dPartial, dAvailable) {
            return (dPartial <= dAvailable) && (dPartial > 0);
        },

        onSfcItemSelected: function () {
            let oAvailableSfcTable = this.getAvailableSfcsList();
            let oPartialModel = this.getPartialQtyDataModel();
            let aSelectedItems = oAvailableSfcTable.getSelectedContexts();
            let bSfcsSelected = aSelectedItems.length > 0;

            let bAllValid = !aSelectedItems.some(function (oItem) {
                let sRef = oItem.getProperty("ref");
                let sQtyRestriction = oItem.getProperty("quantityRestriction");
                let dQuantity = parseFloat(oItem.getProperty("availableQuantity"));
                let dCurrentPartialValue = oPartialModel.getProperty("/" + sRef) || dQuantity;
                let sUom = this.getUomFromPackingData(oItem);
                let bIsValid = this.isPartialQtyValid(dCurrentPartialValue, dQuantity, sQtyRestriction, sUom);
                return !(dCurrentPartialValue > 0 && bIsValid);
            }.bind(this));
            this.getViewModel().setProperty("/availableSfcsSelectedAndValid", bAllValid && bSfcsSelected);
        },

        _getAvailableSfcsShopOrderFilter: function () {
            return this.getView().byId("availableSfcsShopOrderFilter");
        },

        _getAvailableSfcsMaterialFilter: function () {
            return this.getView().byId("availableSfcsMaterialFilter");
        },

        _getAvailableSfcsStatusFilter: function () {
            return this.getView().byId("availableSfcsStatusFilter");
        },

        getAvailableSfcsSearchField: function () {
            return this.getView().byId("availableObjectsSearch");
        },

        getAvailableSfcsList: function () {
            return this.getView().byId("availableObjects");
        },

        onOrderSelectionEvent: function (sChannelId, sEventId, oData) {
            const sOrder = oData.order;
            this.getViewModel().setProperty("/availableSfcsShopOrder", sOrder);
            this.filterSfcsListWithSelectedOrder();
        }
    });
});
