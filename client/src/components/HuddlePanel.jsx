import { useState } from 'react';
import { Mic, MicOff, ChevronUp, ChevronDown, X, Settings, Volume2 } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function HuddlePanel({
    channelId,
    channelName,
    channelType,
    isInCall,
    isMuted,
    onToggleMute,
    onLeave,
    participants = []
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isInCall) return null;

    const currentUser = participants.find(p => p.isCurrentUser);
    const otherParticipants = participants.filter(p => !p.isCurrentUser);
    const totalCount = participants.length;

    return (
        <div className="fixed bottom-5 right-5 z-50">
            {/* Minimized State */}
            {!isExpanded && (
                <div className="bg-[#350d36] text-white rounded-lg shadow-2xl border border-gray-700 p-3 min-w-[400px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-500/20 p-1.5 rounded-full">
                                <Volume2 size={16} className="text-green-500" />
                            </div>
                            <span className="font-semibold text-sm">
                                Huddle in {channelType === 'dm' ? '@' : '#'}{channelName}
                            </span>
                            <span className="text-gray-400 text-xs">{totalCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded(true)}
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                title="Expand"
                            >
                                <ChevronUp size={16} />
                            </button>
                            <button
                                onClick={onLeave}
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Participant Avatars Row + Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {participants.slice(0, 5).map((participant) => (
                                <div key={participant.userId} className="relative">
                                    <UserAvatar
                                        user={{
                                            username: participant.username,
                                            avatar_url: participant.avatarUrl
                                        }}
                                        size="sm"
                                    />
                                    {participant.isMuted && (
                                        <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
                                            <MicOff size={8} className="text-white" />
                                        </div>
                                    )}
                                    {participant.isSpeaking && !participant.isMuted && (
                                        <div className="absolute inset-0 rounded-full ring-2 ring-green-500 animate-pulse" />
                                    )}
                                </div>
                            ))}
                            {totalCount > 5 && (
                                <div className="text-xs text-gray-400">+{totalCount - 5}</div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMute}
                                className={`p-2 rounded-full transition-colors ${isMuted
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>

                            <button
                                onClick={onLeave}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded transition-colors"
                            >
                                Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expanded State */}
            {isExpanded && (
                <div className="bg-[#350d36] text-white rounded-lg shadow-2xl border border-gray-700 w-[350px] max-h-[500px] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <div className="bg-green-500/20 p-1.5 rounded-full">
                                <Volume2 size={16} className="text-green-500" />
                            </div>
                            <span className="font-semibold text-sm">
                                Huddle in {channelType === 'dm' ? '@' : '#'}{channelName}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                title="Minimize"
                            >
                                <ChevronDown size={16} />
                            </button>
                            <button
                                onClick={onLeave}
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Participants List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {participants.map((participant) => (
                            <div
                                key={participant.userId}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                                <div className="relative">
                                    <UserAvatar
                                        user={{
                                            username: participant.username,
                                            avatar_url: participant.avatarUrl
                                        }}
                                        size="md"
                                    />
                                    {participant.isSpeaking && !participant.isMuted && (
                                        <div className="absolute inset-0 rounded-full ring-2 ring-green-500 animate-pulse" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        {participant.username}
                                        {participant.isCurrentUser && (
                                            <span className="text-xs text-gray-400">(You)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-1">
                                        {participant.isMuted ? (
                                            <>
                                                <MicOff size={12} className="text-red-400" />
                                                Microphone off
                                            </>
                                        ) : participant.isSpeaking ? (
                                            <>
                                                <Volume2 size={12} className="text-green-500" />
                                                <span className="text-green-500">Speaking</span>
                                            </>
                                        ) : (
                                            <>
                                                <Mic size={12} />
                                                Microphone on
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-gray-700">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMute}
                                className={`p-2.5 rounded-full transition-colors ${isMuted
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            <button
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors opacity-50 cursor-not-allowed"
                                title="Video (Coming soon)"
                                disabled
                            >
                                <span className="text-xs">📷</span>
                            </button>

                            <button
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors opacity-50 cursor-not-allowed"
                                title="Screen share (Coming soon)"
                                disabled
                            >
                                <span className="text-xs">🖥️</span>
                            </button>

                            <button
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                title="Settings"
                            >
                                <Settings size={18} />
                            </button>
                        </div>

                        <button
                            onClick={onLeave}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded transition-colors"
                        >
                            Leave
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
