// Classic workers support the importScripts loader used by MediaPipe's WASM runtime.
self.exports = {};
importScripts('./mediapipe/vision_bundle.js');
const { FilesetResolver, HandLandmarker } = self.exports;
let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks(new URL('./mediapipe/wasm', self.location.href).href);
      tracker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && tracker) {
      try {
        const result = tracker.detectForVideo(data.bitmap, data.time);
        self.postMessage({ type: 'result', landmarks: result.landmarks, handedness: result.handedness });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Tracking failed' });
  }
};
