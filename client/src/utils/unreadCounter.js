/**
 * Unread message counter using localStorage with event notification
 */

const UNREAD_KEY = 'unread_counts';
const SEEN_MESSAGES_KEY = 'seen_message_ids';

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

// Track seen message IDs to prevent duplicate counting
const getSeenMessageIds = () => {
    try {
        const stored = localStorage.getItem(SEEN_MESSAGES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const addSeenMessageId = (messageId) => {
    const seen = getSeenMessageIds();
    if (!seen.includes(messageId)) {
        // Keep only last 100 message IDs to prevent localStorage bloat
        const updated = [...seen.slice(-99), messageId];
        localStorage.setItem(SEEN_MESSAGES_KEY, JSON.stringify(updated));
    }
};

const hasSeenMessage = (messageId) => {
    return getSeenMessageIds().includes(messageId);
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

export const incrementUnread = (channelId, messageId) => {
    // If messageId provided, check for duplicates
    if (messageId && hasSeenMessage(messageId)) {
        return getUnreadCounts()[channelId] || 0;
    }

    if (messageId) {
        addSeenMessageId(messageId);
    }

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
