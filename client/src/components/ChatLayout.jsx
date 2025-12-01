import { useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';
import { Menu, X } from 'lucide-react';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);

    return (
        <div className="flex h-screen bg-[#222529] overflow-hidden">
            {/* Mobile Header with Hamburger */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#1a1d21] border-b border-gray-700 flex items-center px-4 z-40">
                <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="p-2 text-gray-400 hover:text-white"
                >
                    {showSidebar ? <X size={24} /> : <Menu size={24} />}
                </button>
                <span className="ml-3 text-white font-bold">Touch</span>
            </div>

            {/* Workspace Sidebar - Hidden on mobile unless toggled */}
            <div className={`${showSidebar ? 'block' : 'hidden'} md:block fixed md:relative z-30 h-full`}>
                <WorkspaceSidebar />
            </div>

            {/* Navigation Sidebar - Hidden on mobile unless toggled */}
            <div className={`${showSidebar ? 'block' : 'hidden'} md:block fixed md:relative z-30 h-full`}>
                <NavigationSidebar currentChannel={currentChannel} setCurrentChannel={setCurrentChannel} />
            </div>

            {/* Overlay for mobile when sidebar is open */}
            {showSidebar && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-20"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/* Chat Area - Full width on mobile, adjusted on desktop */}
            <div className="flex-1 mt-14 md:mt-0">
                <ChatArea currentChannel={currentChannel} />
            </div>
        </div>
    );
}
