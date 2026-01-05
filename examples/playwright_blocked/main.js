import { chromium } from 'playwright';
import { AluviaClient } from '../../dist/esm/src/index.js';

const client = new AluviaClient({
    apiKey: process.env.ALUVIA_API_KEY,
});

const connection = await client.start();

const browser = await chromium.launch({
    proxy: connection.asPlaywright(),
});

// Track which hostnames we've added rules for
const proxiedHosts = new Set();

async function visitWithRetry(url) {
    const page = await browser.newPage();

    try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        const hostname = new URL(url).hostname;

        // Detect block: 403, 429, or a challenge page
        const status = response?.status() ?? 0;
        const isBlocked =
            status === 403 ||
            status === 429 ||
            (await page.title()).toLowerCase().includes('blocked');

        if (isBlocked && !proxiedHosts.has(hostname)) {
            console.log(`Blocked by ${hostname} — adding to proxy rules`);

            // Add the hostname to routing rules (updates take effect immediately)
            proxiedHosts.add(hostname);
            await client.updateRules([...proxiedHosts]);

            // Retry with the new rule in place
            await page.close();
            return visitWithRetry(url);
        }

        return await page.content();
    } finally {
        await page.close();
    }
}

try {
    // First attempt may be blocked; SDK will proxy on retry
    const html = await visitWithRetry('https://example.com/data');
    console.log('Success:', html.slice(0, 200));
} finally {
    await browser.close();
    await connection.close();
}
