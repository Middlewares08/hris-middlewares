import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

export const calculateAge = (dateString) => {
    const now = new Date();
    const created = new Date(dateString);
    
    // Total difference in milliseconds
    const diffInMs = now - created;
    
    // Conversion constants
    const seconds = Math.floor(diffInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30.44); // Average month length
    const years = Math.floor(days / 365.25);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    return "Just now";
};

export const generateUUID = () => uuidv4();

export const getBadgeColor = (name) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    
    return colors[Math.abs(hash) % colors.length];
};


export const truncate = (str, num = 50, suffix = '...') => {
    if (!str) return '';
    if (str.length <= num) return str;
    
    return str.slice(0, num).trim() + suffix;
};

export const formatDate = (dateString, format = 'MMM DD, YYYY') => {
    return moment(dateString).format(format)
};

export const formatCurrency = (amount, currency = 'PHP') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount || 0);
}


export const capitalizeFirstLetter = (val) => {
    if (!val || typeof val !== 'string') return '';
    return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
};

export const handleNumberInput = (value) => {
    if (!value) return '';

    // Allow only digits and a single decimal point
    let cleaned = value.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points (e.g., "100..0" -> "100.0")
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places for currency/rates
    if (parts[1] && parts[1].length > 2) {
        cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }

    // Fix double zeros or missing leading zero (e.g., ".5" -> "0.5")
    if (cleaned.startsWith('.')) {
        cleaned = '0' + cleaned;
    }

    return cleaned; // 🚀 CRITICAL: Must return the value!
};

/**
 * Utility to format numeric inputs into specific government ID structures.
 * @param {string} value - The raw string input from the user.
 * @param {string} type - The type of ID ('sss', 'philhealth', 'pagibig', 'tin').
 * @returns {string} The formatted ID string with dashes and length caps.
 */
export const formatGovernmentId = (value, type) => {
    // 1. Remove all non-numeric characters
    const clean = value.replace(/\D/g, '');
    
    switch (type?.toLowerCase()) {
        case 'sss': {
            // Format: XX-XXXXXXX-X (Max 10 digits)
            const truncated = clean.slice(0, 10);
            const match = truncated.match(/^(\d{0,2})(\d{0,7})(\d{0,1})$/);
            if (!match) return truncated;
            return [match[1], match[2], match[3]].filter(Boolean).join('-');
        }
        
        case 'philhealth': {
            // Format: XX-XXXXXXXXX-X (Max 12 digits)
            const truncated = clean.slice(0, 12);
            const match = truncated.match(/^(\d{0,2})(\d{0,9})(\d{0,1})$/);
            if (!match) return truncated;
            return [match[1], match[2], match[3]].filter(Boolean).join('-');
        }
        
        case 'pagibig': {
            // Format: XXXX-XXXX-XXXX (Max 12 digits)
            const truncated = clean.slice(0, 12);
            const match = truncated.match(/^(\d{0,4})(\d{0,4})(\d{0,4})$/);
            if (!match) return truncated;
            return [match[1], match[2], match[3]].filter(Boolean).join('-');
        }
        
        case 'tin': {
            // Format: XXX-XXX-XXX-XXX (Max 12 digits)
            const truncated = clean.slice(0, 12);
            const match = truncated.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,3})$/);
            if (!match) return truncated;
            return [match[1], match[2], match[3], match[4]].filter(Boolean).join('-');
        }
        case 'phone': {
            // Format: 09XX-XXX-XXXX (Max 11 digits)
            const truncated = clean.slice(0, 11);
            const match = truncated.match(/^(\d{0,4})(\d{0,3})(\d{0,4})$/);
            if (!match) return truncated;
            return [match[1], match[2], match[3]].filter(Boolean).join('-');
        }
        
        default:
            return clean;
    }
};