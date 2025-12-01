import { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
    const { user, setUser } = useAuth();
    const [username, setUsername] = useState(user?.username || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.put('/api/users/profile', {
                userId: user.id,
                username,
                avatar_url: avatarUrl
            });

            // Update local user state
            setUser({
                ...user,
                username,
                avatar_url: avatarUrl
            });

            onClose();
        } catch (err) {
            console.error('Failed to update profile:', err);
            alert('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[#1a1d21] border border-gray-700 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Avatar Preview */}
                    <div className="flex justify-center">
                        <img
                            src={avatarUrl || `https://ui-avatars.com/api/?name=${username}&background=random&size=128`}
                            alt="Avatar"
                            className="w-32 h-32 rounded-full"
                        />
                    </div>

                    {/* Avatar URL Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Avatar URL
                        </label>
                        <input
                            type="text"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/avatar.jpg"
                            className="w-full px-3 py-2 bg-[#222529] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave empty to use generated avatar
                        </p>
                    </div>

                    {/* Username Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 bg-[#222529] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
