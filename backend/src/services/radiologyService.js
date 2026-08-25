import { RadiologyRepository } from "../repositories/radiologyRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db } from "../config/db.js";

export class RadiologyService {
  static async orderRadiologyStudy({
    tenantId,
    userId,
    patientId,
    doctorProfileId,
    modality,
    studyType,
    bodyPart,
    urgency,
    price,
    notes,
    ipAddress,
  }) {
    // Verify Patient exists
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId },
    });
    if (!patient) {
      throw new AppError("Patient not found.", HTTP_STATUS.NOT_FOUND);
    }

    const formattedPrice = Math.round(Number(price || 0) * 100); // Store minor currency

    // Create Radiology Order
    const order = await RadiologyRepository.createOrder(tenantId, {
      patient_id: patientId,
      patient_name_snapshot:
        `${patient.first_name} ${patient.last_name || ""}`.trim(),
      doctor_id: doctorProfileId || null,
      modality, // X-RAY, MRI, CT, ULTRASOUND, ECG
      study_type: studyType,
      body_part: bodyPart || null,
      urgency: urgency || "routine",
      price: formattedPrice,
      notes: notes || null,
      status: "ordered",
      billing_status: "unbilled",
    });

    // Audit
    AuditService.logAction({
      tenantId,
      userId,
      action: "ORDER_RADIOLOGY_STUDY",
      entityType: "RADIOLOGY_ORDER",
      entityId: order.radiology_order_id,
      newValue: { patientId, modality, studyType },
      ipAddress,
    });

    return order;
  }

  static async updateRadiologyStatus({
    tenantId,
    userId,
    orderId,
    status,
    findings,
    impression,
    scanMetadata,
    invoiceId,
    ipAddress,
  }) {
    const order = await RadiologyRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new AppError("Radiology order not found.", HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = [
      "ordered",
      "scheduled",
      "scanning",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        "Invalid radiology order status.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Determine if billing charge should be triggered upon completion
    const shouldBill =
      status === "completed" && order.billing_status !== "billed";
    let billingItem = null;

    if (shouldBill) {
      billingItem = {
        description: `Radiology: ${order.modality} - ${order.study_type}`,
        quantity: 1,
        unitPrice: Number(order.price || 0),
        gstRate: 0,
      };
    }

    const updatedOrder = await RadiologyRepository.updateOrderTransaction({
      tenantId,
      orderId,
      status,
      findings,
      impression,
      scanMetadata,
      shouldBill,
      invoiceId,
      billingItem,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: `UPDATE_RADIOLOGY_STATUS_${status.toUpperCase()}`,
      entityType: "RADIOLOGY_ORDER",
      entityId: orderId,
      oldValue: { status: order.status },
      newValue: { status, billed: shouldBill },
      ipAddress,
    });

    return updatedOrder;
  }

  static async getOrders({ tenantId, query }) {
    const { patientId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, orders] = await RadiologyRepository.findOrdersPaginated({
      tenantId,
      patientId,
      status,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: orders,
    };
  }
}
