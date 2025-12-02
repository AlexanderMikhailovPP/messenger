import { useState } from 'react';
import { Menu } from 'lucide-react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    const handleChannelSelect = (channel) => {
        setCurrentChannel(channel);
        // Auto-close sidebar on mobile after selecting channel
        setShowSidebar(false);
    };

    return (
        <div className="h-screen flex bg-[#2f3136] relative">
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
            <div className="flex-1 flex flex-col min-w-0">
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
