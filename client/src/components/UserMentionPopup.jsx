import { useEffect, useRef } from 'react';
import { X, MessageCircle, Phone } from 'lucide-react';
import { useCall } from '../context/CallContext';

export default function UserMentionPopup({ user, position, onClose, onMessage, onCall, onMouseEnter, onMouseLeave }) {
    const popupRef = useRef(null);
    const { joinCall } = useCall();

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
            className="fixed z-50 bg-[#18191c] rounded-lg shadow-2xl border border-gray-700 w-80 overflow-hidden"
            style={{ left: position.x, top: position.y }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header with close button */}
            <div className="relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 hover:bg-gray-700 rounded transition-colors z-10"
                >
                    <X className="text-gray-400" size={16} />
                </button>

                {/* Banner */}
                <div className="h-16 bg-gradient-to-br from-blue-600 to-purple-600" />

                {/* Avatar */}
                <div className="px-4 -mt-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-[#18191c]">
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.username}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            user.username[0]?.toUpperCase()
                        )}
                    </div>
                </div>
            </div>

            {/* User Info */}
            <div className="px-4 pb-4 mt-2">
                <h3 className="text-xl font-bold text-white">{user.username}</h3>
                {user.status && (
                    <p className="text-sm text-gray-400 mt-1">{user.status}</p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleMessage}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
                    >
                        <MessageCircle size={16} />
                        Message
                    </button>
                    {onCall && (
                        <button
                            onClick={handleCall}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
                        >
                            <Phone size={16} />
                            Call
                        </button>
                    )}
                </div>

                {/* Additional Info */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-xs text-gray-400 uppercase font-semibold mb-2">About Me</div>
                    <p className="text-sm text-gray-300">
                        {user.bio || 'No bio provided.'}
                    </p>
                </div>

                {/* Member Since */}
                {user.created_at && (
                    <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Member Since</div>
                        <p className="text-sm text-gray-300">
                            {new Date(user.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
