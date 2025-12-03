import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, List, ListOrdered, Code, FileCode, Quote, Send, Paperclip, Smile, Hash, AtSign, Mic, Square, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import QuickEmojiPicker from './QuickEmojiPicker';

export default function RichTextEditor({ value, onChange, placeholder, onSubmit, disabled, onFileAttach, onVoiceMessage, attachments = [], onRemoveAttachment }) {
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
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        // Trigger onChange after formatting
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const wrapSelectionWithTag = (tagName) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
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

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const insertCodeBlock = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        // Create pre > code structure
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = selectedText || '\u200B'; // Zero-width space if empty
        pre.appendChild(code);

        range.deleteContents();
        range.insertNode(pre);

        // Move cursor inside the code block
        const newRange = document.createRange();
        if (selectedText) {
            // If there was selected text, place cursor at the end
            newRange.setStart(code, code.childNodes.length);
        } else {
            // If empty, place cursor at start (before zero-width space)
            newRange.setStart(code, 0);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const insertLink = () => {
        const url = prompt('Enter URL:');
        if (url) {
            applyFormat('createLink', url);
        }
        setShowLinkInput(false);
    };

    const insertBlockquote = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        // Create blockquote element
        const blockquote = document.createElement('blockquote');
        blockquote.textContent = selectedText || '\u200B'; // Zero-width space if empty

        range.deleteContents();
        range.insertNode(blockquote);

        // Move cursor inside the blockquote
        const newRange = document.createRange();
        if (selectedText) {
            newRange.setStart(blockquote, blockquote.childNodes.length);
        } else {
            newRange.setStart(blockquote, 0);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        editorRef.current?.focus();
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    // Insert emoji at cursor position
    const insertEmoji = (emoji) => {
        if (!editorRef.current) return;

        editorRef.current.focus();
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
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (onVoiceMessage) {
                    onVoiceMessage(audioBlob);
                }
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Could not access microphone. Please allow microphone permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            // Don't call onVoiceMessage - just discard
            audioChunksRef.current = [];
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            // Stop tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
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

    const handleInput = (e) => {
        const content = e.currentTarget.innerHTML;
        onChange(content);

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

    const handleKeyDown = (e) => {
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
            } else if (e.key === 'Enter' || e.key === 'Tab') {
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
            // Check if we're inside a list item
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                let node = range.startContainer;
                let listItem = null;
                let list = null;

                // Find parent LI and UL/OL
                let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
                while (current && current !== editorRef.current) {
                    if (current.tagName === 'LI') {
                        listItem = current;
                    }
                    if (current.tagName === 'UL' || current.tagName === 'OL') {
                        list = current;
                        break;
                    }
                    current = current.parentElement;
                }

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
            }

            // Default Shift+Enter behavior - insert line break
            document.execCommand('insertLineBreak');
        }

        // Handle arrow keys to escape from inline code/formatting elements
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const node = range.startContainer;

            // Find if we're inside a code element
            let codeElement = null;
            let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            while (current && current !== editorRef.current) {
                if (current.tagName === 'CODE' && current.parentElement?.tagName !== 'PRE') {
                    codeElement = current;
                    break;
                }
                current = current.parentElement;
            }

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
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700">
                <ToolbarButton onClick={() => applyFormat('bold')} icon={<Bold size={16} />} title="Bold" />
                <ToolbarButton onClick={() => applyFormat('italic')} icon={<Italic size={16} />} title="Italic" />
                <ToolbarButton onClick={() => applyFormat('underline')} icon={<Underline size={16} />} title="Underline" />
                <ToolbarButton onClick={() => applyFormat('strikeThrough')} icon={<Strikethrough size={16} />} title="Strikethrough" />

                <div className="w-px h-5 bg-gray-700 mx-1"></div>

                <ToolbarButton onClick={insertLink} icon={<Link size={16} />} title="Insert Link" />
                <ToolbarButton onClick={() => applyFormat('insertOrderedList')} icon={<ListOrdered size={16} />} title="Numbered List" />
                <ToolbarButton onClick={() => applyFormat('insertUnorderedList')} icon={<List size={16} />} title="Bullet List" />

                <div className="w-px h-5 bg-gray-700 mx-1"></div>

                <ToolbarButton onClick={insertCodeBlock} icon={<Code size={16} />} title="Code Block" />
                <ToolbarButton onClick={() => wrapSelectionWithTag('code')} icon={<FileCode size={16} />} title="Inline Code" />
                <ToolbarButton onClick={insertBlockquote} icon={<Quote size={16} />} title="Quote" />

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
                    dir="ltr"
                    className="w-full p-3 min-h-[80px] max-h-[200px] overflow-y-auto bg-transparent text-gray-200 focus:outline-none"
                    data-placeholder={placeholder}
                    suppressContentEditableWarning
                />

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
                <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-gray-700">
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
            <div className="flex items-center justify-between p-2 border-t border-gray-700">
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
                    {!isRecording ? (
                        <button
                            type="button"
                            onClick={startRecording}
                            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
                            title="Record voice message"
                        >
                            <Mic size={16} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 bg-red-500/20 rounded-full px-3 py-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-400 text-sm font-medium">{formatRecordingTime(recordingTime)}</span>
                            <button
                                type="button"
                                onClick={cancelRecording}
                                className="p-1 hover:bg-red-500/30 rounded-full transition-colors"
                                title="Cancel"
                            >
                                <X size={14} className="text-red-400" />
                            </button>
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="p-1 hover:bg-red-500/30 rounded-full transition-colors"
                                title="Stop and send"
                            >
                                <Square size={14} className="text-red-400" fill="currentColor" />
                            </button>
                        </div>
                    )}
                </div>
                <button
                    type="submit"
                    onClick={onSubmit}
                    disabled={disabled || isRecording}
                    className={`p-2 rounded transition-colors ${!disabled && !isRecording ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                    <Send size={16} />
                </button>
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
                [contentEditable] ol {
                    list-style-type: decimal;
                    padding-left: 24px;
                    margin: 4px 0;
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
            `}</style>
        </div>
    );
}

function ToolbarButton({ onClick, icon, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded transition-colors"
            title={title}
        >
            {icon}
        </button>
    );
}
