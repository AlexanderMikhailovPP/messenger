import { useState } from 'react';
import { Menu, MessageSquare } from 'lucide-react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';
import UserAvatar from './UserAvatar';
import { useAuth } from '../context/AuthContext';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);
    const [mobileView, setMobileView] = useState('home'); // 'home' | 'chat'
    const [activeTab, setActiveTab] = useState('home'); // 'home' | 'dms' | 'you'
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const { user } = useAuth();

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
                            activeTab={activeTab}
                        />
                        {/* Bottom Navigation Bar */}
                        <div className="h-16 bg-[#1a1d21] border-t border-gray-800 flex items-center justify-around px-2 pb-safe">
                            <button
                                onClick={() => setActiveTab('home')}
                                className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-white' : 'text-gray-500'}`}
                            >
                                <div className={`p-1 rounded-lg ${activeTab === 'home' ? 'bg-gray-800' : ''}`}>
                                    <Menu size={20} />
                                </div>
                                <span className="text-[10px] font-medium">Home</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('dms')}
                                className={`flex flex-col items-center gap-1 ${activeTab === 'dms' ? 'text-white' : 'text-gray-500'}`}
                            >
                                <div className={`p-1 rounded-lg ${activeTab === 'dms' ? 'bg-gray-800' : ''}`}>
                                    <MessageSquare size={20} />
                                </div>
                                <span className="text-[10px] font-medium">DMs</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('you')}
                                className={`flex flex-col items-center gap-1 ${activeTab === 'you' ? 'text-white' : 'text-gray-500'}`}
                            >
                                <div className={`p-1 rounded-lg ${activeTab === 'you' ? 'bg-gray-800' : ''}`}>
                                    <UserAvatar user={user} size="xs" />
                                </div>
                                <span className="text-[10px] font-medium">You</span>
                            </button>
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
