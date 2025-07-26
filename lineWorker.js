// lineWorker.js
// Web Worker for string art global greedy algorithm with line pixel path caching


let globalState = null;
self.onmessage = function(e) {
    if (e.data.type === 'setLPS') {
        if (globalState) globalState.linesPerSecond = e.data.linesPerSecond;
        return;
    }
    const { points, lines, width, height, pointArray, origGray, accumGray, linesPerSecond } = e.data;
    // 緩存所有線段像素路徑，key唯一且雙向一致
    const pixelPaths = {};
    for (let i = 0; i < points; i++) {
        for (let j = 0; j < points; j++) {
            if (i === j) continue;
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!pixelPaths[key]) {
                pixelPaths[key] = getLinePixels(pointArray[i], pointArray[j], width, height);
            }
        }
    }
    // 初始化
    let usedLines = new Set();
    let accumArr = new Float32Array(accumGray); // 當前累積灰度
    let origArr = new Float32Array(origGray);   // 原圖灰度
    let resultLines = [];
    let l = 0;
    globalState = { linesPerSecond };

    // 單線頭貪婪：從起點出發
    let lastNail = 0;
    const minSkip = Math.floor(points * 0.05); // 最短線長限制（5%圓周）

    function step() {
        let count = 0;
        while (l < lines && count < globalState.linesPerSecond) {
            let bestScore = -Infinity;
            let bestJ = -1;
            let bestType = 'black';
            for (let j = 0; j < points; j++) {
                if (j === lastNail) continue;
                // 最短線長限制
                let diff = Math.abs(j - lastNail);
                let minDist = Math.min(diff, points - diff);
                if (minDist < minSkip) continue;
                const key = lastNail < j ? `${lastNail}-${j}` : `${j}-${lastNail}`;
                if (usedLines.has(key)) continue;
                let scoreBlack = 0, scoreWhite = 0;
                for (const [x, y] of pixelPaths[key]) {
                    let idx = y * width + x;
                    let before = accumArr[idx];
                    let afterBlack = Math.max(0, before - 30);
                    let afterWhite = Math.min(255, before + 30);
                    let diffBefore = Math.abs(origArr[idx] - before);
                    let diffAfterBlack = Math.abs(origArr[idx] - afterBlack);
                    let diffAfterWhite = Math.abs(origArr[idx] - afterWhite);
                    scoreBlack += (diffBefore - diffAfterBlack);
                    scoreWhite += (diffBefore - diffAfterWhite);
                }
                if (scoreBlack > bestScore) {
                    bestScore = scoreBlack;
                    bestJ = j;
                    bestType = 'black';
                }
                if (scoreWhite > bestScore) {
                    bestScore = scoreWhite;
                    bestJ = j;
                    bestType = 'white';
                }
            }
            if (bestJ === -1) break;
            // 更新累積灰度
            const key = lastNail < bestJ ? `${lastNail}-${bestJ}` : `${bestJ}-${lastNail}`;
            for (const [x, y] of pixelPaths[key]) {
                let idx = y * width + x;
                if (bestType === 'black') {
                    accumArr[idx] = Math.max(0, accumArr[idx] - 30);
                } else {
                    accumArr[idx] = Math.min(255, accumArr[idx] + 30);
                }
            }
            usedLines.add(key);
            resultLines.push([lastNail, bestJ, bestType]);
            lastNail = bestJ;
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
