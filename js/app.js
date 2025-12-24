const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");

let currentFacingMode = "environment";
let stream = null;

/* ================= CAMERA ================= */
async function startCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacingMode }
  });

  video.srcObject = stream;
}

startCamera();

function switchCamera() {
  currentFacingMode =
    currentFacingMode === "environment" ? "user" : "environment";
  startCamera();
}

/* ================= DETECTION ================= */
function detectNumber() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  // Adaptive threshold
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i+1] + data[i+2]) / 3;
  }
  const threshold = sum / (data.length / 4) - 20;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
    const v = avg < threshold ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = v;
  }

  ctx.putImageData(img, 0, 0);

  const digit = recognizeDigit(data);
  output.textContent = digit ?? "Not clear";
}

/* ================= DIGIT LOGIC ================= */
function recognizeDigit(data) {

  function segment(x1, y1, x2, y2) {
    let ink = 0;
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] === 0) ink++;
      }
    }
    return ink > 180;
  }

  const s = [
    segment(80, 15, 160, 45),    // top
    segment(165, 45, 200, 110),  // top-right
    segment(165, 130, 200, 195), // bottom-right
    segment(80, 195, 160, 225),  // bottom
    segment(40, 130, 75, 195),   // bottom-left
    segment(40, 45, 75, 110),    // top-left
    segment(80, 110, 160, 140)   // middle
  ];

  const key = s.map(v => v ? 1 : 0).join("");

  const digits = {
    "1111110": 0,
    "0110000": 1,
    "1101101": 2,
    "1111001": 3,
    "0110011": 4,
    "1011011": 5,
    "1011111": 6,
    "1110000": 7,
    "1111111": 8,
    "1111011": 9
  };

  // Extra fix: distinguish 9 vs 3
  if (key === "1111001" && s[5]) return 9;

  return digits[key];
}
