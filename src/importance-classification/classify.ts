import NewsArticle from '../models/NewsArticle.ts';
import { generate, OLLAMA_MODEL } from './ollama.ts';
import { buildPrompt } from './prompt.ts';

function getTodayRangeIST() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    const start = new Date(
        `${year}-${month}-${day}T00:00:00+05:30`
    );

    const end = new Date(
        `${year}-${month}-${day}T23:59:59.999+05:30`
    );

    return { start, end };
}

async function classifyTodaysNews() {
    const { start, end } = getTodayRangeIST();

    console.log('\n========================================');
    console.log('AI NEWS IMPORTANCE CLASSIFICATION');
    console.log('========================================');
    console.log(`Ollama model: ${OLLAMA_MODEL}`);
    console.log(`Date range: ${start.toISOString()} → ${end.toISOString()}`);

    const articles = await NewsArticle
        .find({
            publishedAt: {
                $gte: start, $lte: end
            },
            summarized: true,
            isAIProcessed: false,
            aiSummary: {
                $exists: true, $ne: ''
            }
        })
        .select({
            _id: 1,
            title: 1,
            aiSummary: 1
        })
        .lean();

    console.log(`Today's summarized articles: ${articles.length}`);

    if (articles.length === 0) {
        console.log('No summarized articles found for today.');
        return {
            total: 0,
            important: 0
        };
    }

    console.log('\nSending today\'s summaries to Ollama...');

    const prompt = buildPrompt(articles);
    const rawResponse = await generate(prompt);
    let result: any;

    try {
        result = JSON.parse(rawResponse);
    } catch (error) {
        throw new Error(`Invalid JSON returned by Ollama: ${rawResponse}`);
    }

    console.log("classification result", result);

    if (!Array.isArray(result.importantIds)) {
        throw new Error(
            'Ollama response does not contain importantIds array'
        );
    }

    const validIds = new Set(
        articles.map(article => article._id.toString())
    );

    const importantIds: any = [
        ...new Set(
            result.importantIds
                .map((id: any) => String(id))
                .filter((id: string) => validIds.has(id))
        )
    ];

    const importantIdSet = new Set(importantIds);

    const notImportantIds: any = articles
        .map(article => article._id.toString())
        .filter(id => !importantIdSet.has(id));

    console.log(
        `Ollama selected ${importantIds.length} important articles.`
    );

    if (importantIds.length > 0) {
        await NewsArticle.updateMany(
            {
                _id: {
                    $in: importantIds
                }
            },
            {
                $set: {
                    isImportant: true,
                    isAIProcessed: true
                }
            }
        );
    }

    if (notImportantIds.length > 0) {
        await NewsArticle.updateMany(
            {
                _id: {
                    $in: notImportantIds
                }
            },
            {
                $set: {
                    isImportant: false,
                    isAIProcessed: true
                }
            }
        );
    }

    console.log('\n========================================');
    console.log('IMPORTANCE CLASSIFICATION COMPLETE');
    console.log('========================================');
    console.log(`Total articles: ${articles.length}`);
    console.log(`Important: ${importantIds.length}`);
    console.log(`Not important: ${notImportantIds.length}`);
    console.log(`AI processed: ${articles.length}`);

    return {
        total: articles.length,
        important: importantIds.length,
        notImportant: notImportantIds.length,
        importantIds
    };
}

export {
    classifyTodaysNews
};


// batch processing classification

// import NewsArticle from '../models/NewsArticle.ts';
// import { generate, OLLAMA_MODEL } from './ollama.ts';
// import { buildPrompt } from './prompt.ts';

// const BATCH_SIZE = 30;

// function getTodayRangeIST() {
//     const now = new Date();

//     const formatter = new Intl.DateTimeFormat('en-CA', {
//         timeZone: 'Asia/Kolkata',
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit'
//     });

//     const parts = formatter.formatToParts(now);

//     const year = parts.find(p => p.type === 'year')?.value;
//     const month = parts.find(p => p.type === 'month')?.value;
//     const day = parts.find(p => p.type === 'day')?.value;

//     const start = new Date(
//         `${year}-${month}-${day}T00:00:00+05:30`
//     );

//     const end = new Date(
//         `${year}-${month}-${day}T23:59:59.999+05:30`
//     );

//     return { start, end };
// }

// async function classifyTodaysNews() {
//     const { start, end } = getTodayRangeIST();

//     console.log('\n========================================');
//     console.log('AI NEWS IMPORTANCE CLASSIFICATION');
//     console.log('========================================');
//     console.log(`Ollama model: ${OLLAMA_MODEL}`);
//     console.log(`Batch size: ${BATCH_SIZE}`);
//     console.log(`Date range: ${start.toISOString()} → ${end.toISOString()}`);

//     const articles = await NewsArticle
//         .find({
//             publishedAt: {
//                 $gte: start,
//                 $lte: end
//             },
//             summarized: true,
//             isAIProcessed: false,
//             aiSummary: {
//                 $exists: true,
//                 $ne: ''
//             }
//         })
//         .select({
//             _id: 1,
//             title: 1,
//             aiSummary: 1
//         })
//         .lean();

//     console.log(`Today's summarized articles: ${articles.length}`);

//     if (articles.length === 0) {
//         console.log('No summarized articles found for today.');

//         return {
//             total: 0,
//             important: 0,
//             notImportant: 0,
//             importantIds: []
//         };
//     }

//     const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

//     let totalImportant = 0;
//     let totalNotImportant = 0;
//     const allImportantIds: string[] = [];

//     console.log(`Processing ${totalBatches} batch(es)...`);

//     for (let i = 0; i < articles.length; i += BATCH_SIZE) {
//         const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

//         const batch = articles.slice(i, i + BATCH_SIZE);

//         console.log('\n----------------------------------------');
//         console.log(
//             `Batch ${batchNumber}/${totalBatches} — ${batch.length} articles`
//         );
//         console.log('----------------------------------------');

//         const prompt = buildPrompt(batch);

//         let rawResponse: string;

//         try {
//             console.log('Sending batch to Ollama...');

//             rawResponse = await generate(prompt);
//         } catch (error: any) {
//             console.error(
//                 `Ollama failed for batch ${batchNumber}:`,
//                 error?.message || error
//             );

//             throw error;
//         }

//         let result: any;

//         try {
//             result = JSON.parse(rawResponse);
//         } catch (error) {
//             console.error(
//                 `Invalid JSON returned by Ollama for batch ${batchNumber}:`
//             );

//             console.error(rawResponse);

//             throw new Error(
//                 `Invalid JSON returned by Ollama for batch ${batchNumber}`
//             );
//         }

//         if (!Array.isArray(result.importantIds)) {
//             throw new Error(
//                 `Ollama response for batch ${batchNumber} does not contain importantIds array`
//             );
//         }

//         const validIds = new Set(
//             batch.map(article => article._id.toString())
//         );

//         const importantIds: any = [
//             ...new Set(
//                 result.importantIds
//                     .map((id: any) => String(id))
//                     .filter((id: string) => validIds.has(id))
//             )
//         ];

//         const importantIdSet = new Set(importantIds);

//         const notImportantIds: any = batch
//             .map(article => article._id.toString())
//             .filter(id => !importantIdSet.has(id));

//         console.log(
//             `Ollama selected ${importantIds.length} important articles.`
//         );

//         console.log(
//             `Not important: ${notImportantIds.length}`
//         );

//         /*
//          * Mark only this batch as processed.
//          *
//          * This is important because if batch 3 fails,
//          * batches 1 and 2 remain successfully processed.
//          */

//         if (importantIds.length > 0) {
//             await NewsArticle.updateMany(
//                 {
//                     _id: {
//                         $in: importantIds
//                     }
//                 },
//                 {
//                     $set: {
//                         isImportant: true,
//                         isAIProcessed: true
//                     }
//                 }
//             );
//         }

//         if (notImportantIds.length > 0) {
//             await NewsArticle.updateMany(
//                 {
//                     _id: {
//                         $in: notImportantIds
//                     }
//                 },
//                 {
//                     $set: {
//                         isImportant: false,
//                         isAIProcessed: true
//                     }
//                 }
//             );
//         }

//         totalImportant += importantIds.length;
//         totalNotImportant += notImportantIds.length;

//         allImportantIds.push(...importantIds);

//         console.log(`Batch ${batchNumber} completed: ${batch.length} processed`);
//     }

//     console.log('\n========================================');
//     console.log('IMPORTANCE CLASSIFICATION COMPLETE');
//     console.log('========================================');
//     console.log(`Total articles: ${articles.length}`);
//     console.log(`Important: ${totalImportant}`);
//     console.log(`Not important: ${totalNotImportant}`);
//     console.log(`AI processed: ${totalImportant + totalNotImportant}`);

//     return {
//         total: articles.length,
//         important: totalImportant,
//         notImportant: totalNotImportant,
//         importantIds: allImportantIds
//     };
// }

// export {
//     classifyTodaysNews
// };