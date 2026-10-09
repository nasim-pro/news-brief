import NewsArticle from '../models/NewsArticle.ts';
import { generate } from './ollama.ts';
import { buildPrompt } from './prompt.ts';

async function processArticle(article: any) {
    console.log('\n=========================================================');
    console.log(`[${new Date().toISOString()}] Processing: ${article.title}`);
    console.log(`ID: ${article._id}`);

    const prompt = buildPrompt(article);
    const rawResponse = await generate(prompt);
    let result: any;

    try {
        result = JSON.parse(rawResponse);
    } catch (error) {
        throw new Error(`Invalid JSON returned by Ollama: ${rawResponse}`);
    }

    if (typeof result.summary !== 'string') {
        throw new Error('Ollama response does not match expected structure');
    }

    await NewsArticle.updateOne(
        { _id: article._id },
        {
            $set: {
                aiSummary: result.summary.trim(),
                summarized: true
            }
        }
    );

    console.log(`[${new Date().toISOString()}] AI processing completed.`);
    console.log(`Summary: ${result.summary}`);

    return result;
}

async function processUnprocessedArticles(options: { limit?: number } = {}) {
    const limit = options.limit ?? 0;
    let processedCount = 0;
    let errorCount = 0;
    const failedArticleIds = new Set<string>();

    while (true) {
        const article = await NewsArticle
            .findOne({
                summarized: false,
                _id: { $nin: [...failedArticleIds] }
            })
            .lean();

        if (!article) {
            console.log('\nNo unprocessed articles remaining.');
            break;
        }

        try {
            await processArticle(article);
            processedCount++;
            if (limit > 0 && processedCount >= limit) {
                console.log(`\nProcessing limit of ${limit} reached.`);
                break;
            }
        } catch (error: any) {
            errorCount++;
            failedArticleIds.add(String(article._id));
            const message = error instanceof Error ? error.message : String(error);
            console.error(`\nFailed processing article ${article._id}:`);
            console.error(message);

            await NewsArticle.updateOne(
                { _id: article._id },
                {
                    $set: {
                        aiProcessingError: message,
                        aiProcessingErrorAt: new Date()
                    }
                }
            );
        }
    }

    return {
        processedCount,
        errorCount
    };
}

export {
    processArticle,
    processUnprocessedArticles
};
