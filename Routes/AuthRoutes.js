import { Router } from 'express';
import { getSessionInfo, logout, refreshSession } from '../Controller/AuthController.js';
import { authenticateSession } from '../Middleware/AuthMiddleware.js';

const authRoutes = Router();

// Get current active session details
authRoutes.get('/api/auth/session', authenticateSession, getSessionInfo);
authRoutes.get('/api/auth/me', authenticateSession, getSessionInfo);

// Secure logout - revokes token and clears session state
authRoutes.post('/api/auth/logout', logout);

// Extend active session by 10 minutes (supports sliding session & grace window)
authRoutes.post('/api/auth/refresh', refreshSession);

export default authRoutes;
