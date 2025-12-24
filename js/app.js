const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

/* START CAMERA */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    video.srcObject = stream;
  } catch (error) {
    alert("Camera access is required.");
  }
}

/* IMAGE PRE-PROCESSING */
function preprocessImage(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

    // Thresholding (improves digit clarity)
    const value = avg > 140 ? 255 : 0;

    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
  }

  ctx.putImageData(imageData, 0, 0);
}

/* DETECT NUMBER */
detectBtn.addEventListener("click", async () => {
  output.textContent = "Detecting... Hold steady";

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Pre-process image
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

    output.textContent = text.length ? text[0] : "Not clear";
  } catch (err) {
    output.textContent = "Detection failed";
  }
});

startCamera();
