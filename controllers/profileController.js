const User = require("../models/User");
const Community = require("../models/Community");
const Job = require("../models/Job");
const mongoose = require("mongoose");

// @desc    Get current user's profile
// @route   GET /api/profile
// @access  Private
exports.getMyProfile = async (req, res) => {
  try {
    console.log("getMyProfile called for user:", {
      userId: req.user?._id || req.user?.id || "unknown",
      headers: {
        contentType: req.headers["content-type"] || "none",
        userAgent: req.headers["user-agent"] || "none",
      },
      query: req.query,
    });

    // Validate that we have a user in the request
    if (!req.user || !req.user.id) {
      console.error("getMyProfile called without valid user in request");
      return res.status(400).json({
        success: false,
        message: "User information missing from request",
        error: "Authentication may have failed or user session is invalid",
      });
    }

    try {
      // First try a simple find to check if user exists
      const userExists = await User.exists({ _id: req.user.id });
      if (!userExists) {
        console.warn(`User with ID ${req.user.id} not found in the database`);
        return res.status(404).json({
          success: false,
          message: "User not found",
          error: "The user profile could not be located",
        });
      }

      console.log(
        `User ${req.user.id} exists, attempting to fetch complete profile`
      );

      // Now attempt to find the user with all related data
      let user = await User.findById(req.user.id).select("-password");

      // Initialize empty arrays for safety if they don't exist
      if (!user.joinedCommunities) user.joinedCommunities = [];
      if (!user.appliedJobs) user.appliedJobs = [];
      if (!user.savedJobs) user.savedJobs = [];
      if (!user.experience) user.experience = [];
      if (!user.education) user.education = [];
      if (!user.skills) user.skills = [];

      // Safely populate related data with error handling
      try {
        // Only attempt to populate if there are communities to populate
        if (user.joinedCommunities.length > 0) {
          const communitiesPopulated = await User.findById(req.user.id)
            .select("-password")
            .populate("joinedCommunities", "name image memberCount");

          if (communitiesPopulated && communitiesPopulated.joinedCommunities) {
            user.joinedCommunities = communitiesPopulated.joinedCommunities;
          }
        }

        // Only attempt to populate if there are applied jobs to populate
        if (user.appliedJobs.length > 0) {
          const jobsPopulated = await User.findById(req.user.id)
            .select("-password")
            .populate({
              path: "appliedJobs.job",
              select: "title company location type",
            });

          if (jobsPopulated && jobsPopulated.appliedJobs) {
            user.appliedJobs = jobsPopulated.appliedJobs;
          }
        }
      } catch (populateError) {
        console.error("Error populating related data:", populateError.message);
        // Continue without population if it fails
      }

      // Check if critical user data exists
      if (!user.name || !user.email) {
        console.warn(`User ${req.user.id} has incomplete profile data`);
      }

      console.log(`Successfully retrieved profile for user ${req.user.id}`);
      console.log("Profile data summary:", {
        hasJoinedCommunities: Array.isArray(user.joinedCommunities)
          ? user.joinedCommunities.length
          : "not an array",
        hasAppliedJobs: Array.isArray(user.appliedJobs)
          ? user.appliedJobs.length
          : "not an array",
        hasSavedJobs: Array.isArray(user.savedJobs)
          ? user.savedJobs.length
          : "not an array",
        hasSkills: Array.isArray(user.skills)
          ? user.skills.length
          : "not an array",
      });

      // Return the user profile
      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (dbError) {
      console.error("Database error in getMyProfile:", dbError.message);
      console.error(dbError.stack);

      // Provide more specific error messages for common database errors
      if (dbError.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
          error: dbError.message,
        });
      } else if (dbError.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          error: dbError.message,
        });
      }

      // Generic database error
      return res.status(500).json({
        success: false,
        message: "Database error occurred while retrieving profile",
        error: dbError.message,
      });
    }
  } catch (error) {
    // Catch any other unexpected errors
    console.error("Unexpected error in getMyProfile:", error.message);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: "Server error while retrieving profile",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Get user profile by ID
// @route   GET /api/profile/:id
// @access  Public
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -email -savedJobs -appliedJobs -notifiedCommunities")
      .populate("joinedCommunities", "name image memberCount");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user profile error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      bio,
      skills,
      location,
      title,
      website,
      phone,
      profileImage,
      email,
      socialLinks,
    } = req.body;

    console.log("Profile update request received:", {
      userId: req.user.id,
      bodyFields: Object.keys(req.body),
      emailProvided: !!email,
      skillsProvided: !!skills,
      skillsType: skills
        ? Array.isArray(skills)
          ? "array"
          : typeof skills
        : "not provided",
    });

    // Build profile object
    const profileFields = {};
    if (name) profileFields.name = name;
    if (bio) profileFields.bio = bio;
    if (location) profileFields.location = location;
    if (title) profileFields.title = title;
    if (website) profileFields.website = website;
    if (phone) profileFields.phone = phone;
    if (profileImage) profileFields.profileImage = profileImage;
    if (email) profileFields.email = email;

    // Build skills array with extra validation
    if (skills) {
      if (Array.isArray(skills)) {
        // Filter out empty strings and ensure all elements are strings
        profileFields.skills = skills
          .map((skill) => String(skill).trim())
          .filter((skill) => skill.length > 0);

        console.log(
          `Processing skills array with ${skills.length} items, resulted in ${profileFields.skills.length} valid skills`
        );
      } else if (typeof skills === "string") {
        // Parse comma-separated string to array
        profileFields.skills = skills
          .split(",")
          .map((skill) => skill.trim())
          .filter((skill) => skill.length > 0);

        console.log(
          `Parsed skills string into array with ${profileFields.skills.length} items`
        );
      } else {
        console.warn(`Unexpected skills format received: ${typeof skills}`);
      }
    }

    // Build social object with validation
    if (socialLinks) {
      if (typeof socialLinks === "object" && !Array.isArray(socialLinks)) {
        profileFields.socialLinks = socialLinks;
      } else if (typeof socialLinks === "string") {
        try {
          // Attempt to parse if it's a JSON string
          profileFields.socialLinks = JSON.parse(socialLinks);
        } catch (e) {
          console.warn(`Error parsing socialLinks JSON: ${e.message}`);
        }
      }
    }

    console.log(
      "Updating profile with data:",
      JSON.stringify(profileFields, null, 2)
    );

    // Find user first to validate existence
    const existingUser = await User.findById(req.user.id);
    if (!existingUser) {
      console.error(`User with ID ${req.user.id} not found for profile update`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user with validated fields
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: profileFields },
      { new: true, runValidators: true }
    ).select("-password");

    // Add updatedAt timestamp if not automatically handled
    if (!user.updatedAt) {
      user.updatedAt = new Date();
      await user.save();
    }

    console.log(`Profile updated successfully for user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    console.error(error.stack);

    // Check for validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }

    // Check for duplicate key errors (e.g., email)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        field: field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Add profile experience
// @route   PUT /api/profile/experience
// @access  Private
exports.addExperience = async (req, res) => {
  try {
    const { title, company, location, from, to, current, description } =
      req.body;

    const newExp = {
      title,
      company,
      location,
      from,
      to,
      current,
      description,
    };

    const user = await User.findById(req.user.id);

    user.experience.unshift(newExp); // Add to beginning of array
    await user.save();

    res.status(200).json({
      success: true,
      data: user.experience,
    });
  } catch (error) {
    console.error("Add experience error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete profile experience
// @route   DELETE /api/profile/experience/:exp_id
// @access  Private
exports.deleteExperience = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Get remove index
    const removeIndex = user.experience.findIndex(
      (exp) => exp._id.toString() === req.params.exp_id
    );

    if (removeIndex === -1) {
      return res.status(404).json({ message: "Experience not found" });
    }

    user.experience.splice(removeIndex, 1);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.experience,
    });
  } catch (error) {
    console.error("Delete experience error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Add profile education
// @route   PUT /api/profile/education
// @access  Private
exports.addEducation = async (req, res) => {
  try {
    const { school, degree, fieldOfStudy, from, to, current, description } =
      req.body;

    const newEdu = {
      school,
      degree,
      fieldOfStudy,
      from,
      to,
      current,
      description,
    };

    const user = await User.findById(req.user.id);

    user.education.unshift(newEdu); // Add to beginning of array
    await user.save();

    res.status(200).json({
      success: true,
      data: user.education,
    });
  } catch (error) {
    console.error("Add education error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete profile education
// @route   DELETE /api/profile/education/:edu_id
// @access  Private
exports.deleteEducation = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Get remove index
    const removeIndex = user.education.findIndex(
      (edu) => edu._id.toString() === req.params.edu_id
    );

    if (removeIndex === -1) {
      return res.status(404).json({ message: "Education not found" });
    }

    user.education.splice(removeIndex, 1);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.education,
    });
  } catch (error) {
    console.error("Delete education error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get user's joined communities
// @route   GET /api/profile/communities
// @access  Private
exports.getJoinedCommunities = async (req, res) => {
  try {
    console.log(`getJoinedCommunities called for user ID: ${req.user.id}`);

    // Find user with proper error handling
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error(`User with ID ${req.user.id} not found`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Safely access user.joinedCommunities with a fallback to empty array
    const joinedCommunities = user.joinedCommunities || [];
    console.log(`User has ${joinedCommunities.length} joined communities`);

    // If no communities, return early with empty array
    if (!joinedCommunities.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Filter out any invalid IDs to prevent query errors
    const validCommunityIds = joinedCommunities.filter(
      (id) => id && mongoose.Types.ObjectId.isValid(id)
    );

    if (!validCommunityIds.length) {
      console.log("No valid community IDs found");
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Now fetch the communities with valid IDs
    const communities = await Community.find({
      _id: { $in: validCommunityIds },
    }).select("name description image tags isPopular members");

    console.log(
      `Found ${communities.length} community documents that user has joined`
    );

    res.status(200).json({
      success: true,
      count: communities.length,
      data: communities,
    });
  } catch (error) {
    console.error(
      `Get joined communities error for user ${req.user?.id}:`,
      error.message
    );
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: "Server error retrieving joined communities",
      error: error.message,
    });
  }
};

// @desc    Get user's applied jobs
// @route   GET /api/profile/jobs/applied
// @access  Private
exports.getAppliedJobs = async (req, res) => {
  try {
    console.log(`getAppliedJobs called for user ID: ${req.user.id}`);

    // Find user with proper error handling
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error(`User with ID ${req.user.id} not found`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Safely access user.appliedJobs with a fallback to empty array
    const appliedJobs = user.appliedJobs || [];
    console.log(`User has ${appliedJobs.length} applied jobs`);

    // If no applied jobs, return early with empty array
    if (!appliedJobs.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Create an array of job IDs from appliedJobs
    const jobIds = appliedJobs
      .map((application) => application.job)
      .filter(Boolean);

    if (!jobIds.length) {
      console.log("No valid job IDs found in applied jobs");
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Fetch the actual job data
    const jobs = await Job.find({
      _id: { $in: jobIds },
    }).select(
      "title company location type description salary applicationDeadline"
    );

    console.log(`Found ${jobs.length} job documents for user's applied jobs`);

    // Map jobs to include application status with safety checks
    const jobsWithStatus = jobs.map((job) => {
      const application = appliedJobs.find(
        (app) => app.job && app.job.toString() === job._id.toString()
      );

      return {
        job,
        status: application?.status || "applied",
        appliedAt: application?.appliedAt || new Date(),
      };
    });

    res.status(200).json({
      success: true,
      count: jobsWithStatus.length,
      data: jobsWithStatus,
    });
  } catch (error) {
    console.error(
      `Get applied jobs error for user ${req.user?.id}:`,
      error.message
    );
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: "Server error retrieving applied jobs",
      error: error.message,
    });
  }
};

// @desc    Get user's saved jobs
// @route   GET /api/profile/jobs/saved
// @access  Private
exports.getSavedJobs = async (req, res) => {
  try {
    console.log(`getSavedJobs called for user ID: ${req.user.id}`);

    // Find user with proper error handling
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error(`User with ID ${req.user.id} not found`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Safely access user.savedJobs with a fallback to empty array
    const savedJobs = user.savedJobs || [];
    console.log(`User has ${savedJobs.length} saved jobs`);

    // If no saved jobs, return early with empty array
    if (!savedJobs.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Filter out any null or undefined IDs
    const validJobIds = savedJobs.filter(Boolean);

    // Fetch the actual job data
    const jobs = await Job.find({
      _id: { $in: validJobIds },
    }).select(
      "title company location type description salary applicationDeadline"
    );

    console.log(`Found ${jobs.length} job documents for user's saved jobs`);

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    console.error(
      `Get saved jobs error for user ${req.user?.id}:`,
      error.message
    );
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: "Server error retrieving saved jobs",
      error: error.message,
    });
  }
};
