const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model;

/* =========================
   START CAMERA
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
   LOAD MODEL (GITHUB HOSTED)
========================= */
async function loadModel() {
  model = await tf.loadLayersModel(
    "https://hpssjellis.github.io/beginner-tensorflowjs-examples-in-javascript/saved-models/mnist/convnet/model.json"
  );
  model.predict(tf.zeros([1, 28, 28, 1])); // warm-up
  output.textContent = "Ready";
}

/* =========================
   PREPROCESS FRAME
========================= */
function getInputTensor() {
  const size = 28;
  const ctx = canvas.getContext("2d");

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // simple center crop
  const crop = Math.min(vw, vh) * 0.6;
  const sx = (vw - crop) / 2;
  const sy = (vh - crop) / 2;

  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(video, sx, sy, crop, crop, 0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size).data;
  const data = new Float32Array(size * size);

  for (let i = 0, j = 0; i < img.length; i += 4, j++) {
    const gray = (img[i] + img[i + 1] + img[i + 2]) / 3;
    data[j] = (255 - gray) / 255; // invert + normalize
  }

  return tf.tensor4d(data, [1, size, size, 1]);
}

/* =========================
   DETECT BUTTON
========================= */
detectBtn.onclick = async () => {
  if (!model) {
    output.textContent = "Model not ready";
    return;
  }

  output.textContent = "Detecting...";

  const input = getInputTensor();
  const prediction = model.predict(input);
  const scores = prediction.dataSync();

  let digit = scores.indexOf(Math.max(...scores));
  let confidence = Math.max(...scores);

  input.dispose();
  prediction.dispose();

  output.textContent =
    confidence > 0.6 ? digit : "Not clear";
};

/* =========================
   INIT
========================= */
(async () => {
  await startCamera();
  await loadModel();
})();
