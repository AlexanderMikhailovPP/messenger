import { useState, useEffect } from 'react';
import axios from 'axios';
import { Hash, Plus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentChannel, setCurrentChannel }) {
    const [channels, setChannels] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const { user, logout } = useAuth();

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('http://localhost:3001/channels');
            setChannels(res.data);
            if (res.data.length > 0 && !currentChannel) {
                setCurrentChannel(res.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch channels', error);
        }
    };

    const createChannel = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:3001/channels', { name: newChannelName });
            setChannels([...channels, res.data]);
            setNewChannelName('');
            setShowCreateModal(false);
            setCurrentChannel(res.data);
        } catch (error) {
            alert('Failed to create channel');
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full">
            <div className="p-4 border-b border-gray-700 font-bold text-white flex justify-between items-center">
                <span>CorpMessenger</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                <div className="flex justify-between items-center mb-2 px-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Channels</h3>
                    <button onClick={() => setShowCreateModal(true)} className="hover:text-white">
                        <Plus size={16} />
                    </button>
                </div>

                <ul className="space-y-1">
                    {channels.map(channel => (
                        <li key={channel.id}>
                            <button
                                onClick={() => setCurrentChannel(channel)}
                                className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 ${currentChannel?.id === channel.id ? 'bg-blue-700 text-white' : 'hover:bg-gray-800'
                                    }`}
                            >
                                <Hash size={16} />
                                <span className="truncate">{channel.name}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="p-4 bg-gray-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-white truncate w-24">{user?.username}</span>
                </div>
                <button onClick={logout} className="text-gray-400 hover:text-white" title="Logout">
                    <LogOut size={18} />
                </button>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white text-gray-900 p-6 rounded-lg w-80">
                        <h3 className="text-lg font-bold mb-4">Create Channel</h3>
                        <form onSubmit={createChannel}>
                            <input
                                type="text"
                                placeholder="Channel name"
                                className="w-full p-2 border rounded mb-4"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                                required
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
