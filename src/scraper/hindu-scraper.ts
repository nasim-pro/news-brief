import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import NewsArticle from '../models/NewsArticle.ts';

function normalizeUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        parsed.search = '';
        let cleanUrl = parsed.toString();
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        return cleanUrl;
    } catch (e) {
        return rawUrl;
    }
}

 async function scrapeTheHindu() {

    console.log('Launching headless browser...');
    const browser = await chromium.launch({ headless: process.env.HEADLESS === 'true' });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to The Hindu National news section...');
        await page.goto('https://www.thehindu.com/news/national/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Discovering article links...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
        }

        const rawLinks = await page.$$eval('.row-element h3.title a, .result h3.title a', links =>
            links.map(link => (link as HTMLAnchorElement).href)
        );

        const uniqueUrls = [...new Set(rawLinks)]
            .filter(link => link && link.includes('thehindu.com') && link.includes('/article') && !link.includes('/photogallery/') && !link.includes('/videos/'))
            .map(link => normalizeUrl(link));

        console.log(`Discovered ${uniqueUrls.length} potential unique article URLs.`);

        let savedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const articleUrl of uniqueUrls) {
            try {
                const existing = await NewsArticle.findOne({ url: articleUrl });
                if (existing) {
                    skippedCount++;
                    continue;
                }

                const articlePage = await context.newPage();
                await articlePage.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                const articleData = await articlePage.evaluate(() => {
                    // Precise title selector from provided HTML
                    const titleElem = document.querySelector<HTMLElement>('h1[itemprop="name"].title, h1.title, h1');
                    const title = titleElem ? titleElem.innerText.trim() : '';

                    // Precise paragraph container from provided HTML
                    const paragraphs = document.querySelectorAll<HTMLElement>('.articlebodycontent .schemaDiv p, .articlebodycontent p, article p');

                    let content = '';
                    paragraphs.forEach(p => {
                        const text = p.innerText.trim();
                        if (
                            text &&
                            !text.includes('Also Read') &&
                            !text.includes('To get top news items') &&
                            !text.includes('Comments have been closed')
                        ) {
                            content += text + '\n\n';
                        }
                    });

                    // Precise publish date selector from provided HTML
                    const timeElem = document.querySelector<HTMLElement>('.update-publish-time .publish-time-new, .updated-time, time');
                    const publishedAt = timeElem ? timeElem.innerText.replace('Published - ', '').replace('Updated - ', '').trim() : null;

                    // Category
                    const categoryElem = document.querySelector<HTMLElement>('.sub-nav a, .breadcrumb a:nth-last-child(2), .section-tag');
                    const category = categoryElem ? categoryElem.innerText.trim() : 'National';

                    // Precise author selector from provided HTML
                    const authorElem = document.querySelector<HTMLElement>('.author .author-name a, .author-name a, .bi-name');
                    const author = authorElem ? authorElem.innerText.trim() : null;

                    return { title, content: content.trim(), publishedAt, category, author };
                });

                await articlePage.close();

                if (!articleData.title || !articleData.content) {
                    console.log(`Skipping incomplete article extraction for: ${articleUrl}`);
                    errorCount++;
                    continue;
                }

                await NewsArticle.create({
                    title: articleData.title,
                    content: articleData.content,
                    source: 'The Hindu',
                    url: articleUrl,
                    publishedAt: articleData.publishedAt ? new Date(articleData.publishedAt) : new Date(),
                    category: articleData.category,
                    author: articleData.author ?? undefined
                });

                savedCount++;
                console.log(`Saved: ${articleData.title}`);
            } catch (err) {
                errorCount++;
                console.error(`Error processing article ${articleUrl}:`, err instanceof Error ? err.message : String(err));
            }
        }

        console.log('\n--- Scraping Summary ---');
        console.log(`Successfully Saved: ${savedCount}`);
        console.log(`Skipped (Already Exists): ${skippedCount}`);
        console.log(`Errors / Unreadable: ${errorCount}`);

    } catch (error) {
        console.error('Fatal error during scraping run:', error);
    } finally {
        await browser.close();

    }
}

// scrapeTheHindu();

export { scrapeTheHindu }
