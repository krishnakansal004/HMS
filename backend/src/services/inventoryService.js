import { InventoryRepository } from "../repositories/inventoryRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class InventoryService {
  static async addMedicine({ tenantId, userId, data, ipAddress }) {
    const purchasePrice = Number(data.purchasePrice);
    const sellingPrice = Number(data.sellingPrice);

    // Prevent past expiry dates
    if (new Date(data.expiryDate) <= new Date()) {
      throw new AppError(
        "Cannot add medicine that is already expired.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // dropped here rather than silently swallowed. Add them via a new
    // migration file first if the frontend needs them.
    const medicine = await InventoryRepository.createMedicine({
      tenant_id: tenantId,
      supplier_id: data.supplierId,
      name: data.name,
      batch_number: data.batchNumber,
      expiry_date: new Date(data.expiryDate),
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      gst_rate: data.gstRate || 0,
      quantity: data.initialStock || 0,
      reorder_level: data.reorderLevel || 10,
    });

    // If initial stock > 0, log it as an initial adjustment
    if (data.initialStock > 0) {
      await InventoryRepository.adjustStockTransaction({
        tenantId,
        medicineId: medicine.medicine_id,
        type: "ADJUSTMENT",
        quantity: data.initialStock,
        notes: "Initial stock addition upon creation",
      });
    }

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_MEDICINE",
      entityType: "MEDICINE",
      entityId: medicine.medicine_id,
      newValue: { name: medicine.name, batchNumber: medicine.batch_number },
      ipAddress,
    });

    return medicine;
  }

  static async listMedicines({ tenantId, query }) {
    const { search, lowStock, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const { total, medicines } = await InventoryRepository.findManyPaginated({
      tenantId,
      search,
      lowStockOnly: String(lowStock).toLowerCase() === "true",
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: medicines,
    };
  }

  static async dispenseMedicine({
    tenantId,
    userId,
    medicineId,
    quantity,
    prescriptionId,
    notes,
    ipAddress,
  }) {
    if (quantity <= 0) {
      throw new AppError(
        "Dispense quantity must be greater than zero.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    try {
      const result = await InventoryRepository.adjustStockTransaction({
        tenantId,
        medicineId,
        type: "DISPENSE",
        quantity: -Math.abs(quantity), // Force negative for decrement
        referenceId: prescriptionId,
        notes,
      });

      AuditService.logAction({
        tenantId,
        userId,
        action: "DISPENSE_MEDICINE",
        entityType: "MEDICINE",
        entityId: medicineId,
        newValue: {
          dispensed: quantity,
          remainingStock: result.medicine.quantity,
        },
        ipAddress,
      });

      // TODO: If result.medicine.quantity <= result.medicine.reorder_level, enqueue a BullMQ job
      // to send a "Low Stock Alert" email/SMS to the Hospital Admin and Pharmacist.

      if (result.medicine.quantity <= result.medicine.reorder_level) {
        db.users.findFirst({
          where: { tenant_id: tenantId, role: { name: 'HOSPITAL_ADMIN' }, deleted_at: null }
        }).then(admin => {
          if (admin) {
            addNotificationJob("email", {
              to: admin.email,
              subject: `Low Stock Alert: ${result.medicine.name}`,
              html: `<p>The stock for <b>${result.medicine.name}</b> (Batch: ${result.medicine.batch_number}) has dropped to ${result.medicine.quantity}, which is at or below the reorder level of ${result.medicine.reorder_level}. Please restock.</p>`
            });
          }
        }).catch(err => console.error("Failed to queue low stock alert", err));
      }
      
      return result.medicine;
    } catch (error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        throw new AppError(
          "Insufficient stock to fulfill this dispense request.",
          HTTP_STATUS.CONFLICT,
        );
      }
      if (error.message === "MEDICINE_NOT_FOUND") {
        throw new AppError(
          "Medicine not found in your inventory.",
          HTTP_STATUS.NOT_FOUND,
        );
      }
      throw error;
    }
  }

  static async receivePurchase({
    tenantId,
    userId,
    medicineId,
    quantity,
    purchaseOrderId,
    notes,
    ipAddress,
  }) {
    if (quantity <= 0) {
      throw new AppError(
        "Receive quantity must be greater than zero.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const result = await InventoryRepository.adjustStockTransaction({
      tenantId,
      medicineId,
      type: "PURCHASE",
      quantity: Math.abs(quantity), // Force positive for increment
      referenceId: purchaseOrderId,
      notes,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "RECEIVE_MEDICINE_PURCHASE",
      entityType: "MEDICINE",
      entityId: medicineId,
      newValue: { added: quantity, newStock: result.medicine.quantity },
      ipAddress,
    });

    return result.medicine;
  }
}
