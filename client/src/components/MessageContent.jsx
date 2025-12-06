import { useMemo, useState, useCallback } from 'react';
import SpoilerText from './SpoilerText';
import { sanitizeHTML } from '../utils/sanitize';

/**
 * Wrapper component for individual spoiler that manages its own revealed state
 */
function SpoilerWrapper({ children, spoilerId }) {
    const [revealed, setRevealed] = useState(false);

    const handleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setRevealed(true);
    }, []);

    return (
        <SpoilerText revealed={revealed} onClick={handleClick}>
            {children}
        </SpoilerText>
    );
}

/**
 * Renders message content with React components for special elements like spoilers
 */
export default function MessageContent({ html, className = '' }) {
    const content = useMemo(() => {
        // Sanitize HTML first
        const sanitized = sanitizeHTML(html);

        // Parse HTML and convert spoilers to React components
        const parser = new DOMParser();
        const doc = parser.parseFromString(sanitized, 'text/html');

        // Make all links open in new tab
        const links = doc.querySelectorAll('a');
        links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        // Find all spoiler elements and mark them
        const spoilers = doc.querySelectorAll('.spoiler');
        spoilers.forEach((spoiler, index) => {
            spoiler.setAttribute('data-spoiler-id', `spoiler-${index}`);
        });

        // Get the processed HTML
        const processedHtml = doc.body.innerHTML;

        // If no spoilers, return simple HTML
        if (spoilers.length === 0) {
            return <span dangerouslySetInnerHTML={{ __html: processedHtml }} />;
        }

        // Split HTML by spoilers and reconstruct with React components
        const parts = [];
        let lastIndex = 0;
        let partKey = 0;

        spoilers.forEach((spoiler, index) => {
            const spoilerId = `spoiler-${index}`;
            const spoilerHtml = doc.querySelector(`[data-spoiler-id="${spoilerId}"]`).outerHTML;
            const spoilerContent = spoiler.textContent;

            const htmlBeforeSpoiler = processedHtml.substring(lastIndex, processedHtml.indexOf(spoilerHtml, lastIndex));

            if (htmlBeforeSpoiler) {
                parts.push(
                    <span key={`part-${partKey++}`} dangerouslySetInnerHTML={{ __html: htmlBeforeSpoiler }} />
                );
            }

            parts.push(
                <SpoilerWrapper key={`spoiler-${index}`} spoilerId={spoilerId}>
                    {spoilerContent}
                </SpoilerWrapper>
            );

            lastIndex = processedHtml.indexOf(spoilerHtml, lastIndex) + spoilerHtml.length;
        });

        // Add remaining content after last spoiler
        if (lastIndex < processedHtml.length) {
            parts.push(
                <span key={`part-${partKey++}`} dangerouslySetInnerHTML={{ __html: processedHtml.substring(lastIndex) }} />
            );
        }

        return <>{parts}</>;
    }, [html]);

    return <span className={className}>{content}</span>;
}
