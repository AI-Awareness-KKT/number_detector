// app.js — Accurate MNIST-style digit detection

const MODEL_URL =
  "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model;

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

/* ================= MODEL ================= */
async function loadModel() {
  output.textContent = "Loading model…";
  model = await tf.loadLayersModel(MODEL_URL);
  model.predict(tf.zeros([1, 28, 28, 1]));
  output.textContent = "Ready";
}

/* ================= PREPROCESS ================= */
function preprocess() {
  const ctx = canvas.getContext("2d");
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Step 1: Crop center square
  const size = Math.min(vw, vh) * 0.6;
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

  // Step 2: Convert to grayscale + adaptive threshold
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;

  let minX = size, minY = size, maxX = 0, maxY = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const v = gray < 170 ? 0 : 255;

    data[i] = data[i + 1] = data[i + 2] = v;

    if (v === 0) {
      const px = (i / 4) % size;
      const py = Math.floor(i / 4 / size);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }

  // Step 3: Bounding box
  const bw = maxX - minX;
  const bh = maxY - minY;

  if (bw < 20 || bh < 20) return null;

  // Step 4: Resize to 28×28
  const digit = document.createElement("canvas");
  digit.width = 28;
  digit.height = 28;

  const dctx = digit.getContext("2d");
  dctx.fillStyle = "black";
  dctx.fillRect(0, 0, 28, 28);
  dctx.drawImage(
    canvas,
    minX,
    minY,
    bw,
    bh,
    4,
    4,
    20,
    20
  );

  const dimg = dctx.getImageData(0, 0, 28, 28);
  const arr = new Float32Array(28 * 28);

  for (let i = 0, j = 0; i < dimg.data.length; i += 4, j++) {
    arr[j] = (255 - dimg.data[i]) / 255;
  }

  return tf.tensor4d(arr, [1, 28, 28, 1]);
}

/* ================= DETECT ================= */
detectBtn.addEventListener("click", async () => {
  output.textContent = "Detecting… keep still";

  const input = preprocess();
  if (!input) {
    output.textContent = "Show number clearly";
    return;
  }

  const preds = model.predict(input);
  const scores = preds.dataSync();

  let digit = scores.indexOf(Math.max(...scores));
  let confidence = Math.max(...scores);

  input.dispose();
  preds.dispose();

  if (confidence < 0.6) {
    output.textContent = "Not clear";
  } else {
    output.textContent = `${digit}`;
  }
});

/* ================= INIT ================= */
(async () => {
  await startCamera();
  await loadModel();
})();
