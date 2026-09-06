import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error(
      'FATAL: MONGO_URI is not set. Configure it through the deployment platform environment variables.',
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    // Never log the URI; log only a safe diagnostic message.
    console.error(
      `Error connecting to MongoDB: ${error.message || 'connection failed'}`,
    );
    process.exit(1);
  }
};

export default connectDB;