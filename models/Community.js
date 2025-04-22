const mongoose = require("mongoose");

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Community name is required"],
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    required: [true, "Community description is required"],
  },
  image: {
    type: String,
    default: "",
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  isPopular: {
    type: Boolean,
    default: false,
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  moderators: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  posts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
  events: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for member count
CommunitySchema.virtual("memberCount").get(function () {
  return this.members ? this.members.length : 0;
});

// Set to include virtuals when converting to JSON
CommunitySchema.set("toJSON", { virtuals: true });
CommunitySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Community", CommunitySchema);
