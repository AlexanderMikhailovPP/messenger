import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
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

    const peersRef = useRef({}); // Keep track of peers for callbacks
    const localStreamRef = useRef(null);

    useEffect(() => {
        // Handle signaling events
        socket.on('user-connected', (userId, socketId) => {
            console.log('User connected to call:', userId, socketId);
            createPeerConnection(socketId, true, userId);
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
        });

        socket.on('offer', async (payload) => {
            console.log('Received offer from:', payload.caller);
            const pc = createPeerConnection(payload.caller, false, null); // userId unknown initially
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { target: payload.caller, caller: socket.id, sdp: answer });
        });

        socket.on('answer', async (payload) => {
            console.log('Received answer from:', payload.caller);
            const pc = peersRef.current[payload.caller]?.peerConnection;
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
        });

        socket.on('ice-candidate', async (payload) => {
            const pc = peersRef.current[payload.caller]?.peerConnection;
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        });

        return () => {
            socket.off('user-connected');
            socket.off('user-disconnected');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
        };
    }, []);

    const createPeerConnection = (targetSocketId, isInitiator, targetUserId) => {
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

        peersRef.current[targetSocketId] = { peerConnection: pc, userId: targetUserId };
        setPeers(prev => ({ ...prev, [targetSocketId]: { peerConnection: pc, userId: targetUserId } }));

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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Audio is not supported. Please ensure you are using HTTPS or localhost.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setLocalStream(stream);
            localStreamRef.current = stream;
            setIsInCall(true);
            setActiveChannelId(channelId);

            socket.emit('join-room', `call_${channelId}`, user.id);
        } catch (err) {
            console.error('Failed to get local stream:', err);
            alert('Could not access microphone. Please allow permissions.');
        }
    };

    const leaveCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        localStreamRef.current = null;
        setIsInCall(false);
        setActiveChannelId(null);
        setIsMuted(false);

        Object.values(peersRef.current).forEach(p => p.peerConnection.close());
        peersRef.current = {};
        setPeers({});

        socket.emit('leave-room');
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
        <CallContext.Provider value={{ isInCall, localStream, peers, joinCall, leaveCall, toggleMute, isMuted, activeChannelId, incomingCall, clearIncomingCall }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => useContext(CallContext);
