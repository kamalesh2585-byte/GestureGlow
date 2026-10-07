# Hand Web Playground

A React + TypeScript + Vite playground with real two-hand MediaPipe tracking and Canvas effects. Camera frames are processed locally in a web worker and never uploaded.

## Run it

Install Node.js 20.19+ or 22.12+, then open a terminal in this folder:

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Click **Start Camera** and allow camera permission. The first start downloads the hand model from Google's storage, so an internet connection is required. Version-pinned MediaPipe JavaScript and WASM are served locally; the setup scripts copy them from the installed package automatically. Chrome or Edge are recommended. Stop Camera releases the webcam.

## Play

- Open palm: fingertip spokes and five web rings follow your hand.
- Pinch thumb and index, then pull: stretch strands from the captured palm anchor.
- Close fist: dissolve the web into particles. Open again to rebuild it.
- Two hands: bridge their fingertips with crossing strands and sparks.
- Shake once: make one quick out-and-back movement (left-right-left or up-down-up) while keeping your hand in view. A neon sports car forms from a particle burst and stays until Clear effects or camera stop. Wait about three seconds before another shake. Tiny jitter, slow movement, and one-way swipes are ignored. Either hand can trigger it.
- Mouse demo: move the pointer, hold to pinch, and use Close fist / Two hands controls. Works without a camera or the tracking model. Touch dragging also works.
- In demo, shake your pointer to create a car, or press Create car to preview it instantly.
- Clear effects clears particles and briefly resets the web; visible hands weave it again.

The camera is mirrored with `object-fit: cover`. Landmark coordinates use the same mirror and crop transform. Gesture distances are normalized by palm size, with pinch hysteresis, a 100ms stability window, and landmark smoothing. Tracking runs at up to 25fps separately from canvas animation; particle counts and intersection sparks are bounded.

## Production

```sh
npm run build
npm run preview
```

Deploy `dist` with an HTTPS static host. Camera access requires HTTPS or localhost. A phone accessing a laptop over plain HTTP cannot use the camera; use an HTTPS deployment instead. Camera and tracking availability depend on browser permissions and device performance.

Official API documentation consulted: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js

## Browser verification

With Google Chrome installed and the dev server running, `npm run check:browser` verifies demo gestures, two hands, colour controls, responsive sizing, guide, real model initialization with a simulated camera, and camera stop. It saves desktop and mobile screenshots. A physical hand and webcam are still needed to assess tracking quality and alignment on your device.
