// lineWorker.js
// Web Worker for string art global greedy algorithm with line pixel path caching


let globalState = null;
self.onmessage = function(e) {
    if (e.data.type === 'setLPS') {
        if (globalState) globalState.linesPerSecond = e.data.linesPerSecond;
        return;
    }
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
    let l = 0;
    globalState = { linesPerSecond };
    function step() {
        let count = 0;
        while (l < lines && count < globalState.linesPerSecond) {
            let bestScore = -Infinity;
            let bestKey = null;
            let bestType = 'black';
            // 全局搜尋所有釘點對，黑白線條都考慮
            for (let key in pixelPaths) {
                if (usedLines.has(key)) continue;
                let scoreBlack = 0, scoreWhite = 0;
                for (const [x, y] of pixelPaths[key]) {
                    scoreBlack += grayArr[y * width + x];
                    scoreWhite += (255 - grayArr[y * width + x]);
                }
                if (scoreBlack > bestScore) {
                    bestScore = scoreBlack;
                    bestKey = key;
                    bestType = 'black';
                }
                if (scoreWhite > bestScore) {
                    bestScore = scoreWhite;
                    bestKey = key;
                    bestType = 'white';
                }
            }
            if (!bestKey) break;
            // 更新灰度
            for (const [x, y] of pixelPaths[bestKey]) {
                if (bestType === 'black') {
                    grayArr[y * width + x] = Math.max(0, grayArr[y * width + x] - 30);
                } else {
                    grayArr[y * width + x] = Math.min(255, grayArr[y * width + x] + 30);
                }
            }
            usedLines.add(bestKey);
            const [i, j] = bestKey.split('-').map(Number);
            resultLines.push([i, j, bestType]);
            count++;
            l++;
        }
        self.postMessage({ type: 'progress', lines: resultLines.slice(), finished: l === lines });
        if (l < lines) setTimeout(step, 0);
        else self.postMessage({ type: 'done', lines: resultLines });
    }
    step();
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
