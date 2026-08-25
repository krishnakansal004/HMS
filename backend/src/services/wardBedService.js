import { WardBedRepository } from "../repositories/wardBedRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class WardBedService {
  static async createWard({ tenantId, userId, data, ipAddress }) {
    const pricePerDay = Math.round(Number(data.pricePerDay || 0) * 100); // Minor currency

    const ward = await WardBedRepository.createWard(tenantId, {
      name: data.name,
      type: data.type, // ICU, GENERAL, PRIVATE, EMERGENCY
      floor: data.floor || null,
      capacity: Number(data.capacity),
      price_per_day: pricePerDay,
      is_active: true,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_WARD",
      entityType: "WARD",
      entityId: ward.ward_id,
      newValue: { name: ward.name, capacity: ward.capacity },
      ipAddress,
    });

    return ward;
  }

  static async listWards({ tenantId }) {
    return WardBedRepository.findWards(tenantId);
  }

  static async addBed({
    tenantId,
    userId,
    wardId,
    bedNumber,
    pricePerDay,
    ipAddress,
  }) {
    const formattedPrice = pricePerDay
      ? Math.round(Number(pricePerDay) * 100)
      : undefined;

    try {
      const bed = await WardBedRepository.createBed(
        tenantId,
        wardId,
        bedNumber,
        formattedPrice,
      );

      AuditService.logAction({
        tenantId,
        userId,
        action: "ADD_BED_TO_WARD",
        entityType: "BED",
        entityId: bed.bed_id,
        newValue: { wardId, bedNumber },
        ipAddress,
      });

      return bed;
    } catch (error) {
      if (error.message === "WARD_NOT_FOUND") {
        throw new AppError("Ward not found.", HTTP_STATUS.NOT_FOUND);
      }
      if (error.message === "WARD_CAPACITY_EXCEEDED") {
        throw new AppError(
          "Cannot add bed. Ward has reached maximum capacity.",
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  static async assignBed({ tenantId, userId, bedId, patientId, ipAddress }) {
    try {
      const bed = await WardBedRepository.updateBedOccupancyTransaction({
        tenantId,
        bedId,
        patientId,
        isOccupied: true,
      });

      AuditService.logAction({
        tenantId,
        userId,
        action: "ASSIGN_BED_TO_PATIENT",
        entityType: "BED",
        entityId: bedId,
        newValue: { patientId, isOccupied: true },
        ipAddress,
      });

      return bed;
    } catch (error) {
      if (error.message === "BED_NOT_FOUND") {
        throw new AppError("Bed not found.", HTTP_STATUS.NOT_FOUND);
      }
      if (error.message === "BED_ALREADY_OCCUPIED") {
        throw new AppError(
          "This bed is already assigned and occupied.",
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }
  }

  static async releaseBed({ tenantId, userId, bedId, ipAddress }) {
    try {
      const bed = await WardBedRepository.updateBedOccupancyTransaction({
        tenantId,
        bedId,
        patientId: null,
        isOccupied: false,
      });

      AuditService.logAction({
        tenantId,
        userId,
        action: "RELEASE_BED",
        entityType: "BED",
        entityId: bedId,
        newValue: { isOccupied: false },
        ipAddress,
      });

      return bed;
    } catch (error) {
      if (error.message === "BED_NOT_FOUND") {
        throw new AppError("Bed not found.", HTTP_STATUS.NOT_FOUND);
      }
      throw error;
    }
  }
}
