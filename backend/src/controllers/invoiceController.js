import { InvoiceService } from "../services/invoiceService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class InvoiceController {
  static async generate(req, res, next) {
    try {
      const invoice = await InvoiceService.generateInvoice({
        tenantId: req.currentTenantId,
        userId: req.userId,
        patientId: req.body.patientId,
        // Validator/request shape (entityType, entityId, description) differs
        // from what InvoiceRepository.createInvoiceTransaction persists
        // (itemName -> item_name_snapshot, medicineId -> medicine_id) — map here.
        // entityId only refers to a real medicine row when entityType is MEDICINE;
        // for other item types it points at other tables and must not be
        // written to the invoice_item -> medicine foreign key.
        items: req.body.items.map(item => ({
          itemName: item.description,
          medicineId: item.entityType === 'MEDICINE' ? item.entityId : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
        })),
        discount: req.body.discount,
        taxRate: req.body.taxRate,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Invoice generated successfully",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  static async pay(req, res, next) {
    try {
      const updatedInvoice = await InvoiceService.recordPayment({
        tenantId: req.currentTenantId,
        userId: req.userId,
        invoiceId: req.params.id,
        amount: req.body.amount,
        method: req.body.method,
        transactionId: req.body.transactionId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Payment recorded successfully",
        data: updatedInvoice,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await InvoiceService.getInvoices({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
        query: req.query,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
