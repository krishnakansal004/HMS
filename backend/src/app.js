import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import appointmentRoutes from './routes/appointments.js';
import admissionRoutes from './routes/admissions.js';
import attendanceRoutes from './routes/attendance.js';
import inventoryRoutes from './routes/inventory.js';
import invoiceRoutes from './routes/invoices.js';
import labRoutes from './routes/lab.js';
import radiologyRoutes from './routes/radiology.js';
import insuranceRoutes from './routes/insurance.js';
import wardRoutes from './routes/wards.js';
import purchaseRoutes from './routes/purchases.js';
import expenseRoutes from './routes/expenses.js';
import availabilityRoutes from './routes/availability.js';
import prescriptionRoutes from './routes/prescriptions.js';
import settingsRoutes from './routes/settings.js';
import plansRoutes from './routes/plans.js';
import tenantsRoutes from './routes/tenants.js';
import planRequestsRoutes from './routes/planRequests.js';

const app = express();

// Security & Utility Middlewares
app.use(helmet());
app.use(cors({
  // env.allowedOrigins resolves ALLOWED_ORIGINS into an array (see
  // config/env.js) — never a literal '*'. That fallback was broken, not
  // just permissive: '*' combined with credentials:true is a combination
  // browsers reject outright, so an unset ALLOWED_ORIGINS in production
  // would silently break every credentialed cross-origin request rather
  // than "openly" allow them. env.js now fails loudly at startup in
  // production if ALLOWED_ORIGINS isn't set, instead of masking it here.
  origin: env.allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('combined'));

// API Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Hospital Management System API is online and healthy.', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/radiology', radiologyRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/plan-requests', planRequestsRoutes);

// Catch-all 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found on this server.` });
});

// Global Error Handler (Must be registered last)
app.use(errorHandler);

export default app;