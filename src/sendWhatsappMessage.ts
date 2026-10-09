import NewsArticle from './models/NewsArticle.ts';
import { sendMessageToGroup, WHATSAPP_GROUP_ADMIN_PHONE } from '../whatsapp.ts';

const WHATSAPP_GROUP_NAME = 'Daily Important News';

function getTodayRangeIST(): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return {
    start: new Date(`${date}T00:00:00+05:30`),
    end: new Date(`${date}T23:59:59.999+05:30`),
  };
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendNewsToWhatsappGroup(): Promise<void> {
  const { start, end } = getTodayRangeIST();

  const articles = await NewsArticle.find({
    createdAt: { $gte: start, $lte: end },
    summarized: true,
    isAIProcessed: true,
    isImportant: true,
    aiSummary: { $exists: true, $ne: '' },
  })
    .sort({ publishedAt: -1 })
    .lean();

  if (articles.length === 0) {
    await sendMessageToGroup(
      WHATSAPP_GROUP_NAME,
      '*📰 DAILY IMPORTANT NEWS*\n\nNo important stories were classified today.',
      [WHATSAPP_GROUP_ADMIN_PHONE],
    );

    return;
  }

  // Message 1: Headlines only
  const headlines = articles.map((article, index) => {
    return `*${index + 1}. ${article.title}*`;
  });

  const headlineMessage = [
    '*📰 DAILY IMPORTANT NEWS — HEADLINES*',
    '',
    headlines.join('\n\n'),
    '',
    `Total important stories: ${articles.length}`,
  ].join('\n');

  // Prepare summary batches containing four articles each
  const batchSize = 4;
  const summaryBatches: string[] = [];
  const totalBatches = Math.ceil(articles.length / batchSize);

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    const summaries = batch.map((article, index) => {
      const articleNumber = i + index + 1;
      const title = article.title;
      const summary = article.aiSummary?.trim() ?? '';

      return `*${articleNumber}. ${title}*\n${summary}`;
    });

    const summaryMessage = [
      `*📰 DAILY IMPORTANT NEWS — SUMMARIES (${batchNumber}/${totalBatches})*`,
      '',
      summaries.join('\n\n'),
    ].join('\n');

    summaryBatches.push(summaryMessage);
  }

  // Send headlines first
  console.log('[News] Sending headlines...');

  await sendMessageToGroup(
    WHATSAPP_GROUP_NAME,
    headlineMessage,
    [WHATSAPP_GROUP_ADMIN_PHONE],
  );

  console.log('[News] Headlines sent. Waiting 2 seconds...');
  await sleep(2000);

  // Send summaries in smaller batches
  for (let i = 0; i < summaryBatches.length; i++) {
    const summaryMessage = summaryBatches[i];
    const batchNumber = i + 1;

    console.log(
      `[News] Sending summary batch ${batchNumber}/${totalBatches}...`,
    );
    console.log(
      `[News] Batch ${batchNumber} message length: ${summaryMessage.length}`,
    );

    await sendMessageToGroup(
      WHATSAPP_GROUP_NAME,
      summaryMessage,
      [WHATSAPP_GROUP_ADMIN_PHONE],
    );

    console.log(
      `[News] Summary batch ${batchNumber}/${totalBatches} send completed.`,
    );

    if (batchNumber < totalBatches) {
      await sleep(2000);
    }
  }

  console.log(
    `[WhatsApp] Sent headlines and ${totalBatches} summary batches for ${articles.length} important stories.`,
  );
}



export { sendNewsToWhatsappGroup };
