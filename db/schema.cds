namespace student.crm.schema;
using { managed } from '@sap/cds/common';

entity Student: managed {
  key ID: Integer;
  fullname: String(100);
  email: String(100);
  lastPaymentAt: Date ;
  balance: Decimal(10,2) default 0.00;
  receipts: Composition of many Receipt on receipts.student = $self;
  checkInClasses: Composition of many CheckInClass on checkInClasses.student = $self;
}

entity Receipt: managed {
  key ID: Integer;
  student: Association to Student;
  amount: Decimal(10,2);
  date: Date;
  file: String(255);
}

entity CheckInClass: managed {
  key ID: Integer;
  student: Association to Student;
  date: Date;
}
