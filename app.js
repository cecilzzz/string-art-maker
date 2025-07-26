
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

    const points = 100; // 可改為參數
    const step = 13;
    const color = colorInput.value || '#0074D9';
    const lineWidth = parseInt(thicknessInput.value, 10) || 1;

    // 重新繪製圖片
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 圖片等比縮放居中
    const maxW = canvas.width;
    const maxH = canvas.height;
    let w = image.width;
    let h = image.height;
    const scale = Math.min(maxW / w, maxH / h, 1);
    w = w * scale;
    h = h * scale;
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

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

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.85;

    for (let i = 0; i < points; i++) {
        const j = (i * step) % points;
        ctx.beginPath();
        ctx.moveTo(pointArray[i][0], pointArray[i][1]);
        ctx.lineTo(pointArray[j][0], pointArray[j][1]);
        ctx.stroke();
    }
    ctx.restore();
}