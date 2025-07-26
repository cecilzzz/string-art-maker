
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

    const points = parseInt(pointsInput.value, 10) || 200;
    const lines = parseInt(linesInput.value, 10) || 800;
    const color = colorInput.value || '#0074D9';
    const lineWidth = parseFloat(thicknessInput.value) || 0.3;

    // 1. 取得圖片灰度資料
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

    // 畫灰度背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgImgData = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < gray.length; i++) {
        const v = 255 - gray[i];
        bgImgData.data[i * 4] = v;
        bgImgData.data[i * 4 + 1] = v;
        bgImgData.data[i * 4 + 2] = v;
        bgImgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(bgImgData, 0, 0);

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.85;

    let lastDrawn = 0;
    let worker = new Worker('lineWorker.js');
    // 自適應速度
    let linesPerSecond = 20;
    let lastTime = performance.now();
    let lastLineCount = 0;
    worker.postMessage({
        points,
        lines,
        width: tempCanvas.width,
        height: tempCanvas.height,
        pointArray,
        gray: Array.from(gray),
        linesPerSecond
    });
    worker.onmessage = function(e) {
        if (e.data.type === 'progress') {
            const linesArr = e.data.lines;
            for (let i = lastDrawn; i < linesArr.length; i++) {
                const [a, b, colorType] = linesArr[i];
                ctx.beginPath();
                ctx.moveTo(pointArray[a][0], pointArray[a][1]);
                ctx.lineTo(pointArray[b][0], pointArray[b][1]);
                ctx.strokeStyle = colorType === 'black' ? '#111' : '#fff';
                ctx.stroke();
            }
            lastDrawn = linesArr.length;
            // 自適應速度調整
            const now = performance.now();
            const dt = now - lastTime;
            const drawn = lastDrawn - lastLineCount;
            if (dt > 0 && drawn > 0) {
                let actualLPS = drawn / (dt / 1000);
                if (actualLPS < 15) linesPerSecond = Math.max(2, linesPerSecond - 2);
                else if (actualLPS > 30) linesPerSecond = Math.min(100, linesPerSecond + 5);
                worker.postMessage({ type: 'setLPS', linesPerSecond });
            }
            lastTime = now;
            lastLineCount = lastDrawn;
            if (e.data.finished) {
                ctx.restore();
                worker.terminate();
            }
        } else if (e.data.type === 'done') {
            ctx.restore();
            worker.terminate();
        }
    };
}