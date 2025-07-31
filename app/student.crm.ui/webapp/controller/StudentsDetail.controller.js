sap.ui.define([
   "student/crm/ui/controller/BaseController",
   "sap/m/MessageBox",
   "sap/m/MessageToast",
   "sap/ui/model/json/JSONModel"
], function (BaseController, MessageBox, MessageToast, JSONModel) {
	"use strict";
	return BaseController.extend("student.crm.ui.controller.StudentsDetail", {

	ALLOWED_FILE_TYPES: [
		'application/pdf',
		'image/jpeg',
		'image/jpg', 
		'image/png',
		'image/gif',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	],

	EMPTY_RECEIPTS_MODEL: { receipts: [] },
	EMPTY_STUDENT_MODEL: { ID: "", fullname: "", email: "", balance: 0 },
	
	DEFAULT_RECEIPT_STATE: {
		amount: "0.00",
		date: null,
		isNew: true,
		fileName: null,
		fileData: null,
		fileType: null
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
			fileData: null,
			fileType: null
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
			this._closeDetailDialog();
		},

		onSaveStudent: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			const oStudentData = oDetailFormModel.getProperty("/student");
			const bIsNew = oDetailFormModel.getProperty("/isNewStudent");
			const oResourceBundle = this.getResourceBundle();
			
			if (!oStudentData || !oStudentData.fullname || !oStudentData.email) {
				MessageBox.error("Please fill in all required fields.");
				return;
			}

			if (bIsNew) {
				this._createStudentFromDetail(oStudentData, oResourceBundle);
			} else {
				this._updateStudentFromDetail(oStudentData, oResourceBundle);
			}
		},

		onAddReceipt: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");

			oDetailFormModel.setProperty("/showReceiptEditor", true);
			oDetailFormModel.setProperty("/currentReceipt", {
				...this.DEFAULT_RECEIPT_STATE,
				date: this.formatDate(new Date())
			});
			
			this._receiptAmountRaw = "0";
			
			setTimeout(() => this._setupReceiptAmountCursorBehavior(), 100);
		},

		onCancelReceiptEdit: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			oDetailFormModel.setProperty("/showReceiptEditor", false);
			
			const oFileInput = document.getElementById("receiptFileInput");
			if (!oFileInput) return;
			
			oFileInput.value = '';
			oFileInput.onchange = null;
		},

		onDeleteReceipt: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext("receipts");
			
			MessageBox.confirm(
				"Are you sure you want to delete this receipt?",
				{
					title: "Confirm Deletion",
					onClose: function (sAction) {
						if (sAction !== MessageBox.Action.OK) return;
						
						const oReceiptsModel = this._getMainView().getModel("receipts");
						const aReceipts = oReceiptsModel.getProperty("/receipts") || [];
						const iIndex = parseInt(oContext.getPath().split("/").pop(), 10);
						
						if (iIndex < 0 || iIndex >= aReceipts.length) return;
						
						aReceipts.splice(iIndex, 1);
						oReceiptsModel.setProperty("/receipts", aReceipts);
						MessageToast.show("Receipt deleted successfully");
					}.bind(this)
				}
			);
		},

		onEditReceipt: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext("receipts");
			const oReceipt = oContext.getObject();
			
			oReceipt.date = this.formatDate(oReceipt.date);

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
				fileName: oReceipt.fileName || oReceipt.file || null,
				fileData: oReceipt.fileData || null,
				fileType: oReceipt.fileType || null,
				originalFile: oReceipt.file || null
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
			const oSource = oEvent.getSource();
			const sSortProperty = oSource.data("sortProperty");
			const oReceiptsModel = this._getMainView().getModel("receipts");
			const aReceipts = oReceiptsModel.getProperty("/receipts") || [];

			let bDescending = false;
			if (this._currentReceiptSortProperty === sSortProperty) {
				bDescending = !this._currentReceiptSortDescending;
			}

			this._currentReceiptSortProperty = sSortProperty;
			this._currentReceiptSortDescending = bDescending;

			const aSortedReceipts = [...aReceipts].sort((a, b) => {
				let valueA = a[sSortProperty];
				let valueB = b[sSortProperty];

				switch (sSortProperty) {
					case "amount":
						valueA = parseFloat(valueA) || 0;
						valueB = parseFloat(valueB) || 0;
						break;
					case "date":
						valueA = new Date(valueA);
						valueB = new Date(valueB);
						break;
					default:
						break;
				}

				if (valueA < valueB) return bDescending ? 1 : -1;
				if (valueA > valueB) return bDescending ? -1 : 1;
				return 0;
			});

			oReceiptsModel.setProperty("/receipts", aSortedReceipts);
			this._updateReceiptSortIcons(sSortProperty, bDescending);
		},

		onReceiptDateBlur: function (oEvent) {
			const oSource = oEvent.getSource();
			const oDetailFormModel = this.getView().getModel("detailForm");
			let sDateValue = oSource.getValue().replace(/[^\d]/g, "");

			if (sDateValue.length >= 2) {
				sDateValue = `${sDateValue.substring(0,2)}/${sDateValue.substring(2)}`;
			}
			if (sDateValue.length >= 4) {
				sDateValue = `${sDateValue.substring(0,5)}/${sDateValue.substring(5,9)}`;
			}
			sDateValue = sDateValue.substring(0, 10);

			oSource.setValue(sDateValue);
			oDetailFormModel.setProperty("/currentReceipt/date", sDateValue);
		},

		onReceiptDateChange: function (oEvent) {
			const sValue = oEvent.getParameter("newValue");
			const oSource = oEvent.getSource();
			const oDetailFormModel = this.getView().getModel("detailForm");

			let sFormattedValue = sValue.replace(/[^\d]/g, "");
			
			if (sFormattedValue.length > 2) {
				sFormattedValue = `${sFormattedValue.substring(0,2)}/${sFormattedValue.substring(2)}`;
			}
			if (sFormattedValue.length > 5) {
				sFormattedValue = `${sFormattedValue.substring(0,5)}/${sFormattedValue.substring(5,9)}`;
			}
			sFormattedValue = sFormattedValue.substring(0, 10);

			oSource.setValue(sFormattedValue);
			oDetailFormModel.setProperty("/currentReceipt/date", sFormattedValue);
		},

		onRemoveReceiptFile: function () {
			MessageBox.confirm(
				`${this.getResourceBundle().getText("removeFile")}?`,
				{
					title: "Confirm File Removal",
					onClose: (sAction) => {
						if (sAction !== MessageBox.Action.OK) return;
						
						this._setCurrentReceiptProperties({
							fileName: null,
							fileData: null,
							fileType: null
						});
						
						MessageToast.show(this.getResourceBundle().getText("fileRemoved"));
					}
				}
			);
		},

		onSaveReceipt: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			const oCurrentReceipt = oDetailFormModel.getProperty("/currentReceipt");
			const oReceiptsModel = this._getMainView().getModel("receipts");
			const aReceipts = oReceiptsModel.getProperty("/receipts") || [];

			if (oCurrentReceipt.date) {
				oCurrentReceipt.date = this.formatDate(oCurrentReceipt.date);
			}

			if (!oCurrentReceipt.amount || parseFloat(oCurrentReceipt.amount) <= 0) {
				MessageBox.error("Please enter a valid amount");
				return;
			}
			
			if (oCurrentReceipt.isNew) {
				aReceipts.push(oCurrentReceipt);
			} else {
				aReceipts[oCurrentReceipt.originalIndex] = oCurrentReceipt;
			}

			oReceiptsModel.setProperty("/receipts", aReceipts);
			oDetailFormModel.setProperty("/showReceiptEditor", false);
		},

		onUploadReceiptFile: function () {
			const oFileInput = document.getElementById("receiptFileInput");
			if (!oFileInput) return;
			
			oFileInput.click();
			oFileInput.onchange = (event) => this._handleFileUpload(event);
		},

		onViewReceiptFile: function (oEvent) {
			const oReceipt = oEvent.getSource().getBindingContext("receipts").getObject();
			
			if (!oReceipt.fileName || !oReceipt.fileData) {
				MessageBox.information(this.getResourceBundle().getText("noFileAttached"));
				return;
			}
			
			this._viewReceiptFile(oReceipt);
		},

		onViewReceiptFileInEditor: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			const oCurrentReceipt = oDetailFormModel.getProperty("/currentReceipt");
			
			if (!oCurrentReceipt.fileName || !oCurrentReceipt.fileData) {
				MessageBox.information(this.getResourceBundle().getText("noFileAttached"));
				return;
			}
			
			this._viewReceiptFile(oCurrentReceipt);
		},

		_cleanupReceiptInputListeners: function() {
			if (!this._receiptInputListener) return;
			
			const oInput = this.byId("receiptAmountInput");
			if (!oInput) return;
			
			const oDomRef = oInput.getDomRef("inner");
			if (!oDomRef) return;
			
			oDomRef.removeEventListener("click", this._receiptInputListener);
			oDomRef.removeEventListener("focus", this._receiptInputListener);
			oDomRef.removeEventListener("keyup", this._receiptInputListener);
			this._receiptInputListener = null;
		},

		_closeDetailDialog: function() {
			this._resetDetailFormState();
			if (!this._oDialog) return;
			this._oDialog.close();
		},

		_createBlobFromBase64: function(base64Data, fileType) {
			const byteCharacters = atob(base64Data);
			const byteNumbers = new Array(byteCharacters.length);
			
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			
			return new Blob([new Uint8Array(byteNumbers)], { type: fileType });
		},

		_createDownloadLink: function(base64Data, fileName, fileType) {
			const blob = this._createBlobFromBase64(base64Data, fileType);
			const fileURL = URL.createObjectURL(blob);
			
			const downloadLink = document.createElement('a');
			downloadLink.href = fileURL;
			downloadLink.download = fileName;
			document.body.appendChild(downloadLink);
			downloadLink.click();
			document.body.removeChild(downloadLink);
			
			setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
		},

		_createReceiptsForStudent: function (iStudentId, aReceipts) {
			return Promise.all(aReceipts.map(receipt => this._createSingleReceipt(iStudentId, receipt)));
		},

		_createSingleReceipt: function (iStudentId, receipt) {
			return new Promise((resolve, reject) => {
				const receiptData = {
					studentId: iStudentId,
					amount: parseFloat(receipt.amount)
				};
				
				if (receipt.fileData && receipt.fileName) {
					receiptData.content = receipt.fileData.includes(',') ? 
						receipt.fileData.split(',')[1] : 
						receipt.fileData;
				}
				
				fetch("/odata/v4/api/uploadReceipt", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify(receiptData)
				}).then(response => {
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}
					return response.json();
				}).then(resolve).catch(reject);
			});
		},

		_createStudentFromDetail: function (oStudentData, oResourceBundle) {
			const oModel = this._getMainView().getModel();
			const oReceiptsModel = this._getMainView().getModel("receipts");
			const aReceipts = oReceiptsModel ? oReceiptsModel.getProperty("/receipts") : [];
			
			const oNewStudentData = Object.assign({}, oStudentData);
			delete oNewStudentData.ID;
			
			const oBinding = oModel.bindList("/Students");
			const oContext = oBinding.create(oNewStudentData);
			
			oContext.created().then(() => {
				const iStudentId = oContext.getObject().ID;
				
				if (aReceipts && aReceipts.length > 0) {
					this._createReceiptsForStudent(iStudentId, aReceipts).then(() => {
						this._showSuccessAndClose(oResourceBundle.getText("studentSaved"));
					}).catch((error) => {
						MessageBox.error(`Student created but error with receipts: ${error.message}`);
						this._closeDetailDialog();
						if (this._getMainController()) {
							this._getMainController()._refreshTable();
						}
					});
					return;
				}
				
				this._showSuccessAndClose(oResourceBundle.getText("studentSaved"));
			}).catch((oError) => {
				MessageBox.error(`Error creating student: ${oError.message || "Unknown error"}`);
			});
		},

		_displayFile: function (oReceipt) {
			if (!oReceipt.fileData) {
				MessageBox.error(this.getResourceBundle().getText("fileViewError"));
				return;
			}
			
			const base64Data = oReceipt.fileData.split(',')[1];
			const blob = this._createBlobFromBase64(base64Data, oReceipt.fileType);
			const fileURL = URL.createObjectURL(blob);
			
			if (!window.open(fileURL, '_blank')) {
				this._downloadReceiptFile(oReceipt);
			} else {
				setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
			}
		},

		_downloadReceiptFile: function (oReceipt) {
			if (oReceipt.fileData) {
				const base64Data = oReceipt.fileData.split(',')[1];
				this._createDownloadLink(base64Data, oReceipt.fileName, oReceipt.fileType);
				return;
			}
			
			if (oReceipt.file || oReceipt.fileName) {
				this._loadAndDownloadFileFromServer(oReceipt);
				return;
			}
			
			MessageBox.error("No file available for download");
		},

		_getDisplayValue: function (sRawValue) {
			const iRawLength = sRawValue.length;
			
			switch (true) {
				case iRawLength === 1:
					return `0.0${sRawValue}`;
				case iRawLength === 2:
					return `0.${sRawValue}`;
				default: {
					const sIntegerPart = parseInt(sRawValue.slice(0, -2), 10).toString();
					const sDecimalPart = sRawValue.slice(-2);
					return `${sIntegerPart}.${sDecimalPart}`;
				}
			}
		},

		_getMainController: function() {
			return this._mainController;
		},

		_getMainView: function() {
			return this._mainView || this.getView();
		},

		_handleFileUpload: function (event) {
			const file = event.target.files[0];
			if (!file) return;
			
			if (file.size > 10 * 1024 * 1024) {
				MessageBox.error("File size must be less than 10MB");
				return;
			}
			
			if (!this.ALLOWED_FILE_TYPES.includes(file.type)) {
				MessageBox.error("Only PDF, DOC, DOCX, and image files are allowed");
				return;
			}
			
			const reader = new FileReader();
			reader.onload = (e) => {
				this._setCurrentReceiptProperties({
					fileName: file.name,
					fileData: e.target.result,
					fileType: file.type
				});
				
				MessageToast.show(this.getResourceBundle().getText("fileUploaded"));
				event.target.value = '';
			};
			
			reader.onerror = () => MessageBox.error("Error reading file");
			reader.readAsDataURL(file);
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
			const serverFileName = oReceipt.file || oReceipt.fileName;
			
			if (!serverFileName) {
				MessageBox.error("File not found");
				return;
			}
			
			const oModel = this._getMainView().getModel();
			const mParameters = {
				success: (data) => {
					const receiptWithData = {
						...oReceipt,
						fileData: `data:${data.mimeType || 'application/octet-stream'};base64,${data.fileContent}`,
						fileType: data.mimeType || 'application/octet-stream'
					};
					
					this._displayFile(receiptWithData);
				},
				error: (error) => {
					MessageBox.error(`Error loading file: ${error.message || "File not found"}`);
				}
			};
			
			oModel.callFunction("/downloadReceiptFile", {
				urlParameters: { fileName: serverFileName },
				...mParameters
			});
		},

		_loadAndDownloadFileFromServer: function (oReceipt) {
			const serverFileName = oReceipt.file || oReceipt.fileName;
			
			if (!serverFileName) {
				MessageBox.error("File not found");
				return;
			}
			
			const oModel = this._getMainView().getModel();
			const mParameters = {
				success: (data) => {
					this._createDownloadLink(data.fileContent, oReceipt.fileName || serverFileName, data.mimeType);
				},
				error: (error) => {
					MessageBox.error(`Error loading file: ${error.message || "File not found"}`);
				}
			};
			
			oModel.callFunction("/downloadReceiptFile", {
				urlParameters: { fileName: serverFileName },
				...mParameters
			});
		},

		_prepareDetailForm: function (bIsNew, oStudent) {
			const oModel = this._getMainView().getModel("detailForm");
			
			oModel.setProperty("/isNewStudent", bIsNew);
			oModel.setProperty("/title", bIsNew ? "Add New Student" : "Edit Student");
			oModel.setProperty("/saveButtonText", "Save");
			oModel.setProperty("/student", bIsNew ? this.EMPTY_STUDENT_MODEL : oStudent);

			if (bIsNew || !oStudent || !oStudent.ID) {
				this._getMainView().setModel(new JSONModel(this.EMPTY_RECEIPTS_MODEL), "receipts");
				return;
			}

			fetch(`/odata/v4/api/Students(${oStudent.ID})/receipts`)
				.then(response => response.json())
				.then(data => {
					const receipts = data.value || [];
					
					receipts.forEach(receipt => {
						receipt.fileName = receipt.file || null;
						receipt.hasFile = !!receipt.file;
					});
					
					this._getMainView().setModel(new JSONModel({ receipts: receipts }), "receipts");
				})
				.catch(() => {
					this._getMainView().setModel(new JSONModel(this.EMPTY_RECEIPTS_MODEL), "receipts");
				});
		},

		_resetDetailFormState: function () {
			this._cleanupReceiptInputListeners();
			
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			oDetailFormModel.setProperty("/showReceiptEditor", false);
			oDetailFormModel.setProperty("/currentReceipt", { ...this.DEFAULT_RECEIPT_STATE });

			this._receiptAmountRaw = "0";
		},

		_setCursorToEnd: function(oSource) {
			setTimeout(() => {
				if (!oSource || !oSource.getDomRef) return;
				
				const oDomRef = oSource.getDomRef("inner");
				if (!oDomRef) return;
				
				oDomRef.setSelectionRange(oDomRef.value.length, oDomRef.value.length);
			}, 0);
		},

		_setCurrentReceiptProperties: function(properties) {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			Object.keys(properties).forEach(key => {
				oDetailFormModel.setProperty(`/currentReceipt/${key}`, properties[key]);
			});
		},

		_setupReceiptAmountCursorBehavior: function () {
			const oInput = this.byId("receiptAmountInput");
			if (!oInput) return;
			
			const oDomRef = oInput.getDomRef("inner");
			if (!oDomRef) return;
			
			if (this._receiptInputListener) {
				oDomRef.removeEventListener("click", this._receiptInputListener);
				oDomRef.removeEventListener("focus", this._receiptInputListener);
				oDomRef.removeEventListener("keyup", this._receiptInputListener);
			}
			
			this._receiptInputListener = () => {
				setTimeout(() => {
					if (!oInput || !oInput.getDomRef) return;
					
					const domRef = oInput.getDomRef("inner");
					if (!domRef) return;
					
					domRef.setSelectionRange(domRef.value.length, domRef.value.length);
				}, 0);
			};
			
			oDomRef.addEventListener("click", this._receiptInputListener);
			oDomRef.addEventListener("focus", this._receiptInputListener);
			oDomRef.addEventListener("keyup", this._receiptInputListener);
		},

		_showSuccessAndClose: function(message) {
			MessageToast.show(message);
			this._closeDetailDialog();
			if (!this._getMainController()) return;
			this._getMainController()._refreshTable();
		},

		_updateReceiptSortIcons: function (sSortProperty, bDescending) {
			const aIconIds = ["sortIconReceiptAmount", "sortIconReceiptDate"];
			aIconIds.forEach(sIconId => {
				const oIcon = this.byId(sIconId);
				if (oIcon) oIcon.setVisible(false);
			});

			const sSortIconId = sSortProperty === "amount" ? "sortIconReceiptAmount" : "sortIconReceiptDate";
			const oSortIcon = this.byId(sSortIconId);
			if (!oSortIcon) return;
			
			oSortIcon.setVisible(true);
			oSortIcon.setSrc(bDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
		},

		_updateReceiptsForStudent: function (iStudentId, aReceipts) {
			return fetch(`/odata/v4/api/Students(${iStudentId})/receipts`, {
				method: 'DELETE'
			}).then(() => this._createReceiptsForStudent(iStudentId, aReceipts));
		},

		_updateStudentFromDetail: function (oStudentData, oResourceBundle) {
			const oModel = this._getMainView().getModel();
			const oReceiptsModel = this._getMainView().getModel("receipts");
			const aReceipts = oReceiptsModel.getProperty("/receipts") || [];
			
			if (!this._getMainController()) return;
			
			const oTable = this._getMainController().byId("studentsTable");
			const oBinding = oTable.getBinding("items");
			const aContexts = oBinding.getContexts();
			const oContext = aContexts.find(ctx => {
				const studentObj = ctx.getObject();
				return studentObj && studentObj.ID === oStudentData.ID;
			});
			
			if (!oContext) {
				MessageBox.error("Student not found for update");
				return;
			}
			
			Object.keys(oStudentData).forEach(key => {
				if (key !== 'ID' && key !== 'receipts') {
					oContext.setProperty(key, oStudentData[key]);
				}
			});
			
			oModel.submitBatch().then(() => {
				if (aReceipts.length > 0) {
					this._updateReceiptsForStudent(oStudentData.ID, aReceipts).then(() => {
						this._showSuccessAndClose(oResourceBundle.getText("studentUpdated"));
					}).catch((error) => {
						MessageBox.error(`Student updated but error with receipts: ${error.message}`);
						this._closeDetailDialog();
						if (this._getMainController()) {
							this._getMainController()._refreshTable();
						}
					});
					return;
				}
				
				this._showSuccessAndClose(oResourceBundle.getText("studentUpdated"));
			}).catch((oError) => {
				MessageBox.error(`Error updating student: ${oError.message || "Unknown error"}`);
			});
		},

		_viewReceiptFile: function (oReceipt) {
			if (oReceipt.fileData) {
				this._displayFile(oReceipt);
				return;
			}
			
			if (oReceipt.fileName && !oReceipt.fileData) {
				this._loadAndDisplayFileFromServer(oReceipt);
				return;
			}
			
			MessageBox.error(this.getResourceBundle().getText("fileViewError"));
		},

		formatDate: function (dateValue) {
			if (!dateValue) return "";

			if (dateValue instanceof Date) {
				const day = String(dateValue.getDate()).padStart(2, '0');
				const month = String(dateValue.getMonth() + 1).padStart(2, '0');
				const year = dateValue.getFullYear();
				return `${day}/${month}/${year}`;
			}

			if (typeof dateValue === "string" && dateValue.includes("-")) {
				const parts = dateValue.split("-");
				if (parts.length === 3) {
					const [year, month, day] = parts;
					return `${day}/${month}/${year}`;
				}
			}
			
			return String(dateValue);
		},

		setDialog: function(oDialog) {
			this._oDialog = oDialog;
		},

		setMainController: function(oController) {
			this._mainController = oController;
		},

		setMainView: function(oView) {
			this._mainView = oView;
			
			if (!this._detailFormModel) return;
			
			this._mainView.setModel(this._detailFormModel, "detailForm");
			this._detailFormModel = null;
		},

		openDialog: function(bIsNew, oStudent) {
			this._prepareDetailForm(bIsNew, oStudent);
			if (this._oDialog) {
				this._oDialog.open();
			}
		},

		formatBalance: function (balance) {
			if (!balance && balance !== 0) {
				return "";
			}
			
			const sLocale = sap.ui.getCore().getConfiguration().getLanguage();
			const formattedNumber = parseFloat(balance).toFixed(2);
			
			if (sLocale === "pt" || sLocale === "pt-BR") {
				return "R$ " + formattedNumber.replace(".", ",");
			} else {
				return "$ " + formattedNumber;
			}
		}
	});
});
