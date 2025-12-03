import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

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
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');

    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const speakingIntervalRef = useRef(null);
    const audioElementsRef = useRef({});

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

    // Create peer connection with proper error handling
    const createPeerConnection = useCallback((targetSocketId, isInitiator, targetUserId, targetUsername) => {
        const socket = getSocket();
        if (!socket) return null;

        // Close existing connection if any
        if (peersRef.current[targetSocketId]?.peerConnection) {
            peersRef.current[targetSocketId].peerConnection.close();
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state (${targetSocketId}):`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.log('[WebRTC] Connection lost, attempting reconnect...');
                // Could implement reconnection logic here
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state (${targetSocketId}):`, pc.iceConnectionState);
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
            console.log('[WebRTC] Received remote track from:', targetSocketId);
            const stream = event.streams[0];

            if (stream) {
                // Create audio element for playback
                createAudioElement(targetSocketId, stream);

                setPeers(prev => ({
                    ...prev,
                    [targetSocketId]: {
                        ...prev[targetSocketId],
                        stream,
                        hasAudio: true
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
            username: targetUsername
        };

        setPeers(prev => ({
            ...prev,
            [targetSocketId]: {
                peerConnection: pc,
                userId: targetUserId,
                username: targetUsername
            }
        }));

        // If initiator, create and send offer
        if (isInitiator) {
            (async () => {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('offer', {
                        target: targetSocketId,
                        caller: socket.id,
                        sdp: pc.localDescription
                    });
                } catch (err) {
                    console.error('[WebRTC] Error creating offer:', err);
                }
            })();
        }

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

            setPeers(prev => {
                const newPeers = { ...prev };
                delete newPeers[socketId];
                return newPeers;
            });

            setParticipants(prev => {
                const updated = prev.filter(p => p.userId !== userId);

                // Auto-leave if only current user remains
                if (updated.length === 1 && updated[0].isCurrentUser) {
                    console.log('[CallContext] Last participant - auto-leaving');
                    setTimeout(() => leaveCall(), 500);
                }

                return updated;
            });
        };

        const handleOffer = async (payload) => {
            try {
                console.log('[CallContext] Received offer from:', payload.caller);
                const pc = createPeerConnection(payload.caller, false, null, null);
                if (!pc) return;

                await pc.setRemoteDescription(payload.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('answer', {
                    target: payload.caller,
                    caller: socket.id,
                    sdp: pc.localDescription
                });
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
                }
            } catch (err) {
                console.error('[CallContext] Error handling answer:', err);
            }
        };

        const handleIceCandidate = async (payload) => {
            try {
                const peer = peersRef.current[payload.caller];
                if (peer?.peerConnection && payload.candidate) {
                    await peer.peerConnection.addIceCandidate(payload.candidate);
                }
            } catch (err) {
                console.error('[CallContext] Error handling ICE candidate:', err);
            }
        };

        const handleMuteUpdate = ({ userId: odId, isMuted: muteState }) => {
            setParticipants(prev => prev.map(p =>
                p.userId === odId ? { ...p, isMuted: muteState } : p
            ));
        };

        socket.on('user-connected', handleUserConnected);
        socket.on('incoming_call', handleIncomingCall);
        socket.on('user-disconnected', handleUserDisconnected);
        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('mute-update', handleMuteUpdate);

        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('incoming_call', handleIncomingCall);
            socket.off('user-disconnected', handleUserDisconnected);
            socket.off('offer', handleOffer);
            socket.off('answer', handleAnswer);
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('mute-update', handleMuteUpdate);
        };
    }, [isInCall, createPeerConnection, cleanupAudioElement]);

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

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);

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
        setParticipants([]);
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
                const newMuteState = !audioTrack.enabled;
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
    }, [activeChannelId, user?.id]);

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
