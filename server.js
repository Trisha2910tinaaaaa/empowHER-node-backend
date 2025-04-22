const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/db");
const { authMiddleware, optionalAuthMiddleware } = require("./middleware/auth");
const mongoose = require("mongoose");

// Import routes
const authRoutes = require("./routes/auth");
const communityRoutes = require("./routes/community");
const profileRoutes = require("./routes/profile");
const jobRoutes = require("./routes/job");

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Enhance CORS configuration for better frontend-backend communication
const corsOptions = {
  origin: process.env.FRONTEND_URL || [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
    "https://empow-her.vercel.app",
    "https://empowher.vercel.app",
    "https://empowher-six.vercel.app",
    "https://empowher-git-main-trisha2910tinaaaaas-projects.vercel.app",
    "https://empowher-cu3enmcsd-trisha2910tinaaaaas-projects.vercel.app",
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "x-auth-token",
    "Cache-Control",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours for preflight results caching
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Add a health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Backend API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Add HEAD method for health checks
app.head("/api/health", (req, res) => {
  res.status(200).end();
});

// Connect to MongoDB
connectDB().then(async (connection) => {
  // Initialize saved_jobs collection with indexes
  try {
    const db = connection.connection.db;

    // Check if the collection exists, if not create it
    const collections = await db
      .listCollections({ name: "saved_jobs" })
      .toArray();
    if (collections.length === 0) {
      console.log("Creating saved_jobs collection...");
      await db.createCollection("saved_jobs");
    }

    // Create indexes for saved_jobs collection
    const savedJobsCollection = db.collection("saved_jobs");
    await savedJobsCollection.createIndexes([
      { key: { user_id: 1 }, name: "user_id_idx" },
      { key: { job_id: 1 }, name: "job_id_idx" },
      { key: { application_url: 1 }, name: "application_url_idx" },
      { key: { saved_at: -1 }, name: "saved_at_idx" },
    ]);

    console.log("Saved jobs collection initialized with indexes");
  } catch (error) {
    console.error("Error initializing saved_jobs collection:", error);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/job", jobRoutes);

// Add a special route for jobs/save to match the FastAPI endpoint
app.post("/api/jobs/save", optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const jobData = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!jobData.application_url) {
      return res.status(400).json({
        success: false,
        message: "Job application URL is required",
      });
    }

    // Get the MongoDB database
    const db = mongoose.connection.db;
    const savedJobsCollection = db.collection("saved_jobs");

    // Check if this job is already saved by this user
    const existingJob = await savedJobsCollection.findOne({
      user_id: userId,
      application_url: jobData.application_url,
    });

    // Toggle saved/unsaved
    let is_saved = true;
    if (existingJob) {
      // Job already saved, remove it
      await savedJobsCollection.deleteOne({ _id: existingJob._id });
      is_saved = false;
      console.log(`Removed saved job for user ${userId}: ${jobData.title}`);
    } else {
      // Add new job with generated ID and timestamp
      const savedJob = {
        ...jobData,
        job_id: "job-" + Date.now(),
        saved_at: new Date(),
        user_id: userId,
      };
      await savedJobsCollection.insertOne(savedJob);
      console.log(`Saved job for user ${userId}: ${jobData.title}`);
    }

    return res.status(200).json({
      success: true,
      message: is_saved
        ? "Job saved successfully"
        : "Job removed from saved jobs",
      is_saved: is_saved,
    });
  } catch (error) {
    console.error("Save job error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Special route for jobs/saved/:userId to match the FastAPI endpoint
app.get("/api/jobs/saved/:userId", optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    // Get the MongoDB database
    const db = mongoose.connection.db;
    const savedJobsCollection = db.collection("saved_jobs");

    // Query for this user's saved jobs
    const total = await savedJobsCollection.countDocuments({ user_id: userId });
    const userJobs = await savedJobsCollection
      .find({ user_id: userId })
      .sort({ saved_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    console.log(
      `Getting saved jobs for user ${userId} from MongoDB, found ${userJobs.length} jobs`
    );

    // Convert ObjectId to string for each job
    userJobs.forEach((job) => {
      if (job._id) {
        job._id = job._id.toString();
      }
      // Convert date objects to ISO format strings
      if (job.saved_at && job.saved_at instanceof Date) {
        job.saved_at = job.saved_at.toISOString();
      }
    });

    return res.status(200).json({
      success: true,
      total: total,
      limit: limit,
      skip: skip,
      jobs: userJobs,
    });
  } catch (error) {
    console.error("Get saved jobs error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Delete a saved job
app.delete(
  "/api/jobs/saved/:userId/:jobId",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const jobId = req.params.jobId;

      if (!userId || !jobId) {
        return res.status(400).json({
          success: false,
          message: "User ID and Job ID are required",
        });
      }

      // Get the MongoDB database
      const db = mongoose.connection.db;
      const savedJobsCollection = db.collection("saved_jobs");

      // Delete the job
      const result = await savedJobsCollection.deleteOne({
        user_id: userId,
        job_id: jobId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Saved job not found",
        });
      }

      console.log(`Deleted saved job ${jobId} for user ${userId}`);

      return res.status(200).json({
        success: true,
        message: "Job removed from saved jobs",
      });
    } catch (error) {
      console.error("Delete saved job error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// Add global error handler middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || "An unexpected error occurred";

  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Add 404 handler for unmatched routes
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

// Improve CORS handling by directly handling preflight requests with appropriate headers
app.options("*", cors(corsOptions));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
