sap.ui.define([ "sap/ui/base/Object" ],
    function (BaseObject) {
        "use strict";

        const UserActions = {
            UNPACK: "UNPACK",
            PACK: "PACK",
            REMOVE: "REMOVE",
            ADD: "ADD"
        };

        const PackingUnitStatuses = {
            OPEN: "OPEN",
            CLOSED: "CLOSED"
        };

        return BaseObject.extend("stellium.ext.podplugins.packingPluginToshif.utils.UserAction", {
            UserActions,
            PackingUnitStatuses,
            _sUserAction: null,
            constructor: function (sUserAction) {
                this.setAction(sUserAction);
            },
            getAction: function () {
                return this._sUserAction;
            },
            setAction: function (sNewAction) {
                this._sUserAction = sNewAction || UserActions.ADD;
            },
            setUnpack: function() {
                this.setAction(UserActions.UNPACK);
            },
            setPack: function () {
                this.setAction(UserActions.PACK);
            },
            setRemove: function () {
                this.setAction(UserActions.REMOVE);
            },
            setAdd: function () {
                this.setAction(UserActions.ADD);
            },
            isAdd: function () {
                return this.getAction() === UserActions.ADD;
            },
            isRemove: function () {
                return this.getAction() === UserActions.REMOVE;
            },
            isPack: function () {
                return this.getAction() === UserActions.PACK;
            },
            isUnpack: function () {
                return this.getAction() === UserActions.UNPACK;
            },
            toPackingUnitStatus: function () {
                switch (this._sUserAction) {
                case UserActions.UNPACK:
                case UserActions.ADD:
                case UserActions.REMOVE:
                    return PackingUnitStatuses.OPEN;
                default: return PackingUnitStatuses.CLOSED;
                }
            },
            isOpenAction: function () {
                return PackingUnitStatuses[this._sUserAction] === "OPEN";
            }
        });
    }, true);
