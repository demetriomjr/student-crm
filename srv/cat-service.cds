using student.crm.schema as models from '../db/schema.cds';

service api {
    entity Students : models.Student {
        action uploadReceipt();
    };
    entity Receipts as projection on models.Receipt;
}