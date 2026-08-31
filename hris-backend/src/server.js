// src/index.js
require('dotenv').config(); // Load environment variables from .env immediately
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 4000;

// ==========================================
// Global Middleware / Plugins
// ==========================================
app.use(helmet()); // Secure HTTP headers to shield against common vulnerabilities

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }, // Only allow your React frontend(s) to connect
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Kiosk-Token']
}));

app.use(express.json()); // Parses incoming json request payloads automatically
app.use(cookieParser()); // Populates req.cookies (needed by /auth/refresh)

// ==========================================
// Base Health Check Route
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==========================================
// Modular Feature Routing Boundaries
// ==========================================
// Example placement for future routes:
// const recruitmentRoutes = require('./recruitment/recruitment.routes');
// app.use('/api', recruitmentRoutes);


// SYSTEM ROUTES
const systemRoutes = require('../src/route/systemRoutes');
app.use('/system', systemRoutes);


// AUTH ROUTE
const authRoutes = require("../src/route/authRoutes");
app.use('/auth', authRoutes);

// MODULE
const moduleRoutes = require("../src/route/admin/moduleRoutes");
app.use('/modules', moduleRoutes);


// ROLES AND PERMISSION
const rolesAndPermissionRoutes = require("../src/route/admin/rolesAndPermissionRoutes");
app.use('/roles', rolesAndPermissionRoutes);
app.use('/role-permissions', rolesAndPermissionRoutes);


// LOOKUP
const lookupRoutes = require("../src/route/admin/lookupRoutes");
app.use('/lookups', lookupRoutes);


// EMPLOYEE
const employeeRoutes = require("../src/route/admin/employeeRoutes");
app.use('/employee', employeeRoutes);


// ATTENDANCE
const attendanceRoutes = require("../src/route/admin/attendanceRoutes");
app.use('/attendance', attendanceRoutes);


// FACE RECOGNITION (biometric enrollment for clock-in)
const faceEnrollmentRoutes = require("../src/route/admin/faceEnrollmentRoutes");
app.use('/face-enrollment', faceEnrollmentRoutes);


// FACE LIVENESS (anti-spoofing challenge sessions)
const faceLivenessRoutes = require("../src/route/admin/faceLivenessRoutes");
app.use('/face-liveness', faceLivenessRoutes);


// ATTENDANCE KIOSK (shared face-recognition clock-in/out device)
const kioskRoutes = require("../src/route/admin/kioskRoutes");
app.use('/kiosk', kioskRoutes);


// LEAVE REQUESTS
const leaveRequestRoutes = require("../src/route/admin/leaveRequestRoutes");
app.use('/leave-requests', leaveRequestRoutes);


// OVERTIME REQUESTS
const overtimeRequestRoutes = require("../src/route/admin/overtimeRequestRoutes");
app.use('/overtime-requests', overtimeRequestRoutes);


// EMPLOYEE DOCUMENTS (library + requests, self-service + admin)
const documentRoutes = require("../src/route/admin/documentRoutes");
app.use('/documents', documentRoutes);


// ACTIVITY LOGS
const activityLogRoutes = require("../src/route/admin/activityLogRoutes");
app.use('/activity-logs', activityLogRoutes);


// ANNOUNCEMENTS
const announcementRoutes = require("../src/route/admin/announcementRoutes");
app.use('/announcements', announcementRoutes);


// PAYROLL
const payrollRoutes = require("../src/route/admin/payrollRoutes");
app.use('/payroll', payrollRoutes);


// DASHBOARD ANALYTICS
const dashboardRoutes = require("../src/route/admin/dashboardRoutes");
app.use('/dashboard', dashboardRoutes);


// ==========================================
// Server Initialization
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 HRIS Engine booting up...`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
});