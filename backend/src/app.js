

import rateLimit from 'express-rate-limit';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRouter from './routes/auth.js';
import { authMiddleware } from './utils/auth.js';
import tenantMiddleware from './utils/tenant.js';
import medicinesRouter from './routes/medicines.js';
import suppliersRouter from './routes/suppliers.js';
import purchasesRouter from './routes/purchases.js';
import invoicesRouter from './routes/invoices.js';
import reportsRouter from './routes/reports.js';
import appointmentsRouter from './routes/appointments.js';
import availabilityRouter from './routes/availability.js';
import doctorsRouter from './routes/doctors.js';
import staffRouter from './routes/staff.js';
import wardRouter from './routes/wards.js';
import patientRouter from './routes/patients.js';
import prescriptionRouter from './routes/prescriptions.js';
import shiftRouter from './routes/shifts.js';
import queueRouter from './routes/queue.js';
import attendanceRouter from './routes/attendance.js';
import doctorAttendanceRouter from './routes/doctorAttendance.js';
import leavesRouter from './routes/leaves.js';
import prescriptionTemplatesRouter from './routes/prescriptionTemplates.js';
import paymentsRouter from './routes/payments.js';
import publicRouter from './routes/public.js';
import doctorApplicationsRouter from './routes/doctorApplications.js';
import chatRouter from './routes/chat.js';
import faqsRouter from './routes/faqs.js';
import queriesRouter from './routes/queries.js';
import chatModelsRouter from './routes/chatModels.js';
import directorStatsRouter from './routes/directorStats.js';
import directorAdminsRouter from './routes/directorAdmins.js';
import planRequestsRouter from './routes/planRequests.js';
import planReceiptsRouter from './routes/planReceipts.js';
import plansRouter from './routes/plans.js';
import tenantsRouter from './routes/tenants.js';
import customizationRequestsRouter from './routes/customizationRequests.js';
import settingsRouter from './routes/settings.js';
import uploadsRouter from './routes/uploads.js';
import FirestoreModel from './models/firestore/FirestoreModel.js';
import expensesRouter from './routes/expenses.js';
import labRouter from './routes/lab.js';
import radiologyRouter from './routes/radiology.js';
import insuranceRouter from './routes/insurance.js';
import otRouter from './routes/ot.js';
import bloodbankRouter from './routes/bloodbank.js';
import ambulanceRouter from './routes/ambulance.js';
import hrmsRouter from './routes/hrms.js';
import abdmRouter from './routes/abdm.js';
import telemedicineRouter from './routes/telemedicine.js';
import analyticsRouter from './routes/analytics.js';
import auditRouter from './routes/audit.js';
import { telemetryMiddleware } from './utils/telemetry.js';

export function createApp(opts = {}) {

  const app = express();
//express-rate-limit global rate limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message:{
      error:"Too many requests, please try again later"
    }
  });

  app.use(limiter);
 

  app.use(telemetryMiddleware);
  app.set('trust proxy', 1); // Trust first proxy (Render/Vercel)
  const envCors = (process.env.CORS_ORIGIN || '').trim();
  const defaultCors = 'http://localhost:5173,http://localhost:5174,http://localhost:5175,https://hms-lovat-one.vercel.app,https://hms-backend-jwe6.onrender.com';
  const rawCors = envCors === '*' ? '*' : `${envCors},${defaultCors}`;
  const allowAny = rawCors === '*';
  const allowedOrigins = allowAny
    ? []
    : rawCors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  // Precompute wildcard patterns (like *.vercel.app)
  const wildcardPatterns = allowedOrigins
    .filter((s) => s.startsWith('*.'))
    .map((s) => s.slice(2));

  const corsOptions = {
    credentials: true,
    origin: (origin, callback) => {
      // Non-browser requests (e.g. curl, server-to-server) have no origin
      if (!origin) return callback(null, true);
      if (allowAny) return callback(null, origin); // Dynamic origin mirroring for credentials support
      if (allowedOrigins.includes(origin)) return callback(null, origin);
      // Match wildcard suffixes
      for (const suffix of wildcardPatterns) {
        if (origin.endsWith(suffix)) return callback(null, origin);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  };
  app.use(cors(corsOptions));

  // Preserve raw body for Razorpay webhook so signature verification works.
  // Register a raw parser only for the webhook path before the global JSON parser.
  app.use(
    '/api/payments/razorpay/webhook',
    express.raw({ type: 'application/json' })
  );

  // Strict Helmet Configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com", "https://checkout-static-next.razorpay.com"], // Allow Razorpay checkout scripts
        styleSrc: ["'self'", "'unsafe-inline'", "https:"], // Allowed for common UI libraries
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "https://api.razorpay.com", "https://checkout.razorpay.com"], // Allow Razorpay connections
        frameSrc: ["'self'", "https://checkout.razorpay.com"], // Allow Razorpay iframe
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Required for loading images from this API across domains
  }));
  // Extra helmet protections
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(compression());
  app.use(express.json());
  app.use(mongoSanitize());
  app.use(cookieParser());

  // Global db/tenant resolver for routes that do not run protect/tenantMiddleware
  app.use((req, res, next) => {
    req.db = (modelOrName) => {
      const tenantId = req.tenantId || (req.user && req.user.tenantId) || null;
      if (typeof modelOrName === 'string') {
        return new FirestoreModel(modelOrName, tenantId);
      }
      return modelOrName.forHospital(tenantId);
    };
    next();
  });

  // Secure uploads router instead of static files
  app.use('/uploads', uploadsRouter);
  // Health check endpoint
  // Hitting this endpoint when the user opens the payment modal wakes the cold-start
  // dyno in the background before they click "Pay".
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: Date.now() })
  });

  // Public endpoints
  app.use('/public', publicRouter);
  // app.post('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/medicines', medicinesRouter);
  // Legacy inventory endpoint (alias for medicines)
  app.use('/api/inventory', medicinesRouter);
  app.use('/api/suppliers', authMiddleware, tenantMiddleware, suppliersRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/invoices', (req, res, next) => {
    // Exclude GET /api/invoices/:id (excluding GET /api/invoices/my) and POST /api/invoices/:id/pay from auth/tenant checks
    const isPublicInvoiceRoute = (req.method === 'GET' && req.path.match(/^\/[a-zA-Z0-9_-]+$/) && !req.path.includes('/my') && !req.path.includes('my')) ||
                                 (req.method === 'POST' && req.path.match(/^\/[a-zA-Z0-9_-]+\/pay$/));
    if (isPublicInvoiceRoute) {
      req.userId = null;
      req.userRole = null;
      req.db = (modelOrName) => {
        if (typeof modelOrName === 'string') return new FirestoreModel(modelOrName, null);
        return modelOrName.forHospital(null);
      };
      return next();
    }
    authMiddleware(req, res, (err) => {
      if (err) return next(err);
      tenantMiddleware(req, res, next);
    });
  }, invoicesRouter);
  app.use('/api/reports', authMiddleware, tenantMiddleware, reportsRouter);
  app.use('/api/expenses', authMiddleware, expensesRouter);
  app.use('/api/lab', authMiddleware, tenantMiddleware, labRouter);
  app.use('/api/radiology', authMiddleware, tenantMiddleware, radiologyRouter);
  app.use('/api/insurance', authMiddleware, tenantMiddleware, insuranceRouter);
  app.use('/api/ot', authMiddleware, tenantMiddleware, otRouter);
  app.use('/api/bloodbank', authMiddleware, tenantMiddleware, bloodbankRouter);
  app.use('/api/ambulance', authMiddleware, tenantMiddleware, ambulanceRouter);
  app.use('/api/hrms', authMiddleware, tenantMiddleware, hrmsRouter);
  app.use('/api/abdm', authMiddleware, tenantMiddleware, abdmRouter);
  app.use('/api/telemedicine', authMiddleware, tenantMiddleware, telemedicineRouter);
  app.use('/api/analytics', authMiddleware, tenantMiddleware, analyticsRouter);
  app.use('/api/audit', authMiddleware, tenantMiddleware, auditRouter);
  // Legacy routes for compatibility (frontend calls these directly)
  app.get('/api/summary', authMiddleware, tenantMiddleware, async (req, res, next) => {
    req.url = '/summary';
    reportsRouter.handle(req, res, next);
  });
  app.get('/api/sales/weekly', authMiddleware, tenantMiddleware, async (req, res, next) => {
    req.url = '/sales/weekly';
    reportsRouter.handle(req, res, next);
  });
  app.get('/api/sales/daily', authMiddleware, tenantMiddleware, async (req, res, next) => {
    req.url = '/sales/daily';
    reportsRouter.handle(req, res, next);
  });
  app.use('/api/appointments', authMiddleware, tenantMiddleware, appointmentsRouter);
  app.use('/api/availability', authMiddleware, tenantMiddleware, availabilityRouter);
  app.use('/api/doctors', authMiddleware, tenantMiddleware, doctorsRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/wards', authMiddleware, tenantMiddleware, wardRouter);
  app.use('/api/patients', authMiddleware, tenantMiddleware, patientRouter);
  app.use('/api/prescriptions', authMiddleware, tenantMiddleware, prescriptionRouter);
  app.use('/api/shifts', shiftRouter);
  app.use('/api/queue', authMiddleware, tenantMiddleware, queueRouter);
  app.use('/api/attendance', authMiddleware, tenantMiddleware, attendanceRouter);
  app.use('/api/doctor-attendance', authMiddleware, tenantMiddleware, doctorAttendanceRouter);
  app.use('/api/leaves', authMiddleware, tenantMiddleware, leavesRouter);
  app.use('/api/prescription-templates', authMiddleware, tenantMiddleware, prescriptionTemplatesRouter);
  // Payments router contains its own route-level protection where needed
  app.use('/api/payments', paymentsRouter);
  app.use('/api/doctor-applications', authMiddleware, tenantMiddleware, doctorApplicationsRouter);
  // Queries router has protect middleware in routes, so no need for authMiddleware here
  app.use('/api/queries', queriesRouter);
  // Director-specific report/stats endpoints (protected)
  app.use('/api/director', authMiddleware, directorStatsRouter);
  app.use('/api/director', authMiddleware, directorAdminsRouter);
  // Plan requests submitted from public site
  app.use('/api/plan-requests', planRequestsRouter);
  // Plan receipts (director/admin view)
  app.use('/api/plan-receipts', planReceiptsRouter);
  // FAQs (public GET, admin CRUD)
  app.use('/api/faqs', faqsRouter);
  app.use('/api/chat-models', chatModelsRouter);
  app.use('/api/customization-requests', customizationRequestsRouter);
  // SaaS management: plans and tenants
  app.use('/api/plans', plansRouter);
  app.use('/api/tenants', tenantsRouter);
  app.use('/api/settings', settingsRouter);
  // Chat endpoint: optional auth inside route; keep public so widget works for guests
  app.use('/api/chat', chatRouter);

  // Serve frontend (SPA) in production: point to ../frontend/dist
  // Behavior:
  // - If FRONTEND_URL env var is set, redirect non-API requests to that URL (useful when frontend is hosted on Vercel).
  // - Otherwise, only serve static files from ../frontend/dist when the built files are present.
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    const indexPath = path.join(frontendDist, 'index.html');

    const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim();
    if (FRONTEND_URL) {
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
        const target = FRONTEND_URL.replace(/\/$/, '') + req.originalUrl;
        return res.redirect(302, target);
      });
    } else if (fs.existsSync(indexPath)) {
      app.use(express.static(frontendDist));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
        res.sendFile(indexPath);
      });
    }
  } catch (e) {
    console.error('Error while configuring frontend static serving', e);
  }

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error(`[Error] ${new Date().toISOString()} ${req.method} ${req.url}`, err);
    const status = err.status || 500;
    const message = (process.env.NODE_ENV === 'production' && status === 500)
      ? 'Internal Server Error'
      : (err.message || 'Something went wrong');

    res.status(status).json({
      error: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  });

  return app;
}

export default createApp;