import { db } from "../config/db.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class EmergencyService {
  // BLOOD BANK
  static async addBloodUnit({
    tenantId,
    userId,
    bloodGroup,
    unitsAvailable,
    storageLocation,
    ipAddress,
  }) {
    const bloodStock = await db.blood_bank.create({
      data: {
        tenant_id: tenantId,
        blood_group: bloodGroup, // e.g., 'A+', 'O-'
        units_available: Number(unitsAvailable),
        storage_location: storageLocation,
      },
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "ADD_BLOOD_STOCK",
      entityType: "BLOOD_BANK",
      entityId: bloodStock.blood_id,
      newValue: { bloodGroup, unitsAvailable },
      ipAddress,
    });
    return bloodStock;
  }

  static async listBloodStock({ tenantId }) {
    return db.blood_bank.findMany({ where: { tenant_id: tenantId } });
  }

  // AMBULANCE FLEET
  static async dispatchAmbulance({
    tenantId,
    userId,
    vehicleNumber,
    driverName,
    driverPhone,
    destination,
    emergencyLevel,
    ipAddress,
  }) {
    const dispatch = await db.ambulance_dispatch.create({
      data: {
        tenant_id: tenantId,
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        driver_phone: driverPhone,
        destination,
        emergency_level: emergencyLevel || "URGENT",
        status: "DISPATCHED",
      },
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "DISPATCH_AMBULANCE",
      entityType: "AMBULANCE",
      entityId: dispatch.dispatch_id,
      newValue: { vehicleNumber, destination },
      ipAddress,
    });
    return dispatch;
  }

  // OPERATION THEATER (OT)
  static async scheduleSurgery({
    tenantId,
    userId,
    patientId,
    doctorId,
    otRoomNumber,
    surgeryName,
    scheduledAt,
    ipAddress,
  }) {
    const surgery = await db.operation_theater.create({
      data: {
        tenant_id: tenantId,
        patient_id: patientId,
        doctor_id: doctorId,
        ot_room_number: otRoomNumber,
        surgery_name: surgeryName,
        scheduled_at: new Date(scheduledAt),
        status: "SCHEDULED",
      },
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "SCHEDULE_SURGERY",
      entityType: "OT",
      entityId: surgery.surgery_id,
      newValue: { surgeryName, otRoomNumber, scheduledAt },
      ipAddress,
    });
    return surgery;
  }
}
