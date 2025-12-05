import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, Smile, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import UserAvatar from './UserAvatar';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';

export default function ProfilePopup({ isOpen, onClose, onOpenProfile, onOpenSettings, anchorRef }) {
    const { user, updateUser, logout } = useAuth();
    const { myStatus } = useOnlineStatus();
    const [showStatusEditor, setShowStatusEditor] = useState(false);
    const [statusEmoji, setStatusEmoji] = useState('');
    const [statusText, setStatusText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const popupRef = useRef(null);

    // Parse existing status
    useEffect(() => {
        if (user?.custom_status) {
            // Status format: "emoji text" or just "emoji"
            const match = user.custom_status.match(/^(\p{Emoji})\s*(.*)/u);
            if (match) {
                setStatusEmoji(match[1]);
                setStatusText(match[2] || '');
            } else {
                setStatusText(user.custom_status);
            }
        } else {
            setStatusEmoji('');
            setStatusText('');
        }
    }, [user?.custom_status]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    const handleSaveStatus = async () => {
        setIsSaving(true);
        const newStatus = statusEmoji ? `${statusEmoji} ${statusText}`.trim() : statusText.trim();

        try {
            await axios.put('/api/users/status', {
                custom_status: newStatus || null
            });

            updateUser({ custom_status: newStatus || null });
            setShowStatusEditor(false);
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearStatus = async () => {
        setIsSaving(true);
        try {
            await axios.put('/api/users/status', { custom_status: null });
            updateUser({ custom_status: null });
            setStatusEmoji('');
            setStatusText('');
            setShowStatusEditor(false);
        } catch (err) {
            console.error('Failed to clear status:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const getOnlineStatusText = () => {
        if (myStatus === 'active') return 'Active';
        if (myStatus === 'away') return 'Away';
        return 'Offline';
    };

    const getOnlineStatusColor = () => {
        if (myStatus === 'active') return 'bg-green-500';
        if (myStatus === 'away') return 'bg-yellow-500';
        return 'bg-gray-500';
    };

    // Get status emoji for display
    const displayStatusEmoji = () => {
        if (user?.custom_status) {
            const match = user.custom_status.match(/^(\p{Emoji})/u);
            return match ? match[1] : null;
        }
        return null;
    };

    return (
        <div
            ref={popupRef}
            className="absolute bottom-full left-0 mb-2 w-72 bg-[#1a1d21] dark:bg-[#1a1d21] light:bg-white border border-gray-700 light:border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50"
        >
            {/* Header with avatar and name */}
            <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <UserAvatar user={user} size="xl" />
                        <div className={`absolute bottom-0 right-0 w-4 h-4 ${getOnlineStatusColor()} rounded-full border-2 border-[#1a1d21]`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white truncate">{user?.username}</span>
                            {displayStatusEmoji() && (
                                <span className="text-lg">{displayStatusEmoji()}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-400">
                            <div className={`w-2 h-2 ${getOnlineStatusColor()} rounded-full`} />
                            <span>{getOnlineStatusText()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status section */}
            <div className="p-3 border-b border-gray-700/50">
                {showStatusEditor ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="w-10 h-10 flex items-center justify-center bg-[#2e3136] hover:bg-[#3e4147] rounded-lg text-xl transition-colors"
                            >
                                {statusEmoji || <Smile size={20} className="text-gray-400" />}
                            </button>
                            <input
                                type="text"
                                value={statusText}
                                onChange={(e) => setStatusText(e.target.value.slice(0, 100))}
                                placeholder="What's your status?"
                                className="flex-1 px-3 py-2 bg-[#2e3136] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                maxLength={100}
                            />
                        </div>
                        {showEmojiPicker && (
                            <div className="absolute z-50">
                                <EmojiPicker
                                    onEmojiClick={(emoji) => {
                                        setStatusEmoji(emoji.emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                    theme="dark"
                                    width={280}
                                    height={350}
                                />
                            </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{(statusEmoji + ' ' + statusText).trim().length}/100</span>
                            <div className="flex gap-2">
                                {user?.custom_status && (
                                    <button
                                        onClick={handleClearStatus}
                                        className="px-2 py-1 text-red-400 hover:text-red-300"
                                        disabled={isSaving}
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowStatusEditor(false)}
                                    className="px-2 py-1 text-gray-400 hover:text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveStatus}
                                    disabled={isSaving}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowStatusEditor(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-[#2e3136] hover:bg-[#3e4147] rounded-lg text-left transition-colors"
                    >
                        <Smile size={18} className="text-gray-400" />
                        <span className="text-sm text-gray-300">
                            {user?.custom_status || 'Set a status'}
                        </span>
                    </button>
                )}
            </div>

            {/* Menu items */}
            <div className="p-2">
                <button
                    onClick={() => {
                        onOpenProfile();
                        onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2e3136] rounded-lg text-gray-300 hover:text-white transition-colors"
                >
                    <User size={18} />
                    <span className="text-sm">Profile</span>
                </button>
                <button
                    onClick={() => {
                        onOpenSettings();
                        onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2e3136] rounded-lg text-gray-300 hover:text-white transition-colors"
                >
                    <Settings size={18} />
                    <span className="text-sm">Settings</span>
                </button>
                <div className="my-1 border-t border-gray-700/50" />
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                >
                    <LogOut size={18} />
                    <span className="text-sm">Log Out</span>
                </button>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]" onClick={() => setShowLogoutConfirm(false)}>
                    <div
                        className="bg-[#1f2225] border border-gray-700 rounded-lg p-6 w-80 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertTriangle size={20} className="text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Log Out</h3>
                        </div>
                        <p className="text-gray-400 text-sm mb-6">
                            Are you sure you want to log out?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    logout();
                                    onClose();
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
