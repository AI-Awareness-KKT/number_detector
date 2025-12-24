const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model;

/* =============================
   START CAMERA
============================= */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

/* =============================
   LOAD MODEL
============================= */
async function loadModel() {
  output.textContent = "Loading model...";
  model = await tf.loadLayersModel(
    "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json"
  );
  model.predict(tf.zeros([1, 28, 28, 1])); // warmup
  output.textContent = "Ready";
}

/* =============================
   PREPROCESS FRAME
============================= */
function preprocessFrame() {
  const size = 28;
  const ctx = canvas.getContext("2d");

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // center crop
  const crop = Math.min(vw, vh) * 0.6;
  const sx = (vw - crop) / 2;
  const sy = (vh - crop) / 2;

  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(video, sx, sy, crop, crop, 0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const arr = new Float32Array(size * size);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;

    // invert + normalize
    arr[j] = (255 - gray) / 255;
  }

  return tf.tensor4d(arr, [1, size, size, 1]);
}

/* =============================
   DETECT DIGIT
============================= */
detectBtn.addEventListener("click", async () => {
  if (!model) {
    output.textContent = "Model not ready";
    return;
  }

  output.textContent = "Detecting...";

  const input = preprocessFrame();
  const pred = model.predict(input);
  const scores = pred.dataSync();

  let digit = 0;
  let best = scores[0];
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > best) {
      best = scores[i];
      digit = i;
    }
  }

  input.dispose();
  pred.dispose();

  if (best < 0.6) {
    output.textContent = "Not clear";
  } else {
    output.textContent = digit.toString();
  }
});

/* =============================
   INIT
============================= */
(async () => {
  await startCamera();
  await loadModel();
})();
