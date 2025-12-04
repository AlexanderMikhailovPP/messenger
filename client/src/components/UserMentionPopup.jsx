import { useEffect, useRef } from 'react';
import { X, MessageCircle, Phone } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import UserAvatar from './UserAvatar';

export default function UserMentionPopup({ user, position, onClose, onMessage, onCall, onMouseEnter, onMouseLeave }) {
    const popupRef = useRef(null);
    const { joinCall } = useCall();
    const { isUserOnline } = useOnlineStatus();
    const isOnline = isUserOnline(user.id);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Calculate popup position with flip logic to stay within viewport
    useEffect(() => {
        if (popupRef.current) {
            const popup = popupRef.current;
            const rect = popup.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let adjustedX = position.x;
            let adjustedY = position.y;

            // Flip horizontally if too close to right edge
            if (position.x + rect.width > viewportWidth - 20) {
                adjustedX = position.x - rect.width;
            }

            // Flip vertically if too close to bottom
            if (position.y + rect.height > viewportHeight - 20) {
                adjustedY = position.y - rect.height;
            }

            // Ensure not off-screen left
            if (adjustedX < 20) {
                adjustedX = 20;
            }

            // Ensure not off-screen top
            if (adjustedY < 20) {
                adjustedY = 20;
            }

            popup.style.left = `${adjustedX}px`;
            popup.style.top = `${adjustedY}px`;
        }
    }, [position]);

    const handleMessage = () => {
        onMessage(user);
        onClose();
    };

    const handleCall = () => {
        if (onCall) {
            onCall(user);
        }
        onClose();
    };

    return (
        <div
            ref={popupRef}
            className="fixed z-50"
            style={{ left: position.x, top: position.y }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Invisible bridge to connect popup with trigger element below */}
            <div className="absolute left-0 bottom-[-8px] w-full h-3" />
            <div className="bg-[#1a1d21] rounded-xl shadow-2xl border border-gray-700/50 w-[340px] overflow-hidden font-sans">
            <div className="p-5">
                <div className="flex gap-4">
                    {/* Avatar */}
                    <UserAvatar
                        user={{
                            username: user.username,
                            avatar_url: user.avatar_url
                        }}
                        size="2xl"
                        className="rounded-xl"
                    />

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white truncate">{user.username}</h3>
                            <div
                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                    isOnline
                                        ? 'bg-[#5DA87F]'
                                        : 'bg-[#1a1d21] border border-gray-500'
                                }`}
                                title={isOnline ? 'Online' : 'Offline'}
                            />
                        </div>
                        <p className="text-gray-400 text-sm leading-snug mt-0.5">
                            {user.bio || 'No status provided'}
                        </p>
                    </div>
                </div>

                {/* Local Time */}
                <div className="flex items-center gap-2 mt-4 text-gray-300">
                    <div className="w-4 h-4 rounded-full border border-gray-500 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-gray-500 rotate-45"></div>
                    </div>
                    <span className="text-sm">
                        {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} local time
                    </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-5">
                    <button
                        onClick={handleMessage}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors text-white text-sm font-medium"
                    >
                        <MessageCircle size={16} />
                        Message
                    </button>
                    {onCall && (
                        <button
                            onClick={handleCall}
                            className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors text-white text-sm font-medium"
                        >
                            <Phone size={16} />
                            Huddle
                        </button>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
