// app.js — TensorFlow.js MNIST convnet detector (single digit, stabilized)
const MODEL_URL = 'https://hpssjellis.github.io/beginner-tensorflowjs-examples-in-javascript/saved-models/mnist/convnet/my-mnist01.json';

// DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas'); // offscreen canvas used for preprocessing
const output = document.getElementById('output');
const detectBtn = document.getElementById('detectBtn');

let model = null;
let isModelLoaded = false;

// Load model once at startup
async function loadModel() {
  output.textContent = 'Loading model…';
  try {
    model = await tf.loadLayersModel(MODEL_URL);
    // warm up the model with a dummy predict
    model.predict(tf.zeros([1, 28, 28, 1]));
    isModelLoaded = true;
    output.textContent = 'Model loaded. Ready.';
  } catch (err) {
    console.error('Model load error', err);
    output.textContent = 'Model load failed';
  }
}

// start camera with higher resolution ideal for preprocessing
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.error('Camera start error', err);
    alert('Camera access is required.');
  }
}

/* Preprocess pipeline:
   - crop center square region (user should place the digit in center)
   - draw to an offscreen canvas scaled to 28x28
   - convert to grayscale
   - invert (because model expects white-on-black like MNIST)
   - normalize to [0,1]
   - return a Tensor of shape [1,28,28,1]
*/
function preprocessCenterTo28Tensor(videoEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const cropSize = Math.min(vw, vh) * 0.6; // crop center 60%
  const sx = (vw - cropSize) / 2;
  const sy = (vh - cropSize) / 2;

  // prepare offscreen canvas sized 28x28 for the model
  const off = canvas;
  off.width = 28;
  off.height = 28;
  const ctx = off.getContext('2d');

  // draw cropped area scaled down to 28x28
  ctx.drawImage(videoEl, sx, sy, cropSize, cropSize, 0, 0, 28, 28);

  // get image data and convert to float32 normalized tensor
  const imgData = ctx.getImageData(0, 0, 28, 28);
  const data = imgData.data;
  // create Float32Array for one channel
  const gray = new Float32Array(28 * 28);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // standard grayscale
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let lum = (0.299 * r + 0.587 * g + 0.114 * b);

    // invert: input images are black-on-white (marker on paper).
    // MNIST-like models expect white-on-black (digit strokes bright).
    lum = 255 - lum;

    // simple contrast stretch: boost mid-range to improve thin strokes
    // apply a gamma-like curve to emphasize strokes (optional tuning)
    // clamp to 0..255
    if (lum < 0) lum = 0;
    if (lum > 255) lum = 255;

    // normalize to 0..1
    gray[j] = lum / 255;
  }

  // build tensor [1,28,28,1]
  const input = tf.tensor4d(gray, [1, 28, 28, 1]);
  return input;
}

/* Stabilized multi-frame prediction:
   - capture N frames (fast), run model.predict on each
   - sum probabilities and take argmax on summed probs
   - return {digit, confidence} where confidence is averaged probability for that digit
*/
async function stabilizedPredict(frames = 4, delayMs = 80) {
  if (!isModelLoaded) throw new Error('Model not loaded');

  // accumulate probabilities
  let acc = tf.zeros([10]);

  for (let i = 0; i < frames; i++) {
    const input = preprocessCenterTo28Tensor(video);
    // predict probs
    const probs = model.predict(input); // shape [1,10]
    const probs1d = probs.squeeze(); // [10]
    acc = tf.add(acc, probs1d);

    // clean up tensors
    probs.dispose();
    input.dispose();
    probs1d.dispose();

    // small delay between captures improves robustness to transient blur
    await new Promise(res => setTimeout(res, delayMs));
  }

  // averaged probabilities
  const avg = tf.div(acc, frames);
  const avgData = await avg.data(); // Float32Array length 10
  // find argmax and confidence
  let best = 0;
  let bestProb = avgData[0];
  for (let k = 1; k < avgData.length; k++) {
    if (avgData[k] > bestProb) {
      bestProb = avgData[k];
      best = k;
    }
  }

  // cleanup
  acc.dispose();
  avg.dispose();

  return { digit: best, confidence: bestProb };
}

/* UI: detect button handler */
detectBtn.addEventListener('click', async () => {
  if (!isModelLoaded) {
    output.textContent = 'Model not ready';
    return;
  }

  output.textContent = 'Detecting… hold steady';

  try {
    // use 4 frames and 80ms delay = ~300ms capture window
    const { digit, confidence } = await stabilizedPredict(4, 80);

    // apply confidence threshold (tunable)
    const confPct = Math.round(confidence * 100);
    const CONF_THRESHOLD = 0.65; // require >=65% averaged prob

    if (confidence >= CONF_THRESHOLD) {
      output.textContent = `${digit}  (confidence ${confPct}%)`;
    } else {
      output.textContent = `Not clear (best ${digit}, ${confPct}%)`;
    }
  } catch (err) {
    console.error(err);
    output.textContent = 'Detection error';
  }
});

// initialize
(async function init() {
  await startCamera();
  await loadModel();
})();
