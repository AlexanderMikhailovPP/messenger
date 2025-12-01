import { Home, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WorkspaceSidebar() {
    const { user, logout } = useAuth();
    return (
        <div className="w-[70px] bg-[#1a1d21] flex flex-col items-center py-4 border-r border-gray-700/50">


            <nav className="flex-1 flex flex-col gap-4 w-full px-2">
                <NavItem icon={<Home size={20} />} label="Home" active />
            </nav>

            <div className="mt-auto pb-4 flex flex-col items-center gap-4">
                <button
                    onClick={logout}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Logout"
                >
                    <LogOut size={20} />
                </button>

                <div className="w-10 h-10 rounded-lg bg-gray-600 overflow-hidden cursor-pointer border-2 border-transparent hover:border-gray-400">
                    <img src={`https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=random`} alt="Profile" />
                </div>
            </div>
        </div>
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
