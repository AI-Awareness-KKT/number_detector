/* =========================================================
   NUMBER DETECTOR — TEMPLATE MATCHING (FINAL VERIFIED)
   Works on GitHub Pages + Mobile Safari + Chrome
   ========================================================= */

/* ---------------- DOM ---------------- */
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

const startBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const detectBtn = document.getElementById("detectBtn");

/* ---------------- CONFIG ---------------- */
const TEMPLATE_SIZE = 120;
const BIN_THRESHOLD = 140;
const CONFIDENCE_THRESHOLD = 60;

/* ---------------- STATE ---------------- */
let templates = {};
let capturedImage = null;

/* =========================================================
   CAMERA
   ========================================================= */
startBtn.onclick = async () => {
  try {
    let stream;

    // Prefer back camera on mobile
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
    }

    video.srcObject = stream;
    output.textContent = "Camera ready";
  } catch {
    output.textContent = "Camera access failed";
  }
};

/* =========================================================
   LOAD DIGIT TEMPLATES (0–9)
   ========================================================= */
async function loadTemplates() {
  for (let d = 0; d <= 9; d++) {
    const img = new Image();
    img.src = `templates/${d}.png`;
    await img.decode();

    const c = document.createElement("canvas");
    c.width = TEMPLATE_SIZE;
    c.height = TEMPLATE_SIZE;

    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    ctx.drawImage(img, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);

    let imgData = ctx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    imgData = binarize(imgData);

    templates[d] = imgData.data;
  }
}

/* =========================================================
   CAPTURE IMAGE
   ========================================================= */
captureBtn.onclick = () => {
  if (!video.videoWidth) {
    output.textContent = "Camera not ready";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  capturedImage = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  output.textContent = "Image captured";
};

/* =========================================================
   BINARIZE IMAGE (BLACK / WHITE)
   ========================================================= */
function binarize(imgData) {
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray =
      0.299 * d[i] +
      0.587 * d[i + 1] +
      0.114 * d[i + 2];

    const v = gray < BIN_THRESHOLD ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  return imgData;
}

/* =========================================================
   AUTO-CROP LARGEST DARK REGION
   ========================================================= */
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
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return null;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  if (cw < 40 || ch < 40) return null;

  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;

  const ctx = c.getContext("2d");
  ctx.putImageData(imgData, -minX, -minY);

  return c;
}

/* =========================================================
   DIFFERENCE SCORE (FOREGROUND ONLY)
   ========================================================= */
function diffScore(test, template) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < test.length; i += 4) {
    // Only compare where template is black
    if (template[i] === 0) {
      sum += Math.abs(test[i] - template[i]);
      count++;
    }
  }

  return count === 0 ? Infinity : sum / count;
}

/* =========================================================
   DETECT DIGIT
   ========================================================= */
detectBtn.onclick = async () => {
  if (!capturedImage) {
    output.textContent = "Capture image first";
    return;
  }

  if (Object.keys(templates).length === 0) {
    output.textContent = "Loading templates...";
    await loadTemplates();
  }

  // Clone & binarize captured image
  const bin = binarize(new ImageData(
    new Uint8ClampedArray(capturedImage.data),
    capturedImage.width,
    capturedImage.height
  ));

  // Crop digit
  const croppedCanvas = cropDigit(bin);
  if (!croppedCanvas) {
    output.textContent = "No clear digit";
    return;
  }

  // Normalize size
  const c = document.createElement("canvas");
  c.width = TEMPLATE_SIZE;
  c.height = TEMPLATE_SIZE;

  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  ctx.drawImage(croppedCanvas, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);

  const testData = ctx
    .getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE)
    .data;

  // Match against templates
  let bestDigit = null;
  let bestScore = Infinity;

  for (let d = 0; d <= 9; d++) {
    const score = diffScore(testData, templates[d]);
    if (score < bestScore) {
      bestScore = score;
      bestDigit = d;
    }
  }

  // Final decision
  output.textContent =
    bestScore < CONFIDENCE_THRESHOLD
      ? bestDigit
      : "No clear digit";
};
