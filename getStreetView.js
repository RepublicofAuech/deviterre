import puppeteer from 'puppeteer';  // puppeteer に変更

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

        try {
            await page.goto(link, { waitUntil: 'networkidle2' });

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

            // スクリーンショットを撮る前に3秒待機
            await new Promise(resolve => setTimeout(resolve, 1000));

            // ストリートビューの画像が存在するか確認
            const sceneExists = await page.$('.widget-scene-canvas');
            if (sceneExists) {
                const screenshotPath = 'streetview.png';
                await page.screenshot({ path: screenshotPath });

                await browser.close();
                return { imagePath: screenshotPath, link, location, answer };
            }
        } catch (error) {
            console.error('Error navigating to Google Maps URL:', error);
        }
    }
}

async function loadLinksFromFile(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}
