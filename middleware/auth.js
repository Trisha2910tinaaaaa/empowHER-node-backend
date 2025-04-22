const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware that validates JWT token
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get the token from cookies or authorization header
    const token =
      req.cookies.token ||
      req.cookies.auth_token ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);

    // Log authentication attempt details for debugging
    console.log("Auth attempt:", {
      hasToken: !!token,
      tokenPrefix: token ? token.substring(0, 10) + "..." : "none",
      headers: {
        authorization: req.headers.authorization ? "present" : "missing",
        cookie: req.headers.cookie ? "present" : "missing",
      },
      cookies: {
        token: req.cookies.token ? "present" : "missing",
        auth_token: req.cookies.auth_token ? "present" : "missing",
      },
      endpoint: req.originalUrl,
    });

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
        error: "No token provided",
        help: "Please login to access this resource",
      });
    }

    // Check if JWT_SECRET is properly set
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing or empty in environment variables");
      return res.status(500).json({
        message: "Server configuration error",
        error: "Auth system misconfigured",
      });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user exists
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        console.warn(`User not found for ID ${decoded.id} from valid token`);
        return res.status(401).json({
          message: "User not found",
          error: "Account may have been deleted",
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (tokenError) {
      // More detailed token error handling
      if (tokenError.name === "TokenExpiredError") {
        console.warn(
          "Token expired:",
          tokenError.message,
          "expiry:",
          tokenError.expiredAt
        );
        return res.status(401).json({
          message: "Authentication expired",
          error: "Token has expired",
          help: "Please login again to continue",
        });
      } else if (tokenError.name === "JsonWebTokenError") {
        console.warn("Invalid token:", tokenError.message);
        return res.status(401).json({
          message: "Invalid authentication",
          error: tokenError.message,
          help: "Please login again with valid credentials",
        });
      } else {
        console.error("Unexpected token error:", tokenError);
        return res.status(401).json({
          message: "Authentication failed",
          error: "Token verification failed",
        });
      }
    }
  } catch (error) {
    console.error("Auth middleware critical error:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      message: "Server authentication error",
      error: "Internal server error during authentication",
    });
  }
};

/**
 * Optional authentication middleware that doesn't require authentication
 * but attaches user to request if token is valid
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Get the token from cookies or authorization header
    const token =
      req.cookies.token ||
      req.cookies.auth_token ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists
    const user = await User.findById(decoded.id).select("-password");
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Just continue without authentication
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
};
