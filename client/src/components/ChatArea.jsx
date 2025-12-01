import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Hash, Send, Info, Smile, Plus, AtSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const socket = io();

export default function ChatArea({ currentChannel }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const { user } = useAuth();
    const messagesEndRef = useRef(null);

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

    const fetchMessages = async (channelId) => {
        try {
            const res = await axios.get(`/api/messages/${channelId}`);
            setMessages(res.data);
        } catch (error) {
            console.error('Failed to fetch messages', error);
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

                                <div className={`group flex gap-3 hover:bg-gray-800/30 px-4 py-1 -mx-4 rounded ${isSameUser ? 'mt-0.5' : 'mt-2'}`}>
                                    {!isSameUser ? (
                                        <img
                                            src={msg.avatar_url || `https://ui-avatars.com/api/?name=${msg.username}&background=random&size=36`}
                                            alt={msg.username}
                                            className="w-9 h-9 rounded flex-shrink-0 cursor-pointer hover:opacity-90"
                                        />
                                    ) : (
                                        <div className="w-9 flex-shrink-0 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 text-right pt-1">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {!isSameUser && (
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="font-bold text-[15px] text-white hover:underline cursor-pointer">{msg.username}</span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-[15px] text-gray-300 leading-relaxed break-words">
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-5 pt-0">
                <div className="border border-gray-600 rounded-xl bg-[#222529] focus-within:border-gray-400 focus-within:shadow-md transition-all">
                    <form onSubmit={sendMessage} className="relative">
                        <input
                            type="text"
                            placeholder={`Message ${currentChannel.type === 'dm' ? '@' + (currentChannel.displayName || currentChannel.name) : '#' + currentChannel.name}`}
                            className="w-full p-3 min-h-[80px] bg-transparent border-none focus:outline-none text-gray-200 placeholder-gray-500 align-top"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />

                        <div className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-1">
                                <ActionBtn icon={<Plus size={16} />} />
                                <ActionBtn icon={<Smile size={16} />} />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    className={`p-2 rounded transition-colors ${newMessage.trim() ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                    disabled={!newMessage.trim()}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                    <strong>Tip:</strong> Shift + Enter for new line
                </div>
            </div>
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
