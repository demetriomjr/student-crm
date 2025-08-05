sap.ui.define([
   "student/crm/ui/controller/BaseController",
   "sap/m/MessageBox",
   "sap/m/MessageToast",
   "sap/ui/model/json/JSONModel",
   "student/crm/ui/model/formatter"
], function (BaseController, MessageBox, MessageToast, JSONModel, formatter) {
	"use strict";
	return BaseController.extend("student.crm.ui.controller.StudentsDetail", {

	formatter: formatter,

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
			this._cleanupUploadedFiles().then(() => {
				this._closeDetailDialog();
			});
		},

		onSaveStudent: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			const oStudentData = oDetailFormModel.getProperty("/student");
			const bIsNew = oDetailFormModel.getProperty("/isNewStudent");
			
			let oResourceBundle;
			try {
				oResourceBundle = this.getResourceBundle();
			} catch {
				oResourceBundle = null;
			}
			
			if (!oStudentData || !oStudentData.fullname || !oStudentData.email) {
				MessageBox.error("Please fill in all required fields.");
				return;
			}

			if (bIsNew) {
				this._createStudentFromDetail(oStudentData, oResourceBundle);
				return;
			}
			this._updateStudentFromDetail(oStudentData, oResourceBundle);
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
						const aReceipts = this._getReceiptsFromModel();
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
			const aReceipts = this._getReceiptsFromModel();

			const bDescending = this._currentReceiptSortProperty === sSortProperty ? !this._currentReceiptSortDescending : false;

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
			const sFormattedDate = formatter.formatDateInput(oSource.getValue());

			oSource.setValue(sFormattedDate);
			oDetailFormModel.setProperty("/currentReceipt/date", sFormattedDate);
		},

		onReceiptDateChange: function (oEvent) {
			const sValue = oEvent.getParameter("newValue");
			const oSource = oEvent.getSource();
			const oDetailFormModel = this.getView().getModel("detailForm");

			const sFormattedValue = formatter.formatDateInput(sValue);

			oSource.setValue(sFormattedValue);
			oDetailFormModel.setProperty("/currentReceipt/date", sFormattedValue);
		},

		onRemoveReceiptFile: function () {
			const removeFileText = this._getResourceText("removeFile", "Remove file");
			MessageBox.confirm(
				`${removeFileText}?`,
				{
					title: "Confirm File Removal",
					onClose: (sAction) => {
						if (sAction !== MessageBox.Action.OK) return;
						
						this._setCurrentReceiptProperties({
							fileName: null,
							fileData: null,
							fileType: null
						});
						
						const fileRemovedText = this._getResourceText("fileRemoved", "File removed successfully");
						MessageToast.show(fileRemovedText);
					}
				}
			);
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
				MessageBox.error("Please enter a valid amount");
				return;
			}

			if (oCurrentReceipt.fileData && !oCurrentReceipt.uploadedFileName) {
				MessageToast.show("Uploading file...");
				
				this._uploadFileToServer(oCurrentReceipt).then((uploadedFileName) => {
					if (!oCurrentReceipt.isNew && oCurrentReceipt.originalFile && oCurrentReceipt.originalFile !== uploadedFileName) {
						oCurrentReceipt.oldFileToDelete = oCurrentReceipt.originalFile;
					}
					
					oCurrentReceipt.uploadedFileName = uploadedFileName;
					oCurrentReceipt.fileData = null;
					this._saveReceiptToClientModel(oCurrentReceipt, aReceipts, oReceiptsModel, oDetailFormModel);
					MessageToast.show("File uploaded successfully");
				}).catch((error) => {
					MessageBox.error(`File upload failed: ${error.message}`);
				});
				return;
			}
			this._saveReceiptToClientModel(oCurrentReceipt, aReceipts, oReceiptsModel, oDetailFormModel);
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
				const noFileText = this._getResourceText("noFileAttached", "No file attached");
				MessageBox.information(noFileText);
				return;
			}
			
			this._viewReceiptFile(oReceipt);
		},

		onViewReceiptFileInEditor: function () {
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			const oCurrentReceipt = oDetailFormModel.getProperty("/currentReceipt");
			
			if (!oCurrentReceipt.fileName || !oCurrentReceipt.fileData) {
				const noFileText = this._getResourceText("noFileAttached", "No file attached");
				MessageBox.information(noFileText);
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
			this._cleanupReceiptInputListeners();
			
			const oDetailFormModel = this._getMainView().getModel("detailForm");
			oDetailFormModel.setProperty("/showReceiptEditor", false);
			oDetailFormModel.setProperty("/currentReceipt", { ...this.DEFAULT_RECEIPT_STATE });

			this._receiptAmountRaw = "0";
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
				
				if (receipt.fileData) {
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

		_uploadFileToServer: function(receipt) {
			return new Promise((resolve, reject) => {
				if (!receipt.fileData) {
					reject(new Error("No file data to upload"));
					return;
				}

				const base64Data = receipt.fileData.split(',')[1];

				fetch("/odata/v4/api/uploadReceipt", {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						content: base64Data
					})
				})
				.then(response => {
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}
					return response.json();
				})
				.then(data => {
					if (!data.filePath) {
						reject(new Error("No file path returned from server"));
						return;
					}
					resolve(data.filePath);
				})
				.catch(reject);
			});
		},

		_saveReceiptToClientModel: function(oCurrentReceipt, aReceipts, oReceiptsModel, oDetailFormModel) {
			if (oCurrentReceipt.isNew) {
				aReceipts.push(oCurrentReceipt);
			} else {
				aReceipts[oCurrentReceipt.originalIndex] = oCurrentReceipt;
			}

			oReceiptsModel.setProperty("/receipts", aReceipts);
			oDetailFormModel.setProperty("/showReceiptEditor", false);
		},

		_cleanupUploadedFiles: function() {
			const aReceipts = this._getReceiptsFromModel();
			
			const filesToDelete = [];
			
			aReceipts.forEach(receipt => {
				if (receipt.uploadedFileName) {
					filesToDelete.push(receipt.uploadedFileName);
				}
				if (receipt.oldFileToDelete) {
					filesToDelete.push(receipt.oldFileToDelete);
				}
			});

			const deletePromises = filesToDelete.map(fileName => this._deleteFileFromServer(fileName));
			
			return Promise.all(deletePromises).catch(error => {
				console.error("Error cleaning up files:", error);
			});
		},

		_deleteFileFromServer: function(fileName) {
			if (!fileName) return Promise.resolve();

			return fetch("/odata/v4/api/deleteReceipt", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ fileName: fileName })
			}).then(response => {
				if (!response.ok) {
					console.error(`Failed to delete file ${fileName}: ${response.statusText}`);
				}
				return response.json();
			}).catch(error => {
				console.error(`Error deleting file ${fileName}:`, error);
			});
		},

		_createStudentFromDetail: function (oStudentData, oResourceBundle) {
			const oModel = this._getMainView().getModel();
			const aReceipts = this._getReceiptsFromModel();
			
			if (!aReceipts || aReceipts.length === 0) {
				const oNewStudentData = Object.assign({}, oStudentData);
				delete oNewStudentData.ID;
				
				const oBinding = oModel.bindList("/Students");
				const oContext = oBinding.create(oNewStudentData);
				
				oContext.created().then(() => {
					const message = oResourceBundle ? oResourceBundle.getText("studentSaved") : "Student saved successfully";
					this._showSuccessAndClose(message);
				}).catch((oError) => {
					MessageBox.error(`Error creating student: ${oError.message || "Unknown error"}`);
				});
				return;
			}

			this._createReceiptsInDatabase(aReceipts).then(() => {
				const oNewStudentData = Object.assign({}, oStudentData);
				delete oNewStudentData.ID;
				
				const oBinding = oModel.bindList("/Students");
				const oContext = oBinding.create(oNewStudentData);
				
				return oContext.created();
			}).then(() => {
				const message = oResourceBundle ? oResourceBundle.getText("studentSaved") : "Student saved successfully";
				this._showSuccessAndClose(message);
				this._cleanupOldFiles(aReceipts);
			}).catch((error) => {
				MessageBox.error(`Error creating student: ${error.message || "Unknown error"}`);
				this._cleanupUploadedFiles();
			});
		},

		_createReceiptsInDatabase: function(aReceipts) {
			const createPromises = aReceipts.map(receipt => {
				return new Promise((resolve, reject) => {
					const receiptData = {
						amount: parseFloat(receipt.amount),
						date: receipt.date,
						file: receipt.uploadedFileName || null
					};
					
					const oModel = this._getMainView().getModel();
					const oBinding = oModel.bindList("/Receipts");
					const oContext = oBinding.create(receiptData);
					
					oContext.created().then(resolve).catch(reject);
				});
			});
			
			return Promise.all(createPromises);
		},

		_cleanupOldFiles: function(aReceipts) {
			const filesToDelete = [];
			
			aReceipts.forEach(receipt => {
				if (receipt.oldFileToDelete) {
					filesToDelete.push(receipt.oldFileToDelete);
				}
			});

			if (filesToDelete.length === 0) return;

			filesToDelete.forEach(fileName => {
				this._deleteFileFromServer(fileName).then(() => {
					console.log(`Old file ${fileName} deleted successfully`);
				}).catch(error => {
					console.error(`Failed to delete old file ${fileName}:`, error);
				});
			});
		},

		_displayFile: function (oReceipt) {
			if (!oReceipt.fileData) {
				const fileViewErrorText = this._getResourceText("fileViewError", "Error viewing file");
				MessageBox.error(fileViewErrorText);
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

		_getReceiptsFromModel: function() {
			const oReceiptsModel = this._getMainView().getModel("receipts");
			return oReceiptsModel ? oReceiptsModel.getProperty("/receipts") || [] : [];
		},

		_getServerFileName: function(oReceipt) {
			return oReceipt.file || oReceipt.fileName;
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
				
				const fileUploadedText = this._getResourceText("fileUploaded", "File uploaded successfully");
				MessageToast.show(fileUploadedText);
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
			const serverFileName = this._getServerFileName(oReceipt);
			
			if (!serverFileName) {
				MessageBox.error("File not found");
				return;
			}
			
			fetch("/odata/v4/api/downloadReceipt", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ fileName: serverFileName })
			})
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				return response.json();
			})
			.then(data => {
				const receiptWithData = {
					...oReceipt,
					fileData: `data:${data.mimeType || 'application/octet-stream'};base64,${data.fileContent}`,
					fileType: data.mimeType || 'application/octet-stream'
				};
				
				this._displayFile(receiptWithData);
			})
			.catch(error => {
				MessageBox.error(`Error loading file: ${error.message || "File not found"}`);
			});
		},

		_loadAndDownloadFileFromServer: function (oReceipt) {
			const serverFileName = this._getServerFileName(oReceipt);
			
			if (!serverFileName) {
				MessageBox.error("File not found");
				return;
			}
			
			fetch("/odata/v4/api/downloadReceipt", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ fileName: serverFileName })
			})
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
				return response.json();
			})
			.then(data => {
				this._createDownloadLink(data.fileContent, oReceipt.fileName || serverFileName, data.mimeType);
			})
			.catch(error => {
				MessageBox.error(`Error loading file: ${error.message || "File not found"}`);
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
			const aReceipts = this._getReceiptsFromModel();
			
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

			setTimeout(() => {
				if (aReceipts.length > 0) {
					this._updateReceiptsForStudent(oStudentData.ID, aReceipts).then(() => {
						const message = oResourceBundle ? oResourceBundle.getText("studentUpdated") : "Student updated successfully";
						this._showSuccessAndClose(message);
						this._cleanupOldFiles(aReceipts);
					}).catch((error) => {
						MessageBox.error(`Student updated but error with receipts: ${error.message}`);
						this._closeDetailDialog();
						if (this._getMainController()) {
							this._getMainController()._refreshTable();
						}
					});
					return;
				}
				
				const message = oResourceBundle ? oResourceBundle.getText("studentUpdated") : "Student updated successfully";
				this._showSuccessAndClose(message);
			}, 100);
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
			
			const fileViewErrorText = this._getResourceText("fileViewError", "Error viewing file");
			MessageBox.error(fileViewErrorText);
		},

		_getResourceText: function(sKey, sDefault) {
			try {
				const oResourceBundle = this.getResourceBundle();
				return oResourceBundle ? oResourceBundle.getText(sKey) : sDefault;
			} catch {
				return sDefault;
			}
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
		}
	});
});
