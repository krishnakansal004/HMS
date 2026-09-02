-- Migration: 0060
-- Description: Prisma's schema.prisma does not support partial unique indexes natively.
-- We must enforce at the database level that an email can only have ONE 'PENDING' 
-- application per tenant. This prevents spam/race conditions, while still allowing 
-- doctors with 'REJECTED' or 'APPROVED' statuses to submit future applications.

DROP INDEX IF EXISTS uq_doctor_application_pending_email;

CREATE UNIQUE INDEX uq_doctor_application_pending_email 
ON doctor_application (tenant_id, email) 
WHERE status = 'PENDING';