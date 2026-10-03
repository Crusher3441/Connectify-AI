import * as faceapi from '@vladmandic/face-api';

const FACEAPI_VERSION = '1.7.15';
const MODEL_URL = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACEAPI_VERSION}/model`;

// Single-flight cache: no matter how many components ask, the ~6MB of
// weights download and initialize exactly once per page load.
let loadingPromise = null;

export const loadFaceModels = () => {
  if (!loadingPromise) {
    loadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),   // fast face finder       // Camera image me face kaha hai ye detect karta hai
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),  // 68 face points         // Face ke important points identify karta hai—eyes, nose, mouth, jaw etc
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // → 128-number descriptor //face ko 128 numbers me represent karta hai
    ]).then(() => true);
    // If the CDN fails, clear the cache so a retry can actually retry.
    loadingPromise.catch(() => { loadingPromise = null; });
  }
  return loadingPromise;
};

export const detectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,       // 128–512; smaller = faster, less accurate
    scoreThreshold: 0.5,  // min confidence to accept a detection
  });
