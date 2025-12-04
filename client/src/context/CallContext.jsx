import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

// Ringtone generator using Web Audio API
const createRingtone = () => {
    let audioContext = null;
    let oscillator = null;
    let gainNode = null;
    let isPlaying = false;
    let intervalId = null;

    const playTone = () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create oscillator for ringtone
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Pleasant ring tone (two-tone pattern like phone)
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.setValueAtTime(480, audioContext.currentTime + 0.15); // B4 slightly

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };

    return {
        start: () => {
            if (isPlaying) return;
            isPlaying = true;
            playTone();
            // Ring pattern: play, pause, play, pause...
            intervalId = setInterval(() => {
                if (isPlaying) playTone();
            }, 1500);
        },
        stop: () => {
            isPlaying = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            if (oscillator) {
                try { oscillator.stop(); } catch {}
                oscillator = null;
            }
        }
    };
};

// Free TURN servers (for production, consider using your own or a paid service)
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Free TURN servers from Open Relay Project
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

// Audio analysis settings
const SPEAKING_THRESHOLD = 0.01;
const SPEAKING_CHECK_INTERVAL = 100;

export const CallProvider = ({ children }) => {
    const { user } = useAuth();
    const [isInCall, setIsInCall] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [localScreenStream, setLocalScreenStream] = useState(null); // Separate stream for screen share preview
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [activeChannelInfo, setActiveChannelInfo] = useState(null); // { name, displayName, type }
    const [incomingCall, setIncomingCall] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [remoteStreams, setRemoteStreams] = useState({});

    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const screenShareTrackRef = useRef(null);
    const screenStreamRef = useRef(null); // Store screen stream for cleanup
    const videoSendersRef = useRef({}); // socketId -> RTCRtpSender for camera video
    const screenSendersRef = useRef({}); // socketId -> RTCRtpSender for screen share
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const speakingIntervalRef = useRef(null);
    const audioElementsRef = useRef({});
    const videoElementsRef = useRef({});
    const pendingCandidatesRef = useRef({}); // Queue for ICE candidates before remote description
    const makingOfferRef = useRef({}); // Track if we're currently making an offer
    const ignoreOfferRef = useRef({}); // For polite peer handling
    const ringtoneRef = useRef(null); // Ringtone instance

    // Cleanup function for audio elements
    const cleanupAudioElement = useCallback((socketId) => {
        if (audioElementsRef.current[socketId]) {
            audioElementsRef.current[socketId].srcObject = null;
            audioElementsRef.current[socketId].remove();
            delete audioElementsRef.current[socketId];
        }
    }, []);

    // Create audio element for peer stream
    const createAudioElement = useCallback((socketId, stream) => {
        cleanupAudioElement(socketId);

        const audio = document.createElement('audio');
        audio.id = `audio-${socketId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.srcObject = stream;
        document.body.appendChild(audio);
        audioElementsRef.current[socketId] = audio;

        // Play audio (needed for some browsers)
        audio.play().catch(err => {
            console.warn('Audio autoplay blocked:', err);
        });
    }, [cleanupAudioElement]);

    // Speaking detection setup
    const setupSpeakingDetection = useCallback((stream) => {
        if (!stream) return;

        try {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            source.connect(analyserRef.current);

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

            speakingIntervalRef.current = setInterval(() => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const isSpeaking = average > SPEAKING_THRESHOLD * 255;

                setParticipants(prev => prev.map(p =>
                    p.isCurrentUser ? { ...p, isSpeaking } : p
                ));
            }, SPEAKING_CHECK_INTERVAL);
        } catch (err) {
            console.error('Failed to setup speaking detection:', err);
        }
    }, []);

    // Cleanup speaking detection
    const cleanupSpeakingDetection = useCallback(() => {
        if (speakingIntervalRef.current) {
            clearInterval(speakingIntervalRef.current);
            speakingIntervalRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;
    }, []);

    // Create peer connection with proper error handling and perfect negotiation
    const createPeerConnection = useCallback((targetSocketId, isInitiator, targetUserId, targetUsername) => {
        const socket = getSocket();
        if (!socket) return null;

        // Determine polite peer - the one who joined later (non-initiator) is polite
        // Polite peer will rollback their offer if they receive an offer while making one
        const polite = !isInitiator;

        // Close existing connection if any
        if (peersRef.current[targetSocketId]?.peerConnection) {
            peersRef.current[targetSocketId].peerConnection.close();
        }

        // Initialize pending candidates queue
        pendingCandidatesRef.current[targetSocketId] = [];
        makingOfferRef.current[targetSocketId] = false;
        ignoreOfferRef.current[targetSocketId] = false;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Handle negotiation needed - perfect negotiation pattern
        pc.onnegotiationneeded = async () => {
            try {
                console.log(`[WebRTC] Negotiation needed for ${targetSocketId}, polite=${polite}, signalingState=${pc.signalingState}`);
                console.log(`[WebRTC] Local tracks:`, localStreamRef.current?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));
                makingOfferRef.current[targetSocketId] = true;
                await pc.setLocalDescription();
                console.log(`[WebRTC] Sending offer to ${targetSocketId}, sdp type:`, pc.localDescription?.type);
                socket.emit('offer', {
                    target: targetSocketId,
                    caller: socket.id,
                    sdp: pc.localDescription
                });
            } catch (err) {
                console.error('[WebRTC] Error in negotiationneeded:', err);
            } finally {
                makingOfferRef.current[targetSocketId] = false;
            }
        };

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state (${targetSocketId}):`, pc.connectionState);
            if (pc.connectionState === 'failed') {
                console.log('[WebRTC] Connection failed, restarting ICE...');
                pc.restartIce();
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state (${targetSocketId}):`, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.log('[WebRTC] ICE failed, restarting...');
                pc.restartIce();
            } else if (pc.iceConnectionState === 'disconnected') {
                // Give it some time to recover before restarting
                console.log('[WebRTC] ICE disconnected, waiting for recovery...');
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                        console.log('[WebRTC] ICE still disconnected/failed after timeout, restarting...');
                        pc.restartIce();
                    }
                }, 5000); // Wait 5 seconds before restarting
            }
        };

        pc.onicegatheringstatechange = () => {
            console.log(`[WebRTC] ICE gathering state (${targetSocketId}):`, pc.iceGatheringState);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    target: targetSocketId,
                    candidate: event.candidate,
                    caller: socket.id
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('[WebRTC] =================== ONTRACK EVENT ===================');
            console.log('[WebRTC] Received remote track from:', targetSocketId, 'kind:', event.track.kind, 'stream:', event.streams[0]?.id);
            let stream = event.streams[0];
            console.log('[WebRTC] Track enabled:', event.track.enabled, 'readyState:', event.track.readyState);
            console.log('[WebRTC] Stream tracks:', stream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
            console.log('[WebRTC] Event streams count:', event.streams.length);
            console.log('[WebRTC] Track id:', event.track.id);

            // If no stream provided (can happen with some browsers), create one from the track
            if (!stream && event.track) {
                console.log('[WebRTC] No stream in event, creating stream from track');
                stream = new MediaStream([event.track]);
            }

            if (stream) {
                // Create audio element for playback (audio tracks)
                if (event.track.kind === 'audio') {
                    createAudioElement(targetSocketId, stream);
                }

                // Store video stream for rendering - ALWAYS store it by socketId
                if (event.track.kind === 'video') {
                    console.log('[WebRTC] Setting remoteStream for socketId:', targetSocketId);
                    console.log('[WebRTC] Video track details - width:', event.track.getSettings().width, 'height:', event.track.getSettings().height);

                    // Store stream immediately
                    setRemoteStreams(prev => {
                        console.log('[WebRTC] Previous remoteStreams:', Object.keys(prev));
                        const newStreams = {
                            ...prev,
                            [targetSocketId]: stream
                        };
                        console.log('[WebRTC] New remoteStreams:', Object.keys(newStreams));
                        return newStreams;
                    });

                    // Update participant video state - find by socketId first, then try userId
                    setParticipants(prev => {
                        console.log('[WebRTC] Participants:', prev.map(p => ({ socketId: p.socketId, userId: p.userId, username: p.username })));

                        // Try to find participant by socketId
                        let found = prev.find(p => p.socketId === targetSocketId);

                        // If not found by socketId and we have userId, try by userId
                        if (!found && targetUserId) {
                            found = prev.find(p => p.userId === targetUserId);
                            if (found) {
                                console.log('[WebRTC] Found participant by userId, updating socketId from', found.socketId, 'to', targetSocketId);
                            }
                        }

                        console.log('[WebRTC] Found participant for socketId', targetSocketId, ':', found ? `yes (${found.username})` : 'NO');

                        if (!found) {
                            // Participant not yet in list - add them with video info
                            // Get peer info for username
                            const peerInfo = peersRef.current[targetSocketId];
                            const username = targetUsername || peerInfo?.username || 'Unknown';
                            const userId = targetUserId || peerInfo?.userId;
                            console.log('[WebRTC] Adding participant for incoming video track:', targetSocketId, username);
                            return [...prev, {
                                userId: userId,
                                socketId: targetSocketId,
                                username: username,
                                avatarUrl: null,
                                isMuted: false,
                                isSpeaking: false,
                                isCurrentUser: false,
                                hasVideo: true,
                                stream
                            }];
                        }

                        // Update existing participant - ensure socketId is correct
                        return prev.map(p => {
                            if (p.socketId === targetSocketId || (targetUserId && p.userId === targetUserId)) {
                                return { ...p, socketId: targetSocketId, hasVideo: true, stream };
                            }
                            return p;
                        });
                    });
                }

                setPeers(prev => ({
                    ...prev,
                    [targetSocketId]: {
                        ...prev[targetSocketId],
                        stream,
                        hasAudio: event.track.kind === 'audio' || prev[targetSocketId]?.hasAudio,
                        hasVideo: event.track.kind === 'video' || prev[targetSocketId]?.hasVideo
                    }
                }));
            }
        };

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        peersRef.current[targetSocketId] = {
            peerConnection: pc,
            userId: targetUserId,
            username: targetUsername,
            polite: polite
        };

        setPeers(prev => ({
            ...prev,
            [targetSocketId]: {
                peerConnection: pc,
                userId: targetUserId,
                username: targetUsername
            }
        }));

        return pc;
    }, [createAudioElement]);

    // Socket event handlers
    useEffect(() => {
        const socket = getSocket();
        if (!socket) {
            console.log('[CallContext] Socket not available yet');
            return;
        }
        console.log('[CallContext] Setting up socket handlers, socket id:', socket.id);

        const handleUserConnected = (userId, socketId, username) => {
            console.log('[CallContext] User connected:', { userId, socketId, username });

            // Only process if we're in a call
            if (!isInCall) {
                console.log('[CallContext] Not in call, ignoring user-connected');
                return;
            }

            // Create peer connection - we are the initiator since we were here first
            createPeerConnection(socketId, true, userId, username);

            setParticipants(prev => {
                if (prev.some(p => p.userId === userId)) return prev;
                return [...prev, {
                    userId,
                    socketId,
                    username,
                    avatarUrl: null,
                    isMuted: false,
                    isSpeaking: false,
                    isCurrentUser: false
                }];
            });
        };

        // Handle existing participants when joining a room
        const handleExistingParticipants = (existingParticipantsList) => {
            console.log('[CallContext] Existing participants in room:', existingParticipantsList);

            // Allow joining without local stream (listener mode) - only check if in call
            if (!isInCall) {
                console.log('[CallContext] Not in call, ignoring existing-participants');
                return;
            }

            // Create peer connections to all existing participants
            // We are NOT the initiator - we wait for them to send us offers
            // Actually, we should be the initiator since we just joined
            for (const participant of existingParticipantsList) {
                console.log('[CallContext] Creating peer connection to existing participant:', participant.username);

                createPeerConnection(participant.socketId, true, participant.userId, participant.username);

                setParticipants(prev => {
                    if (prev.some(p => p.userId === participant.userId)) return prev;
                    return [...prev, {
                        userId: participant.userId,
                        socketId: participant.socketId,
                        username: participant.username,
                        avatarUrl: null,
                        isMuted: false,
                        isSpeaking: false,
                        isCurrentUser: false
                    }];
                });
            }
        };

        const handleIncomingCall = (payload) => {
            console.log('[CallContext] Incoming call received!', payload);
            console.log('[CallContext] Current user:', user?.id, user?.username);
            setIncomingCall(payload);
        };

        const handleUserDisconnected = (userId, socketId) => {
            console.log('[CallContext] User disconnected:', { userId, socketId });

            // Cleanup peer connection
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].peerConnection.close();
                delete peersRef.current[socketId];
            }

            // Cleanup audio element
            cleanupAudioElement(socketId);

            // Remove remote stream
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[socketId];
                return newStreams;
            });

            setPeers(prev => {
                const newPeers = { ...prev };
                delete newPeers[socketId];
                return newPeers;
            });

            setParticipants(prev => prev.filter(p => p.userId !== userId));

            // Note: Don't auto-leave - user can stay in call alone waiting for others
        };

        const handleOffer = async (payload) => {
            try {
                console.log('[CallContext] =================== RECEIVED OFFER ===================');
                console.log('[CallContext] Received offer from:', payload.caller);
                console.log('[CallContext] SDP type:', payload.sdp?.type);
                console.log('[CallContext] SDP has video:', payload.sdp?.sdp?.includes('m=video'));

                // Check if we already have a peer connection (renegotiation case)
                let pc = peersRef.current[payload.caller]?.peerConnection;
                const isRenegotiation = !!pc;

                // Deterministic polite peer: compare socket IDs lexicographically
                // The peer with the "smaller" socket ID is always the polite one
                const polite = socket.id < payload.caller;

                console.log('[CallContext] isRenegotiation:', isRenegotiation, 'polite:', polite);
                console.log('[CallContext] My socket ID:', socket.id, 'Caller socket ID:', payload.caller);

                if (!pc) {
                    // New connection - we're the polite peer (responder)
                    pc = createPeerConnection(payload.caller, false, null, null);
                    if (!pc) return;
                }

                console.log('[CallContext] Current signalingState:', pc.signalingState);
                console.log('[CallContext] makingOffer:', makingOfferRef.current[payload.caller]);

                // Perfect negotiation: handle "glare" (both sides sending offers)
                // Only consider it a collision if we're actively making an offer
                const offerCollision = makingOfferRef.current[payload.caller] === true;

                console.log('[CallContext] offerCollision:', offerCollision);

                // For renegotiation (adding video), always accept the offer
                // Only ignore if we're ACTIVELY making our own offer at the same time
                ignoreOfferRef.current[payload.caller] = !polite && offerCollision;

                if (ignoreOfferRef.current[payload.caller]) {
                    console.log('[CallContext] Ignoring colliding offer (impolite peer making offer)');
                    return;
                }

                // Handle based on signaling state
                if (pc.signalingState === 'have-local-offer') {
                    // We already sent an offer - this is a "glare" situation
                    // Use rollback + setRemoteDescription in parallel (perfect negotiation)
                    if (polite) {
                        console.log('[CallContext] Glare detected, rolling back (polite peer)');
                        await pc.setLocalDescription({ type: 'rollback' });
                        await pc.setRemoteDescription(payload.sdp);
                    } else {
                        // Impolite peer ignores incoming offer during glare
                        console.log('[CallContext] Glare detected, ignoring offer (impolite peer)');
                        return;
                    }
                } else if (pc.signalingState === 'stable') {
                    // Normal case - just set remote description
                    await pc.setRemoteDescription(payload.sdp);
                } else {
                    // Other states (have-remote-offer, etc) - try to set remote description
                    console.log('[CallContext] Unusual state:', pc.signalingState, '- attempting setRemoteDescription');
                    try {
                        await pc.setRemoteDescription(payload.sdp);
                    } catch (e) {
                        console.error('[CallContext] Failed in unusual state, creating new peer connection');
                        // Recreate peer connection
                        pc.close();
                        pc = createPeerConnection(payload.caller, false, null, null);
                        if (!pc) return;
                        await pc.setRemoteDescription(payload.sdp);
                    }
                }

                console.log('[CallContext] After setRemoteDescription, transceivers:', pc.getTransceivers().map(t => ({
                    mid: t.mid,
                    direction: t.direction,
                    currentDirection: t.currentDirection,
                    kind: t.receiver?.track?.kind
                })));

                // Process any pending ICE candidates
                const pending = pendingCandidatesRef.current[payload.caller] || [];
                for (const candidate of pending) {
                    await pc.addIceCandidate(candidate);
                }
                pendingCandidatesRef.current[payload.caller] = [];

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('answer', {
                    target: payload.caller,
                    caller: socket.id,
                    sdp: pc.localDescription
                });

                console.log('[CallContext] Sent answer to:', payload.caller);
            } catch (err) {
                console.error('[CallContext] Error handling offer:', err);
            }
        };

        const handleAnswer = async (payload) => {
            try {
                console.log('[CallContext] Received answer from:', payload.caller);
                const peer = peersRef.current[payload.caller];
                if (peer?.peerConnection) {
                    await peer.peerConnection.setRemoteDescription(payload.sdp);

                    // Process any pending ICE candidates
                    const pending = pendingCandidatesRef.current[payload.caller] || [];
                    for (const candidate of pending) {
                        await peer.peerConnection.addIceCandidate(candidate);
                    }
                    pendingCandidatesRef.current[payload.caller] = [];
                }
            } catch (err) {
                console.error('[CallContext] Error handling answer:', err);
            }
        };

        const handleIceCandidate = async (payload) => {
            try {
                const peer = peersRef.current[payload.caller];
                if (!payload.candidate) return;

                // If we don't have remote description yet, queue the candidate
                if (!peer?.peerConnection || !peer.peerConnection.remoteDescription) {
                    console.log('[CallContext] Queueing ICE candidate for:', payload.caller);
                    if (!pendingCandidatesRef.current[payload.caller]) {
                        pendingCandidatesRef.current[payload.caller] = [];
                    }
                    pendingCandidatesRef.current[payload.caller].push(payload.candidate);
                    return;
                }

                await peer.peerConnection.addIceCandidate(payload.candidate);
            } catch (err) {
                // Ignore errors for candidates that arrive after connection is established
                if (err.name !== 'InvalidStateError') {
                    console.error('[CallContext] Error handling ICE candidate:', err);
                }
            }
        };

        const handleMuteUpdate = ({ userId: odId, isMuted: muteState }) => {
            setParticipants(prev => prev.map(p =>
                p.userId === odId ? { ...p, isMuted: muteState } : p
            ));
        };

        const handleVideoUpdate = ({ userId: odId, isVideoOn: videoState, socketId: senderSocketId }) => {
            console.log('[CallContext] Received video-update:', { userId: odId, isVideoOn: videoState, socketId: senderSocketId });
            setParticipants(prev => {
                console.log('[CallContext] Current participants:', prev.map(p => ({ userId: p.userId, socketId: p.socketId, hasVideo: p.hasVideo })));
                return prev.map(p => {
                    // Match by userId OR socketId
                    if (p.userId === odId || (senderSocketId && p.socketId === senderSocketId)) {
                        console.log('[CallContext] Updating hasVideo for participant:', p.username, 'to', videoState);
                        return { ...p, hasVideo: videoState };
                    }
                    return p;
                });
            });
        };

        socket.on('user-connected', handleUserConnected);
        socket.on('existing-participants', handleExistingParticipants);
        socket.on('incoming_call', handleIncomingCall);
        socket.on('user-disconnected', handleUserDisconnected);
        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('mute-update', handleMuteUpdate);
        socket.on('video-update', handleVideoUpdate);

        const handleScreenShareUpdate = ({ userId: odId, isScreenSharing: screenState, socketId: senderSocketId }) => {
            console.log('[CallContext] Received screen-share-update:', { userId: odId, isScreenSharing: screenState, socketId: senderSocketId });
            setParticipants(prev => prev.map(p => {
                if (p.userId === odId || (senderSocketId && p.socketId === senderSocketId)) {
                    console.log('[CallContext] Updating isScreenSharing for participant:', p.username, 'to', screenState);
                    return { ...p, isScreenSharing: screenState };
                }
                return p;
            }));
        };

        socket.on('screen-share-update', handleScreenShareUpdate);

        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('existing-participants', handleExistingParticipants);
            socket.off('incoming_call', handleIncomingCall);
            socket.off('user-disconnected', handleUserDisconnected);
            socket.off('offer', handleOffer);
            socket.off('answer', handleAnswer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('mute-update', handleMuteUpdate);
            socket.off('video-update', handleVideoUpdate);
            socket.off('screen-share-update', handleScreenShareUpdate);
        };
    }, [isInCall, createPeerConnection, cleanupAudioElement, user]);

    // Handle socket reconnection - rejoin call room if in a call
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleReconnect = () => {
            console.log('[CallContext] Socket reconnected');
            if (isInCall && activeChannelId && user) {
                console.log('[CallContext] Rejoining call room after reconnect:', activeChannelId);
                socket.emit('join-room', `call_${activeChannelId}`, user.id);
            }
        };

        const handleDisconnect = (reason) => {
            console.log('[CallContext] Socket disconnected:', reason);
            if (isInCall) {
                setConnectionStatus('connecting');
            }
        };

        const handleConnect = () => {
            if (isInCall) {
                setConnectionStatus('connected');
            }
        };

        socket.on('reconnect', handleReconnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect', handleConnect);

        return () => {
            socket.off('reconnect', handleReconnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect', handleConnect);
        };
    }, [isInCall, activeChannelId, user]);

    // Ringtone effect - play when incoming call and not in call
    useEffect(() => {
        if (incomingCall && !isInCall) {
            // Initialize ringtone if needed
            if (!ringtoneRef.current) {
                ringtoneRef.current = createRingtone();
            }
            ringtoneRef.current.start();
        } else {
            // Stop ringtone when call is answered/declined or when in call
            if (ringtoneRef.current) {
                ringtoneRef.current.stop();
            }
        }

        return () => {
            if (ringtoneRef.current) {
                ringtoneRef.current.stop();
            }
        };
    }, [incomingCall, isInCall]);

    const joinCall = useCallback(async (channelId, channelInfo = null) => {
        try {
            const socket = getSocket();
            if (!socket) {
                alert('Not connected. Please refresh the page.');
                return false;
            }

            if (!user) {
                console.error('[CallContext] joinCall: user is null');
                alert('Not authenticated. Please log in.');
                return false;
            }

            if (isInCall) {
                alert('Already in a call. Leave current call first.');
                return false;
            }

            setConnectionStatus('connecting');

            let stream = null;
            let microphoneError = null;

            // Try to get microphone, but don't fail if we can't
            if (navigator.mediaDevices?.getUserMedia) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: false
                    });
                } catch (err) {
                    console.warn('[CallContext] Microphone unavailable:', err?.message || err);
                    microphoneError = err;
                }
            }

            // Join call even without microphone
            if (stream) {
                localStreamRef.current = stream;
                setLocalStream(stream);
                setupSpeakingDetection(stream);
                setIsMuted(false);
            } else {
                // No microphone - join as muted listener
                localStreamRef.current = null;
                setLocalStream(null);
                setIsMuted(true);
            }

            setIsInCall(true);
            setActiveChannelId(channelId);
            setActiveChannelInfo(channelInfo);
            setConnectionStatus('connected');

            // Add current user to participants
            setParticipants([{
                userId: user.id,
                socketId: socket.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                isMuted: !stream, // Muted if no microphone
                isSpeaking: false,
                isCurrentUser: true
            }]);

            // Join the call room
            socket.emit('join-room', `call_${channelId}`, user.id);

            console.log('[CallContext] Joined huddle in channel:', channelId, stream ? '(with mic)' : '(without mic)');

            // Show warning about microphone after joining
            if (microphoneError) {
                setTimeout(() => {
                    if (microphoneError.name === 'NotAllowedError') {
                        alert('Microphone access denied. You joined as a listener. Allow microphone permissions and rejoin to speak.');
                    } else if (microphoneError.name === 'NotFoundError') {
                        alert('No microphone found. You joined as a listener.');
                    } else {
                        alert('Microphone unavailable. You joined as a listener.');
                    }
                }, 100);
            }

            return true;
        } catch (err) {
            console.error('[CallContext] Error joining call:', err);
            setConnectionStatus('disconnected');
            alert('Failed to join call. Please try again.');
            return false;
        }
    }, [user, isInCall]);

    const leaveCall = useCallback(() => {
        const socket = getSocket();
        console.log('[CallContext] Leaving call...');

        // Stop local stream (including video track)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);

        // Stop video track if exists
        if (localVideoRef.current) {
            localVideoRef.current.stop();
            localVideoRef.current = null;
        }

        // Stop screen share track if exists
        if (screenShareTrackRef.current) {
            screenShareTrackRef.current.stop();
            screenShareTrackRef.current = null;
        }
        screenStreamRef.current = null;
        setLocalScreenStream(null);

        // Cleanup speaking detection
        cleanupSpeakingDetection();

        // Close all peer connections
        Object.keys(peersRef.current).forEach(socketId => {
            if (peersRef.current[socketId]?.peerConnection) {
                peersRef.current[socketId].peerConnection.close();
            }
            cleanupAudioElement(socketId);
        });
        peersRef.current = {};
        setPeers({});

        // Clear sender refs
        videoSendersRef.current = {};
        screenSendersRef.current = {};

        // Reset state
        setIsInCall(false);
        setActiveChannelId(null);
        setActiveChannelInfo(null);
        setIsMuted(false);
        setIsVideoOn(false);
        setIsScreenSharing(false);
        setParticipants([]);
        setRemoteStreams({});
        setConnectionStatus('disconnected');

        // Notify server
        if (socket) {
            socket.emit('leave-room');
        }
    }, [cleanupSpeakingDetection, cleanupAudioElement]);

    const toggleMute = useCallback(() => {
        const socket = getSocket();

        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                // Toggle: if currently enabled (not muted), disable it (mute)
                const newMuteState = !isMuted;
                audioTrack.enabled = !newMuteState;
                setIsMuted(newMuteState);

                // Update local participant state
                setParticipants(prev => prev.map(p =>
                    p.isCurrentUser ? { ...p, isMuted: newMuteState } : p
                ));

                // Broadcast mute state to others
                if (socket && activeChannelId) {
                    socket.emit('mute-update', {
                        userId: user?.id,
                        isMuted: newMuteState,
                        channelId: activeChannelId
                    });
                }
            }
        }
    }, [activeChannelId, user?.id, isMuted]);

    const toggleVideo = useCallback(async () => {
        const socket = getSocket();

        if (!isVideoOn) {
            // Turn video ON
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    }
                });

                const videoTrack = videoStream.getVideoTracks()[0];

                // Add video track to local stream
                if (localStreamRef.current) {
                    localStreamRef.current.addTrack(videoTrack);
                }

                // Add video track to all peer connections and save senders
                const peerSocketIds = Object.keys(peersRef.current);
                console.log('[CallContext] Adding video track to peers:', peerSocketIds);
                for (const socketId of peerSocketIds) {
                    const peer = peersRef.current[socketId];
                    if (peer?.peerConnection && localStreamRef.current) {
                        const pc = peer.peerConnection;
                        console.log('[CallContext] Adding video track to peer:', socketId, 'signalingState:', pc.signalingState);
                        const sender = pc.addTrack(videoTrack, localStreamRef.current);
                        // Save sender reference for later removal
                        videoSendersRef.current[socketId] = sender;

                        // Manually trigger renegotiation
                        console.log('[CallContext] Manually triggering renegotiation for:', socketId);
                        (async () => {
                            try {
                                const offer = await pc.createOffer();
                                await pc.setLocalDescription(offer);
                                console.log('[CallContext] Sending video offer to:', socketId);
                                socket.emit('offer', {
                                    target: socketId,
                                    caller: socket.id,
                                    sdp: pc.localDescription
                                });
                            } catch (err) {
                                console.error('[CallContext] Failed to create video offer:', err);
                            }
                        })();
                    }
                }

                localVideoRef.current = videoTrack;
                setIsVideoOn(true);

                // Update local stream state to trigger re-render
                setLocalStream(localStreamRef.current);

                // Update local participant state
                setParticipants(prev => prev.map(p =>
                    p.isCurrentUser ? { ...p, hasVideo: true } : p
                ));

                // Broadcast video state to others
                if (socket && activeChannelId) {
                    console.log('[CallContext] Broadcasting video-update: true');
                    socket.emit('video-update', {
                        userId: user?.id,
                        isVideoOn: true,
                        channelId: activeChannelId
                    });
                }

                console.log('[CallContext] Video enabled for', peerSocketIds.length, 'peers');
            } catch (err) {
                console.error('[CallContext] Failed to enable video:', err);
                if (err.name === 'NotAllowedError') {
                    alert('Camera access denied. Please allow camera permissions.');
                } else if (err.name === 'NotFoundError') {
                    alert('No camera found.');
                } else {
                    alert('Could not access camera: ' + err.message);
                }
            }
        } else {
            // Turn video OFF
            if (localVideoRef.current) {
                localVideoRef.current.stop();

                // Remove video track from local stream
                if (localStreamRef.current) {
                    localStreamRef.current.removeTrack(localVideoRef.current);
                }

                // Remove video track from all peer connections using saved senders
                const peerSocketIds = Object.keys(peersRef.current);
                for (const socketId of peerSocketIds) {
                    const peer = peersRef.current[socketId];
                    const sender = videoSendersRef.current[socketId];
                    if (peer?.peerConnection && sender) {
                        try {
                            peer.peerConnection.removeTrack(sender);
                        } catch (err) {
                            console.warn('[CallContext] Error removing video sender:', err);
                        }
                        delete videoSendersRef.current[socketId];
                    }
                }

                localVideoRef.current = null;
                console.log('[CallContext] Video disabled for', peerSocketIds.length, 'peers');
            }

            setIsVideoOn(false);

            // Update local participant state
            setParticipants(prev => prev.map(p =>
                p.isCurrentUser ? { ...p, hasVideo: false } : p
            ));

            // Broadcast video state to others
            if (socket && activeChannelId) {
                socket.emit('video-update', {
                    userId: user?.id,
                    isVideoOn: false,
                    channelId: activeChannelId
                });
            }
        }
    }, [isVideoOn, activeChannelId, user?.id]);

    const toggleScreenShare = useCallback(async () => {
        const socket = getSocket();

        if (!isScreenSharing) {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                });

                const screenTrack = screenStream.getVideoTracks()[0];

                // Store the screen stream for local preview
                screenStreamRef.current = screenStream;
                setLocalScreenStream(screenStream);

                // Handle when user stops sharing via browser UI
                // Use a ref-based approach to avoid closure issues
                screenTrack.onended = () => {
                    console.log('[CallContext] Screen share ended by user');
                    // Call stopScreenShare directly using current state
                    if (screenShareTrackRef.current) {
                        screenShareTrackRef.current.stop();
                    }

                    // Remove screen track from all peer connections
                    const peerSocketIds = Object.keys(peersRef.current);
                    for (const socketId of peerSocketIds) {
                        const peer = peersRef.current[socketId];
                        const sender = screenSendersRef.current[socketId];
                        if (peer?.peerConnection && sender) {
                            try {
                                peer.peerConnection.removeTrack(sender);
                            } catch (err) {
                                console.warn('[CallContext] Error removing screen sender:', err);
                            }
                            delete screenSendersRef.current[socketId];
                        }
                    }

                    screenShareTrackRef.current = null;
                    screenStreamRef.current = null;
                    setLocalScreenStream(null);
                    setIsScreenSharing(false);

                    // Update local participant state
                    setParticipants(prev => prev.map(p =>
                        p.isCurrentUser ? { ...p, isScreenSharing: false } : p
                    ));

                    // Broadcast screen share state to others
                    const currentSocket = getSocket();
                    if (currentSocket && activeChannelId) {
                        currentSocket.emit('screen-share-update', {
                            userId: user?.id,
                            isScreenSharing: false,
                            channelId: activeChannelId
                        });
                    }

                    console.log('[CallContext] Screen sharing disabled via browser UI');
                };

                // Add screen track to all peer connections and save senders
                const peerSocketIds = Object.keys(peersRef.current);
                console.log('[CallContext] Adding screen track to peers:', peerSocketIds);
                for (const socketId of peerSocketIds) {
                    const peer = peersRef.current[socketId];
                    if (peer?.peerConnection) {
                        const pc = peer.peerConnection;
                        console.log('[CallContext] Adding screen track to peer:', socketId);
                        // Use the screen stream (not localStreamRef) so it stays separate from camera
                        const sender = pc.addTrack(screenTrack, screenStream);
                        // Save sender reference for later removal
                        screenSendersRef.current[socketId] = sender;

                        // Manually trigger renegotiation
                        (async () => {
                            try {
                                const offer = await pc.createOffer();
                                await pc.setLocalDescription(offer);
                                socket.emit('offer', {
                                    target: socketId,
                                    caller: socket.id,
                                    sdp: pc.localDescription
                                });
                            } catch (err) {
                                console.error('[CallContext] Failed to create screen share offer:', err);
                            }
                        })();
                    }
                }

                screenShareTrackRef.current = screenTrack;
                setIsScreenSharing(true);

                // Update local participant state
                setParticipants(prev => prev.map(p =>
                    p.isCurrentUser ? { ...p, isScreenSharing: true } : p
                ));

                // Broadcast screen share state to others
                if (socket && activeChannelId) {
                    socket.emit('screen-share-update', {
                        userId: user?.id,
                        isScreenSharing: true,
                        channelId: activeChannelId
                    });
                }

                console.log('[CallContext] Screen sharing enabled');
            } catch (err) {
                console.error('[CallContext] Failed to start screen sharing:', err);
                if (err.name !== 'NotAllowedError') {
                    alert('Could not start screen sharing: ' + err.message);
                }
            }
        } else {
            // Stop screen sharing
            stopScreenShare();
        }
    }, [isScreenSharing, activeChannelId, user?.id]);

    const stopScreenShare = useCallback(() => {
        const socket = getSocket();

        if (screenShareTrackRef.current) {
            screenShareTrackRef.current.stop();

            // Remove screen track from all peer connections using saved senders
            const peerSocketIds = Object.keys(peersRef.current);
            for (const socketId of peerSocketIds) {
                const peer = peersRef.current[socketId];
                const sender = screenSendersRef.current[socketId];
                if (peer?.peerConnection && sender) {
                    try {
                        peer.peerConnection.removeTrack(sender);
                    } catch (err) {
                        console.warn('[CallContext] Error removing screen sender:', err);
                    }
                    delete screenSendersRef.current[socketId];
                }
            }

            screenShareTrackRef.current = null;
        }

        // Clear screen stream for preview
        screenStreamRef.current = null;
        setLocalScreenStream(null);

        setIsScreenSharing(false);

        // Update local participant state
        setParticipants(prev => prev.map(p =>
            p.isCurrentUser ? { ...p, isScreenSharing: false } : p
        ));

        // Broadcast screen share state to others
        if (socket && activeChannelId) {
            socket.emit('screen-share-update', {
                userId: user?.id,
                isScreenSharing: false,
                channelId: activeChannelId
            });
        }

        console.log('[CallContext] Screen sharing disabled');
    }, [activeChannelId, user?.id]);

    const clearIncomingCall = useCallback(() => {
        setIncomingCall(null);
    }, []);

    const acceptIncomingCall = useCallback(async (channelId) => {
        clearIncomingCall();
        await joinCall(channelId);
    }, [clearIncomingCall, joinCall]);

    const declineIncomingCall = useCallback(() => {
        clearIncomingCall();
    }, [clearIncomingCall]);

    return (
        <CallContext.Provider value={{
            isInCall,
            localStream,
            localScreenStream,
            peers,
            joinCall,
            leaveCall,
            toggleMute,
            isMuted,
            toggleVideo,
            isVideoOn,
            toggleScreenShare,
            isScreenSharing,
            remoteStreams,
            activeChannelId,
            activeChannelInfo,
            incomingCall,
            clearIncomingCall,
            acceptIncomingCall,
            declineIncomingCall,
            participants,
            connectionStatus
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => useContext(CallContext);
