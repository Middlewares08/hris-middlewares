import moment from 'moment';

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