import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getSocket } from '../socket';
import { Hash, Send, Info, Smile, Plus, AtSign, Headphones, X, ChevronDown, ChevronLeft, PhoneOff, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import toast from 'react-hot-toast';
import QuickEmojiPicker from './QuickEmojiPicker';
import RichTextEditor from './RichTextEditor';
import UserMentionPopup from './UserMentionPopup';
import HuddlePanel from './HuddlePanel';
import ThreadPanel from './ThreadPanel';
import TypingIndicator from './TypingIndicator';
import { sanitizeHTML } from '../utils/sanitize';
import { useTypingIndicator, useTypingUsers } from '../hooks/useTypingIndicator';
import { markAsRead, incrementUnread } from '../utils/unreadCounter';
import UserAvatar from './UserAvatar';

export default function ChatArea({ currentChannel, setCurrentChannel, onBack, isMobile }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [reactions, setReactions] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [mentionPopup, setMentionPopup] = useState(null);
    const [activeThread, setActiveThread] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);
    const messagesEndRef = useRef(null);
    const editorRef = useRef(null);
    const { user } = useAuth();
    const { isInCall, joinCall, leaveCall, toggleMute, isMuted, toggleVideo, isVideoOn, localStream, remoteStreams, incomingCall, clearIncomingCall, participants, connectionStatus } = useCall();
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
                // Scroll to bottom for new messages in current channel
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            } else {
                // Message in different channel - increment unread
                incrementUnread(message.channel_id);
            }
        };

        const handleMessageUpdated = (updatedMessage) => {
            setMessages((prev) => prev.map(msg =>
                msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
            ));
        };

        // Handle thread updates (reply count changes)
        const handleThreadUpdated = ({ messageId, replyCount, lastReply }) => {
            setMessages((prev) => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, reply_count: replyCount, last_reply_at: lastReply.created_at }
                    : msg
            ));
        };

        socket.on('receive_message', handleNewMessage);
        socket.on('message_updated', handleMessageUpdated);
        socket.on('thread_updated', handleThreadUpdated);

        return () => {
            socket.off('receive_message', handleNewMessage);
            socket.off('message_updated', handleMessageUpdated);
            socket.off('thread_updated', handleThreadUpdated);
        };
    }, [currentChannel]);

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

    // Handle voice message player controls
    useEffect(() => {
        const handleVoicePlayer = (e) => {
            const playBtn = e.target.closest('.voice-play-btn');
            if (!playBtn) return;

            const player = playBtn.closest('.voice-message-player');
            if (!player) return;

            const audio = player.querySelector('audio');
            const playIcon = playBtn.querySelector('.play-icon');
            const pauseIcon = playBtn.querySelector('.pause-icon');
            const progress = player.querySelector('.voice-progress');
            const duration = player.querySelector('.voice-duration');

            if (!audio) return;

            if (audio.paused) {
                // Pause all other voice players first
                document.querySelectorAll('.voice-message-player audio').forEach(a => {
                    if (a !== audio && !a.paused) {
                        a.pause();
                        const otherPlayer = a.closest('.voice-message-player');
                        if (otherPlayer) {
                            const otherPlayIcon = otherPlayer.querySelector('.play-icon');
                            const otherPauseIcon = otherPlayer.querySelector('.pause-icon');
                            if (otherPlayIcon) otherPlayIcon.style.display = 'block';
                            if (otherPauseIcon) otherPauseIcon.style.display = 'none';
                        }
                    }
                });

                audio.play();
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
            } else {
                audio.pause();
                if (playIcon) playIcon.style.display = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
            }

            // Update progress and duration
            const updateProgress = () => {
                if (progress && audio.duration) {
                    const percent = (audio.currentTime / audio.duration) * 100;
                    progress.style.width = `${percent}%`;
                }
                if (duration) {
                    const mins = Math.floor(audio.currentTime / 60);
                    const secs = Math.floor(audio.currentTime % 60);
                    duration.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                }
            };

            audio.ontimeupdate = updateProgress;
            audio.onended = () => {
                if (playIcon) playIcon.style.display = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
                if (progress) progress.style.width = '0%';
                if (duration) duration.textContent = '0:00';
            };

            // Set duration when metadata is loaded
            audio.onloadedmetadata = () => {
                if (duration && audio.duration) {
                    const mins = Math.floor(audio.duration / 60);
                    const secs = Math.floor(audio.duration % 60);
                    duration.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                }
            };
        };

        document.addEventListener('click', handleVoicePlayer);
        return () => document.removeEventListener('click', handleVoicePlayer);
    }, []);

    // Handle mention hover
    useEffect(() => {
        const handleGlobalMouseOver = (e) => {
            const target = e.target.closest('.mention-user, .message-username');
            if (target) {
                const userId = target.getAttribute('data-id');
                if (userId) {
                    // Clear any pending close timer
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }

                    // Only fetch if we don't have this user or it's a different user
                    // Check if we are already showing this user to avoid re-fetching
                    if (!mentionPopup || mentionPopup.user.id !== parseInt(userId)) {
                        const rect = target.getBoundingClientRect();
                        // Position below the mention, centered horizontally
                        const position = {
                            x: rect.left + (rect.width / 2) - 160, // Center 320px popup (approx)
                            y: rect.bottom + 5
                        };
                        fetchUserInfo(userId, position);
                    }
                }
            }
        };

        const handleGlobalMouseOut = (e) => {
            const target = e.target.closest('.mention-user, .message-username');
            if (target) {
                // Delay closing to allow moving to popup
                hoverTimeoutRef.current = setTimeout(() => {
                    setMentionPopup(null);
                }, 500);
            }
        };

        document.addEventListener('mouseover', handleGlobalMouseOver);
        document.addEventListener('mouseout', handleGlobalMouseOut);

        return () => {
            document.removeEventListener('mouseover', handleGlobalMouseOver);
            document.removeEventListener('mouseout', handleGlobalMouseOut);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, [user, setCurrentChannel, mentionPopup]);

    // Handle mobile keyboard
    useEffect(() => {
        const handleResize = () => {
            // Check if input is focused
            if (document.activeElement?.getAttribute('contenteditable') === 'true') {
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


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
                currentUserId: user.id,
                targetUserId: mentionedUser.id
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
                currentUserId: user.id,
                targetUserId: mentionedUser.id
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
        // Optimistic update
        const prevReactions = reactions[messageId] || [];
        const existingReaction = prevReactions.find(r => r.emoji === emoji);
        const hasUserReacted = existingReaction?.users.some(u => u.id === user.id);

        let optimisticReactions;
        if (hasUserReacted) {
            // Remove user's reaction
            optimisticReactions = prevReactions.map(r => {
                if (r.emoji === emoji) {
                    const newUsers = r.users.filter(u => u.id !== user.id);
                    return newUsers.length > 0 ? { ...r, users: newUsers, count: newUsers.length } : null;
                }
                return r;
            }).filter(Boolean);
        } else if (existingReaction) {
            // Add user to existing reaction
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
            // New reaction
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
            // Revert on error
            setReactions(prev => ({ ...prev, [messageId]: prevReactions }));
            console.error('Failed to add reaction', err);
            toast.error('Failed to add reaction');
        }
    };

    const handleSubmit = async () => {
        const trimmed = newMessage.trim();
        const hasContent = trimmed && trimmed.length > 0;
        const hasAttachments = attachments.length > 0;

        if (!hasContent && !hasAttachments) return;
        if (!currentChannel) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected. Please try logging in again.');
            return;
        }

        let messageContent = trimmed;

        // Upload attachments first if any
        if (hasAttachments) {
            setUploadingFiles(true);
            try {
                const uploadedFiles = [];
                for (const file of attachments) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await axios.post('/api/messages/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    uploadedFiles.push(res.data);
                }

                // Add file links to message content
                const fileHtml = uploadedFiles.map(file => {
                    if (file.type?.startsWith('image/')) {
                        return `<div class="attachment-image"><img src="${file.url}" alt="${file.name}" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin: 4px 0;" /><div class="text-xs text-gray-400">${file.name}</div></div>`;
                    } else if (file.type?.startsWith('audio/')) {
                        return `<div class="attachment-audio"><audio controls src="${file.url}" style="max-width: 300px;"></audio><div class="text-xs text-gray-400">${file.name}</div></div>`;
                    } else {
                        return `<div class="attachment-file"><a href="${file.url}" target="_blank" class="flex items-center gap-2 bg-[#2b2d31] rounded-lg px-3 py-2 inline-flex text-blue-400 hover:text-blue-300"><span>📎</span><span>${file.name}</span><span class="text-xs text-gray-500">(${(file.size / 1024).toFixed(1)} KB)</span></a></div>`;
                    }
                }).join('');

                messageContent = messageContent ? `${messageContent}<br/>${fileHtml}` : fileHtml;
            } catch (err) {
                console.error('Failed to upload files:', err);
                toast.error('Failed to upload files');
                setUploadingFiles(false);
                return;
            }
            setUploadingFiles(false);
        }

        socket.emit('send_message', {
            content: messageContent,
            userId: user.id,
            channelId: currentChannel.id
        });

        setNewMessage('');
        setAttachments([]);
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
    };

    // Handle file attachment
    const handleFileAttach = (files) => {
        setAttachments(prev => [...prev, ...files]);
    };

    // Remove attachment
    const handleRemoveAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Handle voice message
    const handleVoiceMessage = async (audioBlob) => {
        if (!currentChannel) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected. Please try logging in again.');
            return;
        }

        try {
            console.log('Uploading voice message, blob size:', audioBlob.size, 'type:', audioBlob.type);
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-message.webm');
            const res = await axios.post('/api/messages/voice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            console.log('Voice upload response:', res.data);

            // Beautiful voice message HTML with custom player
            const voiceHtml = `
                <div class="voice-message-player" data-src="${res.data.url}">
                    <button class="voice-play-btn">
                        <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <svg class="pause-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    </button>
                    <div class="voice-waveform">
                        <div class="voice-progress"></div>
                    </div>
                    <span class="voice-duration">0:00</span>
                    <audio src="${res.data.url}" preload="metadata"></audio>
                </div>
            `;

            socket.emit('send_message', {
                content: voiceHtml,
                userId: user.id,
                channelId: currentChannel.id
            });
        } catch (err) {
            console.error('Failed to upload voice message:', err);
            toast.error('Failed to send voice message');
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

        socket.emit('send_message', {
            content: '📞 Started a huddle',
            channelId: currentChannel.id
        }, (response) => {
            if (response && response.id) {
                socket.emit('start_call', {
                    channelId: currentChannel.id,
                    targetUserId: currentChannel.otherUserId,
                    messageId: response.id
                });
            }
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
        <div className="flex-1 h-full flex bg-[#1a1d21] relative min-h-0">
            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col min-h-0 ${activeThread ? 'hidden md:flex' : ''}`}>
            {/* Channel Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-800 bg-[#1a1d21] shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <button
                            onClick={onBack}
                            className="p-1 -ml-2 text-gray-400 hover:text-white"
                        >
                            <ChevronLeft size={28} />
                        </button>
                    )}
                    {currentChannel.type === 'dm' ? (
                        <div className="flex items-center gap-3">
                            <UserAvatar
                                user={{
                                    username: currentChannel.displayName || currentChannel.name,
                                    avatar_url: currentChannel.avatarUrl
                                }}
                                size="md"
                            />
                            <span className="font-bold text-white text-lg">
                                {currentChannel.displayName || currentChannel.name}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Hash className="text-gray-400" size={20} />
                            <span className="font-bold text-white text-lg">{currentChannel.name}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isInCall && (
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

            {/* Huddle Panel */}
            <HuddlePanel
                channelId={currentChannel?.id}
                channelName={currentChannel?.displayName || currentChannel?.name || 'Unknown'}
                channelType={currentChannel?.type || 'channel'}
                isInCall={isInCall}
                isMuted={isMuted}
                isVideoOn={isVideoOn}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onLeave={leaveCall}
                participants={participants}
                localStream={localStream}
                remoteStreams={remoteStreams}
                connectionStatus={connectionStatus}
            />

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
                        <div key={msg.id} className="flex gap-3 group hover:bg-[#32353b] px-3 py-1 rounded relative">
                            {/* Avatar */}
                            <UserAvatar
                                user={{
                                    username: msg.username,
                                    avatar_url: msg.avatar_url
                                }}
                                size="lg"
                                className="mt-1"
                            />

                            <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span
                                        className="font-semibold text-white hover:underline cursor-pointer message-username relative"
                                        data-id={msg.user_id}
                                    >
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
                                {msg.content === '📞 Started a huddle' ? (
                                    <div className="flex items-center gap-3 bg-[#2f3136] p-3 rounded-lg border border-gray-700 mt-1 max-w-md">
                                        <div className="bg-green-500/20 p-2 rounded-full">
                                            <Headphones size={24} className="text-green-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-white">Huddle started</div>
                                            <div className="text-xs text-gray-400">Click to join the conversation</div>
                                        </div>
                                        <button
                                            onClick={() => joinCall(currentChannel.id)}
                                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded transition-colors"
                                        >
                                            Join
                                        </button>
                                    </div>
                                ) : msg.content === '📞 Call ended' ? (
                                    <div className="flex items-center gap-3 bg-[#2f3136] p-3 rounded-lg border border-gray-700 mt-1 max-w-md opacity-75">
                                        <div className="bg-gray-700 p-2 rounded-full">
                                            <PhoneOff size={24} className="text-gray-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-300">Call ended</div>
                                            <div className="text-xs text-gray-500">This session has finished</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="text-[15px] text-gray-300 leading-relaxed break-words"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(msg.content) }}
                                    />
                                )}

                                {/* Reactions */}
                                {reactions[msg.id] && reactions[msg.id].length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {reactions[msg.id].map((reaction, idx) => {
                                            const hasReacted = reaction.users.some(u => u.id === user.id);
                                            const userNames = reaction.users.map(u => u.id === user.id ? 'You' : u.username);
                                            let tooltip = '';
                                            if (userNames.length === 1) {
                                                tooltip = `${userNames[0]} reacted with ${reaction.emoji}`;
                                            } else if (userNames.length === 2) {
                                                tooltip = `${userNames.join(' and ')} reacted with ${reaction.emoji}`;
                                            } else {
                                                tooltip = `${userNames.slice(0, 2).join(', ')} and ${userNames.length - 2} others reacted with ${reaction.emoji}`;
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => addReaction(msg.id, reaction.emoji)}
                                                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors cursor-pointer border ${hasReacted
                                                        ? 'bg-[#5865f2]/20 border-[#5865f2]/50 hover:bg-[#5865f2]/30'
                                                        : 'bg-[#2f3136] border-transparent hover:bg-[#36393f] hover:border-gray-600'
                                                        }`}
                                                    title={tooltip}
                                                >
                                                    <span>{reaction.emoji}</span>
                                                    <span className={hasReacted ? 'text-[#c9cdfb]' : 'text-gray-400'}>{reaction.count}</span>
                                                </button>
                                            );
                                        })}
                                        {/* Add reaction button - Slack style */}
                                        <button
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setShowEmojiPicker({
                                                    messageId: msg.id,
                                                    position: {
                                                        x: Math.min(rect.left, window.innerWidth - 340),
                                                        y: rect.bottom + 8
                                                    }
                                                });
                                            }}
                                            className="w-6 h-6 rounded-full bg-[#2f3136] border border-dashed border-gray-600 hover:border-gray-400 hover:bg-[#36393f] flex items-center justify-center transition-colors"
                                            title="Add reaction"
                                        >
                                            <Plus size={12} className="text-gray-400" />
                                        </button>
                                    </div>
                                )}

                                {/* Thread replies indicator */}
                                {msg.reply_count > 0 && (
                                    <button
                                        onClick={() => setActiveThread(msg)}
                                        className="flex items-center gap-2 mt-1 text-[#00a8fc] hover:underline text-sm"
                                    >
                                        <MessageSquare size={14} />
                                        <span>{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}</span>
                                    </button>
                                )}
                            </div>

                            {/* Message Actions */}
                            <div className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} flex items-start gap-1 transition-opacity`}>
                                <button
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setShowEmojiPicker({
                                            messageId: msg.id,
                                            position: {
                                                x: Math.min(rect.left, window.innerWidth - 340),
                                                y: rect.bottom + 8
                                            }
                                        });
                                    }}
                                    className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                                    title="Add Reaction"
                                >
                                    <Smile className="text-gray-400 hover:text-white" size={16} />
                                </button>
                                <button
                                    onClick={() => setActiveThread(msg)}
                                    className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                                    title="Reply in thread"
                                >
                                    <MessageSquare className="text-gray-400 hover:text-white" size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Emoji Picker */}
            {showEmojiPicker && (
                <div
                    className="fixed z-50"
                    style={{
                        left: isMobile ? '50%' : Math.max(10, showEmojiPicker.position.x),
                        top: isMobile ? '50%' : Math.max(10, Math.min(showEmojiPicker.position.y, window.innerHeight - 400)),
                        transform: isMobile ? 'translate(-50%, -50%)' : 'none'
                    }}
                >
                    <div className="fixed inset-0 bg-black/20" onClick={() => setShowEmojiPicker(null)} />
                    <div className="relative">
                        <QuickEmojiPicker
                            onSelect={(emoji) => addReaction(showEmojiPicker.messageId, emoji)}
                            onClose={() => setShowEmojiPicker(null)}
                        />
                    </div>
                </div>
            )}

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
                <div
                    className="border border-gray-600 rounded-xl bg-[#222529] focus-within:border-gray-400 transition-all relative"
                    onFocus={() => {
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }, 300);
                    }}
                >
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
                        disabled={!newMessage.trim() && attachments.length === 0}
                        onFileAttach={handleFileAttach}
                        onVoiceMessage={handleVoiceMessage}
                        attachments={attachments}
                        onRemoveAttachment={handleRemoveAttachment}
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

            {/* Thread Panel - Right Sidebar */}
            {activeThread && (
                <ThreadPanel
                    parentMessage={activeThread}
                    channelName={currentChannel?.name}
                    onClose={() => setActiveThread(null)}
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
