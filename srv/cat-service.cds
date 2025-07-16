using student.crm.schema as models from '../db/schema.cds';

service api {
    entity Students as projection on models.Student;
    entity Receipts as projection on models.Receipt;

    action uploadReceipt(studentId: Integer, receiptFile: String, amount: Decimal);
}