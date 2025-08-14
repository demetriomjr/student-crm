# Copilot Instructions for `student-crm`

## Overview
This project is a **Student CRM** application built using the **SAP CAP (Cloud Application Programming)** model and **SAP UI5** framework. It consists of three main layers:

1. **UI Layer** (`app/`): Contains the frontend code, including SAP UI5 views, controllers, and models.
2. **Service Layer** (`srv/`): Defines the service logic and APIs using CAP.
3. **Database Layer** (`db/`): Contains the domain models and data definitions.

## Key Components
- **UI5 Application** (`app/student.crm.ui/`):
  - `webapp/`: Contains the SAP UI5 MVC components (views, controllers, models).
  - `i18n/`: Localization files for internationalization.
  - `test/`: Unit and integration tests for the UI.
- **CAP Service** (`srv/`):
  - `cat-service.cds`: Defines the service endpoints.
  - `cat-service.js`: Implements custom service logic.
- **Database** (`db/`):
  - `schema.cds`: Defines the domain model.
  - `data/`: Contains CSV files for initial data loading.

## Developer Workflows

### Running the Application
1. Start the CAP server:
   ```sh
   cds watch
   ```
   This command runs the CAP server in watch mode, automatically restarting on file changes.

2. Run the UI5 application:
   ```sh
   npm start
   ```
   This starts the UI5 app in watch mode at `http://localhost:8080`.

### Building the Application
- **UI5 Build**:
  ```sh
  npm run build
  ```
  Generates the `dist/` folder for deployment.

- **CAP Build**:
  ```sh
  cds build
  ```
  Prepares the CAP project for deployment.

### Testing
- **UI5 Tests**:
  - Unit tests: `test/unit/`
  - Integration tests: `test/integration/`
  - Run tests:
    ```sh
    npm test
    ```

- **CAP Tests**:
  Add test cases in `test/` and run them using:
  ```sh
  npm test
  ```

## Project-Specific Conventions
- **i18n Keys**: All user-facing strings must be internationalized using the `i18n` model.
- **File Naming**: Use camelCase for JavaScript files and kebab-case for other files.
- **Error Handling**: Use `MessageBox` for user-facing errors and `console.error` for debugging.

## Integration Points
- **External Services**: Define and consume external services in `srv/external/`.
- **File Uploads**: Handled in `StudentsDetail.controller.js` using base64 encoding.

## Examples
- **Adding a New View**:
  1. Create a new XML view in `webapp/view/`.
  2. Add a corresponding controller in `webapp/controller/`.
  3. Register the route in `manifest.json`.

- **Defining a New Entity**:
  1. Add the entity in `db/schema.cds`.
  2. Add initial data in `db/data/`.
  3. Expose the entity in `srv/cat-service.cds`.

## References
- [CAP Documentation](https://cap.cloud.sap/docs/)
- [UI5 Documentation](https://ui5.sap.com/)
