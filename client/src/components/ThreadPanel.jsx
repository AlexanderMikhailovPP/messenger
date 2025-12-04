import { useState, useEffect, useRef } from 'react';
import { X, Send, Hash, MessageSquare, Smile, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import axios from 'axios';
import { getSocket } from '../socket';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import UserAvatar from './UserAvatar';
import QuickEmojiPicker from './QuickEmojiPicker';
import UserMentionPopup from './UserMentionPopup';
import { sanitizeHTML } from '../utils/sanitize';
import toast from 'react-hot-toast';

export default function ThreadPanel({ parentMessage, channelName, onClose, setCurrentChannel }) {
    const { user } = useAuth();
    const { joinCall } = useCall();
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState('');
    const [loading, setLoading] = useState(true);
    const [reactions, setReactions] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [showActions, setShowActions] = useState(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionType, setMentionType] = useState(null);
    const [mentionResults, setMentionResults] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const [mentionPopup, setMentionPopup] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const editInputRef = useRef(null);
    const hoverTimeoutRef = useRef(null);
    const showPopupTimeoutRef = useRef(null);

    // Fetch thread data and reactions
    useEffect(() => {
        if (!parentMessage?.id) return;

        const fetchThread = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`/api/messages/thread/${parentMessage.id}`);
                setReplies(res.data.replies || []);

                // Fetch reactions for all messages (parent + replies)
                const allMessageIds = [parentMessage.id, ...(res.data.replies || []).map(r => r.id)];
                const reactionsData = {};
                await Promise.all(
                    allMessageIds.map(async (msgId) => {
                        try {
                            const reactRes = await axios.get(`/api/reactions/${msgId}/reactions`);
                            reactionsData[msgId] = reactRes.data;
                        } catch (e) {
                            reactionsData[msgId] = [];
                        }
                    })
                );
                setReactions(reactionsData);
            } catch (err) {
                console.error('Failed to fetch thread:', err);
                toast.error('Failed to load thread');
            } finally {
                setLoading(false);
            }
        };

        fetchThread();
    }, [parentMessage?.id]);

    // Socket listeners for real-time updates
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !parentMessage?.id) return;

        socket.emit('join_thread', parentMessage.id);

        const handleThreadReply = (message) => {
            if (message.thread_id === parentMessage.id) {
                setReplies(prev => [...prev, message]);
                setReactions(prev => ({ ...prev, [message.id]: [] }));
            }
        };

        const handleMessageUpdated = (updatedMessage) => {
            setReplies(prev => prev.map(msg =>
                msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
            ));
        };

        socket.on('thread_reply', handleThreadReply);
        socket.on('message_updated', handleMessageUpdated);

        return () => {
            socket.emit('leave_thread', parentMessage.id);
            socket.off('thread_reply', handleThreadReply);
            socket.off('message_updated', handleMessageUpdated);
        };
    }, [parentMessage?.id]);

    // Scroll to bottom when new replies come in
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [replies.length]);

    // Focus input on open
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Focus edit input when editing
    useEffect(() => {
        if (editingMessage && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.setSelectionRange(editContent.length, editContent.length);
        }
    }, [editingMessage]);

    // Fetch user info for mention popup
    const fetchUserInfo = async (userId, position) => {
        try {
            const res = await axios.get(`/api/users/${userId}`);
            setMentionPopup({ user: res.data, position });
        } catch (err) {
            console.error('Failed to fetch user info:', err);
        }
    };

    // Handle mention hover and clicks in thread panel
    useEffect(() => {
        const panel = document.querySelector('.thread-panel-container');
        if (!panel) return;

        const handleMouseOver = (e) => {
            const target = e.target.closest('.mention-user, .message-username');
            if (target) {
                const userId = target.getAttribute('data-id');
                if (userId) {
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }
                    if (!mentionPopup || mentionPopup.user.id !== parseInt(userId)) {
                        // Clear any pending show timer
                        if (showPopupTimeoutRef.current) {
                            clearTimeout(showPopupTimeoutRef.current);
                        }

                        const rect = target.getBoundingClientRect();
                        const position = { x: rect.left, y: rect.top - 10 };

                        // Add delay before showing new popup to avoid switching while moving to current popup
                        showPopupTimeoutRef.current = setTimeout(() => {
                            fetchUserInfo(userId, position);
                        }, mentionPopup ? 200 : 0);
                    }
                }
            }
        };

        const handleMouseOut = (e) => {
            const target = e.target.closest('.mention-user, .message-username');
            if (target) {
                // Clear pending show timer when leaving
                if (showPopupTimeoutRef.current) {
                    clearTimeout(showPopupTimeoutRef.current);
                    showPopupTimeoutRef.current = null;
                }
                // Delay closing to allow moving to popup (longer timeout for smoother UX)
                hoverTimeoutRef.current = setTimeout(() => {
                    setMentionPopup(null);
                }, 500);
            }
        };

        // Handle clicks on channel mentions
        const handleClick = async (e) => {
            const target = e.target.closest('.mention-channel');
            if (target) {
                const channelId = target.getAttribute('data-id');
                if (channelId) {
                    try {
                        const res = await axios.get(`/api/channels/${channelId}`);
                        if (res.data) {
                            setCurrentChannel(res.data);
                            onClose();
                        }
                    } catch (err) {
                        console.error('Failed to navigate to channel:', err);
                        toast.error('Failed to navigate to channel');
                    }
                }
            }
        };

        panel.addEventListener('mouseover', handleMouseOver);
        panel.addEventListener('mouseout', handleMouseOut);
        panel.addEventListener('click', handleClick);

        return () => {
            panel.removeEventListener('mouseover', handleMouseOver);
            panel.removeEventListener('mouseout', handleMouseOut);
            panel.removeEventListener('click', handleClick);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            if (showPopupTimeoutRef.current) clearTimeout(showPopupTimeoutRef.current);
        };
    }, [mentionPopup, setCurrentChannel, onClose]);

    // Handle message to user from popup
    const handleMessageUser = async (targetUser) => {
        try {
            const res = await axios.post('/api/channels/dm', {
                currentUserId: user.id,
                targetUserId: targetUser.id
            });
            setCurrentChannel(res.data);
            onClose();
        } catch (err) {
            toast.error('Failed to open DM');
        }
    };

    // Handle call to user from popup (huddle)
    const handleCallUser = async (targetUser) => {
        try {
            const res = await axios.post('/api/channels/dm', {
                currentUserId: user.id,
                targetUserId: targetUser.id
            });
            setCurrentChannel(res.data);
            setMentionPopup(null);
            onClose();
            // Start call after switching to DM
            setTimeout(() => {
                joinCall(res.data.id, res.data.displayName || res.data.name);
            }, 100);
        } catch (err) {
            toast.error('Failed to start huddle');
        }
    };

    // Add reaction (optimistic)
    const addReaction = async (messageId, emoji) => {
        const prevReactions = reactions[messageId] || [];
        const existingReaction = prevReactions.find(r => r.emoji === emoji);
        const hasUserReacted = existingReaction?.users.some(u => u.id === user.id);

        let optimisticReactions;
        if (hasUserReacted) {
            optimisticReactions = prevReactions.map(r => {
                if (r.emoji === emoji) {
                    const newUsers = r.users.filter(u => u.id !== user.id);
                    return newUsers.length > 0 ? { ...r, users: newUsers, count: newUsers.length } : null;
                }
                return r;
            }).filter(Boolean);
        } else if (existingReaction) {
            optimisticReactions = prevReactions.map(r => {
                if (r.emoji === emoji) {
                    return {
                        ...r,
                        users: [...r.users, { id: user.id, username: user.username }],
                        count: r.count + 1
                    };
                }
                return r;
            });
        } else {
            optimisticReactions = [...prevReactions, {
                emoji,
                count: 1,
                users: [{ id: user.id, username: user.username }]
            }];
        }

        setReactions(prev => ({ ...prev, [messageId]: optimisticReactions }));
        setShowEmojiPicker(null);

        try {
            await axios.post(`/api/reactions/${messageId}/reactions`, { emoji });
        } catch (err) {
            setReactions(prev => ({ ...prev, [messageId]: prevReactions }));
            toast.error('Failed to add reaction');
        }
    };

    // Edit message
    const handleEdit = (message) => {
        setEditingMessage(message.id);
        setEditContent(message.content.replace(/<[^>]*>/g, '')); // Strip HTML
        setShowActions(null);
    };

    const saveEdit = async () => {
        if (!editContent.trim() || !editingMessage) return;

        try {
            await axios.put(`/api/messages/${editingMessage}`, { content: editContent });
            setReplies(prev => prev.map(msg =>
                msg.id === editingMessage ? { ...msg, content: editContent, edited_at: new Date().toISOString() } : msg
            ));
            setEditingMessage(null);
            setEditContent('');
            toast.success('Message updated');
        } catch (err) {
            toast.error('Failed to edit message');
        }
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setEditContent('');
    };

    // Delete message
    const handleDelete = async (messageId) => {
        if (!confirm('Delete this message?')) return;

        try {
            await axios.delete(`/api/messages/${messageId}`);
            setReplies(prev => prev.filter(msg => msg.id !== messageId));
            setShowActions(null);
            toast.success('Message deleted');
        } catch (err) {
            toast.error('Failed to delete message');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = newReply.trim();
        if (!trimmed) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected');
            return;
        }

        // Convert mentions to HTML before sending
        const processedContent = processMentionsToHtml(trimmed);

        socket.emit('send_message', {
            content: processedContent,
            channelId: parentMessage.channel_id,
            threadId: parentMessage.id
        });

        setNewReply('');
        setInsertedMentions([]); // Clear mentions after sending
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
            handleSubmit(e);
        }
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    // Search mentions
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

    // Store inserted mentions for later processing
    const [insertedMentions, setInsertedMentions] = useState([]);

    // Insert mention into input
    const insertMention = (item) => {
        const textarea = inputRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const text = newReply;

        // Find the @ or # position before cursor
        let triggerPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === mentionType) {
                triggerPos = i;
                break;
            }
        }

        if (triggerPos === -1) return;

        const mentionText = mentionType === '@' ? `@${item.username}` : `#${item.name}`;
        const before = text.substring(0, triggerPos);
        const after = text.substring(cursorPos);
        const newText = before + mentionText + ' ' + after;

        setNewReply(newText);

        // Store the mention for later HTML conversion
        setInsertedMentions(prev => [...prev, {
            type: mentionType,
            id: item.id,
            text: mentionText,
            name: mentionType === '@' ? item.username : item.name
        }]);

        setShowMentions(false);
        setMentionQuery('');
        setMentionType(null);
        setMentionResults([]);
        setSelectedMentionIndex(0);

        // Set cursor after mention
        setTimeout(() => {
            const newPos = triggerPos + mentionText.length + 1;
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    // Convert plain text mentions to HTML
    const processMentionsToHtml = (text) => {
        let processedText = text;

        // Process stored mentions (from autocomplete)
        insertedMentions.forEach(mention => {
            const mentionClass = mention.type === '@' ? 'mention-user' : 'mention-channel';
            const html = `<span class="${mentionClass}" data-id="${mention.id}" data-type="${mention.type === '@' ? 'user' : 'channel'}">${mention.text}</span>`;
            processedText = processedText.replace(mention.text, html);
        });

        return processedText;
    };

    // Handle @ mentions in input
    const handleInputChange = (e) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        setNewReply(value);

        // Check for @ or # trigger
        let foundTrigger = null;
        let triggerPos = -1;

        for (let i = cursorPos - 1; i >= 0; i--) {
            const char = value[i];
            if (char === '@' || char === '#') {
                if (i === 0 || value[i - 1] === ' ' || value[i - 1] === '\n') {
                    foundTrigger = char;
                    triggerPos = i;
                    break;
                }
            } else if (char === ' ' || char === '\n') {
                break;
            }
        }

        if (foundTrigger && triggerPos >= 0) {
            const query = value.substring(triggerPos + 1, cursorPos);
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

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Render reactions for a message
    const renderReactions = (messageId) => {
        const msgReactions = reactions[messageId] || [];
        if (msgReactions.length === 0) return null;

        return (
            <div className="flex flex-wrap items-center gap-1 mt-1">
                {msgReactions.map((reaction, idx) => {
                    const hasReacted = reaction.users.some(u => u.id === user.id);
                    const userNames = reaction.users.map(u => u.id === user.id ? 'You' : u.username);
                    let tooltip = userNames.length === 1
                        ? `${userNames[0]} reacted with ${reaction.emoji}`
                        : userNames.length === 2
                            ? `${userNames.join(' and ')} reacted with ${reaction.emoji}`
                            : `${userNames.slice(0, 2).join(', ')} and ${userNames.length - 2} others`;

                    return (
                        <button
                            key={idx}
                            onClick={() => addReaction(messageId, reaction.emoji)}
                            className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 transition-colors ${hasReacted
                                ? 'bg-[#5865f2]/20 border border-[#5865f2]/50'
                                : 'bg-[#3f4147] hover:bg-[#4f5157]'
                                }`}
                            title={tooltip}
                        >
                            <span>{reaction.emoji}</span>
                            <span className={hasReacted ? 'text-[#c9cdfb]' : 'text-gray-400'}>{reaction.count}</span>
                        </button>
                    );
                })}
                <button
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        // Position picker to the left of the button, ensuring it stays on screen
                        setShowEmojiPicker({
                            messageId,
                            position: { x: Math.max(10, rect.right - 320), y: rect.bottom + 4 }
                        });
                    }}
                    className="w-5 h-5 rounded bg-[#3f4147] hover:bg-[#4f5157] flex items-center justify-center"
                    title="Add reaction"
                >
                    <Plus size={10} className="text-gray-400" />
                </button>
            </div>
        );
    };

    // Render message with actions
    const renderMessage = (msg, isParent = false) => {
        const isOwner = msg.user_id === user.id;
        const isEditing = editingMessage === msg.id;

        return (
            <div
                key={msg.id}
                className={`flex gap-3 group relative ${isParent ? '' : 'hover:bg-[#2e3035] -mx-2 px-2 py-1 rounded'}`}
                onMouseEnter={() => !isParent && setShowActions(msg.id)}
                onMouseLeave={() => setShowActions(null)}
            >
                <UserAvatar
                    user={{ username: msg.username, avatar_url: msg.avatar_url }}
                    size="lg"
                    className="mt-1"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white hover:underline cursor-pointer message-username" data-id={msg.user_id}>{msg.username}</span>
                        <span className="text-xs text-gray-500">
                            {isParent ? `${formatDate(msg.created_at)} at ` : ''}{formatTime(msg.created_at)}
                        </span>
                        {msg.edited_at && <span className="text-xs text-gray-600">(edited)</span>}
                    </div>

                    {isEditing ? (
                        <div className="mt-1">
                            <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                className="w-full bg-[#383a40] text-white text-sm rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                                rows={2}
                            />
                            <div className="flex gap-2 mt-1">
                                <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-white">
                                    Cancel
                                </button>
                                <button onClick={saveEdit} className="text-xs text-[#5865f2] hover:text-[#7983f5]">
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="text-[15px] text-gray-300 leading-relaxed break-words"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(msg.content) }}
                        />
                    )}

                    {renderReactions(msg.id)}
                </div>

                {/* Action buttons */}
                {!isParent && showActions === msg.id && !isEditing && (
                    <div className="absolute right-0 top-0 flex items-center gap-0.5 bg-[#2b2d31] border border-[#3f4147] rounded shadow-lg">
                        <button
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                // Position picker to the left, ensuring it stays on screen
                                setShowEmojiPicker({
                                    messageId: msg.id,
                                    position: { x: Math.max(10, rect.right - 320), y: rect.bottom + 4 }
                                });
                            }}
                            className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                            title="Add reaction"
                        >
                            <Smile size={14} className="text-gray-400" />
                        </button>
                        {isOwner && (
                            <>
                                <button
                                    onClick={() => handleEdit(msg)}
                                    className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                                    title="Edit"
                                >
                                    <Pencil size={14} className="text-gray-400" />
                                </button>
                                <button
                                    onClick={() => handleDelete(msg.id)}
                                    className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={14} className="text-red-400" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!parentMessage) return null;

    return (
        <div className="thread-panel-container w-[400px] bg-[#2b2d31] border-l border-[#1e1f22] flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1f22]">
                <div className="flex items-center gap-2">
                    <MessageSquare size={20} className="text-gray-400" />
                    <div>
                        <h3 className="text-white font-semibold">Thread</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Hash size={12} />
                            <span>{channelName}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-[#3f4147] rounded transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>
            </div>

            {/* Parent Message */}
            <div className="px-4 py-3 border-b border-[#1e1f22] bg-[#232428]">
                {renderMessage(parentMessage, true)}
            </div>

            {/* Reply count */}
            <div className="px-4 py-2 border-b border-[#1e1f22]">
                <span className="text-xs text-gray-400">
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
            </div>

            {/* Replies */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-20">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : replies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        No replies yet. Start the conversation!
                    </div>
                ) : (
                    replies.map((reply) => renderMessage(reply))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-[#1e1f22]">
                <form onSubmit={handleSubmit} className="relative">
                    {/* Mention Autocomplete Dropdown */}
                    {showMentions && mentionResults.length > 0 && (
                        <div className="absolute bottom-full left-0 w-full bg-[#1f2225] border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 mb-1">
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
                                            <UserAvatar
                                                user={{ username: item.username, avatar_url: item.avatar_url }}
                                                size="xs"
                                            />
                                            <span className="text-sm font-medium">@{item.username}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Hash size={16} className="text-gray-400" />
                                            <span className="text-sm font-medium">#{item.name}</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea
                        ref={inputRef}
                        value={newReply}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply... (use @ to mention)"
                        rows={1}
                        className="w-full bg-[#383a40] text-white rounded-lg px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[#5865f2] placeholder-gray-500 text-sm"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                    <button
                        type="submit"
                        disabled={!newReply.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <div
                    className="fixed z-50"
                    style={{
                        left: Math.max(10, Math.min(showEmojiPicker.position.x, window.innerWidth - 340)),
                        top: Math.min(showEmojiPicker.position.y, window.innerHeight - 350)
                    }}
                >
                    <div className="fixed inset-0" onClick={() => setShowEmojiPicker(null)} />
                    <div className="relative">
                        <QuickEmojiPicker
                            onSelect={(emoji) => addReaction(showEmojiPicker.messageId, emoji)}
                            onClose={() => setShowEmojiPicker(null)}
                        />
                    </div>
                </div>
            )}

            {/* User Mention Popup */}
            {mentionPopup && (
                <UserMentionPopup
                    user={mentionPopup.user}
                    position={mentionPopup.position}
                    onClose={() => setMentionPopup(null)}
                    onMessage={handleMessageUser}
                    onCall={handleCallUser}
                    onMouseEnter={() => {
                        if (hoverTimeoutRef.current) {
                            clearTimeout(hoverTimeoutRef.current);
                            hoverTimeoutRef.current = null;
                        }
                    }}
                    onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => {
                            setMentionPopup(null);
                        }, 500);
                    }}
                />
            )}
        </div>
    );
}
