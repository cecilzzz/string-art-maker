// lineWorker.js
// Web Worker for string art global greedy algorithm with line pixel path caching

self.onmessage = function(e) {
    const { points, lines, width, height, pointArray, gray, linesPerSecond } = e.data;
    // 緩存所有線段像素路徑
    const pixelPaths = {};
    for (let i = 0; i < points; i++) {
        for (let j = i + 1; j < points; j++) {
            const key = `${i}-${j}`;
            pixelPaths[key] = getLinePixels(pointArray[i], pointArray[j], width, height);
        }
    }
    // 初始化
    let usedLines = new Set();
    let grayArr = new Float32Array(gray);
    let resultLines = [];
    for (let l = 0; l < lines; l++) {
        let bestScore = -Infinity;
        let bestKey = null;
        // 全局搜尋所有釘點對
        for (let key in pixelPaths) {
            if (usedLines.has(key)) continue;
            let score = 0;
            for (const [x, y] of pixelPaths[key]) {
                score += grayArr[y * width + x];
            }
            if (score > bestScore) {
                bestScore = score;
                bestKey = key;
            }
        }
        if (!bestKey) break;
        // 更新灰度
        for (const [x, y] of pixelPaths[bestKey]) {
            grayArr[y * width + x] = Math.max(0, grayArr[y * width + x] - 30);
        }
        usedLines.add(bestKey);
        const [i, j] = bestKey.split('-').map(Number);
        resultLines.push([i, j]);
        // 每 linesPerSecond 條線回傳一次進度
        if ((l + 1) % linesPerSecond === 0 || l === lines - 1) {
            self.postMessage({ type: 'progress', lines: resultLines.slice(), finished: l === lines - 1 });
        }
    }
    self.postMessage({ type: 'done', lines: resultLines });
};

// Bresenham's line algorithm
function getLinePixels(p0, p1, width, height) {
    const [x0, y0] = p0.map(Math.round);
    const [x1, y1] = p1.map(Math.round);
    const points = [];
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2;
    let x = x0, y = y0;
    while (true) {
        if (x >= 0 && x < width && y >= 0 && y < height) points.push([x, y]);
        if (x === x1 && y === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
}
