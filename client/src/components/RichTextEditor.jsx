import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, List, ListOrdered, Code, FileCode, Send, Plus, Smile, Hash, AtSign } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function RichTextEditor({ value, onChange, placeholder, onSubmit, disabled }) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionType, setMentionType] = useState(null); // '@' or '#'
    const [mentionResults, setMentionResults] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const editorRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const applyFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    const insertLink = () => {
        const url = prompt('Enter URL:');
        if (url) {
            applyFormat('createLink', url);
        }
        setShowLinkInput(false);
    };

    const searchMentions = async (query, type) => {
        try {
            // Always search, even with empty query
            const searchQuery = query.length === 0 ? '' : query;
            const res = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery || ' ')}`);
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

    const insertMention = (item) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Get all text content
        const fullText = editorRef.current.textContent || '';

        // Find the @ or # position before cursor
        let cursorOffset = 0;
        try {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(editorRef.current);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorOffset = preCaretRange.toString().length;
        } catch (e) {
            console.error('Error getting cursor position:', e);
            return;
        }

        // Find trigger position
        let triggerPos = -1;
        for (let i = cursorOffset - 1; i >= 0; i--) {
            if (fullText[i] === mentionType) {
                triggerPos = i;
                break;
            }
        }

        if (triggerPos === -1) return;

        // Create mention HTML
        const mentionClass = mentionType === '@' ? 'mention-user' : 'mention-channel';
        const mentionText = mentionType === '@' ? `@${item.username}` : `#${item.name}`;
        const mentionId = item.id;

        // Build new HTML
        const beforeText = fullText.substring(0, triggerPos);
        const afterText = fullText.substring(cursorOffset);

        const mentionHTML = `<span class="${mentionClass}" data-id="${mentionId}" data-type="${mentionType === '@' ? 'user' : 'channel'}" contenteditable="false">${mentionText}</span>`;

        // Set new content
        editorRef.current.innerHTML = beforeText + mentionHTML + '&nbsp;' + afterText;

        // Move cursor after mention
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        // Find the text node after the mention
        const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let lastNode = walker.nextNode();
        while (walker.nextNode()) {
            lastNode = walker.currentNode;
        }

        if (lastNode) {
            newRange.setStart(lastNode, 0);
            newRange.collapse(true);
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
        }

        // Reset mention state
        setShowMentions(false);
        setMentionQuery('');
        setMentionType(null);
        setMentionResults([]);
        setSelectedMentionIndex(0);

        // Update value
        onChange(editorRef.current.innerHTML);
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

        setCursorPosition(cursorPos);

        // Look for @ or # before cursor
        let foundTrigger = null;
        let triggerPos = -1;

        for (let i = cursorPos - 1; i >= 0; i--) {
            const char = plainText[i];
            if (char === '@' || char === '#') {
                if (i === 0 || plainText[i - 1] === ' ' || plainText[i - 1] === '\n') {
                    foundTrigger = char;
                    triggerPos = i;
                    break;
                }
            } else if (char === ' ' || char === '\n') {
                break;
            }
        }

        if (foundTrigger && triggerPos >= 0) {
            const query = plainText.substring(triggerPos + 1, cursorPos);
            console.log('Mention detected:', foundTrigger, 'query:', `"${query}"`);

            setMentionType(foundTrigger);
            setMentionQuery(query);
            setShowMentions(true);
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
        }
    };

    return (
        <div className="border border-gray-600 rounded-xl bg-[#222529] focus-within:border-gray-400 transition-all relative">
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

                <ToolbarButton onClick={() => applyFormat('formatBlock', '<pre>')} icon={<Code size={16} />} title="Code Block" />
                <ToolbarButton onClick={() => applyFormat('insertHTML', '<code></code>')} icon={<FileCode size={16} />} title="Inline Code" />

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
                        className="absolute bottom-full left-3 mb-2 w-64 bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50"
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

            {/* Action Bar */}
            <div className="flex items-center justify-between p-2 border-t border-gray-700">
                <div className="flex items-center gap-1">
                    <ActionBtn icon={<Plus size={16} />} />
                    <ActionBtn icon={<Smile size={16} />} />
                </div>
                <button
                    type="submit"
                    onClick={onSubmit}
                    disabled={disabled}
                    className={`p-2 rounded transition-colors ${!disabled ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                    <Send size={16} />
                </button>
            </div>

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
                    font-family: monospace;
                }
                [contentEditable] pre {
                    background: #1f2937;
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    font-family: monospace;
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

function ActionBtn({ icon }) {
    return (
        <button
            type="button"
            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
        >
            {icon}
        </button>
    );
}
