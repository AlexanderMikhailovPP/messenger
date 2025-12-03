import { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

export default function ProfileModal({ isOpen, onClose }) {
    const { user, updateUser } = useAuth();
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

            // Update local user state and persist to localStorage
            updateUser({
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]" onClick={onClose}>
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
                        <UserAvatar
                            user={{ username, avatar_url: avatarUrl }}
                            size="4xl"
                            rounded="rounded-full"
                        />
                    </div>

                    {/* Avatar File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Upload Avatar
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const formData = new FormData();
                                    formData.append('avatar', file);

                                    try {
                                        const res = await axios.post('/api/users/avatar', formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                        });
                                        setAvatarUrl(res.data.avatar_url);
                                    } catch (err) {
                                        console.error('Failed to upload avatar:', err);
                                        alert('Failed to upload avatar');
                                    }
                                }
                            }}
                            className="w-full px-3 py-2 bg-[#222529] border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Upload an image file (max 5MB)
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
