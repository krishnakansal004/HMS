import express from "express";
import { ExpenseController } from "../controllers/expenseController.js";
import {
  createExpenseValidator,
  deleteExpenseValidator,
  listExpensesValidator,
} from "../validators/expenseValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanFeature } from "../utils/saas.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);
router.use(requirePlanFeature("billing"));

// GET /api/expenses
// Who: Hospital Admin, Accountant
router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT"),
  listExpensesValidator,
  ExpenseController.list,
);

// POST /api/expenses
// Who: Hospital Admin, Accountant, HR (for salaries)
router.post(
  "/",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "HR"),
  createExpenseValidator,
  ExpenseController.create,
);

// DELETE /api/expenses/:id
// Who: Hospital Admin, Accountant
router.delete(
  "/:id",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT"),
  deleteExpenseValidator,
  ExpenseController.remove,
);

export default router;
