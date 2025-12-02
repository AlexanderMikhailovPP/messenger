import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

export default function UserMentionPopup({ userId, position, onMessage, onMouseEnter, onMouseLeave }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get(`/api/users/${userId}`);
                setUser(res.data);
            } catch (error) {
                console.error('Failed to fetch user:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUser();
        }
    }, [userId]);

    const content = (
        <div
            className="fixed z-[9999] bg-[#1f2225] border border-gray-700 rounded-lg shadow-2xl p-4 w-80"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {loading ? (
                <div className="animate-pulse">
                    <div className="w-16 h-16 bg-gray-700 rounded-lg mb-3"></div>
                    <div className="h-6 bg-gray-700 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-24"></div>
                </div>
            ) : user ? (
                <>
                    {/* User Info */}
                    <div className="flex items-start gap-3 mb-4">
                        <img
                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random&size=64`}
                            alt={user.username}
                            className="w-16 h-16 rounded-lg bg-gray-700"
                        />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-lg truncate">
                                {user.username}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-gray-400">Active</span>
                            </div>
                        </div>
                    </div>

                    {/* Message Button */}
                    <button
                        onClick={() => {
                            onMessage(user);
                            onMouseLeave(); // Close popup
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                        <MessageCircle size={18} />
                        <span>Написать</span>
                    </button>
                </>
            ) : null}
        </div>
    );

    return createPortal(content, document.body);
}
