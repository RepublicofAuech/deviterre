import puppeteer from 'puppeteer';
import fs from 'fs/promises';

async function loadLinksFromFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load links from ${filePath}:`, error);
        throw error;
    }
}

async function navigateWithRetry(page, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2' });
            return;
        } catch (error) {
            console.error(`Navigation to ${url} failed on attempt ${i + 1}:`, error);
            if (i === retries - 1) {
                throw error; // Re-throw the error if all retries fail
            }
        }
    }
}

export async function getRandomStreetViewImage(region) {
    const filePath = region === 'japan' ? 'japancoord.json' : 'worldcoord.json';
    const links = await loadLinksFromFile(filePath);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    let success = false;
    let attempt = 0;

    while (!success && attempt < 3) { // 最大3回試行
        const randomEntry = links[Math.floor(Math.random() * links.length)];
        const { link, location, answer } = randomEntry;

        try {
            await navigateWithRetry(page, link);
            await page.evaluate(() => {
                const elementsToRemove = [
                    '.scene-footer-container',
                    '.widget-minimap-shim',
                    '.app-bottom-navigation',
                    '.scene-footer',
                    '.search-button',
                    '.search-container',
                    '.scene-description',
                    '.scene-action-bar',
                    '#titlecard',
                    '#omnibox-container',
                    '#inputtools',
                    '#zoom',
                    "#minimap",
                    '.app-horizontal-widget-holder',
                ];
                elementsToRemove.forEach(selector => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.remove();
                    }
                });
            });

            await page.waitForSelector('.widget-scene-canvas', { timeout: 60000 }); // タイムアウトを60秒に設定
            const sceneExists = await page.$('.widget-scene-canvas');

            if (sceneExists) {
                const screenshotPath = 'streetview.png';
                await page.screenshot({ path: screenshotPath });

                await browser.close();
                return { imagePath: screenshotPath, link, location, answer };
            }
        } catch (error) {
            console.error(`Error during page processing (attempt ${attempt + 1}):`, error);
            attempt++;
            if (attempt >= 3) {
                await browser.close();
                throw error; // 最大試行回数を超えた場合、エラーを再スロー
            }
        }
    }
}
