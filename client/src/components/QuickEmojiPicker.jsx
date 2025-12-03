import { useState } from 'react';
import { Search } from 'lucide-react';

// Popular emojis organized by category - Slack style
const QUICK_EMOJIS = ['👍', '👎', '😂', '❤️', '🎉', '👀', '🔥', '💯'];

const EMOJI_CATEGORIES = {
    'Frequently Used': ['👍', '👎', '😂', '❤️', '🎉', '👀', '🔥', '💯', '✅', '👏', '🙌', '💪'],
    'Smileys': ['😀', '😃', '😄', '😁', '😅', '🤣', '😂', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😜', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😬'],
    'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋', '🤚', '✋', '🖐️', '👏', '🙌', '🤝', '🙏', '💪', '🦾'],
    'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
    'Symbols': ['✅', '❌', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '🎉', '🎊', '🏆', '🥇', '🎯', '💯', '✨', '🔔']
};

export default function QuickEmojiPicker({ onSelect, onClose, onOpenFull }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('Frequently Used');

    const handleEmojiClick = (emoji) => {
        onSelect(emoji);
    };

    // Filter emojis based on search (simple implementation)
    const getFilteredEmojis = () => {
        if (!searchQuery) {
            return EMOJI_CATEGORIES[activeCategory] || [];
        }
        // When searching, show all emojis that might match
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        return [...new Set(allEmojis)];
    };

    return (
        <div className="bg-[#1e1f22] rounded-lg shadow-xl border border-[#3f4147] w-[320px] overflow-hidden">
            {/* Quick reactions row */}
            <div className="flex items-center gap-1 p-2 border-b border-[#3f4147] bg-[#2b2d31]">
                {QUICK_EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        className="w-8 h-8 flex items-center justify-center text-xl hover:bg-[#3f4147] rounded transition-colors"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="p-2 border-b border-[#3f4147]">
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search emoji"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1e1f22] border border-[#3f4147] rounded pl-7 pr-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5865f2]"
                        autoFocus
                    />
                </div>
            </div>

            {/* Category tabs */}
            {!searchQuery && (
                <div className="flex gap-1 px-2 py-1 border-b border-[#3f4147] overflow-x-auto scrollbar-hide">
                    {Object.keys(EMOJI_CATEGORIES).map((category) => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
                                activeCategory === category
                                    ? 'bg-[#5865f2] text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-[#3f4147]'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            )}

            {/* Emoji grid */}
            <div className="p-2 max-h-[200px] overflow-y-auto">
                <div className="grid grid-cols-8 gap-1">
                    {getFilteredEmojis().map((emoji, idx) => (
                        <button
                            key={`${emoji}-${idx}`}
                            onClick={() => handleEmojiClick(emoji)}
                            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-[#3f4147] rounded transition-colors"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer with full picker option */}
            {onOpenFull && (
                <div className="px-2 py-1.5 border-t border-[#3f4147] bg-[#2b2d31]">
                    <button
                        onClick={onOpenFull}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        Browse all emoji →
                    </button>
                </div>
            )}
        </div>
    );
}
