/* =========================================================
   NUMBER DETECTOR — CAMERA-SAFE TEMPLATE MATCHING
   ========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

const startBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const detectBtn = document.getElementById("detectBtn");

const SIZE = 120;
const BIN_THRESHOLD = 150;
const CONFIDENCE_THRESHOLD = 300;

let templates = {};
let capturedImage = null;

/* ---------------- CAMERA ---------------- */
startBtn.onclick = async () => {
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    video.srcObject = stream;
    output.textContent = "Camera ready";
  } catch {
    output.textContent = "Camera error";
  }
};

/* ---------------- BINARIZE ---------------- */
function binarize(imgData) {
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gray < BIN_THRESHOLD ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return imgData;
}

/* ---------------- LOAD TEMPLATES ---------------- */
async function loadTemplates() {
  for (let d = 0; d <= 9; d++) {
    const img = new Image();
    img.src = `templates/${d}.png`;
    await img.decode();

    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d");

    // FORCE WHITE BACKGROUND
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);

    let data = ctx.getImageData(0, 0, SIZE, SIZE);
    data = binarize(data);

    templates[d] = data.data;
  }
}

/* ---------------- CAPTURE ---------------- */
captureBtn.onclick = () => {
  if (!video.videoWidth) {
    output.textContent = "Camera not ready";
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  capturedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  output.textContent = "Captured";
};

/* ---------------- CROP DIGIT ---------------- */
function cropDigit(imgData) {
  const w = imgData.width;
  const h = imgData.height;
  const d = imgData.data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i] === 0) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!found) return null;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  if (cw < 50 || ch < 50) return null;

  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d");
  ctx.putImageData(imgData, -minX, -minY);
  return c;
}

/* ---------------- DIFFERENCE ---------------- */
function diffScore(test, template) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < test.length; i += 4) {
    // Penalize shape mismatch
    if (template[i] !== test[i]) {
      sum += 1;
    }
    count++;
  }
  return (sum / count) * 1000;
}

/* ---------------- DETECT ---------------- */
detectBtn.onclick = async () => {
  if (!capturedImage) {
    output.textContent = "Capture first";
    return;
  }

  if (!Object.keys(templates).length) {
    output.textContent = "Loading templates...";
    await loadTemplates();
  }

  let bin = binarize(new ImageData(
    new Uint8ClampedArray(capturedImage.data),
    capturedImage.width,
    capturedImage.height
  ));

  const cropped = cropDigit(bin);
  if (!cropped) {
    output.textContent = "No clear digit";
    return;
  }

  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(cropped, 0, 0, SIZE, SIZE);

  const testData = ctx.getImageData(0, 0, SIZE, SIZE).data;

  let bestDigit = null;
  let bestScore = Infinity;

  for (let d = 0; d <= 9; d++) {
    const score = diffScore(testData, templates[d]);
    if (score < bestScore) {
      bestScore = score;
      bestDigit = d;
    }
  }

  output.textContent =
    bestScore < CONFIDENCE_THRESHOLD
      ? bestDigit
      : "No clear digit";
};
