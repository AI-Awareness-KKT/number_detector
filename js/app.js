const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let modelLoaded = false;
let model;

/* =============================
   CAMERA
============================= */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

/* =============================
   LOAD MODEL (GITHUB HOSTED)
============================= */
async function loadModel() {
  try {
    output.textContent = "Loading model...";

    model = await tf.loadLayersModel(
      "https://hpssjellis.github.io/beginner-tensorflowjs-examples-in-javascript/saved-models/mnist/convnet/model.json"
    );

    // warm up
    model.predict(tf.zeros([1, 28, 28, 1]));
    modelLoaded = true;
    output.textContent = "Ready";
  } catch (err) {
    console.error(err);
    output.textContent = "Model failed to load";
  }
}

/* =============================
   PREPROCESS
============================= */
function preprocess() {
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

/* =============================
   DETECT
============================= */
detectBtn.onclick = async () => {
  if (!modelLoaded) {
    output.textContent = "Model not ready";
    return;
  }

  output.textContent = "Detecting...";

  const input = preprocess();
  const pred = model.predict(input);
  const scores = pred.dataSync();

  let digit = scores.indexOf(Math.max(...scores));
  let confidence = Math.max(...scores);

  input.dispose();
  pred.dispose();

  output.textContent = confidence > 0.6 ? digit : "Not clear";
};

/* =============================
   INIT
============================= */
(async () => {
  await startCamera();
  await loadModel();
})();
