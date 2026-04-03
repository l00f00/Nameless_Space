import { createPlayerController } from './player-controller.js';
import { createDoor } from './door-logic.js';
import { createTrigger } from './trigger-system.js';
import { createExperienceManager } from './experience-manager.js';

const canvas = document.getElementById('app');
const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
  keyboard: new pc.Keyboard(window)
});

app.start();
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.toneMapping = pc.TONEMAP_ACES;
app.scene.exposure = 1.2;
app.scene.skyboxMip = 2;

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
app.scene.shadowType = isMobile ? pc.SHADOW_PCF3_32F : pc.SHADOW_PCF5_32F;

function loadAssetFromUrl(url, type) {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, type, (err, asset) => {
      if (err) reject(err);
      else resolve(asset);
    });
  });
}

async function loadEnvironment() {
  // HDR environment atlas per riflessioni PBR.
  // Usiamo più URL per evitare regressioni/404 su branch rinominati.
  const envCandidates = [
    'https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets/cubemaps/helipad-env-atlas.png',
    'https://cdn.jsdelivr.net/gh/playcanvas/engine@main/examples/assets/cubemaps/helipad-env-atlas.png'
  ];

  for (const envUrl of envCandidates) {
    try {
      const envAsset = await loadAssetFromUrl(envUrl, 'texture');
      app.scene.envAtlas = envAsset.resource;
      return;
    } catch (error) {
      console.warn('Environment atlas non caricato da:', envUrl, error);
    }
  }

  // Fallback sicuro: non bloccare l'avvio della scena se l'env non è disponibile.
  console.warn('Nessun environment atlas disponibile, continuo senza riflessioni HDR.');
}


async function loadDoorContainer() {
  const doorCandidates = [
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb',
    'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@main/2.0/Box/glTF-Binary/Box.glb',
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb'
  ];

  for (const doorUrl of doorCandidates) {
    try {
      return await loadAssetFromUrl(doorUrl, 'container');
    } catch (error) {
      console.warn('Door GLB non caricato da:', doorUrl, error);
    }
  }

  console.warn('Nessun GLB porta disponibile, uso fallback box locale.');
  return null;
}

function createPbrMaterial({ color = new pc.Color(1, 1, 1), metalness = 0.2, gloss = 0.65 } = {}) {
  const mat = new pc.StandardMaterial();
  mat.diffuse = color;
  mat.metalness = metalness;
  mat.gloss = gloss;
  mat.useMetalness = true;
  mat.update();
  return mat;
}

function createRoom(index, zOffset) {
  const roomRoot = new pc.Entity(`room-${index}`);
  app.root.addChild(roomRoot);

  const floor = new pc.Entity(`floor-${index}`);
  floor.addComponent('render', { type: 'box' });
  floor.setLocalScale(8, 0.2, 12);
  floor.setPosition(0, -0.1, zOffset);
  floor.render.material = createPbrMaterial({ color: new pc.Color(0.16, 0.16, 0.16), metalness: 0.7, gloss: 0.45 });
  floor.render.castShadows = false;
  floor.render.receiveShadows = true;
  roomRoot.addChild(floor);

  const backWall = new pc.Entity(`back-wall-${index}`);
  backWall.addComponent('render', { type: 'box' });
  backWall.setLocalScale(8, 4, 0.2);
  backWall.setPosition(0, 2, zOffset - 6);
  backWall.render.material = createPbrMaterial({ color: new pc.Color(0.07, 0.07, 0.08), metalness: 0.35, gloss: 0.32 });
  backWall.render.castShadows = true;
  backWall.render.receiveShadows = true;
  roomRoot.addChild(backWall);

  const ceiling = new pc.Entity(`ceiling-${index}`);
  ceiling.addComponent('render', { type: 'box' });
  ceiling.setLocalScale(8, 0.2, 12);
  ceiling.setPosition(0, 4, zOffset);
  ceiling.render.material = createPbrMaterial({ color: new pc.Color(0.08, 0.08, 0.1), metalness: 0.2, gloss: 0.2 });
  roomRoot.addChild(ceiling);

  const leftWall = new pc.Entity(`left-wall-${index}`);
  leftWall.addComponent('render', { type: 'box' });
  leftWall.setLocalScale(0.2, 4, 12);
  leftWall.setPosition(-4, 2, zOffset);
  leftWall.render.material = createPbrMaterial({ color: new pc.Color(0.1, 0.1, 0.1), metalness: 0.4, gloss: 0.3 });
  leftWall.render.castShadows = true;
  leftWall.render.receiveShadows = true;
  roomRoot.addChild(leftWall);

  const rightWall = leftWall.clone();
  rightWall.name = `right-wall-${index}`;
  rightWall.setPosition(4, 2, zOffset);
  roomRoot.addChild(rightWall);

  return { roomRoot, zCenter: zOffset };
}

async function buildWorld() {
  await loadEnvironment();

  const cameraPivot = new pc.Entity('camera-pivot');
  cameraPivot.setPosition(0, 1.75, 4.5);
  app.root.addChild(cameraPivot);

  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0),
    farClip: 120,
    nearClip: 0.05,
    fov: 70
  });
  cameraPivot.addChild(camera);

  const playerController = createPlayerController(app, cameraPivot, camera, {
    moveZone: document.getElementById('move-zone'),
    lookZone: document.getElementById('look-zone'),
    xrButton: document.getElementById('xr-btn')
  });

  const ambient = new pc.Entity('ambient-fill');
  ambient.addComponent('light', {
    type: 'omni',
    color: new pc.Color(0.04, 0.04, 0.05),
    intensity: 0.6,
    range: 18,
    castShadows: false
  });
  ambient.setPosition(0, 1.5, 5);
  app.root.addChild(ambient);

  const directional = new pc.Entity('key-light');
  directional.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.22, 0.22, 0.25),
    intensity: 0.75,
    castShadows: true,
    shadowDistance: 50,
    shadowResolution: isMobile ? 1024 : 2048,
    normalOffsetBias: 0.03,
    shadowBias: 0.2
  });
  directional.setEulerAngles(50, 30, 0);
  app.root.addChild(directional);

  const rooms = [createRoom(0, 0), createRoom(1, -12), createRoom(2, -24)];

  // GLB model: usato come porta fisica (una mesh semplice ma formato glTF).
  const doorGlb = await loadDoorContainer();

  const manager = createExperienceManager(app);

  const roomTriggers = [];

  rooms.forEach((room, i) => {
    const doorRoot = new pc.Entity(`door-root-${i}`);
    doorRoot.setPosition(0, 1.2, room.zCenter - 5.85);
    app.root.addChild(doorRoot);

    const left = createDoor(app, {
      name: `left-door-${i}`,
      containerAsset: doorGlb,
      root: doorRoot,
      localPos: new pc.Vec3(-0.7, 0, 0),
      pivotPos: new pc.Vec3(-1.15, 0, 0),
      openYaw: 88,
      color: new pc.Color(0.8, 0.03, 0.03)
    });

    const right = createDoor(app, {
      name: `right-door-${i}`,
      containerAsset: doorGlb,
      root: doorRoot,
      localPos: new pc.Vec3(0.7, 0, 0),
      pivotPos: new pc.Vec3(1.15, 0, 0),
      openYaw: -88,
      color: new pc.Color(0.8, 0.03, 0.03)
    });

    const interiorLight = new pc.Entity(`interior-light-${i}`);
    interiorLight.addComponent('light', {
      type: 'spot',
      color: new pc.Color(1.0, 0.45, 0.35),
      intensity: 0,
      innerConeAngle: 28,
      outerConeAngle: 52,
      range: 12,
      castShadows: !isMobile,
      shadowResolution: isMobile ? 512 : 1024
    });
    interiorLight.setPosition(0, 2.3, room.zCenter - 3.5);
    interiorLight.setEulerAngles(90, 0, 0);
    app.root.addChild(interiorLight);

    manager.addRoom({
      id: i,
      zCenter: room.zCenter,
      doors: [left, right],
      interiorLight
    });

    const trigger = createTrigger(app, {
      name: `trigger-${i}`,
      center: new pc.Vec3(0, 1.5, room.zCenter - 3),
      halfExtents: new pc.Vec3(2.5, 1.7, 2.5),
      onEnter: () => manager.onRoomEnter(i)
    });
    app.root.addChild(trigger.entity);
    roomTriggers.push(trigger);
  });

  app.on('update', (dt) => {
    playerController.update(dt);
    manager.update(cameraPivot.getPosition(), dt);
    roomTriggers.forEach((trigger) => trigger.update(cameraPivot.getPosition()));
  });
}

buildWorld().catch((error) => {
  console.error('Errore inizializzazione scena:', error);
});
