import { SupplierRepository } from "../repositories/supplierRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class SupplierService {
  static async create({ tenantId, userId, data, ipAddress }) {
    const supplier = await SupplierRepository.create(tenantId, {
      name: data.name,
      contact_email: data.contactEmail || null,
      contact_phone: data.contactPhone || null,
    });

    AuditService.logAction({
      tenantId, userId, action: "CREATE_SUPPLIER", entityType: "SUPPLIER",
      entityId: supplier.supplier_id, newValue: { name: supplier.name }, ipAddress,
    });

    return supplier;
  }

  static async update({ tenantId, userId, supplierId, data, ipAddress }) {
    const existing = await SupplierRepository.findById(tenantId, supplierId);
    if (!existing) throw new AppError('Active supplier not found', HTTP_STATUS.NOT_FOUND);

    const result = await SupplierRepository.update(tenantId, supplierId, {
      name: data.name,
      contact_email: data.contactEmail || null,
      contact_phone: data.contactPhone || null,
    });

    AuditService.logAction({
      tenantId, userId, action: "UPDATE_SUPPLIER", entityType: "SUPPLIER",
      entityId: supplierId, oldValue: { name: existing.name }, newValue: { name: data.name }, ipAddress,
    });

    return result;
  }

  static async remove({ tenantId, userId, supplierId, ipAddress }) {
    const existing = await SupplierRepository.findById(tenantId, supplierId);
    if (!existing) throw new AppError('Active supplier not found', HTTP_STATUS.NOT_FOUND);

    await SupplierRepository.softDelete(tenantId, supplierId);

    AuditService.logAction({
      tenantId, userId, action: "ARCHIVE_SUPPLIER", entityType: "SUPPLIER",
      entityId: supplierId, oldValue: { name: existing.name }, newValue: { status: 'archived' }, ipAddress,
    });
    
    return { success: true };
  }

  static async list({ tenantId }) {
    return SupplierRepository.findMany(tenantId);
  }
}