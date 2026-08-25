import express from "express";
import { db } from "../config/db.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();
router.use(protect);
router.use(requireTenant);

// GET /api/suppliers
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "PHARMACIST", "STORE_MANAGER"),
  async (req, res, next) => {
    try {
      const suppliers = await db.supplier.findMany({
        where: { tenant_id: req.currentTenantId },
        orderBy: { name: "asc" },
        select: { supplier_id: true, name: true },
      });
      res.status(200).json({ success: true, data: suppliers });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
