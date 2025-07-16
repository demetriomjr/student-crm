sap.ui.define(function () {
	"use strict";

	return {
		name: "QUnit test suite for the UI5 Application: student.crm.ui",
		defaults: {
			page: "ui5://test-resources/student/crm/ui/Test.qunit.html?testsuite={suite}&test={name}",
			qunit: {
				version: 2
			},
			sinon: {
				version: 1
			},
			ui5: {
				language: "EN",
				theme: "sap_horizon"
			},
			coverage: {
				only: "student/crm/ui/",
				never: "test-resources/student/crm/ui/"
			},
			loader: {
				paths: {
					"student/crm/ui": "../"
				}
			}
		},
		tests: {
			"unit/unitTests": {
				title: "Unit tests for student.crm.ui"
			},
			"integration/opaTests": {
				title: "Integration tests for student.crm.ui"
			}
		}
	};
});
