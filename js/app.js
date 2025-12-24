// app.js — High-accuracy single-digit webcam detector (TensorFlow.js CNN, MNIST)

const MODEL_URL = "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json"; 
// This is a known good TFJS MNIST model hosted by Google

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");
let model;

// Start camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert("Camera access is required.");
  }
}

// Load TFJS model
async function loadModel() {
  output.textContent = "Loading model...";
  model = await tf.loadLayersModel(MODEL_URL);
  output.textContent = "Model loaded!";
}

// Preprocess webcam frame
function preprocess() {
  const size = 28;
  const ctx = canvas.getContext("2d");
  
  // Crop a centered square region
  const cropSize = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - cropSize) / 2;
  const sy = (video.videoHeight - cropSize) / 2;

  canvas.width = size;
  canvas.height = size;

  // Draw and scale
  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);

  // Get image data
  const imgData = ctx.getImageData(0, 0, size, size);
  let data = [];

  for (let i = 0; i < imgData.data.length; i += 4) {
    const r = imgData.data[i];
    const g = imgData.data[i + 1];
    const b = imgData.data[i + 2];
    const avg = (r + g + b) / 3;
    data.push((255 - avg) / 255);
  }

  return tf.tensor4d(data, [1, size, size, 1]);
}

// Detect button
detectBtn.addEventListener("click", async () => {
  if (!model) return;

  output.textContent = "Detecting...";
  const inputTensor = preprocess();
  const prediction = model.predict(inputTensor);
  const scores = prediction.dataSync();
  const best = scores.indexOf(Math.max(...scores));

  output.textContent = best.toString();
});
  
(async function init() {
  await startCamera();
  await loadModel();
})();
