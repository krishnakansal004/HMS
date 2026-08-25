import { InventoryService } from "../services/inventoryService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class InventoryController {
  static async add(req, res, next) {
    try {
      const medicine = await InventoryService.addMedicine({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Medicine added successfully",
        data: medicine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await InventoryService.listMedicines({
        tenantId: req.currentTenantId,
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

  static async dispense(req, res, next) {
    try {
      const medicine = await InventoryService.dispenseMedicine({
        tenantId: req.currentTenantId,
        userId: req.userId,
        medicineId: req.params.id,
        quantity: req.body.quantity,
        prescriptionId: req.body.prescriptionId,
        notes: req.body.notes,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Medicine dispensed successfully",
        data: medicine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async receive(req, res, next) {
    try {
      const medicine = await InventoryService.receivePurchase({
        tenantId: req.currentTenantId,
        userId: req.userId,
        medicineId: req.params.id,
        quantity: req.body.quantity,
        purchaseOrderId: req.body.purchaseOrderId,
        notes: req.body.notes,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Purchase received and stock updated",
        data: medicine,
      });
    } catch (error) {
      next(error);
    }
  }
}
