/**
 * Unread message counter using localStorage
 */

const UNREAD_KEY = 'unread_counts';

export const getUnreadCounts = () => {
    try {
        const stored = localStorage.getItem(UNREAD_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const setUnreadCount = (channelId, count) => {
    const counts = getUnreadCounts();
    if (count === 0) {
        delete counts[channelId];
    } else {
        counts[channelId] = count;
    }
    localStorage.setItem(UNREAD_KEY, JSON.stringify(counts));
};

export const incrementUnread = (channelId) => {
    const counts = getUnreadCounts();
    counts[channelId] = (counts[channelId] || 0) + 1;
    localStorage.setItem(UNREAD_KEY, JSON.stringify(counts));
    return counts[channelId];
};

export const markAsRead = (channelId) => {
    setUnreadCount(channelId, 0);
};

export const getTotalUnread = () => {
    const counts = getUnreadCounts();
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
};
