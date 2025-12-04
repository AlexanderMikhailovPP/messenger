/**
 * Unread message counter using localStorage with event notification
 */

const UNREAD_KEY = 'unread_counts';

// Simple event emitter for cross-component communication
const listeners = new Set();

export const subscribeToUnreadChanges = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notifyListeners = (counts) => {
    listeners.forEach(callback => callback(counts));
};

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
    notifyListeners(counts);
};

export const incrementUnread = (channelId) => {
    const counts = getUnreadCounts();
    counts[channelId] = (counts[channelId] || 0) + 1;
    localStorage.setItem(UNREAD_KEY, JSON.stringify(counts));
    notifyListeners(counts);
    return counts[channelId];
};

export const markAsRead = (channelId) => {
    setUnreadCount(channelId, 0);
};

export const getTotalUnread = () => {
    const counts = getUnreadCounts();
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
};

// DM list update notification
const dmListeners = new Set();

export const subscribeToDMUpdates = (callback) => {
    dmListeners.add(callback);
    return () => dmListeners.delete(callback);
};

export const notifyNewDM = (channelId, otherUser) => {
    dmListeners.forEach(callback => callback({ channelId, otherUser }));
};
