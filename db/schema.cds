namespace student.crm.schema;
using { managed } from '@sap/cds/common';

entity Student: managed {
  key ID: Integer;
  fullname: String(100);
  email: String(100);
  receipts: Composition of many Receipt on receipts.student = $self;
}

entity Receipt: managed {
  key ID: Integer;
  student: Association to Student;
  amount: Decimal(10,2);
  date: DateTime;
  file: String(255);
}
