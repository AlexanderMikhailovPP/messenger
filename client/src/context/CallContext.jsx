import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getSocket } from '../socket';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
    const { user } = useAuth();
    const [isInCall, setIsInCall] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState({}); // { socketId: { stream, peerConnection, user } }
    const [isMuted, setIsMuted] = useState(false);
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [participants, setParticipants] = useState([]); // [{ userId, username, avatarUrl, isMuted, isSpeaking, isCurrentUser }]

    const peersRef = useRef({}); // Keep track of peers for callbacks
    const localStreamRef = useRef(null);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        // Handle signaling events
        socket.on('user-connected', (userId, socketId, username) => {
            console.log('[CallContext] User connected:', { userId, socketId, username });
            createPeerConnection(socketId, true, userId, username);

            // Add to participants list
            setParticipants(prev => {
                if (prev.some(p => p.userId === userId)) return prev;
                return [...prev, {
                    userId,
                    username,
                    avatarUrl: null,
                    isMuted: false,
                    isSpeaking: false,
                    isCurrentUser: false
                }];
            });
        });

        socket.on('incoming_call', (payload) => {
            console.log('Incoming call:', payload);
            setIncomingCall(payload);
        });

        socket.on('user-disconnected', (userId, socketId) => {
            console.log('User disconnected from call:', userId, socketId);
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].peerConnection.close();
                const newPeers = { ...peersRef.current };
                delete newPeers[socketId];
                peersRef.current = newPeers;
                setPeers(newPeers);
            }

            // Remove from participants
            setParticipants(prev => {
                const updated = prev.filter(p => p.userId !== userId);

                // If only current user left, auto-leave call
                if (updated.length === 1 && updated[0].isCurrentUser) {
                    console.log('[CallContext] Last participant - auto-leaving call');
                    setTimeout(() => {
                        // Give server time to update message
                        setIsInCall(false);
                        setActiveChannelId(null);
                        setParticipants([]);

                        if (localStreamRef.current) {
                            localStreamRef.current.getTracks().forEach(track => track.stop());
                        }
                        setLocalStream(null);
                        localStreamRef.current = null;
                        setIsMuted(false);
                    }, 500);
                }

                return updated;
            });
        });

        socket.on('offer', async (payload) => {
            try {
                console.log('Received offer from:', payload.caller);
                const pc = createPeerConnection(payload.caller, false, null);
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { target: payload.caller, caller: socket.id, sdp: answer });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        socket.on('answer', async (payload) => {
            try {
                console.log('Received answer from:', payload.caller);
                const pc = peersRef.current[payload.caller]?.peerConnection;
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                }
            } catch (err) {
                console.error('Error handling answer:', err);
            }
        });

        socket.on('ice-candidate', async (payload) => {
            try {
                const pc = peersRef.current[payload.caller]?.peerConnection;
                if (pc && payload.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                }
            } catch (err) {
                console.error('Error handling ICE candidate:', err);
            }
        });

        return () => {
            socket.off('user-connected');
            socket.off('user-disconnected');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('incoming_call');
        };
    }, []);

    const createPeerConnection = (targetSocketId, isInitiator, targetUserId, targetUsername) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { target: targetSocketId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track from:', targetSocketId);
            setPeers(prev => ({
                ...prev,
                [targetSocketId]: { ...prev[targetSocketId], stream: event.streams[0] }
            }));
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
        }

        peersRef.current[targetSocketId] = { peerConnection: pc, userId: targetUserId, username: targetUsername };
        setPeers(prev => ({ ...prev, [targetSocketId]: { peerConnection: pc, userId: targetUserId, username: targetUsername } }));

        if (isInitiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket.emit('offer', { target: targetSocketId, caller: socket.id, sdp: offer });
            });
        }

        return pc;
    };

    const joinCall = async (channelId) => {
        try {
            const socket = getSocket();
            if (!socket) {
                alert('Please login first to join a call');
                return;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Audio is not supported. Please ensure you are using HTTPS or localhost.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(stream);
            localStreamRef.current = stream;
            setIsInCall(true);
            setActiveChannelId(channelId);

            console.log('[CallContext] Joining room:', `call_${channelId}`);
            console.log('[CallContext] Setting activeChannelId to:', channelId);
            socket.emit('join-room', `call_${channelId}`, user.id);

            // Add current user to participants
            setParticipants([{
                userId: user.id,
                username: user.username,
                avatarUrl: user.avatar_url,
                isMuted: false,
                isSpeaking: false,
                isCurrentUser: true
            }]);
        } catch (err) {
            console.error('Failed to get local stream:', err);
            alert('Could not access microphone. Please allow permissions.');
        }
    };

    const leaveCall = () => {
        const socket = getSocket();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        localStreamRef.current = null;
        setIsInCall(false);
        setActiveChannelId(null);
        setIsMuted(false);
        setParticipants([]); // Clear participants

        Object.values(peersRef.current).forEach(p => p.peerConnection.close());
        peersRef.current = {};
        setPeers({});

        if (socket) {
            socket.emit('leave-room');
        }
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const clearIncomingCall = () => setIncomingCall(null);

    return (
        <CallContext.Provider value={{ isInCall, localStream, peers, joinCall, leaveCall, toggleMute, isMuted, activeChannelId, incomingCall, clearIncomingCall, participants }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => useContext(CallContext);
