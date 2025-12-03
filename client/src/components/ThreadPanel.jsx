import { useState, useEffect, useRef } from 'react';
import { X, Send, Hash, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { getSocket } from '../socket';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import { sanitizeHTML } from '../utils/sanitize';
import toast from 'react-hot-toast';

export default function ThreadPanel({ parentMessage, channelName, onClose }) {
    const { user } = useAuth();
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Fetch thread data
    useEffect(() => {
        if (!parentMessage?.id) return;

        const fetchThread = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`/api/messages/thread/${parentMessage.id}`);
                setReplies(res.data.replies || []);
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

        // Join thread room
        socket.emit('join_thread', parentMessage.id);

        // Listen for new replies
        const handleThreadReply = (message) => {
            if (message.thread_id === parentMessage.id) {
                setReplies(prev => [...prev, message]);
            }
        };

        socket.on('thread_reply', handleThreadReply);

        return () => {
            socket.emit('leave_thread', parentMessage.id);
            socket.off('thread_reply', handleThreadReply);
        };
    }, [parentMessage?.id]);

    // Scroll to bottom when new replies come in
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [replies]);

    // Focus input on open
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = newReply.trim();
        if (!trimmed) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected');
            return;
        }

        socket.emit('send_message', {
            content: trimmed,
            channelId: parentMessage.channel_id,
            threadId: parentMessage.id
        });

        setNewReply('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
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

    if (!parentMessage) return null;

    return (
        <div className="w-[400px] bg-[#2b2d31] border-l border-[#1e1f22] flex flex-col h-full">
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
                <div className="flex gap-3">
                    <UserAvatar
                        user={{
                            username: parentMessage.username,
                            avatar_url: parentMessage.avatar_url
                        }}
                        size="md"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-white">{parentMessage.username}</span>
                            <span className="text-xs text-gray-500">
                                {formatDate(parentMessage.created_at)} at {formatTime(parentMessage.created_at)}
                            </span>
                        </div>
                        <div
                            className="text-gray-300 text-sm mt-1 break-words"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(parentMessage.content) }}
                        />
                    </div>
                </div>
            </div>

            {/* Reply count */}
            <div className="px-4 py-2 border-b border-[#1e1f22]">
                <span className="text-xs text-gray-400">
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
            </div>

            {/* Replies */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-20">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : replies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        No replies yet. Start the conversation!
                    </div>
                ) : (
                    replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3 group">
                            <UserAvatar
                                user={{
                                    username: reply.username,
                                    avatar_url: reply.avatar_url
                                }}
                                size="sm"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-medium text-white text-sm">{reply.username}</span>
                                    <span className="text-xs text-gray-500">{formatTime(reply.created_at)}</span>
                                </div>
                                <div
                                    className="text-gray-300 text-sm break-words"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(reply.content) }}
                                />
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-[#1e1f22]">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={inputRef}
                        value={newReply}
                        onChange={(e) => setNewReply(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply..."
                        rows={1}
                        className="w-full bg-[#383a40] text-white rounded-lg px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[#5865f2] placeholder-gray-500"
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
        </div>
    );
}
