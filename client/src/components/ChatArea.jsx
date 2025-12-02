import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getSocket } from '../socket';
import { Hash, Send, Info, Smile, Plus, AtSign, Headphones, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import RichTextEditor from './RichTextEditor';
import UserMentionPopup from './UserMentionPopup';
import ActiveCallBar from './ActiveCallBar';
import TypingIndicator from './TypingIndicator';
import { sanitizeHTML } from '../utils/sanitize';
import { useTypingIndicator, useTypingUsers } from '../hooks/useTypingIndicator';
import { markAsRead, incrementUnread } from '../utils/unreadCounter';

export default function ChatArea({ currentChannel, setCurrentChannel }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [reactions, setReactions] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [mentionPopup, setMentionPopup] = useState(null);
    const messagesEndRef = useRef(null);
    const editorRef = useRef(null);
    const { user } = useAuth();
    const { isInCall, joinCall, incomingCall, clearIncomingCall } = useCall();
    const [loading, setLoading] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const messagesContainerRef = useRef(null);

    // Typing indicator
    const socket = getSocket();
    const { sendTyping, stopTyping } = useTypingIndicator(socket, currentChannel?.id, user?.username);
    const typingUsers = useTypingUsers(socket, currentChannel?.id);
    const hoverTimeoutRef = useRef(null);

    useEffect(() => {
        if (currentChannel) {
            const controller = new AbortController();
            const socket = getSocket();

            fetchMessages(currentChannel.id, controller.signal);

            // Mark current channel as read
            markAsRead(currentChannel.id);

            if (socket) {
                socket.emit('join_channel', currentChannel.id);
            }

            return () => {
                controller.abort();
            };
        }
    }, [currentChannel]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleNewMessage = (message) => {
            if (currentChannel && message.channel_id === currentChannel.id) {
                setMessages((prev) => [...prev, message]);
                // Message in current channel - already marked as read
            } else {
                // Message in different channel - increment unread
                incrementUnread(message.channel_id);
            }
        };

        socket.on('receive_message', handleNewMessage);
        return () => socket.off('receive_message', handleNewMessage);
    }, [currentChannel]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Scroll button visibility
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollButton(!isNearBottom);
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle mention hover
    useEffect(() => {
        const handleMouseOver = (e) => {
            const target = e.target.closest('.mention-user');
            if (target) {
                const userId = target.getAttribute('data-id');
                if (userId) {
                    // Clear any pending close timer
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }

                    // Only fetch if we don't have this user or it's a different user
                    fetchUserInfo(userId, { x: e.clientX, y: e.clientY });
                }
            }
        };

        const handleMouseOut = (e) => {
            const target = e.target.closest('.mention-user');
            if (target) {
                // Delay closing to allow moving to popup
                hoverTimeoutRef.current = setTimeout(() => {
                    setMentionPopup(null);
                }, 500);
            }
        };

        const messagesContainer = messagesContainerRef.current;
        if (messagesContainer) {
            messagesContainer.addEventListener('mouseover', handleMouseOver);
            messagesContainer.addEventListener('mouseout', handleMouseOut);

            return () => {
                messagesContainer.removeEventListener('mouseover', handleMouseOver);
                messagesContainer.removeEventListener('mouseout', handleMouseOut);
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            };
        }
    }, [user, setCurrentChannel]);


    const fetchUserInfo = async (userId, position) => {
        try {
            const res = await axios.get(`/api/users/${userId}`);
            setMentionPopup({
                user: res.data,
                position: position || { x: 0, y: 0 } // Fallback
            });
        } catch (err) {
            console.error('Failed to fetch user info', err);
            // Don't toast on hover error to avoid spam
        }
    };

    const handleMentionMessage = async (mentionedUser) => {
        try {
            // Create or find DM channel with this user
            const res = await axios.post('/api/channels/dm', {
                userId: user.id,
                otherUserId: mentionedUser.id
            });
            setCurrentChannel(res.data);
            setMentionPopup(null);
        } catch (err) {
            console.error('Failed to create DM:', err);
            toast.error('Failed to start conversation');
        }
    };

    const handleMentionCall = async (mentionedUser) => {
        try {
            // Create DM and start call
            const res = await axios.post('/api/channels/dm', {
                userId: user.id,
                otherUserId: mentionedUser.id
            });
            const dmChannel = res.data;
            setCurrentChannel(dmChannel);
            joinCall(dmChannel.id);
            toast.success(`Calling ${mentionedUser.username}...`);
        } catch (err) {
            console.error('Failed to start call:', err);
            toast.error('Failed to start call');
        }
    };

    const fetchMessages = async (channelId, signal) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/messages/${channelId}`, { signal });
            setMessages(res.data);

            // Fetch reactions for all messages
            const reactionsPromises = res.data.map(async (msg) => {
                try {
                    const reactionsRes = await axios.get(`/api/reactions/${msg.id}/reactions`);
                    return { messageId: msg.id, reactions: reactionsRes.data };
                } catch (err) {
                    console.warn(`Failed to fetch reactions for message ${msg.id}`, err);
                    return { messageId: msg.id, reactions: [] };
                }
            });

            const allReactionsResults = await Promise.allSettled(reactionsPromises);
            const reactionsMap = {};

            allReactionsResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    const { messageId, reactions } = result.value;
                    reactionsMap[messageId] = reactions;
                }
            });

            setReactions(reactionsMap);
        } catch (error) {
            if (error.name !== 'CanceledError') {
                console.error('Failed to fetch messages:', error.response?.data || error.message);
                // Only show toast for actual errors, not cancellations or 404s (empty channel)
                if (error.response?.status !== 404) {
                    toast.error('Failed to load messages');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const addReaction = async (messageId, emoji) => {
        try {
            await axios.post(`/api/reactions/${messageId}/react`, {
                userId: user.id,
                emoji
            });
            // Refresh reactions for this message
            const reactionsRes = await axios.get(`/api/reactions/${messageId}/reactions`);
            setReactions(prev => ({
                ...prev,
                [messageId]: reactionsRes.data
            }));
            setShowEmojiPicker(null);
        } catch (err) {
            console.error('Failed to add reaction', err);
            toast.error('Failed to add reaction');
        }
    };

    const handleSubmit = () => {
        const trimmed = newMessage.trim();
        if (!trimmed || trimmed.length === 0 || !currentChannel) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected. Please try logging in again.');
            return;
        }

        socket.emit('send_message', {
            content: trimmed,
            userId: user.id,
            channelId: currentChannel.id
        });

        setNewMessage('');
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleStartHuddle = () => {
        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected. Please try logging in again.');
            return;
        }

        joinCall(currentChannel.id);

        socket.emit('start_call', {
            channelId: currentChannel.id
        });

        socket.emit('send_message', {
            content: '📞 Started a huddle',
            channelId: currentChannel.id
        });

        toast.success('Huddle started!');
    };

    if (!currentChannel) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#2f3136] text-gray-400">
                <div className="text-center">
                    <Hash className="mx-auto mb-4" size={48} />
                    <p className="text-xl">Select a channel to start messaging</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-[#1a1d21] relative min-h-0">
            {/* Channel Header */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700/50 bg-[#1a1d21] shadow-sm">
                <div className="flex items-center gap-2">
                    {currentChannel.type === 'dm' ? (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                {(currentChannel.displayName || currentChannel.name)[0]?.toUpperCase()}
                            </div>
                            <span className="font-semibold text-white">
                                {currentChannel.displayName || currentChannel.name}
                            </span>
                        </div>
                    ) : (
                        <>
                            <Hash className="text-gray-400" size={20} />
                            <span className="font-semibold text-white">{currentChannel.name}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isInCall && currentChannel.type !== 'dm' && (
                        <button
                            onClick={handleStartHuddle}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm font-medium"
                        >
                            <Headphones size={16} />
                            Start Huddle
                        </button>
                    )}
                    <button className="p-2 hover:bg-gray-700 rounded transition-colors">
                        <Info className="text-gray-400" size={20} />
                    </button>
                </div>
            </div>

            {/* Incoming Call Banner */}
            {incomingCall && !isInCall && (
                <div className="bg-blue-600 text-white p-3 flex justify-between items-center px-6 shadow-md z-10">
                    <div className="flex items-center gap-2">
                        <Headphones size={20} className="animate-pulse" />
                        <span className="font-medium">Incoming Huddle Invitation</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                joinCall(incomingCall.channelId);
                                clearIncomingCall();
                                toast.success('Joined huddle!');
                            }}
                            className="bg-white text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
                        >
                            Join
                        </button>
                        <button
                            onClick={clearIncomingCall}
                            className="text-white/80 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Active Call Bar */}
            <ActiveCallBar />

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative"
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="flex gap-3 group hover:bg-[#32353b] px-3 py-1 rounded">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
                                {msg.avatar_url ? (
                                    <img src={msg.avatar_url} alt={msg.username} className="w-full h-full object-cover" />
                                ) : (
                                    msg.username[0]?.toUpperCase()
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-semibold text-white hover:underline cursor-pointer">
                                        {msg.username}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {msg.edited_at && (
                                        <span className="text-xs text-gray-500">(edited)</span>
                                    )}
                                </div>

                                {/* Message Content */}
                                <div
                                    className="text-[15px] text-gray-300 leading-relaxed break-words"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(msg.content) }}
                                />

                                {/* Reactions */}
                                {reactions[msg.id] && reactions[msg.id].length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {reactions[msg.id].map((reaction, idx) => (
                                            <div
                                                key={idx}
                                                className="px-2 py-1 bg-[#2f3136] rounded-full text-xs flex items-center gap-1 hover:bg-[#36393f] transition-colors cursor-pointer"
                                            >
                                                <span>{reaction.emoji}</span>
                                                <span className="text-gray-400">{reaction.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Message Actions */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
                                <button
                                    onClick={() => setShowEmojiPicker(msg.id)}
                                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                    title="Add Reaction"
                                >
                                    <Smile className="text-gray-400" size={16} />
                                </button>
                            </div>

                            {/* Emoji Picker Popup */}
                            {showEmojiPicker === msg.id && (
                                <div className="absolute z-50">
                                    <div className="fixed inset-0" onClick={() => setShowEmojiPicker(null)} />
                                    <div className="relative">
                                        <EmojiPicker
                                            onEmojiClick={(emojiData) => addReaction(msg.id, emojiData.emoji)}
                                            theme="dark"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all z-20"
                    title="Scroll to bottom"
                >
                    <ChevronDown size={20} />
                </button>
            )}

            {/* Typing Indicator */}
            <TypingIndicator typingUsers={typingUsers} currentUser={user?.username} />

            {/* Input Area */}
            <div className="p-5 pt-0 pb-6">
                <div className="border border-gray-600 rounded-xl bg-[#222529] focus-within:border-gray-400 transition-all relative">
                    <RichTextEditor
                        value={newMessage}
                        onChange={(value) => {
                            setNewMessage(value);
                            if (value.trim().length > 0) {
                                sendTyping();
                            } else {
                                stopTyping();
                            }
                        }}
                        placeholder={`Message ${currentChannel.type === 'dm' ? '@' + (currentChannel.displayName || currentChannel.name) : '#' + currentChannel.name}`}
                        onSubmit={handleSubmit}
                        disabled={!newMessage.trim()}
                    />
                </div>
            </div>

            {/* User Mention Popup */}
            {mentionPopup && (
                <UserMentionPopup
                    user={mentionPopup.user}
                    position={mentionPopup.position}
                    onClose={() => setMentionPopup(null)}
                    onMessage={handleMentionMessage}
                    onCall={handleMentionCall}
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


function ActionBtn({ icon }) {
    return (
        <button className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded-full transition-colors">
            {icon}
        </button>
    )
}
