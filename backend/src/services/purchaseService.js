import { PurchaseRepository } from "../repositories/purchaseRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";

export class PurchaseService {
  static async createPurchaseOrder({
    tenantId,
    userId,
    supplierId,
    orderId,
    orderDate,
    status,
    items,
    ipAddress,
  }) {
    const supplier = await db.supplier.findFirst({
      where: { supplier_id: supplierId, tenant_id: tenantId, deleted_at: null },
    });
    if (!supplier) {
      throw new AppError("Supplier not found.", HTTP_STATUS.NOT_FOUND);
    }

    const medicineIds = items.map((i) => i.medicineId);
    if (new Set(medicineIds).size !== medicineIds.length) {
      throw new AppError("A medicine can appear only once in a purchase order.", HTTP_STATUS.BAD_REQUEST);
    }
    const medicines = await db.medicine.findMany({
      where: { medicine_id: { in: medicineIds }, tenant_id: tenantId, deleted_at: null },
    });

    if (medicines.length !== medicineIds.length) {
      throw new AppError(
        "One or more medicines specified do not exist in inventory.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const formattedItems = items.map((item) => ({
      ...item,
      unitCost: Number(item.unitCost),
    }));

    // Create purchase transaction
    const purchase = await PurchaseRepository.createPurchaseTransaction({
      tenantId,
      supplierId,
      orderId,
      orderDate,
      status: status || "pending",
      items: formattedItems,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_PURCHASE_ORDER",
      entityType: "PURCHASE",
      entityId: purchase.purchase_id,
      newValue: {
        supplierId,
        totalCost: purchase.total_cost,
        status: purchase.status,
      },
      ipAddress,
    });

    return purchase;
  }

  static async updatePurchaseStatus({
    tenantId,
    userId,
    purchaseId,
    status,
    ipAddress,
  }) {
    try {
      const updated = await PurchaseRepository.updateStatusTransaction({
        tenantId,
        purchaseId,
        newStatus: status,
      });

      AuditService.logAction({
        tenantId,
        userId,
        action: `UPDATE_PURCHASE_STATUS_${status.toUpperCase()}`,
        entityType: "PURCHASE",
        entityId: purchaseId,
        newValue: { status },
        ipAddress,
      });

      return updated;
    } catch (error) {
      if (error.message === "PURCHASE_NOT_FOUND") {
        throw new AppError("Purchase order not found.", HTTP_STATUS.NOT_FOUND);
      }
      if (error.message === "INVALID_PURCHASE_TRANSITION") {
        throw new AppError("Invalid purchase status transition.", HTTP_STATUS.CONFLICT);
      }
      if (error.message === "INSUFFICIENT_STOCK_FOR_PURCHASE_REVERSAL") {
        throw new AppError("Purchase cannot be cancelled because some received stock has already been consumed.", HTTP_STATUS.CONFLICT);
      }
      throw error;
    }
  }

  static async getPurchases({ tenantId, query }) {
    const { supplierId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, purchases] = await PurchaseRepository.findManyPaginated({
      tenantId,
      supplierId,
      status,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: purchases,
    };
  }
}
