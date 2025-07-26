
// 取得 index.html 裡的元素

const canvas = document.getElementById('artCanvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const uploadInput = document.getElementById('imageUpload');
const generateButton = document.getElementById('generate');

const colorInput = document.getElementById('color');
const thicknessInput = document.getElementById('thickness');

const linesInput = document.getElementById('lines');
const pointsInput = document.getElementById('points');

let image = new Image();
let imageLoaded = false;

uploadInput.addEventListener('change', handleImageUpload);
generateButton.addEventListener('click', drawStringArt);

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            image.src = e.target.result;
            image.onload = () => {
                // 預覽canvas
                const maxW = previewCanvas.width;
                const maxH = previewCanvas.height;
                let w = image.width;
                let h = image.height;
                const scale = Math.min(maxW / w, maxH / h, 1);
                w = w * scale;
                h = h * scale;
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.drawImage(image, (previewCanvas.width - w) / 2, (previewCanvas.height - h) / 2, w, h);
                imageLoaded = true;
            };
        };
        reader.readAsDataURL(file);
    }
}






function drawStringArt() {
    if (!imageLoaded) return;

    const points = parseInt(pointsInput.value, 10) || 200; // 釘點數量
    const lines = parseInt(linesInput.value, 10) || 800;  // 總連線數
    const color = colorInput.value || '#0074D9';
    const lineWidth = parseFloat(thicknessInput.value) || 0.3;
    const linesPerSecond = 5; // 降低速率
    const interval = 1000 / linesPerSecond;

    // 1. 取得圖片灰度資料
    // 先將圖片等比縮放繪製到暫存canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    const maxW = canvas.width;
    const maxH = canvas.height;
    let w = image.width;
    let h = image.height;
    const scale = Math.min(maxW / w, maxH / h, 1);
    w = w * scale;
    h = h * scale;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(image, (tempCanvas.width - w) / 2, (tempCanvas.height - h) / 2, w, h);

    // 取得灰度圖像素
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const gray = new Float32Array(tempCanvas.width * tempCanvas.height);
    for (let i = 0; i < gray.length; i++) {
        const r = imgData.data[i * 4];
        const g = imgData.data[i * 4 + 1];
        const b = imgData.data[i * 4 + 2];
        // 亮度反轉，讓暗部優先被線覆蓋
        gray[i] = 255 - (0.299 * r + 0.587 * g + 0.114 * b);
    }

    // 2. 計算釘點座標
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const pointArray = [];
    for (let i = 0; i < points; i++) {
        const angle = (2 * Math.PI * i) / points - Math.PI / 2;
        pointArray.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }

    // 3. 全局貪婪動畫繪製線條
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.85;

    let l = 0;
    const usedLines = new Set();
    function drawStep() {
        let count = 0;
        while (l < lines && count < linesPerSecond) {
            let bestScore = -Infinity;
            let bestI = -1, bestJ = -1;
            // 全局搜尋所有釘點對
            for (let i = 0; i < points; i++) {
                for (let j = i + 1; j < points; j++) {
                    const key = `${i}-${j}`;
                    if (usedLines.has(key)) continue;
                    // 計算這條線經過的像素灰度總和
                    let score = 0;
                    const [x0, y0] = pointArray[i];
                    const [x1, y1] = pointArray[j];
                    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
                    for (let s = 0; s <= steps; s++) {
                        const x = Math.round(x0 + (x1 - x0) * s / steps);
                        const y = Math.round(y0 + (y1 - y0) * s / steps);
                        if (x >= 0 && x < tempCanvas.width && y >= 0 && y < tempCanvas.height) {
                            score += gray[y * tempCanvas.width + x];
                        }
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestI = i;
                        bestJ = j;
                    }
                }
            }
            if (bestI === -1 || bestJ === -1) break;
            // 畫線
            ctx.beginPath();
            ctx.moveTo(pointArray[bestI][0], pointArray[bestI][1]);
            ctx.lineTo(pointArray[bestJ][0], pointArray[bestJ][1]);
            ctx.stroke();
            // 線條覆蓋像素值減去固定值（如30）
            const [x0, y0] = pointArray[bestI];
            const [x1, y1] = pointArray[bestJ];
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let s = 0; s <= steps; s++) {
                const x = Math.round(x0 + (x1 - x0) * s / steps);
                const y = Math.round(y0 + (y1 - y0) * s / steps);
                if (x >= 0 && x < tempCanvas.width && y >= 0 && y < tempCanvas.height) {
                    gray[y * tempCanvas.width + x] = Math.max(0, gray[y * tempCanvas.width + x] - 30);
                }
            }
            usedLines.add(`${bestI}-${bestJ}`);
            l++;
            count++;
        }
        if (l < lines) {
            setTimeout(drawStep, interval);
        } else {
            ctx.restore();
        }
    }
    drawStep();
}