import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, List, ListOrdered, Code, FileCode, Quote, Send, Paperclip, Smile, Hash, AtSign, Mic, Square, X, Check, Play, Pause, Trash2, Clock, ChevronDown, EyeOff, ExternalLink, Pencil } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import QuickEmojiPicker from './QuickEmojiPicker';

export default function RichTextEditor({ value, onChange, placeholder, onSubmit, onScheduledSubmit, disabled, onFileAttach, onVoiceMessage, attachments = [], onRemoveAttachment }) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionType, setMentionType] = useState(null);
    const [mentionResults, setMentionResults] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedAudio, setRecordedAudio] = useState(null); // { blob, url, duration }
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [showScheduleMenu, setShowScheduleMenu] = useState(false);
    const [showCustomSchedule, setShowCustomSchedule] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [linkTooltip, setLinkTooltip] = useState({ visible: false, link: null, position: { top: 0, left: 0 } });
    const [linkModal, setLinkModal] = useState({ visible: false, url: '', text: '', hasSelection: false, error: '' });
    const linkModalRef = useRef(null);
    const linkUrlInputRef = useRef(null);
    const linkTooltipRef = useRef(null);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        inList: false,
        inOrderedList: false,
        inCodeBlock: false,
        inInlineCode: false,
        inBlockquote: false,
        inSpoiler: false
    });
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const recordingTimeRef = useRef(0);
    const emojiButtonRef = useRef(null);
    const previewAudioRef = useRef(null);
    const scheduleMenuRef = useRef(null);
    const savedSelectionRef = useRef(null);
    const { user } = useAuth();

    // Close schedule menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (scheduleMenuRef.current && !scheduleMenuRef.current.contains(e.target)) {
                setShowScheduleMenu(false);
                setShowCustomSchedule(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Schedule preset options
    const getSchedulePresets = () => {
        const now = new Date();
        const presets = [];

        // In 30 minutes
        const in30 = new Date(now.getTime() + 30 * 60 * 1000);
        presets.push({ label: 'Через 30 минут', date: in30 });

        // In 1 hour
        const in1h = new Date(now.getTime() + 60 * 60 * 1000);
        presets.push({ label: 'Через 1 час', date: in1h });

        // In 3 hours
        const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        presets.push({ label: 'Через 3 часа', date: in3h });

        // Tomorrow at 9:00
        const tomorrow9 = new Date(now);
        tomorrow9.setDate(tomorrow9.getDate() + 1);
        tomorrow9.setHours(9, 0, 0, 0);
        presets.push({ label: 'Завтра в 9:00', date: tomorrow9 });

        // Monday at 9:00 (if not Monday)
        const monday = new Date(now);
        const daysUntilMonday = (8 - monday.getDay()) % 7 || 7;
        monday.setDate(monday.getDate() + daysUntilMonday);
        monday.setHours(9, 0, 0, 0);
        if (daysUntilMonday > 1) {
            presets.push({ label: 'В понедельник в 9:00', date: monday });
        }

        return presets;
    };

    const handleScheduleSelect = (date) => {
        if (onScheduledSubmit) {
            onScheduledSubmit(date);
        }
        setShowScheduleMenu(false);
        setShowCustomSchedule(false);
    };

    const handleCustomSchedule = () => {
        if (!scheduledDate || !scheduledTime) return;

        const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (dateTime <= new Date()) {
            alert('Выберите время в будущем');
            return;
        }

        handleScheduleSelect(dateTime);
        setScheduledDate('');
        setScheduledTime('');
    };

    const formatScheduleTime = (date) => {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    // Update active format states based on current selection
    const updateActiveFormats = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || !editorRef.current) return;

        // Use queryCommandState for basic formatting
        const newFormats = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikeThrough: document.queryCommandState('strikeThrough'),
            inList: false,
            inOrderedList: false,
            inCodeBlock: false,
            inInlineCode: false,
            inBlockquote: false,
            inSpoiler: false
        };

        // Check DOM ancestry for block-level elements
        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let foundPre = false;
        let foundCode = false;

        while (current && current !== editorRef.current) {
            const tag = current.tagName;
            if (tag === 'UL') newFormats.inList = true;
            if (tag === 'OL') newFormats.inOrderedList = true;
            if (tag === 'PRE') foundPre = true;
            if (tag === 'CODE') foundCode = true;
            if (tag === 'BLOCKQUOTE') newFormats.inBlockquote = true;
            if (current.classList && (current.classList.contains('spoiler') || current.classList.contains('spoiler-edit'))) newFormats.inSpoiler = true;
            current = current.parentElement;
        }

        // Code block is PRE (with or without CODE inside)
        // Inline code is CODE that is NOT inside PRE
        if (foundPre) {
            newFormats.inCodeBlock = true;
            // If inside PRE, it's NOT inline code even if CODE tag exists
        } else if (foundCode) {
            newFormats.inInlineCode = true;
        }

        setActiveFormats(newFormats);
    };

    // Listen for selection changes
    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === editorRef.current) {
                updateActiveFormats();
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        // Trigger onChange after formatting
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        // Update active formats after applying
        setTimeout(updateActiveFormats, 0);
    };

    const wrapSelectionWithTag = (tagName) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Check if already inside this tag type (for inline code) - if so, unwrap
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let existingWrapper = null;

        while (current && current !== editorRef.current) {
            // For inline code, check CODE that's NOT inside PRE
            if (current.tagName === tagName.toUpperCase()) {
                if (tagName.toLowerCase() === 'code') {
                    // Make sure it's not inside PRE (code block)
                    let parent = current.parentElement;
                    let inPre = false;
                    while (parent && parent !== editorRef.current) {
                        if (parent.tagName === 'PRE') {
                            inPre = true;
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    if (!inPre) {
                        existingWrapper = current;
                        break;
                    }
                } else {
                    existingWrapper = current;
                    break;
                }
            }
            current = current.parentElement;
        }

        if (existingWrapper) {
            // Unwrap: extract content and replace wrapper with it
            const content = existingWrapper.textContent || '';
            const textNode = document.createTextNode(content);
            existingWrapper.parentNode.replaceChild(textNode, existingWrapper);

            // Position cursor after the text
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            const selectedText = range.toString();

            if (selectedText) {
                // Wrap selected text with tag
                const wrapper = document.createElement(tagName);
                wrapper.textContent = selectedText;
                range.deleteContents();
                range.insertNode(wrapper);

                // Move cursor after the wrapper
                const newRange = document.createRange();
                newRange.setStartAfter(wrapper);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // No selection - insert placeholder
                const wrapper = document.createElement(tagName);
                wrapper.innerHTML = '&#8203;'; // Zero-width space
                range.insertNode(wrapper);

                // Move cursor inside the wrapper
                const newRange = document.createRange();
                newRange.selectNodeContents(wrapper);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setTimeout(updateActiveFormats, 0);
    };

    const insertCodeBlock = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Check if already inside a code block (PRE) - if so, unwrap it
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let preElement = null;

        while (current && current !== editorRef.current) {
            if (current.tagName === 'PRE') {
                preElement = current;
                break;
            }
            current = current.parentElement;
        }

        if (preElement) {
            // Unwrap: extract content and replace PRE with it
            const content = preElement.textContent || '';
            const textNode = document.createTextNode(content);
            preElement.parentNode.replaceChild(textNode, preElement);

            // Position cursor after the text
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Create pre > code structure
            const selectedText = range.toString();
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = selectedText || '\u200B'; // Zero-width space if empty
            pre.appendChild(code);

            range.deleteContents();
            range.insertNode(pre);

            // Move cursor inside the code block
            const newRange = document.createRange();
            if (selectedText) {
                newRange.setStart(code, code.childNodes.length);
            } else {
                newRange.setStart(code, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setTimeout(updateActiveFormats, 0);
    };

    // Validate URL for security
    const isValidUrl = (url) => {
        if (!url || url.trim() === '') return false;
        // Block dangerous protocols
        const dangerousProtocols = /^(javascript|data|vbscript):/i;
        if (dangerousProtocols.test(url)) return false;
        // Allow safe protocols
        const safeProtocols = /^(https?|mailto|tel|callto|sms):/i;
        if (safeProtocols.test(url)) return true;
        // Allow URLs without protocol (will add https://)
        return true;
    };

    // Open link modal
    const openLinkModal = () => {
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';
        const hasSelection = selectedText !== '';

        // Save selection before opening modal
        saveSelection();

        setLinkModal({
            visible: true,
            url: '',
            text: hasSelection ? selectedText : '',
            hasSelection,
            error: ''
        });

        // Focus on URL input after modal opens
        setTimeout(() => {
            linkUrlInputRef.current?.focus();
        }, 100);
    };

    // Close link modal
    const closeLinkModal = () => {
        setLinkModal({ visible: false, url: '', text: '', hasSelection: false, error: '' });
    };

    // Submit link from modal
    const submitLinkModal = () => {
        const { url, text, hasSelection } = linkModal;

        if (!url.trim()) {
            setLinkModal(prev => ({ ...prev, error: 'URL не может быть пустым' }));
            return;
        }

        // Validate URL
        if (!isValidUrl(url)) {
            setLinkModal(prev => ({ ...prev, error: 'javascript: и data: URL не разрешены' }));
            return;
        }

        // Ensure URL has protocol
        let fullUrl = url.trim();
        if (fullUrl && !fullUrl.match(/^(https?|mailto|tel|callto|sms):/i)) {
            fullUrl = 'https://' + fullUrl;
        }

        // Restore selection
        restoreSelection();

        const selection = window.getSelection();

        if (hasSelection && selection.rangeCount > 0) {
            applyFormat('createLink', fullUrl);
        } else {
            // No selection - insert URL as link with custom text
            const link = document.createElement('a');
            link.href = fullUrl;
            link.textContent = text.trim() || fullUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.insertNode(link);

                // Move cursor after link
                const newRange = document.createRange();
                newRange.setStartAfter(link);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
        }

        closeLinkModal();
        editorRef.current?.focus();
    };

    // Handle link modal key events
    const handleLinkModalKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitLinkModal();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeLinkModal();
        }
    };

    const insertLink = () => {
        openLinkModal();
    };

    // Handle link click in editor - show tooltip
    const handleLinkClick = (e, linkElement) => {
        e.preventDefault();
        e.stopPropagation();

        const editorRect = editorRef.current.getBoundingClientRect();
        const linkRect = linkElement.getBoundingClientRect();

        setLinkTooltip({
            visible: true,
            link: linkElement,
            url: linkElement.href,
            position: {
                top: linkRect.bottom - editorRect.top + 4,
                left: linkRect.left - editorRect.left
            }
        });
    };

    // Edit link URL
    const editLink = () => {
        if (!linkTooltip.link) return;

        const newUrl = prompt('Редактировать URL:', linkTooltip.url);
        if (newUrl !== null) {
            if (!isValidUrl(newUrl)) {
                alert('Недопустимый URL. javascript: и data: URL не разрешены.');
                return;
            }
            let fullUrl = newUrl.trim();
            if (fullUrl && !fullUrl.match(/^(https?|mailto|tel|callto|sms):/i)) {
                fullUrl = 'https://' + fullUrl;
            }
            linkTooltip.link.href = fullUrl;
            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
        }
        setLinkTooltip({ visible: false, link: null, position: { top: 0, left: 0 } });
    };

    // Remove link (keep text)
    const removeLink = () => {
        if (!linkTooltip.link) return;

        const text = linkTooltip.link.textContent;
        const textNode = document.createTextNode(text);
        linkTooltip.link.parentNode.replaceChild(textNode, linkTooltip.link);

        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setLinkTooltip({ visible: false, link: null, position: { top: 0, left: 0 } });
    };

    // Close link tooltip when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (linkTooltip.visible && linkTooltipRef.current && !linkTooltipRef.current.contains(e.target)) {
                // Check if clicked on a link in the editor
                if (e.target.tagName === 'A' && editorRef.current?.contains(e.target)) {
                    return; // Will be handled by the link click handler
                }
                setLinkTooltip({ visible: false, link: null, position: { top: 0, left: 0 } });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [linkTooltip.visible]);

    // Handle clicks on editor content
    const handleEditorClick = (e) => {
        // Check if clicked on a link
        let target = e.target;
        while (target && target !== editorRef.current) {
            if (target.tagName === 'A') {
                handleLinkClick(e, target);
                return;
            }
            target = target.parentElement;
        }
        // If not clicked on a link, hide tooltip
        if (linkTooltip.visible) {
            setLinkTooltip({ visible: false, link: null, position: { top: 0, left: 0 } });
        }
    };

    const insertList = (ordered = false) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Check if already inside a list
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let listItem = null;
        let listElement = null;
        const targetTag = ordered ? 'OL' : 'UL';

        while (current && current !== editorRef.current) {
            if (current.tagName === 'LI') {
                listItem = current;
            }
            if (current.tagName === 'UL' || current.tagName === 'OL') {
                listElement = current;
                break;
            }
            current = current.parentElement;
        }

        if (listElement) {
            // If clicking on same type - unwrap, if different type - convert
            if (listElement.tagName === targetTag) {
                // Same type - unwrap: extract content (preserving HTML) and replace list with it
                const fragment = document.createDocumentFragment();
                // Get content from all list items
                Array.from(listElement.querySelectorAll(':scope > li')).forEach((li, index) => {
                    if (index > 0) {
                        fragment.appendChild(document.createElement('br'));
                    }
                    while (li.firstChild) {
                        fragment.appendChild(li.firstChild);
                    }
                });
                listElement.parentNode.replaceChild(fragment, listElement);

                // Position cursor at the end
                const newRange = document.createRange();
                newRange.selectNodeContents(editorRef.current);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // Different type - convert UL <-> OL
                const newList = document.createElement(ordered ? 'ol' : 'ul');
                // Copy all children
                while (listElement.firstChild) {
                    newList.appendChild(listElement.firstChild);
                }
                listElement.parentNode.replaceChild(newList, listElement);

                // Restore cursor position inside the list item
                if (listItem) {
                    const newRange = document.createRange();
                    newRange.selectNodeContents(listItem);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        } else {
            // Create list element - use cloneContents to preserve HTML
            const list = document.createElement(ordered ? 'ol' : 'ul');
            const li = document.createElement('li');
            const contents = range.cloneContents();

            if (contents.childNodes.length > 0 && contents.textContent.trim()) {
                li.appendChild(contents);
            } else {
                li.innerHTML = '\u200B'; // Zero-width space if empty
            }

            list.appendChild(li);

            range.deleteContents();
            range.insertNode(list);

            // Move cursor inside the list item at the end
            const newRange = document.createRange();
            newRange.selectNodeContents(li);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setTimeout(updateActiveFormats, 0);
    };

    const insertBlockquote = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Check if already inside a blockquote - if so, unwrap it
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let blockquoteElement = null;

        while (current && current !== editorRef.current) {
            if (current.tagName === 'BLOCKQUOTE') {
                blockquoteElement = current;
                break;
            }
            current = current.parentElement;
        }

        if (blockquoteElement) {
            // Unwrap: extract content (preserving HTML) and replace blockquote with it
            const fragment = document.createDocumentFragment();
            while (blockquoteElement.firstChild) {
                fragment.appendChild(blockquoteElement.firstChild);
            }
            blockquoteElement.parentNode.replaceChild(fragment, blockquoteElement);

            // Position cursor at the end
            const newRange = document.createRange();
            newRange.selectNodeContents(editorRef.current);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Create blockquote element - use cloneContents to preserve HTML
            const blockquote = document.createElement('blockquote');
            const contents = range.cloneContents();

            if (contents.childNodes.length > 0 && contents.textContent.trim()) {
                blockquote.appendChild(contents);
            } else {
                blockquote.innerHTML = '\u200B'; // Zero-width space if empty
            }

            range.deleteContents();
            range.insertNode(blockquote);

            // Move cursor inside the blockquote at the end
            const newRange = document.createRange();
            newRange.selectNodeContents(blockquote);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setTimeout(updateActiveFormats, 0);
    };

    const insertSpoiler = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Check if already inside a spoiler - if so, unwrap it
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let spoilerElement = null;

        while (current && current !== editorRef.current) {
            if (current.classList && (current.classList.contains('spoiler') || current.classList.contains('spoiler-edit'))) {
                spoilerElement = current;
                break;
            }
            current = current.parentElement;
        }

        if (spoilerElement) {
            // Unwrap: extract content (preserving HTML) and replace spoiler with it
            const fragment = document.createDocumentFragment();
            while (spoilerElement.firstChild) {
                fragment.appendChild(spoilerElement.firstChild);
            }

            // Insert fragment before spoiler, then remove spoiler
            const parent = spoilerElement.parentNode;
            const lastChild = fragment.lastChild;
            parent.insertBefore(fragment, spoilerElement);
            spoilerElement.remove();

            // Position cursor after the extracted content
            const newRange = document.createRange();
            if (lastChild) {
                newRange.setStartAfter(lastChild);
            } else {
                newRange.setStart(parent, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Create spoiler span - use spoiler-edit class in editor to avoid global .spoiler styles
            // Use cloneContents to preserve HTML formatting
            const contents = range.cloneContents();
            const spoiler = document.createElement('span');
            spoiler.className = 'spoiler-edit';
            if (contents.childNodes.length > 0 && contents.textContent.trim()) {
                spoiler.appendChild(contents);
            } else {
                spoiler.textContent = '\u200B'; // Zero-width space if empty
            }

            range.deleteContents();
            range.insertNode(spoiler);

            // Move cursor inside the spoiler at the end
            const newRange = document.createRange();
            newRange.selectNodeContents(spoiler);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setTimeout(updateActiveFormats, 0);
    };

    // Save current selection/caret position
    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
        }
    };

    // Restore saved selection/caret position
    const restoreSelection = () => {
        if (savedSelectionRef.current && editorRef.current) {
            editorRef.current.focus();
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedSelectionRef.current);
        }
    };

    // Insert emoji at cursor position
    const insertEmoji = (emoji) => {
        if (!editorRef.current) return;

        // Restore the saved selection before inserting
        restoreSelection();

        document.execCommand('insertText', false, emoji);

        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        setShowEmojiPicker(false);
    };

    // Handle file selection
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0 && onFileAttach) {
            onFileAttach(files);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Voice recording functions
    const streamRef = useRef(null);
    const isCancelledRef = useRef(false);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            isCancelledRef.current = false;
            recordingTimeRef.current = 0;

            // Use audio/webm with opus codec for better compatibility
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Don't create blob if cancelled
                if (isCancelledRef.current) {
                    audioChunksRef.current = [];
                    return;
                }

                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    // Validate blob has content
                    if (audioBlob.size > 0) {
                        const audioUrl = URL.createObjectURL(audioBlob);
                        // Save to preview state - use ref for duration since state may be stale
                        setRecordedAudio({
                            blob: audioBlob,
                            url: audioUrl,
                            duration: recordingTimeRef.current
                        });
                    } else {
                        console.error('Recording produced empty blob');
                    }
                }
            };

            // Start with timeslice to get data periodically (250ms for better chunk sizes)
            mediaRecorder.start(250);
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer - update both state and ref
            recordingTimerRef.current = setInterval(() => {
                recordingTimeRef.current += 1;
                setRecordingTime(recordingTimeRef.current);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Could not access microphone. Please allow microphone permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = false;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            mediaRecorderRef.current.stop();
            audioChunksRef.current = [];
            setIsRecording(false);
            setRecordingTime(0);
            recordingTimeRef.current = 0;
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    const confirmVoiceMessage = () => {
        if (recordedAudio && onVoiceMessage) {
            onVoiceMessage(recordedAudio.blob);
        }
        discardVoiceMessage();
    };

    const discardVoiceMessage = () => {
        if (recordedAudio?.url) {
            URL.revokeObjectURL(recordedAudio.url);
        }
        setRecordedAudio(null);
        setIsPlayingPreview(false);
    };

    const togglePreviewPlayback = () => {
        if (!previewAudioRef.current) return;

        if (isPlayingPreview) {
            previewAudioRef.current.pause();
        } else {
            previewAudioRef.current.play();
        }
        setIsPlayingPreview(!isPlayingPreview);
    };

    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showEmojiPicker && emojiButtonRef.current && !emojiButtonRef.current.contains(e.target)) {
                const picker = document.querySelector('.emoji-picker-container');
                if (picker && !picker.contains(e.target)) {
                    setShowEmojiPicker(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    const searchMentions = async (query, type) => {
        try {
            const res = await axios.get(`/api/users/search?q=${encodeURIComponent(query || ' ')}`);
            if (type === '@') {
                setMentionResults(res.data.users || []);
            } else if (type === '#') {
                setMentionResults(res.data.channels || []);
            }
        } catch (error) {
            console.error('Failed to search mentions', error);
            setMentionResults([]);
        }
    };

    const getCaretCoordinates = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return { top: 0, left: 0 };

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();

        // Position relative to editor
        return {
            top: rect.top - editorRect.top,
            left: rect.left - editorRect.left
        };
    };

    const insertMention = (item) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const plainText = editorRef.current.textContent || '';

        // Get cursor position
        let cursorPos = 0;
        try {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(editorRef.current);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorPos = preCaretRange.toString().length;
        } catch (e) {
            console.error('Error getting cursor position:', e);
            return;
        }

        // Find the @ or # position before cursor
        let triggerPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (plainText[i] === mentionType) {
                triggerPos = i;
                break;
            }
        }

        if (triggerPos === -1) return;

        // Create mention span element
        const mentionClass = mentionType === '@' ? 'mention-user' : 'mention-channel';
        const mentionText = mentionType === '@' ? `@${item.username}` : `#${item.name}`;

        const mentionSpan = document.createElement('span');
        mentionSpan.className = mentionClass;
        mentionSpan.setAttribute('data-id', item.id);
        mentionSpan.setAttribute('data-type', mentionType === '@' ? 'user' : 'channel');
        mentionSpan.contentEditable = 'false';
        mentionSpan.textContent = mentionText;
        mentionSpan.style.pointerEvents = 'auto'; // Ensure it captures events

        // Delete the trigger and query text
        range.setStart(range.startContainer, range.startOffset - (cursorPos - triggerPos));
        range.deleteContents();

        // Insert mention span
        range.insertNode(mentionSpan);

        // Create and insert space AFTER the mention span
        const space = document.createTextNode('\u00A0'); // Non-breaking space to ensure it's treated as content

        // We need to insert the space after the mentionSpan. 
        // Since insertNode inserts at the start of the range, we can just insert the space after the span.
        if (mentionSpan.nextSibling) {
            mentionSpan.parentNode.insertBefore(space, mentionSpan.nextSibling);
        } else {
            mentionSpan.parentNode.appendChild(space);
        }

        // Position cursor AFTER the space
        const newRange = document.createRange();
        newRange.setStartAfter(space);
        newRange.collapse(true);

        const newSelection = window.getSelection();
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);

        // Reset mention state
        setShowMentions(false);
        setMentionQuery('');
        setMentionType(null);
        setMentionResults([]);
        setSelectedMentionIndex(0);

        // Update value
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        editorRef.current.focus();
    };

    // URL regex for auto-linking
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

    // Handle paste - auto-link URLs
    const handlePaste = (e) => {
        // Get plain text from clipboard
        const pastedText = e.clipboardData.getData('text/plain');

        // Check if it's a URL
        if (pastedText && urlRegex.test(pastedText.trim())) {
            const url = pastedText.trim();

            // Validate URL
            if (!isValidUrl(url)) {
                // Just paste as plain text if invalid
                return;
            }

            e.preventDefault();

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            // Check if there's selected text - if so, make it a link
            const selectedText = range.toString();

            if (selectedText) {
                // Create link with selected text
                const link = document.createElement('a');
                link.href = url;
                link.textContent = selectedText;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';

                range.deleteContents();
                range.insertNode(link);

                // Move cursor after link
                const newRange = document.createRange();
                newRange.setStartAfter(link);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // No selection - insert URL as link
                const link = document.createElement('a');
                link.href = url;
                link.textContent = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';

                range.insertNode(link);

                // Move cursor after link
                const newRange = document.createRange();
                newRange.setStartAfter(link);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
        }
        // Let other paste events (Ctrl+Shift+V for plain text) proceed normally
    };

    // Check and convert Markdown ``` or ```language to code block
    const checkMarkdownCodeBlock = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Only process text nodes
        if (node.nodeType !== Node.TEXT_NODE) return false;

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        // Check if the text before cursor ends with ``` or ```language (at line start or after whitespace)
        const textBeforeCursor = text.substring(0, cursorPos);
        // Match ``` or ```language (language is optional word characters)
        const match = textBeforeCursor.match(/(^|[\n\s])```(\w*)$/);

        if (match) {
            // Found markdown code block trigger
            const matchStart = match.index + (match[1] ? match[1].length : 0);
            const language = match[2] || ''; // Extract language if provided

            // Create code block
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            if (language) {
                code.setAttribute('data-language', language);
                code.className = `language-${language}`;
            }
            code.textContent = '\u200B'; // Zero-width space
            pre.appendChild(code);

            // Remove the ```language from the text
            const beforeMatch = text.substring(0, matchStart);
            const afterCursor = text.substring(cursorPos);

            if (beforeMatch || afterCursor) {
                // There's text before or after, need to split
                node.textContent = beforeMatch;

                // Insert the code block after current position
                const newRange = document.createRange();
                if (node.textContent) {
                    newRange.setStartAfter(node);
                } else {
                    // Remove empty text node
                    const parent = node.parentNode;
                    newRange.setStart(parent, Array.from(parent.childNodes).indexOf(node));
                    node.remove();
                }
                newRange.collapse(true);
                newRange.insertNode(pre);

                if (afterCursor) {
                    const afterText = document.createTextNode(afterCursor);
                    pre.parentNode.insertBefore(afterText, pre.nextSibling);
                }
            } else {
                // Replace the entire text node with code block
                node.parentNode.replaceChild(pre, node);
            }

            // Move cursor inside code block
            const finalRange = document.createRange();
            finalRange.setStart(code, 0);
            finalRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(finalRange);

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            return true;
        }
        return false;
    };

    // Check for Markdown inline formatting patterns and apply formatting
    // Patterns: *italic*, **bold**, `code`, ~~strikethrough~~
    const checkMarkdownInlineFormatting = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Only process text nodes
        if (node.nodeType !== Node.TEXT_NODE) return false;

        // Don't process inside code blocks
        let parent = node.parentElement;
        while (parent && parent !== editorRef.current) {
            if (parent.tagName === 'PRE' || parent.tagName === 'CODE') return false;
            parent = parent.parentElement;
        }

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        // Check for patterns ending at cursor position
        const textBeforeCursor = text.substring(0, cursorPos);

        // Pattern definitions: [regex, tag, wrapper function]
        const patterns = [
            // **bold** - must check before *italic*
            {
                regex: /\*\*([^*]+)\*\*$/,
                apply: (match) => {
                    const content = match[1];
                    const wrapper = document.createElement('b');
                    wrapper.textContent = content;
                    return wrapper;
                },
                length: (match) => match[0].length
            },
            // *italic*
            {
                regex: /(?<!\*)\*([^*]+)\*$/,
                apply: (match) => {
                    const content = match[1];
                    const wrapper = document.createElement('i');
                    wrapper.textContent = content;
                    return wrapper;
                },
                length: (match) => match[0].length
            },
            // `code`
            {
                regex: /`([^`]+)`$/,
                apply: (match) => {
                    const content = match[1];
                    const wrapper = document.createElement('code');
                    wrapper.textContent = content;
                    return wrapper;
                },
                length: (match) => match[0].length
            },
            // ~~strikethrough~~
            {
                regex: /~~([^~]+)~~$/,
                apply: (match) => {
                    const content = match[1];
                    const wrapper = document.createElement('s');
                    wrapper.textContent = content;
                    return wrapper;
                },
                length: (match) => match[0].length
            }
        ];

        for (const pattern of patterns) {
            const match = textBeforeCursor.match(pattern.regex);
            if (match) {
                const matchLength = pattern.length(match);
                const matchStart = cursorPos - matchLength;

                // Create the formatted element
                const wrapper = pattern.apply(match);

                // Replace the markdown syntax with formatted text
                const beforeMatch = text.substring(0, matchStart);
                const afterCursor = text.substring(cursorPos);

                node.textContent = beforeMatch + afterCursor;

                // Insert the wrapper at the correct position
                const newRange = document.createRange();
                if (beforeMatch) {
                    newRange.setStart(node, beforeMatch.length);
                } else {
                    newRange.setStart(node, 0);
                }
                newRange.collapse(true);
                newRange.insertNode(wrapper);

                // Move cursor after the wrapper
                const finalRange = document.createRange();
                finalRange.setStartAfter(wrapper);
                finalRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(finalRange);

                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
                return true;
            }
        }
        return false;
    };

    // Check for auto-list formatting: "- ", "* ", "1. ", "> " at line start
    const checkAutoListFormatting = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Only process text nodes
        if (node.nodeType !== Node.TEXT_NODE) return false;

        // Don't process inside code blocks or lists
        let parent = node.parentElement;
        while (parent && parent !== editorRef.current) {
            if (parent.tagName === 'PRE' || parent.tagName === 'LI' ||
                parent.tagName === 'UL' || parent.tagName === 'OL' ||
                parent.tagName === 'BLOCKQUOTE') return false;
            parent = parent.parentElement;
        }

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        // Patterns at start of line
        // "- " or "* " for unordered list
        if (text.match(/^[-*]\s$/) && cursorPos === 2) {
            // Create unordered list
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            li.innerHTML = '\u200B';
            ul.appendChild(li);

            node.parentNode.replaceChild(ul, node);

            const newRange = document.createRange();
            newRange.setStart(li, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            return true;
        }

        // "1. " for ordered list
        if (text.match(/^1\.\s$/) && cursorPos === 3) {
            const ol = document.createElement('ol');
            const li = document.createElement('li');
            li.innerHTML = '\u200B';
            ol.appendChild(li);

            node.parentNode.replaceChild(ol, node);

            const newRange = document.createRange();
            newRange.setStart(li, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            return true;
        }

        // "> " for blockquote
        if (text.match(/^>\s$/) && cursorPos === 2) {
            const blockquote = document.createElement('blockquote');
            blockquote.innerHTML = '\u200B';

            node.parentNode.replaceChild(blockquote, node);

            const newRange = document.createRange();
            newRange.setStart(blockquote, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
            }
            return true;
        }

        return false;
    };

    const handleInput = (e) => {
        const content = e.currentTarget.innerHTML;
        onChange(content);

        // Cleanup empty spoiler elements (background remains after deleting content)
        if (editorRef.current) {
            const spoilers = editorRef.current.querySelectorAll('.spoiler-edit, .spoiler');
            spoilers.forEach(spoiler => {
                const text = spoiler.textContent || '';
                // Remove spoiler if empty or only contains zero-width space
                if (text === '' || text === '\u200B' || text.trim() === '') {
                    spoiler.remove();
                }
            });
            // Update content after cleanup
            const newContent = editorRef.current.innerHTML;
            if (newContent !== content) {
                onChange(newContent);
            }
        }

        // Check for Markdown ``` code block trigger
        if (checkMarkdownCodeBlock()) {
            return;
        }

        // Check for auto-list formatting (- , * , 1. , > )
        if (checkAutoListFormatting()) {
            return;
        }

        // Check for Markdown inline formatting (*italic*, **bold**, etc)
        if (checkMarkdownInlineFormatting()) {
            return;
        }

        const plainText = e.currentTarget.textContent || '';
        const selection = window.getSelection();

        if (!selection.rangeCount) {
            setShowMentions(false);
            return;
        }

        // Get cursor position
        let cursorPos = 0;
        try {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(editorRef.current);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorPos = preCaretRange.toString().length;
        } catch (e) {
            setShowMentions(false);
            return;
        }

        // Check if cursor is right after a mention span WITHOUT space (don't trigger in this case)
        // But if there's a space after mention, allow new mentions
        const range = selection.getRangeAt(0);

        if (range.startOffset === 0) {
            const prevSibling = range.startContainer.previousSibling;
            if (prevSibling && prevSibling.classList &&
                (prevSibling.classList.contains('mention-user') ||
                    prevSibling.classList.contains('mention-channel'))) {
                setShowMentions(false);
                return;
            }
        }

        // Look for @ or # before cursor
        let foundTrigger = null;
        let triggerPos = -1;

        for (let i = cursorPos - 1; i >= 0; i--) {
            const char = plainText[i];
            if (char === '@' || char === '#') {
                if (i === 0 || plainText[i - 1] === ' ' || plainText[i - 1] === '\n' || plainText[i - 1] === '\u00A0') {
                    foundTrigger = char;
                    triggerPos = i;
                    break;
                }
            } else if (char === ' ' || char === '\n' || char === '\u00A0') {
                break;
            }
        }

        if (foundTrigger && triggerPos >= 0) {
            const query = plainText.substring(triggerPos + 1, cursorPos);

            setMentionType(foundTrigger);
            setMentionQuery(query);
            setShowMentions(true);
            setDropdownPosition(getCaretCoordinates());
            searchMentions(query, foundTrigger);
        } else {
            setShowMentions(false);
            setMentionQuery('');
            setMentionType(null);
        }
    };

    // Check if cursor is inside a code block
    const isInsideCodeBlock = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;
        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (current && current !== editorRef.current) {
            if (current.tagName === 'PRE') return true;
            current = current.parentElement;
        }
        return false;
    };

    // Check if cursor is inside inline code (CODE not inside PRE)
    const isInsideInlineCode = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;
        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let foundCode = false;
        let foundPre = false;
        while (current && current !== editorRef.current) {
            if (current.tagName === 'CODE') foundCode = true;
            if (current.tagName === 'PRE') foundPre = true;
            current = current.parentElement;
        }
        return foundCode && !foundPre;
    };

    // Handle list nesting with Tab/Shift+Tab
    const handleListNesting = (increase) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        let listItem = null;
        let parentList = null;

        while (current && current !== editorRef.current) {
            if (current.tagName === 'LI') listItem = current;
            if (current.tagName === 'UL' || current.tagName === 'OL') {
                parentList = current;
                break;
            }
            current = current.parentElement;
        }

        if (!listItem || !parentList) return false;

        if (increase) {
            // Increase nesting - wrap in new list inside previous sibling
            const prevLi = listItem.previousElementSibling;
            if (!prevLi) return false; // Can't nest first item

            // Check nesting level (max 3)
            let nestingLevel = 0;
            let checkParent = parentList;
            while (checkParent) {
                if (checkParent.tagName === 'UL' || checkParent.tagName === 'OL') nestingLevel++;
                checkParent = checkParent.parentElement?.closest('ul, ol');
            }
            if (nestingLevel >= 3) return false;

            // Create nested list
            let nestedList = prevLi.querySelector(':scope > ul, :scope > ol');
            if (!nestedList) {
                nestedList = document.createElement(parentList.tagName.toLowerCase());
                prevLi.appendChild(nestedList);
            }
            nestedList.appendChild(listItem);
        } else {
            // Decrease nesting - move item up one level
            const grandparentLi = parentList.parentElement?.closest('li');
            if (!grandparentLi) return false; // Already at top level

            const grandparentList = grandparentLi.parentElement;
            // Insert after the grandparent li
            if (grandparentLi.nextSibling) {
                grandparentList.insertBefore(listItem, grandparentLi.nextSibling);
            } else {
                grandparentList.appendChild(listItem);
            }

            // Clean up empty list
            if (parentList.children.length === 0) {
                parentList.remove();
            }
        }

        // Restore cursor
        const newRange = document.createRange();
        newRange.selectNodeContents(listItem);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);

        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
        return true;
    };

    const handleKeyDown = (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;

        // Handle formatting shortcuts (disabled inside code block AND inline code per spec FORBID rules)
        if (cmdKey && !isInsideCodeBlock() && !isInsideInlineCode()) {
            // Cmd/Ctrl + B = Bold
            if (e.key === 'b' && !e.shiftKey) {
                e.preventDefault();
                applyFormat('bold');
                return;
            }
            // Cmd/Ctrl + I = Italic
            if (e.key === 'i' && !e.shiftKey) {
                e.preventDefault();
                applyFormat('italic');
                return;
            }
            // Cmd/Ctrl + U = Underline
            if (e.key === 'u' && !e.shiftKey) {
                e.preventDefault();
                applyFormat('underline');
                return;
            }
            // Cmd/Ctrl + Shift + S = Strikethrough
            if (e.key === 's' && e.shiftKey) {
                e.preventDefault();
                applyFormat('strikeThrough');
                return;
            }
            // Cmd/Ctrl + E = Inline code
            if (e.key === 'e' && !e.shiftKey) {
                e.preventDefault();
                wrapSelectionWithTag('code');
                return;
            }
            // Cmd/Ctrl + K = Link
            if (e.key === 'k' && !e.shiftKey) {
                e.preventDefault();
                insertLink();
                return;
            }
            // Cmd/Ctrl + Shift + P = Spoiler
            if (e.key === 'p' && e.shiftKey) {
                e.preventDefault();
                insertSpoiler();
                return;
            }
            // Cmd/Ctrl + Shift + 8 = Unordered list
            if (e.key === '8' && e.shiftKey) {
                e.preventDefault();
                insertList(false);
                return;
            }
            // Cmd/Ctrl + Shift + 7 = Ordered list
            if (e.key === '7' && e.shiftKey) {
                e.preventDefault();
                insertList(true);
                return;
            }
            // Cmd/Ctrl + Shift + 9 = Blockquote
            if (e.key === '9' && e.shiftKey) {
                e.preventDefault();
                insertBlockquote();
                return;
            }
            // Cmd/Ctrl + Shift + C = Code block
            if (e.key === 'c' && e.shiftKey) {
                e.preventDefault();
                insertCodeBlock();
                return;
            }
        }

        // Cmd/Ctrl + Shift + V = Paste without formatting
        if (cmdKey && e.shiftKey && e.key === 'v') {
            e.preventDefault();
            navigator.clipboard.readText().then(text => {
                document.execCommand('insertText', false, text);
                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
            }).catch(() => {
                // Fallback for browsers that don't support clipboard API
            });
            return;
        }

        // Cmd/Ctrl + Enter = Exit code block
        if (cmdKey && e.key === 'Enter' && isInsideCodeBlock()) {
            e.preventDefault();
            // Exit code block by moving cursor outside
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            let node = selection.getRangeAt(0).startContainer;
            let preElement = null;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            while (current && current !== editorRef.current) {
                if (current.tagName === 'PRE') {
                    preElement = current;
                    break;
                }
                current = current.parentElement;
            }

            if (preElement) {
                // Add a br after the code block and move cursor there
                const br = document.createElement('br');
                if (preElement.nextSibling) {
                    preElement.parentNode.insertBefore(br, preElement.nextSibling);
                } else {
                    preElement.parentNode.appendChild(br);
                }

                const newRange = document.createRange();
                newRange.setStartAfter(br);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
            }
            return;
        }

        // Tab/Shift+Tab for list nesting
        if (e.key === 'Tab') {
            if (handleListNesting(!e.shiftKey)) {
                e.preventDefault();
                return;
            }
            // If not in a list, insert tab in code block
            if (isInsideCodeBlock()) {
                e.preventDefault();
                document.execCommand('insertText', false, '  ');
                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
                return;
            }
        }

        // Escape key to exit block formats (list, blockquote, code block)
        if (e.key === 'Escape' && !showMentions) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            let node = range.startContainer;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

            let blockElement = null;
            while (current && current !== editorRef.current) {
                if (current.tagName === 'PRE' || current.tagName === 'BLOCKQUOTE' ||
                    current.tagName === 'UL' || current.tagName === 'OL') {
                    blockElement = current;
                    break;
                }
                current = current.parentElement;
            }

            if (blockElement) {
                e.preventDefault();
                // Move cursor outside the block element
                const br = document.createElement('br');
                if (blockElement.nextSibling) {
                    blockElement.parentNode.insertBefore(br, blockElement.nextSibling);
                } else {
                    blockElement.parentNode.appendChild(br);
                }

                const newRange = document.createRange();
                newRange.setStartAfter(br);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                if (editorRef.current) {
                    onChange(editorRef.current.innerHTML);
                }
                return;
            }
        }

        // Backspace/Delete handling for code block and blockquote
        if (e.key === 'Backspace' || e.key === 'Delete') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            if (!range.collapsed) return; // Only handle when no selection

            let node = range.startContainer;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

            // Find code block (PRE) or blockquote
            let preElement = null;
            let blockquote = null;
            while (current && current !== editorRef.current) {
                if (current.tagName === 'PRE') {
                    preElement = current;
                    break;
                }
                if (current.tagName === 'BLOCKQUOTE') {
                    blockquote = current;
                    break;
                }
                current = current.parentElement;
            }

            // Handle empty code block deletion
            if (preElement) {
                const codeContent = preElement.textContent || '';
                // Check if code block is empty (only zero-width space or empty)
                if (codeContent === '' || codeContent === '\u200B' || codeContent.trim() === '') {
                    e.preventDefault();
                    // Remove the code block
                    const parent = preElement.parentNode;
                    preElement.remove();

                    // Position cursor
                    const newRange = document.createRange();
                    if (parent.childNodes.length > 0) {
                        newRange.setStart(parent, 0);
                    } else {
                        newRange.setStart(editorRef.current, 0);
                    }
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    if (editorRef.current) {
                        onChange(editorRef.current.innerHTML);
                    }
                    setTimeout(updateActiveFormats, 0);
                    return;
                }
            }

            // Handle blockquote at start (existing logic)
            if (blockquote && e.key === 'Backspace') {
                // Check if cursor is at the very start of blockquote
                const blockquoteRange = document.createRange();
                blockquoteRange.selectNodeContents(blockquote);
                blockquoteRange.setEnd(range.startContainer, range.startOffset);
                const textBefore = blockquoteRange.toString();

                if (textBefore === '' || textBefore === '\u200B') {
                    e.preventDefault();
                    // Convert blockquote to paragraph
                    const fragment = document.createDocumentFragment();
                    while (blockquote.firstChild) {
                        fragment.appendChild(blockquote.firstChild);
                    }
                    blockquote.parentNode.replaceChild(fragment, blockquote);

                    // Position cursor at start
                    const newRange = document.createRange();
                    newRange.setStart(editorRef.current, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    if (editorRef.current) {
                        onChange(editorRef.current.innerHTML);
                    }
                    return;
                }
            }
        }

        if (showMentions && mentionResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex((prev) =>
                    prev < mentionResults.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex((prev) =>
                    prev > 0 ? prev - 1 : mentionResults.length - 1
                );
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(mentionResults[selectedMentionIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentions(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.(e);
        } else if (e.key === 'Enter' && e.shiftKey) {
            // Check if we're inside a list item or blockquote
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                let node = range.startContainer;
                let listItem = null;
                let list = null;
                let blockquote = null;

                // Find parent LI and UL/OL or BLOCKQUOTE
                let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
                while (current && current !== editorRef.current) {
                    if (current.tagName === 'LI') {
                        listItem = current;
                    }
                    if (current.tagName === 'UL' || current.tagName === 'OL') {
                        list = current;
                        break;
                    }
                    if (current.tagName === 'BLOCKQUOTE') {
                        blockquote = current;
                        break;
                    }
                    current = current.parentElement;
                }

                // Handle list exit
                if (listItem && list) {
                    e.preventDefault();

                    // If current list item is empty, exit the list
                    if (listItem.textContent.trim() === '') {
                        // Remove empty list item
                        listItem.remove();

                        // Add a br after the list and move cursor there
                        const br = document.createElement('br');
                        if (list.nextSibling) {
                            list.parentNode.insertBefore(br, list.nextSibling);
                        } else {
                            list.parentNode.appendChild(br);
                        }

                        const newRange = document.createRange();
                        newRange.setStartAfter(br);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        // Create new list item
                        const newLi = document.createElement('li');
                        newLi.innerHTML = '\u200B'; // Zero-width space for cursor

                        // Insert after current list item
                        if (listItem.nextSibling) {
                            list.insertBefore(newLi, listItem.nextSibling);
                        } else {
                            list.appendChild(newLi);
                        }

                        // Move cursor to new list item
                        const newRange = document.createRange();
                        newRange.setStart(newLi, 0);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }

                    // Update value
                    if (editorRef.current) {
                        onChange(editorRef.current.innerHTML);
                    }
                    return;
                }

                // Handle blockquote exit
                if (blockquote) {
                    e.preventDefault();

                    // Check if cursor is at an empty last line (double Enter to exit)
                    // This happens when: blockquote ends with <br> and cursor is right after it
                    const blockquoteContent = blockquote.innerHTML;
                    const cursorNode = range.startContainer;
                    const cursorOffset = range.startOffset;

                    // Check if we're at end of blockquote after a BR (empty line)
                    const isAfterBr = (cursorNode === blockquote && cursorOffset > 0 &&
                                       blockquote.childNodes[cursorOffset - 1]?.nodeName === 'BR') ||
                                      (cursorNode.nodeName === 'BR') ||
                                      (cursorNode.nodeType === Node.TEXT_NODE &&
                                       cursorNode.textContent === '' &&
                                       cursorNode.previousSibling?.nodeName === 'BR');

                    // Also check if blockquote is empty or ends with double BR
                    const endsWithDoubleBr = blockquoteContent.endsWith('<br><br>') ||
                                             blockquoteContent.match(/<br>\s*$/);

                    if (blockquote.textContent.trim() === '' || isAfterBr) {
                        // Exit blockquote - remove the trailing BR/empty line
                        const lastChild = blockquote.lastChild;
                        if (lastChild?.nodeName === 'BR') {
                            lastChild.remove();
                        }

                        // If blockquote is now empty, remove it entirely
                        if (blockquote.textContent.trim() === '' && !blockquote.querySelector('*')) {
                            const br = document.createElement('br');
                            if (blockquote.nextSibling) {
                                blockquote.parentNode.insertBefore(br, blockquote.nextSibling);
                            } else {
                                blockquote.parentNode.appendChild(br);
                            }
                            blockquote.remove();

                            const newRange = document.createRange();
                            newRange.setStartAfter(br);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        } else {
                            // Add a br after the blockquote and move cursor there
                            const br = document.createElement('br');
                            if (blockquote.nextSibling) {
                                blockquote.parentNode.insertBefore(br, blockquote.nextSibling);
                            } else {
                                blockquote.parentNode.appendChild(br);
                            }

                            const newRange = document.createRange();
                            newRange.setStartAfter(br);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    } else {
                        // Just insert a line break inside blockquote
                        document.execCommand('insertLineBreak');
                    }

                    // Update value
                    if (editorRef.current) {
                        onChange(editorRef.current.innerHTML);
                    }
                    return;
                }
            }

            // Default Shift+Enter behavior - insert line break
            e.preventDefault();
            document.execCommand('insertLineBreak');
        }

        // Handle arrow keys to escape from inline code/formatting elements and spoilers
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const node = range.startContainer;

            // Find if we're inside a code element or spoiler
            let codeElement = null;
            let spoilerElement = null;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            while (current && current !== editorRef.current) {
                if (current.tagName === 'CODE' && current.parentElement?.tagName !== 'PRE') {
                    codeElement = current;
                }
                if (current.classList && (current.classList.contains('spoiler') || current.classList.contains('spoiler-edit'))) {
                    spoilerElement = current;
                }
                current = current.parentElement;
            }

            // Handle spoiler element - single arrow press exits spoiler
            if (spoilerElement) {
                e.preventDefault();
                const newRange = document.createRange();

                // Arrow Right - move cursor after the element
                if (e.key === 'ArrowRight') {
                    if (!spoilerElement.nextSibling ||
                        (spoilerElement.nextSibling.nodeType === Node.TEXT_NODE &&
                         spoilerElement.nextSibling.textContent === '')) {
                        const space = document.createTextNode('\u200B');
                        spoilerElement.parentNode.insertBefore(space, spoilerElement.nextSibling);
                    }

                    newRange.setStartAfter(spoilerElement);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    setTimeout(updateActiveFormats, 0);
                    return;
                }
                // Arrow Left - move cursor before the element
                else if (e.key === 'ArrowLeft') {
                    if (!spoilerElement.previousSibling ||
                        (spoilerElement.previousSibling.nodeType === Node.TEXT_NODE &&
                         spoilerElement.previousSibling.textContent === '')) {
                        const space = document.createTextNode('\u200B');
                        spoilerElement.parentNode.insertBefore(space, spoilerElement);
                    }

                    newRange.setStartBefore(spoilerElement);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    setTimeout(updateActiveFormats, 0);
                    return;
                }
            }

            // Handle code element
            if (codeElement) {
                const textContent = codeElement.textContent || '';
                const isAtStart = range.startOffset === 0 && node === codeElement.firstChild;
                const isAtEnd = range.startOffset === textContent.length ||
                    (node === codeElement.lastChild && range.startOffset === node.textContent?.length);

                // Arrow Right at end of code - move cursor after the element
                if (e.key === 'ArrowRight' && isAtEnd) {
                    e.preventDefault();
                    const newRange = document.createRange();

                    // Insert a zero-width space after code if there's nothing
                    if (!codeElement.nextSibling ||
                        (codeElement.nextSibling.nodeType === Node.TEXT_NODE &&
                         codeElement.nextSibling.textContent === '')) {
                        const space = document.createTextNode('\u200B');
                        codeElement.parentNode.insertBefore(space, codeElement.nextSibling);
                    }

                    newRange.setStartAfter(codeElement);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
                // Arrow Left at start of code - move cursor before the element
                else if (e.key === 'ArrowLeft' && isAtStart) {
                    e.preventDefault();
                    const newRange = document.createRange();

                    // Insert a zero-width space before code if there's nothing
                    if (!codeElement.previousSibling ||
                        (codeElement.previousSibling.nodeType === Node.TEXT_NODE &&
                         codeElement.previousSibling.textContent === '')) {
                        const space = document.createTextNode('\u200B');
                        codeElement.parentNode.insertBefore(space, codeElement);
                    }

                    newRange.setStartBefore(codeElement);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }
    };

    return (
        <div className="relative">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2">
                {/* Inline formatting buttons - disabled inside code block or inline code per FORBID rules */}
                <ToolbarButton onClick={() => applyFormat('bold')} icon={<Bold size={16} />} title="Жирный" shortcut="⌘B" isActive={activeFormats.bold} disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />
                <ToolbarButton onClick={() => applyFormat('italic')} icon={<Italic size={16} />} title="Курсив" shortcut="⌘I" isActive={activeFormats.italic} disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />
                <ToolbarButton onClick={() => applyFormat('underline')} icon={<Underline size={16} />} title="Подчёркнутый" shortcut="⌘U" isActive={activeFormats.underline} disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />
                <ToolbarButton onClick={() => applyFormat('strikeThrough')} icon={<Strikethrough size={16} />} title="Зачёркнутый" shortcut="⌘⇧S" isActive={activeFormats.strikeThrough} disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />

                <div className="w-px h-5 bg-gray-700 mx-1"></div>

                {/* Link - disabled inside code block or inline code */}
                <ToolbarButton onClick={insertLink} icon={<Link size={16} />} title="Вставить ссылку" shortcut="⌘K" disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />
                {/* Lists - disabled inside code block */}
                <ToolbarButton onClick={() => insertList(true)} icon={<ListOrdered size={16} />} title="Нумерованный список" shortcut="⌘⇧7" isActive={activeFormats.inOrderedList} disabled={activeFormats.inCodeBlock} />
                <ToolbarButton onClick={() => insertList(false)} icon={<List size={16} />} title="Маркированный список" shortcut="⌘⇧8" isActive={activeFormats.inList} disabled={activeFormats.inCodeBlock} />

                <div className="w-px h-5 bg-gray-700 mx-1"></div>

                {/* Code block toggle - always enabled */}
                <ToolbarButton onClick={insertCodeBlock} icon={<FileCode size={16} />} title="Блок кода" shortcut="⌘⇧C" isActive={activeFormats.inCodeBlock} />
                {/* Inline code - disabled inside code block */}
                <ToolbarButton onClick={() => wrapSelectionWithTag('code')} icon={<Code size={16} />} title="Код в строке" shortcut="⌘E" isActive={activeFormats.inInlineCode} disabled={activeFormats.inCodeBlock} />
                {/* Blockquote - disabled inside code block */}
                <ToolbarButton onClick={insertBlockquote} icon={<Quote size={16} />} title="Цитата" shortcut="⌘⇧9" isActive={activeFormats.inBlockquote} disabled={activeFormats.inCodeBlock} />
                {/* Spoiler - disabled inside code block or inline code */}
                <ToolbarButton onClick={insertSpoiler} icon={<EyeOff size={16} />} title="Спойлер" shortcut="⌘⇧P" isActive={activeFormats.inSpoiler} disabled={activeFormats.inCodeBlock || activeFormats.inInlineCode} />

                <div className="w-px h-5 bg-gray-700 mx-1"></div>

                <ToolbarButton
                    onClick={() => {
                        document.execCommand('insertText', false, '@');
                        editorRef.current?.focus();
                    }}
                    icon={<AtSign size={16} />}
                    title="Mention User (@)"
                />
                <ToolbarButton
                    onClick={() => {
                        document.execCommand('insertText', false, '#');
                        editorRef.current?.focus();
                    }}
                    icon={<Hash size={16} />}
                    title="Mention Channel (#)"
                />
            </div>

            {/* Editor */}
            <div className="relative">
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onClick={handleEditorClick}
                    onPaste={handlePaste}
                    dir="ltr"
                    className="w-full min-w-0 px-3 py-2 max-h-[200px] overflow-y-auto overflow-x-hidden bg-transparent text-gray-200 focus:outline-none leading-normal break-words whitespace-pre-wrap [word-break:break-word]"
                    data-placeholder={placeholder}
                    suppressContentEditableWarning
                />

                {/* Link Tooltip */}
                {linkTooltip.visible && (
                    <div
                        ref={linkTooltipRef}
                        className="absolute bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl z-50 py-1.5 px-2 flex items-center gap-2"
                        style={{
                            top: linkTooltip.position.top,
                            left: linkTooltip.position.left
                        }}
                    >
                        <a
                            href={linkTooltip.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 truncate max-w-[200px] flex items-center gap-1"
                            title={linkTooltip.url}
                        >
                            <ExternalLink size={12} />
                            <span className="truncate">{linkTooltip.url}</span>
                        </a>
                        <div className="w-px h-4 bg-gray-600"></div>
                        <button
                            onClick={editLink}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="Редактировать ссылку"
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            onClick={removeLink}
                            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                            title="Удалить ссылку"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Link Insert Modal */}
                {linkModal.visible && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={closeLinkModal}>
                        <div
                            ref={linkModalRef}
                            className="bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl p-4 w-80"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-medium flex items-center gap-2">
                                    <Link size={18} />
                                    Вставить ссылку
                                </h3>
                                <button
                                    onClick={closeLinkModal}
                                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">URL</label>
                                    <input
                                        ref={linkUrlInputRef}
                                        type="text"
                                        value={linkModal.url}
                                        onChange={e => setLinkModal(prev => ({ ...prev, url: e.target.value, error: '' }))}
                                        onKeyDown={handleLinkModalKeyDown}
                                        placeholder="https://example.com"
                                        className="w-full bg-[#2b2d31] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
                                    />
                                </div>

                                {!linkModal.hasSelection && (
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Текст ссылки (опционально)</label>
                                        <input
                                            type="text"
                                            value={linkModal.text}
                                            onChange={e => setLinkModal(prev => ({ ...prev, text: e.target.value }))}
                                            onKeyDown={handleLinkModalKeyDown}
                                            placeholder="Текст для отображения"
                                            className="w-full bg-[#2b2d31] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
                                        />
                                    </div>
                                )}

                                {linkModal.error && (
                                    <p className="text-red-400 text-sm">{linkModal.error}</p>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={closeLinkModal}
                                        className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={submitLinkModal}
                                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
                                    >
                                        Вставить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mention Autocomplete Dropdown */}
                {showMentions && mentionResults.length > 0 && (
                    <div
                        className="absolute w-64 bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50"
                        style={{
                            bottom: `calc(100% - ${dropdownPosition.top}px - 10px)`,
                            left: `${dropdownPosition.left}px`
                        }}
                    >
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-700">
                            {mentionType === '@' ? 'Mention User' : 'Mention Channel'}
                        </div>
                        {mentionResults.map((item, index) => (
                            <div
                                key={item.id}
                                className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors ${index === selectedMentionIndex
                                    ? 'bg-blue-600/30 text-blue-400'
                                    : 'hover:bg-blue-600/20 hover:text-blue-400 text-gray-300'
                                    }`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    insertMention(item);
                                }}
                                onMouseEnter={() => setSelectedMentionIndex(index)}
                            >
                                {mentionType === '@' ? (
                                    <>
                                        <img
                                            src={item.avatar_url || `https://ui-avatars.com/api/?name=${item.username}&background=random`}
                                            alt={item.username}
                                            className="w-6 h-6 rounded bg-gray-700"
                                        />
                                        <span className="text-sm font-medium">@{item.username}</span>
                                    </>
                                ) : (
                                    <>
                                        <Hash size={16} className="text-gray-400" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">#{item.name}</div>
                                            {item.description && (
                                                <div className="text-xs text-gray-500">{item.description}</div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 py-2">
                    {attachments.map((file, index) => (
                        <div key={index} className="relative group flex items-center gap-2 bg-[#2b2d31] rounded-lg px-3 py-2">
                            {file.type?.startsWith('image/') ? (
                                <img
                                    src={file.preview || URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-10 h-10 object-cover rounded"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-[#3f4147] rounded flex items-center justify-center">
                                    <Paperclip size={16} className="text-gray-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate max-w-[150px]">{file.name}</div>
                                <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                            </div>
                            {onRemoveAttachment && (
                                <button
                                    onClick={() => onRemoveAttachment(index)}
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                >
                                    <X size={14} className="text-gray-400 hover:text-red-400" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-1">
                    {/* File attachment */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
                        title="Attach file"
                    >
                        <Paperclip size={16} />
                    </button>

                    {/* Emoji picker */}
                    <div className="relative" ref={emojiButtonRef}>
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                // Save selection before click removes focus
                                saveSelection();
                            }}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
                            title="Add emoji"
                        >
                            <Smile size={16} />
                        </button>
                        {showEmojiPicker && (
                            <div className="emoji-picker-container absolute bottom-full left-0 mb-2 z-50">
                                <QuickEmojiPicker
                                    onSelect={insertEmoji}
                                    onClose={() => setShowEmojiPicker(false)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Voice recording */}
                    {!isRecording && !recordedAudio ? (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
                            title="Record voice message"
                        >
                            <Mic size={16} />
                        </button>
                    ) : isRecording ? (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-red-400 text-sm font-medium min-w-[40px]">{formatRecordingTime(recordingTime)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={cancelRecording}
                                    className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                                    title="Cancel recording"
                                >
                                    <Trash2 size={16} className="text-gray-300" />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopRecording}
                                    className="p-1.5 bg-green-600 hover:bg-green-500 rounded-full transition-colors"
                                    title="Done - preview recording"
                                >
                                    <Check size={16} className="text-white" />
                                </button>
                            </div>
                        </div>
                    ) : recordedAudio ? (
                        <div className="flex items-center gap-3 bg-[#2d3748] border border-gray-600 rounded-lg px-4 py-2">
                            <audio
                                ref={previewAudioRef}
                                src={recordedAudio.url}
                                onEnded={() => setIsPlayingPreview(false)}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={togglePreviewPlayback}
                                className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-full transition-colors"
                                title={isPlayingPreview ? 'Pause' : 'Play preview'}
                            >
                                {isPlayingPreview ? (
                                    <Pause size={16} className="text-white" />
                                ) : (
                                    <Play size={16} className="text-white" fill="currentColor" />
                                )}
                            </button>
                            <div className="flex items-center gap-1.5">
                                <Mic size={14} className="text-gray-400" />
                                <span className="text-gray-200 text-sm font-medium">{formatRecordingTime(recordedAudio.duration)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={discardVoiceMessage}
                                    className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-full transition-colors"
                                    title="Discard"
                                >
                                    <Trash2 size={16} className="text-gray-300 hover:text-white" />
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmVoiceMessage}
                                    className="p-1.5 bg-green-600 hover:bg-green-500 rounded-full transition-colors"
                                    title="Send voice message"
                                >
                                    <Send size={16} className="text-white" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="flex items-center">
                    <button
                        type="submit"
                        onClick={onSubmit}
                        disabled={disabled || isRecording}
                        className={`px-2 h-8 rounded-l transition-colors flex items-center justify-center ${!disabled && !isRecording ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                        <Send size={16} />
                    </button>
                    <div className="relative" ref={scheduleMenuRef}>
                        <button
                            type="button"
                            onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                            disabled={disabled || isRecording}
                            className={`px-1.5 h-8 rounded-r border-l border-[#005c47] transition-colors flex items-center justify-center ${!disabled && !isRecording ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            title="Отложить отправку"
                        >
                            <ChevronDown size={14} />
                        </button>

                        {/* Schedule Menu */}
                        {showScheduleMenu && (
                            <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                <div className="px-3 py-2 border-b border-gray-700">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                        <Clock size={14} />
                                        <span>Отложить отправку</span>
                                    </div>
                                </div>

                                {!showCustomSchedule ? (
                                    <>
                                        <div className="py-1">
                                            {getSchedulePresets().map((preset, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleScheduleSelect(preset.date)}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#2b2d31] transition-colors flex justify-between items-center"
                                                >
                                                    <span>{preset.label}</span>
                                                    <span className="text-gray-500 text-xs">{formatScheduleTime(preset.date)}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="border-t border-gray-700">
                                            <button
                                                onClick={() => setShowCustomSchedule(true)}
                                                className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-[#2b2d31] transition-colors"
                                            >
                                                Выбрать дату и время...
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-3 space-y-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Дата</label>
                                            <input
                                                type="date"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="w-full px-2 py-1.5 bg-[#2b2d31] border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Время</label>
                                            <input
                                                type="time"
                                                value={scheduledTime}
                                                onChange={(e) => setScheduledTime(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-[#2b2d31] border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowCustomSchedule(false)}
                                                className="flex-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                                            >
                                                Назад
                                            </button>
                                            <button
                                                onClick={handleCustomSchedule}
                                                disabled={!scheduledDate || !scheduledTime}
                                                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Запланировать
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            <style>{`
                [contentEditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #6b7280;
                    pointer-events: none;
                }
                [contentEditable] a {
                    color: #3b82f6;
                    text-decoration: underline;
                }
                [contentEditable] code {
                    background: #374151;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace;
                    font-size: 0.9em;
                    color: #E18B00;
                }
                [contentEditable] pre {
                    background: #1f2937;
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace;
                    margin: 8px 0;
                }
                [contentEditable] pre code {
                    background: transparent;
                    padding: 0;
                }
                [contentEditable] blockquote {
                    border-left: 4px solid #4b5563;
                    padding-left: 12px;
                    margin: 8px 0;
                    color: #9ca3af;
                    font-style: italic;
                }
                [contentEditable] ul {
                    list-style-type: disc;
                    padding-left: 24px;
                    margin: 4px 0;
                }
                /* Nested UL markers per spec: • / ◦ / ▪ */
                [contentEditable] ul ul {
                    list-style-type: circle;
                }
                [contentEditable] ul ul ul {
                    list-style-type: square;
                }
                [contentEditable] ol {
                    list-style-type: decimal;
                    padding-left: 24px;
                    margin: 4px 0;
                }
                /* Nested OL markers per spec: 1 / a / i */
                [contentEditable] ol ol {
                    list-style-type: lower-alpha;
                }
                [contentEditable] ol ol ol {
                    list-style-type: lower-roman;
                }
                [contentEditable] li {
                    margin: 2px 0;
                }
                [contentEditable] b, [contentEditable] strong {
                    font-weight: 700;
                }
                [contentEditable] i, [contentEditable] em {
                    font-style: italic;
                }
                [contentEditable] u {
                    text-decoration: underline;
                }
                [contentEditable] s, [contentEditable] strike {
                    text-decoration: line-through;
                }
                [contentEditable] .mention-user,
                [contentEditable] .mention-channel {
                    display: inline-block;
                    margin: 0 1px;
                }
                [contentEditable] .spoiler-edit {
                    background: #4b5563;
                    padding: 1px 4px;
                    border-radius: 3px;
                    color: #e5e7eb;
                    caret-color: #e5e7eb;
                }
            `}</style>
        </div>
    );
}

function ToolbarButton({ onClick, icon, title, isActive = false, shortcut, disabled = false }) {
    const fullTitle = shortcut ? `${title} (${shortcut})` : title;
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${
                disabled
                    ? 'text-gray-600 cursor-not-allowed opacity-50'
                    : isActive
                        ? 'bg-blue-600/30 text-blue-400'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            title={fullTitle}
            aria-label={fullTitle}
            aria-pressed={isActive}
            aria-disabled={disabled}
        >
            {icon}
        </button>
    );
}
