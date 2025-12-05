import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import ProfilePopup from './ProfilePopup';
import SettingsModal from './SettingsModal';
import UserAvatar from './UserAvatar';

export default function WorkspaceSidebar() {
    const { user } = useAuth();
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const avatarRef = useRef(null);

    return (
        <>
            <div className="w-[70px] h-screen bg-[#1a1d21] flex flex-col items-center py-4 border-r border-gray-700/50">
                <nav className="flex-1 flex flex-col gap-4 w-full px-2">
                    <NavItem icon={<Home size={20} />} label="Home" active />
                </nav>

                <div className="mt-auto pb-4 flex flex-col items-center gap-4 relative">
                    <div className="relative" ref={avatarRef}>
                        <button
                            onClick={() => setShowProfilePopup(!showProfilePopup)}
                            className="rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-400 transition-colors relative"
                            title="Profile Menu"
                        >
                            <UserAvatar user={user} size="lg" className="rounded-lg" />
                        </button>
                    </div>

                    {showProfilePopup && (
                        <ProfilePopup
                            isOpen={showProfilePopup}
                            onClose={() => setShowProfilePopup(false)}
                            onOpenProfile={() => setShowProfileModal(true)}
                            onOpenSettings={() => setShowSettings(true)}
                            anchorRef={avatarRef}
                        />
                    )}
                </div>
            </div>

            {showProfileModal && createPortal(
                <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />,
                document.body
            )}

            {showSettings && createPortal(
                <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />,
                document.body
            )}
        </>
    );
}

function NavItem({ icon, label, active }) {
    return (
        <div className="group flex flex-col items-center gap-1 cursor-pointer">
            <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 group-hover:bg-gray-800 group-hover:text-gray-200'}`}>
                {icon}
            </div>
            <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-300">{label}</span>
        </div>
    );
}
