import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ChevronUp, ChevronDown, PhoneOff, Headphones, Monitor, MonitorOff, Maximize2, Minimize2, X } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function HuddlePanel({
    channelId,
    channelName,
    channelType,
    isInCall,
    isMuted,
    isVideoOn,
    isScreenSharing,
    onToggleMute,
    onToggleVideo,
    onToggleScreenShare,
    onLeave,
    participants = [],
    localStream,
    localScreenStream,
    remoteStreams = {},
    connectionStatus = 'connected'
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pinnedVideo, setPinnedVideo] = useState(null); // { type: 'local' | 'remote', participantId?, socketId? }
    const [callDuration, setCallDuration] = useState(0);
    const localVideoRef = useRef(null);
    const localScreenRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const panelRef = useRef(null);

    // Attach local video stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream && isVideoOn) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoOn]);

    // Attach local screen stream to video element
    useEffect(() => {
        if (localScreenRef.current && localScreenStream && isScreenSharing) {
            localScreenRef.current.srcObject = localScreenStream;
        }
    }, [localScreenStream, isScreenSharing]);

    // Check if anyone has video or screen share on
    const hasAnyVideo = isVideoOn || isScreenSharing || participants.some(p => !p.isCurrentUser && (p.hasVideo || p.isScreenSharing)) ||
        Object.values(remoteStreams).some(streams => streams?.video || streams?.screen);

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

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev);
        if (!isExpanded) setIsExpanded(true);
    };

    // Pin/unpin video
    const handlePinVideo = (type, participantId = null, socketId = null) => {
        if (pinnedVideo && pinnedVideo.type === type && pinnedVideo.participantId === participantId) {
            setPinnedVideo(null);
        } else {
            setPinnedVideo({ type, participantId, socketId });
        }
    };

    if (!isInCall) return null;

    const currentUser = participants.find(p => p.isCurrentUser);
    const otherParticipants = participants.filter(p => !p.isCurrentUser);
    const totalCount = participants.length;

    return (
        <div
            ref={panelRef}
            className={`fixed z-50 font-sans transition-all duration-300 ${
                isFullscreen
                    ? 'inset-0 bottom-0 right-0'
                    : 'bottom-5 right-5'
            }`}
        >
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
                                title={isMuted ? 'Unmute' : 'Mute'}
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
                                title={isVideoOn ? 'Turn off video' : 'Turn on video'}
                            >
                                {isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
                            </button>

                            <button
                                onClick={onToggleScreenShare}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isScreenSharing
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                            >
                                {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
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
                    className={`bg-[#1a1d21] text-white shadow-2xl border border-[#565856]/30 overflow-hidden flex flex-col ${
                        isFullscreen ? 'w-full h-full rounded-none' : 'rounded-xl'
                    }`}
                    style={isFullscreen ? {} : { width: hasAnyVideo ? '500px' : '340px', maxHeight: hasAnyVideo ? '600px' : '480px' }}
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
                                onClick={toggleFullscreen}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            >
                                {isFullscreen ? (
                                    <Minimize2 size={16} className="text-gray-400" />
                                ) : (
                                    <Maximize2 size={16} className="text-gray-400" />
                                )}
                            </button>
                            {!isFullscreen && (
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Minimize"
                                >
                                    <ChevronDown size={16} className="text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Video Grid - only shown when someone has video on */}
                    {hasAnyVideo && (
                        <div className={`p-3 border-b border-[#565856]/30 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
                            {/* Pinned video overlay */}
                            {pinnedVideo && (
                                <div className="absolute inset-0 z-10 bg-black/95 flex flex-col">
                                    <div className="flex-1 relative flex items-center justify-center p-4">
                                        {pinnedVideo.type === 'local' && localStream && (
                                            <video
                                                ref={localVideoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="max-w-full max-h-full object-contain transform scale-x-[-1]"
                                            />
                                        )}
                                        {pinnedVideo.type === 'local-screen' && localScreenStream && (
                                            <video
                                                ref={localScreenRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        )}
                                        {pinnedVideo.type === 'remote' && (() => {
                                            const participant = participants.find(p => p.socketId === pinnedVideo.socketId);
                                            const participantStreams = remoteStreams[pinnedVideo.socketId] || {};
                                            const stream = participantStreams.video || (participant && participant.stream);
                                            return stream ? (
                                                <VideoElement stream={stream} className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <div className="text-gray-400">No video stream</div>
                                            );
                                        })()}
                                        {pinnedVideo.type === 'remote-screen' && (() => {
                                            const participantStreams = remoteStreams[pinnedVideo.socketId] || {};
                                            const stream = participantStreams.screen;
                                            return stream ? (
                                                <VideoElement stream={stream} className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <div className="text-gray-400">No screen share stream</div>
                                            );
                                        })()}
                                        <div className="absolute bottom-4 left-4 bg-black/60 px-2 py-1 rounded text-sm text-white flex items-center gap-1">
                                            {(pinnedVideo.type === 'local-screen' || pinnedVideo.type === 'remote-screen') && <Monitor size={14} />}
                                            {pinnedVideo.type === 'local' ? 'You' :
                                             pinnedVideo.type === 'local-screen' ? 'Your screen' :
                                             pinnedVideo.type === 'remote-screen' ? `${participants.find(p => p.socketId === pinnedVideo.socketId)?.username || 'Unknown'}'s screen` :
                                             participants.find(p => p.socketId === pinnedVideo.socketId)?.username || 'Unknown'}
                                        </div>
                                        <button
                                            onClick={() => setPinnedVideo(null)}
                                            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                                            title="Unpin (Esc)"
                                        >
                                            <X size={20} className="text-white" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className={`grid gap-2 ${isFullscreen ? 'grid-cols-3 flex-1' : 'grid-cols-2'}`}>
                                {/* Local video */}
                                {isVideoOn && localStream && (
                                    <div
                                        className={`relative bg-[#2e3136] rounded-lg overflow-hidden cursor-pointer group ${isFullscreen ? 'aspect-video' : 'aspect-video'}`}
                                        onClick={() => handlePinVideo('local')}
                                    >
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
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Maximize2 size={24} className="text-white" />
                                        </div>
                                    </div>
                                )}
                                {/* Local screen share preview */}
                                {isScreenSharing && localScreenStream && (
                                    <div
                                        className={`relative bg-[#2e3136] rounded-lg overflow-hidden cursor-pointer group ${isFullscreen ? 'aspect-video' : 'aspect-video'}`}
                                        onClick={() => handlePinVideo('local-screen')}
                                    >
                                        <video
                                            ref={localScreenRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-xs text-white flex items-center gap-1">
                                            <Monitor size={10} />
                                            Your screen
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Maximize2 size={24} className="text-white" />
                                        </div>
                                    </div>
                                )}
                                {/* Remote videos - show camera video for each participant */}
                                {participants.filter(p => !p.isCurrentUser).map((participant) => {
                                    // Get streams for this participant (new structure: { video: stream, screen: stream })
                                    const participantStreams = remoteStreams[participant.socketId] || {};
                                    const videoStream = participantStreams.video || participant.stream;

                                    // Only render if they have video
                                    if (!videoStream && !participant.hasVideo) return null;

                                    return (
                                        <div
                                            key={`video-${participant.socketId}`}
                                            className={`relative bg-[#2e3136] rounded-lg overflow-hidden cursor-pointer group ${isFullscreen ? 'aspect-video' : 'aspect-video'}`}
                                            onClick={() => handlePinVideo('remote', participant.userId, participant.socketId)}
                                        >
                                            {videoStream ? (
                                                <VideoElement stream={videoStream} />
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
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Maximize2 size={24} className="text-white" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Remote screen shares - show screen share for each participant who is sharing */}
                                {participants.filter(p => !p.isCurrentUser).map((participant) => {
                                    // Get streams for this participant (new structure: { video: stream, screen: stream })
                                    const participantStreams = remoteStreams[participant.socketId] || {};
                                    const screenStream = participantStreams.screen;

                                    // Only render if they have screen share
                                    if (!screenStream && !participant.isScreenSharing) return null;

                                    return (
                                        <div
                                            key={`screen-${participant.socketId}`}
                                            className={`relative bg-[#2e3136] rounded-lg overflow-hidden cursor-pointer group ${isFullscreen ? 'aspect-video' : 'aspect-video'}`}
                                            onClick={() => handlePinVideo('remote-screen', participant.userId, participant.socketId)}
                                        >
                                            {screenStream ? (
                                                <VideoElement stream={screenStream} />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-400">
                                                    <Monitor size={32} />
                                                </div>
                                            )}
                                            <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-xs text-white flex items-center gap-1">
                                                <Monitor size={10} />
                                                {participant.username}'s screen
                                            </div>
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Maximize2 size={24} className="text-white" />
                                            </div>
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
                                        {participant.isScreenSharing && (
                                            <span className="flex items-center gap-1 text-green-400 ml-2">
                                                <Monitor size={12} />
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
                                title={isMuted ? 'Unmute' : 'Mute'}
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
                                title={isVideoOn ? 'Turn off video' : 'Turn on video'}
                            >
                                {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
                            </button>

                            <button
                                onClick={onToggleScreenShare}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-sm transition-all ${
                                    isScreenSharing
                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                                        : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                                }`}
                                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                            >
                                {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
                            </button>

                            <button
                                onClick={onLeave}
                                className="flex items-center justify-center gap-2 py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                <PhoneOff size={18} />
                                <span>Leave</span>
                            </button>
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
        const video = videoRef.current;
        if (video && stream) {
            const videoTracks = stream.getVideoTracks();
            console.log('[VideoElement] Setting stream with video tracks:', videoTracks.map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState,
                settings: t.getSettings()
            })));

            // Set srcObject
            video.srcObject = stream;

            // Force play after a small delay to ensure DOM is ready
            const playVideo = () => {
                video.play().then(() => {
                    console.log('[VideoElement] Video playing successfully');
                }).catch(err => {
                    console.warn('[VideoElement] Autoplay failed:', err.message);
                    // Try again with muted (browsers may require this)
                    video.muted = true;
                    video.play().catch(err2 => {
                        console.error('[VideoElement] Muted autoplay also failed:', err2.message);
                    });
                });
            };

            // Small delay to ensure stream is ready
            setTimeout(playVideo, 100);

            // Also try on loadedmetadata
            video.onloadedmetadata = playVideo;
        }
    }, [stream]);

    // Don't mute remote video - we want to hear them if audio is in the same stream
    // muted is only needed for LOCAL video to prevent echo
    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
        />
    );
}
