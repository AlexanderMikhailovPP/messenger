import { io } from 'socket.io-client';

export const socket = io(); // Connects to relative path, handled by proxy
