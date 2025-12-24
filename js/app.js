// app.js — Model-free handwritten digit detection
// Works on GitHub Pages (no TensorFlow, no OpenCV)

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

/* ================= CAMERA ================= */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

/* ================= IMAGE PROCESS ================= */
function preprocess() {
  const ctx = canvas.getContext("2d");
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const size = Math.min(vw, vh) * 0.6;
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;

  let blackPixels = [];
  let minX = size, minY = size, maxX = 0, maxY = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const isBlack = gray < 160;

    if (isBlack) {
      const x = (i / 4) % size;
      const y = Math.floor(i / 4 / size);
      blackPixels.push({ x, y });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (blackPixels.length < 200) return null;

  return {
    pixels: blackPixels,
    width: maxX - minX,
    height: maxY - minY
  };
}

/* ================= FEATURE EXTRACTION ================= */
function extractFeatures(pixels, w, h) {
  let vertical = 0;
  let horizontal = 0;
  let center = 0;

  pixels.forEach(p => {
    if (p.x > w * 0.4 && p.x < w * 0.6) vertical++;
    if (p.y > h * 0.4 && p.y < h * 0.6) horizontal++;
    if (
      p.x > w * 0.3 && p.x < w * 0.7 &&
      p.y > h * 0.3 && p.y < h * 0.7
    ) center++;
  });

  return {
    density: pixels.length,
    vertical,
    horizontal,
    center,
    aspect: h / w
  };
}

/* ================= DIGIT LOGIC ================= */
function classify(f) {
  if (f.aspect > 2.2 && f.vertical > f.horizontal * 3) return "1";
  if (f.center > f.density * 0.3) return "0";
  if (f.horizontal > f.vertical && f.aspect < 1.2) return "7";
  if (f.center > f.density * 0.2 && f.aspect < 1.5) return "8";
  if (f.aspect > 1.4 && f.vertical > f.horizontal) return "9";
  if (f.aspect < 1.1 && f.center < f.density * 0.15) return "2";
  if (f.center > f.density * 0.15) return "6";
  if (f.vertical > f.horizontal * 1.2) return "4";

  return "Not clear";
}

/* ================= DETECT ================= */
detectBtn.addEventListener("click", () => {
  output.textContent = "Detecting…";

  const data = preprocess();
  if (!data) {
    output.textContent = "Show number clearly";
    return;
  }

  const features = extractFeatures(
    data.pixels,
    data.width,
    data.height
  );

  output.textContent = classify(features);
});

/* ================= INIT ================= */
startCamera();
