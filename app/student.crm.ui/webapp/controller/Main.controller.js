sap.ui.define([
	"./BaseController", 
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel"
], function (BaseController, MessageBox, MessageToast, JSONModel) {
	"use strict";

	return BaseController.extend("student.crm.ui.controller.Main", {

		onInit: function () {
			// Initialize login form model
			const oLoginModel = new JSONModel({
				username: "",
				password: "",
				usernameState: "None",
				usernameStateText: "",
				passwordState: "None",
				passwordStateText: ""
			});
			this.setModel(oLoginModel);
		},

		onLogin: function () {
			const oModel = this.getModel();
			const sUsername = oModel.getProperty("/username");
			const sPassword = oModel.getProperty("/password");

			// Reset validation states
			oModel.setProperty("/usernameState", "None");
			oModel.setProperty("/usernameStateText", "");
			oModel.setProperty("/passwordState", "None");
			oModel.setProperty("/passwordStateText", "");

			// Simple validation
			let bValid = true;

			if (!sUsername || sUsername.trim() === "") {
				oModel.setProperty("/usernameState", "Error");
				oModel.setProperty("/usernameStateText", "Username is required");
				bValid = false;
			}

			if (!sPassword || sPassword.trim() === "") {
				oModel.setProperty("/passwordState", "Error");
				oModel.setProperty("/passwordStateText", "Password is required");
				bValid = false;
			}

			if (!bValid) {
				MessageToast.show("Please fill in all required fields");
				return;
			}

			// Simple authentication (demo purposes)
			// In a real app, you would call a backend service
			if (sUsername === "admin" && sPassword === "admin123") {
				MessageToast.show("Login successful!");
				
				// Store login state (in a real app, use proper session management)
				sessionStorage.setItem("isLoggedIn", "true");
				sessionStorage.setItem("currentUser", sUsername);
				
				// Navigate to students view
				this.navTo("students");
			} else {
				MessageBox.error("Invalid username or password");
			}
		},

		onLoginFieldSubmit: function () {
			const oModel = this.getModel();
			const sUsername = oModel.getProperty("/username");
			const sPassword = oModel.getProperty("/password");

			// Only proceed with login if both fields have values
			if (sUsername && sUsername.trim() !== "" && sPassword && sPassword.trim() !== "") {
				this.onLogin();
			}
		},

		sayHello: function () {
			MessageBox.show("Hello World!");
		},

		onNavigateToStudents: function () {
			this.navTo("students");
		}
	});
});
