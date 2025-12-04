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
        <div className="px-3 py-1 text-xs text-gray-500 italic flex items-center gap-1.5">
            <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span>{getTypingText()}</span>
        </div>
    );
}
