sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/MessageType",
    "sap/dm/dme/model/AjaxUtil",
    "sap/dm/dme/message/ErrorHandler",
    "sap/ui/core/Fragment",
    "sap/dm/dme/podfoundation/util/PodUtility",
    "sap/m/GroupHeaderListItem",
    "stellium/ext/podplugins/postProductionReportingPlugin/utils/Formatter",
    "sap/dm/dme/util/ServiceErrorAlert"
], function (JSONModel, MessageBox, MessageToast, MessageType, AjaxUtil, ErrorHandler, Fragment, PodUtility,
             GroupHeaderListItem, Formatter, ServiceErrorAlert) {
    "use strict";

    const ALL_UOMS_MODEL = "AllUoms";

    return  {
        _aActualDcData: [],
        formatter: Formatter,
        setController: function (sController) {
            this.oController = sController;
        },

        getDataCollectionData: function () {
            var that = this;
            var vData = that.oController.selectedSectionData;
            var oParameters = {
                sfcs: [],
                stepIds: []
            };

            var sfc = {};
            sfc.sfc = this.oController.selectedOrderData.sfc;
            oParameters.sfcs[0] = sfc;
            oParameters.workCenter = {
                workcenter: vData.workCenter.workcenter
            };
            oParameters.stepIds.push(vData.stepId);
            oParameters.resource = {
                resource: vData.workCenter.workcenter
            };

            var sUri = that.oController.getDataCollectionRestDataSourceUri();
            var saveBtn = this.oController.DataCollectionSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            saveBtn.setEnabled(false);
            this.oController.DataCollectionSubSection.setBusy(true);
            AjaxUtil.post(
                sUri + "datacollection/find", oParameters,
                function (oResponse) {
                    this.oController.DataCollectionSubSection.oResponse = oResponse;
                    that.reassignParamList(oResponse);
                    var dcSummary = [];
                    that.setActualDcData(oResponse);
                    for (var i = 0; i < oResponse.length; i++) {
                        for (var j = 0; j < oResponse[i].dcParameterList.length; j++) {
                            var dcPara = oResponse[i].dcParameterList[j];
                            if(oResponse[i].dcParameterList[j].length > 0){
                                 // for (var k = 0;k < oResponse[i].dcParameterList[j];k++) {
                                    var temp = this.setDCData(oResponse[i], dcPara)
                                 dcSummary.push(temp);
                                // }
                             }
                        else{
                            var temp = this.setDCData(oResponse[i], dcPara)
                            dcSummary.push(temp)
                        }
                        }
                      }

                      dcSummary = dcSummary.sort(this.getSortOrder("dcGroup"))
                    var oModel = new JSONModel(dcSummary);
                    this.oController.DataCollectionSubSection.setModel(oModel, "dataCollectionModel");
                    this.oController.DataCollectionSubSection.setBusy(false);
                }.bind(this),
                function (oError, oHttpErrorMessage) {

                    this.oController.DataCollectionSubSection.setBusy(false);
                    var err = oError ? oError : oHttpErrorMessage;
                    this.oController.showErrorMessage(err, false, true);
                }.bind(this)
            );
        },

        reassignParamList: function (oResponse) {
            for (let oResponseElement of oResponse) {
                oResponseElement.dcParameterList = oResponseElement.dcParameterList.reduce(this.fetchRequiredDataEntries.bind(this), [])
            }
        },

        fetchRequiredDataEntries: function (aResult, oParameter) {
            let iRequiredDataEntries = oParameter.requiredDataEntries;
            while (iRequiredDataEntries > 1) {
                let oPopulatedParameter = Object.assign({}, oParameter);
                oPopulatedParameter.ref = oParameter.ref + iRequiredDataEntries;
                oPopulatedParameter.requiredDataEntries = 1;
                aResult.push(oPopulatedParameter);
                iRequiredDataEntries--;
                oParameter.requiredDataEntries--;
            }
            aResult.push(oParameter);
            return aResult;
        },

        setDCData: function (dcGroup, dcPara) {
            const tempList = {
                dcGroup: dcGroup.dcGroup,
                version: dcGroup.version,
                ref: dcGroup.ref,
                description: dcGroup.description,
                resource: dcGroup.resource.ref.split(',')[1],
                operation: dcGroup.operation,
                opVersion: dcGroup.version,
                parameterName: dcPara.parameterName,
                unitOfMeasure: dcPara.unitOfMeasure,
                commercialUnitOfMeasure: this._getCommercialUomForInternalUom(dcPara.unitOfMeasure),
                maxValue: dcPara.maxValue,
                minValue: dcPara.minValue,
                dcParameterType: dcPara.dcParameterType,
                isBoolean: false,
                comments: '',
                value: '',
                groupParamCount: this.getGroupParamCount(dcGroup),
                isRequired: dcPara.requiredDataEntries > 0 ? "*" : ""

            }
            //  Added support for boolean dropdown list #DIGMANEXE-74379
            if (dcPara.dcParameterType === 'BOOLEAN') {
                tempList.isBoolean = true;
                tempList.trueValueName = dcPara.trueValueName;
                tempList.falseValueName = dcPara.falseValueName;
            }
            return tempList;
        },


          getSortOrder: function(key) {
            return function(a, b) {
                if (a[key] > b[key]) {
                    return 1;
                } else if (a[key] < b[key]) {
                    return -1;
                }
                return 0;
            }
        },


         getGroupParamCount: function(dcGroup){
            var paramList = dcGroup.dcParameterList;
            var num=0;
            for(var i=0;i<paramList.length;i++){
                num = num+paramList[i].requiredDataEntries;
            }

            return num;
         },

        onValueLiveChange: function (oEvent) {
            var saveBtn = this.DataCollectionSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            var inputField = oEvent.getSource();
            var inputValue = oEvent.getSource().getId().includes("select")
                ? oEvent.getSource().getSelectedKey()
                : oEvent.getSource().getValue();
            var oModel = oEvent.getSource().getModel("dataCollectionModel");
            var dcData = oModel.getData();
            var selectedPath = oEvent.getSource().getBindingContext("dataCollectionModel").getPath();
            oModel.setProperty(selectedPath + "/value", inputValue);
            ErrorHandler.clearErrorState(oEvent.getSource());
            saveBtn.setEnabled(false);

            var dcParamList = oModel.getProperty(selectedPath);

            if (!dcParamList.value && dcParamList.isRequired) {
                ErrorHandler.setErrorState(inputField, this.getI18nText("noValueForParameter",  dcParamList.parameterName));
                inputField.setValueStateText(this.getI18nText("noValueForParameter", dcParamList.parameterName));
                return;
            }
           else if (dcParamList.dcParameterType === "NUMBER") {
                let parsedValue = this.formatter.parseNumber(dcParamList.value);
                if (!parsedValue) {
                    ErrorHandler.setErrorState(inputField, this.getI18nText("valueIsNotANumber"));
                    inputField.setValueStateText(this.getI18nText("valueIsNotANumber"));
                    return;
                }
                let uom = dcParamList.unitOfMeasure;
                if(uom && !this.formatter.isDecimalValidationSuccessful(parsedValue, uom)){
                    ErrorHandler.setErrorState(inputField, this.getI18nText("decimalValueNotAllowed", uom));
                    inputField.setValueStateText(this.getI18nText("decimalValueNotAllowed", uom));
                    return;
                }
                else{
                if (dcParamList.minValue && dcParamList.maxValue) {
                    if (parsedValue < dcParamList.minValue || parsedValue > dcParamList.maxValue) {
                        ErrorHandler.setErrorState(inputField, this.getI18nText("valueOutsideRangeForParameter",dcParamList.parameterName));
                        inputField.setValueStateText(this.getI18nText("valueOutsideRangeForParameter"));
                        return;
                    }
                }
                }
            }
            this.DataCollection.enableConfirmButton(dcData);
          },


        onClearBtnPress: function (oEvent) {
            MessageBox.warning(this.getI18nText("DataCollectionClearFields.confirm"), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        this.DataCollection.clearFields(this);
                        var saveBtn = this.DataCollectionSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
                        saveBtn.setEnabled(false);
                    }
                }.bind(this)
            });
        },

        resetFieldValueStates: function (items) {
            for (let item of items) {
                for (let cell of item.getCells()) {
                    cell.setValueState && cell.setValueState('None');
                    cell.getItems && cell.getItems().forEach(e => e.setValueState && e.setValueState('None'));

                }
            }
        },
        clearFields: function (that) {
            var dcModel = that.DataCollectionSubSection.getBlocks()[0].getModel("dataCollectionModel");
            var dcData = dcModel.getData();
            for (var i = 0; i < dcData.length; i++) {
                dcModel.setProperty("/" + i + "/value", "");
                dcModel.setProperty("/" + i + "/comments", "");
            }

            //Clear the value states of all fields
            this.resetFieldValueStates(that.DataCollectionSubSection.getBlocks()[0].getItems());
        },
        enableConfirmButton: function(dcData){
            var saveBtn = this.oController.DataCollectionSubSection.getBlocks()[0].getHeaderToolbar().getContent()[2];
            var flag = true;
            var counter;


            for(var i=0;i<dcData.length;i++){
                counter = 0;
                for(var j=0;j<dcData.length;j++){
                    if(dcData[i].ref === dcData[j].ref && dcData[j].value!="" && dcData[j].isRequired){
                        counter++;
                    }
                }

                if(dcData[i].groupParamCount!==counter && counter>0){
                flag=false;
                break;
            }
            if(!flag){
                break;
            }
            }

            saveBtn.setEnabled(flag);

       },

       getNumberOfRequired: function(dcData){
         var reqNum=0;
        for(var i=0;i<dcData.length;i++){
            if(dcData[i].isRequired){
                reqNum++;
            }
        }

        return reqNum;

       },

       onSaveBtnPress: function(oEvent){
           var dcData = this.DataCollectionSubSection.getModel("dataCollectionModel").getData();
           var oResponse = this.DataCollectionSubSection.oResponse;
           var oParameters = [];

           for(var i=0;i< oResponse.length;i++){
               var tempPara = {
                        dcGroup:{
                            dcGroup:oResponse[i].dcGroup,
                            version:oResponse[i].version,
                            ref:oResponse[i].ref
                        },

                        operation:{
                            operation:oResponse[i].operation,
                            version:oResponse[i].operationVersion
                        },

                        parameterValues: this.DataCollection.getParamList(oResponse[i].dcGroup,dcData),

                        resource:{
                            resource:oResponse[i].resource.ref.split(',')[1]
                        },

                        sfcs:[{
                            sfc: this.selectedOrderData.sfc,
                        }],

                        workCenter:{
                            //this.selectedOrderData.workcenter can have multiple comma-separated workcenters
                            workcenter: this.DataCollection.oController.selectedSectionData.workCenter.workcenter
                        }
                    }

                    oParameters.push(tempPara);
           }

           var sUri = this.getDataCollectionRestDataSourceUri();
           oEvent.getSource().setEnabled(false);
           this.DataCollectionSubSection.setBusy(true);
           AjaxUtil.post(
            sUri + "datacollection/log", oParameters,
            function (oResponse) {
                var errorFlag = false;
                    errorFlag = this.DataCollection.handleErrors(oResponse, oParameters);
                    (errorFlag) ? MessageBox.error(this.getI18nText("dataCollectionPostingError.msg"))
                                : MessageToast.show(this.getI18nText("dataCollectionPostingSuccess.msg"));

                this.DataCollectionSubSection.setBusy(false);
            }.bind(this),
            function (oError, oHttpErrorMessage) {
                var err = oError ? oError : oHttpErrorMessage;
                this.showErrorMessage(err, false, true);
                this.DataCollectionSubSection.setBusy(false);
            }.bind(this)
        );
       },

       handleErrors: function (oResponse, postPayload) {
        var errorFlag = false;
            if(!oResponse.success) {
                errorFlag = true;
                this.oController.addMessage(MessageType.Error,
                    this.oController.getI18nText("dataCollectionPostingErrorTitle.msg"),
                    oResponse.errorMessage, oResponse.errorMessage);
            }
        return errorFlag;
    },

       getParamList: function(dcGroup, dcData){
          var tempList =[];

            for(var i=0;i<dcData.length;i++){
                if(dcGroup == dcData[i].dcGroup && dcData[i].value!==""){
                var param = {
                        parameterName: dcData[i].parameterName,
                    //TODO--Formatting forthe values based on DATA Types. Make sure the backend logic is also adapted.
                         parameterValue: dcData[i].value
                    }

                    tempList.push(param);

                }
            }

          return tempList;

       },

       getDCcountValue: function(dcGroup, dcData){
           var counter= 0;

           for(var i=0;i<dcData.length;i++){
                if(dcData[i].dcGroup === dcGroup && dcData[i].value!=""){
                counter++;
                }
           }
           return counter;
       },
        getPreparedPostedDc: function (aParametricMeasureData, oDcGroupListItem ) {
            let aFlattenedData = [];

            for (let s = 0; s < oDcGroupListItem.sfcList.length; s++) {
                let sRef = oDcGroupListItem.sfcList[s].sfc;
                let sSfc = sRef.substring(sRef.lastIndexOf(",") + 1);

                for (let p = 0; p < oDcGroupListItem.dcParameterList.length; p++) {
                    let sMeasureDisplayName = oDcGroupListItem.dcParameterList[p].parameterName;
                    if (PodUtility.isNotEmpty(oDcGroupListItem.dcParameterList[p].parameterPrompt)) {
                        sMeasureDisplayName = oDcGroupListItem.dcParameterList[p].parameterPrompt;
                    }

                    let oFlatData = {
                        sfc: sSfc,
                        measureGroup: oDcGroupListItem.dcGroup,
                        measureName: oDcGroupListItem.dcParameterList[p].parameterName,
                        measureDisplayName: sMeasureDisplayName,
                        measureType: oDcGroupListItem.dcParameterList[p].dcParameterType,
                        unitOfMeasure: oDcGroupListItem.dcParameterList[p].unitOfMeasure,
                        commercialUnitOfMeasure: this._getCommercialUomForInternalUom(oDcGroupListItem.dcParameterList[p].unitOfMeasure),
                        measureStatus: "",
                        actual: "",
                        disabledParameter: (oDcGroupListItem.dcParameterList[p].dcParameterStatus === "DISABLED"),
                        optionalParameter: (oDcGroupListItem.dcParameterList[p].requiredDataEntries === 0)
                    };

                    if (aParametricMeasureData && aParametricMeasureData.length > 0) {
                        let oMeasureData = this.findParametricMeasureData(sSfc, oFlatData.measureGroup, oFlatData.measureName, aParametricMeasureData);
                        if (oMeasureData) {
                            oFlatData.measureStatus = oMeasureData.measureStatus;
                            oFlatData.actual = oMeasureData.actual;
                        }
                    }

                    aFlattenedData.push(oFlatData);
                }
            }

            return aFlattenedData;
        },


        _getCommercialUomForInternalUom: function (internalUom) {
            if (!internalUom) return null;

            const oView = this.oController.getView();
            let oUomsModel = oView.getModel(ALL_UOMS_MODEL);

            // First time the view is rendered and the model is not set
            if (!oUomsModel) {
                oUomsModel = new JSONModel({uoms: this._getAllUoms()});
                oView.setModel(oUomsModel, ALL_UOMS_MODEL);
            }

            const aAllUoms = oUomsModel.getProperty("/uoms");
            const foundUom = aAllUoms.find(uom => uom.internalUom === internalUom);

            return foundUom ? foundUom.uom : null;
        },

        // Returns UOMS
        _getAllUoms: function () {
            let aAllUoms = [];
            const sUrl = this.oController.getProductRestDataSourceUri() + "uoms/allUoms";

            $.ajaxSettings.async = false;
            AjaxUtil.get(sUrl, null,
                function (aData) {
                    aData.forEach(function (item) {
                        aAllUoms.push(item);
                    });
                }, ServiceErrorAlert.showServiceErrorMessage.bind(this)
            );
            $.ajaxSettings.async = true;

            return aAllUoms;
        },

        getDataCollectionPostings: function (oSelectedParameters, oSource) {
            var sUri = this.oController.getDataCollectionRestDataSourceUri();
            AjaxUtil.post(
                sUri + "datacollection/parametersInfo", oSelectedParameters,
                function (oResponse) {
                    if (oSelectedParameters.allowMultipleCollection) { //TODO--&& oParameters.collectionsCount > 1) {
                        this.getView().setModel(new JSONModel(), "dcParametersPopoverModel");
                        this.DataCollection.openMultipleDCParameterPostings(oResponse, oSource, oSelectedParameters);
                    } else {
                        const aPreparedDcPostings = this.DataCollection.getPreparedPostedDc(oResponse, oSelectedParameters);
                        this.DataCollection.openDCParameterPostings(aPreparedDcPostings, oSelectedParameters.sfcList.length !== 1, oSource);
                    }
                    oSource.setBusy(false);
                }.bind(this.oController),
                function (oError, oHttpErrorMessage) {
                    var err = oError ? oError : oHttpErrorMessage;
                    this.showErrorMessage(err, false, true);
                    oSource.setBusy(false);
                }.bind(this.oController)
            );
        },

        onViewPostsBtnPress: function (oEvent) {
            const oViewPostButton = oEvent.getSource();
            oViewPostButton.setBusy(true);
            const oParameters =  this.DataCollection.getActualDcData().find(dcData => dcData.dcGroup === oViewPostButton.getCustomData()[1].getValue());
            this.DataCollection.getDataCollectionPostings(oParameters, oViewPostButton);
        },
        setActualDcData: function (aDCData) {
            this._aActualDcData = aDCData;
        },
        getActualDcData: function (){
            return this._aActualDcData;
        },
        openDCParameterPostings: function (aPreparedDcPostings, bGroup, oSource) {
            var oModelData = {
                group: bGroup,
                parameters: aPreparedDcPostings
            };

            var oParametersModel = new JSONModel(oModelData);
            this.oController.getView().setModel(oParametersModel, "ParametersData");

            if (this._oDcParametersPopover) {
                this.oController.DataCollection._oDcParametersPopover.openBy(oSource);
            } else {
                this.createAndOpenParametersPopover(oSource);
            }
        },
        getParameterListGroupHeader: function (oGroup) {
            return new GroupHeaderListItem({
                title: oGroup.key,
                upperCase: false
            });
        },
        mergeParameterDataFromDcGroup: function (aResponseData, oSelectedParameters) {
            return aResponseData.forEach(oSfcParametricItem => this.processSfcParametricItemForMerging.bind(this, oSfcParametricItem, oSelectedParameters));
        },
        processSfcParametricItemForMerging: function (oSfcParametricItem, oSelectedParameters) {
            return oSfcParametricItem.parameters.forEach(function (oParameter) {
                var oDcGroupListItemData = this.findParametricMeasureDataInDcGroup(
                    oParameter.measureGroup,
                    oParameter.measureName,
                    oSelectedParameters
                );

                if (oDcGroupListItemData) {
                    oParameter.measureType = oDcGroupListItemData.dcParameterType;
                    oParameter.measureDisplayName = oDcGroupListItemData.parameterPrompt || oParameter.measureName;
                    oParameter.dcParameterStatus = oDcGroupListItemData.dcParameterStatus;
                }
            }.bind(this));
        },
        findParametricMeasureDataInDcGroup: function (sMeasureGroup, sMeasureName, oSelectedParameters) {
            var aMatchedMeasure = oSelectedParameters.dcParameterList.filter(function (oParameter) {
                return this.oDcGroupListItem.dcGroup === sMeasureGroup && oParameter.parameterName === sMeasureName;
            }.bind(this));

            return aMatchedMeasure.length > 0 ? aMatchedMeasure.shift() : null;
        },
        openMultipleDCParameterPostings: function (aResponseData, oSource, oSelectedParameters) {
            this.mergeParameterDataFromDcGroup(aResponseData, oSelectedParameters);
            var aConvertedToAuxResponseData = [].concat.apply([],
                aResponseData.map(this.convertResponseDataForMultiCollections.bind(this)));
            this.getDcParametersPopoverModel().setProperty("/multiCollectionsParameters", aConvertedToAuxResponseData);

            if (this.oDcMultiCollectionsPopover) {
                this.oDcMultiCollectionsPopover.openBy(oSource);
            } else {
                this.createAndOpenMultiCollectionPopover(oSource);
            }
        },
        findParametricMeasureData: function (sSfc, sMeasureGroup, sMeasureName, aParametricMeasureData) {
            if (!aParametricMeasureData) {
                return null;
            }

            var aDataCollectionForSfc = aParametricMeasureData.filter(function (oDataCollection) {
                return oDataCollection.parameters && oDataCollection.sfc && oDataCollection.sfc.sfc === sSfc;
            });

            if (aDataCollectionForSfc.length === 0) {
                return null;
            }

            var aMatchedMeasure = aDataCollectionForSfc[0].parameters.filter(function (oMeasure) {
                return !oMeasure.processed && oMeasure.measureGroup === sMeasureGroup && oMeasure.measureName === sMeasureName;
            });

            if (aMatchedMeasure.length === 0) {
                return null;
            }

            aMatchedMeasure[0].processed = true; // mark found measure as processed to distinguish it from other measures for multiple required data entries
            return aMatchedMeasure[0];
        },
        convertResponseDataForMultiCollections: function (oSfcParametricItem) {
            var aUniqueDateTimesInCollections =
                oSfcParametricItem.parameters.reduce(this.getUniqueDateTimeInCollections.bind(this), []);
            return aUniqueDateTimesInCollections.map(function (dtCollectionDateCreated, iIndex) {
                return {
                    sfc: oSfcParametricItem.sfc.sfc,
                    sfcRef: oSfcParametricItem.sfc.ref,
                    collectionName: this.oController.getI18nText("enum.dcMultiCollectionsPopover.collectionsList.collectionName",
                        iIndex + 1),
                    createdDate: dtCollectionDateCreated,
                    parameters: oSfcParametricItem.parameters.filter(function (oParameter) {
                        return dtCollectionDateCreated === oParameter.dateCreated;
                    })
                };
            }.bind(this));
        },

        getUniqueDateTimeInCollections: function (aUniqueDateTimes, oParameter) {
            if (aUniqueDateTimes.indexOf(oParameter.dateCreated) === -1) {
                aUniqueDateTimes.push(oParameter.dateCreated);
            }
            return aUniqueDateTimes;
        },

        createAndOpenMultiCollectionPopover: function (oSource) {
            Fragment.load({
                id: "dcMultiCollectionsPopover",
                name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.DcMultiCollectionsParametersPopover",
                controller: this
            }).then(function (oFragment) {
                this.getView().addDependent(oFragment);
                this.DataCollection.oDcMultiCollectionsPopover = oFragment;
                this.DataCollection.oDcMultiCollectionsPopover.openBy(oSource);
            }.bind(this.oController));
        },
        createAndOpenParametersPopover: function (oSource) {
            Fragment.load({
                id: "dcParametersPopover",
                name: "stellium.ext.podplugins.postProductionReportingPlugin.view.fragments.DCParametersPopover",
                controller: this
            }).then(function (oFragment) {
                this.getView().addDependent(oFragment);
                this.DataCollection._oDcParametersPopover = oFragment;
                this.DataCollection._oDcParametersPopover.openBy(oSource);
            }.bind(this.oController));
        },

        getDcParametersPopoverModel: function () {
            return this.oController.getView().getModel("dcParametersPopoverModel");
        },

        onNavToParametersPress: function (oEvent) {
            var sCollectionBindingContextPath = oEvent.getParameter("listItem").getBindingContextPath();
            var oPopoverNavContainer = Fragment.byId("dcMultiCollectionsPopover", "multiCollectionsPopoverNavContainer");
            var oParametersPage = Fragment.byId("dcMultiCollectionsPopover", "parametersPage");
            oPopoverNavContainer.to(oParametersPage);
            oParametersPage.bindElement({path: sCollectionBindingContextPath, model: "dcParametersPopoverModel"});
        },

        onNavBackToCollectionsPress: function () {
            var oPopoverNavContainer = Fragment.byId("dcMultiCollectionsPopover", "multiCollectionsPopoverNavContainer");
            oPopoverNavContainer.back();
        },

        onDcMultiCollectionsPopoverAfterClose: function () {
            Fragment.byId("dcMultiCollectionsPopover", "multiCollectionsPopoverNavContainer").backToTop();
        },


    }
});
