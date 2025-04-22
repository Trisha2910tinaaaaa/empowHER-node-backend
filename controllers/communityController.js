const Community = require("../models/Community");
const Post = require("../models/Post");
const User = require("../models/User");

// @desc    Get all communities
// @route   GET /api/community
// @access  Public
exports.getCommunities = async (req, res) => {
  try {
    const communities = await Community.find()
      .select("name description image tags isPopular members createdAt")
      .populate("members", "name profileImage");

    res.status(200).json({
      success: true,
      count: communities.length,
      data: communities,
    });
  } catch (error) {
    console.error("Get communities error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get single community
// @route   GET /api/community/:id
// @access  Public
exports.getCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate("members", "name profileImage")
      .populate("moderators", "name profileImage")
      .populate({
        path: "posts",
        select: "title content images author createdAt likes comments",
        populate: {
          path: "author",
          select: "name profileImage",
        },
      });

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(200).json({
      success: true,
      data: community,
    });
  } catch (error) {
    console.error("Get community error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create new community
// @route   POST /api/community
// @access  Private
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, tags, image } = req.body;

    // Check if community with this name already exists
    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res
        .status(400)
        .json({ message: "A community with this name already exists" });
    }

    // Create community
    const community = await Community.create({
      name,
      description,
      tags,
      image,
      createdBy: req.user.id,
      moderators: [req.user.id],
      members: [req.user.id],
    });

    // Add community to user's joined communities
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: {
        joinedCommunities: community._id,
        notifiedCommunities: community._id,
      },
    });

    res.status(201).json({
      success: true,
      data: community,
    });
  } catch (error) {
    console.error("Create community error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update community
// @route   PUT /api/community/:id
// @access  Private (moderators only)
exports.updateCommunity = async (req, res) => {
  try {
    let community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Check if user is a moderator
    if (!community.moderators.includes(req.user.id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this community" });
    }

    // Update fields
    const { name, description, tags, image, isPopular } = req.body;

    if (name) community.name = name;
    if (description) community.description = description;
    if (tags) community.tags = tags;
    if (image) community.image = image;
    if (isPopular !== undefined) community.isPopular = isPopular;

    await community.save();

    res.status(200).json({
      success: true,
      data: community,
    });
  } catch (error) {
    console.error("Update community error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Join a community
// @route   PUT /api/community/:id/join
// @access  Public (was Private)
exports.joinCommunity = async (req, res) => {
  try {
    console.log("Join community request received:", JSON.stringify(req.body));
    console.log(
      "Authorization header:",
      req.headers.authorization ? "Present" : "Not present"
    );

    // Log user context if present
    if (req.user) {
      console.log("User from auth token:", req.user.id);
    }

    // Validate community ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid community ID format",
        provided_id: req.params.id,
      });
    }

    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        message: "Community not found",
        community_id: req.params.id,
      });
    }

    // Priority: Use authenticated user, then look for userId in request body
    let userId = null;

    if (req.user) {
      // User authenticated through token
      console.log("User authenticated via token:", req.user.id);
      userId = req.user.id;
    } else if (req.body && req.body.userId) {
      // Check if the user ID in request body is valid
      console.log("User ID provided in request body:", req.body.userId);

      // Check if userId is in valid ObjectId format
      if (!req.body.userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          message: "Invalid user ID format in request",
          provided_id: req.body.userId,
        });
      }

      try {
        // Try to find the user
        const userExists = await User.findById(req.body.userId);

        if (userExists) {
          console.log("User found in database:", userExists.name);
          userId = req.body.userId;
        } else {
          console.log("User ID provided but user not found in database");
          return res.status(404).json({ message: "User not found" });
        }
      } catch (userError) {
        console.error("Error finding user:", userError.message);
        return res.status(400).json({
          message: "Error processing user ID",
          error: userError.message,
        });
      }
    }

    // If no valid user was found, return a generic success message
    if (!userId) {
      console.log("No valid user ID for joining community");
      return res.status(200).json({
        success: true,
        message: "Authentication required to join community",
        data: {
          _id: community._id,
          name: community.name,
          description: community.description,
          memberCount: community.members.length,
        },
      });
    }

    // Check if user is already a member (convert to string for proper comparison)
    const userIdStr = userId.toString();
    const isAlreadyMember = community.members.some(
      (memberId) => memberId.toString() === userIdStr
    );

    if (isAlreadyMember) {
      console.log("User is already a member of this community");
      return res.status(200).json({
        message: "Already a member",
        success: true,
      });
    }

    console.log("Adding user to community:", userId);
    // Add user to community members
    community.members.push(userId);
    await community.save();

    // Add community to user's joined communities
    await User.findByIdAndUpdate(userId, {
      $addToSet: {
        joinedCommunities: community._id,
        notifiedCommunities: community._id, // Enable notifications by default
      },
    });

    console.log("User successfully joined community");
    res.status(200).json({
      success: true,
      message: "Joined community successfully",
      data: community,
    });
  } catch (error) {
    console.error("Join community error:", error.message);
    console.error("Error stack:", error.stack);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Invalid ID format" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Leave community
// @route   PUT /api/community/:id/leave
// @access  Public (with optional auth)
exports.leaveCommunity = async (req, res) => {
  try {
    console.log("Leave community request received:", JSON.stringify(req.body));
    console.log(
      "Authorization header:",
      req.headers.authorization ? "Present" : "Not present"
    );

    // Log user context if present
    if (req.user) {
      console.log("User from auth token:", req.user.id);
    }

    // Validate community ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid community ID format",
        provided_id: req.params.id,
      });
    }

    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({
        message: "Community not found",
        community_id: req.params.id,
      });
    }

    // Priority: Use authenticated user, then look for userId in request body
    let userId = null;

    if (req.user) {
      // User authenticated through token
      console.log("User authenticated via token:", req.user.id);
      userId = req.user.id;
    } else if (req.body && req.body.userId) {
      // Check if the user ID in request body is valid
      console.log("User ID provided in request body:", req.body.userId);

      // Check if userId is in valid ObjectId format
      if (!req.body.userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          message: "Invalid user ID format in request",
          provided_id: req.body.userId,
        });
      }

      try {
        // Try to find the user
        const userExists = await User.findById(req.body.userId);

        if (userExists) {
          console.log("User found in database:", userExists.name);
          userId = req.body.userId;
        } else {
          console.log("User ID provided but user not found in database");
          return res.status(404).json({ message: "User not found" });
        }
      } catch (userError) {
        console.error("Error finding user:", userError.message);
        return res.status(400).json({
          message: "Error processing user ID",
          error: userError.message,
        });
      }
    }

    // If no valid user was found, return a generic success message
    if (!userId) {
      console.log("No valid user ID for leaving community");
      return res.status(200).json({
        success: true,
        message: "Authentication required to leave community",
        data: {
          _id: community._id,
          name: community.name,
          description: community.description,
          memberCount: community.members.length,
        },
      });
    }

    // Check if user is a member (convert to string for proper comparison)
    const userIdStr = userId.toString();
    const isUserMember = community.members.some(
      (memberId) => memberId.toString() === userIdStr
    );

    if (!isUserMember) {
      console.log("User is not a member of this community");
      return res.status(400).json({
        message: "Not a member of this community",
        success: false,
      });
    }

    // If user is the only moderator, they cannot leave
    const isUserModerator = community.moderators.some(
      (modId) => modId.toString() === userIdStr
    );

    if (
      isUserModerator &&
      community.moderators.length === 1 &&
      community.members.length > 1
    ) {
      return res.status(400).json({
        message:
          "As the only moderator, you cannot leave the community. Assign another moderator first.",
      });
    }

    // Remove user from community members and moderators
    community.members = community.members.filter(
      (member) => member.toString() !== userIdStr
    );

    community.moderators = community.moderators.filter(
      (mod) => mod.toString() !== userIdStr
    );

    await community.save();

    // Remove community from user's joined communities
    await User.findByIdAndUpdate(userId, {
      $pull: {
        joinedCommunities: community._id,
        notifiedCommunities: community._id,
      },
    });

    console.log("User successfully left community");
    res.status(200).json({
      success: true,
      message: "Left community successfully",
    });
  } catch (error) {
    console.error("Leave community error:", error.message);
    console.error("Error stack:", error.stack);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Invalid ID format" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Toggle community notifications
// @route   PUT /api/community/:id/notifications
// @access  Private
exports.toggleNotifications = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Check if user is a member
    if (!community.members.includes(req.user.id)) {
      return res
        .status(400)
        .json({ message: "Not a member of this community" });
    }

    const user = await User.findById(req.user.id);

    // Check if notifications are already enabled
    const hasNotifications = user.notifiedCommunities.includes(community._id);

    if (hasNotifications) {
      // Disable notifications
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { notifiedCommunities: community._id },
      });

      res.status(200).json({
        success: true,
        message: "Notifications disabled",
      });
    } else {
      // Enable notifications
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { notifiedCommunities: community._id },
      });

      res.status(200).json({
        success: true,
        message: "Notifications enabled",
      });
    }
  } catch (error) {
    console.error("Toggle notifications error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a post in community
// @route   POST /api/community/:id/posts
// @access  Public (was Private)
exports.createPost = async (req, res) => {
  try {
    console.log("Create post request received:", req.body);

    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // Get author information - priority from authentication, then userId in request, then fallback to authorName
    let author;
    let authorName;

    if (req.user) {
      // User is authenticated via token
      console.log("User authenticated via token:", req.user.id);
      author = req.user.id;
      authorName = req.user.name;
    } else if (req.body.userId) {
      // User ID provided in request
      console.log("User ID provided in request:", req.body.userId);

      // Verify the user exists
      const userExists = await User.findById(req.body.userId);
      if (userExists) {
        author = req.body.userId;
        authorName = req.body.authorName || userExists.name;
        console.log("User found in database:", userExists.name);
      } else {
        console.log("User ID provided but user not found in database");
        authorName = req.body.authorName || "Anonymous User";
      }
    } else {
      // Non-authenticated user - use provided name or default
      authorName = req.body.authorName || "Anonymous User";
      console.log("Using anonymous author:", authorName);
    }

    // If we have a valid author ID, ensure they're a member of the community
    if (author) {
      // Check if user is already a member
      if (!community.members.includes(author)) {
        console.log("Adding user to community members:", author);
        // Add user to community members
        community.members.push(author);

        // Add community to user's joined communities
        await User.findByIdAndUpdate(author, {
          $addToSet: {
            joinedCommunities: community._id,
            notifiedCommunities: community._id,
          },
        });

        await community.save();
        console.log("User added to community successfully");
      } else {
        console.log("User is already a community member");
      }
    }

    // Extract content from request - handle both direct content field and nested content
    const title = req.body.title || "Post";
    const content = req.body.content || "";
    const images = req.body.images || [];
    const tags = req.body.tags || [];

    console.log("Processing post data:", { title, content, authorName });

    // Create post with or without authenticated author
    const postData = {
      title,
      content,
      images,
      tags,
      community: community._id,
    };

    // Add author if authenticated, otherwise use name
    if (author) {
      postData.author = author;
    }

    // Always include authorName for display purposes
    postData.authorName = authorName;

    console.log("Creating post with data:", postData);
    const post = await Post.create(postData);

    // Add post to community
    community.posts.push(post._id);
    await community.save();

    // Populate author info if available
    if (author) {
      await post.populate("author", "name profileImage");
    }

    console.log("Post created successfully:", post);
    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error("Create post error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get community posts
// @route   GET /api/community/:id/posts
// @access  Public
exports.getCommunityPosts = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    const posts = await Post.find({ community: req.params.id })
      .sort({ createdAt: -1 })
      .populate("author", "name profileImage")
      .populate({
        path: "comments.user",
        select: "name profileImage",
      });

    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts,
    });
  } catch (error) {
    console.error("Get community posts error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Community not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Like a post
// @route   POST /api/community/posts/:postId/like
// @access  Public (optional auth)
exports.likePost = async (req, res) => {
  try {
    console.log("Like post request received for post:", req.params.postId);

    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if we have a user (either from auth or request body)
    let userId = null;

    if (req.user) {
      // From authentication
      userId = req.user.id;
      console.log("Authenticated user liking post:", userId);
    } else if (req.body.userId) {
      // From request body
      const userExists = await User.findById(req.body.userId);
      if (userExists) {
        userId = req.body.userId;
        console.log("User from request body liking post:", userId);
      }
    }

    // If no valid user, return appropriate response
    if (!userId) {
      return res.status(200).json({
        success: false,
        message: "Authentication required to like posts",
      });
    }

    // Check if post is already liked by user
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: "Post already liked" });
    }

    // Add user to post likes
    post.likes.push(userId);
    await post.save();

    console.log("Post liked successfully");

    res.status(200).json({
      success: true,
      message: "Post liked successfully",
      likeCount: post.likes.length,
      data: post,
    });
  } catch (error) {
    console.error("Like post error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Unlike a post
// @route   DELETE /api/community/posts/:postId/like
// @access  Public (optional auth)
exports.unlikePost = async (req, res) => {
  try {
    console.log("Unlike post request received for post:", req.params.postId);

    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if we have a user (either from auth or request body)
    let userId = null;

    if (req.user) {
      // From authentication
      userId = req.user.id;
      console.log("Authenticated user unliking post:", userId);
    } else if (req.body.userId) {
      // From request body
      const userExists = await User.findById(req.body.userId);
      if (userExists) {
        userId = req.body.userId;
        console.log("User from request body unliking post:", userId);
      }
    }

    // If no valid user, return appropriate response
    if (!userId) {
      return res.status(200).json({
        success: false,
        message: "Authentication required to unlike posts",
      });
    }

    // Check if post is not liked by user
    if (!post.likes.includes(userId)) {
      return res.status(400).json({ message: "Post not liked yet" });
    }

    // Remove user from post likes
    post.likes = post.likes.filter(
      (like) => like.toString() !== userId.toString()
    );
    await post.save();

    console.log("Post unliked successfully");

    res.status(200).json({
      success: true,
      message: "Post unliked successfully",
      likeCount: post.likes.length,
      data: post,
    });
  } catch (error) {
    console.error("Unlike post error:", error.message);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete a post
// @route   DELETE /api/community/posts/:postId
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    console.log("Delete post request received for post:", req.params.postId);

    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user is the author or community creator
    let isAuthorized = false;

    // Check if user is the author
    if (post.author && post.author.toString() === req.user.id) {
      console.log("User is the author of the post");
      isAuthorized = true;
    } else {
      // Check if user is community creator/moderator
      const community = await Community.findById(post.community);
      const isCommunityCreator =
        community &&
        community.creator &&
        community.creator.toString() === req.user.id;
      const isModerator =
        community &&
        community.moderators &&
        community.moderators.includes(req.user.id);

      if (isCommunityCreator || isModerator) {
        console.log("User is community creator or moderator");
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        message:
          "Not authorized to delete this post. Only the author or community moderators can delete posts.",
      });
    }

    // Remove post from community
    if (post.community) {
      await Community.findByIdAndUpdate(post.community, {
        $pull: { posts: post._id },
      });
    }

    // Delete post
    await Post.findByIdAndDelete(req.params.postId);
    console.log("Post deleted successfully");

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error.message);
    console.error("Error stack:", error.stack);

    if (error.kind === "ObjectId") {
      return res.status(404).json({ message: "Invalid post ID format" });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};
