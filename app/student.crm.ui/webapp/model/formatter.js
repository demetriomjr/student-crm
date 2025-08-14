sap.ui.define([
	"sap/ui/core/library",
	"sap/ui/core/format/NumberFormat"
], function (coreLibrary, NumberFormat) {
	"use strict";

	const ValueState = coreLibrary.ValueState; // recommended import path (avoids deprecated pseudo module)

	// Lazy singleton currency formatter per locale & currency
	let _oCurrencyFormatter; 
	function _getCurrencyFormatter() {
		if (!_oCurrencyFormatter) {
			const sLocale = sap.ui.getCore().getConfiguration().getLanguage();
			// Decide currency by locale (extend if needed)
			const sCurrency = (sLocale === "pt" || sLocale === "pt-BR") ? "BRL" : "USD";
			_oCurrencyFormatter = NumberFormat.getCurrencyInstance({
				currencyCode: false, // show symbol, not code
				showMeasure: false, // we'll prefix manually
				minFractionDigits: 2,
				maxFractionDigits: 2
			});
			_oCurrencyFormatter._symbol = (sCurrency === "BRL") ? "R$" : "$"; // store chosen symbol
		}
		return _oCurrencyFormatter;
	}

	return {
		/**
		 * Formats a date object or ISO string to DD/MM/YYYY format
		 * @public
		 * @param {Date|string} vDate Date object or ISO string to be formatted
		 * @returns {string} formatted date in DD/MM/YYYY format or empty string
		 */
		formatDate: function(vDate) {
			if (!vDate) return "";
			
			const oDate = vDate instanceof Date ? vDate : new Date(vDate);
			
			// Check if date is valid
			if (isNaN(oDate.getTime())) return "";
			
			const sDay = String(oDate.getDate()).padStart(2, '0');
			const sMonth = String(oDate.getMonth() + 1).padStart(2, '0');
			const sYear = oDate.getFullYear();
			
			return `${sDay}/${sMonth}/${sYear}`;
		},

		/**
		 * Formats balance with currency symbol prefix (R$ / $) respecting locale thousands and decimal separators.
		 * ObjectNumber.number can accept a string; we return a display string directly.
		 * @param {number|string} nValue raw balance
		 * @returns {string}
		 */
		formatBalanceDisplay: function (nValue) {
			const oFmt = _getCurrencyFormatter();
			const f = parseFloat(nValue);
			if (isNaN(f)) return oFmt._symbol + " 0,00";
			// NumberFormat returns locale-specific separators
			const sFormatted = oFmt.format(f).replace(/\s+/g, '');
			// Ensure decimal separator for BRL is comma; NumberFormat already handles locale but enforce symbol prefix format
			return oFmt._symbol + " " + sFormatted;
		},

		/**
		 * Determines the ValueState for balance display
		 * @public
		 * @param {number} nValue balance value to check
		 * @returns {sap.ui.core.ValueState} ValueState enum value
		 */
		formatBalanceState: function (nValue) {
			const f = parseFloat(nValue);
			if (isNaN(f)) return ValueState.None;
			if (f < 0) return ValueState.Error;
			if (f === 0) return ValueState.Warning;
			if (f > 1000) return ValueState.Success;
			return ValueState.Information;
		},

		/**
		 * Formats date input as user types (DD/MM/YYYY)
		 * @public
		 * @param {string} sValue input value to be formatted
		 * @returns {string} formatted date string
		 */
		formatDateInput: function(sValue) {
			if (!sValue) return "";
			
			let sFormattedValue = sValue.replace(/[^\d]/g, "");
			
			if (sFormattedValue.length > 2) {
				sFormattedValue = `${sFormattedValue.substring(0,2)}/${sFormattedValue.substring(2)}`;
			}
			if (sFormattedValue.length > 5) {
				sFormattedValue = `${sFormattedValue.substring(0,5)}/${sFormattedValue.substring(5,9)}`;
			}
			return sFormattedValue.substring(0, 10);
		}
	};
});
