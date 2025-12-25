const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const detectBtn = document.getElementById("detectBtn");

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
  video.srcObject = stream;
}

/* MAIN DETECTION */
detectBtn.onclick = () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 1️⃣ Crop LEFT 35% (where digit is)
  const roiWidth = Math.floor(canvas.width * 0.35);
  const roi = ctx.getImageData(0, 0, roiWidth, canvas.height);

  // 2️⃣ Convert to pure black/white
  for (let i = 0; i < roi.data.length; i += 4) {
    const gray =
      0.3 * roi.data[i] +
      0.59 * roi.data[i + 1] +
      0.11 * roi.data[i + 2];
    const bw = gray < 140 ? 0 : 255;
    roi.data[i] = roi.data[i + 1] = roi.data[i + 2] = bw;
  }

  // Draw processed ROI back
  canvas.width = roiWidth;
  ctx.putImageData(roi, 0, 0);

  // 3️⃣ Vertical stroke projection
  const cols = 20;
  const colDensity = new Array(cols).fill(0);

  for (let x = 0; x < roiWidth; x++) {
    for (let y = 0; y < canvas.height; y++) {
      const idx = (y * roiWidth + x) * 4;
      if (roi.data[idx] === 0) {
        const bucket = Math.floor((x / roiWidth) * cols);
        colDensity[bucket]++;
      }
    }
  }

  // 4️⃣ Digit decision logic
  const left = colDensity.slice(0, 5).reduce((a, b) => a + b);
  const middle = colDensity.slice(7, 13).reduce((a, b) => a + b);
  const right = colDensity.slice(15).reduce((a, b) => a + b);

  let digit = "?";

  if (middle > left && middle > right) digit = "2";
  if (left > middle && right > middle) digit = "0";
  if (right > left && right > middle) digit = "1";

  output.textContent = digit;
};

startCamera();
