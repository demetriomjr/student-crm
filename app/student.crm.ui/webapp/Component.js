sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"./model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("student.crm.ui.Component", {
		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		init: function () {
			UIComponent.prototype.init.call(this);

			if (!this.getModel("device")) {
				this.setModel(models.createDeviceModel(), "device");
			}

			const oRouter = this.getRouter();
			if (oRouter && oRouter.initialize) {
				oRouter.initialize();
			}

			const sDensity = this.getContentDensityClass();
			if (sDensity) {
				const oRoot = this.getRootControl();
				if (oRoot && oRoot.addStyleClass) {
					oRoot.addStyleClass(sDensity);
				}
			}
		},

		getContentDensityClass: function () {
			if (this.contentDensityClass === undefined) {
				if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
					this.contentDensityClass = "";
				} else if (!Device.support.touch) {
					this.contentDensityClass = "sapUiSizeCompact";
				} else {
					this.contentDensityClass = "sapUiSizeCozy";
				}
			}
			return this.contentDensityClass;
		}
	});
});
