import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ChevronUp, ChevronDown, X, Phone, PhoneOff, Headphones } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function HuddlePanel({
    channelId,
    channelName,
    channelType,
    isInCall,
    isMuted,
    isVideoOn,
    onToggleMute,
    onToggleVideo,
    onLeave,
    participants = [],
    localStream,
    remoteStreams = {},
    connectionStatus = 'connected'
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});

    // Attach local video stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream && isVideoOn) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoOn]);

    // Check if anyone has video on
    const hasAnyVideo = isVideoOn || participants.some(p => !p.isCurrentUser && p.hasVideo);

    // Auto-expand when anyone enables video
    useEffect(() => {
        if (hasAnyVideo && !isExpanded) {
            setIsExpanded(true);
        }
    }, [hasAnyVideo]);

    // Call duration timer
    useEffect(() => {
        if (!isInCall) {
            setCallDuration(0);
            return;
        }

        const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [isInCall]);

    // Format duration as MM:SS or HH:MM:SS
    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Keyboard shortcuts for mute (M key) and video (V key)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }
            if (e.key === 'm' || e.key === 'M') {
                onToggleMute();
            }
            if (e.key === 'v' || e.key === 'V') {
                onToggleVideo();
            }
        };

        if (isInCall) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isInCall, onToggleMute, onToggleVideo]);

    if (!isInCall) return null;

    const currentUser = participants.find(p => p.isCurrentUser);
    const otherParticipants = participants.filter(p => !p.isCurrentUser);
    const totalCount = participants.length;

    return (
        <div className="fixed bottom-5 right-5 z-50 font-sans">
            {/* Minimized State - Slack-style compact bar */}
            {!isExpanded && (
                <div
                    className="bg-[#1a1d21] text-white rounded-xl shadow-2xl border border-[#565856]/30 overflow-hidden"
                    style={{ minWidth: '320px' }}
                >
                    {/* Green huddle indicator bar */}
                    <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

                    <div className="p-3">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Headphones size={18} className="text-green-500" />
                                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm text-white">
                                        {channelType === 'dm' ? '' : '#'}{channelName}
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-1">
                                        <span className="text-green-500">{formatDuration(callDuration)}</span>
                                        <span className="mx-1">·</span>
                                        <span>{totalCount} {totalCount === 1 ? 'person' : 'people'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Expand"
                                >
                                    <ChevronUp size={16} className="text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Participants avatars */}
                        <div className="flex items-center gap-2 mb-3">
                            {participants.slice(0, 6).map((participant, index) => (
                                <div
                                    key={participant.userId}
                                    className="relative"
                                    style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
                                >
                                    <div className={`rounded-full ${participant.isSpeaking && !participant.isMuted ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-[#1a1d21]' : ''}`}>
                                        <UserAvatar
                                            user={{
                                                username: participant.username,
                                                avatar_url: participant.avatarUrl
                                            }}
                                            size="sm"
                                        />
                                    </div>
                                    {participant.isMuted && (
                                        <div className="absolute -bottom-0.5 -right-0.5 bg-[#1a1d21] rounded-full p-0.5">
                                            <MicOff size={10} className="text-red-400" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {totalCount > 6 && (
                                <div className="w-8 h-8 rounded-full bg-[#2e3136] flex items-center justify-center text-xs text-gray-400 font-medium" style={{ marginLeft: '-8px' }}>
                                    +{totalCount - 6}
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMute}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isMuted
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                            </button>

                            <button
                                onClick={onToggleVideo}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isVideoOn
                                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isVideoOn ? 'Turn off video (V)' : 'Turn on video (V)'}
                            >
                                {isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
                            </button>

                            <button
                                onClick={onLeave}
                                className="flex items-center justify-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                <PhoneOff size={16} />
                                <span>Leave</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expanded State - Full participant list */}
            {isExpanded && (
                <div
                    className="bg-[#1a1d21] text-white rounded-xl shadow-2xl border border-[#565856]/30 overflow-hidden flex flex-col"
                    style={{ width: hasAnyVideo ? '500px' : '340px', maxHeight: hasAnyVideo ? '600px' : '480px' }}
                >
                    {/* Green huddle indicator bar */}
                    <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-[#565856]/30">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Headphones size={20} className="text-green-500" />
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            </div>
                            <div>
                                <div className="font-semibold text-white">
                                    Huddle
                                </div>
                                <div className="text-xs text-gray-400">
                                    {channelType === 'dm' ? '' : '#'}{channelName} · {formatDuration(callDuration)}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Minimize"
                            >
                                <ChevronDown size={16} className="text-gray-400" />
                            </button>
                            <button
                                onClick={onLeave}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Leave huddle"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Video Grid - only shown when someone has video on */}
                    {hasAnyVideo && (
                        <div className="p-3 border-b border-[#565856]/30">
                            <div className="grid grid-cols-2 gap-2">
                                {/* Local video */}
                                {isVideoOn && localStream && (
                                    <div className="relative aspect-video bg-[#2e3136] rounded-lg overflow-hidden">
                                        <video
                                            ref={localVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover transform scale-x-[-1]"
                                        />
                                        <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-xs text-white">
                                            You
                                        </div>
                                        {isMuted && (
                                            <div className="absolute top-1 right-1 bg-red-500/80 p-1 rounded">
                                                <MicOff size={12} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Remote videos */}
                                {(() => {
                                    console.log('[HuddlePanel] Rendering remote videos, participants:', participants.map(p => ({ userId: p.userId, socketId: p.socketId, hasVideo: p.hasVideo, isCurrentUser: p.isCurrentUser })));
                                    console.log('[HuddlePanel] remoteStreams keys:', Object.keys(remoteStreams));
                                    return null;
                                })()}
                                {participants.filter(p => !p.isCurrentUser && p.hasVideo).map((participant) => {
                                    // Try to find stream by socketId first, then by any matching stream if only one remote participant
                                    let stream = remoteStreams[participant.socketId];
                                    if (!stream && Object.keys(remoteStreams).length > 0) {
                                        // Fallback: if there's only one remote stream and we have only one remote participant with video
                                        const remoteParticipantsWithVideo = participants.filter(p => !p.isCurrentUser && p.hasVideo);
                                        const remoteStreamKeys = Object.keys(remoteStreams);
                                        if (remoteParticipantsWithVideo.length === 1 && remoteStreamKeys.length === 1) {
                                            console.log('[HuddlePanel] Fallback: using first available stream');
                                            stream = remoteStreams[remoteStreamKeys[0]];
                                        }
                                    }
                                    console.log('[HuddlePanel] Participant', participant.username, 'socketId:', participant.socketId, 'stream:', stream ? 'exists' : 'missing', 'remoteStreams keys:', Object.keys(remoteStreams));
                                    return (
                                        <div key={participant.socketId} className="relative aspect-video bg-[#2e3136] rounded-lg overflow-hidden">
                                            {stream ? (
                                                <VideoElement stream={stream} />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <UserAvatar
                                                        user={{ username: participant.username, avatar_url: participant.avatarUrl }}
                                                        size="lg"
                                                    />
                                                </div>
                                            )}
                                            <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-xs text-white">
                                                {participant.username}
                                            </div>
                                            {participant.isMuted && (
                                                <div className="absolute top-1 right-1 bg-red-500/80 p-1 rounded">
                                                    <MicOff size={12} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Participants section header */}
                    <div className="px-4 py-2 border-b border-[#565856]/30">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            In this huddle — {totalCount}
                        </span>
                    </div>

                    {/* Participants List */}
                    <div className="flex-1 overflow-y-auto">
                        {participants.map((participant) => (
                            <div
                                key={participant.userId}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                                <div className="relative">
                                    <div className={`rounded-full transition-all ${participant.isSpeaking && !participant.isMuted ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[#1a1d21]' : ''}`}>
                                        <UserAvatar
                                            user={{
                                                username: participant.username,
                                                avatar_url: participant.avatarUrl
                                            }}
                                            size="md"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-white flex items-center gap-2">
                                        <span className="truncate">{participant.username}</span>
                                        {participant.isCurrentUser && (
                                            <span className="text-xs text-gray-500">(you)</span>
                                        )}
                                    </div>
                                    <div className="text-xs flex items-center gap-1.5 mt-0.5">
                                        {participant.isMuted ? (
                                            <span className="flex items-center gap-1 text-red-400">
                                                <MicOff size={12} />
                                                Muted
                                            </span>
                                        ) : participant.isSpeaking ? (
                                            <span className="flex items-center gap-1 text-green-500">
                                                <div className="flex items-center gap-0.5">
                                                    <div className="w-1 h-3 bg-green-500 rounded-full animate-pulse" />
                                                    <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                                                    <div className="w-1 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                                </div>
                                                Speaking
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-gray-500">
                                                <Mic size={12} />
                                                Listening
                                            </span>
                                        )}
                                        {participant.hasVideo && (
                                            <span className="flex items-center gap-1 text-blue-400 ml-2">
                                                <Video size={12} />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls Footer */}
                    <div className="p-4 border-t border-[#565856]/30 bg-[#1a1d21]">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMute}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isMuted
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                            </button>

                            <button
                                onClick={onToggleVideo}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isVideoOn
                                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isVideoOn ? 'Turn off video (V)' : 'Turn on video (V)'}
                            >
                                {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
                            </button>

                            <button
                                onClick={onLeave}
                                className="flex items-center justify-center gap-2 py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                <PhoneOff size={18} />
                                <span>Leave</span>
                            </button>
                        </div>

                        {/* Keyboard shortcut hint */}
                        <div className="mt-2 text-center">
                            <span className="text-xs text-gray-500">
                                Press <kbd className="px-1.5 py-0.5 bg-[#2e3136] rounded text-gray-400 font-mono text-xs">M</kbd> to toggle mute
                                {' · '}
                                <kbd className="px-1.5 py-0.5 bg-[#2e3136] rounded text-gray-400 font-mono text-xs">V</kbd> for video
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Connection status indicator */}
            {connectionStatus === 'connecting' && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-medium">
                    Connecting...
                </div>
            )}
        </div>
    );
}

// Helper component to render remote video streams
function VideoElement({ stream }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
        />
    );
}
