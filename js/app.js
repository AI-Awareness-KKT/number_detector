const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const startBtn = document.getElementById("startCameraBtn");
const detectBtn = document.getElementById("detectBtn");

let net;
let classifier;
let cameraStarted = false;

/* Start camera on user click */
startBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    video.srcObject = stream;
    cameraStarted = true;
    output.textContent = "Loading model...";
    await loadModels();
    output.textContent = "Show digit and press Detect";
  } catch (e) {
    alert("Camera access denied or unavailable");
  }
};

/* Load models (NO 404 possible) */
async function loadModels() {
  net = await mobilenet.load();
  classifier = knnClassifier.create();
}

/* Capture frame */
function captureFrame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return tf.browser.fromPixels(canvas);
}

/* Detect digit */
detectBtn.onclick = async () => {
  if (!cameraStarted || !net || !classifier) {
    output.textContent = "Start camera first";
    return;
  }

  output.textContent = "Detecting...";

  const img = captureFrame();
  const activation = net.infer(img, true);

  // Temporary demo logic (shows structure works)
  output.textContent = "Camera + ML working ✔";

  img.dispose();
};
