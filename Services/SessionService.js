import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'worktrail_jwt_secret_key_2026';
const SESSION_TIMEOUT_MINUTES = 10;
const SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_MINUTES * 60; // 600 seconds

// In-memory set of revoked tokens (populated on logout)
// Key: token string, Value: expiry timestamp in ms
const revokedTokens = new Map();

// Periodic cleanup of expired revoked tokens every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, expiry] of revokedTokens.entries()) {
        if (now > expiry) {
            revokedTokens.delete(token);
        }
    }
}, 5 * 60 * 1000).unref();

/**
 * Creates a signed JWT session token with user details and 10-minute expiry
 * @param {Object} user - User record from database
 * @param {Object} [req] - Express request object (optional, for express-session)
 * @returns {string} Signed JWT token
 */
export const createSessionToken = (user, req = null) => {
    const payload = {
        userId: user.id || user.UserMasterID,
        id: user.id || user.UserMasterID,
        EmailID: user.EmailID || user.email || '',
        email: user.EmailID || user.email || '',
        Usertype: user.Usertype || 'Client',
        username: user.username || user.EmailID || '',
        CompanyName: user.CompanyName || '',
        CompanyCode: user.CompanyCode || '',
        UserMasterID: user.UserMasterID || null,
        OrgMasterID: user.OrgMasterID || null,
        jti: crypto.randomUUID() // Unique JWT ID for tracking
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: `${SESSION_TIMEOUT_MINUTES}m`
    });

    // If express-session is present, store session state
    if (req && req.session) {
        req.session.token = token;
        req.session.user = payload;
        req.session.lastActivity = Date.now();
        req.session.createdAt = Date.now();
    }

    return token;
};

/**
 * Verifies a session token, checking revocation and expiration
 * @param {string} token
 * @returns {Object} Decoded token payload
 */
export const verifySessionToken = (token) => {
    if (!token) {
        throw new Error('No token provided');
    }

    // Check if token has been explicitly revoked
    if (revokedTokens.has(token)) {
        const error = new Error('Session has been revoked/logged out');
        error.name = 'SessionRevokedError';
        throw error;
    }

    // Verify cryptographic signature and expiration (10 min)
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
};

/**
 * Revokes a session token on logout
 * @param {string} token
 * @param {Object} [req] - Express request object
 */
export const revokeSessionToken = (token, req = null) => {
    if (token) {
        try {
            // Decode to get expiration time so we can store until expired
            const decoded = jwt.decode(token);
            const expiry = decoded && decoded.exp ? decoded.exp * 1000 : Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000);
            revokedTokens.set(token, expiry);
        } catch {
            revokedTokens.set(token, Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000));
        }
    }

    if (req && req.session) {
        try {
            req.session.destroy();
        } catch (e) {
            console.error('Error destroying session:', e);
        }
    }
};

/**
 * Refreshes an active session token with sliding session support
 * Allows refreshing valid tokens or recently expired tokens (5-minute grace window)
 * Avoids breaking concurrent in-flight requests by delaying old token revocation
 * @param {string} oldToken
 * @param {Object} [req]
 * @returns {string} New signed JWT token
 */
export const refreshSessionToken = (oldToken, req = null) => {
    if (!oldToken) {
        throw new Error('No token provided');
    }

    // Check if token has been explicitly revoked on logout
    if (revokedTokens.has(oldToken)) {
        const error = new Error('Session has been revoked/logged out');
        error.name = 'SessionRevokedError';
        throw error;
    }

    let decoded;
    try {
        decoded = jwt.verify(oldToken, JWT_SECRET);
    } catch (err) {
        // Allow a 5-minute grace period past expiration for active session keepalive
        if (err.name === 'TokenExpiredError') {
            decoded = jwt.decode(oldToken);
            const expMs = decoded && decoded.exp ? decoded.exp * 1000 : 0;
            const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5-minute grace window
            if (!decoded || !expMs || (Date.now() - expMs > GRACE_PERIOD_MS)) {
                throw err;
            }
        } else {
            throw err;
        }
    }

    // Gracefully schedule old token revocation after 60 seconds
    // to allow any concurrent in-flight requests using the old token to finish
    setTimeout(() => {
        if (oldToken) {
            const exp = decoded && decoded.exp ? decoded.exp * 1000 : Date.now() + (SESSION_TIMEOUT_MINUTES * 60 * 1000);
            revokedTokens.set(oldToken, exp);
        }
    }, 60 * 1000).unref?.();

    // Issue fresh 10-minute token
    return createSessionToken({
        id: decoded.id || decoded.userId,
        EmailID: decoded.EmailID || decoded.email,
        Usertype: decoded.Usertype,
        username: decoded.username,
        CompanyName: decoded.CompanyName,
        CompanyCode: decoded.CompanyCode,
        UserMasterID: decoded.UserMasterID,
        OrgMasterID: decoded.OrgMasterID
    }, req);
};

export { JWT_SECRET, SESSION_TIMEOUT_MINUTES, SESSION_TIMEOUT_SECONDS };

