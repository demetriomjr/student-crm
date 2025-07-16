sap.ui.define(["./BaseController", "sap/m/MessageBox"], function (BaseController, MessageBox) {
	"use strict";

	return BaseController.extend("student.crm.ui.controller.Main", {
		sayHello: function () {
			MessageBox.show("Hello World!");
		}
	});
});
