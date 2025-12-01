import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, List, ListOrdered, Code, FileCode, Send, Plus, Smile } from 'lucide-react';

export default function RichTextEditor({ value, onChange, placeholder, onSubmit, disabled }) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const editorRef = useRef(null);

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

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.(e);
        }
    };

    return (
        <div className="border border-gray-600 rounded-xl bg-[#222529] focus-within:border-gray-400 transition-all">
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
            </div>

            {/* Editor */}
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
