const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/auth");

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgotpassword", forgotPassword);
router.post("/resetpassword/:resettoken", resetPassword);

// Protected routes
router.get("/me", authMiddleware, getMe);
router.get("/logout", authMiddleware, logout);

module.exports = router;
