import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSocket } from '../socket';

const OnlineStatusContext = createContext();

export function OnlineStatusProvider({ children }) {
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        // Receive initial list of online users
        const handleOnlineUsers = (userIds) => {
            // Convert all IDs to numbers for consistent comparison
            setOnlineUsers(new Set(userIds.map(id => Number(id))));
        };

        // User came online
        const handleUserOnline = ({ userId }) => {
            setOnlineUsers(prev => new Set([...prev, Number(userId)]));
        };

        // User went offline
        const handleUserOffline = ({ userId }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(Number(userId));
                return newSet;
            });
        };

        socket.on('online_users', handleOnlineUsers);
        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);

        return () => {
            socket.off('online_users', handleOnlineUsers);
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
        };
    }, []);

    const isUserOnline = useCallback((userId) => {
        return onlineUsers.has(Number(userId));
    }, [onlineUsers]);

    return (
        <OnlineStatusContext.Provider value={{ onlineUsers, isUserOnline }}>
            {children}
        </OnlineStatusContext.Provider>
    );
}

export function useOnlineStatus() {
    const context = useContext(OnlineStatusContext);
    if (!context) {
        throw new Error('useOnlineStatus must be used within OnlineStatusProvider');
    }
    return context;
}
