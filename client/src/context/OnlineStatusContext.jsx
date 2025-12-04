import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../socket';

const OnlineStatusContext = createContext();

const AWAY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export function OnlineStatusProvider({ children }) {
    // Map of userId -> status ('active' | 'away')
    const [userStatuses, setUserStatuses] = useState({});
    const [myStatus, setMyStatus] = useState('active');
    const lastActivityRef = useRef(Date.now());
    const awayTimerRef = useRef(null);

    // Track user activity
    useEffect(() => {
        const socket = getSocket();

        const resetActivity = () => {
            lastActivityRef.current = Date.now();

            // If we were away, become active again
            if (myStatus === 'away') {
                setMyStatus('active');
                if (socket) {
                    socket.emit('update_status', 'active');
                }
            }

            // Reset the away timer
            if (awayTimerRef.current) {
                clearTimeout(awayTimerRef.current);
            }

            awayTimerRef.current = setTimeout(() => {
                setMyStatus('away');
                if (socket) {
                    socket.emit('update_status', 'away');
                }
            }, AWAY_TIMEOUT);
        };

        // Listen for user activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            window.addEventListener(event, resetActivity, { passive: true });
        });

        // Initial timer setup
        resetActivity();

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, resetActivity);
            });
            if (awayTimerRef.current) {
                clearTimeout(awayTimerRef.current);
            }
        };
    }, [myStatus]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        // Receive initial list of online users with statuses
        const handleOnlineUsers = (statuses) => {
            // statuses is now an object: { odId: 'active' | 'away' }
            const normalizedStatuses = {};
            Object.entries(statuses).forEach(([odId, status]) => {
                normalizedStatuses[Number(odId)] = status;
            });
            setUserStatuses(normalizedStatuses);
        };

        // User came online
        const handleUserOnline = ({ userId, status }) => {
            setUserStatuses(prev => ({
                ...prev,
                [Number(userId)]: status || 'active'
            }));
        };

        // User went offline
        const handleUserOffline = ({ userId }) => {
            setUserStatuses(prev => {
                const newStatuses = { ...prev };
                delete newStatuses[Number(userId)];
                return newStatuses;
            });
        };

        // User status changed (active <-> away)
        const handleStatusChanged = ({ userId, status }) => {
            setUserStatuses(prev => ({
                ...prev,
                [Number(userId)]: status
            }));
        };

        socket.on('online_users', handleOnlineUsers);
        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);
        socket.on('user_status_changed', handleStatusChanged);

        return () => {
            socket.off('online_users', handleOnlineUsers);
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
            socket.off('user_status_changed', handleStatusChanged);
        };
    }, []);

    // Returns 'active', 'away', or 'offline'
    const getUserStatus = useCallback((userId) => {
        const numId = Number(userId);
        if (userStatuses.hasOwnProperty(numId)) {
            return userStatuses[numId];
        }
        return 'offline';
    }, [userStatuses]);

    // Legacy support - returns true if user is online (active or away)
    const isUserOnline = useCallback((userId) => {
        return getUserStatus(userId) !== 'offline';
    }, [getUserStatus]);

    return (
        <OnlineStatusContext.Provider value={{ userStatuses, getUserStatus, isUserOnline, myStatus }}>
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
