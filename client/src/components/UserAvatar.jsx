import { useMemo } from 'react';

const COLORS = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
];

const SIZES = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-12 h-12 text-lg',
    '2xl': 'w-16 h-16 text-xl',
    '3xl': 'w-24 h-24 text-2xl',
    '4xl': 'w-32 h-32 text-4xl',
};

export default function UserAvatar({ user, size = 'md', className = '', showStatus = false, isOnline = false, rounded = 'rounded-md' }) {
    const colorClass = useMemo(() => {
        if (!user?.username) return 'bg-gray-500';
        let hash = 0;
        for (let i = 0; i < user.username.length; i++) {
            hash = user.username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % COLORS.length;
        return COLORS[index];
    }, [user?.username]);

    const sizeClass = SIZES[size] || SIZES.md;
    const username = user?.username || user?.name || '?';
    const initial = username[0]?.toUpperCase() || '?';

    return (
        <div className={`relative inline-block ${className}`}>
            <div
                className={`${sizeClass} ${rounded} flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0 select-none ${user?.avatar_url ? 'bg-transparent' : colorClass
                    }`}
            >
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={username}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.classList.add(colorClass);
                            e.target.parentElement.classList.remove('bg-transparent');
                            // Create a text node for the initial
                            const textNode = document.createTextNode(initial);
                            e.target.parentElement.appendChild(textNode);
                        }}
                    />
                ) : (
                    <span>{initial}</span>
                )}
            </div>
            {showStatus && (
                <span
                    className={`absolute bottom-[-2px] right-[-2px] w-3 h-3 border-2 border-[#1a1d21] rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'
                        }`}
                />
            )}
        </div>
    );
}
