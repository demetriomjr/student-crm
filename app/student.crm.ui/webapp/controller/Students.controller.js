sap.ui.define([
  "student/crm/ui/controller/BaseController",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/json/JSONModel",
  "student/crm/ui/model/formatter",
  "sap/ui/core/BusyIndicator"
], function (BaseController, MessageBox, MessageToast, Filter, FilterOperator, JSONModel, formatter, BusyIndicator) {
  "use strict";

  return BaseController.extend("student.crm.ui.controller.Students", {
    formatter: formatter,

    TABLE_ID: "studentsTable",

    MODEL_NAMES: { FILTER: "filter", PAGINATION: "pagination" },

    DEFAULT_FILTER_STATE: { fullNames: [], studentIds: [], emails: [], balanceRanges: [], statusList: [] },

    DEFAULT_PAGINATION_STATE: { currentPage: 1, totalPages: 1, hasPrevious: false, hasNext: false, totalItems: 0 },

    onInit: function () {
      this._pageSize = 10;
      this.getView().setModel(new JSONModel({ filters: { ...this.DEFAULT_FILTER_STATE } }), this.MODEL_NAMES.FILTER);
      this.getView().setModel(new JSONModel({ ...this.DEFAULT_PAGINATION_STATE }), this.MODEL_NAMES.PAGINATION);
      this._checkAuthentication();
    },

    onExit: function () {
      // Clean up dialog and promise to prevent memory leaks
      if (this._oDialog) {
        this._oDialog.destroy();
        this._oDialog = null;
      }
      this._oDetailController = null;
      this._oDetailDialogPromise = null;
    },

    onBalanceInputLiveChange: function (oEvent) {
      var oInput = oEvent.getSource();
      var sValue = oInput.getValue();
      var valid = /^\s*-?\d*(\.\d+)?\s*(-\s*-?\d*(\.\d+)?)?\s*$/.test(sValue);
      if (!valid && sValue) {
        oInput.setValue(sValue.slice(0, -1));
      }
    },

    _checkAuthentication: function () {
      const isLoggedIn = sessionStorage.getItem("isLoggedIn");
      if (!isLoggedIn || isLoggedIn !== "true") {
        this.navTo("main");
        return;
      }
      setTimeout(() => this._initializePagination(), 100);
    },

    _initializePagination: function () {
      const oBinding = this.byId(this.TABLE_ID).getBinding("items");
      if (!oBinding) {
        setTimeout(() => this._initializePagination(), 150);
        return;
      }
      oBinding.changeParameters({ "$count": true });
      this._bindToCount(oBinding);
    },

    _bindToCount: function (oBinding) {
      const trigger = () => setTimeout(() => this._updateCountFromBinding(oBinding), 100);
      oBinding.attachChange(trigger);
      oBinding.attachDataReceived(trigger);
      trigger();
    },

    _updatePaginationWithCount: function (totalCount) {
      const m = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
      const page = m.getProperty("/currentPage") || 1;
      const pages = Math.max(1, Math.ceil(totalCount / this._pageSize));
      m.setProperty("/totalItems", totalCount);
      m.setProperty("/totalPages", pages);
      m.setProperty("/hasPrevious", page > 1);
      m.setProperty("/hasNext", page < pages);
    },

    _updateCountFromBinding: function (oBinding) {
      const fallback = () => {
        const oTable = this.byId(this.TABLE_ID);
        const visible = oTable && oTable.getItems ? oTable.getItems().length : 0;
        this._updatePaginationWithCount(visible);
      };
      try {
        if (oBinding && oBinding.getHeaderContext) {
          const hc = oBinding.getHeaderContext();
          if (hc && hc.requestProperty) {
            hc.requestProperty("$count")
              .then((c) => {
                if (typeof c === "number" && c >= 0) {
                  this._updatePaginationWithCount(c);
                } else {
                  fallback();
                }
              })
              .catch(fallback);
            return;
          }
        }
      } catch (e) {}
      let total = 0;
      if (oBinding && oBinding.getCount) total = oBinding.getCount();
      if (total <= 0 && oBinding && oBinding.getLength) total = oBinding.getLength() || 0;
      if (total <= 0 && oBinding && oBinding.getContexts) total = (oBinding.getContexts() || []).length;
      if (total >= 0) this._updatePaginationWithCount(total);
    },

    onFilterBarSearch: function () {
      this._syncTokensFromControlsToModel();
      this._applyAllFilters();
    },

    onFilterBarClear: function () {
      this._clearAllTokens();
      this._clearAllFilters();
    },

    _clearAllFilters: function () {
      this.getView().getModel(this.MODEL_NAMES.FILTER).setProperty("/filters", { ...this.DEFAULT_FILTER_STATE });
      this._applyAllFilters();
      MessageToast.show(this.getResourceBundle().getText("filtersCleared"));
    },

    onFilterInputSubmit: function (oEvent) {
      var oInput = oEvent.getSource();
      var sValue = (oInput.getValue && oInput.getValue()) || "";
      if (sValue && oInput.addToken) {
        var aTokens = oInput.getTokens ? oInput.getTokens() : [];
        var bExists = aTokens.some(function (t) { return (t.getKey && t.getKey()) === sValue || (t.getText && t.getText()) === sValue; });
        if (!bExists) {
          oInput.addToken(new sap.m.Token({ text: sValue, key: sValue }));
        }
        oInput.setValue("");
      }
      this.onFilterBarSearch();
    },

    _applyAllFilters: function () {
      const fm = this.getView().getModel(this.MODEL_NAMES.FILTER);
      const b = this.byId(this.TABLE_ID) && this.byId(this.TABLE_ID).getBinding("items");
      if (!b) { return; }
      const f = fm.getProperty("/filters") || {};
      const a = [];
      if (Array.isArray(f.fullNames) && f.fullNames.length) {
        const nameFilters = f.fullNames.map(t => new Filter({ path: "fullname", operator: FilterOperator.Contains, value1: t.text, caseSensitive: false }));
        a.push(new Filter({ filters: nameFilters, and: false }));
      }
      if (Array.isArray(f.studentIds) && f.studentIds.length) a.push(new Filter({ filters: f.studentIds.map(t => new Filter("ID", FilterOperator.EQ, parseInt(t.text, 10))), and: false }));
      if (Array.isArray(f.emails) && f.emails.length) {
        const emailFilters = f.emails.map(t => new Filter({ path: "email", operator: FilterOperator.Contains, value1: t.text, caseSensitive: false }));
        a.push(new Filter({ filters: emailFilters, and: false }));
      }
      if (Array.isArray(f.balanceRanges) && f.balanceRanges.length) {
        const ranges = [];
        f.balanceRanges.forEach(t => {
          const parts = String(t.text).split("-").map(s => s.trim());
          if (parts.length === 2) {
            const lo = parseFloat(parts[0]);
            const hi = parseFloat(parts[1]);
            if (!isNaN(lo) && !isNaN(hi)) ranges.push(new Filter("balance", FilterOperator.BT, lo, hi));
          } else if (parts.length === 1) {
            const v = parseFloat(parts[0]);
            if (!isNaN(v)) ranges.push(new Filter("balance", FilterOperator.EQ, v));
          }
        });
        if (ranges.length) a.push(new Filter({ filters: ranges, and: false }));
      }
      if (Array.isArray(f.statusList) && f.statusList.length) {
        const map = { active: () => new Filter("balance", FilterOperator.GT, 0), inactive: () => new Filter("balance", FilterOperator.EQ, 0), pending: () => new Filter("balance", FilterOperator.LT, 0) };
        const statusFilters = f.statusList.map(t => map[t.key] ? map[t.key]() : null).filter(Boolean);
        if (statusFilters.length) a.push(new Filter({ filters: statusFilters, and: false }));
      }
      const combined = a.length ? new Filter({ filters: a, and: true }) : [];
      b.filter(combined);
      this._updateCountAfterFilter();
    },

    _updateCountAfterFilter: function () {
      const b = this.byId(this.TABLE_ID).getBinding("items");
      if (!b) {
        return;
      }
      setTimeout(() => this._updateCountFromBinding(b), 200);
    },

    onTableUpdateFinished: function (e) {
      const t = e.getParameter("total");
      if (typeof t === "number" && t >= 0) {
        this._updatePaginationWithCount(t);
        return;
      }
      const b = e.getSource().getBinding("items");
      if (b) {
        this._updateCountFromBinding(b);
      }
    },

    onStudentPress: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext();
      if (!oContext) {
        return;
      }
      this._getDetailDialogController().then((oDetailCtrl) => {
        oDetailCtrl.openDialog(false, oContext.getObject());
      }).catch((err) => {
        MessageBox.error(this.getResourceBundle().getText("errorLoadingDialog", "Error loading dialog: {0}").replace("{0}", (err.message || err)));
      });
    },

    onAddStudent: function () {
      this._getDetailDialogController().then((oDetailCtrl) => {
        oDetailCtrl.openDialog(true);
      }).catch((err) => {
        MessageBox.error(this.getResourceBundle().getText("errorLoadingDialog", "Error loading dialog: {0}").replace("{0}", (err.message || err)));
      });
    },

    /**
     * Returns a promise resolving with the StudentsDetail controller after loading the fragment (singleton)
     */
    _getDetailDialogController: function () {
      if (!this._oDetailDialogPromise) {
        this._oDetailDialogPromise = new Promise((resolve, reject) => {
          sap.ui.require([
            "sap/ui/core/Fragment",
            "student/crm/ui/controller/StudentsDetail.controller"
          ], (Fragment, StudentsDetailController) => {
            try {
              const oDetailCtrl = new StudentsDetailController();
              Fragment.load({
                name: "student.crm.ui.view.StudentDetail",
                controller: oDetailCtrl
              }).then((oDialog) => {
                this._oDialog = oDialog;
                this._oDetailController = oDetailCtrl;
                this.getView().addDependent(oDialog);
                oDetailCtrl.setMainView(this.getView());
                oDetailCtrl.setMainController(this);
                oDetailCtrl.setDialog(oDialog);
                if (oDetailCtrl.onInit) { oDetailCtrl.onInit(); }
                resolve(oDetailCtrl);
              }).catch((err) => {
                // Reset promise on error so it can be retried
                this._oDetailDialogPromise = null;
                reject(err);
              });
            } catch (e) {
              this._oDetailDialogPromise = null;
              reject(e);
            }
          }, (err) => {
            this._oDetailDialogPromise = null;
            reject(err);
          });
        });
      }
      return this._oDetailDialogPromise;
    },

    onDeleteStudent: function (oEvent) {
      const c = oEvent.getSource().getBindingContext();
      const s = c.getObject();
      MessageBox.confirm(
        this.getResourceBundle().getText("studentDeleteConfirm", "Are you sure you want to delete student '{0}'?").replace("{0}", s.fullname),
        {
          title: this.getResourceBundle().getText("confirmDeletionTitle", "Confirm Deletion"),
          onClose: function (a) {
            if (a === MessageBox.Action.OK) {
              this._deleteStudent(c);
            }
          }.bind(this)
        }
      );
    },

    _deleteStudent: function (c) {
      c
        .delete()
        .then(() => {
          MessageToast.show(this.getResourceBundle().getText("studentDeleteSuccess", "Student deleted successfully"));
          const b = this.byId(this.TABLE_ID).getBinding("items");
          if (!b) {
            return;
          }
          setTimeout(() => this._updateCountFromBinding(b), 200);
        })
        .catch((e) => MessageBox.error(this.getResourceBundle().getText("errorDeletingStudent", "Error deleting student: {0}").replace("{0}", (e.message || e))));
    },

    onViewReceipts: function (oEvent) {
      const s = oEvent.getSource().getBindingContext().getObject();
      MessageToast.show(this.getResourceBundle().getText("viewReceiptsFor", "View Receipts for: {0}").replace("{0}", s.fullname));
    },

    onTokenUpdate: function (oEvent) {
      const type = oEvent.getParameter("type");
      const tokens = oEvent.getParameter("tokens") || [];
      const oSource = oEvent.getSource();
      const path = this._getFilterArrayPathForMultiInput(oSource);
      if (!path) {
        return;
      }
      const m = this.getView().getModel(this.MODEL_NAMES.FILTER);
      const arr = m.getProperty(path) || [];
      if (type === "added") {
        tokens.forEach(tok => {
          const text = tok.getText && tok.getText();
          const key = tok.getKey && tok.getKey();
          if (!text) {
            return;
          }
          if (!arr.some(t => (t.key || "") === (key || "") && t.text === text)) {
            arr.push({ key: key || text, text });
          }
        });
      } else {
        tokens.forEach(tok => {
          const text = tok.getText && tok.getText();
          const key = tok.getKey && tok.getKey();
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].text === text && (arr[i].key || "") === (key || "")) {
              arr.splice(i, 1);
            }
          }
        });
      }
      m.setProperty(path, arr);
      if (type !== "added") {
        this._applyAllFilters();
      }
    },

    onTokenDelete: function (oEvent) {
      const oToken = oEvent.getSource();
      const sText = oToken.getText && oToken.getText();
      const sKey = oToken.getKey && oToken.getKey();
      let oMI = oToken.getParent && oToken.getParent();
      while (oMI && (!oMI.isA || !oMI.isA("sap.m.MultiInput"))) {
        oMI = oMI.getParent && oMI.getParent();
      }
      const path = this._getFilterArrayPathForMultiInput(oMI || oToken.getParent());
      if (!path) return;
      const m = this.getView().getModel(this.MODEL_NAMES.FILTER);
      const arr = m.getProperty(path) || [];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].text === sText && (arr[i].key || "") === (sKey || "")) {
          arr.splice(i, 1);
        }
      }
      m.setProperty(path, arr);
      this._applyAllFilters();
    },

    onSuggestionItemSelected: function (oEvent) {
      const oItem = oEvent.getParameter("selectedItem") || oEvent.getParameter("item");
      if (!oItem) return;
      const text = oItem.getText ? oItem.getText() : (oItem.getProperty && oItem.getProperty("text"));
      const key = oItem.getKey ? oItem.getKey() : (oItem.getProperty && oItem.getProperty("key"));
      const oSource = oEvent.getSource();
      const path = this._getFilterArrayPathForMultiInput(oSource);
      if (!path || !text) return;
      const m = this.getView().getModel(this.MODEL_NAMES.FILTER);
      const arr = m.getProperty(path) || [];
      if (!arr.some(t => (t.key || "") === (key || "") && t.text === text)) {
        arr.push({ key: key || text, text });
      }
      m.setProperty(path, arr);
      if (oSource.addToken) {
        oSource.addToken(new sap.m.Token({ key: key || text, text }));
      }
      if (oSource.setValue) {
        oSource.setValue("");
      }
    },

    _getFilterArrayPathForMultiInput: function (oSource) {
      const id = oSource && oSource.getId ? oSource.getId() : "";
      switch (true) {
        case id.includes("fullNameMultiInput"):
          return "/filters/fullNames";
        case id.includes("studentIdMultiInput"):
          return "/filters/studentIds";
        case id.includes("emailMultiInput"):
          return "/filters/emails";
        case id.includes("balanceMultiInput"):
          return "/filters/balanceRanges";
        case id.includes("statusMultiInput"):
          return "/filters/statusList";
        default:
          return null;
      }
    },

    _getMultiInput: function (id) { return this.byId(id); },

    _syncTokensFromControlsToModel: function () {
      const m = this.getView().getModel(this.MODEL_NAMES.FILTER);
      const ensureArray = (v) => Array.isArray(v) ? v : [];
      const readTokens = (id) => {
        const mi = this._getMultiInput(id);
        if (!mi) {
          return [];
        }
        const toks = mi.getTokens ? (mi.getTokens() || []) : [];
        return toks.map(t => ({ key: (t.getKey && t.getKey()) || t.getText(), text: t.getText && t.getText() }));
      };
      const addUnique = (arr, key, text) => {
        if (!text) {
          return;
        }
        if (!arr.some(t => (t.key || "") === (key || "") && t.text === text)) {
          arr.push({ key: key || text, text });
        }
      };
      const syncMIFromArray = (id, arr) => {
        const mi = this._getMultiInput(id);
        if (!mi) {
          return;
        }
        if (mi.addToken) {
          const existing = (mi.getTokens && mi.getTokens() || []).map(t => ({ key: (t.getKey && t.getKey()) || t.getText(), text: t.getText && t.getText() }));
          arr.forEach(it => {
            if (!existing.some(e => (e.key || "") === (it.key || "") && e.text === it.text)) {
              mi.addToken(new sap.m.Token({ key: it.key || it.text, text: it.text }));
            }
          });
        }
        if (mi.setValue) {
          mi.setValue("");
        }
      };

      const names = ensureArray(readTokens("fullNameMultiInput"));
      const nameMI = this._getMultiInput("fullNameMultiInput");
      const pendingNames = (nameMI && nameMI.getValue && nameMI.getValue()) ? nameMI.getValue() : "";
      pendingNames.split(/[;,]/).map(s => s.trim()).filter(Boolean).forEach(s => addUnique(names, s, s));
      m.setProperty("/filters/fullNames", names);
      syncMIFromArray("fullNameMultiInput", names);

      const ids = ensureArray(readTokens("studentIdMultiInput"));
      const idMI = this._getMultiInput("studentIdMultiInput");
      const pendingIds = (idMI && idMI.getValue && idMI.getValue()) ? idMI.getValue() : "";
      pendingIds
        .split(/[;,\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(s => {
          const n = parseInt(s.replace(/\D/g, ''), 10);
          if (!isNaN(n)) {
            addUnique(ids, String(n), String(n));
          }
        });
      m.setProperty("/filters/studentIds", ids);
      syncMIFromArray("studentIdMultiInput", ids);

      const emails = ensureArray(readTokens("emailMultiInput"));
      const emailMI = this._getMultiInput("emailMultiInput");
      const pendingEmails = (emailMI && emailMI.getValue && emailMI.getValue()) ? emailMI.getValue() : "";
      pendingEmails.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean).forEach(s => addUnique(emails, s, s));
      m.setProperty("/filters/emails", emails);
      syncMIFromArray("emailMultiInput", emails);

      const balances = ensureArray(readTokens("balanceMultiInput"));
      const balMI = this._getMultiInput("balanceMultiInput");
      const pendingBalances = (balMI && balMI.getValue && balMI.getValue()) ? balMI.getValue() : "";
      pendingBalances.split(/[;,]/).map(s => s.trim()).filter(Boolean).forEach(s => addUnique(balances, s, s));
      m.setProperty("/filters/balanceRanges", balances);
      syncMIFromArray("balanceMultiInput", balances);

      const statuses = ensureArray(readTokens("statusMultiInput"));
      const statusMI = this._getMultiInput("statusMultiInput");
      const pendingStatus = (statusMI && statusMI.getValue && statusMI.getValue()) ? statusMI.getValue() : "";
      const statusMap = { active: "active", inactive: "inactive", pending: "pending" };
      pendingStatus
        .split(/[;,\s]+/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach(s => {
          const k = statusMap[s] || s;
          addUnique(statuses, k, s);
        });
      m.setProperty("/filters/statusList", statuses);
      syncMIFromArray("statusMultiInput", statuses);
    },

    _clearAllTokens: function () {
      ["fullNameMultiInput", "studentIdMultiInput", "emailMultiInput", "balanceMultiInput", "statusMultiInput"].forEach(id => {
        const mi = this._getMultiInput(id);
        if (mi) {
          if (mi.removeAllTokens) {
            mi.removeAllTokens();
          }
          if (mi.setValue) {
            mi.setValue("");
          }
        }
      });
    }
  });
});
