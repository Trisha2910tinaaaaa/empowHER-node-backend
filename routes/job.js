const express = require("express");
const router = express.Router();
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  applyForJob,
  saveJob,
  updateApplicationStatus,
} = require("../controllers/jobController");
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require("../middleware/auth");

// Public routes
router.get("/", getJobs);
router.get("/:id", getJob);

// Protected routes
router.post("/", authMiddleware, createJob);
router.put("/:id", authMiddleware, updateJob);
router.delete("/:id", authMiddleware, deleteJob);
router.put("/:id/apply", authMiddleware, applyForJob);
router.put("/:id/save", authMiddleware, saveJob);
router.put(
  "/:id/application/:user_id",
  authMiddleware,
  updateApplicationStatus
);

module.exports = router;
