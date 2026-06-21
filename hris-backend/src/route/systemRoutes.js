// src/route/systemRoutes.js
const express = require('express');
const router = express.Router();
const { initializeFirstUser } = require('../module/admin/controller/employee/init.user.controller'); // Double check this relative path matches your directory setup

// Register the POST endpoint
router.post('/init', initializeFirstUser);

module.exports = router;