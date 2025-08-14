sap.ui.define([
  "student/crm/ui/controller/BaseController",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "student/crm/ui/model/formatter",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Image",
  "sap/m/Text",
  "sap/ui/core/HTML"
], function (
  BaseController,
  MessageBox,
  MessageToast,
  JSONModel,
  formatter,
  Dialog,
  Button,
  Image,
  Text,
  HTML
) {
  "use strict";

  return BaseController.extend("student.crm.ui.controller.StudentsDetail", {
    formatter: formatter,

    ALLOWED_FILE_TYPES: [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif"
    ],

    EMPTY_RECEIPTS_MODEL: { receipts: [] },
    EMPTY_STUDENT_MODEL: { ID: "", fullname: "", email: "", balance: 0 },

    DEFAULT_RECEIPT_STATE: {
      amount: "0.00",
      date: null,
      isNew: true,
      fileName: null,
      filePath: null
    },

    DEFAULT_DETAIL_FORM_STATE: {
      title: "Student Details",
      saveButtonText: "Save",
      isNewStudent: true,
      student: {
        ID: "",
        fullname: "",
        email: "",
        balance: 0
      },
      showReceiptEditor: false,
      currentReceipt: {
        amount: "0.00",
        date: null,
        isNew: true,
        fileName: null,
        filePath: null
      }
    },

    onInit: function () {
      this._initializeDetailFormModel();
      this._currentReceiptSortProperty = null;
      this._currentReceiptSortDescending = false;
      this._receiptAmountRaw = "0";
    },

    onExit: function () {
      this._cleanupReceiptInputListeners();
    },

    onCancelDetailForm: function () {
      this._cleanupUploadedFiles().then(() => {
        this._closeDetailDialog();
      });
    },

    onSaveStudent: function () {
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      const oStudentData = oDetailFormModel.getProperty("/student");
      const bIsNew = oDetailFormModel.getProperty("/isNewStudent");

      if (!oStudentData || !oStudentData.fullname || !oStudentData.email) {
        MessageBox.error(this._getResourceText("requiredFieldsError", "Please fill in all required fields."));
        return;
      }

      if (bIsNew) {
        this._createStudentFromDetail(oStudentData);
        return;
      }
      this._updateStudentFromDetail(oStudentData);
    },

    onAddReceipt: function () {
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      oDetailFormModel.setProperty("/showReceiptEditor", true);
      oDetailFormModel.setProperty("/currentReceipt", {
        ...this.DEFAULT_RECEIPT_STATE,
        date: formatter.formatDate(new Date())
      });
      this._receiptAmountRaw = "0";
      setTimeout(() => this._setupReceiptAmountCursorBehavior(), 100);
    },

    onCancelReceiptEdit: function () {
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      oDetailFormModel.setProperty("/showReceiptEditor", false);
      const oFileInput = document.getElementById("receiptFileInput");
      if (!oFileInput) {
        return;
      }
      oFileInput.value = '';
      oFileInput.onchange = null;
    },

    onDeleteReceipt: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("receipts");
      MessageBox.confirm(
        this._getResourceText("confirmDeleteReceipt", "Are you sure you want to delete this receipt?"),
        {
          title: this._getResourceText("confirmDeletionTitle", "Confirm Deletion"),
          onClose: function (sAction) {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }
            const oReceiptsModel = this._getMainView().getModel("receipts");
            const aReceipts = this._getReceiptsFromModel();
            const iIndex = parseInt(oContext.getPath().split("/").pop(), 10);
            if (iIndex < 0 || iIndex >= aReceipts.length) {
              return;
            }
            aReceipts.splice(iIndex, 1);
            oReceiptsModel.setProperty("/receipts", aReceipts);
            MessageToast.show(this._getResourceText("receiptDeleted", "Receipt deleted successfully"));
          }.bind(this)
        }
      );
    },

    onEditReceipt: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("receipts");
      const oReceipt = oContext.getObject();
      oReceipt.date = formatter.formatDate(oReceipt.date);
      const formattedAmount = oReceipt.amount !== null && oReceipt.amount !== undefined ?
        parseFloat(oReceipt.amount).toFixed(2) : "0.00";
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      oDetailFormModel.setProperty("/showReceiptEditor", true);
      oDetailFormModel.setProperty("/currentReceipt", {
        ID: oReceipt.ID,
        amount: formattedAmount,
        date: oReceipt.date,
        isNew: false,
        originalIndex: oContext.getPath().split("/").pop(),
        fileName: oReceipt.fileName || null,
        filePath: oReceipt.filePath || null,
        originalFilePath: oReceipt.filePath || null
      });
      this._receiptAmountRaw = formattedAmount.replace(".", "");
      setTimeout(() => this._setupReceiptAmountCursorBehavior(), 100);
    },

    onReceiptAmountChange: function (oEvent) {
      const sNewValue = oEvent.getParameter("newValue");
      const oSource = oEvent.getSource();
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      let sCurrentRaw = this._receiptAmountRaw || "0";
      if (sNewValue === "" || sNewValue === "0.00") {
        sCurrentRaw = "0";
        this._receiptAmountRaw = sCurrentRaw;
        oSource.setValue("0.00");
        oDetailFormModel.setProperty("/currentReceipt/amount", "0.00");
        return;
      }
      const sDigitsOnly = sNewValue.replace(/[^\d]/g, "");
      const sCurrentDigitsOnly = this._getDisplayValue(sCurrentRaw).replace(/[^\d]/g, "");
      if (sDigitsOnly.length > sCurrentDigitsOnly.length) {
        sCurrentRaw = `${sCurrentRaw}${sDigitsOnly.slice(-1)}`;
      } else if (sDigitsOnly.length < sCurrentDigitsOnly.length) {
        sCurrentRaw = sCurrentRaw.slice(0, -1) || "0";
      }
      this._receiptAmountRaw = sCurrentRaw;
      const sFormattedValue = this._getDisplayValue(sCurrentRaw);
      oSource.setValue(sFormattedValue);
      oDetailFormModel.setProperty("/currentReceipt/amount", sFormattedValue);
      this._setCursorToEnd(oSource);
    },

    onReceiptAmountCursorMove: function (oEvent) {
      this._setCursorToEnd(oEvent.getSource());
    },

    onReceiptColumnSort: function (oEvent) {
      const sSortProperty = oEvent.getSource().data("sortProperty");
      const oReceiptsModel = this._getMainView().getModel("receipts");
      const aReceipts = this._getReceiptsFromModel();
      const bDescending = this._currentReceiptSortProperty === sSortProperty 
        ? !this._currentReceiptSortDescending 
        : false;

      this._currentReceiptSortProperty = sSortProperty;
      this._currentReceiptSortDescending = bDescending;

      const aSorted = [...aReceipts].sort((a, b) => {
        let A = a[sSortProperty];
        let B = b[sSortProperty];
        if (sSortProperty === "amount") {
          A = parseFloat(A) || 0;
          B = parseFloat(B) || 0;
        } else if (sSortProperty === "date") {
          A = new Date(A);
          B = new Date(B);
        }
        if (A < B) return bDescending ? 1 : -1;
        if (A > B) return bDescending ? -1 : 1;
        return 0;
      });
      oReceiptsModel.setProperty("/receipts", aSorted);
      this._updateReceiptSortIcons(sSortProperty, bDescending);
    },

    onReceiptDateBlur: function (oEvent) {
      const oSource = oEvent.getSource();
      const oModel = this.getView().getModel("detailForm");
      const sFormatted = formatter.formatDateInput(oSource.getValue());
      oSource.setValue(sFormatted);
      oModel.setProperty("/currentReceipt/date", sFormatted);
    },

    onReceiptDateChange: function (oEvent) {
      const sValue = oEvent.getParameter("newValue");
      const oSource = oEvent.getSource();
      const oModel = this.getView().getModel("detailForm");
      const sFormatted = formatter.formatDateInput(sValue);
      oSource.setValue(sFormatted);
      oModel.setProperty("/currentReceipt/date", sFormatted);
    },

    onRemoveReceiptFile: function () {
      const sRemove = this._getResourceText("removeFile", "Remove file");
      MessageBox.confirm(`${sRemove}?`, {
        title: "Confirm File Removal",
        onClose: (sAction) => {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          this._setCurrentReceiptProperties({
            fileName: null,
            filePath: null
          });
          this._currentFile = null;
          MessageToast.show(this._getResourceText("fileRemoved", "File removed successfully"));
        }
      });
    },

    onSaveReceipt: function () {
      const oDetailFormModel = this._getMainView().getModel("detailForm");
      const oCurrentReceipt = oDetailFormModel.getProperty("/currentReceipt");
      const oReceiptsModel = this._getMainView().getModel("receipts");
      const aReceipts = this._getReceiptsFromModel();
      if (oCurrentReceipt.date) {
        oCurrentReceipt.date = formatter.formatDate(oCurrentReceipt.date);
      }
      if (!oCurrentReceipt.amount || parseFloat(oCurrentReceipt.amount) <= 0) {
        MessageBox.error(this._getResourceText("validAmountError", "Please enter a valid amount"));
        return;
      }
      this._saveReceiptToClientModel(oCurrentReceipt, aReceipts, oReceiptsModel, oDetailFormModel);
    },

    onUploadReceiptFile: function (oEvent) {
      const aFiles = oEvent.getParameter("files");
      if (!aFiles || !aFiles.length) {
        return;
      }
      
      const file = aFiles[0];
      if (!file) return;

      const isValidType = file.type === "application/pdf" || file.type.startsWith("image/");
      if (!isValidType) {
        MessageBox.error(this._getResourceText("fileTypeError", "Only PDF or image files are allowed"));
        return;
      }

      const oModel = this._getMainView().getModel("detailForm");
      const oCurrent = oModel.getProperty("/currentReceipt");
      
      // Mark the current file for deletion if we're replacing it
      if (oCurrent?.filePath && !oCurrent.filePath.startsWith("local://")) {
        oCurrent.oldFileToDelete = oCurrent.filePath;
      }

      this._setCurrentReceiptProperties({
        fileName: file.name,
        filePath: `local://${file.name}`,
        fileSize: file.size
      });

      this._currentFile = file;
    },    onViewReceiptFile: function (oEvent) {
      const oReceipt = oEvent.getSource().getBindingContext("receipts").getObject();
      this._viewReceiptFile(oReceipt);
    },

    onViewReceiptFileInEditor: function () {
      const oModel = this._getMainView().getModel("detailForm");
      const oCurrent = oModel.getProperty("/currentReceipt");
      this._viewReceiptFile(oCurrent);
    },

    _cleanupReceiptInputListeners: function () {
      if (!this._receiptInputListener) {
        return;
      }
      const oInput = this.byId("receiptAmountInput");
      if (!oInput) {
        return;
      }
      const oDom = oInput.getDomRef("inner");
      if (!oDom) {
        return;
      }
      oDom.removeEventListener("click", this._receiptInputListener);
      oDom.removeEventListener("focus", this._receiptInputListener);
      oDom.removeEventListener("keyup", this._receiptInputListener);
      this._receiptInputListener = null;
    },

    _closeDetailDialog: function () {
      this._cleanupReceiptInputListeners();
      const oModel = this._getMainView().getModel("detailForm");
      oModel.setProperty("/showReceiptEditor", false);
      oModel.setProperty("/currentReceipt", { ...this.DEFAULT_RECEIPT_STATE });
      this._receiptAmountRaw = "0";
      if (!this._oDialog) {
        return;
      }
      this._oDialog.close();
    },

    _createBlobFromBase64: function (base64, type) {
      const chars = atob(base64);
      const numbers = new Array(chars.length);
      for (let i = 0; i < chars.length; i++) {
        numbers[i] = chars.charCodeAt(i);
      }
      return new Blob([new Uint8Array(numbers)], { type });
    },

    _createDownloadLink: function (base64, fileName, type) {
      const blob = this._createBlobFromBase64(base64, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    _saveReceiptToClientModel: function (oCurrentReceipt, aReceipts, oReceiptsModel, oDetailFormModel) {
      if (oCurrentReceipt.isNew) {
        aReceipts.push(oCurrentReceipt);
      } else {
        aReceipts[oCurrentReceipt.originalIndex] = oCurrentReceipt;
      }
      oReceiptsModel.setProperty("/receipts", aReceipts);
      oDetailFormModel.setProperty("/showReceiptEditor", false);
    },

    _cleanupUploadedFiles: function () {
      const aReceipts = this._getReceiptsFromModel();
      const toDelete = [];
      aReceipts.forEach(r => {
        if (r.oldFileToDelete) {
          toDelete.push(r.oldFileToDelete);
        }
      });
      return Promise.all(toDelete.map(f => this._deleteFileFromServer(f))).catch(err => {
        console.error("Error cleaning up files:", err);
      });
    },

    _deleteFileFromServer: function (fileName) {
      if (!fileName) {
        return Promise.resolve();
      }
      return fetch("/odata/v4/api/deleteReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName })
      }).then(r => {
        // Don't treat 404 as an error - if file doesn't exist, that's what we wanted anyway
        if (!r.ok && r.status !== 404) {
          console.warn(`Failed to delete file ${fileName}: ${r.statusText}`);
        }
        // Always resolve successfully - file deletion failure shouldn't break the main flow
        return Promise.resolve();
      }).catch(err => {
        console.warn(`Error deleting file ${fileName}:`, err);
        // Always resolve successfully - file deletion failure shouldn't break the main flow
        return Promise.resolve();
      });
    },

    _createStudentFromDetail: function (oStudentData) {
      const oModel = this._getMainView().getModel();
      const aReceipts = this._getReceiptsFromModel();
      const oNew = Object.assign({}, oStudentData);
      delete oNew.ID;
      const oBinding = oModel.bindList("/Students");
      const oCtx = oBinding.create(oNew);
      oCtx.created().then(() => {
        const oCreated = oCtx.getObject();
        const iId = oCreated && oCreated.ID;
        return this._processUploadsAndPersistReceipts(iId, aReceipts);
      }).then(() => {
        MessageToast.show(this._getResourceText("studentSaved", "Student saved successfully"));
        this._showSuccessAndClose("");
      }).catch(err => {
        MessageBox.error(this._getResourceText("errorCreatingStudent", "Error creating student: {0}").replace("{0}", err.message || "Unknown error"));
        this._cleanupUploadedFiles();
      });
    },

    _createReceiptsInDatabase: function () { return Promise.resolve(); },

    _cleanupOldFiles: function (aReceipts) {
      const toDelete = [];
      aReceipts.forEach(r => {
        if (r.oldFileToDelete) {
          toDelete.push(r.oldFileToDelete);
        }
      });
      if (!toDelete.length) {
        return;
      }
      toDelete.forEach(f => this._deleteFileFromServer(f));
    },

    _getReceiptsFromModel: function () {
      const oReceiptsModel = this._getMainView().getModel("receipts");
      return oReceiptsModel ? (oReceiptsModel.getProperty("/receipts") || []) : [];
    },

    _getServerFileName: function (oReceipt) {
      return oReceipt.filePath || oReceipt.fileName;
    },

    _getDisplayValue: function (sRaw) {
      const len = sRaw.length;
      if (len === 1) return `0.0${sRaw}`;
      if (len === 2) return `0.${sRaw}`;
      const intPart = parseInt(sRaw.slice(0, -2), 10).toString();
      const decPart = sRaw.slice(-2);
      return `${intPart}.${decPart}`;
    },

    _getMainController: function () {
      return this._mainController;
    },

    _getMainView: function () {
      return this._mainView || this.getView();
    },

    _formatFileSize: function (bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },    
    
    _initializeDetailFormModel: function () {
      if (!this._getMainView()) {
        this._detailFormModel = new JSONModel({ ...this.DEFAULT_DETAIL_FORM_STATE });
        this._receiptAmountRaw = "0";
        return;
      }
      this._getMainView().setModel(new JSONModel({ ...this.DEFAULT_DETAIL_FORM_STATE }), "detailForm");
      this._receiptAmountRaw = "0";
    },

    _loadAndDisplayFileFromServer: function (oReceipt) {
      const filePath = oReceipt.filePath;
      if (!filePath?.startsWith("/uploads/receipts")) {
        MessageBox.information(this._getResourceText("fileNotFound", "File not found"));
        return;
      }

      fetch("/odata/v4/api/downloadReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        const fileData = `data:${data.mimeType || 'application/octet-stream'};base64,${data.fileContent}`;
        this._createFileViewerFrame(fileData, oReceipt.fileName);
      })
      .catch(() => {
        MessageBox.information(this._getResourceText("fileNotFound", "File not found on server"));
      });
    },

    _loadAndDownloadFileFromServer: function (oReceipt) {
      const filePath = oReceipt.filePath;
      if (!filePath?.startsWith("/uploads/receipts")) {
        MessageBox.information(this._getResourceText("fileNotFound", "File not found"));
        return;
      }

      fetch("/odata/v4/api/downloadReceipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filePath })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        this._createDownloadLink(data.fileContent, oReceipt.fileName || filePath, data.mimeType);
      })
      .catch(() => {
        MessageBox.information(this._getResourceText("fileNotFound", "File not found on server"));
      });
    },

    _prepareDetailForm: function (bIsNew, oStudent) {
      const oModel = this._getMainView().getModel("detailForm");
      oModel.setProperty("/isNewStudent", bIsNew);
      oModel.setProperty("/title", bIsNew ? this._getResourceText("newStudentDialogTitle", "Add New Student") : this._getResourceText("editStudentDialogTitle", "Edit Student"));
      oModel.setProperty("/saveButtonText", "Save");
      oModel.setProperty("/student", bIsNew ? this.EMPTY_STUDENT_MODEL : oStudent);
      if (bIsNew || !oStudent || !oStudent.ID) {
        this._getMainView().setModel(new JSONModel(this.EMPTY_RECEIPTS_MODEL), "receipts");
        return;
      }
      fetch(`/odata/v4/api/Students(${oStudent.ID})/receipts`)
        .then(r => r.json())
        .then(data => {
          const recs = data.value || [];
          recs.forEach(rc => {
            rc.fileName = rc.fileName || null;
            rc.filePath = rc.filePath || null;
            rc.hasFile = !!rc.filePath;
          });
          this._getMainView().setModel(new JSONModel({ receipts: recs }), "receipts");
        })
        .catch(() => {
          this._getMainView().setModel(new JSONModel(this.EMPTY_RECEIPTS_MODEL), "receipts");
        });
    },

    _setCursorToEnd: function (oSource) {
      setTimeout(() => {
        if (!oSource || !oSource.getDomRef) {
          return;
        }
        const dom = oSource.getDomRef("inner");
        if (!dom) {
          return;
        }
        dom.setSelectionRange(dom.value.length, dom.value.length);
      }, 0);
    },

    _setCurrentReceiptProperties: function (mProps) {
      const oModel = this._getMainView().getModel("detailForm");
      Object.keys(mProps).forEach(k => {
        oModel.setProperty(`/currentReceipt/${k}`, mProps[k]);
      });
    },

    _setupReceiptAmountCursorBehavior: function () {
      const oInput = this.byId("receiptAmountInput");
      if (!oInput) {
        return;
      }
      const oDom = oInput.getDomRef("inner");
      if (!oDom) {
        return;
      }
      if (this._receiptInputListener) {
        oDom.removeEventListener("click", this._receiptInputListener);
        oDom.removeEventListener("focus", this._receiptInputListener);
        oDom.removeEventListener("keyup", this._receiptInputListener);
      }
      this._receiptInputListener = () => {
        setTimeout(() => {
          if (!oInput || !oInput.getDomRef) {
            return;
          }
          const inner = oInput.getDomRef("inner");
          if (!inner) {
            return;
          }
          inner.setSelectionRange(inner.value.length, inner.value.length);
        }, 0);
      };
      oDom.addEventListener("click", this._receiptInputListener);
      oDom.addEventListener("focus", this._receiptInputListener);
      oDom.addEventListener("keyup", this._receiptInputListener);
    },

    _showSuccessAndClose: function (message) {
      if (message) {
        MessageToast.show(message);
      }
      this._closeDetailDialog();
      this._refreshMainTable();
    },

    _refreshMainTable: function () {
      try {
        const oMainController = this._getMainController();
        if (!oMainController) {
          return;
        }
        
        const oTable = oMainController.byId("studentsTable");
        if (oTable) {
          const oBinding = oTable.getBinding("items");
          if (oBinding && oBinding.refresh) {
            oBinding.refresh();
          }
        }
      } catch (error) {
        console.error("Error refreshing main table:", error);
      }
    },

    _updateReceiptSortIcons: function (sSortProperty, bDescending) {
      ["sortIconReceiptAmount", "sortIconReceiptDate"].forEach(id => {
        const oIcon = this.byId(id);
        if (oIcon) {
          oIcon.setVisible(false);
        }
      });
      const targetId = sSortProperty === "amount" ? "sortIconReceiptAmount" : "sortIconReceiptDate";
      const oSortIcon = this.byId(targetId);
      if (!oSortIcon) {
        return;
      }
      oSortIcon.setVisible(true);
      oSortIcon.setSrc(bDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
    },

    _updateStudentFromDetail: function (oStudentData) {
      const aReceipts = this._getReceiptsFromModel();
      if (!this._getMainController()) {
        return;
      }
      const oTable = this._getMainController().byId("studentsTable");
      const oBinding = oTable.getBinding("items");
      const aContexts = oBinding.getContexts();
      const oCtx = aContexts.find(c => {
        const o = c.getObject();
        return o && o.ID === oStudentData.ID;
      });
      if (!oCtx) {
        MessageBox.error(this._getResourceText("studentNotFoundUpdate", "Student not found for update"));
        return;
      }
      Object.keys(oStudentData).forEach(k => {
        if (k !== 'ID' && k !== 'receipts') {
          oCtx.setProperty(k, oStudentData[k]);
        }
      });
      setTimeout(() => {
        if (aReceipts.length > 0) {
          this._processUploadsAndPersistReceipts(oStudentData.ID, aReceipts).then(() => {
            const msg = this._getResourceText("studentUpdated", "Student updated successfully");
            this._showSuccessAndClose(msg);
            this._cleanupOldFiles(aReceipts);
          }).catch(err => {
            MessageBox.error(this._getResourceText(
              "studentUpdateReceiptsError", 
              `Student updated but error with receipts: ${err.message}`)
              );
            this._closeDetailDialog();
            this._refreshMainTable();
          });
          return;
        }
        const msg = this._getResourceText("studentUpdated", "Student updated successfully");
        this._showSuccessAndClose(msg);
      }, 100);
    },

    _viewReceiptFile: function (oReceipt) {
      if (!oReceipt || !oReceipt.filePath) {
        MessageBox.information(this._getResourceText("fileNotFound", "No file attached"));
        return;
      }

      switch (true) {
        case oReceipt.filePath?.startsWith("/uploads/receipts"):
          this._loadAndDisplayFileFromServer(oReceipt);
          break;
        case oReceipt.filePath?.startsWith("local://"):
          this._displayFileInFrame(oReceipt);
          break;
        default:
          MessageBox.information(this._getResourceText("fileNotFound", "No file attached"));
      }
    },

    _displayFileInFrame: function (oReceipt) {
      if (oReceipt.filePath?.startsWith("local://") && this._currentFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = e.target.result;
          this._createFileViewerFrame(fileData, oReceipt.fileName);
        };
        reader.onerror = () => MessageBox.error(this._getResourceText("fileViewError", "Error viewing file"));
        reader.readAsDataURL(this._currentFile);
      } else {
        MessageBox.error(this._getResourceText("fileViewError", "Error viewing file"));
      }
    },

    _createFileViewerFrame: function (fileData, fileName) {
      if (this._fileViewerDialog) {
        this._fileViewerDialog.destroy();
      }

      const oDialog = new Dialog({
        title: fileName || "File Viewer",
        contentWidth: "90vw",
        contentHeight: "90vh",
        draggable: true,
        resizable: true,
        endButton: new Button({
          text: "Close",
          press: () => oDialog.close()
        }),
        afterClose: () => {
          oDialog.destroy();
          this._fileViewerDialog = null;
        }
      });

      const isImage = fileData.includes("image/");
      let oContent;

      switch (true) {
        case isImage:
          oContent = new Image({
            src: fileData,
            width: "100%",
            height: "auto",
            densityAware: false
          });
          break;
        case fileData.includes("application/pdf"):
          oContent = new HTML({
            content: `<iframe src="${fileData}" width="100%" height="70vh" style="border: none;"></iframe>`
          });
          break;
        default:
          oContent = new Text({
            text: "File type not supported for preview"
          });
      }

      oDialog.addContent(oContent);
      oDialog.open();
      this._fileViewerDialog = oDialog;
    },

    _getResourceText: function (sKey, sDefault) {
      try {
        const oRB = this.getResourceBundle();
        return oRB ? oRB.getText(sKey) : sDefault;
      } catch {
        return sDefault;
      }
    },

    setDialog: function (oDialog) {
      this._oDialog = oDialog;
    },

    setMainController: function (oController) {
      this._mainController = oController;
    },

    setMainView: function (oView) {
      this._mainView = oView;
      if (!this._detailFormModel) {
        return;
      }
      this._mainView.setModel(this._detailFormModel, "detailForm");
      this._detailFormModel = null;
    },

    openDialog: function (bIsNew, oStudent) {
      this._prepareDetailForm(bIsNew, oStudent);
      if (this._oDialog) {
        this._oDialog.open();
      }
    },

    _processUploadsAndPersistReceipts: function (studentId, aReceipts) {
      if (!aReceipts?.length) return Promise.resolve();

      const uploadThenPersist = async (receipt) => {
        // Handle file upload if there's a new local file
        if (receipt.filePath?.startsWith("local://") && this._currentFile) {
          let fileData;
          
          // Always compress images to ensure they stay under 5MB
          if (this._currentFile.type.startsWith("image/")) {
            // Show compression message for large files
            if (this._currentFile.size > 2 * 1024 * 1024) { // > 2MB
              MessageToast.show(this._getResourceText("compressingImage", "Compressing image..."));
            }
            fileData = await this._compressImageFile(this._currentFile);
          } else {
            fileData = await this._fileToDataURL(this._currentFile);
          }
          
          const base64Content = fileData.split(',')[1];
          
          try {
            const response = await fetch("/odata/v4/api/uploadReceipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                content: base64Content,
                originalFileName: this._currentFile.name
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            receipt.filePath = `/uploads/receipts/${result.fileName}`;
            
            // Clean up old file if it exists
            if (receipt.oldFileToDelete) {
              this._deleteFileFromServer(receipt.oldFileToDelete);
              delete receipt.oldFileToDelete;
            }
          } catch (error) {
            // Don't throw error - just show message and continue without file
            MessageBox.error(`File upload failed: ${error.message}. Receipt will be saved without file.`);
            console.error("File upload error:", error);
            // Clear file-related properties since upload failed
            receipt.filePath = null;
            receipt.fileName = null;
          }
        }

        const oModel = this._getMainView().getModel();

        // For existing receipts, update them instead of creating new ones
        if (!receipt.isNew && receipt.ID) {
          try {
            // Find the existing receipt context in the model
            const sPath = `/Receipts(${receipt.ID})`;
            const oContext = oModel.getContext(sPath);
            
            if (oContext) {
              // Update the existing receipt properties
              oContext.setProperty("amount", parseFloat(receipt.amount));
              oContext.setProperty("date", this._convertDateToISO(receipt.date));
              oContext.setProperty("fileName", receipt.fileName || null);
              oContext.setProperty("filePath", receipt.filePath || null);
              
              // Submit the changes
              return oModel.submitBatch(oModel.getUpdateGroupId());
            }
          } catch (error) {
            console.error("Error updating existing receipt:", error);
            // Fall back to creating a new receipt if update fails
          }
        }

        // For new receipts or if update failed, create them
        const receiptData = {
          amount: parseFloat(receipt.amount),
          date: this._convertDateToISO(receipt.date),
          fileName: receipt.fileName || null,
          filePath: receipt.filePath || null,
          student_ID: studentId
        };

        const oBinding = oModel.bindList("/Receipts");
        const oContext = oBinding.create(receiptData);
        return oContext.created();
      };

      return aReceipts.reduce((promise, receipt) => 
        promise.then(() => uploadThenPersist(receipt)), Promise.resolve());
    },

    _fileToDataURL: function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    _compressImageFile: function (file) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Start with more aggressive compression for larger files
          let maxWidth = 1920;
          let maxHeight = 1080;
          
          // For very large files, start with smaller dimensions
          if (file.size > 10 * 1024 * 1024) { // > 10MB
            maxWidth = 1280;
            maxHeight = 720;
          } else if (file.size > 5 * 1024 * 1024) { // > 5MB
            maxWidth = 1600;
            maxHeight = 900;
          }
          
          let { width, height } = img;
          
          // Always resize to stay within bounds
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with lower quality for larger files
          let initialQuality = 0.7;
          if (file.size > 10 * 1024 * 1024) {
            initialQuality = 0.5;
          } else if (file.size > 5 * 1024 * 1024) {
            initialQuality = 0.6;
          }
          
          this._compressToTarget(canvas, file.type, initialQuality, resolve);
        };
        
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(file);
      });
    },

    _compressToTarget: function (canvas, fileType, quality, resolve) {
      const maxSize = 4.5 * 1024 * 1024; // Slightly under 5MB to account for base64 encoding overhead
      
      canvas.toBlob((blob) => {
        if (blob.size <= maxSize || quality <= 0.1) {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(blob);
        } else {
          // Reduce quality more aggressively for larger files
          const qualityReduction = blob.size > 8 * 1024 * 1024 ? 0.2 : 0.1;
          this._compressToTarget(canvas, fileType, Math.max(0.1, quality - qualityReduction), resolve);
        }
      }, 'image/jpeg', quality); // Always convert to JPEG for better compression
    },

    _convertDateToISO: function (dateString) {
      if (!dateString) return null;
      
      const parts = dateString.split('/');
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      
      const date = new Date(year, month, day);
      return date.toISOString().split('T')[0];
    }
  });
{response.statusText}`);
            }

            const result = await response.json();
            receipt.filePath = `/uploads/receipts/${result.fileName}`;
            
            // Clean up old file if it exists
            if (receipt.oldFileToDelete) {
              this._deleteFileFromServer(receipt.oldFileToDelete);
              delete receipt.oldFileToDelete;
            }
          } catch (error) {
            // Don't throw error - just show message and continue without file
            MessageBox.error(`File upload failed: ${error.message}. Receipt will be saved without file.`);
            console.error("File upload error:", error);
            // Clear file-related properties since upload failed
            receipt.filePath = null;
            receipt.fileName = null;
          }
        }

        const oModel = this._getMainView().getModel();

        // For existing receipts, update them instead of creating new ones
        if (!receipt.isNew && receipt.ID) {
          try {
            // Find the existing receipt context in the model
            const sPath = `/Receipts(${receipt.ID})`;
            const oContext = oModel.getContext(sPath);
            
            if (oContext) {
              // Update the existing receipt properties
              oContext.setProperty("amount", parseFloat(receipt.amount));
              oContext.setProperty("date", this._convertDateToISO(receipt.date));
              oContext.setProperty("fileName", receipt.fileName || null);
              oContext.setProperty("filePath", receipt.filePath || null);
              
              // Submit the changes
              return oModel.submitBatch(oModel.getUpdateGroupId());
            }
          } catch (error) {
            console.error("Error updating existing receipt:", error);
            // Fall back to creating a new receipt if update fails
          }
        }

        // For new receipts or if update failed, create them
        const receiptData = {
          amount: parseFloat(receipt.amount),
          date: this._convertDateToISO(receipt.date),
          fileName: receipt.fileName || null,
          filePath: receipt.filePath || null,
          student_ID: studentId
        };

        const oBinding = oModel.bindList("/Receipts");
        const oContext = oBinding.create(receiptData);
        return oContext.created();
      };

      return aReceipts.reduce((promise, receipt) => 
        promise.then(() => uploadThenPersist(receipt)), Promise.resolve());
    },

    _fileToDataURL: function (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    _compressImageFile: function (file) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Start with more aggressive compression for larger files
          let maxWidth = 1920;
          let maxHeight = 1080;
          
          // For very large files, start with smaller dimensions
          if (file.size > 10 * 1024 * 1024) { // > 10MB
            maxWidth = 1280;
            maxHeight = 720;
          } else if (file.size > 5 * 1024 * 1024) { // > 5MB
            maxWidth = 1600;
            maxHeight = 900;
          }
          
          let { width, height } = img;
          
          // Always resize to stay within bounds
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with lower quality for larger files
          let initialQuality = 0.7;
          if (file.size > 10 * 1024 * 1024) {
            initialQuality = 0.5;
          } else if (file.size > 5 * 1024 * 1024) {
            initialQuality = 0.6;
          }
          
          this._compressToTarget(canvas, file.type, initialQuality, resolve);
        };
        
        const reader = new FileReader();
        reader.onload = (e) => img.src = e.target.result;
        reader.readAsDataURL(file);
      });
    },

    _compressToTarget: function (canvas, fileType, quality, resolve) {
      const maxSize = 4.5 * 1024 * 1024; // Slightly under 5MB to account for base64 encoding overhead
      
      canvas.toBlob((blob) => {
        if (blob.size <= maxSize || quality <= 0.1) {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(blob);
        } else {
          // Reduce quality more aggressively for larger files
          const qualityReduction = blob.size > 8 * 1024 * 1024 ? 0.2 : 0.1;
          this._compressToTarget(canvas, fileType, Math.max(0.1, quality - qualityReduction), resolve);
        }
      }, 'image/jpeg', quality); // Always convert to JPEG for better compression
    },

    _convertDateToISO: function (dateString) {
      if (!dateString) return null;
      
      const parts = dateString.split('/');
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      
      const date = new Date(year, month, day);
      return date.toISOString().split('T')[0];
    }
  });
});
