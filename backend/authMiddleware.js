import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

/**
 * Express middleware that verifies a JWT from the Authorization header.
 * On success, sets req.user_id from the decoded token payload.
 * On failure, returns 401 with a JSON error.
 *
 * Expected header format: Authorization: Bearer <token>
 * Expected token payload: { user_id: <number|string>, ... }
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables');
    }

    const decoded = jwt.verify(token, secret);
    req.user_id = decoded.user_id;
    const accountType = decoded.account_type || 'user';

    let rows;
    if (accountType === 'admin') {
      [rows] = await pool.execute('SELECT id, email, 1 AS is_admin FROM admin_accounts WHERE id = ?', [req.user_id]);
    } else {
      [rows] = await pool.execute('SELECT id, email, is_admin FROM users WHERE id = ?', [req.user_id]);
    }

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    return res.status(401).json({ error: 'Authentication failed.', details: error.message });
  }
};

export default authMiddleware;
