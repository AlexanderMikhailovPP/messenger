import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Hash, Send, Info, Smile, Plus, AtSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EmojiPicker from 'emoji-picker-react';
import RichTextEditor from './RichTextEditor';
import UserMentionPopup from './UserMentionPopup';

const socket = io();

export default function ChatArea({ currentChannel, setCurrentChannel }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [reactions, setReactions] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [mentionPopup, setMentionPopup] = useState(null); // { userId, position }
    const { user } = useAuth();
    const messagesEndRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

    useEffect(() => {
        if (currentChannel) {
            fetchMessages(currentChannel.id);
            socket.emit('join_channel', currentChannel.id);
        }
    }, [currentChannel]);

    useEffect(() => {
        socket.on('receive_message', (message) => {
            if (currentChannel && message.channel_id === currentChannel.id) {
                setMessages((prev) => [...prev, message]);
            }
        });

        return () => {
            socket.off('receive_message');
        };
    }, [currentChannel]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle clicks on mentions
    useEffect(() => {
        const handleMentionClick = async (e) => {
            const target = e.target;
            console.log('Click detected on:', target);
            console.log('Classes:', target.classList);
            console.log('data-id:', target.getAttribute('data-id'));
            console.log('data-type:', target.getAttribute('data-type'));

            if (target.classList.contains('mention-user')) {
                e.preventDefault();
                console.log('User mention clicked');
                const userId = target.getAttribute('data-id');
                if (userId && setCurrentChannel) {
                    try {
                        console.log('Opening DM with user:', userId);
                        const res = await axios.post('/api/channels/dm', {
                            currentUserId: user.id,
                            targetUserId: parseInt(userId)
                        });
                        const dmChannel = res.data;
                        // Get username from mention text
                        const username = target.textContent.substring(1); // Remove @
                        dmChannel.displayName = username;
                        dmChannel.avatarUrl = null; // Will be fetched
                        console.log('Setting current channel to DM:', dmChannel);
                        setCurrentChannel(dmChannel);
                    } catch (error) {
                        console.error('Failed to open DM', error);
                    }
                }
            } else if (target.classList.contains('mention-channel')) {
                e.preventDefault();
                console.log('Channel mention clicked');
                const channelId = target.getAttribute('data-id');
                if (channelId && setCurrentChannel) {
                    try {
                        console.log('Opening channel:', channelId);
                        const res = await axios.get('/api/channels');
                        const channel = res.data.find(c => c.id === parseInt(channelId));
                        if (channel) {
                            console.log('Setting current channel to:', channel);
                            setCurrentChannel(channel);
                        }
                    } catch (error) {
                        console.error('Failed to open channel', error);
                    }
                }
            }
        };

        const messagesContainer = document.querySelector('.custom-scrollbar');
        if (messagesContainer) {
            console.log('Adding click listener to messages container');
            messagesContainer.addEventListener('click', handleMentionClick);
            return () => messagesContainer.removeEventListener('click', handleMentionClick);
        }
    }, [user, setCurrentChannel]);

    // Handle hover on user mentions for popup
    useEffect(() => {
        const handleMouseOver = (e) => {
            const target = e.target.closest('.mention-user');
            if (!target) return;

            const userId = target.getAttribute('data-id');
            if (userId) {
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }

                hoverTimeoutRef.current = setTimeout(() => {
                    const rect = target.getBoundingClientRect();
                    setMentionPopup({
                        userId: parseInt(userId),
                        position: {
                            top: rect.bottom + 8,
                            left: rect.left
                        }
                    });
                }, 500);
            }
        };

        const handleMouseOut = (e) => {
            const target = e.target.closest('.mention-user');
            if (!target) return;

            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            hoverTimeoutRef.current = setTimeout(() => setMentionPopup(null), 200);
        };

        const messagesContainer = document.querySelector('.custom-scrollbar');
        if (messagesContainer) {
            messagesContainer.addEventListener('mouseover', handleMouseOver);
            messagesContainer.addEventListener('mouseout', handleMouseOut);
        }

        return () => {
            if (messagesContainer) {
                messagesContainer.removeEventListener('mouseover', handleMouseOver);
                messagesContainer.removeEventListener('mouseout', handleMouseOut);
            }
        };
    }, []); // Run once on mount (event delegation handles dynamic content)


    const fetchMessages = async (channelId) => {
        try {
            const res = await axios.get(`/api/messages/${channelId}`);
            setMessages(res.data);

            // Fetch reactions for all messages
            const reactionsData = {};
            await Promise.all(res.data.map(async (msg) => {
                try {
                    const reactionsRes = await axios.get(`/api/reactions/${msg.id}/reactions`);
                    reactionsData[msg.id] = reactionsRes.data;
                } catch (err) {
                    console.error(`Failed to fetch reactions for message ${msg.id}`, err);
                }
            }));
            setReactions(reactionsData);
        } catch (error) {
            console.error('Failed to fetch messages', error);
        }
    };

    const addReaction = async (messageId, emoji) => {
        try {
            await axios.post(`/api/reactions/${messageId}/reactions`, {
                userId: user.id,
                emoji: emoji
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
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentChannel) return;

        const messageData = {
            content: newMessage,
            userId: user.id,
            channelId: currentChannel.id,
        };

        socket.emit('send_message', messageData);
        setNewMessage('');
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (!currentChannel) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-[#222529]">
                Select a channel to start messaging
            </div>
        );
    }

    const handleMentionMessage = async (targetUser) => {
        try {
            const res = await axios.post('/api/channels/dm', {
                currentUserId: user.id,
                targetUserId: targetUser.id
            });
            const dmChannel = res.data;
            dmChannel.displayName = targetUser.username;
            dmChannel.avatarUrl = targetUser.avatar_url;
            setCurrentChannel(dmChannel);
        } catch (error) {
            console.error('Failed to open DM', error);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#222529] text-gray-200">
            {/* Header */}
            <header className="h-16 border-b border-gray-700/50 flex items-center justify-between px-5 bg-[#222529]">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 font-bold text-white text-lg">
                        {currentChannel.type === 'dm' ? <AtSign size={20} className="text-gray-400" /> : <Hash size={20} className="text-gray-400" />}
                        {currentChannel.displayName || currentChannel.name}
                    </div>
                    {currentChannel.description && (
                        <span className="text-gray-500 text-sm ml-2 hidden md:block">{currentChannel.description}</span>
                    )}
                </div>

                <div className="flex items-center gap-4 text-gray-400">
                    <Info size={18} className="hover:text-white cursor-pointer" />
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                <div className="space-y-1">
                    {messages.map((msg, index) => {
                        const isSameUser = index > 0 && messages[index - 1].user_id === msg.user_id;
                        const showDateSeparator = index === 0 ||
                            new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();

                        const formatDate = (dateString) => {
                            const date = new Date(dateString);
                            const today = new Date();
                            const yesterday = new Date(today);
                            yesterday.setDate(yesterday.getDate() - 1);

                            if (date.toDateString() === today.toDateString()) return 'Today';
                            if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        };

                        return (
                            <div key={msg.id}>
                                {showDateSeparator && (
                                    <div className="relative flex items-center justify-center my-6">
                                        <div className="bg-[#222529] border border-gray-700 rounded-full px-4 py-1 text-xs font-bold text-gray-400 z-10">
                                            {formatDate(msg.created_at)}
                                        </div>
                                        <div className="absolute w-full border-t border-gray-700/50 left-0 top-1/2 -translate-y-1/2 z-0"></div>
                                    </div>
                                )}

                                <div className={`group flex gap-3 hover:bg-gray-800/30 px-4 py-1 -mx-4 rounded relative ${isSameUser ? 'mt-0.5' : 'mt-2'}`}>
                                    {!isSameUser ? (
                                        <img
                                            src={msg.avatar_url || `https://ui-avatars.com/api/?name=${msg.username}&background=random&size=36`}
                                            alt={msg.username}
                                            className="w-9 h-9 rounded flex-shrink-0 cursor-pointer hover:opacity-90"
                                        />
                                    ) : (
                                        <div className="w-9 flex-shrink-0 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 text-right pt-1">
                                            {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {!isSameUser && (
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-bold text-[15px] text-white hover:underline cursor-pointer">{msg.username}</span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}
                                                </span>
                                                {msg.edited_at && (
                                                    <span className="text-xs text-gray-500">(edited)</span>
                                                )}
                                            </div>
                                        )}
                                        <div
                                            className="text-[15px] text-gray-300 leading-relaxed break-words"
                                            dangerouslySetInnerHTML={{ __html: msg.content }}
                                        />
                                    </div>

                                    {/* Message Actions (visible on hover) - Edit/Delete only for own messages */}
                                    <div className="absolute -top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1d21] border border-gray-700 rounded-lg shadow-xl flex items-center gap-1 p-1 z-20">
                                        {msg.user_id === user.id && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const newContent = prompt('Edit message:', msg.content);
                                                        if (newContent && newContent !== msg.content) {
                                                            axios.put(`/api/reactions/${msg.id}`, {
                                                                content: newContent,
                                                                userId: user.id
                                                            }).then(() => {
                                                                fetchMessages(currentChannel.id);
                                                            });
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete this message?')) {
                                                            axios.delete(`/api/reactions/${msg.id}`, {
                                                                data: { userId: user.id }
                                                            }).then(() => {
                                                                fetchMessages(currentChannel.id);
                                                            });
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:bg-red-600 hover:text-white rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                                <div className="w-px h-4 bg-gray-700"></div>
                                            </>
                                        )}
                                        {/* Reaction button for ALL messages */}
                                        <button
                                            onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                                            className="p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white rounded transition-colors"
                                            title="Add reaction"
                                        >
                                            <Smile size={16} />
                                        </button>
                                    </div>

                                    {/* Emoji Picker */}
                                    {showEmojiPicker === msg.id && (
                                        <div className="absolute top-8 right-4 z-30">
                                            <EmojiPicker
                                                onEmojiClick={(emojiData) => addReaction(msg.id, emojiData.emoji)}
                                                theme="dark"
                                                searchPlaceholder="Search emoji..."
                                                width={350}
                                                height={400}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Reactions Display */}
                                {reactions[msg.id] && reactions[msg.id].length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 ml-12">
                                        {reactions[msg.id].map((reaction, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => addReaction(msg.id, reaction.emoji)}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-full text-sm transition-colors group relative"
                                                title={reaction.users.map(u => u.username).join(', ')}
                                            >
                                                <span>{reaction.emoji}</span>
                                                <span className="text-xs text-gray-300">{reaction.count}</span>

                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black border border-gray-700 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                    {reaction.users.map(u => u.username).join(', ')}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black"></div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-5 pt-0">
                <RichTextEditor
                    value={newMessage}
                    onChange={setNewMessage}
                    placeholder={`Message ${currentChannel.type === 'dm' ? '@' + (currentChannel.displayName || currentChannel.name) : '#' + currentChannel.name}`}
                    onSubmit={sendMessage}
                    disabled={!newMessage.trim()}
                />
            </div>

            {/* User Mention Popup */}
            {mentionPopup && (
                <UserMentionPopup
                    userId={mentionPopup.userId}
                    position={mentionPopup.position}
                    onMessage={handleMentionMessage}
                    onMouseEnter={() => {
                        if (hoverTimeoutRef.current) {
                            clearTimeout(hoverTimeoutRef.current);
                        }
                    }}
                    onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => setMentionPopup(null), 200);
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
