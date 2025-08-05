sap.ui.define([], function () {
	"use strict";

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
		 * Formats balance with locale-aware currency
		 * @public
		 * @param {number} nValue balance value to be formatted
		 * @returns {string} formatted balance with currency symbol
		 */
		formatBalance: function(nValue) {
			if (nValue === undefined || nValue === null) return "";
			
			const numValue = parseFloat(nValue);
			if (isNaN(numValue)) return "";
			
			const sLocale = sap.ui.getCore().getConfiguration().getLanguage();
			const sCurrency = (sLocale === "pt" || sLocale === "pt-BR") ? "R$" : "$";
			
			return `${sCurrency} ${numValue.toFixed(2)}`;
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
