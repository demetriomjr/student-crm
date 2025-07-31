using student.crm.schema as models from '../db/schema.cds';

service api {
    entity Students as projection on models.Student;
    entity Receipts as projection on models.Receipt;
    entity CheckInClasses as projection on models.CheckInClass;

    action uploadReceipt(studentId: Integer, amount: Decimal(10,2), content: String) returns Receipts;
    function downloadReceiptFile(fileName: String) returns {
        fileName: String;
        fileContent: String;
        mimeType: String;
    };
}