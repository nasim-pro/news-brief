import 'dotenv/config';

import { chromium, type Page } from 'playwright';
import NewsArticle from '../models/NewsArticle.ts';

const LISTING_URL = 'https://indianexpress.com/latest-news/';

function normalizeUrl(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);

        parsed.hash = '';
        parsed.search = '';

        // Remove trailing slash except for the domain root
        let cleanUrl = parsed.toString();

        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        return cleanUrl;
    } catch {
        return rawUrl;
    }
}

function isIndianExpressArticleUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        return (
            parsed.hostname === 'indianexpress.com' &&
            parsed.pathname.startsWith('/article/')
        );
    } catch {
        return false;
    }
}

function cleanText(text: string | null | undefined): string {
    return (text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();
}

async function discoverArticleLinks(page: Page) {
    console.log('Discovering articles from Indian Express latest news...');

    const articles = await page.$$eval(
        '.nation .articles',
        (items) => {
            return items
                .map((item) => {
                    const link = item.querySelector<HTMLAnchorElement>('.title h2 a');

                    if (!link) {
                        return null;
                    }

                    const title = link.innerText.trim();
                    const url = link.href;

                    const dateElement = item.querySelector<HTMLElement>('.date');
                    const descriptionElement = item.querySelector<HTMLElement>('.img-context > p');

                    return {
                        title,
                        url,
                        listingDate: dateElement
                            ? dateElement.innerText.trim()
                            : null,
                        description: descriptionElement
                            ? descriptionElement.innerText.trim()
                            : null
                    };
                })
                .filter((article): article is NonNullable<typeof article> => Boolean(article));
        }
    );

    return articles;
}

async function extractJsonLd(page: Page): Promise<any> {
    const jsonLdBlocks = await page.$$eval(
        'script[type="application/ld+json"]',
        (scripts) =>
            scripts
                .map((script) => {
                    try {
                        return JSON.parse(script.textContent || '');
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
    );

    const flatten = (value: any): any[] => {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value.flatMap(flatten);
        }

        if (value['@graph']) {
            return flatten(value['@graph']);
        }

        return [value];
    };

    const objects = jsonLdBlocks.flatMap(flatten);

    return (
        objects.find(
            (item) =>
                item &&
                (
                    item['@type'] === 'NewsArticle' ||
                    item['@type'] === 'Article' ||
                    (
                        Array.isArray(item['@type']) &&
                        (
                            item['@type'].includes('NewsArticle') ||
                            item['@type'].includes('Article')
                        )
                    )
                )
        ) || null
    );
}

async function extractArticle(page: Page, fallback: any) {
    // JSON-LD is preferable because it normally represents the actual
    // article independently from navigation/recommendation sections.
    const jsonLd = await extractJsonLd(page);

    let title = '';
    let content = '';
    let publishedAt = null;
    let modifiedAt = null;
    let author = null;
    let category = null;

    if (jsonLd) {
        title =
            typeof jsonLd.headline === 'string'
                ? jsonLd.headline.trim()
                : '';

        content =
            typeof jsonLd.articleBody === 'string'
                ? jsonLd.articleBody.trim()
                : '';

        publishedAt =
            jsonLd.datePublished ||
            null;

        modifiedAt =
            jsonLd.dateModified ||
            null;

        if (typeof jsonLd.author === 'string') {
            author = jsonLd.author.trim();
        } else if (Array.isArray(jsonLd.author)) {
            author = jsonLd.author
                .map((item: any) => {
                    if (typeof item === 'string') return item;
                    return item?.name;
                })
                .filter(Boolean)
                .join(', ');
        } else if (jsonLd.author?.name) {
            author = jsonLd.author.name.trim();
        }

        if (jsonLd.articleSection) {
            category = Array.isArray(jsonLd.articleSection)
                ? jsonLd.articleSection.join(', ')
                : String(jsonLd.articleSection).trim();
        }
    }

    // Use page DOM only for fields missing from JSON-LD.
    if (!title) {
        title = await page
            .locator('h1')
            .first()
            .innerText()
            .catch(() => '');
    }

    if (!publishedAt) {
        publishedAt = await page
            .locator('meta[property="article:published_time"]')
            .getAttribute('content')
            .catch(() => null);
    }

    if (!modifiedAt) {
        modifiedAt = await page
            .locator('meta[property="article:modified_time"]')
            .getAttribute('content')
            .catch(() => null);
    }

    if (!author) {
        author = await page
            .locator('meta[name="author"]')
            .getAttribute('content')
            .catch(() => null);
    }

    if (!category) {
        category = await page
            .locator('meta[property="article:section"]')
            .getAttribute('content')
            .catch(() => null);
    }

    // If JSON-LD did not provide articleBody, use only known article-body
    // containers. Do NOT fall back to generic "main p" or "article p".
    if (!content) {
        const contentSelectors = [
            '.full-details',
            '.story-details',
            '.story-p',
            '.article-body',
            '.article-content',
            '.native-apollo'
        ];

        for (const selector of contentSelectors) {
            const locator = page.locator(selector).first();

            if (await locator.count()) {
                const paragraphs = await locator.locator('p').allInnerTexts();

                const cleaned = paragraphs
                    .map(cleanText)
                    .filter(Boolean)
                    .filter((text) => {
                        const lower = text.toLowerCase();

                        return (
                            !lower.startsWith('also read') &&
                            !lower.includes('click here to join') &&
                            !lower.includes('follow us') &&
                            !lower.includes('subscribe to')
                        );
                    });

                if (cleaned.length > 0) {
                    content = cleaned.join('\n\n');
                    break;
                }
            }
        }
    }

    return {
        title: cleanText(title),
        content: cleanText(content),
        publishedAt,
        modifiedAt,
        author: cleanText(author),
        category: cleanText(category) || fallback.category || null,
        description: fallback.description || null
    };
}

 async function scrapeIndianExpress() {

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

    const page = await context.newPage();

    try {
        console.log(`Opening: ${LISTING_URL}`);

        await page.goto(LISTING_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForTimeout(2000);

        // The latest-news page is paginated. Start with page 1.
        // We can add pagination after the basic scraper is reliable.
        const discoveredArticles = await discoverArticleLinks(page);

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
            `Discovered ${uniqueArticles.length} unique Indian Express articles.`
        );

        let savedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < uniqueArticles.length; i++) {
            const article = uniqueArticles[i];

            console.log(
                `\n[${i + 1}/${uniqueArticles.length}] ${article.title}`
            );

            try {
                const existing = await NewsArticle.exists({
                    url: article.url
                });

                if (existing) {
                    skippedCount++;
                    console.log('Already exists - skipped');
                    continue;
                }

                const articlePage = await context.newPage();

                try {
                    await articlePage.goto(article.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    await articlePage.waitForTimeout(1000);

                    const articleData = await extractArticle(
                        articlePage,
                        article
                    );

                    if (!articleData.title) {
                        throw new Error('Article title could not be extracted');
                    }

                    if (!articleData.content) {
                        throw new Error('Article content could not be extracted');
                    }

                    const publishedAt = articleData.publishedAt
                        ? new Date(articleData.publishedAt)
                        : null;

                    const modifiedAt = articleData.modifiedAt
                        ? new Date(articleData.modifiedAt)
                        : null;

                    await NewsArticle.create({
                        title: articleData.title,
                        content: articleData.content,
                        description: articleData.description,
                        source: 'Indian Express',
                        url: article.url,
                        publishedAt:
                            publishedAt && !Number.isNaN(publishedAt.getTime())
                                ? publishedAt
                                : null,
                        modifiedAt:
                            modifiedAt && !Number.isNaN(modifiedAt.getTime())
                                ? modifiedAt
                                : null,
                        category: articleData.category,
                        author: articleData.author
                    });

                    savedCount++;

                    console.log(`Saved: ${articleData.title}`);
                    console.log(
                        `Content length: ${articleData.content.length} characters`
                    );
                } finally {
                    await articlePage.close();
                }
            } catch (error) {
                errorCount++;

                console.error(
                    `Failed: ${article.url}`,
                    error instanceof Error ? error.message : error
                );
            }
        }

        console.log('\n==============================');
        console.log('SCRAPING SUMMARY');
        console.log('==============================');
        console.log(`Discovered: ${uniqueArticles.length}`);
        console.log(`Saved: ${savedCount}`);
        console.log(`Already existed: ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
    } catch (error) {
        console.error(
            'Fatal scraper error:',
            error instanceof Error ? error.message : error
        );
        throw error;
    } finally {
        await browser.close();
        
    }
}

// scrapeIndianExpress();

export { scrapeIndianExpress }
