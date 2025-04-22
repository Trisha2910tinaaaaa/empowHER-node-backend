const mongoose = require("mongoose");

/**
 * Connect to MongoDB database with improved connection options and error handling
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error("MONGODB_URI environment variable is not set");
      throw new Error("MongoDB connection string is missing");
    }

    console.log(`Attempting to connect to MongoDB...`);

    // Check if we're already connected
    if (mongoose.connection.readyState === 1) {
      console.log("MongoDB already connected");
      return mongoose;
    }

    // Connection options for reliability - using only supported options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      serverSelectionTimeoutMS: 15000, // 15 seconds
      family: 4, // Use IPv4, skip trying IPv6
      // Remove unsupported options:
      // autoReconnect: true,
      // reconnectTries: Number.MAX_VALUE,
      // reconnectInterval: 2000
    };

    const conn = await mongoose.connect(mongoUri, options);

    console.log(
      `MongoDB Connected: ${conn.connection.host} (readyState: ${mongoose.connection.readyState})`
    );

    // Set up more comprehensive connection event listeners
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
      console.error(err.stack);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting to reconnect...");
      // Mongoose will automatically try to reconnect
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected successfully");
    });

    // Additional events
    mongoose.connection.on("close", () => {
      console.log("MongoDB connection closed");
    });

    mongoose.connection.on("timeout", () => {
      console.error("MongoDB connection timeout. Trying to reconnect...");
    });

    // Enable debugging in development
    if (process.env.NODE_ENV === "development") {
      mongoose.set("debug", true);
    }

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB:`, error);
    console.error(error.stack);

    // Check for common connection errors and provide helpful messages
    if (error.name === "MongoServerSelectionError") {
      console.error(
        "Could not connect to any MongoDB servers. Please check your connection string and make sure MongoDB is running."
      );

      // Log connection details for debugging (without exposing full credentials)
      const sanitizedUri = mongoUri.replace(
        /mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/,
        "mongodb$1://$2:****@"
      );
      console.error(`Attempted connection with: ${sanitizedUri}`);
    } else if (error.name === "MongoParseError") {
      console.error(
        "Invalid MongoDB connection string. Please check your MONGODB_URI format."
      );
    } else if (error.code === "ENOTFOUND") {
      console.error(
        "MongoDB host not found. Please check the hostname in your connection string."
      );
    } else if (error.code === "ETIMEDOUT") {
      console.error(
        "MongoDB connection timed out. Server may be down or network issues may be present."
      );
    }

    // Don't exit the process immediately in development to allow for graceful handling
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Terminating application due to database connection failure"
      );
      process.exit(1);
    }

    // In development, return a mock connection or throw to let the application handle it
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Running in development mode - continuing without MongoDB connection"
      );
      // Return a mock connection object for development
      return {
        connection: { host: "none (development fallback)" },
        isDevFallback: true,
      };
    }

    throw error;
  }
};

module.exports = connectDB;
