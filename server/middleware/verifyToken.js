import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization; // ✅ standard key

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json('Token is missing or malformed');
  }

  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json('Token is not valid');
    req.user = user; // you can now access this in the route
    next();
  });
};

export default verifyToken;
