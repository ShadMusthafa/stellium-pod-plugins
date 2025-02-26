sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler"
], function (Filter,FilterOperator, AjaxUtil, ErrorHandler) {
    return {

		handleSearch: function(oValue, propertiesArray, oBinding, itemText, iTotal){
			var aFilters = [], filter, oFilterWithAllProperties;
			if (oValue && oValue.length > 0) {
				$.each(propertiesArray, function(oIndex, oObj){
					filter = new Filter(oObj, FilterOperator.Contains, oValue);
					aFilters.push(filter);
				});

				oFilterWithAllProperties = new Filter({ filters: aFilters, and: false });
			}
			oBinding.filter(oFilterWithAllProperties);
            var oTable = sap.ui.getCore().byId("batchListTable");
            if(oTable) {
                var iLength = iTotal || oTable.getItems().length;
                if (iLength === 0) {
                    sap.ui.getCore().byId("batchTableTitle").setText(itemText);
                } else {
                    sap.ui.getCore().byId("batchTableTitle").setText(itemText + " (" + iLength + ")");
                }
            }
		},

        buildCustomFieldData: function(customFieldValue){

            var customFieldJson = [];
            if(customFieldValue){
                var customFieldData = {};
                customFieldData.id = "customField1";
                customFieldData.value = customFieldValue;
                customFieldJson.push(customFieldData);
            }
            return customFieldJson;
        },

        buildCustomFieldColumns : function(oPostingData, oTable, oColumnListItem, oPluginConfiguration, oModel){

            var customFieldColumns = [];
            for(var i=0; i < oPostingData.length; i++){
                if(oPostingData[i].customFieldData){
                    var customFieldJson = JSON.parse(oPostingData[i].customFieldData);
                    for(var j=0; j < customFieldJson.length; j++){
                        var position = customFieldJson[j].id.slice(-1);
                        oPostingData[i]["customFieldValue" + position] = customFieldJson[j].value;
                        if(!Object.values(customFieldColumns).includes(customFieldJson[j].id)){
                            customFieldColumns.push(customFieldJson[j].id);
                        }
                    }
                }
            }
            customFieldColumns.sort();
            for(var k = 0; k < customFieldColumns.length ; k++){
                if(oPluginConfiguration && oPluginConfiguration[customFieldColumns[k]]){
                    var customFieldValue = "customFieldValue" + customFieldColumns[k].slice(-1);
                    var oColumnListCustomField = new sap.m.Text({
                        text: "{"+oModel+">" + customFieldValue + "}"
                    });
                    oColumnListItem.addCell(oColumnListCustomField);
                    var oColumnCustomField = new sap.m.Column({
                        hAlign: "Center",
                        vAlign: "Middle"
                    });
                    var oHeaderCustomField = new sap.m.Text({
                        text: oPluginConfiguration[customFieldColumns[k]]
                    });
                    oColumnCustomField.setHeader(oHeaderCustomField);
                    oTable.addColumn(oColumnCustomField);
                }
            }
            return oColumnListItem;
        },

        validateInputRegEx: function(sInputValue) {
            //Regex for Valid Characters
            var regex = /^[A-Za-z0-9_@\-. ]+$/;
            var isValidInput = true;
            if (sInputValue) {
                if (!sInputValue.match(regex)) {
                    isValidInput = false;
                }
            }
            return isValidInput;
        },
        getAlternateUomsForMaterial: function (productUri, material, materialRef, alternateUomForSelectedMaterial, fnCallBack) {
            var that = this;
            var url = productUri + "Materials('" + materialRef + "')?$select=alternateUnitsOfMeasure&$expand=alternateUnitsOfMeasure($select=ref,uom,numerator,denominator)";
            var oParameters = {};
            AjaxUtil.get(url, oParameters,fnCallBack,
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    that.oController.showErrorMessage(err, true, true);
                });
        }

    };
});
