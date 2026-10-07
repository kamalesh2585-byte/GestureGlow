import { mkdir, copyFile, cp } from 'node:fs/promises';
const source=new URL('../node_modules/@mediapipe/tasks-vision/',import.meta.url);
const target=new URL('../public/mediapipe/',import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(new URL('vision_bundle.cjs',source),new URL('vision_bundle.js',target));
await cp(new URL('wasm/',source),new URL('wasm/',target),{recursive:true});
