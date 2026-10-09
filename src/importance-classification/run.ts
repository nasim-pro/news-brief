import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../db/database.ts';
import { classifyTodaysNews } from './classify.ts';

async function run() {
    await connectDB();

    try {
        const result = await classifyTodaysNews();

        console.log('\n========================================');
        console.log('CLASSIFICATION SUMMARY');
        console.log('========================================');
        console.log(`Total: ${result.total}`);
        console.log(`Important: ${result.important}`);
        console.log(`Not important: ${result.total - result.important}`);
    } catch (error) {
        console.error('\nFatal importance classification error:');
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
}

run();