/**
 * Express middleware that checks if the authenticated user is an admin.
 * Must be used AFTER authMiddleware.
 */
const adminMiddleware = (req, res, next) => {
  // authMiddleware sets req.user to the user object from the database
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if is_admin is true (MySQL returns 1 for true)
  if (req.user.is_admin === 1 || req.user.is_admin === true) {
    next();
  } else {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

export default adminMiddleware;
