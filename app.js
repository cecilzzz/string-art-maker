// filepath: /string-art-image-generator/string-art-image-generator/src/app.js
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

const uploadInput = document.createElement('input');
uploadInput.type = 'file';
uploadInput.accept = 'image/*';
document.body.appendChild(uploadInput);

const generateButton = document.createElement('button');
generateButton.textContent = '生成字符串艺术';
document.body.appendChild(generateButton);

uploadInput.addEventListener('change', handleImageUpload);
generateButton.addEventListener('click', drawStringArt);

let image = new Image();

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            image.src = e.target.result;
            image.onload = () => {
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
            };
        };
        reader.readAsDataURL(file);
    }
}

function drawStringArt() {
    if (!image.src) return;

    const points = 100; // Number of points for string art
    const step = 13; // Step for connecting points
    const color = '#0074D9'; // Default color
    const lineWidth = 1; // Default line width

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

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