// src/utils/licenseGuard.js
//
// Shared expiration check for both the login gate (always enforced — a new
// login is refused whenever the license is expired, no matter the mode) and
// the per-request kick-out in authMiddleware.verifyToken (only enforced when
// `license.hard_enforcement` is on). Cached briefly so a DB round-trip isn't
// added to every single authenticated request.
const LicenseActivation = require('../database/models/system/LicenseActivation');
const Setting = require('../database/models/system/Setting');

const CACHE_TTL_MS = 60_000;
const FAIL_OPEN_STATE = { hasLicense: true, pastExpiry: false, blocked: false, expiresAt: null, licenseType: null };
let cache = { state: { hasLicense: false, pastExpiry: false, blocked: true, expiresAt: null, licenseType: null }, checkedAt: 0 };

/**
 * Full picture of the license currently governing this deployment — `blocked`
 * is true when there's no activation on record at all (a deployment only
 * ever gets one via Install or a re-activation) OR the one on record is past
 * its `expires_at`. Distinguishing "none" from "expired" lets the frontend
 * gate show the right message and, either way, offer a way to enter a key.
 * Fails OPEN (not blocked) on any unexpected error — a bug or DB hiccup here
 * must never accidentally lock every user out of a working system.
 */
async function getLicenseState() {
    const now = Date.now();
    if (now - cache.checkedAt < CACHE_TTL_MS) return cache.state;

    try {
        const current = await LicenseActivation.current();
        const hasLicense = !!current;
        const pastExpiry = hasLicense && LicenseActivation.expired(current.expires_at);
        const state = {
            hasLicense,
            pastExpiry,
            blocked: !hasLicense || pastExpiry,
            expiresAt: current?.expires_at ?? null,
            licenseType: current?.license_type ?? null,
        };
        cache = { state, checkedAt: now };
        return state;
    } catch (error) {
        console.error('licenseGuard.getLicenseState failed — failing open (treating as active):', error.message);
        return FAIL_OPEN_STATE;
    }
}

/** Forces the next getLicenseState()/isLicenseExpired() call to re-hit the DB — call right after activating a new key. */
function clearLicenseCache() {
    cache.checkedAt = 0;
}

/** Is the license currently governing this deployment expired (or missing entirely)? */
async function isLicenseExpired() {
    return (await getLicenseState()).blocked;
}

/** `license.hard_enforcement` setting — only consulted once already expired. */
async function isHardEnforcementOn() {
    try {
        return await Setting.getBool('license.hard_enforcement', true);
    } catch (error) {
        console.error('licenseGuard.isHardEnforcementOn failed — failing open (soft mode):', error.message);
        return false;
    }
}

module.exports = { getLicenseState, clearLicenseCache, isLicenseExpired, isHardEnforcementOn };
