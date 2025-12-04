import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Headphones, ChevronUp, ChevronDown, Maximize2, Minimize2, X } from 'lucide-react';
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
        connectionStatus
    } = useCall();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [pinnedVideo, setPinnedVideo] = useState(null);
    const localVideoRef = useRef(null);
    const localScreenRef = useRef(null);

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

    // Check if anyone has video
    const hasAnyVideo = isVideoOn || isScreenSharing || participants.some(p => !p.isCurrentUser && (p.hasVideo || p.isScreenSharing)) ||
        Object.values(remoteStreams).some(streams => streams?.video || streams?.screen);

    // Auto-expand when video starts
    useEffect(() => {
        if (hasAnyVideo && !isExpanded) {
            setIsExpanded(true);
        }
    }, [hasAnyVideo]);

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

    // Fullscreen expanded view (rendered as portal)
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-[#1a1d21] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#565856]/30">
                    <div className="flex items-center gap-2">
                        <Headphones size={20} className="text-green-500" />
                        <div>
                            <div className="font-semibold text-white">Huddle</div>
                            <div className="text-xs text-gray-400">
                                {channelType === 'dm' ? '' : '#'}{channelName} · {formatDuration(callDuration)}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="p-2 hover:bg-white/10 rounded-lg"
                    >
                        <Minimize2 size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Video Grid */}
                {hasAnyVideo && (
                    <div className="flex-1 p-4 overflow-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full">
                            {/* Local video */}
                            {isVideoOn && localStream && (
                                <div className="relative bg-[#2e3136] rounded-lg overflow-hidden aspect-video">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover transform scale-x-[-1]"
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                                        You
                                    </div>
                                </div>
                            )}
                            {/* Local screen share */}
                            {isScreenSharing && localScreenStream && (
                                <div className="relative bg-[#2e3136] rounded-lg overflow-hidden aspect-video">
                                    <video
                                        ref={localScreenRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                                        <Monitor size={12} />
                                        Your screen
                                    </div>
                                </div>
                            )}
                            {/* Remote videos */}
                            {participants.filter(p => !p.isCurrentUser).map((participant) => {
                                const participantStreams = remoteStreams[participant.socketId] || {};
                                const videoStream = participantStreams.video || participant.stream;
                                if (!videoStream && !participant.hasVideo) return null;

                                return (
                                    <div key={`video-${participant.socketId}`} className="relative bg-[#2e3136] rounded-lg overflow-hidden aspect-video">
                                        {videoStream ? (
                                            <VideoElement stream={videoStream} />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <UserAvatar user={{ username: participant.username }} size="lg" />
                                            </div>
                                        )}
                                        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                                            {participant.username}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Participants list */}
                <div className="border-t border-[#565856]/30 max-h-48 overflow-y-auto">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
                        In this huddle — {totalCount}
                    </div>
                    {participants.map((participant) => (
                        <div key={participant.userId} className="flex items-center gap-3 px-4 py-2 hover:bg-white/5">
                            <UserAvatar user={{ username: participant.username, avatar_url: participant.avatarUrl }} size="sm" />
                            <span className="text-sm text-white">{participant.username}</span>
                            {participant.isCurrentUser && <span className="text-xs text-gray-500">(you)</span>}
                            {participant.isMuted && <MicOff size={14} className="text-red-400" />}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="p-4 border-t border-[#565856]/30 flex items-center justify-center gap-3">
                    <button
                        onClick={toggleMute}
                        className={`p-3 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'}`}
                    >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={`p-3 rounded-full ${isVideoOn ? 'bg-blue-500/20 text-blue-400' : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'}`}
                    >
                        {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    <button
                        onClick={toggleScreenShare}
                        className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-500/20 text-green-400' : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'}`}
                    >
                        {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
                    </button>
                    <button
                        onClick={leaveCall}
                        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white"
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
            </div>
        );
    }

    // Expanded view in sidebar
    if (isExpanded) {
        return (
            <div className="bg-[#1a1d21] border-t border-[#565856]/30">
                {/* Green indicator */}
                <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Headphones size={16} className="text-green-500" />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">Huddle</div>
                            <div className="text-xs text-gray-400">
                                {channelType === 'dm' ? '' : '#'}{channelName}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-green-500">{formatDuration(callDuration)}</span>
                        <button onClick={() => setIsFullscreen(true)} className="p-1 hover:bg-white/10 rounded">
                            <Maximize2 size={14} className="text-gray-400" />
                        </button>
                        <button onClick={() => setIsExpanded(false)} className="p-1 hover:bg-white/10 rounded">
                            <ChevronDown size={14} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Video preview if any */}
                {hasAnyVideo && (
                    <div className="px-3 pb-2">
                        <div className="grid grid-cols-2 gap-1">
                            {isVideoOn && localStream && (
                                <div className="relative bg-[#2e3136] rounded overflow-hidden aspect-video">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover transform scale-x-[-1]"
                                    />
                                    <div className="absolute bottom-0.5 left-0.5 bg-black/60 px-1 py-0.5 rounded text-[10px] text-white">
                                        You
                                    </div>
                                </div>
                            )}
                            {participants.filter(p => !p.isCurrentUser && p.hasVideo).slice(0, isVideoOn ? 1 : 2).map((participant) => {
                                const participantStreams = remoteStreams[participant.socketId] || {};
                                const videoStream = participantStreams.video || participant.stream;
                                return (
                                    <div key={participant.socketId} className="relative bg-[#2e3136] rounded overflow-hidden aspect-video">
                                        {videoStream ? (
                                            <VideoElement stream={videoStream} />
                                        ) : null}
                                        <div className="absolute bottom-0.5 left-0.5 bg-black/60 px-1 py-0.5 rounded text-[10px] text-white">
                                            {participant.username}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Participants */}
                <div className="px-3 pb-2">
                    <div className="flex items-center gap-1 flex-wrap">
                        {participants.slice(0, 4).map((participant, index) => (
                            <div key={participant.userId} className="relative" style={{ marginLeft: index > 0 ? '-6px' : '0', zIndex: 10 - index }}>
                                <div className={`rounded-full ${participant.isSpeaking && !participant.isMuted ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-[#1a1d21]' : ''}`}>
                                    <UserAvatar
                                        user={{ username: participant.username, avatar_url: participant.avatarUrl }}
                                        size="xs"
                                    />
                                </div>
                                {participant.isMuted && (
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-[#1a1d21] rounded-full p-0.5">
                                        <MicOff size={8} className="text-red-400" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {totalCount > 4 && (
                            <div className="w-6 h-6 rounded-full bg-[#2e3136] flex items-center justify-center text-[10px] text-gray-400" style={{ marginLeft: '-6px' }}>
                                +{totalCount - 4}
                            </div>
                        )}
                        <span className="text-xs text-gray-400 ml-2">{totalCount} {totalCount === 1 ? 'person' : 'people'}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="px-3 pb-3 flex items-center gap-1.5">
                    <button
                        onClick={toggleMute}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                            isMuted
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={`p-1.5 rounded transition-all ${
                            isVideoOn
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
                    </button>
                    <button
                        onClick={toggleScreenShare}
                        className={`p-1.5 rounded transition-all ${
                            isScreenSharing
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isScreenSharing ? <MonitorOff size={14} /> : <Monitor size={14} />}
                    </button>
                    <button
                        onClick={leaveCall}
                        className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                    >
                        Leave
                    </button>
                </div>

                {/* Connection status */}
                {connectionStatus === 'connecting' && (
                    <div className="px-3 pb-2 text-xs text-yellow-500 text-center">
                        Connecting...
                    </div>
                )}
            </div>
        );
    }

    // Minimized compact view
    return (
        <div className="bg-[#1a1d21] border-t border-[#565856]/30">
            {/* Green indicator */}
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

            <div className="px-3 py-2">
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Headphones size={14} className="text-green-500" />
                            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-white truncate max-w-[100px]">
                                {channelType === 'dm' ? '' : '#'}{channelName}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                <span className="text-green-500">{formatDuration(callDuration)}</span>
                                <span className="mx-1">·</span>
                                <span>{totalCount}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsExpanded(true)} className="p-1 hover:bg-white/10 rounded">
                        <ChevronUp size={14} className="text-gray-400" />
                    </button>
                </div>

                {/* Avatars */}
                <div className="flex items-center gap-1 mb-2">
                    {participants.slice(0, 4).map((participant, index) => (
                        <div key={participant.userId} className="relative" style={{ marginLeft: index > 0 ? '-4px' : '0', zIndex: 10 - index }}>
                            <UserAvatar
                                user={{ username: participant.username, avatar_url: participant.avatarUrl }}
                                size="xs"
                            />
                            {participant.isMuted && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-[#1a1d21] rounded-full p-0.5">
                                    <MicOff size={8} className="text-red-400" />
                                </div>
                            )}
                        </div>
                    ))}
                    {totalCount > 4 && (
                        <div className="w-5 h-5 rounded-full bg-[#2e3136] flex items-center justify-center text-[10px] text-gray-400" style={{ marginLeft: '-4px' }}>
                            +{totalCount - 4}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleMute}
                        className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs font-medium ${
                            isMuted
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                    </button>
                    <button
                        onClick={toggleVideo}
                        className={`p-1 rounded ${
                            isVideoOn
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-[#2e3136] text-white hover:bg-[#3e4147]'
                        }`}
                    >
                        {isVideoOn ? <Video size={12} /> : <VideoOff size={12} />}
                    </button>
                    <button
                        onClick={leaveCall}
                        className="py-1 px-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                    >
                        <PhoneOff size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper component for remote video
function VideoElement({ stream }) {
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
            className="w-full h-full object-cover"
        />
    );
}
