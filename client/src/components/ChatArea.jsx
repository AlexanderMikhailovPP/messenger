import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getSocket } from '../socket';
import { Hash, Send, Info, Smile, Plus, AtSign, Headphones, X, ChevronDown, ChevronLeft, PhoneOff, MessageSquare, Clock, Trash2, Play, Edit3, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import toast from 'react-hot-toast';
import QuickEmojiPicker from './QuickEmojiPicker';
import RichTextEditor from './RichTextEditor';
import UserMentionPopup from './UserMentionPopup';
import ThreadPanel from './ThreadPanel';
import TypingIndicator from './TypingIndicator';
import { sanitizeHTML } from '../utils/sanitize';
import { useTypingIndicator, useTypingUsers } from '../hooks/useTypingIndicator';
import { markAsRead, incrementUnread, notifyNewDM } from '../utils/unreadCounter';
import { getDraft, saveDraft, deleteDraft } from '../utils/drafts';
import UserAvatar from './UserAvatar';

// Helper function for relative time (e.g., "7 days ago")
const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
};

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
    const { isInCall, joinCall, participants, activeChannelId, activeChannelInfo, isHuddleFullscreen } = useCall();
    const [loading, setLoading] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const messagesContainerRef = useRef(null);
    const [scheduledMessages, setScheduledMessages] = useState([]);
    const [showScheduledPanel, setShowScheduledPanel] = useState(true);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');

    // Typing indicator
    const socket = getSocket();
    const { sendTyping, stopTyping } = useTypingIndicator(socket, currentChannel?.id, user?.username);
    const typingUsers = useTypingUsers(socket, currentChannel?.id);
    const hoverTimeoutRef = useRef(null);
    const showPopupTimeoutRef = useRef(null);

    // Handle channel switching - load draft for new channel
    useEffect(() => {
        if (currentChannel) {
            // Load draft for new channel (drafts are saved on every keystroke now)
            const draft = getDraft(currentChannel.id);
            setNewMessage(draft);

            // Update editor content
            if (editorRef.current) {
                editorRef.current.innerHTML = draft;
            }

            const controller = new AbortController();
            const socket = getSocket();

            fetchMessages(currentChannel.id, controller.signal);
            fetchScheduledMessages(currentChannel.id);

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

    // Scroll to bottom instantly when messages are loaded (channel change)
    useEffect(() => {
        if (!loading && messages.length > 0 && messagesEndRef.current) {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            }, 0);
        }
    }, [loading, messages.length, currentChannel?.id]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleNewMessage = (message) => {
            if (currentChannel && message.channel_id === currentChannel.id) {
                // Prevent duplicate messages (can happen when receiving via both channel and personal room)
                setMessages((prev) => {
                    if (prev.some(m => m.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
                // Scroll to bottom for new messages in current channel
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            } else {
                // Message in different channel - increment unread (pass messageId to prevent duplicates)
                incrementUnread(message.channel_id, message.id);
                // Notify about potential new DM (sidebar will refresh DM list)
                notifyNewDM(message.channel_id);
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

        // Handle reaction updates from other users
        const handleReactionUpdated = async ({ messageId }) => {
            try {
                const reactionsRes = await axios.get(`/api/reactions/${messageId}/reactions`);
                setReactions(prev => ({ ...prev, [messageId]: reactionsRes.data }));
            } catch (err) {
                console.warn(`Failed to fetch updated reactions for message ${messageId}`, err);
            }
        };

        socket.on('receive_message', handleNewMessage);
        socket.on('message_updated', handleMessageUpdated);
        socket.on('thread_updated', handleThreadUpdated);
        socket.on('reaction_updated', handleReactionUpdated);

        return () => {
            socket.off('receive_message', handleNewMessage);
            socket.off('message_updated', handleMessageUpdated);
            socket.off('thread_updated', handleThreadUpdated);
            socket.off('reaction_updated', handleReactionUpdated);
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
                        // Clear any pending show timer
                        if (showPopupTimeoutRef.current) {
                            clearTimeout(showPopupTimeoutRef.current);
                        }

                        const rect = target.getBoundingClientRect();
                        // Position 10px above the mention/username, aligned left
                        const position = {
                            x: rect.left,
                            y: rect.top - 10
                        };

                        // Add delay before showing new popup to avoid switching while moving to current popup
                        showPopupTimeoutRef.current = setTimeout(() => {
                            fetchUserInfo(userId, position);
                        }, mentionPopup ? 200 : 0); // 200ms delay if popup already shown, instant otherwise
                    }
                }
            }
        };

        const handleGlobalMouseOut = (e) => {
            const target = e.target.closest('.mention-user, .message-username');
            if (target) {
                // Check if mouse is moving to the popup - if so, don't close
                const relatedTarget = e.relatedTarget;
                if (relatedTarget) {
                    // Check if moving to popup or its children
                    const popup = document.querySelector('.user-mention-popup');
                    if (popup && (popup.contains(relatedTarget) || popup === relatedTarget)) {
                        return; // Don't close, mouse is moving to popup
                    }
                }

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
        const handleChannelMentionClick = async (e) => {
            const target = e.target.closest('.mention-channel');
            if (target) {
                const channelId = target.getAttribute('data-id');
                if (channelId) {
                    try {
                        const res = await axios.get(`/api/channels/${channelId}`);
                        if (res.data) {
                            setCurrentChannel(res.data);
                        }
                    } catch (err) {
                        console.error('Failed to navigate to channel:', err);
                        toast.error('Failed to navigate to channel');
                    }
                }
            }
        };

        document.addEventListener('mouseover', handleGlobalMouseOver);
        document.addEventListener('mouseout', handleGlobalMouseOut);
        document.addEventListener('click', handleChannelMentionClick);

        return () => {
            document.removeEventListener('mouseover', handleGlobalMouseOver);
            document.removeEventListener('mouseout', handleGlobalMouseOut);
            document.removeEventListener('click', handleChannelMentionClick);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            if (showPopupTimeoutRef.current) clearTimeout(showPopupTimeoutRef.current);
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
            // Notify sidebar to refresh DM list
            notifyNewDM(res.data.id);
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
            joinCall(dmChannel.id, {
                name: dmChannel.name,
                displayName: dmChannel.displayName,
                type: dmChannel.type
            });
            // Notify sidebar to refresh DM list
            notifyNewDM(dmChannel.id);
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
        deleteDraft(currentChannel.id);
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

            // Simple voice message with standard audio player
            const voiceHtml = `
                <div class="voice-message">
                    <audio controls src="${res.data.url}" preload="metadata"></audio>
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

    // Handle scheduled message
    const handleScheduledSubmit = async (scheduledDate) => {
        // newMessage contains HTML from RichTextEditor
        const content = newMessage.trim();
        console.log('Scheduling message:', { content, channelId: currentChannel?.id, scheduledDate });

        if (!content || !currentChannel) {
            console.log('Missing content or channel');
            return;
        }

        try {
            const res = await axios.post('/api/scheduled', {
                content: content,
                channelId: currentChannel.id,
                scheduledAt: scheduledDate.toISOString()
            });

            console.log('Schedule response:', res.data);
            toast.success(`Сообщение запланировано на ${scheduledDate.toLocaleString('ru-RU')}`);
            setNewMessage('');
            // Refresh scheduled messages list
            fetchScheduledMessages(currentChannel.id);
        } catch (err) {
            console.error('Failed to schedule message:', err);
            toast.error('Не удалось запланировать сообщение');
        }
    };

    // Fetch scheduled messages for channel
    const fetchScheduledMessages = async (channelId) => {
        try {
            const res = await axios.get(`/api/scheduled/channel/${channelId}`);
            setScheduledMessages(res.data);
        } catch (err) {
            console.error('Failed to fetch scheduled messages:', err);
            setScheduledMessages([]);
        }
    };

    // Delete scheduled message
    const handleDeleteScheduled = async (id) => {
        try {
            await axios.delete(`/api/scheduled/${id}`);
            setScheduledMessages(prev => prev.filter(m => m.id !== id));
            toast.success('Запланированное сообщение удалено');
        } catch (err) {
            console.error('Failed to delete scheduled message:', err);
            toast.error('Не удалось удалить сообщение');
        }
    };

    // Send scheduled message now
    const handleSendNow = async (id) => {
        try {
            const res = await axios.post(`/api/scheduled/${id}/send-now`);
            const socket = getSocket();
            if (socket && res.data.message) {
                socket.emit('send_message', {
                    content: res.data.message.content,
                    userId: user.id,
                    channelId: res.data.message.channelId
                });
            }
            setScheduledMessages(prev => prev.filter(m => m.id !== id));
            toast.success('Сообщение отправлено');
        } catch (err) {
            console.error('Failed to send scheduled message:', err);
            toast.error('Не удалось отправить сообщение');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Check if message should be grouped with previous (same user, within 1 minute)
    const shouldGroupWithPrevious = (currentMsg, prevMsg) => {
        if (!prevMsg) return false;
        if (currentMsg.user_id !== prevMsg.user_id) return false;
        const currentTime = new Date(currentMsg.created_at).getTime();
        const prevTime = new Date(prevMsg.created_at).getTime();
        return (currentTime - prevTime) < 60000; // 1 minute
    };

    // Format date for day divider
    const formatDateDivider = (date) => {
        const today = new Date();
        const msgDate = new Date(date);

        // Reset time to compare dates only
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const messageDate = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

        const diffDays = Math.floor((todayDate - messageDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';

        return msgDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    };

    // Check if we should show a date divider between messages
    const shouldShowDateDivider = (currentMsg, prevMsg) => {
        if (!prevMsg) return true; // Always show divider for first message

        const currentDate = new Date(currentMsg.created_at);
        const prevDate = new Date(prevMsg.created_at);

        return currentDate.toDateString() !== prevDate.toDateString();
    };

    // Edit message handlers
    const handleStartEdit = (msg) => {
        setEditingMessageId(msg.id);
        // Strip HTML tags to get plain text for editing
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = msg.content;
        setEditContent(tempDiv.textContent || tempDiv.innerText || '');
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const handleSaveEdit = async (messageId) => {
        if (!editContent.trim()) return;
        try {
            await axios.put(`/api/messages/${messageId}`, { content: editContent });
            setMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, content: editContent, edited_at: new Date().toISOString() }
                    : msg
            ));
            setEditingMessageId(null);
            setEditContent('');
            toast.success('Сообщение отредактировано');
        } catch (err) {
            console.error('Failed to edit message:', err);
            toast.error('Не удалось отредактировать сообщение');
        }
    };

    // Delete message handler
    const handleDeleteMessage = async (messageId) => {
        if (!confirm('Удалить сообщение?')) return;
        try {
            await axios.delete(`/api/messages/${messageId}`);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            toast.success('Сообщение удалено');
        } catch (err) {
            console.error('Failed to delete message:', err);
            toast.error('Не удалось удалить сообщение');
        }
    };

    const handleStartHuddle = () => {
        const socket = getSocket();
        if (!socket) {
            toast.error('Not connected. Please try logging in again.');
            return;
        }

        joinCall(currentChannel.id, {
            name: currentChannel.name,
            displayName: currentChannel.displayName,
            type: currentChannel.type
        });

        socket.emit('send_message', {
            content: '📞 Started a huddle',
            channelId: currentChannel.id
        }, (response) => {
            if (response && response.id) {
                console.log('[ChatArea] Starting call:', {
                    channelId: currentChannel.id,
                    targetUserId: currentChannel.otherUserId,
                    currentChannel
                });
                socket.emit('start_call', {
                    channelId: currentChannel.id,
                    targetUserId: currentChannel.otherUserId,
                    messageId: response.id,
                    callerName: user.username,
                    callerAvatar: user.avatar_url
                });
            }
        });

        toast.success('Huddle started!');
    };

    if (!currentChannel) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#1a1d21]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
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

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar relative"
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const showDateDivider = shouldShowDateDivider(msg, prevMsg);
                        const isGrouped = !showDateDivider && shouldGroupWithPrevious(msg, prevMsg);
                        const isOwnMessage = msg.user_id === user?.id;

                        return (
                            <div key={msg.id}>
                                {/* Date Divider */}
                                {showDateDivider && (
                                    <div className="flex items-center justify-center my-4">
                                        <div className="flex-1 border-t border-gray-700"></div>
                                        <div className="px-4 py-1 bg-[#2f3136] rounded-full border border-gray-600 mx-4">
                                            <span className="text-sm text-gray-300 font-medium">
                                                {formatDateDivider(msg.created_at)}
                                            </span>
                                        </div>
                                        <div className="flex-1 border-t border-gray-700"></div>
                                    </div>
                                )}
                                <div
                                    className={`flex gap-3 group hover:bg-[#32353b] px-3 py-0.5 rounded relative ${isGrouped ? 'mt-0.5' : 'mt-2'}`}
                                >
                                {/* Avatar or spacer with time for grouped messages */}
                                {isGrouped ? (
                                    <div
                                        className="w-10 flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={new Date(msg.created_at).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: true
                                        }).replace(',', ' at')}
                                    >
                                        <span className="text-[10px] text-gray-500">
                                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
                                        </span>
                                    </div>
                                ) : (
                                    <UserAvatar
                                        user={{
                                            username: msg.username,
                                            avatar_url: msg.avatar_url
                                        }}
                                        size="lg"
                                        className="mt-1"
                                    />
                                )}

                                <div className="flex-1 min-w-0">
                                    {/* Header - only show if not grouped */}
                                    {!isGrouped && (
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
                                    )}

                                    {/* Message Content */}
                                    {editingMessageId === msg.id ? (
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit(msg.id);
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                className="w-full bg-[#383a40] text-white px-3 py-2 rounded border border-blue-500 focus:outline-none"
                                                autoFocus
                                            />
                                            <div className="flex gap-2 text-xs">
                                                <button
                                                    onClick={() => handleSaveEdit(msg.id)}
                                                    className="text-blue-400 hover:text-blue-300"
                                                >
                                                    Сохранить
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="text-gray-400 hover:text-gray-300"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        </div>
                                    ) : msg.content === '📞 Started a huddle' ? (
                                        <div className="inline-flex items-center gap-2 bg-[#2f3136] px-2.5 py-1.5 rounded-lg border border-gray-700 mt-1">
                                            <div className="bg-green-500/20 p-1 rounded-full">
                                                <Headphones size={14} className="text-green-500" />
                                            </div>
                                            <span className="text-sm text-gray-300">Huddle</span>
                                            {/* Show participant avatars if call is active in this channel */}
                                            {activeChannelId === currentChannel.id && participants.length > 0 && (
                                                <div className="flex items-center ml-1">
                                                    {participants.slice(0, 4).map((p, idx) => (
                                                        <div
                                                            key={p.userId}
                                                            className="rounded-full ring-2 ring-[#2f3136]"
                                                            style={{ zIndex: 10 - idx, marginLeft: idx > 0 ? '-6px' : '0' }}
                                                        >
                                                            <UserAvatar
                                                                user={{ username: p.username, avatar_url: p.avatarUrl }}
                                                                size="xs"
                                                                rounded="rounded-full"
                                                            />
                                                        </div>
                                                    ))}
                                                    {participants.length > 4 && (
                                                        <div
                                                            className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-white ring-2 ring-[#2f3136]"
                                                            style={{ marginLeft: '-6px', zIndex: 6 }}
                                                        >
                                                            +{participants.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!isInCall || activeChannelId !== currentChannel.id ? (
                                                <button
                                                    onClick={() => joinCall(currentChannel.id, {
                                                        name: currentChannel.name,
                                                        displayName: currentChannel.displayName,
                                                        type: currentChannel.type
                                                    })}
                                                    className="px-2.5 py-0.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors ml-1"
                                                >
                                                    Join
                                                </button>
                                            ) : (
                                                <span className="text-xs text-green-500 ml-1">In call</span>
                                            )}
                                        </div>
                                    ) : msg.content === '📞 Call ended' ? (
                                        <div className="inline-flex items-center gap-2 bg-[#2f3136] px-2.5 py-1.5 rounded-lg border border-gray-700 mt-1 opacity-60">
                                            <div className="bg-gray-700 p-1 rounded-full">
                                                <PhoneOff size={14} className="text-gray-400" />
                                            </div>
                                            <span className="text-sm text-gray-400">Huddle ended</span>
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

                                    {/* Thread replies indicator - Slack style */}
                                    {msg.reply_count > 0 && (
                                        <button
                                            onClick={() => setActiveThread(msg)}
                                            className="thread-preview flex items-center gap-2 mt-2 py-1 px-1 -ml-1 rounded hover:bg-gray-800/30 transition-colors group/thread"
                                        >
                                            {/* Participant avatars */}
                                            {msg.thread_participants && msg.thread_participants.length > 0 && (
                                                <div className="thread-avatars flex items-center">
                                                    {msg.thread_participants.slice(0, 5).map((participant, idx) => (
                                                        <div
                                                            key={participant.id}
                                                            className="border-2 border-[#1a1d21] rounded-md"
                                                            style={{ marginLeft: idx > 0 ? '-8px' : '0', zIndex: 5 - idx }}
                                                        >
                                                            <UserAvatar user={participant} size="sm" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Reply count */}
                                            <span className="text-[#1d9bd1] text-sm font-medium group-hover/thread:underline">
                                                {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                                            </span>
                                            {/* Last reply time */}
                                            {msg.last_reply_at && (
                                                <span className="text-gray-500 text-xs">
                                                    Last reply {formatRelativeTime(msg.last_reply_at)}
                                                </span>
                                            )}
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
                                    {isOwnMessage && (
                                        <>
                                            <button
                                                onClick={() => handleStartEdit(msg)}
                                                className="p-1.5 hover:bg-[#3f4147] rounded transition-colors"
                                                title="Edit message"
                                            >
                                                <Edit3 className="text-gray-400 hover:text-white" size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                                                title="Delete message"
                                            >
                                                <Trash2 className="text-gray-400 hover:text-red-400" size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            </div>
                        );
                    })
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

            {/* Scheduled Messages Panel */}
            {scheduledMessages.length > 0 && (
                <div className="mx-5 mb-2">
                    <button
                        onClick={() => setShowScheduledPanel(!showScheduledPanel)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-t-lg text-purple-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={16} />
                            <span className="text-sm font-medium">
                                Запланированные сообщения ({scheduledMessages.length})
                            </span>
                        </div>
                        {showScheduledPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>

                    {showScheduledPanel && (
                        <div className="bg-[#2a2d32] border border-t-0 border-purple-500/30 rounded-b-lg max-h-48 overflow-y-auto">
                            {scheduledMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className="flex items-center justify-between px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-800/50 group"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-purple-400 mb-1">
                                            <Clock size={12} />
                                            <span>
                                                {new Date(msg.scheduled_at).toLocaleString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <div
                                            className="text-sm text-gray-300 truncate"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(msg.content.substring(0, 100)) }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleSendNow(msg.id)}
                                            className="p-1.5 hover:bg-green-600/30 rounded text-green-400 transition-colors"
                                            title="Отправить сейчас"
                                        >
                                            <Play size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteScheduled(msg.id)}
                                            className="p-1.5 hover:bg-red-600/30 rounded text-red-400 transition-colors"
                                            title="Удалить"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div className="px-5 pb-2 pt-1">
                <div
                    className="rounded-xl bg-[#222529] border border-gray-600 transition-all relative"
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
                            // Save draft on every change
                            if (currentChannel) {
                                saveDraft(currentChannel.id, value);
                            }
                            if (value.trim().length > 0) {
                                sendTyping();
                            } else {
                                stopTyping();
                            }
                        }}
                        placeholder={`Message ${currentChannel.type === 'dm' ? '@' + (currentChannel.displayName || currentChannel.name) : '#' + currentChannel.name}`}
                        onSubmit={handleSubmit}
                        onScheduledSubmit={handleScheduledSubmit}
                        disabled={!newMessage.trim() && attachments.length === 0}
                        onFileAttach={handleFileAttach}
                        onVoiceMessage={handleVoiceMessage}
                        attachments={attachments}
                        onRemoveAttachment={handleRemoveAttachment}
                    />
                </div>
                {/* Typing Indicator - below input like Slack */}
                <div className="h-5 flex items-center mt-1 ml-1">
                    <TypingIndicator typingUsers={typingUsers} currentUser={user?.username} />
                </div>
            </div>

            {/* User Mention Popup - hide when huddle is fullscreen */}
            {mentionPopup && !isHuddleFullscreen && (
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

            {/* Thread Panel - Right Sidebar (hidden when huddle is fullscreen) */}
            {activeThread && !isHuddleFullscreen && (
                <ThreadPanel
                    parentMessage={activeThread}
                    channelName={currentChannel?.name}
                    onClose={() => setActiveThread(null)}
                    setCurrentChannel={setCurrentChannel}
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
