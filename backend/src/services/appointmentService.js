import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class AppointmentService {
  
  static async bookAppointment({ tenantId, userId, doctorId, patientId, startTime, endTime, type, notes, ipAddress }) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Business Rule: End time must be after start time
    if (start >= end) {
      throw new AppError('Appointment end time must be after start time.', HTTP_STATUS.BAD_REQUEST);
    }

    // 2. Business Rule: Prevent past bookings
    if (start < new Date()) {
      throw new AppError('Cannot book appointments in the past.', HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Business Rule: Doctor cannot be double-booked
    const overlap = await AppointmentRepository.checkOverlap(doctorId, start, end);
    if (overlap) {
      throw new AppError('The doctor is already booked for this time slot.', HTTP_STATUS.CONFLICT);
    }

    // 4. Create the appointment
    const appointment = await AppointmentRepository.create({
      tenantId,
      doctorId,
      patientId,
      date: start, // Derived for easy querying
      startTime: start,
      endTime: end,
      type,
      notes,
      status: 'SCHEDULED'
    });

    // 5. Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: 'CREATE_APPOINTMENT',
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      newValue: appointment,
      ipAddress
    });

    // TODO: Enqueue Notification Job to BullMQ (Email/SMS to patient and doctor)
    
    return appointment;
  }

  static async getAppointments({ tenantId, query }) {
    const { doctorId, patientId, status, date, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, appointments] = await AppointmentRepository.findManyPaginated({
      tenantId, doctorId, patientId, status, date, skip, take
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / take),
      data: appointments
    };
  }

  static async updateAppointmentStatus({ tenantId, userId, appointmentId, status, reason, ipAddress }) {
    // 1. Ensure appointment belongs to the tenant
    const appointment = await AppointmentRepository.findByIdAndTenant(appointmentId, tenantId);
    if (!appointment) {
      throw new AppError('Appointment not found.', HTTP_STATUS.NOT_FOUND);
    }

    // 2. Business Rule: Cannot modify a cancelled or completed appointment state randomly
    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      throw new AppError(`Cannot update status of a ${appointment.status} appointment.`, HTTP_STATUS.BAD_REQUEST);
    }

    // 3. Perform Update
    const updated = await AppointmentRepository.updateStatus(appointmentId, status, reason);

    // 4. Audit Logging
    AuditService.logAction({
      tenantId,
      userId,
      action: `UPDATE_APPOINTMENT_STATUS_TO_${status}`,
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      oldValue: { status: appointment.status },
      newValue: { status: updated.status, reason: updated.reason },
      ipAddress
    });

    return updated;
  }
}