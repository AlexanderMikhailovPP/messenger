import { useState } from 'react';

/**
 * Displays user's status emoji with tooltip showing full status text on hover
 * @param {string} customStatus - The full custom_status string (e.g., "🐯 работаю")
 * @param {string} className - Additional CSS classes
 */
export default function StatusEmoji({ customStatus, className = '' }) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!customStatus) return null;

    // Extract emoji from status (first character if it's an emoji)
    const match = customStatus.match(/^(\p{Emoji})/u);
    const emoji = match ? match[1] : null;

    if (!emoji) return null;

    // Get the text part (everything after the emoji)
    const textMatch = customStatus.match(/^\p{Emoji}\s*(.*)/u);
    const statusText = textMatch ? textMatch[1] : '';

    return (
        <span
            className={`relative inline-block cursor-default ${className}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="text-sm">{emoji}</span>
            {showTooltip && customStatus && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
                    {statusText ? `${emoji} ${statusText}` : emoji}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                </div>
            )}
        </span>
    );
}
