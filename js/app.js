let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let output = document.getElementById("output");
let detectBtn = document.getElementById("detectBtn");

let model;

// Load MNIST model
async function loadModel() {
  model = await tf.loadLayersModel(
    "https://storage.googleapis.com/tfjs-models/tfjs/mnist/model.json"
  );
  model.predict(tf.zeros([1, 28, 28, 1]));
}

// Start camera
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
}

// Main detection
detectBtn.onclick = async () => {
  output.textContent = "Detecting...";

  // Draw frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  // OpenCV processing
  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  let blur = new cv.Mat();
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

  let edges = new cv.Mat();
  cv.Canny(blur, edges, 50, 150);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // Find largest contour
  let maxContour = null;
  let maxArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    let cnt = contours.get(i);
    let area = cv.contourArea(cnt);
    if (area > maxArea) {
      maxArea = area;
      maxContour = cnt;
    }
  }

  if (!maxContour) {
    output.textContent = "No digit found";
    return;
  }

  // Crop bounding box
  let rect = cv.boundingRect(maxContour);
  let roi = gray.roi(rect);

  // Resize to 28x28
  let resized = new cv.Mat();
  cv.resize(roi, resized, new cv.Size(28, 28));

  // Convert to tensor
  let imgData = resized.data;
  let input = [];
  for (let i = 0; i < imgData.length; i++) {
    input.push((255 - imgData[i]) / 255);
  }

  let tensor = tf.tensor4d(input, [1, 28, 28, 1]);
  let pred = model.predict(tensor);
  let digit = pred.argMax(-1).dataSync()[0];

  output.textContent = digit.toString();

  // Cleanup
  src.delete(); gray.delete(); blur.delete(); edges.delete();
  contours.delete(); hierarchy.delete(); roi.delete(); resized.delete();
  tensor.dispose(); pred.dispose();
};

// Init
(async () => {
  await startCamera();
  await loadModel();
})();
