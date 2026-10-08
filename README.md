# Hand Web Playground

React + TypeScript + Vite with real two-hand MediaPipe tracking and Canvas effects. Camera frames stay in your browser.

## Run

```sh
npm install
npm run dev
```

Open the printed localhost URL, click Start Camera, and allow camera access. Internet is required for the model download.

## Play

- Upright palm: glowing web.
- Hold your palm flat like a tray: the car appears and smoothly follows your hand. Turn it upright to restore the web.
- Pinch and pull: stretch a strand.
- Close your fist: dissolve the web into particles.
- Show two hands: connecting web strands and sparks.
- Mouse demo: move the pointer, hold to pinch, and use Palm up / Show web, Close fist, and Two hands controls.
- Clear effects: removes effects; release the tray pose and show it again to rearm the car.

Tracking uses smoothing, 120ms pose entry and 400ms loss tolerance. Mirrored landmarks match the webcam crop. Tray detection uses aspect-correct image landmarks and finger curl, tolerating relaxed cupped palms and noisy depth.

## Build and verification

```sh
npm run build
npm run preview
node scripts/check-gestures.mjs
npm run check:browser
node scripts/check-camera-poses.mjs
```

Browser checks require Chrome and a running dev server. They verify gestures, model initialization with a simulated camera, layout, and the raw-landmark camera path. Physical webcam tracking needs testing on your device.

Deploy dist to an HTTPS static host for phone camera access. Plain HTTP over the local network cannot access the camera.

Official documentation: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
