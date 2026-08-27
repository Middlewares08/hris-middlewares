// src/module/admin/controller/payroll/_helpers.js
// Shared plumbing for the payroll controllers.

// Ensure the Objection <-> Knex binding is established even if a payroll module is
// required before the controllers that historically pull it in.
require('../../../../database/connection');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actorId = (req) => {
    const raw = req.user?.id;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
};

// Attach the acting user so model $before hooks can stamp created_by / updated_by.
const withActor = (req) => ({ user: { id: actorId(req) } });

const ok = (res, data, extra = {}) => res.status(200).json({ success: true, data, ...extra });
const created = (res, data) => res.status(201).json({ success: true, data });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Consistent 500 handler — logs server-side, never leaks a stack to the client.
const serverError = (res, scope, error) => {
    console.error(`[payroll:${scope}]`, error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
        success: false,
        message: status === 500 ? 'Server error while processing the payroll request.' : error.message,
    });
};

const parsePagination = (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    return { page, limit, offset: (page - 1) * limit };
};

const paginationMeta = (total, page, limit) => ({
    totalRecords: total,
    currentPage: page,
    recordsPerPage: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
});

const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v ?? ''));
const isValidNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const trimOrNull = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Strip `undefined` keys so Objection .patch() never nulls an untouched column.
const definedOnly = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

module.exports = {
    UUID_RE,
    actorId,
    withActor,
    ok,
    created,
    fail,
    serverError,
    parsePagination,
    paginationMeta,
    isValidDate,
    isValidNumber,
    toBool,
    trimOrNull,
    round2,
    definedOnly,
};
