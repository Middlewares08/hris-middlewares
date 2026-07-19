// src/index.js
require('dotenv').config(); // Load environment variables from .env immediately
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 4000;

// ==========================================
// Global Middleware / Plugins
// ==========================================
app.use(helmet()); // Secure HTTP headers to shield against common vulnerabilities
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173', // Only allow your React frontend to connect
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json()); // Parses incoming json request payloads automatically

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


// ==========================================
// Server Initialization
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 HRIS Engine booting up...`);
    console.log(`📡 Listening on: http://localhost:${PORT}`);
});