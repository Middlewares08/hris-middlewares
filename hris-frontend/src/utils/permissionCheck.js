// utils/permissionChecker.js

/**
 * Checks if the current session user has the required permission(s).
 * @param {string|Array<string>} requiredPermissions - The permission slug(s) to verify.
 * @param {boolean} matchAll - If true, the user must have ALL listed permissions (AND logic).
 * @returns {boolean} - True if authorized, false otherwise.
 */
export function can(requiredPermissions, matchAll = false) {
    try {
        const encodedData = sessionStorage.getItem('permissions');
        if (!encodedData) return false;

        // Decode from Base64, then parse back into a real JS Array
        const permissionsArray = JSON.parse(atob(encodedData)) || []; 
        
        // Normalize the required inputs into an array if a single string was passed
        const targets = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
        if (targets.length === 0) return true;

        // Run the matching evaluation
        return matchAll
            ? targets.every(slug => permissionsArray.includes(slug)) // Must have ALL slugs
            : targets.some(slug => permissionsArray.includes(slug));  // Must have AT LEAST ONE slug

    } catch (error) {
        console.error('Permission check failed or session data was corrupted:', error);
        return false;
    }
}