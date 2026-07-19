import { useState } from 'react';

/**
 * 👤 CustomAvatar Component
 * @param {string} src - The URL of the profile image
 * @param {string} firstName - Employee's first name (for initials fallback)
 * @param {string} lastName - Employee's last name (for initials fallback)
 * @param {string} size - Tailwind sizing class (defaults to 'h-10 w-10 text-sm')
 * @param {string} className - Extra style overrides
 */
export const CustomAvatar = ({ 
    src, 
    firstName = '', 
    lastName = '', 
    size = 'h-10 w-10 text-sm',
    className = '' 
}) => {
    const [imgError, setImgError] = useState(false);

    // 🎯 Extract initials (e.g., "John Doe" -> "JD")
    const getInitials = () => {
        const firstInitial = firstName?.trim()?.charAt(0) || '';
        const lastInitial = lastName?.trim()?.charAt(0) || '';
        return `${firstInitial}${lastInitial}`.toUpperCase() || '?';
    };

    // 🎨 Standardize profile placeholder background colors based on name string length
    const getBgColor = () => {
        const colors = [
            'bg-gray-50 text-gray-700 border-gray-200',
            'bg-emerald-50 text-emerald-700 border-emerald-200',
            'bg-amber-50 text-amber-700 border-amber-200',
            'bg-rose-50 text-rose-700 border-rose-200',
            'bg-sky-50 text-sky-700 border-sky-200'
        ];
        const index = (firstName.length + lastName.length) % colors.length;
        return colors[index];
    };

    return (
        <div className={`relative inline-flex items-center justify-center rounded-full border shrink-0 font-semibold select-none overflow-hidden ${size} ${className}`}>
            {src && !imgError ? (
                <img
                    src={src}
                    alt={`${firstName} ${lastName}`}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)} // 🛡️ Fallback to initials if image link breaks
                />
            ) : (
                <div className={`w-full h-full flex items-center justify-center uppercase ${getBgColor()}`}>
                    {getInitials()}
                </div>
            )}
        </div>
    );
};