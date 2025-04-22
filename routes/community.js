const express = require("express");
const router = express.Router();
const {
  getCommunities,
  getCommunity,
  createCommunity,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  toggleNotifications,
  createPost,
  getCommunityPosts,
  likePost,
  unlikePost,
  deletePost,
} = require("../controllers/communityController");
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require("../middleware/auth");

// Public routes
router.get("/", getCommunities);
router.get("/:id", getCommunity);
router.get("/:id/posts", getCommunityPosts);
router.put("/:id/join", optionalAuthMiddleware, joinCommunity);
router.post("/:id/posts", optionalAuthMiddleware, createPost);

// Post interaction routes
router.post("/posts/:postId/like", optionalAuthMiddleware, likePost);
router.delete("/posts/:postId/like", optionalAuthMiddleware, unlikePost);
router.delete("/posts/:postId", authMiddleware, deletePost);

// Protected routes
router.post("/", authMiddleware, createCommunity);
router.put("/:id", authMiddleware, updateCommunity);
router.put("/:id/leave", optionalAuthMiddleware, leaveCommunity);
router.put("/:id/notifications", authMiddleware, toggleNotifications);

module.exports = router;
