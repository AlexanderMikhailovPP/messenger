/**
 * Draft messages storage using localStorage
 */

const DRAFTS_KEY = 'message_drafts';

export const getDrafts = () => {
    try {
        const stored = localStorage.getItem(DRAFTS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const getDraft = (channelId) => {
    const drafts = getDrafts();
    return drafts[channelId] || '';
};

export const saveDraft = (channelId, content) => {
    const drafts = getDrafts();
    if (content && content.trim()) {
        drafts[channelId] = content;
    } else {
        delete drafts[channelId];
    }
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const deleteDraft = (channelId) => {
    const drafts = getDrafts();
    delete drafts[channelId];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const hasDraft = (channelId) => {
    const drafts = getDrafts();
    return !!drafts[channelId];
};
