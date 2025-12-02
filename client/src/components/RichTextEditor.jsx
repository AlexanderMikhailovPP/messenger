import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Smile, Hash, AtSign } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function RichTextEditor({ value, onChange, placeholder, onSubmit, disabled }) {
    const [textValue, setTextValue] = useState('');
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionType, setMentionType] = useState(null);
    const [mentionResults, setMentionResults] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef(null);
    const { user } = useAuth();

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

    const insertMention = (item) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;

        // Find the @ or # position before cursor
        let triggerPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === mentionType) {
                triggerPos = i;
                break;
            }
        }

        if (triggerPos === -1) return;

        // Create mention text
        const mentionText = mentionType === '@' ? `@${item.username}` : `#${item.name}`;

        // Build new text
        const beforeText = text.substring(0, triggerPos);
        const afterText = text.substring(cursorPos);
        const newText = beforeText + mentionText + ' ' + afterText;

        // Update textarea
        setTextValue(newText);
        onChange(newText);

        // Position cursor after mention
        const newCursorPos = triggerPos + mentionText.length + 1;
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);

        // Reset mention state
        setShowMentions(false);
        setMentionQuery('');
        setMentionType(null);
        setMentionResults([]);
        setSelectedMentionIndex(0);
    };

    const handleInput = (e) => {
        const text = e.target.value;
        setTextValue(text);
        onChange(text);

        const cursorPos = e.target.selectionStart;
        setCursorPosition(cursorPos);

        // Look for @ or # before cursor
        let foundTrigger = null;
        let triggerPos = -1;

        for (let i = cursorPos - 1; i >= 0; i--) {
            const char = text[i];
            if (char === '@' || char === '#') {
                if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
                    foundTrigger = char;
                    triggerPos = i;
                    break;
                }
            } else if (char === ' ' || char === '\n') {
                break;
            }
        }

        if (foundTrigger && triggerPos >= 0) {
            const query = text.substring(triggerPos + 1, cursorPos);
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
            {/* Editor */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={textValue}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full p-3 min-h-[80px] max-h-[200px] resize-none bg-transparent text-gray-200 focus:outline-none placeholder-gray-500"
                    dir="ltr"
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
                    <ActionBtn
                        icon={<AtSign size={16} />}
                        onClick={() => {
                            const textarea = textareaRef.current;
                            if (textarea) {
                                const pos = textarea.selectionStart;
                                const newText = textValue.slice(0, pos) + '@' + textValue.slice(pos);
                                setTextValue(newText);
                                onChange(newText);
                                setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(pos + 1, pos + 1);
                                }, 0);
                            }
                        }}
                    />
                    <ActionBtn
                        icon={<Hash size={16} />}
                        onClick={() => {
                            const textarea = textareaRef.current;
                            if (textarea) {
                                const pos = textarea.selectionStart;
                                const newText = textValue.slice(0, pos) + '#' + textValue.slice(pos);
                                setTextValue(newText);
                                onChange(newText);
                                setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(pos + 1, pos + 1);
                                }, 0);
                            }
                        }}
                    />
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
        </div>
    );
}

function ActionBtn({ icon, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors"
        >
            {icon}
        </button>
    );
}
