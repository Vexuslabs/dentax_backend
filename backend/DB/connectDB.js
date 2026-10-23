import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalbox';
    
    // Attach connection state listeners
    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB Connection Error]: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB Disconnected]: Lost connection to MongoDB database.');
    });

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: process.env.NODE_ENV !== 'production'
    });

    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Initial Connection Error]: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
