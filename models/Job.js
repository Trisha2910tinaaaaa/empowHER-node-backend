const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Job title is required"],
    trim: true,
  },
  company: {
    type: String,
    required: [true, "Company name is required"],
    trim: true,
  },
  location: {
    type: String,
    required: [true, "Job location is required"],
    trim: true,
  },
  type: {
    type: String,
    enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"],
    required: [true, "Job type is required"],
  },
  description: {
    type: String,
    required: [true, "Job description is required"],
  },
  requirements: {
    type: String,
    required: [true, "Job requirements are required"],
  },
  salary: {
    min: {
      type: Number,
    },
    max: {
      type: Number,
    },
    currency: {
      type: String,
      default: "USD",
    },
    period: {
      type: String,
      enum: ["hourly", "monthly", "yearly"],
      default: "yearly",
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  skills: [
    {
      type: String,
      trim: true,
    },
  ],
  benefits: [
    {
      type: String,
      trim: true,
    },
  ],
  applicationLink: {
    type: String,
  },
  applicationDeadline: {
    type: Date,
  },
  companyLogo: {
    type: String,
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  applicants: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      status: {
        type: String,
        enum: ["applied", "reviewing", "interview", "rejected", "accepted"],
        default: "applied",
      },
      appliedAt: {
        type: Date,
        default: Date.now,
      },
      resume: {
        type: String,
      },
      coverLetter: {
        type: String,
      },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure indexes for easier searching
JobSchema.index({
  title: "text",
  company: "text",
  location: "text",
  description: "text",
  skills: "text",
});

// Virtual for applicant count
JobSchema.virtual("applicantCount").get(function () {
  return this.applicants.length;
});

// Set to include virtuals when converting to JSON
JobSchema.set("toJSON", { virtuals: true });
JobSchema.set("toObject", { virtuals: true });

// Static method to save/unsave a job for a user
JobSchema.statics.toggleSave = async function (jobId, userId) {
  try {
    // Find the job by ID
    const job = await this.findById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Find the user
    const User = mongoose.model("User");
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if job is already saved
    const isSaved = user.savedJobs.includes(job._id);
    let result;

    if (isSaved) {
      // Unsave job
      result = await User.findByIdAndUpdate(
        userId,
        { $pull: { savedJobs: job._id } },
        { new: true }
      );
      return { success: true, message: "Job unsaved", isSaved: false };
    } else {
      // Save job
      result = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { savedJobs: job._id } },
        { new: true }
      );
      return { success: true, message: "Job saved", isSaved: true };
    }
  } catch (error) {
    console.error("Toggle save job error:", error.message);
    throw error;
  }
};

module.exports = mongoose.model("Job", JobSchema);
