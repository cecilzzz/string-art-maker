
// 取得 index.html 裡的元素
const canvas = document.getElementById('artCanvas');
const ctx = canvas.getContext('2d');
const uploadInput = document.getElementById('imageUpload');
const generateButton = document.getElementById('generate');
const colorInput = document.getElementById('color');
const thicknessInput = document.getElementById('thickness');

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
                // 將圖片等比縮放到 canvas
                const maxW = canvas.width;
                const maxH = canvas.height;
                let w = image.width;
                let h = image.height;
                const scale = Math.min(maxW / w, maxH / h, 1);
                w = w * scale;
                h = h * scale;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                imageLoaded = true;
            };
        };
        reader.readAsDataURL(file);
    }
}

function drawStringArt() {
    if (!imageLoaded) return;

    const points = 120; // 釘點數量
    const lines = 800;  // 總連線數
    const color = colorInput.value || '#0074D9';
    const lineWidth = parseInt(thicknessInput.value, 10) || 1;

    // 1. 取得圖片灰度資料
    // 先將圖片等比縮放繪製到 canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxW = canvas.width;
    const maxH = canvas.height;
    let w = image.width;
    let h = image.height;
    const scale = Math.min(maxW / w, maxH / h, 1);
    w = w * scale;
    h = h * scale;
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

    // 取得灰度圖像素
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Float32Array(canvas.width * canvas.height);
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

    // 3. 開始自動連線
    let current = 0;
    const usedLines = new Set();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.85;

    for (let l = 0; l < lines; l++) {
        let bestScore = -Infinity;
        let bestIdx = -1;
        // 在所有釘點中尋找最佳下一點
        for (let j = 0; j < points; j++) {
            if (j === current) continue;
            const key = current < j ? `${current}-${j}` : `${j}-${current}`;
            if (usedLines.has(key)) continue; // 避免重複
            // 計算這條線經過的像素灰度總和
            let score = 0;
            const [x0, y0] = pointArray[current];
            const [x1, y1] = pointArray[j];
            const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let s = 0; s <= steps; s++) {
                const x = Math.round(x0 + (x1 - x0) * s / steps);
                const y = Math.round(y0 + (y1 - y0) * s / steps);
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    score += gray[y * canvas.width + x];
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestIdx = j;
            }
        }
        if (bestIdx === -1) break;
        // 畫線
        ctx.beginPath();
        ctx.moveTo(pointArray[current][0], pointArray[current][1]);
        ctx.lineTo(pointArray[bestIdx][0], pointArray[bestIdx][1]);
        ctx.stroke();
        // 抹亮這條線（模擬線已覆蓋）
        const [x0, y0] = pointArray[current];
        const [x1, y1] = pointArray[bestIdx];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(x0 + (x1 - x0) * s / steps);
            const y = Math.round(y0 + (y1 - y0) * s / steps);
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                gray[y * canvas.width + x] *= 0.7; // 每次線條覆蓋就變亮
            }
        }
        usedLines.add(current < bestIdx ? `${current}-${bestIdx}` : `${bestIdx}-${current}`);
        current = bestIdx;
    }
    ctx.restore();
}