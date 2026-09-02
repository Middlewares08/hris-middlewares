// utils/permissionCheck.js

const STORAGE_KEY = 'permissions';

/**
 * Persist the caller's permission slugs for `can()` to read.
 * Base64-encoded in sessionStorage (survives a reload, not a browser close).
 * @param {Array<string>} permissions
 */
export function storePermissions(permissions) {
    try {
        const clean = Array.isArray(permissions) ? permissions : [];
        sessionStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(clean)));
    } catch (error) {
        console.error('Could not persist permissions:', error);
    }
}

/** Wipe the stored permission set (called on logout). */
export function clearPermissions() {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* noop */
    }
}

/** Read the stored permission slugs as a plain array. */
export function getPermissions() {
    try {
        const encoded = sessionStorage.getItem(STORAGE_KEY);
        if (!encoded) return [];
        return JSON.parse(atob(encoded)) || [];
    } catch (error) {
        console.error('Permission store was unreadable:', error);
        return [];
    }
}

/**
 * Checks if the current session user has the required permission(s).
 * @param {string|Array<string>} requiredPermissions - The permission slug(s) to verify.
 * @param {boolean} matchAll - If true, the user must have ALL listed permissions (AND logic).
 * @returns {boolean} - True if authorized, false otherwise.
 */
export function can(requiredPermissions, matchAll = false) {
    const permissionsArray = getPermissions();

    const targets = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    if (targets.length === 0) return true;

    return matchAll
        ? targets.every((slug) => permissionsArray.includes(slug))
        : targets.some((slug) => permissionsArray.includes(slug));
}
