import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';

export async function getRandomStreetViewImage(region) {
    const filePath = region === 'japan' ? 'japancoord.json' : 'worldcoord.json';
    const links = await loadLinksFromFile(filePath);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        while (true) {
            const randomEntry = links[Math.floor(Math.random() * links.length)];
            const { link, location, answer } = randomEntry;

            const success = await navigateWithRetry(page, link);
            if (success) {
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

                await page.waitForSelector('.widget-scene-canvas', { timeout: 30000 }); // タイムアウトを短く設定
                const sceneExists = await page.$('.widget-scene-canvas');

                if (sceneExists) {
                    const screenshotPath = 'streetview.png';
                    await page.screenshot({ path: screenshotPath });

                    await browser.close();
                    return { imagePath: screenshotPath, link, location, answer };
                }
            }
        }
    } catch (error) {
        console.error('Error during page processing:', error);
        await browser.close();
        throw error; // エラーを再スローして、呼び出し元に通知
    }
}

async function navigateWithRetry(page, url, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }); // タイムアウトを短く設定
            return true;
        } catch (error) {
            console.error(`Error navigating to ${url} (attempt ${i + 1} of ${attempts}):`, error);
            if (i === attempts - 1) throw error; // 最後の試行でエラーを再スロー
        }
    }
    return false;
}

async function loadLinksFromFile(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}
