import express from "express";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { createSupplierValidator, supplierIdValidator, updateSupplierValidator } from '../validators/supplierValidator.js';
import { SupplierController } from '../controllers/supplierController.js';

const router = express.Router();
router.use(protect);
router.use(requireTenant);

router.get(
  "/", 
  requireRoles("HOSPITAL_ADMIN", "PHARMACIST", "STORE_MANAGER", "ACCOUNTANT"), 
  SupplierController.list);

router.post(
  '/', 
  requireRoles('HOSPITAL_ADMIN', 'STORE_MANAGER'), createSupplierValidator, 
  SupplierController.create);
  
router.patch(
  '/:id', 
  requireRoles('HOSPITAL_ADMIN', 'STORE_MANAGER'), updateSupplierValidator, 
  SupplierController.update);
  
router.delete(
  '/:id', 
  requireRoles('HOSPITAL_ADMIN', 'STORE_MANAGER'), supplierIdValidator, 
  SupplierController.remove);

export default router;