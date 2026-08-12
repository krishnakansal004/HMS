import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/authValidator.js';
// Note: Assuming doubleCsrfProtection middleware is imported here if implemented globally
// import { doubleCsrfProtection } from '../middlewares/csrfMiddleware.js'; 

const router = express.Router();

// Strict Auth Rate Limiter (e.g., max 5 attempts per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint: POST /api/auth/register
// Roles: Public
router.post(
  '/register', 
  authLimiter, 
  // doubleCsrfProtection, // Uncomment when CSRF is configured in app.js
  registerValidator, 
  AuthController.register
);

// Endpoint: POST /api/auth/login
// Roles: Public
router.post(
  '/login', 
  authLimiter, 
  // doubleCsrfProtection,
  loginValidator, 
  AuthController.login
);

// Endpoint: POST /api/auth/logout
// Roles: Authenticated Users
router.post(
  '/logout', 
  AuthController.logout
);

export default router;