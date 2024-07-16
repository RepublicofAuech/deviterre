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

    while (true) {
        const randomEntry = links[Math.floor(Math.random() * links.length)];
        const { link, location, answer } = randomEntry;

        const success = await navigateWithRetry(page, link);
        if (success) {
            try {
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

                try {
                    await page.waitForSelector('.widget-scene-canvas', { timeout: 60000 });
                } catch (error) {
                    console.error('ストリートビューの画面が読み込まれるのを待機中にエラーが発生しました:', error);
                    continue;
                }

                await new Promise(resolve => setTimeout(resolve, 3000));

                const sceneExists = await page.$('.widget-scene-canvas');
                if (sceneExists) {
                    const screenshotPath = 'streetview.png';
                    await page.screenshot({ path: screenshotPath });

                    await browser.close();
                    return { imagePath: screenshotPath, link, location, answer };
                } else {
                    console.error('ストリートビューの画面が見つかりませんでした');
                }
            } catch (error) {
                console.error('スクリーンショットの取得中にエラーが発生しました:', error);
            }
        }
    }
}

async function navigateWithRetry(page, url, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            return true;
        } catch (error) {
            console.error(`Error navigating to ${url} (attempt ${i + 1} of ${attempts}):`, error);
        }
    }
    return false;
}

async function loadLinksFromFile(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}
