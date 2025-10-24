const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.cookies.token;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
    if (!decoded){
      return res.status(401).json({error: "Unauthorized Token"})
    }
    const allowedRoles = [
      "admin",
      "course_adviser",
      "student",
      "lecturer",
    ];

    if (!allowedRoles.includes(decoded.role)) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    // Attach decoded token to the request object
    req.user = decoded;

    

    next(); // Proceed to the route
  } catch (err) {
    return res
      .status(403)
      .json({ error: "Invalid token", details: err.message });
  }
};

module.exports = authMiddleware;
