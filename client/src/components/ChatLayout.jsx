import { useState } from 'react';
import { Menu } from 'lucide-react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);
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

        if (isLeftSwipe) {
            // Swipe Left: Close Sidebar
            setShowSidebar(false);
        }

        if (isRightSwipe) {
            // Swipe Right: Open Sidebar
            // Only allow opening if we started near the left edge (drag handle logic)
            // or if we are just toggling
            if (touchStart < 50) {
                setShowSidebar(true);
            }
        }
    };

    const handleChannelSelect = (channel) => {
        setCurrentChannel(channel);
        // Auto-close sidebar on mobile after selecting channel
        setShowSidebar(false);
    };

    return (
        <div
            className="h-screen flex bg-[#2f3136] relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Drag Handle (Left Edge) - Invisible touch target for opening sidebar */}
            <div className="absolute left-0 top-0 bottom-0 w-4 z-40 md:hidden" />
            {/* Workspace Sidebar (Left) */}
            <WorkspaceSidebar />

            {/* Navigation Sidebar (Channels/DMs) */}
            <div className={`${showSidebar ? 'fixed left-[70px] top-14 bottom-0 right-0' : 'hidden'} md:block md:static z-30 h-full`}>
                <NavigationSidebar
                    currentChannel={currentChannel}
                    setCurrentChannel={handleChannelSelect}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden h-14 bg-[#2f3136] border-b border-gray-700/50 flex items-center px-4">
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="p-2 hover:bg-gray-700 rounded transition-colors"
                    >
                        <Menu className="text-gray-400" size={24} />
                    </button>
                    {currentChannel && (
                        <span className="ml-4 font-semibold text-white">
                            {currentChannel.type === 'dm' ? currentChannel.displayName || currentChannel.name : `#${currentChannel.name}`}
                        </span>
                    )}
                </div>

                {/* Chat Area */}
                <ChatArea
                    currentChannel={currentChannel}
                    setCurrentChannel={setCurrentChannel}
                />
            </div>
        </div>
    );
}
