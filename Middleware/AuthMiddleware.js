import { verifySessionToken, refreshSessionToken } from '../Services/SessionService.js';

/**
 * Normalizes user role string for robust comparison
 * e.g. "Contributor Admin", "contributor_admin", "ContributorAdmin" -> "contributoradmin"
 */
export const normalizeRole = (role) => {
    return String(role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
};

/**
 * Extracts session token from request headers or express session
 */
export const extractToken = (req) => {
    // 1. Authorization: Bearer <token>
    const authHeader = req.header('Authorization') || req.header('authorization');
    if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
            return parts[1].trim();
        }
        return authHeader.trim();
    }

    // 2. Custom header x-session-token
    const customHeader = req.header('x-session-token');
    if (customHeader) {
        return customHeader.trim();
    }

    // 3. Express session token
    if (req.session && req.session.token) {
        return req.session.token;
    }

    return null;
};

/**
 * Middleware to authenticate user session.
 * Enforces valid signature and 10-minute inactivity limit.
 * Implements sliding session: auto-refreshes token if active request is within 5m of expiry.
 */
export const authenticateSession = (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            message: 'Authentication session token required. Please log in.',
            code: 'SESSION_REQUIRED',
            loginStatus: false
        });
    }

    try {
        const decoded = verifySessionToken(token);

        // Attach decoded user info and raw token to request
        req.user = decoded;
        req.token = token;

        // Update express session activity if active
        if (req.session) {
            req.session.lastActivity = Date.now();
            req.session.user = decoded;
        }

        // Sliding session keepalive:
        // If an active user request arrives when token has less than 5 minutes (< 300s) left,
        // automatically mint a fresh 10-minute token and attach it to the response header
        if (decoded && decoded.exp) {
            const expTimeMs = decoded.exp * 1000;
            const remainingSeconds = Math.floor((expTimeMs - Date.now()) / 1000);
            if (remainingSeconds < 300 && remainingSeconds > 0) {
                try {
                    const refreshedToken = refreshSessionToken(token, req);
                    res.setHeader('x-refreshed-token', refreshedToken);
                    res.setHeader('Access-Control-Expose-Headers', 'x-refreshed-token, X-Refreshed-Token');
                } catch {
                    // Non-fatal: proceed with current valid token
                }
            }
        }

        return next();
    } catch (err) {

        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Your session has expired due to 10 minutes of inactivity. Please log in again.',
                code: 'SESSION_EXPIRED',
                expired: true,
                loginStatus: false
            });
        }

        if (err.name === 'SessionRevokedError') {
            return res.status(401).json({
                message: 'Your session has been logged out or invalidated. Please log in again.',
                code: 'SESSION_REVOKED',
                revoked: true,
                loginStatus: false
            });
        }

        console.error('Session authentication error:', err.message);
        return res.status(401).json({
            message: 'Invalid or corrupt session. Please log in again.',
            code: 'INVALID_SESSION',
            loginStatus: false
        });
    }
};

/**
 * Role-Based Access Control (RBAC) middleware for routes
 * @param  {...string} allowedRoles - List of allowed roles for this route
 */
export const authorizeRoles = (...allowedRoles) => {
    const normalizedAllowed = allowedRoles.map(normalizeRole);

    return (req, res, next) => {
        if (!req.user || !req.user.Usertype) {
            return res.status(401).json({
                message: 'Authentication required before checking permissions.',
                code: 'UNAUTHORIZED'
            });
        }

        const userRole = normalizeRole(req.user.Usertype);

        // Superadmin has universal access to all backend resources
        if (userRole === 'superadmin') {
            return next();
        }

        // Check if user role matches any allowed role
        const isAuthorized = normalizedAllowed.some(allowed => {
            return allowed === userRole || userRole.includes(allowed);
        });

        if (isAuthorized) {
            return next();
        }

        return res.status(403).json({
            message: `Access denied. Your role '${req.user.Usertype}' is not authorized to access this route.`,
            code: 'FORBIDDEN',
            userRole: req.user.Usertype,
            requiredRoles: allowedRoles
        });
    };
};
