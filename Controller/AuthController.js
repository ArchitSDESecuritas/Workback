import jwt from 'jsonwebtoken';
import { revokeSessionToken, refreshSessionToken, SESSION_TIMEOUT_SECONDS } from '../Services/SessionService.js';
import { extractToken } from '../Middleware/AuthMiddleware.js';

/**
 * Returns current authenticated session details and remaining validity time
 */
export const getSessionInfo = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            authenticated: false,
            message: 'No active session'
        });
    }

    const expTimeMs = req.user.exp ? req.user.exp * 1000 : null;
    const remainingSeconds = expTimeMs ? Math.max(0, Math.floor((expTimeMs - Date.now()) / 1000)) : 600;

    return res.status(200).json({
        authenticated: true,
        user: {
            id: req.user.id || req.user.userId,
            EmailID: req.user.EmailID || req.user.email,
            Usertype: req.user.Usertype,
            username: req.user.username,
            CompanyName: req.user.CompanyName,
            CompanyCode: req.user.CompanyCode,
            UserMasterID: req.user.UserMasterID,
            OrgMasterID: req.user.OrgMasterID
        },
        expiresAt: expTimeMs,
        remainingSeconds
    });
};

/**
 * Securely logs out user: revokes session token and destroys express session
 */
export const logout = (req, res) => {
    const token = req.token || extractToken(req);

    if (token) {
        revokeSessionToken(token, req);
    } else if (req.session) {
        try {
            req.session.destroy();
        } catch (e) {
            console.error('Session destroy error:', e);
        }
    }

    // Clear session cookies if present
    res.clearCookie('connect.sid');

    return res.status(200).json({
        success: true,
        loginStatus: false,
        message: 'Logged out successfully from session.'
    });
};

/**
 * Extends active session for another 10 minutes
 */
export const refreshSession = (req, res) => {
    const token = req.token || extractToken(req);
    if (!token) {
        return res.status(401).json({
            message: 'No session token provided for refresh.',
            code: 'SESSION_REQUIRED'
        });
    }

    try {
        const newToken = refreshSessionToken(token, req);
        const decoded = jwt.decode(newToken) || {};
        return res.status(200).json({
            success: true,
            token: newToken,
            user: {
                id: decoded.id || decoded.userId,
                EmailID: decoded.EmailID || decoded.email,
                Usertype: decoded.Usertype,
                username: decoded.username,
                CompanyName: decoded.CompanyName,
                CompanyCode: decoded.CompanyCode,
                UserMasterID: decoded.UserMasterID,
                OrgMasterID: decoded.OrgMasterID
            },
            expiresAt: decoded.exp ? decoded.exp * 1000 : Date.now() + (SESSION_TIMEOUT_SECONDS * 1000),
            remainingSeconds: SESSION_TIMEOUT_SECONDS,
            message: 'Session extended by 10 minutes.'
        });
    } catch (err) {
        return res.status(401).json({
            message: 'Unable to refresh session. Please log in again.',
            error: err.message,
            code: 'SESSION_EXPIRED'
        });
    }
};

