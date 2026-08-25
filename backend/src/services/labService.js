import { LabRepository } from "../repositories/labRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class LabService {
  static async createTestCatalogItem({ tenantId, userId, data, ipAddress }) {
    const price = Math.round(Number(data.price) * 100); // Store in minor currency

    const test = await LabRepository.createTest(tenantId, {
      name: data.name,
      code: data.code,
      category: data.category,
      sample_type: data.sampleType,
      price,
      reference_range: data.referenceRange,
      parameters: data.parameters || {},
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_LAB_TEST_CATALOG",
      entityType: "LAB_TEST",
      entityId: test.test_id,
      newValue: { name: test.name, code: test.code },
      ipAddress,
    });

    return test;
  }

  static async orderLabTest({
    tenantId,
    userId,
    patientId,
    testId,
    doctorProfileId,
    prescriptionId,
    ipAddress,
  }) {
    // Verify Test exists in catalog
    const testCatalog = await LabRepository.findTestById(tenantId, testId);
    if (!testCatalog || testCatalog.status !== "active") {
      throw new AppError(
        "Requested lab test not found or inactive in catalog.",
        HTTP_STATUS.NOT_FOUND,
      );
    }

    // Fetch patient to snapshot name
    const patient = await db.patient.findFirst({
      where: { patient_id: patientId, tenant_id: tenantId },
    });
    if (!patient) {
      throw new AppError("Patient not found.", HTTP_STATUS.NOT_FOUND);
    }

    // Create Lab Order
    const labOrder = await LabRepository.createOrder(tenantId, {
      patient_id: patientId,
      patient_name_snapshot:
        `${patient.first_name} ${patient.last_name || ""}`.trim(),
      test_id: testId,
      test_name_snapshot: testCatalog.name,
      test_code_snapshot: testCatalog.code,
      doctor_id: doctorProfileId || null,
      prescription_id: prescriptionId || null,
      sample_status: "pending", // pending -> collected -> processing -> completed -> cancelled
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "ORDER_LAB_TEST",
      entityType: "LAB_ORDER",
      entityId: labOrder.lab_order_id,
      newValue: { patientId, testName: testCatalog.name },
      ipAddress,
    });

    return labOrder;
  }

  static async updateLabResults({
    tenantId,
    userId,
    orderId,
    sampleStatus,
    technicianNotes,
    results,
    invoiceId,
    ipAddress,
  }) {
    const order = await LabRepository.findOrderById(tenantId, orderId);
    if (!order) {
      throw new AppError("Lab order not found.", HTTP_STATUS.NOT_FOUND);
    }

    const validStatuses = [
      "pending",
      "collected",
      "processing",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(sampleStatus)) {
      throw new AppError(
        "Invalid sample status provided.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // If moving to completed, we can automatically push a billing item if an invoiceId is supplied
    const shouldBill =
      sampleStatus === "completed" && order.billing_status !== "billed";
    let billingItem = null;

    if (shouldBill) {
      const testDef = await LabRepository.findTestById(tenantId, order.test_id);
      billingItem = {
        description: `Lab Test: ${order.test_name_snapshot}`,
        quantity: 1,
        unitPrice: Number(testDef?.price || 0),
        gstRate: 0,
      };
    }

    const updatedOrder = await LabRepository.updateOrderStatusTransaction({
      tenantId,
      orderId,
      sampleStatus,
      technicianNotes,
      results,
      shouldBill,
      invoiceId,
      billingItem,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_LAB_ORDER_STATUS",
      entityType: "LAB_ORDER",
      entityId: order.lab_order_id,
      oldValue: { sample_status: order.sample_status },
      newValue: { sample_status: sampleStatus, billed: shouldBill },
      ipAddress,
    });

    return updatedOrder;
  }

  static async getOrders({ tenantId, query }) {
    const { patientId, status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, orders] = await LabRepository.findOrdersPaginated({
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
