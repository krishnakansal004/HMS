import express from "express";
import { QueryController } from "../controllers/queryController.js";
import {
  submitQueryValidator,
  updateQueryStatusValidator,
  listQueriesValidator,
} from "../validators/queryValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Public submission -- no auth, this is the marketing-site contact form.
router.post("/", submitQueryValidator, QueryController.submit);

// Everything past this point is internal, tenant-scoped triage of a
// hospital's own inbound queries. Does NOT include a cross-tenant "see
// every unassigned lead" view for SYSTEM_OWNER -- that needs a real
// session-variable-based RLS exception (see migration 0058's notes) that
// hasn't been built yet, not something to fake here.
router.use(protect);
router.use(requireTenant);

router.get(
  "/",
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  listQueriesValidator,
  QueryController.list,
);
router.patch(
  "/:id/status",
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  updateQueryStatusValidator,
  QueryController.updateStatus,
);

export default router;
