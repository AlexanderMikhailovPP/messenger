import { useState } from 'react';
import WorkspaceSidebar from './WorkspaceSidebar';
import NavigationSidebar from './NavigationSidebar';
import ChatArea from './ChatArea';

export default function ChatLayout() {
    const [currentChannel, setCurrentChannel] = useState(null);

    return (
        <div className="flex h-screen bg-[#1a1d21] overflow-hidden font-sans">
            <WorkspaceSidebar />
            <NavigationSidebar currentChannel={currentChannel} setCurrentChannel={setCurrentChannel} />
            <ChatArea currentChannel={currentChannel} />
        </div>
    );
}
