const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

let model;

/* Load MNIST model */
async function loadModel() {
  model = await tf.loadLayersModel(
    "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json"
  );
}

/* Start camera */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
  video.srcObject = stream;
}

/* Preprocess frame for MNIST */
function preprocess(ctx, w, h) {
  let img = ctx.getImageData(0, 0, w, h);

  // Convert to grayscale & crop center
  let gray = [];
  for (let i = 0; i < img.data.length; i += 4) {
    gray.push(
      (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3
    );
  }

  let tensor = tf.tensor(gray, [h, w, 1]);
  tensor = tf.image.resizeBilinear(tensor, [28, 28]);
  tensor = tf.sub(255, tensor).div(255);
  tensor = tensor.expandDims(0);

  return tensor;
}

/* Detect digit */
detectBtn.onclick = async () => {
  output.textContent = "Detecting...";

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const input = preprocess(ctx, canvas.width, canvas.height);
  const prediction = model.predict(input);
  const digit = prediction.argMax(1).dataSync()[0];

  output.textContent = digit;
};

(async () => {
  await loadModel();
  await startCamera();
})();
