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

- Upright open palm: show the web. Hold your open palm flat like a tray to show the car, matching the reference pose. Turn your hand upright again to return to the web automatically.
- Move your flat palm: the car follows smoothly above your hand. Brief tracking loss is tolerated for 400ms; a longer absence fades the car out instead of leaving it stuck on screen. Mouse demo lets you move it with your pointer.
- Pinch thumb and index, then pull: stretch strands from the captured palm anchor.
- Close fist: dissolve the web into particles. Open again to rebuild it.
- Two hands: bridge their fingertips with crossing strands and sparks.
- The tray detector prioritizes the visible sideways, relatively flat hand shape from aspect-correct image landmarks, with 3D finger curl to reject tight fists. It accepts relaxed, slightly cupped fingers and supports either hand without requiring an exact depth angle. Entry requires 120ms; exit takes 400ms to prevent flicker. Car and web crossfade automatically. Clear effects removes the car without immediately respawning it; turn your hand upright and then flat to rearm it.
- Mouse demo: move the pointer, hold to pinch, and use Close fist / Two hands controls. Works without a camera or the tracking model. Touch dragging also works.
- Mouse demo starts with the web. Use Palm up to try the car and Show web to switch back. No camera is needed for demo mode.
- Clear effects clears particles and briefly resets the web; visible hands weave it again.

The camera is mirrored with `object-fit: cover`. Landmark coordinates use the same mirror and crop transform. Tray recognition uses image coordinates corrected by the camera's aspect ratio, so resizing the stage cannot change the detected pose. Finger gestures use MediaPipe world landmarks. Confidence thresholds are .45 to tolerate partly occluded hands. Hand identity follows wrist proximity and survives delayed frames. Glow is batched, hidden webs are skipped, and particles are bounded to 260. Car movement and crossfades use elapsed time so slower frame rates do not stretch transitions. The car reveals over .9 seconds.

## Production

```sh
npm run build
npm run preview
```

Deploy `dist` with an HTTPS static host. Camera access requires HTTPS or localhost. A phone accessing a laptop over plain HTTP cannot use the camera; use an HTTPS deployment instead. Camera and tracking availability depend on browser permissions and device performance.

Official API documentation consulted: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js

## Browser verification

Run `node scripts/check-gestures.mjs` to verify tray detection from raw 3D landmarks, upright web, smooth movement and fading, tracking-loss grace, clearing and rearming. With Google Chrome installed and the dev server running, `npm run check:browser` verifies tray/web switching, gestures, two hands, colour controls, responsive sizing, guide, real model initialization with a simulated camera and camera stop. It saves desktop and mobile screenshots. A physical hand and webcam are still needed to assess tracking quality and alignment on your device.

`node scripts/check-camera-poses.mjs` separately exercises the actual camera UI with scripted raw landmarks, including incorrect depth estimates, mirror/crop mapping, car movement measured from canvas pixels, upright return to web, and tracking loss. It does not force demo gestures or tray flags. This integration check cannot substitute for a physical webcam test.
