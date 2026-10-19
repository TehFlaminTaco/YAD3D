import * as THREE from 'three';
import { decodeLevel, makeRects } from '../shared/leveldata.js';

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('failed to load ' + url));
    im.src = url;
  });
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
}

/**
 * Loads level data + atlases and builds the GPU textures. `withSim` also pulls the job and
 * storage tables the in-browser host needs (a remote server has its own copy).
 */
export async function loadAssets(progress = () => {}, { withSim = false } = {}) {
  progress('level data');
  const [level, sprJson, jobsJson, contents, closets] = await Promise.all([
    fetchJSON('assets/level.json'), fetchJSON('assets/sprites.json'),
    withSim ? fetchJSON('data/jobs.json') : null, withSim ? fetchJSON('data/contents.json') : null, withSim ? fetchJSON('data/closets.json') : null,
  ]);
  const decoded = decodeLevel(level);
  progress('textures');
  const [terrainImg, spriteImg] = await Promise.all([loadImage('assets/terrain.png'), loadImage('assets/sprites.png')]);

  // terrain: 32x32 cells -> texture array layers (so mipmaps never bleed between cells)
  const cols = level.terrain.cols;
  const cells = level.terrain.cells;
  const cv = document.createElement('canvas');
  cv.width = terrainImg.width;
  cv.height = terrainImg.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(terrainImg, 0, 0);
  const atlasData = cx.getImageData(0, 0, cv.width, cv.height).data;
  const layerData = new Uint8Array(32 * 32 * 4 * cells);
  for (let i = 0; i < cells; i++) {
    const ox = (i % cols) * 32;
    const oy = Math.floor(i / cols) * 32;
    for (let y = 0; y < 32; y++) {
      const src = ((oy + y) * cv.width + ox) * 4;
      layerData.set(atlasData.subarray(src, src + 32 * 4), i * 32 * 32 * 4 + y * 32 * 4);
    }
  }
  const terrainTex = new THREE.DataArrayTexture(layerData, 32, 32, cells);
  terrainTex.format = THREE.RGBAFormat;
  terrainTex.type = THREE.UnsignedByteType;
  terrainTex.magFilter = THREE.NearestFilter;
  terrainTex.minFilter = THREE.NearestMipmapLinearFilter;
  terrainTex.generateMipmaps = true;
  terrainTex.wrapS = terrainTex.wrapT = THREE.ClampToEdgeWrapping;
  terrainTex.needsUpdate = true;

  const spriteTex = new THREE.Texture(spriteImg);
  spriteTex.magFilter = THREE.NearestFilter;
  spriteTex.minFilter = THREE.NearestFilter;
  spriteTex.generateMipmaps = false;
  spriteTex.flipY = false;
  spriteTex.needsUpdate = true;

  progress('done');
  return { ...decoded, terrainTex, spriteTex, spriteImg, rects: makeRects(sprJson), atlas: { w: sprJson.w, h: sprJson.h }, jobsJson, contents, closets };
}
