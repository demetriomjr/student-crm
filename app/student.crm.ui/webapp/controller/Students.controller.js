sap.ui.define([
   "student/crm/ui/controller/BaseController",
   "sap/m/MessageBox",
   "sap/m/MessageToast",
   "sap/ui/model/Filter",
   "sap/ui/model/FilterOperator",
   "sap/ui/model/Sorter",
   "sap/ui/model/json/JSONModel",
   "student/crm/ui/model/formatter"
], function (BaseController, MessageBox, MessageToast, Filter, FilterOperator, Sorter, JSONModel, formatter) {
	"use strict";

	return BaseController.extend("student.crm.ui.controller.Students", {

	formatter: formatter,

	TABLE_ID: "studentsTable",
	SEARCH_FIELD_ID: "searchField",
	
	MODEL_NAMES: {
		FILTER: "filter",
		PAGINATION: "pagination", 
		RECEIPTS: "receipts",
		I18N: "i18n"
	},

	SORT_ICON_IDS: {
		STUDENTS: ["sortIconID", "sortIconFullName", "sortIconEmail", "sortIconBalance", "sortIconLastPayment"],
		RECEIPTS: ["sortIconReceiptAmount", "sortIconReceiptDate"]
	},

	INPUT_IDS: {
		ID_FROM: "idFromInput",
		ID_TO: "idToInput", 
		NAME_FILTER: "nameFilterInput",
		BALANCE_FROM: "balanceFromInput",
		BALANCE_TO: "balanceToInput",
		DATE_FROM: "dateFromInput",
		DATE_TO: "dateToInput"
	},

	DEFAULT_FILTER_STATE: {
		idFrom: "",
		idTo: "",
		email: "",
		balanceFrom: "0.00",
		balanceTo: "0.00",
		dateFrom: null,
		dateTo: null,
		searchQuery: ""
	},

	DEFAULT_PAGINATION_STATE: {
		currentPage: 1,
		totalPages: 1,
		hasPrevious: false,
		hasNext: false,
		totalItems: 0
	},

		onInit: function () {
			this._currentSortProperty = null;
			this._currentSortDescending = false;
			this._currentReceiptSortProperty = null;
			this._currentReceiptSortDescending = false;
			this._initializeFilterModel();
			this._initializePaginationModel();
			this._checkAuthentication();
		},

		onExit: function () {
			if (!this._filterTimeout) return;
			clearTimeout(this._filterTimeout);
		},

		_getApiBaseUrl: function () {
			const oModel = this.getModel();
			if (oModel && oModel.sServiceUrl) {
				const sServiceUrl = oModel.sServiceUrl.replace(/\/$/, '');
				
				if (!sServiceUrl.startsWith('/')) return sServiceUrl;
				
				const sCurrentOrigin = window.location.origin;
				const sBackendOrigin = sCurrentOrigin.includes(':8080') ? 
					sCurrentOrigin.replace(':8080', ':4004') : sCurrentOrigin;
				return sBackendOrigin + sServiceUrl;
			}
			
			const oManifest = this.getOwnerComponent().getManifest();
			const sDataSourceUri = oManifest["sap.app"].dataSources.mainService.uri;
			const sCurrentOrigin = window.location.origin;
			const sBackendOrigin = sCurrentOrigin.includes(':8080') ?
				sCurrentOrigin.replace(':8080', ':4004') : sCurrentOrigin;
			
			return sBackendOrigin + sDataSourceUri.replace(/\/$/, '');
		},

		_getStudentsApiUrl: function () {
			return `${this._getApiBaseUrl()}/Students?$count=true`;
		},



		_initializeFilterModel: function () {
			this.getView().setModel(new JSONModel({
				filters: { ...this.DEFAULT_FILTER_STATE }
			}), this.MODEL_NAMES.FILTER);
			this._balanceFromRaw = "0";
			this._balanceToRaw = "0";
			this._previousFilters = { ...this.DEFAULT_FILTER_STATE };
		},

		_initializePaginationModel: function () {
			this._pageSize = 10;
			this.getView().setModel(new JSONModel({ ...this.DEFAULT_PAGINATION_STATE }), this.MODEL_NAMES.PAGINATION);
		},

		_fetchTotalCount: function() {
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			const hasFilters = oBinding.getFilters() && oBinding.getFilters().length > 0;
			
			if (hasFilters) {
				oBinding.requestContexts(0, 1000).then((aAllContexts) => {
					const filteredCount = aAllContexts ? aAllContexts.length : 0;
					this._updatePaginationWithCount(filteredCount);
				}).catch(() => {
				});
				return;
			}
			fetch(this._getStudentsApiUrl())
				.then(response => response.json())
				.then(data => {
					const totalCount = data.value ? data.value.length : 0;
					const actualCount = data["@odata.count"] || totalCount;
					this._updatePaginationWithCount(actualCount || totalCount);
				})
				.catch(() => {
					const oModel = this.getModel();
					if (oModel) {
						oModel.read("/Students", {
							success: (data) => {
								const totalCount = data.results ? data.results.length : 0;
								this._updatePaginationWithCount(totalCount);
							},
							error: () => {
							}
						});
					}
				});
		},

		_updatePaginationWithCount: function(totalCount) {
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const currentPage = oPaginationModel.getProperty("/currentPage") || 1;
			const totalPages = Math.max(1, Math.ceil(totalCount / this._pageSize));
			oPaginationModel.setProperty("/totalItems", totalCount);
			oPaginationModel.setProperty("/totalPages", totalPages);
			oPaginationModel.setProperty("/hasPrevious", currentPage > 1);
			oPaginationModel.setProperty("/hasNext", currentPage < totalPages);
		},

		_updateCountAfterFilter: function() {
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			if (!oBinding) return;
			setTimeout(() => {
				this._updateCountFromBinding(oBinding);
			}, 300);
		},

		_checkAuthentication: function () {
			const isLoggedIn = sessionStorage.getItem("isLoggedIn");
			if (!isLoggedIn || isLoggedIn !== "true") {
				this.navTo("main");
				return false;
			}
			setTimeout(() => {
				this._initializePagination();
			}, 100);
			return true;
		},

		_initializePagination: function () {
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			if (!oBinding) {
				setTimeout(() => {
					this._initializePagination();
				}, 200);
				return;
			}
			oBinding.changeParameters({
				"$skip": 0,
				"$top": this._pageSize,
				"$count": true
			});
			this._bindToCount(oBinding);
		},

		_bindToCount: function(oBinding) {
			oBinding.attachChange(() => {
				this._updateCountFromBinding(oBinding);
			});
			oBinding.attachDataReceived(() => {
				this._updateCountFromBinding(oBinding);
			});
			setTimeout(() => {
				this._updateCountFromBinding(oBinding);
			}, 100);
		},

		_updateCountFromBinding: function(oBinding) {
			let totalCount = 0;
			if (typeof oBinding.getCount === 'function') {
				totalCount = oBinding.getCount();
			}
			if (totalCount === 0 && oBinding.getHeaderContext) {
				try {
					const oHeaderContext = oBinding.getHeaderContext();
					if (!oHeaderContext || !oHeaderContext.getProperty) return;
					totalCount = oHeaderContext.getProperty("$count") || 0;
				} catch (error) {
					console.warn("Error getting header context:", error);
				}
			}
			if (totalCount === 0 && typeof oBinding.getLength === 'function') {
				totalCount = oBinding.getLength() || 0;
			}
			if (totalCount === 0) {
				const aContexts = oBinding.getContexts();
				if (!aContexts || !Array.isArray(aContexts)) return;
				totalCount = aContexts.length;
			}
			if (totalCount < 0) return;
			this._updatePaginationWithCount(totalCount);
		},
		
		onSearch: function (oEvent) {
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			const sQuery = oEvent.getParameter("newValue");

			if (!sQuery || sQuery.length === 0) {
				oBinding.filter([]);
				this._goToPage(1);
				this._updateCountAfterFilter();
				return;
			}

			oBinding.filter(new Filter({
				filters: [
					new Filter("fullname", FilterOperator.Contains, sQuery),
					new Filter("email", FilterOperator.Contains, sQuery)
				],
				and: false
			}));
			this._goToPage(1);
			this._updateCountAfterFilter();
		},

		onColumnSort: function (oEvent) {
			const sSortProperty = oEvent.getSource().data("sortProperty");
			const bDescending = this._currentSortProperty === sSortProperty ? 
				!this._currentSortDescending : false;
			
			this._currentSortProperty = sSortProperty;
			this._currentSortDescending = bDescending;
			
			this.byId(this.TABLE_ID).getBinding("items").sort(new Sorter(sSortProperty, bDescending));
			this._updateSortIcons(sSortProperty, bDescending);
		},

		_updateSortIcons: function (sSortProperty, bDescending) {
			this.SORT_ICON_IDS.STUDENTS.forEach(sIconId => {
				const oIcon = this.byId(sIconId);
				if (!oIcon) return;
				oIcon.setVisible(false);
			});

			const iconMap = {
				"ID": "sortIconID",
				"fullname": "sortIconFullName", 
				"email": "sortIconEmail",
				"balance": "sortIconBalance",
				"lastPaymentAt": "sortIconLastPayment"
			};

			const sIconId = iconMap[sSortProperty];
			if (!sIconId) return;
			
			const oIcon = this.byId(sIconId);
			if (!oIcon) return;
			
			oIcon.setSrc(bDescending ? "sap-icon://navigation-down-arrow" : "sap-icon://navigation-up-arrow");
			oIcon.setVisible(true);
		},

		onReceiptColumnSort: function (oEvent) {
			const oReceiptsModel = this.getView().getModel(this.MODEL_NAMES.RECEIPTS);
			const sSortProperty = oEvent.getSource().data("sortProperty");
			const aReceipts = oReceiptsModel.getProperty("/receipts") || [];

			const bDescending = this._currentReceiptSortProperty === sSortProperty ?
				!this._currentReceiptSortDescending : false;

			this._currentReceiptSortProperty = sSortProperty;
			this._currentReceiptSortDescending = bDescending;

			const aSortedReceipts = [...aReceipts].sort((a, b) => {
				let valueA = a[sSortProperty];
				let valueB = b[sSortProperty];

				if (sSortProperty === "amount") {
					valueA = parseFloat(valueA) || 0;
					valueB = parseFloat(valueB) || 0;
				}

				if (sSortProperty === "date") {
					valueA = new Date(valueA);
					valueB = new Date(valueB);
				}

				if (valueA < valueB) return bDescending ? 1 : -1;
				if (valueA > valueB) return bDescending ? -1 : 1;
				return 0;
			});

			oReceiptsModel.setProperty("/receipts", aSortedReceipts);
			this._updateReceiptSortIcons(sSortProperty, bDescending);
		},

		_updateReceiptSortIcons: function (sSortProperty, bDescending) {
			this.SORT_ICON_IDS.RECEIPTS.forEach(sIconId => {
				const oIcon = this.byId(sIconId);
				if (!oIcon) return;
				oIcon.setVisible(false);
			});

			const iconMap = {
				"amount": "sortIconReceiptAmount",
				"date": "sortIconReceiptDate"
			};

			const sIconId = iconMap[sSortProperty];
			if (!sIconId) return;
			
			const oIcon = this.byId(sIconId);
			if (!oIcon) return;
			
			oIcon.setSrc(bDescending ? "sap-icon://navigation-down-arrow" : "sap-icon://navigation-up-arrow");
			oIcon.setVisible(true);
		},

		onFilterChange: function () {
			const oFilterModel = this.getView().getModel(this.MODEL_NAMES.FILTER);
			const oCurrentFilters = oFilterModel.getProperty("/filters");
			const sCurrentSearchQuery = this.byId(this.SEARCH_FIELD_ID) ? 
				this.byId(this.SEARCH_FIELD_ID).getValue() : "";
			
			const bNeedsImmediateUpdate = (
				(this._previousFilters.idFrom && !oCurrentFilters.idFrom) ||
				(this._previousFilters.idTo && !oCurrentFilters.idTo) ||
				(this._previousFilters.email && !oCurrentFilters.email) ||
				(this._previousFilters.balanceFrom !== "0.00" && oCurrentFilters.balanceFrom === "0.00") ||
				(this._previousFilters.balanceTo !== "0.00" && oCurrentFilters.balanceTo === "0.00") ||
				(this._previousFilters.dateFrom && !oCurrentFilters.dateFrom) ||
				(this._previousFilters.dateTo && !oCurrentFilters.dateTo) ||
				(this._previousFilters.searchQuery && !sCurrentSearchQuery)
			);
			
			if (this._filterTimeout) clearTimeout(this._filterTimeout);
			
			if (bNeedsImmediateUpdate) {
				this._applyAllFilters();
			} else {
				this._filterTimeout = setTimeout(() => this._applyAllFilters(), 500);
			}
		},

		onClearFilter: function () {
			this.getView().getModel(this.MODEL_NAMES.FILTER).setProperty("/filters", {
				...this.DEFAULT_FILTER_STATE,
				idFrom: null,
				idTo: null,
				dateFrom: "",
				dateTo: ""
			});
			
			const searchField = this.byId(this.SEARCH_FIELD_ID);
			if (!searchField) return;
			searchField.setValue("");
			
			const idFromField = this.byId(this.INPUT_IDS.ID_FROM);
			if (!idFromField) return;
			idFromField.setValue(null);
			
			const idToField = this.byId(this.INPUT_IDS.ID_TO);
			if (!idToField) return;
			idToField.setValue(null);
			
			[
				this.INPUT_IDS.NAME_FILTER, 
				this.INPUT_IDS.BALANCE_FROM, 
				this.INPUT_IDS.BALANCE_TO, 
				this.INPUT_IDS.DATE_FROM, 
				this.INPUT_IDS.DATE_TO
			].forEach(sInputId => {
				const oInput = this.byId(sInputId);
				if (!oInput) return;
				oInput.setValue("");
			});
			
			this._previousFilters = {
				...this.DEFAULT_FILTER_STATE,
				idFrom: null,
				idTo: null,
				dateFrom: "",
				dateTo: ""
			};
			
			this._applyAllFilters();
			MessageToast.show(this.getResourceBundle().getText("filtersCleared"));
		},

		onIdFilterChange: function (oEvent) {
			const sValue = oEvent.getParameter("newValue");
			const sCleanValue = sValue.replace(/[^0-9]/g, "");
			
			if (sValue === sCleanValue) {
				this.onFilterChange();
				return;
			}
			
			oEvent.getSource().setValue(sCleanValue);
			this.onFilterChange();
		},

		onNameFilterChange: function (oEvent) {
			const sValue = oEvent.getParameter("newValue");
			const sCleanValue = sValue.replace(/[^a-zA-Z0-9\s\-']/g, "");
			
			if (sValue === sCleanValue) {
				this.onFilterChange();
				return;
			}
			
			oEvent.getSource().setValue(sCleanValue);
			this.getView().getModel(this.MODEL_NAMES.FILTER).setProperty("/filters/name", sCleanValue);
			this.onFilterChange();
		},

		onEmailFilterChange: function (oEvent) {
			const sValue = oEvent.getParameter("newValue");
			const sCleanValue = sValue.replace(/[^a-zA-Z0-9@._-]/g, "");
			
			if (sValue === sCleanValue) {
				this.onFilterChange();
				return;
			}
			
			oEvent.getSource().setValue(sCleanValue);
			this.onFilterChange();
		},

		onBalanceFilterChange: function (oEvent) {
			const sNewValue = oEvent.getParameter("newValue");
			const sStorageKey = oEvent.getSource().getId().includes("balanceFrom") ? 
				"_balanceFromRaw" : "_balanceToRaw";
			let sCurrentRaw = this[sStorageKey] || "0";
			
			if (!sNewValue || sNewValue === "0.00") {
				this[sStorageKey] = "0";
				oEvent.getSource().setValue("0.00");
				this.onFilterChange();
				return;
			}
			
			const sDigitsOnly = sNewValue.replace(/[^\d]/g, "");
			const sCurrentDigitsOnly = this._getDisplayValue(sCurrentRaw).replace(/[^\d]/g, "");
			
			if (sDigitsOnly.length > sCurrentDigitsOnly.length) {
				sCurrentRaw += sDigitsOnly.slice(-1);
			} else if (sDigitsOnly.length < sCurrentDigitsOnly.length) {
				sCurrentRaw = sCurrentRaw.slice(0, -1) || "0";
			}
			
			this[sStorageKey] = sCurrentRaw;
			oEvent.getSource().setValue(this._getDisplayValue(sCurrentRaw));
			this.onFilterChange();
		},
		
		_getDisplayValue: function (sRawValue) {
			const iRawLength = sRawValue.length;
			
			if (iRawLength === 1) return `0.0${sRawValue}`;
			if (iRawLength === 2) return `0.${sRawValue}`;
			
			const sIntegerPart = parseInt(sRawValue.slice(0, -2), 10).toString();
			const sDecimalPart = sRawValue.slice(-2);
			return `${sIntegerPart}.${sDecimalPart}`;
		},

		_applyAllFilters: function () {
			const oFilterModel = this.getView().getModel(this.MODEL_NAMES.FILTER);
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			const oFilters = oFilterModel.getProperty("/filters");
			
			const sSearchQuery = this.byId(this.SEARCH_FIELD_ID) ? 
				this.byId(this.SEARCH_FIELD_ID).getValue() : "";
			
			const aFilters = [];
			
			if (oFilters.idFrom && oFilters.idTo) {
				aFilters.push(new Filter("ID", FilterOperator.BT, parseInt(oFilters.idFrom, 10), parseInt(oFilters.idTo, 10)));
			} else if (oFilters.idFrom) {
				aFilters.push(new Filter("ID", FilterOperator.GE, parseInt(oFilters.idFrom, 10)));
			} else if (oFilters.idTo) {
				aFilters.push(new Filter("ID", FilterOperator.LE, parseInt(oFilters.idTo, 10)));
			}
			
			if (sSearchQuery) {
				aFilters.push(new Filter("fullname", FilterOperator.Contains, sSearchQuery));
			}
			
			if (oFilters.email) {
				aFilters.push(new Filter("email", FilterOperator.Contains, oFilters.email));
			}
			
			if (oFilters.balanceFrom && oFilters.balanceFrom !== "0.00" && oFilters.balanceTo && oFilters.balanceTo !== "0.00") {
				aFilters.push(new Filter("balance", FilterOperator.BT, parseFloat(oFilters.balanceFrom), parseFloat(oFilters.balanceTo)));
			} else if (oFilters.balanceFrom && oFilters.balanceFrom !== "0.00") {
				aFilters.push(new Filter("balance", FilterOperator.GE, parseFloat(oFilters.balanceFrom)));
			} else if (oFilters.balanceTo && oFilters.balanceTo !== "0.00") {
				aFilters.push(new Filter("balance", FilterOperator.LE, parseFloat(oFilters.balanceTo)));
			}
			
			if (oFilters.dateFrom && oFilters.dateTo) {
				aFilters.push(new Filter("lastPaymentAt", FilterOperator.BT, oFilters.dateFrom, oFilters.dateTo));
			} else if (oFilters.dateFrom) {
				aFilters.push(new Filter("lastPaymentAt", FilterOperator.GE, oFilters.dateFrom));
			} else if (oFilters.dateTo) {
				aFilters.push(new Filter("lastPaymentAt", FilterOperator.LE, oFilters.dateTo));
			}
			
			const oCombinedFilter = new Filter({
				filters: aFilters,
				and: true
			});
			
			if (aFilters.length > 0) {
				oBinding.filter(oCombinedFilter);
			} else {
				oBinding.filter([]);
			}
			
			this._previousFilters = {
				...this.DEFAULT_FILTER_STATE,
				idFrom: oFilters.idFrom || "",
				idTo: oFilters.idTo || "",
				email: oFilters.email || "",
				balanceFrom: oFilters.balanceFrom || "0.00",
				balanceTo: oFilters.balanceTo || "0.00",
				dateFrom: oFilters.dateFrom,
				dateTo: oFilters.dateTo,
				searchQuery: sSearchQuery || ""
			};
			
			this._goToPage(1);
			this._updateCountAfterFilter();
		},

		onClearFilters: function () {
			this.getView().getModel(this.MODEL_NAMES.FILTER)
				.setProperty("/filters", { ...this.DEFAULT_FILTER_STATE });
			this._balanceFromRaw = "0";
			this._balanceToRaw = "0";
			this._previousFilters = { ...this.DEFAULT_FILTER_STATE };
			this.byId(this.SEARCH_FIELD_ID).setValue("");
			this.byId(this.TABLE_ID).getBinding("items").filter([]);
			this._goToPage(1);
			
			MessageToast.show(this.getView().getModel(this.MODEL_NAMES.I18N).getResourceBundle().getText("filtersCleared"));
			
			setTimeout(() => {
				this._updateCountFromBinding(this.byId(this.TABLE_ID).getBinding("items"));
			}, 200);
		},

		onStudentCheckBoxSelect: function () {
		},

		onStudentPress: function (oEvent) {
			const oStudent = oEvent.getSource().getBindingContext().getObject();
			MessageToast.show(`Student selected: ${oStudent.fullname}`);
		},

		onAddStudent: function () {
			try {
				this._openStudentDetail(true);
			} catch (error) {
				MessageBox.error(`Error opening dialog: ${error.message}`);
			}
		},

		onEditStudent: function (oEvent) {
			try {
				this._openStudentDetail(false, oEvent.getSource().getBindingContext().getObject());
			} catch (error) {
				MessageBox.error(`Error opening dialog: ${error.message}`);
			}
		},

		onDeleteStudent: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const oStudent = oContext.getObject();
			
			MessageBox.confirm(
				"Are you sure you want to delete student '" + oStudent.fullname + "'?",
				{
					title: "Confirm Deletion",
					onClose: function (sAction) {
						if (sAction === MessageBox.Action.OK) {
							this._deleteStudent(oContext);
						}
					}.bind(this)
				}
			);
		},

		_deleteStudent: function (oContext) {
			const oModel = this.getModel();
			
			oModel.remove(oContext.getPath(), {
				success: function () {
					MessageToast.show("Student deleted successfully");
					const oBinding = this.byId(this.TABLE_ID).getBinding("items");
					if (!oBinding) return;
					setTimeout(() => {
						this._updateCountFromBinding(oBinding);
					}, 200);
				}.bind(this),
				error: function (oError) {
					MessageBox.error("Error deleting student: " + oError.message);
				}
			});
		},

		onViewReceipts: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const oStudent = oContext.getObject();
			
			MessageToast.show("View Receipts for: " + oStudent.fullname);
		},

		_openStudentDetail: function (bIsNew, oStudent) {
			if (!this._oDialog) {
				sap.ui.require(["sap/ui/core/Fragment", "student/crm/ui/controller/StudentsDetail.controller"], (Fragment, StudentsDetailController) => {
					// Create controller instance
					const oController = new StudentsDetailController();
					
					Fragment.load({
						name: "student.crm.ui.view.StudentDetail",
						controller: oController
					}).then((oDialog) => {
						this._oDialog = oDialog;
						this._oDetailController = oController;
						this.getView().addDependent(this._oDialog);
						
						// Initialize controller with parent references
						oController.setMainView(this.getView());
						oController.setMainController(this);
						oController.setDialog(this._oDialog);
						oController.onInit();
						oController.openDialog(bIsNew, oStudent);
					});
				});
				return;
			}
			
			// Dialog exists, just pass data to controller
			if (this._oDetailController) {
				this._oDetailController.openDialog(bIsNew, oStudent);
			}
		},

		_refreshTable: function () {
			const oTableBinding = this.byId(this.TABLE_ID).getBinding("items");
			if (!oTableBinding) return;
			setTimeout(() => {
				this._updateCountFromBinding(oTableBinding);
			}, 200);
		},

		formatBalanceState: function (balance) {
			switch (true) {
				case !balance:
					return "None";
				case balance < 0:
					return "Error";
				case balance === 0:
					return "Warning";
				default:
					return "Success";
			}
		},

		_getTotalCount: function() {
			const oModel = this.getModel();
			
			const oBinding = oModel.bindList("/Students");
			
			if (typeof oBinding.getCount === 'function') {
				oBinding.getCount();
			}
			
			oBinding.requestContexts(0, 1).then(() => {
				const totalCount = oBinding.getCount();
				
				if (totalCount > 0) {
					const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
					oPaginationModel.setProperty("/totalItems", totalCount);
					const totalPages = Math.max(1, Math.ceil(totalCount / this._pageSize));
					oPaginationModel.setProperty("/totalPages", totalPages);
				}
			}).catch(() => {
			});
			
			setTimeout(() => {
				const oTableBinding = this.byId(this.TABLE_ID).getBinding("items");
				
				if (oTableBinding) {
					oTableBinding.getCount();
					
					if (typeof oTableBinding.getLength === 'function') {
						oTableBinding.getLength();
					}
					
					oTableBinding.getContexts();
				}
			}, 1000);
		},

		onFirstPage: function () {
			this._goToPage(1);
		},

		onPreviousPage: function () {
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const currentPage = oPaginationModel.getProperty("/currentPage");
			
			if (currentPage <= 1) return;
			this._goToPage(currentPage - 1);
		},

		onNextPage: function () {
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const currentPage = oPaginationModel.getProperty("/currentPage");
			const totalPages = oPaginationModel.getProperty("/totalPages");
			
			if (currentPage >= totalPages) return;
			this._goToPage(currentPage + 1);
		},

		onLastPage: function () {
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const totalPages = oPaginationModel.getProperty("/totalPages");
			this._goToPage(totalPages);
		},

		onPageChange: function (oEvent) {
			const sValue = oEvent.getParameter("value");
			const iPage = parseInt(sValue, 10);
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const totalPages = oPaginationModel.getProperty("/totalPages");
			
			if (isNaN(iPage) || iPage < 1) {
				oPaginationModel.setProperty("/currentPage", oPaginationModel.getProperty("/currentPage"));
				MessageToast.show("Please enter a valid page number");
				return;
			}
			
			if (iPage > totalPages) {
				oPaginationModel.setProperty("/currentPage", oPaginationModel.getProperty("/currentPage"));
				MessageToast.show("Page number exceeds total pages");
				return;
			}
			
			this._goToPage(iPage);
		},

		_goToPage: function (iPage) {
			const oPaginationModel = this.getView().getModel(this.MODEL_NAMES.PAGINATION);
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			
			oPaginationModel.setProperty("/currentPage", iPage);
			
			const skip = (iPage - 1) * this._pageSize;
			
			oBinding.changeParameters({
				"$skip": skip,
				"$top": this._pageSize,
				"$count": true
			});
			
			const totalItems = oPaginationModel.getProperty("/totalItems");
			const totalPages = Math.max(1, Math.ceil(totalItems / this._pageSize));
			oPaginationModel.setProperty("/totalPages", totalPages);
			oPaginationModel.setProperty("/hasPrevious", iPage > 1);
			oPaginationModel.setProperty("/hasNext", iPage < totalPages);
		},

		_updatePaginationState: function () {
			const oBinding = this.byId(this.TABLE_ID).getBinding("items");
			
			if (!oBinding) return;
			this._updateCountFromBinding(oBinding);
		},

		onDebugCount: function() {
			this._fetchTotalCount();
		},

		onDebugApiUrl: function() {
			const sApiUrl = this._getApiBaseUrl();
			const sStudentsUrl = this._getStudentsApiUrl();
			MessageToast.show("Base API URL: " + sApiUrl + "\nStudents URL: " + sStudentsUrl);
			console.log("API Configuration:", {
				baseUrl: sApiUrl,
				studentsUrl: sStudentsUrl,
				currentOrigin: window.location.origin,
				modelServiceUrl: this.getModel() ? this.getModel().sServiceUrl : "No model"
			});
		}
	});
});
