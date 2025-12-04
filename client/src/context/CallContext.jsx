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
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [remoteStreams, setRemoteStreams] = useState({});

    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);
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
                console.log(`[WebRTC] Negotiation needed for ${targetSocketId}, polite=${polite}`);
                makingOfferRef.current[targetSocketId] = true;
                await pc.setLocalDescription();
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
                pc.restartIce();
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
            console.log('[WebRTC] Received remote track from:', targetSocketId, 'kind:', event.track.kind);
            const stream = event.streams[0];

            if (stream) {
                // Create audio element for playback (audio tracks)
                if (event.track.kind === 'audio') {
                    createAudioElement(targetSocketId, stream);
                }

                // Store video stream for rendering
                if (event.track.kind === 'video') {
                    setRemoteStreams(prev => ({
                        ...prev,
                        [targetSocketId]: stream
                    }));

                    // Update participant video state
                    setParticipants(prev => prev.map(p =>
                        p.socketId === targetSocketId ? { ...p, hasVideo: true, stream } : p
                    ));
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
        if (!socket) return;

        const handleUserConnected = (userId, socketId, username) => {
            console.log('[CallContext] User connected:', { userId, socketId, username });

            if (!isInCall && !localStreamRef.current) {
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
        const handleExistingParticipants = (participants) => {
            console.log('[CallContext] Existing participants in room:', participants);

            if (!localStreamRef.current) {
                console.log('[CallContext] No local stream, ignoring existing-participants');
                return;
            }

            // Create peer connections to all existing participants
            // We are NOT the initiator - we wait for them to send us offers
            // Actually, we should be the initiator since we just joined
            for (const participant of participants) {
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
            console.log('[CallContext] Incoming call:', payload);
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
                console.log('[CallContext] Received offer from:', payload.caller);

                // Check if we already have a peer connection (renegotiation case)
                let pc = peersRef.current[payload.caller]?.peerConnection;
                const polite = peersRef.current[payload.caller]?.polite ?? true;

                if (!pc) {
                    // New connection - we're the polite peer (responder)
                    pc = createPeerConnection(payload.caller, false, null, null);
                    if (!pc) return;
                }

                // Perfect negotiation: handle "glare" (both sides sending offers)
                const offerCollision = makingOfferRef.current[payload.caller] ||
                    (pc.signalingState !== 'stable');

                ignoreOfferRef.current[payload.caller] = !polite && offerCollision;

                if (ignoreOfferRef.current[payload.caller]) {
                    console.log('[CallContext] Ignoring colliding offer (impolite peer)');
                    return;
                }

                // If we have a collision and we're polite, rollback our offer
                if (offerCollision && polite) {
                    console.log('[CallContext] Rolling back our offer (polite peer)');
                    await Promise.all([
                        pc.setLocalDescription({ type: 'rollback' }),
                        pc.setRemoteDescription(payload.sdp)
                    ]);
                } else {
                    await pc.setRemoteDescription(payload.sdp);
                }

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

        const handleVideoUpdate = ({ userId: odId, isVideoOn: videoState }) => {
            setParticipants(prev => prev.map(p =>
                p.userId === odId ? { ...p, hasVideo: videoState } : p
            ));
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
        };
    }, [isInCall, createPeerConnection, cleanupAudioElement]);

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

    const joinCall = async (channelId) => {
        const socket = getSocket();
        if (!socket) {
            alert('Not connected. Please refresh the page.');
            return;
        }

        if (isInCall) {
            alert('Already in a call. Leave current call first.');
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            alert('Audio is not supported. Please use HTTPS.');
            return;
        }

        try {
            setConnectionStatus('connecting');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsInCall(true);
            setActiveChannelId(channelId);
            setConnectionStatus('connected');

            // Setup speaking detection
            setupSpeakingDetection(stream);

            // Add current user to participants
            setParticipants([{
                userId: user.id,
                socketId: socket.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                isMuted: false,
                isSpeaking: false,
                isCurrentUser: true
            }]);

            // Join the call room
            socket.emit('join-room', `call_${channelId}`, user.id);

            console.log('[CallContext] Joined huddle in channel:', channelId);
        } catch (err) {
            console.error('[CallContext] Failed to join call:', err);
            setConnectionStatus('disconnected');

            if (err.name === 'NotAllowedError') {
                alert('Microphone access denied. Please allow microphone permissions.');
            } else if (err.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone.');
            } else {
                alert('Could not access microphone: ' + err.message);
            }
        }
    };

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

        // Reset state
        setIsInCall(false);
        setActiveChannelId(null);
        setIsMuted(false);
        setIsVideoOn(false);
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

                // Add video track to all peer connections
                // onnegotiationneeded will fire automatically and handle renegotiation
                const peerSocketIds = Object.keys(peersRef.current);
                for (const socketId of peerSocketIds) {
                    const peer = peersRef.current[socketId];
                    if (peer?.peerConnection && localStreamRef.current) {
                        peer.peerConnection.addTrack(videoTrack, localStreamRef.current);
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

                // Remove video track from all peer connections
                // onnegotiationneeded will fire automatically and handle renegotiation
                const peerSocketIds = Object.keys(peersRef.current);
                for (const socketId of peerSocketIds) {
                    const peer = peersRef.current[socketId];
                    if (peer?.peerConnection) {
                        const senders = peer.peerConnection.getSenders();
                        const videoSender = senders.find(s => s.track?.kind === 'video');
                        if (videoSender) {
                            peer.peerConnection.removeTrack(videoSender);
                        }
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

    const clearIncomingCall = useCallback(() => {
        setIncomingCall(null);
    }, []);

    const acceptIncomingCall = useCallback(async (channelId) => {
        clearIncomingCall();
        await joinCall(channelId);
    }, [clearIncomingCall]);

    const declineIncomingCall = useCallback(() => {
        clearIncomingCall();
    }, [clearIncomingCall]);

    return (
        <CallContext.Provider value={{
            isInCall,
            localStream,
            peers,
            joinCall,
            leaveCall,
            toggleMute,
            isMuted,
            toggleVideo,
            isVideoOn,
            remoteStreams,
            activeChannelId,
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
