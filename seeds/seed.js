const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const User = require("../models/User");
const Community = require("../models/Community");
const Job = require("../models/Job");
const Post = require("../models/Post");

// Sample data
const users = [
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "password123",
    bio: "Platform administrator and community manager",
    skills: ["Leadership", "Community Building", "Project Management"],
    location: "New York, NY",
  },
  {
    name: "Jane Smith",
    email: "jane@example.com",
    password: "password123",
    bio: "Software Engineer with 5 years of experience",
    skills: ["JavaScript", "React", "Node.js", "MongoDB"],
    location: "San Francisco, CA",
  },
  {
    name: "Sarah Johnson",
    email: "sarah@example.com",
    password: "password123",
    bio: "UX/UI Designer passionate about creating intuitive user experiences",
    skills: ["UI Design", "User Research", "Figma", "Adobe XD"],
    location: "Austin, TX",
  },
];

const communities = [
  {
    name: "Women in Tech",
    description: "Support and networking for women in technology fields",
    tags: ["Tech", "Networking", "Career Growth"],
    isPopular: true,
  },
  {
    name: "Career Changers",
    description: "Resources and support for those transitioning to new careers",
    tags: ["Transitions", "Support", "Resources"],
    isPopular: true,
  },
  {
    name: "Entrepreneurship",
    description: "For women building their own businesses and startups",
    tags: ["Business", "Startups", "Networking"],
    isPopular: false,
  },
  {
    name: "Remote Work",
    description: "Tips and opportunities for remote and flexible work",
    tags: ["Remote", "Work-Life Balance", "Jobs"],
    isPopular: true,
  },
  {
    name: "Leadership Skills",
    description: "Developing leadership abilities in professional settings",
    tags: ["Leadership", "Skills", "Development"],
    isPopular: false,
  },
];

const jobs = [
  {
    title: "Frontend Developer",
    company: "TechCorp",
    location: "Remote",
    type: "Full-time",
    description:
      "We are looking for a frontend developer with experience in React and TypeScript.",
    requirements:
      "Bachelor's degree in Computer Science or equivalent experience. 2+ years of experience with React.",
    salary: {
      min: 80000,
      max: 120000,
      currency: "USD",
      period: "yearly",
    },
    skills: ["React", "TypeScript", "CSS", "HTML"],
    benefits: ["Health Insurance", "Remote Work", "Flexible Hours"],
    applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  {
    title: "UX/UI Designer",
    company: "Design Studio",
    location: "San Francisco, CA",
    type: "Full-time",
    description: "Looking for a talented UX/UI designer to join our team.",
    requirements:
      "Portfolio showcasing UI/UX projects. Experience with Figma and Adobe XD.",
    salary: {
      min: 90000,
      max: 130000,
      currency: "USD",
      period: "yearly",
    },
    skills: ["UI Design", "UX Design", "Figma", "Adobe XD"],
    benefits: ["Health Insurance", "Gym Membership", "401k"],
    applicationDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
  },
  {
    title: "Data Scientist",
    company: "DataAnalytics Inc",
    location: "Remote",
    type: "Full-time",
    description:
      "Join our data science team to work on cutting-edge analytics projects.",
    requirements:
      "Master's or PhD in Statistics, Computer Science, or related field. Experience with Python, R, and machine learning.",
    salary: {
      min: 100000,
      max: 150000,
      currency: "USD",
      period: "yearly",
    },
    skills: ["Python", "R", "Machine Learning", "Statistics"],
    benefits: ["Health Insurance", "Remote Work", "Continuing Education"],
    applicationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
  },
];

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

// Seed function
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Community.deleteMany({});
    await Job.deleteMany({});
    await Post.deleteMany({});

    console.log("Database cleared");

    // Create users
    const createdUsers = [];
    for (const user of users) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      // Create user
      const newUser = await User.create({
        ...user,
        password: hashedPassword,
      });

      createdUsers.push(newUser);
    }

    console.log(`${createdUsers.length} users created`);

    // Create communities
    const createdCommunities = [];
    for (const community of communities) {
      // Create community with the admin as creator
      const newCommunity = await Community.create({
        ...community,
        createdBy: createdUsers[0]._id,
        moderators: [createdUsers[0]._id],
        members: [createdUsers[0]._id, createdUsers[1]._id],
      });

      createdCommunities.push(newCommunity);

      // Add some members
      await User.findByIdAndUpdate(createdUsers[0]._id, {
        $addToSet: {
          joinedCommunities: newCommunity._id,
          notifiedCommunities: newCommunity._id,
        },
      });

      await User.findByIdAndUpdate(createdUsers[1]._id, {
        $addToSet: {
          joinedCommunities: newCommunity._id,
          notifiedCommunities: newCommunity._id,
        },
      });
    }

    console.log(`${createdCommunities.length} communities created`);

    // Create jobs
    const createdJobs = [];
    for (const job of jobs) {
      // Create job with the admin as poster
      const newJob = await Job.create({
        ...job,
        postedBy: createdUsers[0]._id,
      });

      createdJobs.push(newJob);
    }

    console.log(`${createdJobs.length} jobs created`);

    // Create some posts in the first community
    const posts = [
      {
        title: "Welcome to the Women in Tech community!",
        content:
          "This is a space for women in tech to share experiences, get advice, and network with each other.",
        author: createdUsers[0]._id,
        community: createdCommunities[0]._id,
        tags: ["Welcome", "Introduction"],
      },
      {
        title: "Upcoming Virtual Networking Event",
        content:
          "Join us for a virtual networking event next Friday at 6 PM EST. We will have breakout rooms, guest speakers, and more!",
        author: createdUsers[1]._id,
        community: createdCommunities[0]._id,
        tags: ["Event", "Networking"],
      },
    ];

    for (const post of posts) {
      const newPost = await Post.create(post);

      // Add post to community
      await Community.findByIdAndUpdate(post.community, {
        $push: { posts: newPost._id },
      });
    }

    console.log(`${posts.length} posts created`);

    console.log("Database seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
