import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import eventsRouter from './routes/events.routes.js';
import registrationsRouter from './routes/registrations.routes.js';
import adminRouter from './routes/admin.routes.js';
import profileRouter from './routes/profile.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const allowedOrigins = process.env.CLIENT_ORIGIN 
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Dev-permissive
  },
  credentials: true
}));

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'CampusPulse API Engine',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Public Client Config Endpoint
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
    }
  });
});

// Mount Application API Routers
app.use('/api/events', eventsRouter);
app.use('/api', registrationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/me', profileRouter);

// 404 and Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
