const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

/* START CAMERA */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
  } catch (error) {
    alert("Camera permission is required.");
  }
}

/* IMAGE PREPROCESSING */
function preprocessImage(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert to grayscale
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Strong threshold (black digit on white paper)
    gray = gray > 160 ? 255 : 0;

    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
}

/* DETECT NUMBER */
detectBtn.addEventListener("click", async () => {
  output.textContent = "Detecting...";

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Apply preprocessing
  preprocessImage(ctx, canvas.width, canvas.height);

  try {
    const result = await Tesseract.recognize(
      canvas,
      "eng",
      {
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR
      }
    );

    const text = result.data.text.replace(/\D/g, "");

    if (text.length === 1) {
      output.textContent = text;
    } else {
      output.textContent = "Show one clear digit";
    }
  } catch (err) {
    output.textContent = "Detection failed";
  }
});

startCamera();
