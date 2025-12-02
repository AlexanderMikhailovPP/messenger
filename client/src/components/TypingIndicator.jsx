export default function TypingIndicator({ typingUsers, currentUser }) {
    // Filter out current user from typing list
    const otherTypingUsers = Array.from(typingUsers).filter(username => username !== currentUser);

    if (otherTypingUsers.length === 0) return null;

    const getTypingText = () => {
        if (otherTypingUsers.length === 1) {
            return `${otherTypingUsers[0]} is typing...`;
        } else if (otherTypingUsers.length === 2) {
            return `${otherTypingUsers[0]} and ${otherTypingUsers[1]} are typing...`;
        } else {
            return `${otherTypingUsers.length} people are typing...`;
        }
    };

    return (
        <div className="px-4 py-2 text-sm text-gray-400 italic flex items-center gap-2">
            <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span>{getTypingText()}</span>
        </div>
    );
}
