import { SupplierService } from "../services/supplierService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class SupplierController {
  static async list(req, res, next) {
    try {
      const suppliers = await SupplierService.list({ tenantId: req.currentTenantId });
      res.status(HTTP_STATUS.OK).json({ success: true, data: suppliers });
    } catch (error) { next(error); }
  }

  static async create(req, res, next) {
    try {
      const supplier = await SupplierService.create({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, message: 'Supplier created', data: supplier });
    } catch (error) { next(error); }
  }

  static async update(req, res, next) {
    try {
      await SupplierService.update({
        tenantId: req.currentTenantId,
        userId: req.userId,
        supplierId: req.params.id,
        data: req.body,
        ipAddress: req.ip
      });
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Supplier updated' });
    } catch (error) { next(error); }
  }

  static async remove(req, res, next) {
    try {
      await SupplierService.remove({
        tenantId: req.currentTenantId,
        userId: req.userId,
        supplierId: req.params.id,
        ipAddress: req.ip
      });
      res.status(HTTP_STATUS.OK).json({ success: true, message: 'Supplier archived' });
    } catch (error) { next(error); }
  }
}