import { useState, useEffect } from 'react';
import axios from 'axios';
import { Hash, Plus, LogOut, Sparkles, X, Video, Mic, Clock, Type, MessageSquare, Users, FileEdit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDrafts } from '../utils/drafts';

const changelogData = [
    {
        version: '1.5.0',
        date: '2024-12-04',
        icon: Clock,
        color: 'bg-purple-500',
        title: 'Отложенные сообщения',
        changes: [
            'Планирование отправки сообщений на определённое время',
            'Пресеты: через 30 мин, 1 час, 3 часа, завтра в 9:00',
            'Выбор произвольной даты и времени',
        ]
    },
    {
        version: '1.4.0',
        date: '2024-12-03',
        icon: Video,
        color: 'bg-blue-500',
        title: 'Видеозвонки',
        changes: [
            'WebRTC видеозвонки между пользователями',
            'Включение/выключение камеры и микрофона',
            'Групповые видеоконференции (Huddle)',
        ]
    },
    {
        version: '1.3.0',
        date: '2024-12-02',
        icon: Mic,
        color: 'bg-green-500',
        title: 'Голосовые сообщения',
        changes: [
            'Запись голосовых сообщений',
            'Предпрослушивание перед отправкой',
            'Воспроизведение в чате',
        ]
    },
    {
        version: '1.2.0',
        date: '2024-12-01',
        icon: Type,
        color: 'bg-orange-500',
        title: 'Форматирование текста',
        changes: [
            'Жирный, курсив, подчёркнутый текст',
            'Списки и цитаты',
            'Блоки кода с подсветкой синтаксиса',
        ]
    },
    {
        version: '1.1.0',
        date: '2024-11-30',
        icon: MessageSquare,
        color: 'bg-pink-500',
        title: 'Треды и реакции',
        changes: [
            'Ответы в тредах на сообщения',
            'Эмодзи-реакции на сообщения',
            'Отображение количества ответов',
        ]
    },
    {
        version: '1.0.0',
        date: '2024-11-29',
        icon: Users,
        color: 'bg-gray-500',
        title: 'Первый релиз',
        changes: [
            'Регистрация и авторизация',
            'Создание каналов',
            'Обмен сообщениями в реальном времени',
        ]
    },
];

export default function Sidebar({ currentChannel, setCurrentChannel }) {
    const [channels, setChannels] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [drafts, setDrafts] = useState({});
    const { user, logout } = useAuth();

    // Update drafts state periodically
    useEffect(() => {
        const updateDrafts = () => setDrafts(getDrafts());
        updateDrafts();
        const interval = setInterval(updateDrafts, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            const res = await axios.get('/api/channels', { withCredentials: true });
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
            const res = await axios.post('/api/channels', { name: newChannelName }, { withCredentials: true });
            setChannels([...channels, res.data]);
            setNewChannelName('');
            setShowCreateModal(false);
            setCurrentChannel(res.data);
        } catch (error) {
            alert('Failed to create channel');
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full select-none">
            <div className="p-4 border-b border-gray-700 font-bold text-white flex justify-between items-center">
                <span>CorpMessenger</span>
            </div>

            {/* Changelog Button */}
            <button
                onClick={() => setShowChangelog(true)}
                className="mx-3 mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white flex items-center gap-2 text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
            >
                <Sparkles size={16} className="text-yellow-300" />
                <span>Что нового</span>
                <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded">v1.5</span>
            </button>

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
                                <span className="truncate flex-1">{channel.name}</span>
                                {drafts[channel.id] && (
                                    <FileEdit size={14} className="text-orange-400 flex-shrink-0" title="Черновик" />
                                )}
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

            {/* Changelog Modal */}
            {showChangelog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
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
                                    <h2 className="text-2xl font-bold">Что нового</h2>
                                    <p className="text-white/70 text-sm">История обновлений CorpMessenger</p>
                                </div>
                            </div>
                        </div>

                        {/* Changelog entries */}
                        <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-4 space-y-4">
                            {changelogData.map((entry, index) => {
                                const IconComponent = entry.icon;
                                return (
                                    <div
                                        key={entry.version}
                                        className={`relative pl-8 pb-4 ${index !== changelogData.length - 1 ? 'border-l-2 border-gray-700 ml-4' : 'ml-4'}`}
                                    >
                                        {/* Version badge with icon */}
                                        <div className={`absolute -left-4 top-0 w-8 h-8 ${entry.color} rounded-full flex items-center justify-center shadow-lg`}>
                                            <IconComponent size={16} className="text-white" />
                                        </div>

                                        {/* Content */}
                                        <div className="bg-gray-800 rounded-xl p-4 ml-4 hover:bg-gray-750 transition-colors">
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
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
