import * as THREE from 'three';

const FWD = -0.3;                     // metres ahead of the camera where the feet stand
const TILT = 0;                     // radians the body leans back toward you from upright
const SIZE = 2;                       // a 32 px sprite is 2 m tall in this world
const KEEP = 0.6;                     // the lower part of the sprite you can see of yourself: shoes up to the chest

/**
 * Your own body, seen when you look down: your character's front, in the world, standing at your feet. It is a plane
 * rising from the floor just ahead of you and leaning back toward your eyes, so looking down you see your shoes, legs and
 * chest in perspective, wearing what you are really wearing (the same layered art as everyone else). It fades in as you
 * tilt your head down and turns with you.
 */
export class BodyView {
  constructor(game) {
    this.game = game;
    this.key = '';
    this.t = 0;
    this.tex = null;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE * KEEP);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * KEEP);   // only the bottom of the picture
    geo.translate(0, SIZE * KEEP / 2, 0);                // hinge at the bottom edge, on the floor
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, fog: false, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.group = new THREE.Group();                       // yaw about the floor point, then lean about the hinge
    this.group.add(this.mesh);
    game.scene.add(this.group);
  }

  /** Draw your front into a texture the plane wears (only when what you wear changes). */
  paint(ap) {
    const cv = this.game.assets.charart.portrait(ap, 0);
    if (this.tex) this.tex.dispose();
    this.tex = new THREE.CanvasTexture(cv);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.mat.map = this.tex;
    this.mat.needsUpdate = true;
  }

  update(dt, { pitch, moving, show, cam, yaw, light }) {
    const ap = show ? this.game.myAppearance() : null;
    const down = Math.min(1, Math.max(0, (-pitch - 0.35) / 0.55));    // 0 level .. 1 looking right down
    if (!ap || down <= 0) { this.mesh.visible = false; return; }
    const key = JSON.stringify(ap);
    if (key !== this.key) { this.key = key; this.paint(ap); }
    this.t += dt * (moving ? 9 : 1.4);
    const sway = Math.sin(this.t) * (moving ? 0.045 : 0.006);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);                    // where you face
    this.group.position.set(cam.x + fx * FWD, 0, cam.z + fz * FWD);
    this.group.rotation.set(0, yaw + Math.PI, 0);                      // the sprite's front faces the way you face
    this.mesh.rotation.x = -TILT + sway;                               // leans back toward your eyes
    this.mesh.visible = true;
    this.mat.opacity = down;
    this.mat.color.setScalar(Math.min(1, 0.35 + light * 0.75));
  }
}
