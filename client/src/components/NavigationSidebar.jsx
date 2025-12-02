import { useState, useEffect } from 'react';
import axios from 'axios';
import { Hash, Plus, ChevronDown, Search, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NavigationSidebar({ currentChannel, setCurrentChannel }) {
    const [channels, setChannels] = useState([]);
    const [dms, setDms] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
    const [showChannels, setShowChannels] = useState(true);
    const [showDMs, setShowDMs] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            fetchChannels();
            fetchDMs();
        }
    }, [user]);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('/api/channels');
            setChannels(res.data);
            if (res.data.length > 0 && !currentChannel) {
                setCurrentChannel(res.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch channels', error);
        }
    };

    const fetchDMs = async () => {
        try {
            const res = await axios.get(`/api/channels/dms/${user.id}`);
            setDms(res.data);
        } catch (error) {
            console.error('Failed to fetch DMs', error);
        }
    };

    const createChannel = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/channels', { name: newChannelName });
            setChannels([...channels, res.data]);
            setNewChannelName('');
            setShowCreateModal(false);
            setCurrentChannel(res.data);
        } catch (error) {
            alert('Failed to create channel');
        }
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 0) {
            try {
                const res = await axios.get(`/api/users/search?q=${query}`);
                setSearchResults(res.data); // Now contains { users: [], channels: [] }
            } catch (error) {
                console.error('Failed to search', error);
            }
        } else {
            setSearchResults({ users: [], channels: [] });
        }
    };

    return (
        <div className="w-full md:w-[260px] bg-[#1f2225] text-[#9ca3af] flex flex-col h-full border-r border-gray-700/50">
            {/* Header */}
            <div className="h-12 px-4 flex items-center border-b border-gray-700/50">
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search users and channels..."
                        className="w-full bg-[#1a1d21] text-white text-sm rounded px-2 py-1.5 pl-8 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500"
                        value={searchQuery}
                        onChange={handleSearch}
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />

                    {/* Search Results Dropdown */}
                    {(searchResults.users?.length > 0 || searchResults.channels?.length > 0) && (
                        <div className="absolute top-full left-0 w-full bg-[#1f2225] border border-gray-700 rounded-b-lg shadow-xl mt-1 z-50 max-h-64 overflow-y-auto">
                            {/* Channels Section */}
                            {searchResults.channels?.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Channels
                                    </div>
                                    {searchResults.channels.map(channel => (
                                        <div
                                            key={`channel-${channel.id}`}
                                            className="px-3 py-2 hover:bg-blue-600/20 hover:text-blue-400 cursor-pointer flex items-center gap-2 transition-colors"
                                            onClick={() => {
                                                setCurrentChannel(channel);
                                                setSearchQuery('');
                                                setSearchResults({ users: [], channels: [] });
                                            }}
                                        >
                                            <Hash size={16} className="text-gray-400" />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">{channel.name}</div>
                                                {channel.description && (
                                                    <div className="text-xs text-gray-500">{channel.description}</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Users Section */}
                            {searchResults.users?.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Direct Messages
                                    </div>
                                    {searchResults.users.map(u => (
                                        <div
                                            key={`user-${u.id}`}
                                            className="px-3 py-2 hover:bg-blue-600/20 hover:text-blue-400 cursor-pointer flex items-center gap-2 transition-colors"
                                            onClick={async () => {
                                                try {
                                                    const res = await axios.post('/api/channels/dm', {
                                                        currentUserId: user.id,
                                                        targetUserId: u.id
                                                    });
                                                    const dmChannel = res.data;
                                                    dmChannel.displayName = u.username;
                                                    setCurrentChannel(dmChannel);
                                                    setSearchQuery('');
                                                    setSearchResults({ users: [], channels: [] });
                                                    fetchDMs();
                                                } catch (error) {
                                                    console.error('Failed to open DM', error);
                                                    alert('Failed to open DM');
                                                }
                                            }}
                                        >
                                            <img
                                                src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=random`}
                                                alt={u.username}
                                                className="w-6 h-6 rounded bg-gray-700"
                                            />
                                            <span className="text-sm font-medium">{u.username}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Channels */}
                <div className="px-4 mb-2 flex items-center justify-between group mt-4">
                    <div
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-300 cursor-pointer"
                        onClick={() => setShowChannels(!showChannels)}
                    >
                        <ChevronDown
                            size={12}
                            className={`transition-transform ${showChannels ? '' : '-rotate-90'}`}
                        />
                        <span className="text-sm font-medium uppercase tracking-wide">Channels</span>
                    </div>
                    <button onClick={() => setShowCreateModal(true)} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={16} />
                    </button>
                </div>

                {showChannels && (
                    <div className="space-y-[1px] mb-2">
                        {channels.map(channel => (
                            <button
                                key={channel.id}
                                onClick={() => setCurrentChannel(channel)}
                                className={`w-full text-left px-6 py-1.5 flex items-center gap-2 transition-colors ${currentChannel?.id === channel.id
                                    ? 'bg-[#1164A3] text-white'
                                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                <Hash size={16} className="opacity-70" />
                                <span className="truncate text-[15px]">{channel.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="px-4 mb-2 flex items-center justify-between group mt-2">
                    <div
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-300 cursor-pointer"
                        onClick={() => setShowDMs(!showDMs)}
                    >
                        <ChevronDown
                            size={12}
                            className={`transition-transform ${showDMs ? '' : '-rotate-90'}`}
                        />
                        <span className="text-sm font-medium uppercase tracking-wide">Direct Messages</span>
                    </div>
                </div>

                {showDMs && (
                    <div className="space-y-[1px] mb-6">
                        {dms.map(dm => (
                            <button
                                key={dm.id}
                                onClick={() => setCurrentChannel(dm)}
                                className={`w-full text-left px-6 py-1.5 flex items-center gap-2 transition-colors ${currentChannel?.id === dm.id
                                    ? 'bg-[#1164A3] text-white'
                                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                <div className="relative">
                                    <img
                                        src={dm.avatarUrl || `https://ui-avatars.com/api/?name=${dm.displayName}&background=random`}
                                        alt={dm.displayName}
                                        className="w-4 h-4 rounded bg-gray-700"
                                    />
                                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[#1f2225]"></div>
                                </div>
                                <span className="truncate text-[15px]">{dm.displayName}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>


            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                        <div className="bg-[#1f2225] text-white p-6 rounded-lg w-96 border border-gray-700 shadow-xl">
                            <h3 className="text-xl font-bold mb-6">Create Channel</h3>
                            <form onSubmit={createChannel}>
                                <div className="mb-4">
                                    <label className="block text-gray-400 text-sm font-medium mb-2">Name</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500">#</span>
                                        <input
                                            type="text"
                                            placeholder="e.g. plan-budget"
                                            className="w-full pl-7 p-2 bg-[#1a1d21] border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-white"
                                            value={newChannelName}
                                            onChange={(e) => setNewChannelName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-[#007a5a] text-white rounded font-medium hover:bg-[#148567]"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}


