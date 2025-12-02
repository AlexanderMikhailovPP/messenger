import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { connectSocket, disconnectSocket } from '../socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Axios interceptor for auto-refresh on 401
    // Defined BEFORE the initial check to ensure it catches the verify request failure
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
                        return axios(originalRequest);
                    } catch (refreshError) {
                        // Refresh failed, force logout
                        logout();
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const userData = JSON.parse(storedUser);

            // Check if we have valid cookies by making a test request
            axios.get('/api/auth/verify', { withCredentials: true })
                .then(() => {
                    // Token valid, set user and reconnect socket
                    setUser(userData);
                    connectSocket();
                })
                .catch((err) => {
                    // No valid token in cookies, and refresh failed (handled by interceptor)
                    console.log('Auth verification failed:', err);
                    localStorage.removeItem('user');
                    setUser(null);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password }, {
                withCredentials: true // Send and receive cookies
            });

            const userData = {
                id: res.data.id,
                username: res.data.username,
                avatar_url: res.data.avatar_url
            };

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));

            // Connect Socket.IO AFTER successful login
            connectSocket();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Login failed' };
        }
    };

    const register = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/register', { username, password }, {
                withCredentials: true // Send and receive cookies
            });

            const userData = {
                id: res.data.id,
                username: res.data.username,
                avatar_url: res.data.avatar_url
            };

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));

            // Connect Socket.IO AFTER successful registration
            connectSocket();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Registration failed' };
        }
    };

    const logout = () => {
        axios.post('/api/auth/logout', {}, { withCredentials: true }).catch(console.error);
        setUser(null);
        localStorage.removeItem('user');

        // Disconnect Socket.IO on logout
        disconnectSocket();
    };

    const updateUser = (updatedUserData) => {
        const newUser = { ...user, ...updatedUserData };
        setUser(newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    return (
        <AuthContext.Provider value={{ user, setUser, updateUser, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
