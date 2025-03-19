sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "sap/ui/core/Fragment"
], function(JSONModel, AjaxUtil, Fragment) {
    "use strict";
    const REASON_CODE_MAX_DEPTH = 10;

    return {

        setController: function(sController) {
            this.oController = sController;
        },

        showAssignedReasonCodes: function(timeElementTypeRef, resource, dialogId, fnPostSelectioncallback) {
            let that = this;
            this.dialogId = dialogId;
            this.reasonCodeData = { "timeElementReasonCodeTree": []};
            this.fnPostSelectioncallback = fnPostSelectioncallback;
            this.timeElementTypeRef = timeElementTypeRef;
            this.resource = resource;
            if(this.oController.selectReasonCodeDialog === undefined){
                this.oController.selectReasonCodeDialog = sap.ui.xmlfragment(this.dialogId, "sap.dm.dme.oeetransactionplugins.utility.fragments.SelectReasonCodeDialog", this);
                this.oController.selectReasonCodeDialog.setEscapeHandler(function (oPromise) {
                    that.onClickCancel();
                    oPromise.resolve();
                }.bind(that));
                this.oController.getView().addDependent(this.oController.selectReasonCodeDialog);
            }

            this.oController.selectReasonCodeDialog.open();
            this.prepareReasonCodeTable();
        },

        prepareReasonCodeTable: function () {
            this.listOfTimeElementAndDesc = this.oController.listOfTimeElementAndDescMap.get(this.timeElementTypeRef);
            if (this.listOfTimeElementAndDesc) {
                this.getReasonCodesForTimeElement();
            }else{
                let oReasonCodeModel = new sap.ui.model.json.JSONModel(this.reasonCodeData);
                let reasonCodeTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
                reasonCodeTable.setModel(oReasonCodeModel, "oReasonCodeModel");
                this.oController.selectReasonCodeDialog.setBusy(false);
            }
        },

        prepareDataAfterAssignedCodesFetch: function () {
            let oReasonCodeModel, reasonCodeTable;
            this.prepareDataForBinding(this.listOfTimeElementAndDesc);
            if (oReasonCodeModel === undefined) {
                oReasonCodeModel = new sap.ui.model.json.JSONModel(this.reasonCodeData);
                reasonCodeTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
                reasonCodeTable.setModel(oReasonCodeModel, "oReasonCodeModel");
                let assignedReasonCodeRefs = [];
                if (this.reasonTree.length > 0) {
                    let arr = [];
                    for (let index = 0; index < this.reasonTree.length; index++) {
                        this.path = [];
                        this.assignedCodeSelectionLoop(this.reasonTree[index].resourceReasonCodeNodeCollection)
                        let aData = this.path;
                        let rcData = [];
                        let tempMap = new Map();
                        for (let j = 0; j < aData.length; j++) {
                            this.child = [];
                            let elem = aData[j];
                            assignedReasonCodeRefs.push(elem.ref);
                            let reasonCodeAndTimeElem = elem.timeElement.ref + elem.reasonCode1;
                            if(!this.oController.reasonCodeMap.get(reasonCodeAndTimeElem)){
                                let code = this.appendReasonCode(elem);
                                this.getReasonCodesForChild(encodeURIComponent(elem.timeElement.ref), code);
                                this.oController.reasonCodeMap.set(reasonCodeAndTimeElem, this.child[0]);
                                rcData.push(this.child[0]);
                                tempMap.set(reasonCodeAndTimeElem, this.child[0]);
                            } else if(!tempMap.get(reasonCodeAndTimeElem)){
                                rcData.push(this.oController.reasonCodeMap.get(reasonCodeAndTimeElem));
                                tempMap.set(reasonCodeAndTimeElem, this.oController.reasonCodeMap.get(reasonCodeAndTimeElem));
                            }
                        }
                        rcData.typeOfData = "reasonCodeObject";
                        let reasonCodeNestedObject = this.transformData(rcData);
                        arr = arr.concat(reasonCodeNestedObject)

                    }
                    reasonCodeTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
                    oReasonCodeModel.setData({
                        timeElementReasonCodeTree: this.buildReasonCode(arr, assignedReasonCodeRefs)
                    });
                    reasonCodeTable.getModel("oReasonCodeModel").checkUpdate();
                } else {
                    for (let index = 0; index < this.reasonCodeData.timeElementReasonCodeTree.length; index++) {
                        let element = this.reasonCodeData.timeElementReasonCodeTree[index];
                        let timeElemData = this.oController.reasonCodeMap.get(element.timeElementHandle);
                        if(!timeElemData){
                            timeElemData = this.getReasonCodesForTimeElementForNotSource(element);
                            this.oController.reasonCodeMap.set(element.timeElementHandle, timeElemData);
                        }
                        timeElemData.typeOfData = "reasonCodeObject";
                        let reasonCodeNestedObject = this.transformData(timeElemData);
                        element.timeElementReasonCodeTree = reasonCodeNestedObject;
                        reasonCodeTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
                        reasonCodeTable.getModel("oReasonCodeModel").checkUpdate();
                    }
                }

                this.oController.selectReasonCodeDialog.setBusy(false);
                this.allList = reasonCodeTable.getModel("oReasonCodeModel").getData();
                reasonCodeTable.getModel("oReasonCodeModel").checkUpdate();

            }
        },

        getReasonCodesForTimeElementForNotSource: function (inputObject) {
            let that = this;
            let oUrl = that.oController.getPlantRestDataSourceUri() + "resourceReasonCodes?timeElement.ref=" + encodeURIComponent(inputObject.timeElementHandle);
            $.ajaxSettings.async = false;
            this.oController.selectReasonCodeDialog.setBusy(true);
            AjaxUtil.get(oUrl, null, function (oData) {
                that.oResponseData = oData
                that.oController.selectReasonCodeDialog.setBusy(false);
            }, function (oError, sHttpErrorMessage) {
                let err = oError ? oError : sHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.selectReasonCodeDialog.setBusy(false);
            });
            $.ajaxSettings.async = true;
            return that.oResponseData;

        },

        getReasonCodesForTimeElement: function () {
            let that = this;
            let oUrl = that.oController.getPlantRestDataSourceUri() + "reasonCodeAssignment/assignedReasonCodes?resource.resource="+encodeURIComponent(this.resource)+ "&timeElementTypeId.ref=" + encodeURIComponent(this.timeElementTypeRef);
            this.oController.selectReasonCodeDialog.setBusy(true);
            AjaxUtil.get(oUrl, null, function (oData) {
                that.reasonTree =  oData.resourceReasonCodeNodeCollection;
                that.prepareDataAfterAssignedCodesFetch();
            },function (oError, sHttpErrorMessage) {
                let err = oError ? oError : sHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.selectReasonCodeDialog.setBusy(false);
            });
        },

        prepareDataForBinding: function (data) {
            let transformedObject;
            if (data) {
                data.typeOfData = "timeElementObject";
                transformedObject = this.transformData(data);
                this.reasonCodeData.timeElementReasonCodeTree = transformedObject;
            }
        },

        assignedCodeSelectionLoop: function(obj) {
            for (let k in obj) {
                if (obj[k].description != null) {
                    this.path.push(obj[k]);
                } else {
                    this.assignedCodeSelectionLoop(obj[k].resourceReasonCodeNodeCollection);
                }
            }
        },

        appendReasonCode: function (elem) {
            this.rCodeString = "";
            for (let i = 0; i < 1; i++) {
                let rCode = elem["reasonCode" + (i + 1)];
                if (rCode) {
                    this.rCodeString += "&reasonCode" + (i + 1) + "=" + encodeURIComponent(rCode);
                }
            }
            return this.rCodeString ;
        },

        buildReasonCode: function(arr, assignedReasonCodeRefs){
            let newArr = [];
            for(let k = arr.length - 1 ; k >=0 ; k--) {
                if (arr[k].hasOwnProperty("reasonCodeHandle")) {
                    if (assignedReasonCodeRefs.includes(arr[k].reasonCodeHandle)) {
                        newArr.push(arr[k]);
                        continue;
                    } else {
                        if (arr[k].timeElementReasonCodeTree && arr[k].timeElementReasonCodeTree.length > 0) {
                            let resultArr = this.buildReasonCode(arr[k].timeElementReasonCodeTree, assignedReasonCodeRefs);
                            if(resultArr && resultArr.length > 0) {
                                arr[k].timeElementReasonCodeTree = resultArr;
                                newArr.push(arr[k])
                            }
                        } else {
                            arr.splice(k, 1);
                        }
                    }
                }else{
                    continue;
                }
            }
            return newArr;
        },

        transformData: function (dataObject) {
            let transformedDataObject, oIndex;
            let transformedArray = [];
            this.leafs = [];
            if (dataObject) {
                for (oIndex = 0; oIndex < dataObject.length; oIndex++) {
                    transformedDataObject = {};
                    if (dataObject[oIndex].ref) {
                        if (dataObject.typeOfData === "timeElementObject") {
                            transformedDataObject.description = dataObject[oIndex].description;
                            transformedDataObject.typeOfElement = "timeElement";
                            transformedDataObject.timeElementHandle = dataObject[oIndex].ref;
                            transformedDataObject.timeElementReasonCodeTree = [ {} ];
                        } else if (dataObject.typeOfData === "reasonCodeObject") {
                            transformedDataObject.ID = this.getReasonCodeID(dataObject[oIndex]);
                            transformedDataObject.level = dataObject[oIndex].level;
                            transformedDataObject.description = dataObject[oIndex].description;
                            transformedDataObject.typeOfElement = "reasonCode";
                            transformedDataObject.reasonForVariance =dataObject[oIndex].reasonForVariance;
                            transformedDataObject.timeElementHandle = dataObject[oIndex].timeElementRef;
                            transformedDataObject.reasonCodeHandle = dataObject[oIndex].ref;
                            this.getReasonCodeObject(dataObject[oIndex], transformedDataObject);
                        }
                    }
                    if (!jQuery.isEmptyObject(transformedDataObject)) {
                        transformedArray.push(transformedDataObject);
                    }
                }
                return transformedArray;
            }
        },
        getReasonCodeObject: function (object, transformedDataObject) {
            let nestedReasonCodeObject;
            if (object.resourceReasonCodeNodeCollection.length > 0) {
                nestedReasonCodeObject = this.getNestedReasonCodeObject(object.resourceReasonCodeNodeCollection);
                transformedDataObject.timeElementReasonCodeTree = nestedReasonCodeObject;
            }
            return transformedDataObject;
        },

        getReasonCodeID: function (reasonCodeObject) {
            let stringBuilder, oIndex;
            if (reasonCodeObject) {
                for (oIndex = 10; oIndex > 0; oIndex--) {
                    stringBuilder = "reasonCode" + oIndex;
                    if (reasonCodeObject[stringBuilder]) {
                        reasonCodeObject.level = oIndex;
                        return reasonCodeObject[stringBuilder];
                    }
                }
            }
        },
        getNestedReasonCodeObject: function (reasonCodeNestedObject) {
            let transformedNestedArray = [];
            if (reasonCodeNestedObject) {
                reasonCodeNestedObject.typeOfData = "reasonCodeObject";
                transformedNestedArray = this.transformData(reasonCodeNestedObject);
            }
            return transformedNestedArray;
        },

        getReasonCodesForChild: function (ref, code) {
            let that = this;
            let oUrl = this.oController.getPlantRestDataSourceUri()  + "resourceReasonCodes?timeElement.ref=" + ref + code;
            $.ajaxSettings.async = false;
            this.oController.selectReasonCodeDialog.setBusy(true);
            AjaxUtil.get(oUrl, null, function (oData) {
                that.child =  oData;
                that.oController.selectReasonCodeDialog.setBusy(false);
            }, function (oError, sHttpErrorMessage) {
                let err = oError ? oError : sHttpErrorMessage;
                that.oController.showErrorMessage(err, true, true);
                that.oController.selectReasonCodeDialog.setBusy(false);
            });
            $.ajaxSettings.async = true;
        },

        // Implementation of search functionality in the reason code dialog

        handleSearchForReasonCodeDialog: function (oEvent) {
            let properties = ["ID", "description", "reasonForVariance"];
            let oValue = oEvent.getSource().getValue();
            let resourceList = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable")).getBinding("rows");

            this.handleSearch(oValue, properties, resourceList);
        },

        handleSearch: function (oValue, propertiesArray, oBinding) {
            let listForSearch = structuredClone(this.allList);
            let reasonCodeTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));

            if (!oValue) {
                reasonCodeTable.getModel("oReasonCodeModel").setData(this.allList);
            }else {
                let list = this.matchTreeData(listForSearch.timeElementReasonCodeTree, oValue);
                reasonCodeTable.getModel("oReasonCodeModel").setData(
                    {
                        timeElementReasonCodeTree: list
                    }
                )
                reasonCodeTable.expandToLevel(10)
            }


        },
        matchTreeData: function(arr, searchCon) {
            let newArr = [];
            let searchNameList = ['description', 'ID', 'reasonForVariance'];
            arr.forEach((item) => {
                for (let i = 0, len = searchNameList.length; i < len; i++) {
                    let nameKey = searchNameList[i];
                    if (item.hasOwnProperty(nameKey)) {
                        if (item[nameKey] && item[nameKey].toLowerCase().indexOf(searchCon.toLowerCase()) !== -1) {
                            newArr.push(item);
                            break;
                        } else {
                            if (item.timeElementReasonCodeTree && item.timeElementReasonCodeTree.length > 0) {
                                let resultArr = this.matchTreeData(item.timeElementReasonCodeTree, searchCon);
                                if (resultArr && resultArr.length > 0) {
                                    item.timeElementReasonCodeTree = resultArr
                                    newArr.push(item)
                                    break;
                                }
                            }
                        }
                    } else {
                        continue;
                    }
                }
            })
            return newArr;
        },

        onSelectReasonCode: function () {
            let oTable, oPath, selectedObject, oSaveButton, oIndices;
            oTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
            oSaveButton = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "saveButton"));
            oIndices = oTable.getSelectedIndices();
            if (oIndices.length >= 1) {
                jQuery.each(oIndices, function (oIndex, oObj) {
                    oPath = oTable.getContextByIndex(oObj).sPath;
                    selectedObject = oTable.getModel("oReasonCodeModel").getProperty(oPath);
                    if (selectedObject.timeElementReasonCodeTree) {
                        oSaveButton.setEnabled(false);
                        return false;
                    }
                    oSaveButton.setEnabled(true);
                });
            } else if (oIndices.length === 0) {
                oSaveButton.setEnabled(false);
            }
        },

        onCellClick: function (oEvent) {
            let oTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
            oTable.setSelectedIndex(oEvent.getParameter("rowIndex"));
        },

        onClickSave: function (oEvent) {
            let selectedObjects, oMinLevelSelected, oIndex;
            let reasonCodesToBeAssigned = [];
            selectedObjects = this.getSelectedObjects();
            if (selectedObjects.length > 0) {
                selectedObjects.sort(function (a, b) {
                    return a.level - b.level;
                });
                oMinLevelSelected = selectedObjects[0].level;
                for (oIndex = selectedObjects.length - 1; oIndex >= 0; oIndex--) {
                    if (selectedObjects[oIndex].level === oMinLevelSelected) {
                        reasonCodesToBeAssigned.push(selectedObjects[oIndex]);
                        selectedObjects.splice(oIndex, 1);
                    }
                }

                reasonCodesToBeAssigned = this.updateReasonCodeObject(selectedObjects, reasonCodesToBeAssigned);
            }
            this.onClickCancel();
            this.prepareAssignReasonCodeRequest(reasonCodesToBeAssigned, false);
        },

        getSelectedObjects: function () {
            let oTable, oSelectedIndices, oIndex, oPath, selectedObject;
            let selectedObjects = [];
            oTable = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "reasonCodeTreeTable"));
            oSelectedIndices = oTable.getSelectedIndices();
            for (let i = 0; i < oSelectedIndices.length; i++) {
                oIndex = oSelectedIndices[i];
                if (oTable.isIndexSelected(oIndex)) {
                    oPath = oTable.getContextByIndex(oIndex).sPath;
                    selectedObject = oTable.getModel("oReasonCodeModel").getProperty(oPath);
                    selectedObjects.push(selectedObject);
                }
            }
            return selectedObjects;
        },

        updateReasonCodeObject: function (objectsforComparison, finalReasonCodeObject) {
            let oIndex;
            if (objectsforComparison.length > 0) {
                for (oIndex = 0; oIndex < finalReasonCodeObject.length; oIndex++) {
                    objectsforComparison = _removeChildReasonCodeIfExists(finalReasonCodeObject[oIndex], objectsforComparison);
                }
                finalReasonCodeObject = finalReasonCodeObject.concat(objectsforComparison);
            }
            return finalReasonCodeObject;

            function _removeChildReasonCodeIfExists (parentObject, objectsToBeParsed) {
                let counter;
                if (parentObject.timeElementReasonCodeTree) {
                    for (counter = parentObject.timeElementReasonCodeTree.length - 1; counter >= 0; counter--) {
                        objectsToBeParsed = _removeChildReasonCodeIfExists(parentObject.timeElementReasonCodeTree[counter], objectsToBeParsed);
                        objectsToBeParsed = _removeChildReasonCodes(objectsToBeParsed, parentObject, counter);
                    }
                }
                return objectsToBeParsed;
            }

            function _removeChildReasonCodes (objectsToBeParsed, parentObject, counter) {
                let oIndx;
                for (oIndx = objectsToBeParsed.length - 1; oIndx >= 0; oIndx--) {
                    if (parentObject.timeElementReasonCodeTree[counter].reasonCodeHandle === objectsToBeParsed[oIndx].reasonCodeHandle) {
                        objectsToBeParsed.splice(oIndx, 1);
                    }
                }
                return objectsToBeParsed;
            }
        },
        prepareAssignReasonCodeRequest: function (reasonCodeToBeAssigned) {
            let reasonCodeData = {};
            reasonCodeData.ref = reasonCodeToBeAssigned[0].reasonCodeHandle;
            reasonCodeData.description = reasonCodeToBeAssigned[0].description;
            reasonCodeData.id = reasonCodeToBeAssigned[0].ID;
            if (this.oController.ReasonCodeDialog.fnPostSelectioncallback) {
                this.oController.ReasonCodeDialog.fnPostSelectioncallback(reasonCodeData);
            }
        },

        onClickCancel: function () {
            // Clear Search Bar value on Reason Code Dialog - if any
            if (this.oController.selectReasonCodeDialog) {
                sap.ui.getCore().byId(Fragment.createId(this.dialogId, "searchBarReasonCode")).setValue("");
            }
            let oSaveButton = sap.ui.getCore().byId(Fragment.createId(this.dialogId, "saveButton"));
            oSaveButton.setEnabled(false);
            this.oController.selectReasonCodeDialog.close();
        },

        buildReasonCodeParents: function (aReasonCodes, oReasonCode) {
            let oParentCodes = {};
            for (let i = 1; i <= REASON_CODE_MAX_DEPTH; i++) {
                let sProp = "reasonCode" + i;
                if (!oReasonCode[sProp]) {
                    break;
                }
                let oParentCode = aReasonCodes.find(oCode => oCode[sProp] === oReasonCode[sProp]);
                if (!oParentCode) {
                    Log.error("Failed to find parent reason code " + sProp + "=" + oReasonCode[sProp]);
                    oParentCodes[sProp] = null;
                    aReasonCodes = [];
                } else {
                    oParentCodes[sProp] = oParentCode;
                    aReasonCodes = oParentCode.resourceReasonCodeNodeCollection;
                }
            }
            return oParentCodes;
        }
    }
});