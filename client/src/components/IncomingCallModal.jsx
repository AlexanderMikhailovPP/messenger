import { Phone, PhoneOff, Headphones } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function IncomingCallModal({
    callerName,
    callerAvatar,
    channelName,
    onAccept,
    onDecline
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onDecline}
            />

            {/* Modal */}
            <div className="relative bg-[#1a1d21] rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden animate-scale-in w-[340px]">
                {/* Animated gradient top bar */}
                <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 animate-gradient-x" />

                {/* Content */}
                <div className="p-6 text-center">
                    {/* Pulsing ring animation around avatar */}
                    <div className="relative mx-auto w-24 h-24 mb-4">
                        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                        <div className="absolute inset-2 rounded-full bg-green-500/30 animate-pulse" />
                        <div className="relative w-full h-full">
                            <UserAvatar
                                user={{
                                    username: callerName || 'Unknown',
                                    avatar_url: callerAvatar
                                }}
                                size="xl"
                            />
                        </div>
                    </div>

                    {/* Call info */}
                    <div className="mb-1">
                        <h2 className="text-xl font-bold text-white">
                            {callerName || 'Someone'}
                        </h2>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
                        <Headphones size={16} className="text-green-500" />
                        <span className="text-sm">Incoming huddle</span>
                        {channelName && (
                            <>
                                <span className="text-gray-600">·</span>
                                <span className="text-sm text-gray-500">{channelName}</span>
                            </>
                        )}
                    </div>

                    {/* Call status indicator */}
                    <div className="flex items-center justify-center gap-1.5 mb-6">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={onDecline}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-red-600/30">
                                <PhoneOff size={24} className="text-white" />
                            </div>
                            <span className="text-xs text-gray-400 group-hover:text-gray-300">Decline</span>
                        </button>

                        <button
                            onClick={onAccept}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-green-600/30 animate-pulse">
                                <Phone size={24} className="text-white" />
                            </div>
                            <span className="text-xs text-gray-400 group-hover:text-gray-300">Accept</span>
                        </button>
                    </div>
                </div>

                {/* Subtle bottom gradient */}
                <div className="h-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
            </div>

            {/* CSS for animations */}
            <style>{`
                @keyframes scale-in {
                    from {
                        transform: scale(0.9);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                @keyframes gradient-x {
                    0%, 100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
                .animate-gradient-x {
                    background-size: 200% 100%;
                    animation: gradient-x 2s ease infinite;
                }
            `}</style>
        </div>
    );
}
