const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model = null;

/* =========================
   CAMERA
========================= */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

/* =========================
   LOAD MODEL (jsDelivr)
========================= */
async function loadModel() {
  try {
    output.textContent = "Loading model…";

    model = await tf.loadLayersModel(
      "https://cdn.jsdelivr.net/gh/tensorflow/tfjs-models/mnist/model.json"
    );

    // warm up
    model.predict(tf.zeros([1, 28, 28, 1]));
    output.textContent = "Ready";
  } catch (e) {
    console.error(e);
    output.textContent = "Model failed to load";
  }
}

/* =========================
   PREPROCESS
========================= */
function getTensor() {
  const size = 28;
  const ctx = canvas.getContext("2d");

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const crop = Math.min(vw, vh) * 0.6;

  const sx = (vw - crop) / 2;
  const sy = (vh - crop) / 2;

  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(video, sx, sy, crop, crop, 0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size).data;
  const arr = new Float32Array(size * size);

  for (let i = 0, j = 0; i < img.length; i += 4, j++) {
    const gray = (img[i] + img[i + 1] + img[i + 2]) / 3;
    arr[j] = (255 - gray) / 255;
  }

  return tf.tensor4d(arr, [1, size, size, 1]);
}

/* =========================
   DETECT
========================= */
detectBtn.onclick = async () => {
  if (!model) {
    output.textContent = "Model not ready";
    return;
  }

  output.textContent = "Detecting…";

  const input = getTensor();
  const prediction = model.predict(input);
  const scores = prediction.dataSync();

  let digit = 0;
  let max = scores[0];
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > max) {
      max = scores[i];
      digit = i;
    }
  }

  input.dispose();
  prediction.dispose();

  output.textContent = max > 0.6 ? digit : "Not clear";
};

/* =========================
   INIT
========================= */
(async () => {
  await startCamera();
  await loadModel();
})();
