import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';

// ランダムなStreet Viewの画像を取得する関数
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
                // スクリプトを挿入して不要なエレメントを削除
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

                // ストリートビューの画像が完全に読み込まれるまで待機
                await page.waitForSelector('#scene', { visible: true, timeout: 30000 });

                // スクリーンショットを撮る前に1.5秒待機
                await new Promise(resolve => setTimeout(resolve, 1500));

                // ストリートビューの画像が存在するか確認
                const sceneExists = await page.$('#scene');
                if (sceneExists) {
                    const screenshotPath = 'streetview.png';
                    await page.screenshot({ path: screenshotPath });

                    await browser.close();
                    return { imagePath: screenshotPath, link, location, answer };
                }
            } catch (error) {
                console.error('Error taking screenshot:', error);
            }
        }
    }
}

async function navigateWithRetry(page, url, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); // タイムアウトを60秒に設定
            return true; // 成功した場合は true を返す
        } catch (error) {
            console.error(`Error navigating to ${url} (attempt ${i + 1} of ${attempts}):`, error);
        }
    }
    return false; // すべての試行が失敗した場合は false を返す
}

async function loadLinksFromFile(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}
