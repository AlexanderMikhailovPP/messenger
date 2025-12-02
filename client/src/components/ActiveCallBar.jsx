import React from 'react';
import { useCall } from '../context/CallContext';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';

export default function ActiveCallBar() {
    const { isInCall, peers, leaveCall, toggleMute, isMuted, localStream } = useCall();

    if (!isInCall) return null;

    return (
        <div className="h-16 bg-[#1e1f22] border-b border-[#1e1f22] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 text-green-500 font-semibold">
                    <Volume2 size={20} className="animate-pulse" />
                    <span>Voice Connected</span>
                </div>

                <div className="h-8 w-[1px] bg-gray-700 mx-2"></div>

                {/* Participants */}
                <div className="flex items-center gap-2">
                    {/* Self */}
                    <div className="relative group">
                        <div className={`w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center border-2 ${isMuted ? 'border-red-500' : 'border-green-500'}`}>
                            <span className="text-xs text-white">Me</span>
                        </div>
                        {isMuted && (
                            <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
                                <MicOff size={10} className="text-white" />
                            </div>
                        )}
                    </div>

                    {/* Peers */}
                    {Object.values(peers).map((peer, index) => (
                        <div key={index} className="relative group" title={`User ${peer.userId}`}>
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center border-2 border-green-500">
                                <span className="text-xs text-white">U{peer.userId}</span>
                            </div>
                            {/* Audio element for peer */}
                            <audio
                                autoPlay
                                ref={audio => {
                                    if (audio && peer.stream) {
                                        audio.srcObject = peer.stream;
                                    }
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleMute}
                    className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                    onClick={leaveCall}
                    className="p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                    title="Disconnect"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
}
