const express = require("express");
const router = express.Router();
const {
  getMyProfile,
  getUserProfile,
  updateProfile,
  addExperience,
  deleteExperience,
  addEducation,
  deleteEducation,
  getJoinedCommunities,
  getAppliedJobs,
  getSavedJobs,
} = require("../controllers/profileController");
const { authMiddleware } = require("../middleware/auth");

// Public routes
router.get("/user/:id", getUserProfile);

// Protected routes
router.get("/", authMiddleware, getMyProfile);
router.put("/", authMiddleware, updateProfile);
router.put("/experience", authMiddleware, addExperience);
router.delete("/experience/:exp_id", authMiddleware, deleteExperience);
router.put("/education", authMiddleware, addEducation);
router.delete("/education/:edu_id", authMiddleware, deleteEducation);
router.get("/communities", authMiddleware, getJoinedCommunities);
router.get("/jobs/applied", authMiddleware, getAppliedJobs);
router.get("/jobs/saved", authMiddleware, getSavedJobs);

module.exports = router;
