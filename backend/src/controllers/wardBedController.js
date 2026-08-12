import { WardBedService } from '../services/wardBedService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class WardBedController {
  
  static async createWard(req, res, next) {
    try {
      const ward = await WardBedService.createWard({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Ward created successfully',
        data: ward
      });
    } catch (error) {
      next(error);
    }
  }

  static async listWards(req, res, next) {
    try {
      const wards = await WardBedService.listWards({
        tenantId: req.currentTenantId
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: wards
      });
    } catch (error) {
      next(error);
    }
  }

  static async addBed(req, res, next) {
    try {
      const bed = await WardBedService.addBed({
        tenantId: req.currentTenantId,
        userId: req.userId,
        wardId: req.params.wardId,
        bedNumber: req.body.bedNumber,
        pricePerDay: req.body.pricePerDay,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Bed added to ward successfully',
        data: bed
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignBed(req, res, next) {
    try {
      const bed = await WardBedService.assignBed({
        tenantId: req.currentTenantId,
        userId: req.userId,
        bedId: req.params.bedId,
        patientId: req.body.patientId,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Bed assigned to patient successfully',
        data: bed
      });
    } catch (error) {
      next(error);
    }
  }

  static async releaseBed(req, res, next) {
    try {
      const bed = await WardBedService.releaseBed({
        tenantId: req.currentTenantId,
        userId: req.userId,
        bedId: req.params.bedId,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Bed released successfully',
        data: bed
      });
    } catch (error) {
      next(error);
    }
  }
}