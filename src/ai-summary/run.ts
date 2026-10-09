import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../db/database.ts';
import { processUnprocessedArticles } from './processor.ts';

async function run() {
    await connectDB();

    console.log('\n========================================');
    console.log('AI NEWS PROCESSING');
    console.log('========================================');
    console.log(`Ollama model: ${process.env.OLLAMA_MODEL}`);

    try {
        const result = await processUnprocessedArticles();
        console.log('\n========================================');
        console.log('AI PROCESSING SUMMARY');
        console.log('========================================');
        console.log(`Processed: ${result.processedCount}`);
        console.log(`Errors: ${result.errorCount}`);
    } catch (error) {
        console.error('\nFatal AI processing error:');
        console.error(error);
    } finally {
        await mongoose.connection.close();
    }
}

run();