import { io } from 'socket.io-client';

// Get token from localStorage
const getToken = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.token || '';
    } catch {
        return '';
    }
};

export const socket = io({
    auth: {
        token: getToken()
    },
    autoConnect: true
});

// Reconnect with token on reconnection
socket.on('connect', () => {
    socket.auth.token = getToken();
});
