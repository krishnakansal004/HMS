import express from "express";
import { AuthController } from "../controllers/authController.js";
import {
  registerValidator,
  loginValidator,
  setupPasswordValidator,
} from "../validators/authValidator.js";
import { authLimiter } from "../middlewares/rateLimiters.js";
import { requireCsrfHeader } from "../middlewares/csrfMiddleware.js";

const router = express.Router();

// Endpoint: POST /api/auth/register
// Roles: Public
// No requireCsrfHeader here — register never reads or writes the
// refreshToken cookie (see authController.js), so it isn't part of the
// login-CSRF vector requireCsrfHeader exists to close.
router.post(
  "/register",
  authLimiter,
  registerValidator,
  AuthController.register,
);

// Endpoint: POST /api/auth/login
// Roles: Public
// requireCsrfHeader matters here specifically: login is the one place an
// unprotected cross-site POST could plant an *attacker's* refreshToken
// cookie in a victim's browser. See csrfMiddleware.js for the full
// reasoning.
router.post(
  "/login",
  authLimiter,
  requireCsrfHeader,
  loginValidator,
  AuthController.login,
);

// Endpoint: POST /api/auth/logout
// Roles: Authenticated Users
router.post(
  "/logout", 
  requireCsrfHeader, 
  AuthController.logout);

router.post(
  "/setup-password",
  authLimiter,
  setupPasswordValidator,
  AuthController.setupPassword,
);
// Endpoint: POST /api/auth/refresh
// Roles: Public (gated by possession of a valid refreshToken cookie, not
// a login session — this IS the thing that renews the login session).
// Not behind authLimiter: it's not a credential-guessing surface, the
// signed cookie is the gate, and rate-limiting it would undermine the
// silent-renewal UX it exists for. requireCsrfHeader still applies since
// it's cookie-gated like login/logout.
router.post(
  "/refresh", 
  requireCsrfHeader, 
  AuthController.refresh);

export default router;
