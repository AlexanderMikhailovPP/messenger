import { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Headphones, Maximize2, Minimize2 } from 'lucide-react';
import { useCall } from '../context/CallContext';
import UserAvatar from './UserAvatar';

export default function SidebarHuddle() {
    const {
        isInCall,
        isMuted,
        isVideoOn,
        isScreenSharing,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        leaveCall,
        participants,
        localStream,
        localScreenStream,
        remoteStreams,
        activeChannelInfo,
        connectionStatus,
        isHuddleFullscreen: isFullscreen,
        setHuddleFullscreen: setIsFullscreen,
        huddleStartedAt
    } = useCall();
    const [expandedTile, setExpandedTile] = useState(null); // { type: 'video' | 'screen', id: string }
    const [callDuration, setCallDuration] = useState(0);
    const localVideoRef = useRef(null);
    const localScreenRef = useRef(null);

    // Call duration timer - synced with server start time
    useEffect(() => {
        if (!isInCall) {
            setCallDuration(0);
            return;
        }

        const updateDuration = () => {
            if (huddleStartedAt) {
                // Calculate from server-synced start time
                const elapsed = Math.floor((Date.now() - huddleStartedAt) / 1000);
                setCallDuration(elapsed);
            } else {
                // Fallback: increment locally if server time not available
                setCallDuration(prev => prev + 1);
            }
        };

        // Initial update
        updateDuration();

        const timer = setInterval(updateDuration, 1000);

        return () => clearInterval(timer);
    }, [isInCall, huddleStartedAt]);

    // Attach local video stream
    useEffect(() => {
        if (localVideoRef.current && localStream && isVideoOn) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isVideoOn]);

    // Attach local screen stream
    useEffect(() => {
        if (localScreenRef.current && localScreenStream && isScreenSharing) {
            localScreenRef.current.srcObject = localScreenStream;
        }
    }, [localScreenStream, isScreenSharing]);

    // Format duration
    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isInCall) return null;

    const totalCount = participants.length;
    const channelName = activeChannelInfo?.displayName || activeChannelInfo?.name || 'Huddle';
    const channelType = activeChannelInfo?.type || 'channel';

    // Fullscreen view
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#1a1d21] flex flex-col">
                {/* Solid background to fully cover content underneath */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1d21] via-[#1e2328] to-[#252a30]" />
                {/* Subtle colored overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-emerald-900/10 pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Headphones size={24} className="text-green-500" />
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <div className="text-lg font-semibold text-white">Huddle</div>
                            <div className="text-sm text-gray-400">
                                {channelType === 'dm' ? '' : '#'}{channelName} · {formatDuration(callDuration)}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="p-2.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Minimize2 size={22} className="text-gray-400" />
                    </button>
                </div>

                {/* Participants Grid */}
                <div className="relative flex-1 flex items-center justify-center p-8 overflow-auto">
                    {(() => {
                        // Collect all screen shares
                        const screenShares = [];
                        if (isScreenSharing && localScreenStream) {
                            screenShares.push({ isLocal: true, stream: localScreenStream, username: 'You', id: 'local-screen' });
                        }
                        // Check for remote screen shares
                        participants.forEach(p => {
                            if (!p.isCurrentUser) {
                                const streams = remoteStreams[p.socketId] || {};
                                if (streams.screen) {
                                    screenShares.push({ isLocal: false, stream: streams.screen, username: p.username, id: `screen-${p.socketId}` });
                                }
                            }
                        });

                        // Check if there's an expanded tile
                        if (expandedTile) {
                            // Find the expanded content
                            let expandedContent = null;
                            let expandedLabel = '';

                            if (expandedTile.type === 'video') {
                                const participant = participants.find(p =>
                                    expandedTile.id === (p.isCurrentUser ? 'local-video' : `video-${p.socketId}`)
                                );
                                if (participant) {
                                    const participantStreams = remoteStreams[participant.socketId] || {};
                                    const videoStream = participant.isCurrentUser
                                        ? (isVideoOn ? localStream : null)
                                        : (participantStreams.video || participant.stream);
                                    expandedContent = videoStream ? (
                                        <ParticipantVideo stream={videoStream} isLocal={participant.isCurrentUser} />
                                    ) : null;
                                    expandedLabel = `${participant.username}${participant.isCurrentUser ? ' (you)' : ''}`;
                                }
                            } else if (expandedTile.type === 'screen') {
                                const share = screenShares.find(s => s.id === expandedTile.id);
                                if (share) {
                                    expandedContent = (
                                        <ScreenShareVideo
                                            stream={share.stream}
                                            isLocal={share.isLocal}
                                            localScreenRef={share.isLocal ? localScreenRef : null}
                                        />
                                    );
                                    expandedLabel = `${share.username}'s screen`;
                                }
                            }

                            if (expandedContent) {
                                return (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black">
                                            {expandedContent}
                                            <button
                                                onClick={() => setExpandedTile(null)}
                                                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                                                title="Exit fullscreen"
                                            >
                                                <Minimize2 size={20} className="text-white" />
                                            </button>
                                            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 rounded-lg">
                                                <span className="text-white font-medium">{expandedLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        }

                        // Total items = participants + screen shares
                        const totalItems = participants.length + screenShares.length;

                        // Calculate grid columns based on total items
                        const gridCols = totalItems === 1 ? 'grid-cols-1' :
                            totalItems === 2 ? 'grid-cols-2' :
                            totalItems <= 4 ? 'grid-cols-2' :
                            totalItems <= 6 ? 'grid-cols-3' :
                            'grid-cols-4';

                        // Avatar sizes: 2x bigger, based on total items
                        const avatarSize = totalItems <= 2 ? 320 : totalItems <= 4 ? 240 : 200;

                        return (
                            <div className={`grid gap-6 ${gridCols} max-w-6xl`}>
                                {/* Render participants */}
                                {participants.map((participant) => {
                                    const participantStreams = remoteStreams[participant.socketId] || {};
                                    const videoStream = participant.isCurrentUser
                                        ? (isVideoOn ? localStream : null)
                                        : (participantStreams.video || participant.stream);
                                    const hasVideo = participant.isCurrentUser ? isVideoOn : (participant.hasVideo && videoStream);
                                    const tileId = participant.isCurrentUser ? 'local-video' : `video-${participant.socketId}`;

                                    return (
                                        <div
                                            key={participant.userId}
                                            className="relative flex flex-col items-center group"
                                        >
                                            {/* Avatar/Video container - square with rounded corners */}
                                            <div
                                                className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${
                                                    participant.isSpeaking && !participant.isMuted
                                                        ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-[#1a1d21]'
                                                        : ''
                                                }`}
                                                style={{
                                                    width: `${avatarSize}px`,
                                                    height: `${avatarSize}px`
                                                }}
                                            >
                                                {hasVideo && videoStream ? (
                                                    <>
                                                        <ParticipantVideo
                                                            stream={videoStream}
                                                            isLocal={participant.isCurrentUser}
                                                        />
                                                        {/* Expand button for video */}
                                                        <button
                                                            onClick={() => setExpandedTile({ type: 'video', id: tileId })}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="Expand"
                                                        >
                                                            <Maximize2 size={16} className="text-white" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <HuddleAvatar
                                                        username={participant.username}
                                                        avatarUrl={participant.avatar_url}
                                                        fontSize={totalItems <= 2 ? 96 : totalItems <= 4 ? 72 : 56}
                                                    />
                                                )}
                                            </div>

                                            {/* Name and status */}
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="text-white font-medium text-base">
                                                    {participant.username}
                                                    {participant.isCurrentUser && <span className="text-gray-500 ml-1">(you)</span>}
                                                </span>
                                                {participant.isMuted && (
                                                    <div className="bg-red-500/20 p-1 rounded-full">
                                                        <MicOff size={14} className="text-red-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Render screen shares as separate grid items */}
                                {screenShares.map((share) => (
                                    <div
                                        key={share.id}
                                        className="relative flex flex-col items-center group"
                                    >
                                        <div
                                            className="relative rounded-2xl overflow-hidden bg-black border border-white/10"
                                            style={{
                                                width: `${avatarSize}px`,
                                                height: `${avatarSize}px`
                                            }}
                                        >
                                            <ScreenShareVideo
                                                stream={share.stream}
                                                isLocal={share.isLocal}
                                                localScreenRef={share.isLocal ? localScreenRef : null}
                                            />
                                            {/* Expand button for screen share */}
                                            <button
                                                onClick={() => setExpandedTile({ type: 'screen', id: share.id })}
                                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Expand"
                                            >
                                                <Maximize2 size={16} className="text-white" />
                                            </button>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <Monitor size={16} className="text-green-400" />
                                            <span className="text-white font-medium text-base">
                                                {share.username}'s screen
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Controls - at the bottom */}
                <div className="relative p-6 border-t border-white/10 bg-black/20">
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-full transition-all ${
                                isMuted
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={`p-4 rounded-full transition-all ${
                                isVideoOn
                                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                            title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                        >
                            {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
                        </button>
                        <button
                            onClick={toggleScreenShare}
                            className={`p-4 rounded-full transition-all ${
                                isScreenSharing
                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                        >
                            {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
                        </button>
                        <button
                            onClick={leaveCall}
                            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
                            title="Leave call"
                        >
                            <PhoneOff size={24} />
                        </button>
                    </div>

                    {/* Connection status */}
                    {connectionStatus === 'connecting' && (
                        <div className="mt-4 text-center text-sm text-yellow-500">
                            Connecting...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Normal sidebar view
    return (
        <div className="bg-[#1a1d21] border-t border-[#565856]/30">
            {/* Green indicator */}
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

            <div className="px-3 py-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Headphones size={18} className="text-green-500" />
                            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">Huddle</div>
                            <div className="text-xs text-gray-400">
                                <span className="text-green-500">{formatDuration(callDuration)}</span>
                                <span className="mx-1">·</span>
                                {channelType === 'dm' ? '' : '#'}{channelName}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFullscreen(true)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Fullscreen"
                    >
                        <Maximize2 size={16} className="text-gray-400" />
                    </button>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-3 mb-3">
                    {connectionStatus === 'connecting' ? (
                        /* Show loader while connecting */
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
                            <span className="text-xs text-gray-400">Connecting...</span>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center">
                                {[...participants].sort((a, b) => a.username.localeCompare(b.username)).slice(0, 5).map((participant, index) => {
                                    const participantStreams = remoteStreams[participant.socketId] || {};
                                    const videoStream = participant.isCurrentUser
                                        ? (isVideoOn ? localStream : null)
                                        : (participantStreams.video || participant.stream);
                                    const hasVideo = participant.isCurrentUser ? isVideoOn : (participant.hasVideo && videoStream);

                                    return (
                                        <div
                                            key={participant.userId}
                                            className="relative"
                                            style={{ marginLeft: index > 0 ? '-6px' : '0', zIndex: 10 - index }}
                                        >
                                            {/* Outer container with background for border effect */}
                                            <div className="w-8 h-8 rounded-lg bg-[#1a1d21] p-px">
                                                <div className="w-full h-full rounded-md overflow-hidden">
                                                    {hasVideo && videoStream ? (
                                                        <ParticipantVideo
                                                            stream={videoStream}
                                                            isLocal={participant.isCurrentUser}
                                                            small
                                                        />
                                                    ) : (
                                                        <UserAvatar
                                                            user={{ username: participant.username, avatar_url: participant.avatar_url }}
                                                            size="sm"
                                                            rounded="rounded-md"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            {participant.isMuted && (
                                                <div className="absolute -bottom-0.5 -right-0.5 bg-[#1a1d21] rounded-full p-0.5">
                                                    <MicOff size={8} className="text-red-400" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {totalCount > 5 && (
                                    <div
                                        className="w-8 h-8 rounded-lg bg-[#1a1d21] p-px"
                                        style={{ marginLeft: '-6px' }}
                                    >
                                        <div className="w-full h-full rounded-md bg-[#2e3136] flex items-center justify-center text-xs text-gray-400">
                                            +{totalCount - 5}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-gray-400">
                                {totalCount} {totalCount === 1 ? 'person' : 'people'}
                            </span>
                        </>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMute}
                        className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all ${
                            isMuted
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                            isVideoOn
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                        title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                    >
                        {isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
                    </button>
                    <button
                        onClick={toggleScreenShare}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                            isScreenSharing
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    >
                        {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
                    </button>
                    <button
                        onClick={leaveCall}
                        className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                        Leave
                    </button>
                </div>

                {/* Connection status */}
                {connectionStatus === 'connecting' && (
                    <div className="mt-2 text-xs text-yellow-500 text-center">
                        Connecting...
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper component for participant video
function ParticipantVideo({ stream, isLocal, small }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''}`}
        />
    );
}

// Helper component for screen share video
function ScreenShareVideo({ stream, isLocal, localScreenRef }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const ref = localScreenRef || videoRef;
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => {});
        }
    }, [stream, localScreenRef]);

    return (
        <video
            ref={localScreenRef || videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
        />
    );
}

// Avatar colors for consistency
const AVATAR_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500',
];

// Helper component for huddle avatar with dynamic sizing
function HuddleAvatar({ username, avatarUrl, fontSize }) {
    const colorClass = useMemo(() => {
        if (!username) return 'bg-gray-500';
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }, [username]);

    const initial = username?.[0]?.toUpperCase() || '?';

    if (avatarUrl) {
        return (
            <div className="w-full h-full">
                <img
                    src={avatarUrl}
                    alt={username}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
                <div
                    className={`w-full h-full items-center justify-center hidden ${colorClass}`}
                    style={{ fontSize: `${fontSize}px` }}
                >
                    <span className="font-semibold text-white">{initial}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`w-full h-full flex items-center justify-center ${colorClass}`}
        >
            <span
                className="font-semibold text-white"
                style={{ fontSize: `${fontSize}px` }}
            >
                {initial}
            </span>
        </div>
    );
}
