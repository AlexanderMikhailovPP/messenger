import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHTML = (html) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre', 'a', 'span', 'br', 'div', 'p', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['class', 'data-id', 'data-type', 'href', 'target', 'rel'],
        ALLOW_DATA_ATTR: true,
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    });
};
