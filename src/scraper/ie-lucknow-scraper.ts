import 'dotenv/config';

import { chromium, type Page } from 'playwright';
import NewsArticle from '../models/NewsArticle.ts';

const LISTING_URL = 'https://indianexpress.com/section/cities/lucknow/';

function normalizeUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);

        parsed.search = '';
        parsed.hash = '';

        let cleanUrl = parsed.toString();

        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        return cleanUrl;
    } catch {
        return rawUrl;
    }
}

function cleanText(value: string | null | undefined): string {
    if (!value) return '';

    return value
        .replace(/\s+/g, ' ')
        .replace(/\u00a0/g, ' ')
        .trim();
}

function isIndianExpressArticleUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);

        return (
            parsed.hostname === 'indianexpress.com' &&
            parsed.pathname.startsWith('/article/cities/lucknow/')
        );
    } catch {
        return false;
    }
}

async function discoverArticleLinks(page: Page) {
    return await page.$$eval(
        '#north-east-data ul li',
        (items) => {
            const results = [];

            for (const item of items) {
                // Ignore advertisement blocks
                if (item.classList.contains('north-east-items-ad')) {
                    continue;
                }

                // The site currently uses both h2 and h3
                const link = item.querySelector<HTMLAnchorElement>('h2 a, h3 a');

                if (!link) {
                    continue;
                }

                const url = link.href;
                const title = link.getAttribute('title') || link.innerText;

                if (!url || !title) {
                    continue;
                }

                results.push({
                    url,
                    title: title.trim()
                });
            }

            return results;
        }
    );
}

async function extractJsonLd(page: Page): Promise<any> {
    const scripts = await page.$$eval(
        'script[type="application/ld+json"]',
        elements =>
            elements
                .map(el => el.textContent)
                .filter(Boolean)
    );

    const objects = [];

    for (const script of scripts) {
        try {
            const parsed = JSON.parse(script);

            if (Array.isArray(parsed)) {
                objects.push(...parsed);
            } else if (parsed && Array.isArray(parsed['@graph'])) {
                objects.push(...parsed['@graph']);
            } else if (parsed) {
                objects.push(parsed);
            }
        } catch {
            // Ignore invalid JSON-LD blocks
        }
    }

    return objects.find(item => {
        const type = item?.['@type'];

        if (Array.isArray(type)) {
            return type.includes('NewsArticle') || type.includes('Article');
        }

        return type === 'NewsArticle' || type === 'Article';
    }) || null;
}

async function extractArticle(page: Page, listingArticle: any) {
    const jsonLd = await extractJsonLd(page);

    const data = await page.evaluate(() => {
        const getText = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            return element ? element.innerText.trim() : '';
        };

        const getMeta = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            return element
                ? (element.getAttribute('content') || '').trim()
                : '';
        };

        return {
            h1: getText('h1'),
            description: getMeta('meta[name="description"]'),
            publishedAt:
                getMeta('meta[property="article:published_time"]') ||
                getMeta('meta[name="article:published_time"]'),

            modifiedAt:
                getMeta('meta[property="article:modified_time"]') ||
                getMeta('meta[name="article:modified_time"]'),

            author:
                getMeta('meta[name="author"]') ||
                getText('.written-by a') ||
                getText('.articledetails .name'),

            category:
                getMeta('meta[property="article:section"]') || 'Lucknow/Uttar Pradesh'
        };
    });

    /*
     * Prefer structured NewsArticle data.
     * This prevents sidebar/related-news text from getting mixed
     * into the article body.
     */
    let title =
        cleanText(jsonLd?.headline) ||
        cleanText(data.h1) ||
        cleanText(listingArticle.title);

    let content = cleanText(jsonLd?.articleBody);

    /*
     * Conservative fallback only.
     * Do NOT use generic `main p` or `article p`.
     */
    if (!content) {
        content = await page.evaluate(() => {
            const selectors = [
                '.full-details',
                '.story-details',
                '.story-p',
                '.article-body',
                '.article-content',
                '.native-apollo'
            ];

            for (const selector of selectors) {
                const container = document.querySelector<HTMLElement>(selector);

                if (!container) continue;

                const paragraphs = [...container.querySelectorAll('p')]
                    .map(p => p.innerText.trim())
                    .filter(Boolean)
                    .filter(text =>
                        !text.includes('Also Read') &&
                        !text.includes('Click here to join') &&
                        !text.includes('Advertisement')
                    );

                if (paragraphs.length > 0) {
                    return paragraphs.join('\n\n');
                }
            }

            return '';
        });
    }

    let publishedAt =
        jsonLd?.datePublished ||
        data.publishedAt ||
        null;

    const modifiedAt =
        jsonLd?.dateModified ||
        data.modifiedAt ||
        null;

    let author = null;

    if (typeof jsonLd?.author === 'string') {
        author = cleanText(jsonLd.author);
    } else if (jsonLd?.author?.name) {
        author = cleanText(jsonLd.author.name);
    } else {
        author = cleanText(data.author) || null;
    }

    const category =
        cleanText(jsonLd?.articleSection) ||
        cleanText(data.category) ||
        'Lucknow/Uttar Pradesh';

    const description =
        cleanText(jsonLd?.description) ||
        cleanText(data.description) ||
        null;

    return {
        title,
        content,
        description,
        publishedAt,
        modifiedAt,
        category,
        author
    };
}

 async function scrapeLucknowNews() {

    console.log('Launching headless browser...');

    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false'
    });

    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0.0.0 Safari/537.36'
    });

    const listingPage = await context.newPage();

    try {
        console.log('Opening Lucknow / Uttar Pradesh news page...');
        console.log(LISTING_URL);

        await listingPage.goto(LISTING_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await listingPage.waitForTimeout(1500);

        console.log('Discovering local UP news articles...');

        const discoveredArticles = await discoverArticleLinks(listingPage);

        /*
         * Deduplicate URLs before opening article pages.
         */
        const uniqueArticles = [];
        const seenUrls = new Set();

        for (const article of discoveredArticles) {
            const url = normalizeUrl(article.url);

            if (!isIndianExpressArticleUrl(url)) {
                continue;
            }

            if (seenUrls.has(url)) {
                continue;
            }

            seenUrls.add(url);

            uniqueArticles.push({
                ...article,
                url
            });
        }

        console.log(
            `Discovered ${uniqueArticles.length} unique Lucknow/UP articles.`
        );

        let savedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const article of uniqueArticles) {
            try {
                /*
                 * URL is the primary deduplication key.
                 */
                const existing = await NewsArticle.findOne({
                    url: article.url
                }).lean();

                if (existing) {
                    skippedCount++;

                    console.log(`Already exists: ${article.title}`);

                    continue;
                }

                console.log(`\nOpening: ${article.title}`);
                console.log(article.url);

                const articlePage = await context.newPage();

                try {
                    await articlePage.goto(article.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    await articlePage.waitForTimeout(500);

                    const articleData = await extractArticle(
                        articlePage,
                        article
                    );

                    if (!articleData.title || !articleData.content) {
                        console.log(
                            `Skipping incomplete article: ${article.url}`
                        );

                        errorCount++;
                        continue;
                    }

                    const publishedDate = articleData.publishedAt
                        ? new Date(articleData.publishedAt)
                        : new Date();

                    const modifiedDate = articleData.modifiedAt
                        ? new Date(articleData.modifiedAt)
                        : null;

                    await NewsArticle.create({
                        title: articleData.title,
                        content: articleData.content,
                        description: articleData.description ?? undefined,

                        source: 'Indian Express - Lucknow / UP',

                        url: article.url,

                        publishedAt:
                            !isNaN(publishedDate.getTime())
                                ? publishedDate
                                : new Date(),

                        modifiedAt:
                            modifiedDate &&
                                !isNaN(modifiedDate.getTime())
                                ? modifiedDate
                                : undefined,

                        category:
                            articleData.category ||
                            'Lucknow/Uttar Pradesh',

                        author: articleData.author ?? undefined
                    });

                    savedCount++;

                    console.log(`Saved: ${articleData.title}`);
                    console.log(
                        `Content length: ${articleData.content.length} chars`
                    );
                } finally {
                    await articlePage.close();
                }
            } catch (error) {
                errorCount++;

                console.error(
                    `Error processing ${article.url}:`,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        console.log('\n================================');
        console.log('Lucknow / UP News Scraping Summary');
        console.log('================================');

        console.log(`Discovered: ${uniqueArticles.length}`);
        console.log(`Saved: ${savedCount}`);
        console.log(`Already Exists: ${skippedCount}`);
        console.log(`Errors / Unreadable: ${errorCount}`);
    } catch (error) {
        console.error(
            'Fatal error during Lucknow news scraping:',
            error
        );
        throw error;
    } finally {
        await listingPage.close();
        await browser.close();
        
    }
}

// scrapeLucknowNews();

export { scrapeLucknowNews }
