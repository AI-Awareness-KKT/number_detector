// app.js — MNIST CNN with 9-safe preprocessing

const MODEL_URL = "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model;

/* CAMERA */
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

/* LOAD MODEL */
async function loadModel() {
  output.textContent = "Loading model…";
  model = await tf.loadLayersModel(MODEL_URL);
  model.predict(tf.zeros([1, 28, 28, 1]));
  output.textContent = "Ready";
}

/* PREPROCESS (9-SAFE) */
function preprocess() {
  const ctx = canvas.getContext("2d");

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const size = Math.min(vw, vh) * 0.65;

  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  canvas.width = 28;
  canvas.height = 28;

  ctx.drawImage(video, sx, sy, size, size, 0, 0, 28, 28);

  const img = ctx.getImageData(0, 0, 28, 28);
  const data = img.data;
  const arr = new Float32Array(28 * 28);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;

    // adaptive threshold keeps 9 tail visible
    let val = gray < 160 ? 255 : 0;

    // invert for MNIST
    val = 255 - val;

    arr[j] = val / 255;
  }

  return tf.tensor4d(arr, [1, 28, 28, 1]);
}

/* DETECT */
detectBtn.addEventListener("click", async () => {
  output.textContent = "Detecting… hold steady";

  const input = preprocess();
  const preds = model.predict(input);
  const scores = preds.dataSync();

  let best = 0;
  let bestScore = scores[0];
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      best = i;
    }
  }

  input.dispose();
  preds.dispose();

  // Confidence guard (important for 9)
  if (bestScore < 0.55) {
    output.textContent = "Not clear";
  } else {
    output.textContent = `${best}`;
  }
});

/* INIT */
(async () => {
  await startCamera();
  await loadModel();
})();
