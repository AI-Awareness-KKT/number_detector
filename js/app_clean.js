const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const startBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const detectBtn = document.getElementById("detectBtn");

let cameraStarted = false;

/* START CAMERA */
startBtn.onclick = async () => {
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } },
        audio: false
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    video.srcObject = stream;
    cameraStarted = true;
    output.textContent = "Camera ready. Capture the digit.";
  } catch {
    output.textContent = "Camera error";
  }
};

/* CAPTURE FRAME */
captureBtn.onclick = () => {
  if (!cameraStarted) {
    output.textContent = "Start camera first";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  preprocess(ctx, canvas.width, canvas.height);
  output.textContent = "Image captured. Click Detect.";
};

/* IMAGE PREPROCESSING */
function preprocess(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const bw = gray > 150 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = bw;
  }
  ctx.putImageData(img, 0, 0);
}

/* DETECT NUMBER */
detectBtn.onclick = async () => {
  output.textContent = "Detecting...";

  try {
    const result = await Tesseract.recognize(
      canvas,
      "eng",
      {
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR
      }
    );

    const digit = result.data.text.replace(/\D/g, "");
    output.textContent = digit || "No digit detected";

  } catch {
    output.textContent = "Detection failed";
  }
};
