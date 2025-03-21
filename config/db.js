/**
 * @fileoverview Database configuration for the WisdomAI application.
 * Handles MongoDB connection setup and error handling.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Connects to MongoDB using the URI from environment variables.
 * Falls back to local MongoDB instance if URI is not provided.
 * 
 * @async
 * @function connectDB
 * @returns {Promise<void>}
 * 
 * @throws {Error} If connection fails
 * @throws {Error} If MongoDB URI is invalid
 * 
 * @example
 * // In your main application file
 * import connectDB from './config/db';
 * 
 * // Connect to MongoDB
 * await connectDB();
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisdomai');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB; 