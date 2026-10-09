import mongoose from 'mongoose';

async function connectDB(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is required.');
    }

    await mongoose.connect(uri);
    console.log('Successfully connected to MongoDB.');
}

export default connectDB;
