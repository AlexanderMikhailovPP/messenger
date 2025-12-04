import { useEffect, useRef, useState } from 'react';
import { X, MessageCircle, Phone } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import UserAvatar from './UserAvatar';

export default function UserMentionPopup({ user, position, onClose, onMessage, onCall, onMouseEnter, onMouseLeave }) {
    const popupRef = useRef(null);
    const { joinCall } = useCall();
    const { getUserStatus } = useOnlineStatus();
    const userStatus = getUserStatus(user.id);
    const [isAbove, setIsAbove] = useState(true);
    const [finalPosition, setFinalPosition] = useState({ x: position.x, y: position.y });
    const [isPositioned, setIsPositioned] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Calculate popup position - 10px above/below the trigger element
    useEffect(() => {
        if (popupRef.current) {
            const popup = popupRef.current;
            const rect = popup.getBoundingClientRect();
            const viewportWidth = window.innerWidth;

            let adjustedX = position.x;
            // position.y is trigger's top - 10
            // So popup bottom should be at position.y (10px above trigger)
            // Add 8px to bring popup closer to trigger
            let adjustedY = position.y - rect.height + 8;
            let above = true;

            // If popup would go above viewport, show below the trigger instead
            if (adjustedY < 10) {
                // position.y is (rect.top - 10), so trigger rect.top = position.y + 10
                // Show popup 10px below the trigger bottom (assume trigger height ~20px)
                adjustedY = position.y + 10 + 20 + 10;
                above = false;
            }

            // Flip horizontally if too close to right edge
            if (adjustedX + rect.width > viewportWidth - 20) {
                adjustedX = viewportWidth - rect.width - 20;
            }

            // Ensure not off-screen left
            if (adjustedX < 10) {
                adjustedX = 10;
            }

            setIsAbove(above);
            setFinalPosition({ x: adjustedX, y: adjustedY });
            setIsPositioned(true);
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
            className="fixed z-50 user-mention-popup"
            style={{
                left: finalPosition.x,
                top: finalPosition.y,
                opacity: isPositioned ? 1 : 0,
                pointerEvents: isPositioned ? 'auto' : 'none'
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Invisible bridge to connect popup with trigger element */}
            {/* Bridge extends from popup edge toward the trigger - larger for easier hover */}
            {isAbove ? (
                // Popup is above trigger - bridge extends down from bottom of popup
                <div
                    className="absolute left-0 w-full pointer-events-auto"
                    style={{ bottom: -35, height: 40 }}
                />
            ) : (
                // Popup is below trigger - bridge extends up from top of popup
                <div
                    className="absolute left-0 w-full pointer-events-auto"
                    style={{ top: -35, height: 40 }}
                />
            )}
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
                                className="rounded-full flex-shrink-0"
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    ...(userStatus === 'active'
                                        ? { backgroundColor: '#2BAC76' }
                                        : userStatus === 'away'
                                        ? { backgroundColor: 'transparent', border: '2px solid #2BAC76', boxSizing: 'border-box' }
                                        : { backgroundColor: 'transparent', border: '2px solid #616061', boxSizing: 'border-box' }
                                    )
                                }}
                                title={userStatus === 'active' ? 'Active' : userStatus === 'away' ? 'Away' : 'Offline'}
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
