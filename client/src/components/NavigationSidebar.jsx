import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Hash, Plus, ChevronDown, Search, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUnreadCounts, subscribeToUnreadChanges, subscribeToDMUpdates } from '../utils/unreadCounter';
import { getSocket } from '../socket';
import UserAvatar from './UserAvatar';

const changelogData = [
    {
        version: '1.5.0',
        date: '2025-12-04',
        title: 'Scheduled Messages',
        changes: [
            'Schedule messages to be sent at a specific time',
            'Presets: in 30 min, 1 hour, 3 hours, tomorrow at 9:00',
            'Custom date and time picker',
        ]
    },
    {
        version: '1.4.0',
        date: '2025-12-03',
        title: 'Voice Messages',
        changes: [
            'Record voice messages',
            'Preview before sending',
            'Playback in chat',
        ]
    },
    {
        version: '1.3.0',
        date: '2025-12-03',
        title: 'Video Calls & Huddle',
        changes: [
            'WebRTC video calls between users',
            'Toggle camera and microphone',
            'Group video conferences (Huddle)',
        ]
    },
    {
        version: '1.2.0',
        date: '2025-12-03',
        title: 'Formatting & Threads',
        changes: [
            'Bold, italic, underline text',
            'Lists, quotes and code blocks',
            'Reply in threads',
        ]
    },
    {
        version: '1.1.0',
        date: '2025-12-01',
        title: 'Reactions',
        changes: [
            'Emoji reactions on messages',
            'Emoji picker with search',
        ]
    },
    {
        version: '1.0.0',
        date: '2025-12-01',
        title: 'Initial Release',
        changes: [
            'Registration and authentication',
            'Create channels and direct messages',
            'Real-time messaging',
        ]
    },
];

export default function NavigationSidebar({ currentChannel, setCurrentChannel, isMobile, activeTab = 'home' }) {
    const [channels, setChannels] = useState([]);
    const [dms, setDms] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
    const [showChannels, setShowChannels] = useState(true);
    const [showDMs, setShowDMs] = useState(true);
    const { user } = useAuth();
    const [unreadCounts, setUnreadCounts] = useState({});

    const fetchDMsCallback = useCallback(async () => {
        if (!user) return;
        try {
            const res = await axios.get(`/api/channels/dms/${user.id}`);
            setDms(res.data);
        } catch (error) {
            console.error('Failed to fetch DMs', error);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchChannels();
            fetchDMsCallback();

            // Subscribe to unread count changes (instant updates)
            const unsubscribeUnread = subscribeToUnreadChanges((counts) => {
                setUnreadCounts(counts);
            });
            setUnreadCounts(getUnreadCounts());

            // Subscribe to new DM notifications
            const unsubscribeDM = subscribeToDMUpdates(() => {
                fetchDMsCallback();
            });

            return () => {
                unsubscribeUnread();
                unsubscribeDM();
            };
        }
    }, [user, fetchDMsCallback]);

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
        <div className={`w-full ${isMobile ? 'bg-[#1a1d21]' : 'md:w-[260px] bg-[#1f2225] border-r border-gray-700/50'} text-[#9ca3af] flex flex-col h-full`}>
            {/* Header */}
            {isMobile && (
                <div className="h-14 px-4 flex items-center gap-3 border-b border-gray-800 bg-[#1a1d21]">
                    <UserAvatar user={user} size="md" />
                    <span className="text-white font-bold text-lg">Home</span>
                </div>
            )}

            <div className={`${isMobile ? 'p-4' : 'h-12 px-4 flex items-center border-b border-gray-700/50'}`}>
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
                                                    fetchDMsCallback();
                                                } catch (error) {
                                                    console.error('Failed to open DM', error);
                                                    alert('Failed to open DM');
                                                }
                                            }}
                                        >
                                            <UserAvatar
                                                user={{
                                                    username: u.username,
                                                    avatar_url: u.avatar_url
                                                }}
                                                size="sm"
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

            {/* Changelog Button */}
            <button
                onClick={() => setShowChangelog(true)}
                className="mx-3 mt-3 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white flex items-center gap-2 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
            >
                <Sparkles size={16} className="text-yellow-300" />
                <span>What's New</span>
                <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded">v1.5</span>
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {(activeTab === 'home' || activeTab === 'channels') && (
                    <>
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
                                {channels.map((ch) => {
                                    const unread = unreadCounts[ch.id] || 0;
                                    return (
                                        <button
                                            key={ch.id}
                                            onClick={() => setCurrentChannel(ch)}
                                            className={`w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-600/50 transition-colors ${currentChannel?.id === ch.id ? 'bg-gray-600/50 text-white' : 'text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Hash size={16} className="flex-shrink-0 text-gray-400" />
                                                <span className="text-sm truncate">{ch.name}</span>
                                            </div>
                                            {unread > 0 && (
                                                <div className="flex-shrink-0 min-w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                                                    {unread > 99 ? '99+' : unread}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {(activeTab === 'home' || activeTab === 'dms') && (
                    <>
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
                                {dms.map((dm) => {
                                    const unread = unreadCounts[dm.id] || 0;
                                    return (
                                        <button
                                            key={dm.id}
                                            onClick={() => setCurrentChannel(dm)}
                                            className={`w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-600/50 transition-colors ${currentChannel?.id === dm.id ? 'bg-gray-600/50 text-white' : 'text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <UserAvatar
                                                    user={{
                                                        username: dm.displayName || dm.name,
                                                        avatar_url: dm.avatarUrl
                                                    }}
                                                    size="xs"
                                                />
                                                <span className="text-sm truncate">{dm.displayName || dm.name}</span>
                                            </div>
                                            {unread > 0 && (
                                                <div className="flex-shrink-0 min-w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">
                                                    {unread > 99 ? '99+' : unread}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {showCreateModal && (
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
            )}

            {/* Changelog Modal */}
            {showChangelog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-gray-900 text-white rounded-2xl w-[500px] max-h-[80vh] overflow-hidden shadow-2xl border border-gray-700">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 relative">
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Sparkles size={24} className="text-yellow-300" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">What's New</h2>
                                    <p className="text-white/70 text-sm">CorpMessenger Release Notes</p>
                                </div>
                            </div>
                        </div>

                        {/* Changelog entries */}
                        <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-4 space-y-3">
                            {changelogData.map((entry) => (
                                <div
                                    key={entry.version}
                                    className="bg-gray-800 rounded-xl p-4 hover:bg-gray-800/80 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-lg">{entry.title}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{entry.date}</span>
                                            <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full font-mono">
                                                v{entry.version}
                                            </span>
                                        </div>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                <span className="text-green-400 mt-0.5">•</span>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



