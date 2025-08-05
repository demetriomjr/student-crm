using student.crm.schema as models from '../db/schema.cds';

service api {
    entity Students as projection on models.Student;
    entity Receipts as projection on models.Receipt;
    entity CheckInClasses as projection on models.CheckInClass;

    action uploadReceipt(content: String) returns {
        filePath: String;
    };
    function downloadReceiptFile(fileName: String) returns {
        fileContent: String;
        mimeType: String;
    };
    action deleteReceipt(fileName: String) returns {
        success: Boolean;
        message: String;
    };
}