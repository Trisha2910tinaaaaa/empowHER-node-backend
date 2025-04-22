const Job = require("../models/Job");
const User = require("../models/User");

// @desc    Get all jobs
// @route   GET /api/job
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    // Set up pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // Set up filtering
    const filter = { isActive: true };

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.location) {
      filter.location = { $regex: req.query.location, $options: "i" };
    }

    // Set up sorting
    let sort = {};

    if (req.query.sort === "latest") {
      sort = { createdAt: -1 };
    } else if (req.query.sort === "salary") {
      sort = { "salary.min": -1 };
    } else {
      sort = { createdAt: -1 }; // Default sort
    }

    // Execute query
    const jobs = await Job.find(filter)
      .sort(sort)
      .skip(startIndex)
      .limit(limit)
      .select(
        "title company location type description salary skills benefits companyLogo createdAt"
      )
      .populate("postedBy", "name");

    // Get total count for pagination
    const total = await Job.countDocuments(filter);

    // Pagination result
    const pagination = {
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };

    res.status(200).json({
      success: true,
      count: jobs.length,
      pagination,
      data: jobs,
    });
  } catch (error) {
    console.error("Get jobs error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single job
// @route   GET /api/job/:id
// @access  Public
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("postedBy", "name profileImage")
      .populate({
        path: "applicants.user",
        select: "name profileImage",
      });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Get job error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create new job
// @route   POST /api/job
// @access  Private
exports.createJob = async (req, res) => {
  try {
    const {
      title,
      company,
      location,
      type,
      description,
      requirements,
      salary,
      skills,
      benefits,
      applicationLink,
      applicationDeadline,
      companyLogo,
    } = req.body;

    const job = await Job.create({
      title,
      company,
      location,
      type,
      description,
      requirements,
      salary,
      skills,
      benefits,
      applicationLink,
      applicationDeadline,
      companyLogo,
      postedBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Create job error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update job
// @route   PUT /api/job/:id
// @access  Private (job poster only)
exports.updateJob = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check job belongs to user
    if (job.postedBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this job" });
    }

    // Update job
    job = await Job.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Update job error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete job
// @route   DELETE /api/job/:id
// @access  Private (job poster only)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check job belongs to user
    if (job.postedBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this job" });
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      message: "Job removed",
    });
  } catch (error) {
    console.error("Delete job error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Apply for job
// @route   PUT /api/job/:id/apply
// @access  Private
exports.applyForJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if already applied
    if (job.applicants.some((app) => app.user.toString() === req.user.id)) {
      return res.status(400).json({ message: "Already applied for this job" });
    }

    // Check if application deadline has passed
    if (
      job.applicationDeadline &&
      new Date(job.applicationDeadline) < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Application deadline has passed" });
    }

    const { resume, coverLetter } = req.body;

    // Add user to job applicants
    job.applicants.unshift({
      user: req.user.id,
      resume,
      coverLetter,
      status: "applied",
      appliedAt: Date.now(),
    });

    await job.save();

    // Add job to user's applied jobs
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        appliedJobs: {
          job: job._id,
          status: "applied",
          appliedAt: Date.now(),
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Applied for job successfully",
    });
  } catch (error) {
    console.error("Apply for job error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Save job
// @route   PUT /api/job/:id/save
// @access  Private
exports.saveJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;

    // Use the static method from the Job model
    const result = await Job.toggleSave(jobId, userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Save job error:", error.message);

    if (error.message === "Job not found" || error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job not found" });
    }

    if (error.message === "User not found") {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update application status (for job poster)
// @route   PUT /api/job/:id/application/:user_id
// @access  Private (job poster only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (
      !["applied", "reviewing", "interview", "rejected", "accepted"].includes(
        status
      )
    ) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check job belongs to user
    if (job.postedBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to update application status" });
    }

    // Find applicant
    const applicationIndex = job.applicants.findIndex(
      (app) => app.user.toString() === req.params.user_id
    );

    if (applicationIndex === -1) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Update applicant status
    job.applicants[applicationIndex].status = status;
    await job.save();

    // Update status in user's applied jobs
    await User.updateOne(
      {
        _id: req.params.user_id,
        "appliedJobs.job": req.params.id,
      },
      {
        $set: { "appliedJobs.$.status": status },
      }
    );

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update application status error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Job or user not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};
