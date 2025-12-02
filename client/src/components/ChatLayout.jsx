import { useState } from 'react';
import { Menu } from 'lucide-react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);
    const [mobileView, setMobileView] = useState('home'); // 'home' | 'chat'
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null); // Reset touch end
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe && mobileView === 'chat') {
            // Swipe Right in Chat: Go Back to Home
            setMobileView('home');
        }
    };

    const handleChannelSelect = (channel) => {
        setCurrentChannel(channel);
        setMobileView('chat');
    };

    return (
        <div
            className="h-screen flex bg-[#1a1d21] relative overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Desktop: Sidebar always visible */}
            <div className="hidden md:block h-full">
                <WorkspaceSidebar />
            </div>

            {/* Desktop: Navigation Sidebar */}
            <div className="hidden md:block h-full z-30">
                <NavigationSidebar
                    currentChannel={currentChannel}
                    setCurrentChannel={handleChannelSelect}
                />
            </div>

            {/* Desktop: Chat Area */}
            <div className="hidden md:flex flex-1 flex-col min-w-0 overflow-hidden">
                <ChatArea
                    currentChannel={currentChannel}
                    setCurrentChannel={setCurrentChannel}
                />
            </div>

            {/* Mobile: View Switching */}
            <div className="md:hidden w-full h-full flex flex-col">
                {mobileView === 'home' ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <NavigationSidebar
                            currentChannel={currentChannel}
                            setCurrentChannel={handleChannelSelect}
                            isMobile={true}
                        />
                        {/* Bottom Navigation Bar */}
                        <div className="h-16 bg-[#1a1d21] border-t border-gray-800 flex items-center justify-around px-2 pb-safe">
                            <div className="flex flex-col items-center gap-1 text-white">
                                <div className="p-1 rounded-lg bg-gray-800">
                                    <Menu size={20} />
                                </div>
                                <span className="text-[10px] font-medium">Home</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-gray-500">
                                <div className="p-1">
                                    <MessageSquare size={20} />
                                </div>
                                <span className="text-[10px] font-medium">DMs</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-gray-500">
                                <div className="p-1">
                                    <div className="w-5 h-5 rounded-full bg-gray-600" />
                                </div>
                                <span className="text-[10px] font-medium">You</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <ChatArea
                        currentChannel={currentChannel}
                        setCurrentChannel={setCurrentChannel}
                        onBack={() => setMobileView('home')}
                        isMobile={true}
                    />
                )}
            </div>
        </div>
    );
}
