// import 'dotenv/config';
// import mongoose from 'mongoose';
// import connectDB from './src/db/database.ts';
// import { scrapeIndianExpress } from './src/scraper/ie-latest-news-scraper.ts';
// import { scrapeLucknowNews } from './src/scraper/ie-lucknow-scraper.ts';
// import { scrapeWorldNews } from './src/scraper/ie-world-scraper.ts';
// import { scrapeLegalNews } from './src/scraper/ie-legal.scraper.ts';
// import { processUnprocessedArticles } from './src/ai-summary/processor.ts';
// import { classifyTodaysNews } from './src/importance-classification/classify.ts';
// import { sendNewsToWhatsappGroup } from './src/sendWhatsappMessage.ts';
// import { closeWhatsApp } from './whatsapp.ts';

// async function run(): Promise<void> {
//   console.log('\n=== News scraper pipeline ===');
//   await connectDB();

//   try {
//     console.log('\n[1/4] Scraping Indian Express sections');
//     await scrapeIndianExpress();
//     await scrapeLucknowNews();
//     await scrapeWorldNews();
//     await scrapeLegalNews();

//     console.log('\n[2/4] Summarizing unprocessed articles');
//     const summary = await processUnprocessedArticles();
//     console.log(`Summarized: ${summary.processedCount}; errors: ${summary.errorCount}`);

//     console.log('\n[3/4] Classifying today’s news');
//     await classifyTodaysNews();

//     console.log('\n[4/4] Sending important news to WhatsApp');
//     await sendNewsToWhatsappGroup();
//     console.log('\nNews pipeline completed.');
//   } finally {
//     try {
//       await closeWhatsApp();
//     } finally {
//       await mongoose.disconnect();
//     }
//   }
// }

// run().catch((error: unknown) => {
//   console.error('News pipeline failed:', error);
//   process.exitCode = 1;
// });



import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/db/database.ts';
import { scrapeIndianExpress } from './src/scraper/ie-latest-news-scraper.ts';
import { scrapeLucknowNews } from './src/scraper/ie-lucknow-scraper.ts';
import { scrapeWorldNews } from './src/scraper/ie-world-scraper.ts';
import { scrapeLegalNews } from './src/scraper/ie-legal.scraper.ts';
import { processUnprocessedArticles } from './src/ai-summary/processor.ts';
import { classifyTodaysNews } from './src/importance-classification/classify.ts';
import { sendNewsToWhatsappGroup } from './src/sendWhatsappMessage.ts';
import { closeWhatsApp } from './whatsapp.ts';

type PipelineStage = 'scrape' | 'summarize' | 'classify' | 'send';

const VALID_STAGES: PipelineStage[] = [
  'scrape',
  'summarize',
  'classify',
  'send',
];

async function scrapeNews(): Promise<void> {
  console.log('\n[1/4] Scraping Indian Express sections');

  await scrapeIndianExpress();
  await scrapeLucknowNews();
  await scrapeWorldNews();
  await scrapeLegalNews();

  console.log('\nScraping completed.');
}

async function summarizeNews(): Promise<void> {
  console.log('\n[2/4] Summarizing unprocessed articles');

  const summary = await processUnprocessedArticles();

  console.log(`Summarized: ${ summary.processedCount }; errors: ${ summary.errorCount } `,);
}

async function classifyNews(): Promise<void> {
  console.log('\n[3/4] Classifying today’s news');
  await classifyTodaysNews();
  console.log('\nClassification completed.');
}

async function sendNews(): Promise<void> {
  console.log('\n[4/4] Sending important news to WhatsApp');
  await sendNewsToWhatsappGroup();
  console.log('\nWhatsApp sending completed.');
}

async function runFullPipeline(): Promise<void> {
  await scrapeNews();
  await summarizeNews();
  await classifyNews();
  await sendNews();
}

function getRequestedStage(): PipelineStage | undefined {
  const stageArguments = process.argv.filter((arg) =>
    arg.startsWith('--stage='),
  );

  if (stageArguments.length > 1) {
    throw new Error('Specify only one --stage argument.');
  }

  if (stageArguments.length === 0) {
    return undefined;
  }

  const stage = stageArguments[0].slice('--stage='.length);

  if (!VALID_STAGES.includes(stage as PipelineStage)) {
    throw new Error(
      `Invalid stage "${stage}".Valid stages: ${ VALID_STAGES.join(', ') } `,
    );
  }

  return stage as PipelineStage;
}

async function run(): Promise<void> {
  const stage = getRequestedStage();

  console.log(
    stage ? `\n === News pipeline: ${ stage } === ` : '\n=== Full news scraper pipeline ===',
  );

  let connectedToWhatsApp = false;

  await connectDB();

  try {
    switch (stage) {
      case 'scrape':
        await scrapeNews();
        break;

      case 'summarize':
        await summarizeNews();
        break;

      case 'classify':
        await classifyNews();
        break;

      case 'send':
        connectedToWhatsApp = true;
        await sendNews();
        break;

      default:
        connectedToWhatsApp = true;
        await runFullPipeline();
        break;
    }

    console.log('\nPipeline completed successfully.');
  } finally {
    try {
      // WhatsApp is only initialized by the send stage.
      if (connectedToWhatsApp) {
        await closeWhatsApp();
      }
    } finally {
      await mongoose.disconnect();
    }
  }
}

run().catch((error: unknown) => {
  console.error('\nNews pipeline failed:', error);
  process.exitCode = 1;
});

