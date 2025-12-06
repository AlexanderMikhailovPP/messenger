import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML string
 */
export const sanitizeHTML = (html) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre', 'a', 'span', 'br', 'div', 'p', 'ul', 'ol', 'li', 'blockquote', 'img', 'audio', 'button', 'svg', 'path'],
        ALLOWED_ATTR: ['class', 'data-id', 'data-type', 'data-src', 'href', 'target', 'rel', 'src', 'alt', 'style', 'controls', 'preload', 'width', 'height', 'viewBox', 'fill', 'd'],
        ALLOW_DATA_ATTR: true,
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    });
};

/**
 * Prepares HTML content for sending by converting editor-specific classes
 * Converts spoiler-edit class to spoiler for proper display in messages
 * @param {string} html - HTML string from editor
 * @returns {string} Processed HTML string
 */
export const prepareHTMLForSend = (html) => {
    // Convert spoiler-edit class to spoiler
    return html.replace(/class="spoiler-edit"/g, 'class="spoiler"');
};
