const { verifyToken } = require('../services/tokenService');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token is missing or invalid' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Token is expired or signature mismatch' });
  }

  req.user = decoded;
  next();
};

module.exports = authenticateToken;
