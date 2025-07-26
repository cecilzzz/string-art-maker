
// 取得 index.html 裡的元素

// const canvas = document.getElementById('artCanvas');
// const ctx = canvas.getContext('2d');
const svg = document.getElementById('artSVG');
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

    // 1. 取得圖片灰度資料（降採樣）
    const svgW = svg.getAttribute('width') ? parseInt(svg.getAttribute('width'), 10) : 600;
    const svgH = svg.getAttribute('height') ? parseInt(svg.getAttribute('height'), 10) : 600;
    const DOWNSCALE = 4; // 降採樣倍率
    const dsW = Math.floor(svgW / DOWNSCALE);
    const dsH = Math.floor(svgH / DOWNSCALE);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dsW;
    tempCanvas.height = dsH;
    const tempCtx = tempCanvas.getContext('2d');
    let w = image.width;
    let h = image.height;
    const scale = Math.min(dsW / w, dsH / h, 1);
    w = w * scale;
    h = h * scale;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(image, (tempCanvas.width - w) / 2, (tempCanvas.height - h) / 2, w, h);

    // 取得灰度圖像素
    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const origGray = new Float32Array(tempCanvas.width * tempCanvas.height);
    for (let i = 0; i < origGray.length; i++) {
        const r = imgData.data[i * 4];
        const g = imgData.data[i * 4 + 1];
        const b = imgData.data[i * 4 + 2];
        origGray[i] = 255 - (0.299 * r + 0.587 * g + 0.114 * b);
    }

    // 2. 計算釘點座標（全部基於降採樣後的 canvas）
    const dsCenterX = dsW / 2;
    const dsCenterY = dsH / 2;
    const dsRadius = Math.min(dsCenterX, dsCenterY) - 4; // 留邊界
    const pointArray = [];
    for (let i = 0; i < points; i++) {
        const angle = (2 * Math.PI * i) / points - Math.PI / 2;
        pointArray.push([
            dsCenterX + dsRadius * Math.cos(angle),
            dsCenterY + dsRadius * Math.sin(angle)
        ]);
    }

    // 清空 SVG 畫布，設置灰色背景
    svg.innerHTML = '';
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.style.background = '#888';

    // 釘點可選：可加圓點顯示
    // for (let i = 0; i < pointArray.length; i++) {
    //     let [x, y] = pointArray[i];
    //     let dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    //     dot.setAttribute('cx', x);
    //     dot.setAttribute('cy', y);
    //     dot.setAttribute('r', 1);
    //     dot.setAttribute('fill', '#333');
    //     svg.appendChild(dot);
    // }

    let lastDrawn = 0;
    let worker = new Worker('lineWorker.js');
    // 自適應速度
    let linesPerSecond = 20;
    let lastTime = performance.now();
    let lastLineCount = 0;
    // 初始累積灰度圖（全255，代表純灰背景）
    const accumGray = new Float32Array(origGray.length);
    for (let i = 0; i < accumGray.length; i++) accumGray[i] = 127; // 純灰色背景
    worker.postMessage({
        points,
        lines,
        width: tempCanvas.width,
        height: tempCanvas.height,
        pointArray,
        origGray: Array.from(origGray),
        accumGray: Array.from(accumGray),
        linesPerSecond
    });
    // SVG繪製時將降採樣釘點映射回SVG座標
    function mapToSVG([x, y]) {
        return [
            (x / dsW) * svgW,
            (y / dsH) * svgH
        ];
    }
    // D3.js 動畫繪製隊列（累積式）
    if (window.d3 === undefined) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
        script.onload = startD3Drawing;
        document.head.appendChild(script);
    } else {
        startD3Drawing();
    }

    function startD3Drawing() {
        const d3svg = d3.select(svg);
        d3svg.selectAll('*').remove();
        // 分組
        const g = d3svg.append('g');
        let allLines = [];
        let lastDrawn = 0;
        let drawing = false;
        const DRAW_BATCH = 8;
        function drawNextBatch() {
            if (lastDrawn >= allLines.length) {
                drawing = false;
                return;
            }
            drawing = true;
            const end = Math.min(lastDrawn + DRAW_BATCH, allLines.length);
            const batch = allLines.slice(lastDrawn, end);
            // 只 append 新線條，不用 join，確保平滑增長
            g.selectAll(null)
                .data(batch)
                .enter()
                .append('line')
                .attr('class', 'temp')
                .attr('x1', d => mapToSVG(pointArray[d[0]])[0])
                .attr('y1', d => mapToSVG(pointArray[d[0]])[1])
                .attr('x2', d => mapToSVG(pointArray[d[1]])[0])
                .attr('y2', d => mapToSVG(pointArray[d[1]])[1])
                .attr('stroke', d => d[2] === 'black' ? '#fff' : '#111')
                .attr('stroke-width', lineWidth)
                .attr('stroke-linecap', 'round')
                .attr('opacity', 0.85);
            lastDrawn = end;
            requestAnimationFrame(drawNextBatch);
        }
        worker.onmessage = function(e) {
            if (e.data.type === 'progress') {
                const linesArr = e.data.lines;
                // 將新線條累積到 allLines
                for (let i = allLines.length; i < linesArr.length; i++) {
                    allLines.push(linesArr[i]);
                }
                if (!drawing) drawNextBatch();
                // 自適應速度調整（保留worker內部）
                const now = performance.now();
                const dt = now - lastTime;
                const drawn = allLines.length - lastLineCount;
                if (dt > 0 && drawn > 0) {
                    let actualLPS = drawn / (dt / 1000);
                    if (actualLPS < 15) linesPerSecond = Math.max(2, linesPerSecond - 2);
                    else if (actualLPS > 30) linesPerSecond = Math.min(100, linesPerSecond + 5);
                    worker.postMessage({ type: 'setLPS', linesPerSecond });
                }
                lastTime = now;
                lastLineCount = allLines.length;
                if (e.data.finished) {
                    worker.terminate();
                }
            } else if (e.data.type === 'done') {
                worker.terminate();
            }
        };
    }
}