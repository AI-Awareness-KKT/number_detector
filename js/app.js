const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("output");

/* ==========================
   CAMERA START
========================== */
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(() => alert("Camera access denied"));

/* ==========================
   MAIN DETECTION FUNCTION
========================== */
function detectNumber() {
  // Capture frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  // Convert to black & white (thresholding)
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i+1] + data[i+2]) / 3;
    const val = avg < 160 ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = val;
  }
  ctx.putImageData(img, 0, 0);

  // Extract digit pattern
  const digit = recognizeDigit(img.data);
  output.textContent = digit ?? "Not clear";
}

/* ==========================
   DIGIT RECOGNITION LOGIC
========================== */
function recognizeDigit(data) {

  const zones = [
    zone(70, 10, 130, 40),    // top
    zone(140, 40, 170, 90),  // top-right
    zone(140, 110, 170, 160),// bottom-right
    zone(70, 160, 130, 190), // bottom
    zone(30, 110, 60, 160),  // bottom-left
    zone(30, 40, 60, 90),    // top-left
    zone(70, 90, 130, 120)   // middle
  ];

  function zone(x1, y1, x2, y2) {
    let count = 0;
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] === 0) count++;
      }
    }
    return count > 120;
  }

  const key = zones.map(z => z ? 1 : 0).join("");

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

  return digits[key];
}
