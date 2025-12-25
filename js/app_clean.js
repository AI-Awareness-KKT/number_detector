// js/app.js
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const startBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const detectBtn = document.getElementById("detectBtn");

let cameraStarted = false;
let latestCaptureDataURL = null;

// Wait for OpenCV to be ready
function waitForOpencv() {
  return new Promise((resolve) => {
    if (typeof cv !== "undefined" && cv && cv.ready) return resolve();
    // cv.onRuntimeInitialized will be called by OpenCV when ready
    const old = window.cv;
    if (old && old.onRuntimeInitialized) {
      old.onRuntimeInitialized = () => resolve();
    } else {
      // fallback poll
      const id = setInterval(() => {
        if (typeof cv !== "undefined" && cv && cv.ready) {
          clearInterval(id);
          resolve();
        }
      }, 100);
    }
  });
}

// Start camera (prefer back camera)
startBtn.onclick = async () => {
  output.textContent = "Requesting camera...";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    output.textContent = "Camera not supported in this browser";
    return;
  }

  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
    } catch {
      // fallback
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = stream;
    cameraStarted = true;
    output.textContent = "Camera started. Align the digit and tap Capture.";
    await waitForOpencv();
    output.textContent = "Camera started. OpenCV ready. Align digit and tap Capture.";
  } catch (err) {
    console.error(err);
    output.textContent = "Camera access denied or unavailable";
  }
};

// Capture frame into canvas and keep a dataURL
captureBtn.onclick = () => {
  if (!cameraStarted) {
    output.textContent = "Start camera first";
    return;
  }

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Save the captured image for processing
  latestCaptureDataURL = canvas.toDataURL("image/png");
  output.textContent = "Image captured. Press Detect.";
};

// Utility: draw image from dataURL into canvas sized to given dims
function drawImageOnCanvas(dataURL, targetCanvas, targetW, targetH) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      targetCanvas.width = targetW;
      targetCanvas.height = targetH;
      const ctx = targetCanvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve();
    };
    img.src = dataURL;
  });
}

// Preprocessing pipeline using OpenCV: returns an array of canvases (variants)
async function generatePreprocessedVariants(dataURL) {
  // We'll create multiple variants: adaptive threshold, Otsu, morphological cleaned, inverted, deskewed crop
  const variants = [];
  const procCanvas = document.createElement("canvas");

  // draw full-size capture at reasonable size
  await drawImageOnCanvas(dataURL, procCanvas, 800, 800 * (video.videoHeight / video.videoWidth || 1));

  // read into cv Mat
  let src = cv.imread(procCanvas);
  // convert to gray
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // blur to reduce noise
  let blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  // try adaptive threshold (good for uneven lighting)
  let thresh1 = new cv.Mat();
  cv.adaptiveThreshold(
    blurred,
    thresh1,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // Otsu threshold (global) after Gaussian blur
  let thresh2 = new cv.Mat();
  cv.threshold(blurred, thresh2, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  // morphological close to join strokes
  let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  let closed1 = new cv.Mat();
  cv.morphologyEx(thresh1, closed1, cv.MORPH_CLOSE, kernel);

  let closed2 = new cv.Mat();
  cv.morphologyEx(thresh2, closed2, cv.MORPH_CLOSE, kernel);

  // Find the largest contour in closed1 to crop ROI (digit area)
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(closed1, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let roiRect = null;
  let maxArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > maxArea) {
      maxArea = area;
      roiRect = cv.boundingRect(cnt);
    }
  }

  function pushCanvasFromMat(mat) {
    // convert mat to canvas and store dataURL
    const outCanvas = document.createElement("canvas");
    cv.imshow(outCanvas, mat);
    variants.push(outCanvas);
  }

  // If we found a large contour (digit likely), crop with padding, deskew, and produce variants
  if (roiRect && maxArea > 500) {
    const pad = Math.round(Math.min(roiRect.width, roiRect.height) * 0.3);
    const x1 = Math.max(0, roiRect.x - pad);
    const y1 = Math.max(0, roiRect.y - pad);
    const x2 = Math.min(src.cols, roiRect.x + roiRect.width + pad);
    const y2 = Math.min(src.rows, roiRect.y + roiRect.height + pad);

    const roiMat = src.roi(new cv.Rect(x1, y1, x2 - x1, y2 - y1));
    // deskew using minAreaRect
    let tmpContours = new cv.MatVector();
    let tmpHierarchy = new cv.Mat();
    let tmpGray = new cv.Mat();
    cv.cvtColor(roiMat, tmpGray, cv.COLOR_RGBA2GRAY);
    cv.threshold(tmpGray, tmpGray, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.findContours(tmpGray, tmpContours, tmpHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // find largest inside roi
    let maxA2 = 0; let big = null;
    for (let i = 0; i < tmpContours.size(); i++) {
      const c = tmpContours.get(i);
      const a = cv.contourArea(c);
      if (a > maxA2) { maxA2 = a; big = c; }
    }

    if (big) {
      const rotRect = cv.minAreaRect(big);
      const angle = rotRect.angle;
      // rotate ROI to deskew (if angle significant)
      const center = new cv.Point(roiMat.cols / 2, roiMat.rows / 2);
      let M = cv.getRotationMatrix2D(center, angle, 1);
      let rotated = new cv.Mat();
      const dsize = new cv.Size(roiMat.cols, roiMat.rows);
      cv.warpAffine(roiMat, rotated, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255,255,255));

      // produce variants from rotated region
      let rgray = new cv.Mat();
      cv.cvtColor(rotated, rgray, cv.COLOR_RGBA2GRAY);
      let rblur = new cv.Mat();
      cv.GaussianBlur(rgray, rblur, new cv.Size(3,3),0);

      let rth1 = new cv.Mat();
      cv.adaptiveThreshold(rblur, rth1, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
      let rth2 = new cv.Mat();
      cv.threshold(rblur, rth2, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

      // cleaned versions
      let rclosed1 = new cv.Mat();
      let rclosed2 = new cv.Mat();
      let k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3));
      cv.morphologyEx(rth1, rclosed1, cv.MORPH_CLOSE, k2);
      cv.morphologyEx(rth2, rclosed2, cv.MORPH_CLOSE, k2);

      // push a few helpful variants (resize to larger to help OCR)
      let resized = new cv.Mat();
      cv.resize(rclosed1, resized, new cv.Size(400, 400), 0, 0, cv.INTER_LINEAR);
      pushCanvasFromMat(resized);
      cv.resize(rclosed2, resized, new cv.Size(400, 400), 0, 0, cv.INTER_LINEAR);
      pushCanvasFromMat(resized);

      // also push inverted (white on black) Tesseract sometimes prefers black text on white: invert if needed
      let inv = new cv.Mat();
      cv.bitwise_not(resized, inv);
      pushCanvasFromMat(inv);

      // clean up
      rotated.delete(); rgray.delete(); rblur.delete();
      rth1.delete(); rth2.delete(); rclosed1.delete(); rclosed2.delete();
      resized.delete(); inv.delete(); k2.delete();
    }

    tmpContours.delete(); tmpHierarchy.delete(); tmpGray.delete();
    roiMat.delete();
  } else {
    // No large ROI found — fallback: produce variants from whole image
    let resizedWhole = new cv.Mat();
    cv.resize(closed1, resizedWhole, new cv.Size(500, 500), 0, 0, cv.INTER_LINEAR);
    pushCanvasFromMat(resizedWhole);
    let resizedWhole2 = new cv.Mat();
    cv.resize(closed2, resizedWhole2, new cv.Size(500, 500), 0, 0, cv.INTER_LINEAR);
    pushCanvasFromMat(resizedWhole2);
    cv.bitwise_not(resizedWhole2, resizedWhole2);
    pushCanvasFromMat(resizedWhole2);

    resizedWhole.delete(); resizedWhole2.delete();
  }

  // cleanup mats
  src.delete(); gray.delete(); blurred.delete();
  thresh1.delete(); thresh2.delete(); closed1.delete(); closed2.delete();
  kernel.delete(); contours.delete(); hierarchy.delete();

  // variants array contains canvases
  return variants;
}

// Run Tesseract OCR on a canvas element and return the recognized digit (single char) or null
async function ocrCanvasForDigit(canvasElement) {
  try {
    // Tesseract config - whitelist digits and SINGLE_CHAR page seg mode
    const result = await Tesseract.recognize(canvasElement, "eng", {
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR
    });
    const text = (result && result.data && result.data.text) ? result.data.text.trim() : "";
    const digit = text.replace(/\D/g, "");
    if (digit.length === 1) return digit;
    return null;
  } catch (e) {
    console.error("Tesseract error", e);
    return null;
  }
}

// Main detect button: produce variants, run OCR on each, vote
detectBtn.onclick = async () => {
  if (!latestCaptureDataURL) {
    output.textContent = "Capture image first";
    return;
  }

  output.textContent = "Analyzing single digit...";

  await waitForOpencv();

  // Draw captured image
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = latestCaptureDataURL;

  img.onload = async () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // --- OpenCV processing ---
    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    let thresh = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

    cv.threshold(
      gray,
      thresh,
      0,
      255,
      cv.THRESH_BINARY_INV + cv.THRESH_OTSU
    );

    cv.findContours(
      thresh,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    if (contours.size() === 0) {
      output.textContent = "No digit found";
      return;
    }

    // --- Select ONLY the largest contour ---
    let maxArea = 0;
    let bestContour = null;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > maxArea) {
        maxArea = area;
        bestContour = cnt;
      }
    }

    const rect = cv.boundingRect(bestContour);

    // Reject noise
    if (rect.width < 80 || rect.height < 80) {
      output.textContent = "Digit too small";
      return;
    }

    // Crop ONLY the digit
    let digitROI = src.roi(rect);

    // Resize for OCR
    let resized = new cv.Mat();
    cv.resize(digitROI, resized, new cv.Size(300, 300));

    // Convert ROI to canvas
    const digitCanvas = document.createElement("canvas");
    cv.imshow(digitCanvas, resized);

    // --- OCR ON CROPPED DIGIT ONLY ---
    const result = await Tesseract.recognize(
      digitCanvas,
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
      output.textContent = "Retry (align digit)";
    }

    // Cleanup
    src.delete();
    gray.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
    digitROI.delete();
    resized.delete();
  };
};
