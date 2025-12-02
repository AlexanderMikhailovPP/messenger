import { useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';
import { Menu } from 'lucide-react';

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
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-20"
                    onClick={() => setShowSidebar(false)}
                />
            )}

                {/* Chat Area - Full width on mobile, adjusted on desktop */}
                <div className="flex-1 md:mt-0 pt-14 md:pt-0">
                    <ChatArea currentChannel={currentChannel} setCurrentChannel={setCurrentChannel} />
                </div>
            </div>
            );
}
