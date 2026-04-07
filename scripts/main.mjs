import { createPlayerController } from './player-controller.mjs';
import { createDoor } from './door-logic.mjs';
import { createExperienceManager } from './experience-manager.mjs';
import { createRailSequence } from './rail-sequence.mjs';
import { VignetteEffect } from './posteffects/vignette.mjs';
import { BloomEffect } from './posteffects/bloom.mjs';

// Loader functions
let totalAssets = 0;
let loadedAssets = 0;
let sceneInitialized = false;

function updateLoaderProgress() {
  loadedAssets++;
  const progress = Math.min((loadedAssets / totalAssets) * 100, 95); // Max 95% until scene is ready
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
  if (loadedAssets >= totalAssets && sceneInitialized) {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) {
        loader.style.display = 'none';
      }
    }, 500);
  }
}

function countAssets() {
  // Conta gli asset che dobbiamo caricare
  totalAssets = 6; // env texture + 3 textures + 2 models usati davvero

  // Avvia effetto typewriter
  startTypewriter();
  startStartOverlayTypewriter();
}

function startTypewriter() {
  const text = "Nameless Space loading";
  const element = document.getElementById('typewriter-text');
  if (!element) return;

  let i = 0;
  element.textContent = '';

  const typeWriter = () => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(typeWriter, 100); // Velocità di digitazione
    } else {
      // Aggiungi cursore lampeggiante
      element.innerHTML += '<span id="cursor" style="animation: blink 1s infinite;">_</span>';
    }
  };

  // Aggiungi animazione CSS per il cursore
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  typeWriter();
}

function startStartOverlayTypewriter() {
  const lines = [
    'Nameless Spaces',
    'Coming soon',
    'Virtual Art Space',
    'curated by Melania Filidei',
    'collab l00f00'
  ];
  const element = document.getElementById('start-title');
  if (!element) return;

  let lineIndex = 0;
  let charIndex = 0;
  element.innerHTML = '';

  const getLineClassName = (index) => {
    if (index === 0) return 'start-line start-line--title';
    return 'start-line start-line--meta';
  };

  const typeLine = () => {
    if (lineIndex >= lines.length) return;

    const currentLine = lines[lineIndex];
    let lineElement = element.children[lineIndex];
    if (!lineElement) {
      lineElement = document.createElement('div');
      lineElement.className = getLineClassName(lineIndex);
      element.appendChild(lineElement);
    }

    if (charIndex < currentLine.length) {
      lineElement.textContent += currentLine.charAt(charIndex);
      charIndex++;
      window.setTimeout(typeLine, lineIndex >= 2 ? 24 : 45);
      return;
    }

    lineIndex++;
    charIndex = 0;
    if (lineIndex < lines.length) {
      window.setTimeout(typeLine, 220);
    }
  };

  typeLine();
}

function markSceneReady() {
  sceneInitialized = true;
  updateLoaderProgress();
}

function warmupRenderableAssets(rootEntity) {
  const visit = (entity) => {
    if (entity.render) {
      const material = entity.render.material;
      if (material) {
        material.update();
      }
      entity.render.castShadows = Boolean(entity.render.castShadows);
    }
    entity.children.forEach(visit);
  };

  visit(rootEntity);
}

function setCanvasTunnelEffect(blurPx = 0, brightness = 1) {
  const blur = Math.max(0, blurPx);
  canvas.style.filter = `blur(${blur.toFixed(2)}px) brightness(${brightness.toFixed(3)})`;
}

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
      else {
        updateLoaderProgress();
        resolve(asset);
      }
    });
  });
}

async function loadEnvironment() {
  // HDR environment cubemap per riflessioni PBR.
  const envUrl = './assets/helipad-env-atlas.png';
  const envAsset = await loadAssetFromUrl(envUrl, 'texture');

  app.scene.envAtlas = envAsset.resource;
  app.scene.skyboxMip = 4;
  app.scene.skyboxIntensity = 0.025;
  app.scene.exposure = 0.72;

  // Fog compatibile su versioni diverse di PlayCanvas
  if (typeof pc.Fog === 'function') {
    // Some versions don't allow replacing fog object, quindi usa l'oggetto esistente se presente.
    if (app.scene.fog && typeof app.scene.fog === 'object' && !(app.scene.fog instanceof pc.Fog)) {
      app.scene.fog.color = new pc.Color(0.02, 0.02, 0.03);
      app.scene.fog.near = 20;
      app.scene.fog.far = 40;
      app.scene.fog.type = pc.FOG_LINEAR;
    } else {
      try {
        const fog = new pc.Fog();
        fog.color = new pc.Color(0.02, 0.02, 0.03);
        fog.near = 20;
        fog.far = 40;
        fog.type = pc.FOG_LINEAR;
        app.scene.fog = fog;
      } catch (e) {
        // Se app.scene.fog è readonly, imposta solo valori esistenti
        if (app.scene.fog) {
          app.scene.fog.color = new pc.Color(0.02, 0.02, 0.03);
          app.scene.fog.near = 20;
          app.scene.fog.far = 40;
          app.scene.fog.type = pc.FOG_LINEAR;
        }
      }
    }
  } else {
    // Se non esiste pc.Fog, lavoriamo con proprieta' fog direttamente se possibile
    if (app.scene.fog) {
      app.scene.fog.type = pc.FOG_LINEAR;
      app.scene.fog.color = new pc.Color(0.02, 0.02, 0.03);
      app.scene.fog.near = 20;
      app.scene.fog.far = 40;
    }
  }
}

function createReflectionProbe(position = new pc.Vec3(0,2,0), halfExtents = new pc.Vec3(2,2,2)) {
  const probe = new pc.Entity('reflection-probe');
  probe.setPosition(position);
  probe.setLocalScale(halfExtents.clone().scale(2));

  // PlayCanvas riflette l'ambiente skybox/envAtlas nel PBR; questo oggetto è un placeholder
  app.root.addChild(probe);
  if (app.scene.reflectionProbes && Array.isArray(app.scene.reflectionProbes)) {
    app.scene.reflectionProbes.push(probe);
  }
  return probe;
}

function createPbrMaterial({ color = new pc.Color(1, 1, 1), metalness = 0.2, gloss = 0.65, texture = null, tiling = new pc.Vec2(1, 1) } = {}) {
  const mat = new pc.StandardMaterial();
  mat.diffuse = color;
  mat.metalness = metalness;
  mat.gloss = gloss;
  mat.useMetalness = true;
  if (texture) {
    mat.diffuseMap = texture;
    mat.diffuseMapTiling = tiling;
  }
  mat.update();
  return mat;
}

function cardiacPulse(timeSeconds, bpm = 54) {
  const cycleDuration = 60 / bpm;
  const phase = (timeSeconds % cycleDuration) / cycleDuration;
  const systolicPeak = Math.exp(-Math.pow((phase - 0.11) / 0.048, 2) * 8);
  const secondaryPeak = 0.42 * Math.exp(-Math.pow((phase - 0.245) / 0.038, 2) * 9);
  return Math.min(systolicPeak + secondaryPeak, 1);
}

function easeInOut01(value) {
  const t = pc.math.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function createRoom(index, zOffset, { floorTexture = null, wallTexture = null, ceilingTexture = null, doorWidth = 1.0, size = { width: 8, depth: 12 } } = {}) {
  const roomRoot = new pc.Entity(`room-${index}`);
  app.root.addChild(roomRoot);

  // Reflection probe (approximazione): aiuta superfici PBR a leggere l'ambiente locale
  createReflectionProbe(new pc.Vec3(0, 2, zOffset - size.depth/2), new pc.Vec3(size.width/2, 2.5, size.depth/2));

  const floor = new pc.Entity(`floor-${index}`);
  floor.addComponent('render', { type: 'box' });
  floor.setLocalScale(size.width, 0.2, size.depth);
  floor.setPosition(0, -0.1, zOffset);
  floor.render.material = createPbrMaterial({ color: new pc.Color(0.16, 0.16, 0.16), metalness: 0.7, gloss: 0.45, texture: floorTexture, tiling: new pc.Vec2(4, 4) });
  floor.render.castShadows = false;
  floor.render.receiveShadows = true;
  roomRoot.addChild(floor);

  const wallHeight = 4;
  const doorHeight = 2.4;
  const sideWidth = (size.width - doorWidth) / 2;

  const backLeft = new pc.Entity(`back-left-${index}`);
  backLeft.addComponent('render', { type: 'box' });
  backLeft.setLocalScale(sideWidth, wallHeight, 0.2);
  backLeft.setPosition(-size.width/2 + sideWidth / 2, wallHeight / 2, zOffset - size.depth/2);
  backLeft.render.material = createPbrMaterial({ color: new pc.Color(0.07, 0.07, 0.08), metalness: 0.35, gloss: 0.32, texture: wallTexture, tiling: new pc.Vec2(4, 2) });
  backLeft.render.castShadows = true;
  backLeft.render.receiveShadows = true;
  roomRoot.addChild(backLeft);

  const backRight = new pc.Entity(`back-right-${index}`);
  backRight.addComponent('render', { type: 'box' });
  backRight.setLocalScale(sideWidth, wallHeight, 0.2);
  backRight.setPosition(size.width/2 - sideWidth / 2, wallHeight / 2, zOffset - size.depth/2);
  backRight.render.material = createPbrMaterial({ color: new pc.Color(0.07, 0.07, 0.08), metalness: 0.35, gloss: 0.32, texture: wallTexture, tiling: new pc.Vec2(4, 2) });
  backRight.render.castShadows = true;
  backRight.render.receiveShadows = true;
  roomRoot.addChild(backRight);

  const backTop = new pc.Entity(`back-top-${index}`);
  backTop.addComponent('render', { type: 'box' });
  backTop.setLocalScale(doorWidth, wallHeight - doorHeight, 0.2);
  backTop.setPosition(0, doorHeight + (wallHeight - doorHeight) / 2, zOffset - size.depth/2);
  backTop.render.material = createPbrMaterial({ color: new pc.Color(0.07, 0.07, 0.08), metalness: 0.35, gloss: 0.32, texture: wallTexture, tiling: new pc.Vec2(2, 1) });
  backTop.render.castShadows = true;
  backTop.render.receiveShadows = true;
  roomRoot.addChild(backTop);

  const ceiling = new pc.Entity(`ceiling-${index}`);
  ceiling.addComponent('render', { type: 'box' });
  ceiling.setLocalScale(size.width, 0.2, size.depth);
  ceiling.setPosition(0, 4, zOffset);
  ceiling.render.material = createPbrMaterial({ color: new pc.Color(0.08, 0.08, 0.1), metalness: 0.2, gloss: 0.2, texture: ceilingTexture, tiling: new pc.Vec2(4, 4) });
  roomRoot.addChild(ceiling);

  const leftWall = new pc.Entity(`left-wall-${index}`);
  leftWall.addComponent('render', { type: 'box' });
  leftWall.setLocalScale(0.2, 4, size.depth);
  leftWall.setPosition(-size.width/2, 2, zOffset);
  leftWall.render.material = createPbrMaterial({ color: new pc.Color(0.1, 0.1, 0.1), metalness: 0.4, gloss: 0.3, texture: wallTexture, tiling: new pc.Vec2(4, 2) });
  leftWall.render.castShadows = true;
  leftWall.render.receiveShadows = true;
  roomRoot.addChild(leftWall);

  const rightWall = leftWall.clone();
  rightWall.name = `right-wall-${index}`;
  rightWall.setPosition(size.width/2, 2, zOffset);
  roomRoot.addChild(rightWall);

  return {
    roomRoot,
    zCenter: zOffset,
    size,
    doorWidth,
    doorHeight,
    backWallZ: zOffset - size.depth / 2,
    structureEntities: [floor, backLeft, backRight, backTop, ceiling, leftWall, rightWall],
    addObject: (entity) => {
      roomRoot.addChild(entity);
      return entity;
    },
    addLight: (lightOptions, position = new pc.Vec3(0, 2.2, zOffset - size.depth/4), euler = new pc.Vec3(90, 0, 0)) => {
      const light = new pc.Entity(`room-${index}-light`);
      light.addComponent('light', lightOptions);
      light.setPosition(position);
      light.setEulerAngles(euler);
      roomRoot.addChild(light);
      return light;
    }
  };
}

async function buildWorld() {
  countAssets();
  await loadEnvironment();

  // Texture room assets locali
  const floorTextureAsset = await loadAssetFromUrl('./assets/hardwood2_diffuse.jpg', 'texture');
  const wallTextureAsset = await loadAssetFromUrl('./assets/brick_diffuse.jpg', 'texture');
  const ceilingTextureAsset = await loadAssetFromUrl('./assets/brick_bump.jpg', 'texture');
  const floorTexture = floorTextureAsset.resource;
  const wallTexture = wallTextureAsset.resource;
  const ceilingTexture = ceilingTextureAsset.resource;

  const cameraPivot = new pc.Entity('camera-pivot');
  cameraPivot.setPosition(0, 1.75, 16); // Posizionato nella stanza zero (z=12 + 4)
  app.root.addChild(cameraPivot);

  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0),
    farClip: 120,
    nearClip: 0.05,
    fov: 70
  });
  cameraPivot.addChild(camera);
  const vignetteEffect = new VignetteEffect(app.graphicsDevice);
  const bloomEffect = new BloomEffect(app.graphicsDevice);
  vignetteEffect.offset = 1.28;
  vignetteEffect.darkness = 0.26;
  bloomEffect.strength = 0;
  bloomEffect.radius = 5;
  bloomEffect.threshold = 0.58;
  camera.camera.postEffects.addEffect(vignetteEffect);
  camera.camera.postEffects.addEffect(bloomEffect);

  const playerController = createPlayerController(app, cameraPivot, camera, {
    moveZone: document.getElementById('move-zone'),
    lookZone: document.getElementById('look-zone'),
    xrButton: document.getElementById('xr-btn')
  });

  const ambient = new pc.Entity('ambient-fill');
  ambient.addComponent('light', {
    type: 'omni',
    color: new pc.Color(0.055, 0.055, 0.07),
    intensity: 0.75,
    range: 22,
    castShadows: false
  });
  ambient.setPosition(0, 1.5, 16); // Nella stanza zero
  app.root.addChild(ambient);

  const directional = new pc.Entity('key-light');
  directional.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.28, 0.28, 0.32),
    intensity: 0.9,
    castShadows: true,
    shadowDistance: isMobile ? 22 : 34,
    shadowResolution: isMobile ? 512 : 1024,
    normalOffsetBias: 0.03,
    shadowBias: 0.2
  });
  directional.setEulerAngles(50, 30, 0);
  app.root.addChild(directional);

  const DEFAULT_DOOR_CONFIG = {
    panelHalf: 0.45,
    gap: 0.02,
    speed: 1.8,
    backWallOffset: 0.15,
    initialRootY: 1.2
  };
  const DEFAULT_TRIGGER_CONFIG = {
    centerOffset: new pc.Vec3(0, 1.5, -3),
    halfExtents: new pc.Vec3(2.1, 1.55, 2.1)
  };
  const DEFAULT_ROOM_LIGHT_CONFIG = {
    softFill: {
      color: new pc.Color(0.24, 0.24, 0.28),
      range: 6.5,
      positionOffset: new pc.Vec3(0, 1.85, -2.8)
    },
    interior: {
      color: new pc.Color(1.0, 0.45, 0.35),
      innerConeAngle: 28,
      outerConeAngle: 52,
      range: 12,
      positionOffset: new pc.Vec3(0, 2.3, -3.5),
      euler: new pc.Vec3(90, 0, 0),
      castShadows: !isMobile,
      shadowResolution: isMobile ? 512 : 1024
    },
    transition: {
      color: new pc.Color(0.8, 0.8, 1.0),
      innerConeAngle: 45,
      outerConeAngle: 60,
      range: 15,
      positionOffset: new pc.Vec3(0, 3, -2),
      euler: new pc.Vec3(90, 0, 0),
      castShadows: false
    },
    lowLight: false,
    disableBaseLights: false
  };
  const TUNNEL_ROOM_IDS = Array.from({ length: 8 }, (_, index) => index + 1);
  const ROOM_DEFINITIONS = [
    {
      id: 0,
      sequenceNumber: 0,
      kind: 'intro',
      zCenter: 20,
      doorWidth: 1.82,
      size: { width: 12, depth: 28 },
      door: { ...DEFAULT_DOOR_CONFIG, initialRootY: -8.8 },
      trigger: { ...DEFAULT_TRIGGER_CONFIG },
      light: {
        ...DEFAULT_ROOM_LIGHT_CONFIG,
        softFill: {
          ...DEFAULT_ROOM_LIGHT_CONFIG.softFill,
          range: 7.5,
          positionOffset: new pc.Vec3(0, 1.85, -6.8)
        }
      }
    },
    // QUI VENGONO ISTANZIATE LE 8 STANZE TUNNEL: sequenza voluta = stanza prologo 0, stanze tunnel 1..8 con faretti a terra e porte aperte, stanza cuore 9.
    ...TUNNEL_ROOM_IDS.map((id, index) => ({
      id,
      sequenceNumber: id,
      kind: 'tunnel',
      zCenter: 0 - index * 12,
      doorWidth: 1.82,
      door: { ...DEFAULT_DOOR_CONFIG },
      trigger: { ...DEFAULT_TRIGGER_CONFIG },
      light: {
        ...DEFAULT_ROOM_LIGHT_CONFIG,
        softFill: {
          ...DEFAULT_ROOM_LIGHT_CONFIG.softFill,
          color: new pc.Color(0.18, 0.18, 0.22),
          range: 5.8
        },
        interior: {
          ...DEFAULT_ROOM_LIGHT_CONFIG.interior,
          color: new pc.Color(0.7, 0.36, 0.3),
          range: 10
        },
        transition: {
          ...DEFAULT_ROOM_LIGHT_CONFIG.transition,
          range: 11
        }
      }
    })),
    {
      id: 9,
      sequenceNumber: 9,
      kind: 'heart',
      zCenter: -96,
      doorWidth: 1.82,
      door: { ...DEFAULT_DOOR_CONFIG },
      trigger: { ...DEFAULT_TRIGGER_CONFIG },
      light: {
        ...DEFAULT_ROOM_LIGHT_CONFIG,
        softFill: {
          ...DEFAULT_ROOM_LIGHT_CONFIG.softFill,
          color: new pc.Color(0.42, 0.12, 0.12)
        },
        lowLight: true
      }
    }
  ];

  const rooms = ROOM_DEFINITIONS.map((definition) =>
    createRoom(definition.id, definition.zCenter, {
      floorTexture,
      wallTexture,
      ceilingTexture,
      doorWidth: definition.doorWidth,
      size: definition.size
    })
  );

  // GLB model locale: usato come porta fisica.
  const doorGlb = await loadAssetFromUrl('./assets/Box.glb', 'container');

  // Per l'esperienza attuale carichiamo solo il cuore: le altre stanze restano vuote.
  const visibleModels = {
    heart: await loadAssetFromUrl('./assets/realistic_human_heart.glb', 'container')
  };

  function instantiateModel(asset, position, scale = new pc.Vec3(1, 1, 1), rotation = new pc.Vec3(0, 0, 0)) {
    const entity = asset.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.setPosition(position);
    entity.setLocalScale(scale);
    entity.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
    app.root.addChild(entity);
    return entity;
  }

  const fireflyMaterial = new pc.StandardMaterial();
  fireflyMaterial.diffuse = new pc.Color(0.2, 0.02, 0.02);
  fireflyMaterial.emissive = new pc.Color(1.0, 0.12, 0.12);
  fireflyMaterial.emissiveIntensity = 11.5;
  fireflyMaterial.useLighting = false;
  fireflyMaterial.update();
  const runwayLightMaterial = new pc.StandardMaterial();
  runwayLightMaterial.diffuse = new pc.Color(0.08, 0.01, 0.01);
  runwayLightMaterial.emissive = new pc.Color(0.95, 0.09, 0.06);
  runwayLightMaterial.emissiveIntensity = 3.8;
  runwayLightMaterial.useLighting = false;
  runwayLightMaterial.update();
  const sceneEffects = {
    heartPulseBoost: 0.3,
    heartLightBoost: 0.25,
    heartFireflyVisibility: 0,
    heartFireflySpeed: 0.16,
    orbitLightBoost: 0.35
  };
  const experienceState = {
    introDoorLights: [],
    introDoorLightRig: null,
    introDoorLightEntities: {},
    introDoorOccluder: null,
    heartDoorOccluder: null,
    introOutlineMaterial: null,
    introOutlineEntities: [],
    heartCoreLight: null,
    heartFireflies: [],
    heartRoomLightRig: null,
    debugLightLabels: []
  };
  const lightRig = {
    ambient: 9.35,
    key: 9.24,
    roomFill: 9.21,
    interior: 9.49,
    transition: 6.35,
    heartCore: 5.88,
    fireflies: 8.99,
    introDoors: 4.26,
    cameraFovGlobal: 1,
    cameraFovHeart: 2.09,
    rooms: Array.from({ length: Math.max(...ROOM_DEFINITIONS.map((definition) => definition.id)) + 1 }, (_, roomId) => {
      if (roomId === 0) return { fill: 1.9, interior: 0.61, transition: 5.44 };
    if (roomId === 9) return { fill: 0.5, interior: 8.37, transition: 4.8 };
      return { fill: 1, interior: 1, transition: 1 };
    })
  };
  const debugUi = {
    panel: document.getElementById('debug-panel'),
    controls: document.getElementById('debug-controls'),
    pauseButton: document.getElementById('pause-rail-btn'),
    nextButton: document.getElementById('next-step-btn'),
    performanceButton: document.getElementById('performance-mode-btn'),
    copyButton: document.getElementById('copy-debug-btn'),
    copyHeartLightJsonButton: document.getElementById('copy-heart-light-json-btn'),
    toggleButton: document.getElementById('toggle-debug-btn'),
    room0LightDebug: document.getElementById('room0-light-debug'),
    heartLightDebug: document.getElementById('heart-light-debug'),
    lightLabelOverlay: document.getElementById('debug-light-label-overlay'),
    overlay: document.getElementById('debug-json-overlay'),
    cameraDebug: document.getElementById('camera-debug'),
    roomsDebug: document.getElementById('rooms-debug')
  };
  let debugUiVisible = false;
  const roomRuntime = [];
  const performanceState = {
    enabled: false
  };

  const manager = createExperienceManager(app, lightRig);

  rooms.forEach((room, i) => {
    const roomDefinition = ROOM_DEFINITIONS[i];
    const doorConfig = roomDefinition.door;
    const triggerConfig = roomDefinition.trigger;
    const doorZ = room.backWallZ + doorConfig.backWallOffset;
    const doorRoot = new pc.Entity(`door-root-${i}`);
    doorRoot.setPosition(0, 1.2, doorZ);
    doorRoot.setPosition(0, doorConfig.initialRootY, doorZ);
    app.root.addChild(doorRoot);
    let managedRoomLights = [];

    const panelHalf = doorConfig.panelHalf;
    const doorGap = doorConfig.gap;
    const panelWidth = panelHalf * 2;
    let runwayGuides = [];

    const leftCenter = -panelHalf - (doorGap / 2);
    const rightCenter = panelHalf + (doorGap / 2);

    const left = createDoor(app, {
      name: `left-door-${i}`,
      containerAsset: doorGlb,
      root: doorRoot,
      localPos: new pc.Vec3(leftCenter, 0, 0),
      pivotPos: new pc.Vec3(leftCenter - panelHalf, 0, 0),
      openYaw: 88,
      color: new pc.Color(0.8, 0.03, 0.03),
      rotation: new pc.Vec3(0, 0, 0),
      panelWidth,
      speed: doorConfig.speed
    });

    const right = createDoor(app, {
      name: `right-door-${i}`,
      containerAsset: doorGlb,
      root: doorRoot,
      localPos: new pc.Vec3(rightCenter, 0, 0),
      pivotPos: new pc.Vec3(rightCenter + panelHalf, 0, 0),
      openYaw: -88,
      color: new pc.Color(0.8, 0.03, 0.03),
      rotation: new pc.Vec3(0, 0, 0),
      panelWidth,
      speed: doorConfig.speed
    });

    // Aggiungi modelli specifici per ogni stanza
    switch (roomDefinition.kind) {
      case 'intro':
        // Stanza 0: spazio pulito con corsie luminose da terra.
        runwayGuides = addRunwayGuideLights(room);
        break;

      case 'heart':
        // Stanza 1: cuore pulsante con sciame di lucciole rosse.
        const heartBasePosition = new pc.Vec3(0, 1.8, room.zCenter - 2.0);
        const heartFocusPosition = new pc.Vec3(0, 1.84, room.zCenter - 2.0);
        const heartDoorFrontZ = room.zCenter + room.size.depth * 0.5 - 1.1;
        const cornerX = room.size.width * 0.5 - 0.75;
        const ceilingY = 3.72;
        const floorY = 0.03;
        const heartBaseScale = 0.22;
        const fireflyCount = 100;
        const heart = instantiateModel(
          visibleModels.heart,
          heartBasePosition.clone(),
          new pc.Vec3(heartBaseScale, heartBaseScale, heartBaseScale),
          new pc.Vec3(-90, 0, 0)
        );
        room.addObject(heart);

        const heartCoreLight = new pc.Entity('heart-core-light');
        heartCoreLight.addComponent('light', {
          type: 'omni',
          color: new pc.Color(1.0, 0.0, 0.0),
          intensity: 0.03,
          range: 1.4,
          castShadows: false
        });
        heartCoreLight.setLocalPosition(0, 0.1, 0);
        heart.addChild(heartCoreLight);
        experienceState.heartCoreLight = heartCoreLight;

        for (let j = 0; j < fireflyCount; j++) {
          const firefly = new pc.Entity(`heart-firefly-${j}`);
          firefly.addComponent('render', { type: 'sphere' });
          const useDynamicLight = j % 4 === 0;
          if (useDynamicLight) {
            firefly.addComponent('light', {
              type: 'omni',
              color: new pc.Color(1.0, 0.08, 0.08),
              intensity: 0,
              range: 0.9,
              castShadows: false
            });
          }
          firefly.setLocalScale(0.014, 0.014, 0.014);
          firefly.render.material = fireflyMaterial;
          firefly.enabled = false;
          room.addObject(firefly);

          experienceState.heartFireflies.push({
            entity: firefly,
            useDynamicLight,
            phase: (j / fireflyCount) * Math.PI * 2,
            radius: 0.75 + (j % 5) * 0.14,
            height: -1.35 + ((j * 17) % 14) * 0.26,
            speed: 0.38 + (j % 7) * 0.06,
            wobble: 0.08 + (j % 4) * 0.03,
            flickerPhase: Math.random() * Math.PI * 2,
            flickerSpeed: 1.6 + (j % 6) * 0.35,
            tilt: Math.random() * Math.PI * 2,
            orbitNoise: 0.12 + Math.random() * 0.16
          });
        }

        app.on('update', (dt) => {
          heart.rotateLocal(0, 0, 10 * dt);

          const timeSeconds = performance.now() * 0.001;
          const pulse = cardiacPulse(timeSeconds, 52);
          const tissueMotion = (Math.sin(timeSeconds * 1.45) * 0.5 + 0.5) * 0.0025;
          const pulseAmplitude = 0.014 + sceneEffects.heartPulseBoost * 0.013;
          const pulseScale = heartBaseScale - 0.002 + tissueMotion + pulse * pulseAmplitude;
          heart.setLocalScale(pulseScale, pulseScale, pulseScale);
          heart.setPosition(
            heartBasePosition.x,
            heartBasePosition.y + pulse * (0.024 + sceneEffects.heartPulseBoost * 0.018),
            heartBasePosition.z
          );

          heartCoreLight.light.intensity = (0.02 + pulse * (0.06 + sceneEffects.heartLightBoost * 0.07)) * lightRig.heartCore;
          heartCoreLight.light.range = 0.95 + pulse * (0.18 + sceneEffects.heartLightBoost * 0.2);

          experienceState.heartFireflies.forEach((firefly, index) => {
            const speed = (0.1 + sceneEffects.heartFireflySpeed) * firefly.speed;
            const orbit = timeSeconds * speed + firefly.phase;
            const radius = firefly.radius + Math.sin(orbit * 1.4 + index) * firefly.orbitNoise;
            const swirl = orbit + Math.sin(orbit * 0.65 + firefly.tilt) * 0.35;
            const x = heartBasePosition.x + Math.cos(swirl) * radius;
            const z = heartBasePosition.z + Math.sin(swirl * 1.08 + firefly.tilt * 0.4) * (radius * 0.78);
            const y = heartBasePosition.y + firefly.height + Math.sin(orbit * 2.4 + firefly.tilt) * firefly.wobble;
            const flicker = 0.72 + 0.28 * (Math.sin(timeSeconds * firefly.flickerSpeed + firefly.flickerPhase) * 0.5 + 0.5);
            firefly.entity.enabled = sceneEffects.heartFireflyVisibility > 0.05;
            firefly.entity.setPosition(x, y, z);
            if (firefly.useDynamicLight && firefly.entity.light) {
              firefly.entity.light.intensity = sceneEffects.heartFireflyVisibility * (0.06 + pulse * 0.05) * flicker * lightRig.fireflies;
              firefly.entity.light.range = 0.42 + sceneEffects.heartFireflyVisibility * (0.14 + 0.08 * flicker);
            }
          });
        });
        break;

      case 'tunnel':
        // Stanza tunnel: volutamente vuota, usata solo per la corsa veloce.
        runwayGuides = addRunwayGuideLights(room);
        break;
    }

    const lightConfig = roomDefinition.light ?? DEFAULT_ROOM_LIGHT_CONFIG;

    const softFillLight = new pc.Entity(`soft-fill-light-${i}`);
    softFillLight.addComponent('light', {
      type: 'omni',
      color: lightConfig.softFill.color,
      intensity: 0,
      range: lightConfig.softFill.range,
      castShadows: false
    });
    softFillLight.setPosition(
      lightConfig.softFill.positionOffset.x,
      lightConfig.softFill.positionOffset.y,
      room.zCenter + lightConfig.softFill.positionOffset.z
    );
    app.root.addChild(softFillLight);
    managedRoomLights.push(softFillLight);

    const interiorLight = new pc.Entity(`interior-light-${i}`);
    interiorLight.addComponent('light', {
      type: 'spot',
      color: lightConfig.interior.color,
      intensity: 0,
      innerConeAngle: lightConfig.interior.innerConeAngle,
      outerConeAngle: lightConfig.interior.outerConeAngle,
      range: lightConfig.interior.range,
      castShadows: lightConfig.interior.castShadows,
      shadowResolution: lightConfig.interior.shadowResolution
    });
    interiorLight.setPosition(
      lightConfig.interior.positionOffset.x,
      lightConfig.interior.positionOffset.y,
      room.zCenter + lightConfig.interior.positionOffset.z
    );
    interiorLight.setEulerAngles(
      lightConfig.interior.euler.x,
      lightConfig.interior.euler.y,
      lightConfig.interior.euler.z
    );
    app.root.addChild(interiorLight);

    // Luce di transizione per far intravedere il nuovo spazio
    const transitionLight = new pc.Entity(`transition-light-${i}`);
    transitionLight.addComponent('light', {
      type: 'spot',
      color: lightConfig.transition.color,
      intensity: 0,
      innerConeAngle: lightConfig.transition.innerConeAngle,
      outerConeAngle: lightConfig.transition.outerConeAngle,
      range: lightConfig.transition.range,
      castShadows: lightConfig.transition.castShadows
    });
    transitionLight.setPosition(
      lightConfig.transition.positionOffset.x,
      lightConfig.transition.positionOffset.y,
      room.zCenter + lightConfig.transition.positionOffset.z
    );
    transitionLight.setEulerAngles(
      lightConfig.transition.euler.x,
      lightConfig.transition.euler.y,
      lightConfig.transition.euler.z
    );
    app.root.addChild(transitionLight);

    manager.addRoom({
      id: roomDefinition.id,
      zCenter: room.zCenter,
      doors: [left, right],
      interiorLight,
      transitionLight,
      lowLight: lightConfig.lowLight,
      disableBaseLights: lightConfig.disableBaseLights,
      roomLights: managedRoomLights
    });

    roomRuntime.push({
      id: roomDefinition.id,
      config: roomDefinition,
      room,
      doorRoot,
      doors: [left, right],
      softFillLight,
      interiorLight,
      transitionLight,
      roomLights: managedRoomLights,
      runwayGuides
    });

  });

  const roomZeroRuntime = roomRuntime.find((roomState) => roomState.id === 0);
  const heartRoomRuntime = roomRuntime.find((roomState) => roomState.id === 9);
  const tunnelRuntimes = roomRuntime.filter((roomState) => ROOM_DEFINITIONS.find((definition) => definition.id === roomState.id)?.kind === 'tunnel');
  experienceState.heartRoomLightRig = {
    interior: {
      position: new pc.Vec3(0, 2.3, -95),
      rotation: new pc.Vec3(87.8, -1.9, -4.5),
      intensity: 0.5
    },
    transition: {
      position: new pc.Vec3(-5.66, 0.47, -120),
      rotation: new pc.Vec3(-180, -180, -180),
      intensity: 0
    }
  };
  heartRoomRuntime.interiorLight.setPosition(experienceState.heartRoomLightRig.interior.position);
  heartRoomRuntime.interiorLight.setEulerAngles(experienceState.heartRoomLightRig.interior.rotation);
  heartRoomRuntime.transitionLight.setPosition(experienceState.heartRoomLightRig.transition.position);
  heartRoomRuntime.transitionLight.setEulerAngles(experienceState.heartRoomLightRig.transition.rotation);
  experienceState.debugLightLabels.push(
    { label: 'CUORE INT', entity: heartRoomRuntime.interiorLight },
    { label: 'CUORE TRANS', entity: heartRoomRuntime.transitionLight }
  );
  const introDoorHiddenY = 1.2;//non lo cambiare lo voglio cosi'
  const introDoorVisibleY = 1.2;

  const leftDoorLight = new pc.Entity('intro-door-light-left');
  leftDoorLight.addComponent('light', {
    type: 'spot',
    color: new pc.Color(1.0, 0.32, 0.18),
    intensity: 0,
    innerConeAngle: 22,
    outerConeAngle: 42,
    range: 5.5,
    castShadows: false
  });
  leftDoorLight.setPosition(-1.2, 1.7, 6.35);
  aimSpotAt(leftDoorLight, new pc.Vec3(-0.65, 0.06, roomZeroRuntime.room.backWallZ + 0.95));
  app.root.addChild(leftDoorLight);
  experienceState.introDoorLights.push(leftDoorLight);

  const rightDoorLight = new pc.Entity('intro-door-light-right');
  rightDoorLight.addComponent('light', {
    type: 'spot',
    color: new pc.Color(1.0, 0.32, 0.18),
    intensity: 0,
    innerConeAngle: 22,
    outerConeAngle: 42,
    range: 5.5,
    castShadows: false
  });
  rightDoorLight.setPosition(1.2, 1.7, 6.35);
  aimSpotAt(rightDoorLight, new pc.Vec3(0.65, 0.06, roomZeroRuntime.room.backWallZ + 0.95));
  app.root.addChild(rightDoorLight);
  experienceState.introDoorLights.push(rightDoorLight);
  experienceState.introDoorLightEntities = {
    left: leftDoorLight,
    right: rightDoorLight
  };
  experienceState.introDoorLightRig = {
    left: {
      position: new pc.Vec3(-1.2, 1.7, 6.35),
      rotation: cloneEuler(leftDoorLight),
      intensity: 1,
      range: 5.5
    },
    right: {
      position: new pc.Vec3(1.2, 1.7, 6.35),
      rotation: cloneEuler(rightDoorLight),
      intensity: 1,
      range: 5.5
    }
  };
  experienceState.debugLightLabels.push(
    { label: 'STANZA 0 L', entity: leftDoorLight },
    { label: 'STANZA 0 R', entity: rightDoorLight }
  );

  const introOccluderMaterial = new pc.StandardMaterial();
  introOccluderMaterial.diffuse = new pc.Color(0, 0, 0);
  introOccluderMaterial.emissive = new pc.Color(0, 0, 0);
  introOccluderMaterial.useLighting = false;
  introOccluderMaterial.update();

  const introOutlineMaterial = new pc.StandardMaterial();
  introOutlineMaterial.diffuse = new pc.Color(0.02, 0.02, 0.02);
  introOutlineMaterial.emissive = new pc.Color(0.11, 0.11, 0.12);
  introOutlineMaterial.emissiveIntensity = 0.08;
  introOutlineMaterial.useLighting = false;
  introOutlineMaterial.update();
  experienceState.introOutlineMaterial = introOutlineMaterial;

  const introDoorOccluder = new pc.Entity('intro-door-occluder');
  introDoorOccluder.addComponent('render', { type: 'box' });
  introDoorOccluder.setLocalScale(roomZeroRuntime.room.doorWidth, roomZeroRuntime.room.doorHeight, 0.28);
  introDoorOccluder.setPosition(0, roomZeroRuntime.room.doorHeight / 2, roomZeroRuntime.room.backWallZ + 0.08);
  introDoorOccluder.render.material = introOccluderMaterial;
  introDoorOccluder.render.castShadows = false;
  introDoorOccluder.render.receiveShadows = false;
  app.root.addChild(introDoorOccluder);
  experienceState.introDoorOccluder = introDoorOccluder;

  const heartDoorOccluder = new pc.Entity('heart-door-occluder');
  heartDoorOccluder.addComponent('render', { type: 'box' });
  heartDoorOccluder.setLocalScale(heartRoomRuntime.room.doorWidth, heartRoomRuntime.room.doorHeight, 0.28);
  heartDoorOccluder.setPosition(0, heartRoomRuntime.room.doorHeight / 2, heartRoomRuntime.room.backWallZ + 0.08);
  heartDoorOccluder.render.material = introOccluderMaterial;
  heartDoorOccluder.render.castShadows = false;
  heartDoorOccluder.render.receiveShadows = false;
  heartDoorOccluder.enabled = false;
  app.root.addChild(heartDoorOccluder);
  experienceState.heartDoorOccluder = heartDoorOccluder;

  function addIntroOutline(name, position, scale) {
    const edge = new pc.Entity(name);
    edge.addComponent('render', { type: 'box' });
    edge.setPosition(position);
    edge.setLocalScale(scale);
    edge.render.material = introOutlineMaterial;
    edge.render.castShadows = false;
    edge.render.receiveShadows = false;
    roomZeroRuntime.room.addObject(edge);
    experienceState.introOutlineEntities.push(edge);
    return edge;
  }

  const room0Width = roomZeroRuntime.room.size.width;
  const room0Depth = roomZeroRuntime.room.size.depth;
  const room0Center = roomZeroRuntime.room.zCenter;
  const outlineY = 2;
  const outlineH = 4;
  const outlineT = 0.012;
  const outlineZFront = room0Center + room0Depth / 2 - 0.08;
  const outlineZBack = room0Center - room0Depth / 2 + 0.08;
  const outlineXLeft = -room0Width / 2 + 0.08;
  const outlineXRight = room0Width / 2 - 0.08;

  addIntroOutline('outline-front-left', new pc.Vec3(outlineXLeft, outlineY, outlineZFront), new pc.Vec3(outlineT, outlineH, outlineT));
  addIntroOutline('outline-front-right', new pc.Vec3(outlineXRight, outlineY, outlineZFront), new pc.Vec3(outlineT, outlineH, outlineT));
  addIntroOutline('outline-back-left', new pc.Vec3(outlineXLeft, outlineY, outlineZBack), new pc.Vec3(outlineT, outlineH, outlineT));
  addIntroOutline('outline-back-right', new pc.Vec3(outlineXRight, outlineY, outlineZBack), new pc.Vec3(outlineT, outlineH, outlineT));
  addIntroOutline('outline-top-front', new pc.Vec3(0, 4 - outlineT, outlineZFront), new pc.Vec3(room0Width - 0.16, outlineT, outlineT));
  addIntroOutline('outline-top-back', new pc.Vec3(0, 4 - outlineT, outlineZBack), new pc.Vec3(room0Width - 0.16, outlineT, outlineT));
  addIntroOutline('outline-top-left', new pc.Vec3(outlineXLeft, 4 - outlineT, room0Center), new pc.Vec3(outlineT, outlineT, room0Depth - 0.16));
  addIntroOutline('outline-top-right', new pc.Vec3(outlineXRight, 4 - outlineT, room0Center), new pc.Vec3(outlineT, outlineT, room0Depth - 0.16));

  function setLightGroupIntensity(entities, intensity) {
    entities.forEach((entity) => {
      if (entity?.light) entity.light.intensity = intensity;
    });
  }

  function getRoomRig(roomId) {
    return lightRig.rooms[roomId] ?? { fill: 1, interior: 1, transition: 1 };
  }

  function getAdjustedFov(baseFov) {
    return pc.math.clamp(baseFov * lightRig.cameraFovGlobal, 20, 120);
  }

  function getHeartSceneFov(baseFov) {
    return pc.math.clamp(baseFov * lightRig.cameraFovGlobal * lightRig.cameraFovHeart, 20, 120);
  }

  function aimSpotAt(lightEntity, targetPosition) {
    lightEntity.lookAt(targetPosition);
    lightEntity.rotateLocal(90, 0, 0);
  }

  function setDoorGroupColor(roomState, color) {
    roomState.doors.forEach((door) => door.setColor?.(color));
  }

  function setDoorGroupOpacity(roomState, opacity) {
    roomState.doors.forEach((door) => door.setOpacity?.(opacity));
  }

  function setDoorRootToBackWall(roomState, y) {
    roomState.doorRoot.setPosition(0, y, roomState.room.backWallZ + (roomState.config?.door?.backWallOffset ?? 0.15));
  }

  function darkenRoomStructure(roomState, color = new pc.Color(0.06, 0.06, 0.07)) {
    roomState.room.structureEntities.forEach((entity) => {
      if (!entity.render?.material) return;
      if (!entity._darkRoomMaterial) {
        entity.render.material = entity.render.material.clone();
        entity._darkRoomMaterial = true;
      }
      entity.render.material.diffuse.copy(color);
      entity.render.material.gloss = 0.18;
      entity.render.material.metalness = 0.04;
      entity.render.material.update();
    });
  }

  function getRoomSequenceLabel(roomId) {
    const roomState = roomRuntime.find((room) => room.id === roomId);
    const sequenceNumber = roomState?.config?.sequenceNumber ?? roomId;
    return `Stanza ${sequenceNumber}`;
  }

  function vec3ToPlain(vec3) {
    return {
      x: Number(vec3.x.toFixed(3)),
      y: Number(vec3.y.toFixed(3)),
      z: Number(vec3.z.toFixed(3))
    };
  }

  function cloneEuler(entity) {
    const euler = entity.getEulerAngles();
    return new pc.Vec3(euler.x, euler.y, euler.z);
  }

  function applyVec3Values(targetVec3, source) {
    if (!source) return;
    targetVec3.set(
      Number(source.x ?? targetVec3.x),
      Number(source.y ?? targetVec3.y),
      Number(source.z ?? targetVec3.z)
    );
  }

  function getRoom0LightPayload() {
    return {
      left: {
        position: vec3ToPlain(experienceState.introDoorLightRig.left.position),
        rotation: vec3ToPlain(experienceState.introDoorLightRig.left.rotation),
        intensity: Number(experienceState.introDoorLightRig.left.intensity.toFixed(3))
      },
      right: {
        position: vec3ToPlain(experienceState.introDoorLightRig.right.position),
        rotation: vec3ToPlain(experienceState.introDoorLightRig.right.rotation),
        intensity: Number(experienceState.introDoorLightRig.right.intensity.toFixed(3))
      }
    };
  }

  function getHeartRoomLightPayload() {
    return {
      interior: {
        position: vec3ToPlain(experienceState.heartRoomLightRig.interior.position),
        rotation: vec3ToPlain(experienceState.heartRoomLightRig.interior.rotation),
        intensity: Number(experienceState.heartRoomLightRig.interior.intensity.toFixed(3))
      },
      transition: {
        position: vec3ToPlain(experienceState.heartRoomLightRig.transition.position),
        rotation: vec3ToPlain(experienceState.heartRoomLightRig.transition.rotation),
        intensity: Number(experienceState.heartRoomLightRig.transition.intensity.toFixed(3))
      }
    };
  }

  function bindRigSlider(sliderId, valueId, target, axisOrKey) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    if (!slider || !value || !target) return;

    const syncFromTarget = () => {
      const currentValue = axisOrKey === 'intensity'
        ? target.intensity
        : target[axisOrKey.includes('rotation.') ? 'rotation' : 'position'][axisOrKey.split('.')[1]];
      slider.value = String(currentValue);
      value.textContent = Number(currentValue).toFixed(2);
    };

    slider.addEventListener('input', () => {
      const numericValue = Number(slider.value);
      if (axisOrKey === 'intensity') {
        target.intensity = numericValue;
      } else {
        const [group, axis] = axisOrKey.split('.');
        target[group][axis] = numericValue;
      }
      value.textContent = numericValue.toFixed(2);
    });

    syncFromTarget();
  }

  function applyPerformanceMode(enabled) {
    performanceState.enabled = enabled;
    directional.light.castShadows = !enabled;
    directional.light.shadowDistance = enabled ? 16 : (isMobile ? 22 : 34);
    directional.light.shadowResolution = enabled ? 256 : (isMobile ? 512 : 1024);

    roomRuntime.forEach((roomState) => {
      if (roomState.interiorLight?.light) {
        roomState.interiorLight.light.castShadows = !enabled && !isMobile;
        roomState.interiorLight.light.shadowResolution = enabled ? 256 : (isMobile ? 512 : 1024);
      }
    });

    if (debugUi.performanceButton) {
      debugUi.performanceButton.textContent = enabled ? 'Performance: ON' : 'Performance: OFF';
    }
  }

  function addRunwayGuideLights(room) {
    const guideCountPerSide = 8;
    const laneX = 2.15;
    const startZ = room.zCenter + room.size.depth / 2 - 2.2;
    const stepZ = 2.65;
    const guides = [];

    for (let side = -1; side <= 1; side += 2) {
      for (let index = 0; index < guideCountPerSide; index++) {
        const guide = new pc.Entity(`runway-light-${side}-${index}`);
        guide.addComponent('render', { type: 'cylinder' });
        guide.setLocalScale(0.16, 0.04, 0.16);
        guide.setPosition(side * laneX, 0.03, startZ - index * stepZ);
        const guideMaterial = runwayLightMaterial.clone();
        guideMaterial.update();
        guide.render.material = guideMaterial;
        guide.render.castShadows = false;
        guide.render.receiveShadows = false;
        guide._runwayMaterial = guideMaterial;
        guide._runwayBaseScaleY = 0.04;
        guide._runwayPulseOffset = index * 0.22 + (side > 0 ? 0.35 : 0);
        room.addObject(guide);
        guides.push(guide);
      }
    }

    return guides;
  }

  function setRunwayGuidePulse(roomState, pulseAmount, timeSeconds = 0) {
    if (!roomState?.runwayGuides?.length) return;

    roomState.runwayGuides.forEach((guide) => {
      const wave = 0.5 + 0.5 * Math.sin(timeSeconds * 8 + guide._runwayPulseOffset);
      const intensity = 3.8 + pulseAmount * (1.6 + wave * 1.8);
      guide._runwayMaterial.emissiveIntensity = intensity;
      guide._runwayMaterial.update();

      const scaleY = guide._runwayBaseScaleY + pulseAmount * (0.01 + wave * 0.02);
      guide.setLocalScale(0.16, scaleY, 0.16);
    });
  }

  function getTunnelRouteProgress(tunnelIndex, movementProgress, includeHeartApproach = false) {
    const totalSegments = tunnelRuntimes.length + 1;
    const baseIndex = includeHeartApproach ? tunnelRuntimes.length : tunnelIndex;
    return pc.math.clamp((baseIndex + movementProgress) / totalSegments, 0, 1);
  }

  function getTunnelRush(globalProgress) {
    return 0.18 + Math.sin(globalProgress * Math.PI) * 0.82;
  }

  function setDebugLightLabels() {
    if (!debugUi.lightLabelOverlay) return;
    debugUi.lightLabelOverlay.innerHTML = '';
    experienceState.debugLightLabels.forEach((labelConfig) => {
      const label = document.createElement('div');
      label.className = 'debug-light-label';
      label.textContent = labelConfig.label;
      debugUi.lightLabelOverlay.appendChild(label);
      labelConfig.element = label;
    });
  }

  function updateDebugLightLabels() {
    if (!debugUi.lightLabelOverlay) return;

    if (!debugMode.active || !experienceState.debugLightLabels.length) {
      debugUi.lightLabelOverlay.style.display = 'none';
      return;
    }

    debugUi.lightLabelOverlay.style.display = 'block';
    experienceState.debugLightLabels.forEach((labelConfig) => {
      if (!labelConfig.entity?.enabled || !labelConfig.element) {
        if (labelConfig.element) labelConfig.element.style.display = 'none';
        return;
      }

      const worldPos = labelConfig.entity.getPosition();
      const screenPos = camera.camera.worldToScreen(worldPos);
      const isVisible = screenPos.z > 0;
      labelConfig.element.style.display = isVisible ? 'block' : 'none';
      if (!isVisible) return;
      labelConfig.element.style.left = `${screenPos.x}px`;
      labelConfig.element.style.top = `${screenPos.y - 8}px`;
    });
  }

  function applyPreStartLightPreview() {
    if (railSequence.hasStarted()) return;

    ambient.light.intensity = 0.08 * lightRig.ambient;
    directional.light.intensity = 0.11 * lightRig.key;
    setDoorRootToBackWall(roomZeroRuntime, introDoorHiddenY);
    roomZeroRuntime.doors.forEach((door) => door.setOpen(true));
    tunnelRuntimes.forEach((roomState) => roomState.doors.forEach((door) => door.setOpen(true)));

    roomRuntime.forEach((roomState) => {
      const roomRig = getRoomRig(roomState.id);
      roomState.softFillLight.light.intensity = 0.03 * lightRig.roomFill * roomRig.fill;
      roomState.interiorLight.light.intensity = 0.025 * lightRig.interior * roomRig.interior;
      roomState.transitionLight.light.intensity = 0.02 * lightRig.transition * roomRig.transition;
    });

    if (experienceState.heartCoreLight?.light) {
      experienceState.heartCoreLight.light.intensity = 0.05 * lightRig.heartCore;
    }
  }

  function setHeartRoomMood(elapsed) {
    const glow = easeInOut01(elapsed / 3.2);
    const room0Rig = getRoomRig(0);
    const room1Rig = getRoomRig(9);
    heartRoomRuntime.interiorLight.setPosition(experienceState.heartRoomLightRig.interior.position);
    heartRoomRuntime.interiorLight.setEulerAngles(experienceState.heartRoomLightRig.interior.rotation);
    heartRoomRuntime.transitionLight.setPosition(experienceState.heartRoomLightRig.transition.position);
    heartRoomRuntime.transitionLight.setEulerAngles(experienceState.heartRoomLightRig.transition.rotation);
    ambient.light.intensity = 0.001 * lightRig.ambient;
    directional.light.intensity = 0.0035 * lightRig.key;
    roomZeroRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room0Rig.interior;
    roomZeroRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room0Rig.transition;
    setLightGroupIntensity(roomZeroRuntime.roomLights, 0);
    experienceState.introDoorLights.forEach((light) => {
      light.light.intensity = 0 * lightRig.introDoors;
    });

    heartRoomRuntime.interiorLight.light.intensity = (0.09 + glow * 0.2) * lightRig.interior * room1Rig.interior * experienceState.heartRoomLightRig.interior.intensity;
    heartRoomRuntime.transitionLight.light.intensity = (0.045 + glow * 0.12) * lightRig.transition * room1Rig.transition * experienceState.heartRoomLightRig.transition.intensity;
    setLightGroupIntensity(
      heartRoomRuntime.roomLights.filter((light) => light.name !== 'red-light'),
      (0.05 + glow * 0.16) * lightRig.roomFill * room1Rig.fill
    );

    sceneEffects.heartPulseBoost = 0.65 + glow * 0.55;
    sceneEffects.heartLightBoost = 0.2 + glow * 0.22;
    sceneEffects.heartFireflyVisibility = glow;
    sceneEffects.heartFireflySpeed = 0.1 + glow * 0.12;
    bloomEffect.strength = 0.2 + glow * 0.55;
  }

  const railSequence = createRailSequence({
    pivot: cameraPivot,
    playerController,
    manager,
    statusElement: document.getElementById('start-overlay')
  });

  document.getElementById('move-zone').style.display = 'none';
  document.getElementById('look-zone').style.display = 'none';

  // prima stanza
  railSequence.addStep({
    label: 'Prologo',
    roomId: 0,
    position: new pc.Vec3(0, 1.75, 24.6),
    lookAt: new pc.Vec3(0, 1.7, 6.15),
    dwell: 0.92,
    moveSmoothing: 3.6,
    lookSmoothing: 4.5,
    onEnter: () => {
      const room0Rig = getRoomRig(0);
      const room1Rig = getRoomRig(9);
      sceneEffects.heartFireflyVisibility = 0;
      sceneEffects.heartFireflySpeed = 0.08;
      bloomEffect.strength = 0;
      ambient.light.intensity = 0 * lightRig.ambient;
      directional.light.intensity = 0 * lightRig.key;
      camera.camera.fov = getAdjustedFov(52);
      roomZeroRuntime.room.structureEntities.forEach((entity) => { entity.enabled = true; });
      experienceState.introOutlineEntities.forEach((entity) => { entity.enabled = true; });
      experienceState.introOutlineMaterial.emissiveIntensity = 0.035;
      setDoorRootToBackWall(roomZeroRuntime, introDoorHiddenY);
      roomZeroRuntime.doors.forEach((door) => door.setOpen(true));
      tunnelRuntimes.forEach((roomState) => roomState.doors.forEach((door) => door.setOpen(true)));
      heartRoomRuntime.doors.forEach((door) => door.setOpen(true));
      roomZeroRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room0Rig.interior;
      roomZeroRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room0Rig.transition;
      heartRoomRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room1Rig.interior;
      heartRoomRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room1Rig.transition;
      setLightGroupIntensity(roomZeroRuntime.roomLights, 0);
      setLightGroupIntensity(heartRoomRuntime.roomLights, 0);
      experienceState.introDoorLights.forEach((light) => {
        light.light.intensity = 0 * lightRig.introDoors;
        light.light.range = 1.2;
      });
      experienceState.introDoorOccluder.enabled = true;
      setCanvasTunnelEffect(0, 1);
    },
    onUpdate: ({ elapsed }) => {
      const room0Rig = getRoomRig(0);
      const reveal = easeInOut01(elapsed / 0.9);
      const doorRise = easeInOut01(Math.max(0, elapsed - 0.1) / 0.45);
      const timeSeconds = performance.now() * 0.001;
      setDoorRootToBackWall(
        roomZeroRuntime,
        introDoorHiddenY + (introDoorVisibleY - introDoorHiddenY) * doorRise
      );
      ambient.light.intensity = 0.01 * lightRig.ambient * reveal;
      directional.light.intensity = 0.015 * lightRig.key * reveal;
      roomZeroRuntime.interiorLight.light.intensity = 0.06 * lightRig.interior * room0Rig.interior * reveal;
      roomZeroRuntime.transitionLight.light.intensity = 0.06 * lightRig.transition * room0Rig.transition * reveal;
      setLightGroupIntensity(roomZeroRuntime.roomLights, 0.04 * lightRig.roomFill * room0Rig.fill * reveal);
      experienceState.introOutlineMaterial.emissiveIntensity = 0.028 + reveal * 0.035;
      leftDoorLight.setPosition(experienceState.introDoorLightRig.left.position);
      leftDoorLight.setEulerAngles(experienceState.introDoorLightRig.left.rotation);
      rightDoorLight.setPosition(experienceState.introDoorLightRig.right.position);
      rightDoorLight.setEulerAngles(experienceState.introDoorLightRig.right.rotation);
      experienceState.introDoorLights.forEach((light) => {
        const lightConfig = light === leftDoorLight ? experienceState.introDoorLightRig.left : experienceState.introDoorLightRig.right;
        light.light.intensity = reveal * 0.12 * lightRig.introDoors * lightConfig.intensity;
        light.light.range = lightConfig.range;
      });
      experienceState.introDoorOccluder.enabled = reveal < 0.68;
      setRunwayGuidePulse(roomZeroRuntime, reveal * 0.2, timeSeconds);
    }
  });

  // QUI VIENE COSTRUITA LA SEQUENZA DELLE 8 STANZE TUNNEL attraversate tra il prologo e la stanza cuore.
  tunnelRuntimes.forEach((tunnelRoom, tunnelIndex) => {
    const isLastTunnelRoom = tunnelIndex === tunnelRuntimes.length - 1;
    railSequence.addStep({
      label: `Tunnel ${tunnelIndex + 1}`,
      roomId: tunnelRoom.id,
      position: new pc.Vec3(0, 1.66, tunnelRoom.room.zCenter + 1.6),
      lookAt: new pc.Vec3(0, 1.42, tunnelRoom.room.zCenter - 6.8),
      dwell: 0.02,
      moveSmoothing: 11.0,
      lookSmoothing: 5.0,
      onEnter: () => {
        roomZeroRuntime.room.structureEntities.forEach((entity) => { entity.enabled = false; });
        roomZeroRuntime.doors.forEach((door) => door.setOpen(true));
        tunnelRuntimes.forEach((roomState) => roomState.doors.forEach((door) => door.setOpen(true)));
        if (isLastTunnelRoom) {
          heartRoomRuntime.doors.forEach((door) => door.setOpen(true));
        }
        experienceState.introDoorOccluder.enabled = false;
        experienceState.heartDoorOccluder.enabled = false;
        setCanvasTunnelEffect(0.15, 1.02);
      },
      onUpdate: ({ elapsed, movementProgress }) => {
        const room0Rig = getRoomRig(0);
        const room1Rig = getRoomRig(9);
        const timeSeconds = performance.now() * 0.001;
        const globalTunnelProgress = getTunnelRouteProgress(tunnelIndex, movementProgress);
        const rush = getTunnelRush(globalTunnelProgress);
        const fovKick = Math.sin(timeSeconds * 11 + globalTunnelProgress * 12) * 1.35 * rush;
        camera.camera.fov = getAdjustedFov(64 + rush * 34 + fovKick);
        setCanvasTunnelEffect(0.18 + rush * 0.62, 1.02 + rush * 0.035);
        ambient.light.intensity = (0.00035 + rush * 0.0009) * lightRig.ambient;
        directional.light.intensity = 0.0016 * lightRig.key;
        roomZeroRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room0Rig.interior;
        roomZeroRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room0Rig.transition;
        setLightGroupIntensity(roomZeroRuntime.roomLights, 0);
        experienceState.introDoorLights.forEach((light) => {
          light.light.intensity = (0.08 - rush * 0.05) * lightRig.introDoors;
        });
        setRunwayGuidePulse(roomZeroRuntime, 0.08 + rush * 0.28, timeSeconds);
        tunnelRuntimes.forEach((roomState, roomIndex) => {
          const localBoost = roomState.id === tunnelRoom.id ? 0.22 + rush * 0.7 : 0.06 + rush * 0.16;
          setRunwayGuidePulse(roomState, localBoost, timeSeconds + roomIndex * 0.12);
        });
        heartRoomRuntime.transitionLight.light.intensity = (0.01 + rush * 0.04) * lightRig.transition * room1Rig.transition;
        sceneEffects.heartFireflyVisibility = 0.08 + rush * 0.28;
        sceneEffects.heartFireflySpeed = 0.1 + rush * 0.12;
        sceneEffects.heartLightBoost = 0.12 + rush * 0.16;
      }
    });
  });

  // terza stanza
  const heartLandingPosition = new pc.Vec3(0.2, 1.82, heartRoomRuntime.room.zCenter + 2.8);
  const heartLookTarget = new pc.Vec3(0, 1.84, heartRoomRuntime.room.zCenter - 2.0);
  let heartLandingDebugLogged = false;
  railSequence.addStep({
    label: 'Cuore',
    roomId: 9,
    // PUNTO DI ATTERRAGGIO NELLA STANZA CUORE: cambia questa position per spostare dove la camera arriva dopo il tunnel.
    position: heartLandingPosition.clone(),
    lookAt: heartLookTarget.clone(),
    dwell: 999,
    autoAdvance: false,
    onEnter: () => {
      const orbitCenter = heartLookTarget.clone();
      const orbitRadius = 2.4;
      heartLandingDebugLogged = false;
      tunnelRuntimes.forEach((roomState) => setRunwayGuidePulse(roomState, 0, 0));
      roomZeroRuntime.doors.forEach((door) => door.setOpen(false));
      heartRoomRuntime.doors.forEach((door) => door.setOpen(false));
      setDoorGroupColor(roomZeroRuntime, new pc.Color(0.8, 0.03, 0.03));
      setDoorGroupColor(heartRoomRuntime, new pc.Color(0.8, 0.03, 0.03));
      setDoorGroupOpacity(roomZeroRuntime, 1);
      setDoorGroupOpacity(heartRoomRuntime, 1);
      experienceState.introDoorOccluder.enabled = true;
      experienceState.heartDoorOccluder.enabled = true;
      camera.camera.fov = getHeartSceneFov(50);
      railSequence.getCurrentStep()?.position.copy(heartLandingPosition);
      railSequence.getCurrentStep()?.lookAt.copy(heartLookTarget);
      setCanvasTunnelEffect(0, 1);
      console.log('%c[LANDING DEBUG] TARGET STANZA CUORE', 'color: #ff5555; font-weight: bold;');
      console.log({
        roomSequence: heartRoomRuntime.config?.sequenceNumber,
        roomId: heartRoomRuntime.id,
        roomZCenter: heartRoomRuntime.room.zCenter,
        roomBackWallZ: heartRoomRuntime.room.backWallZ,
        landingPosition: {
          x: Number(heartLandingPosition.x.toFixed(3)),
          y: Number(heartLandingPosition.y.toFixed(3)),
          z: Number(heartLandingPosition.z.toFixed(3))
        },
        lookTarget: {
          x: Number(heartLookTarget.x.toFixed(3)),
          y: Number(heartLookTarget.y.toFixed(3)),
          z: Number(heartLookTarget.z.toFixed(3))
        }
      });
    },
    onUpdate: ({ elapsed, holdElapsed, movementProgress, reachedTarget, step }) => {
      const orbitSpeed = 0.14;
      const orbitCenter = heartLookTarget;
      const orbitRadius = 2.4;
      const orbitHeight = 1.9;
      const targetFov = 50;

      if (reachedTarget) {
        const orbitAngle = holdElapsed * orbitSpeed;
        step.position.set(
          orbitCenter.x + Math.cos(orbitAngle) * orbitRadius,
          orbitHeight,
          orbitCenter.z + Math.sin(orbitAngle) * orbitRadius
        );
        step.lookAt.set(
          orbitCenter.x,
          orbitCenter.y,
          orbitCenter.z
        );
      } else {
        step.position.copy(heartLandingPosition);
        step.lookAt.copy(heartLookTarget);
      }

      if (reachedTarget && !heartLandingDebugLogged) {
        heartLandingDebugLogged = true;
        const actualPosition = cameraPivot.getPosition();
        console.log('%c[LANDING DEBUG] ATTERRAGGIO RAGGIUNTO', 'color: #00ffaa; font-weight: bold;');
        console.log({
          roomSequence: heartRoomRuntime.config?.sequenceNumber,
          roomId: heartRoomRuntime.id,
          expectedLandingPosition: {
            x: Number(heartLandingPosition.x.toFixed(3)),
            y: Number(heartLandingPosition.y.toFixed(3)),
            z: Number(heartLandingPosition.z.toFixed(3))
          },
          actualCameraPosition: {
            x: Number(actualPosition.x.toFixed(3)),
            y: Number(actualPosition.y.toFixed(3)),
            z: Number(actualPosition.z.toFixed(3))
          },
          expectedLookTarget: {
            x: Number(heartLookTarget.x.toFixed(3)),
            y: Number(heartLookTarget.y.toFixed(3)),
            z: Number(heartLookTarget.z.toFixed(3))
          }
        });
      }

      if (!reachedTarget) {
        const timeSeconds = performance.now() * 0.001;
        const globalTunnelProgress = getTunnelRouteProgress(0, movementProgress, true);
        const rush = getTunnelRush(globalTunnelProgress);
        const fovKick = Math.sin(timeSeconds * 11 + globalTunnelProgress * 12) * 1.1 * rush;
        camera.camera.fov = pc.math.lerp(camera.camera.fov, getAdjustedFov(62 + rush * 24 + fovKick), 0.08);
        setCanvasTunnelEffect(0.1 + rush * 0.34, 1.01 + rush * 0.02);
      } else {
        camera.camera.fov = pc.math.lerp(camera.camera.fov, getHeartSceneFov(targetFov), 0.06);
        setCanvasTunnelEffect(0, 1);
      }
      roomZeroRuntime.doors.forEach((door) => door.setOpen(false));
      heartRoomRuntime.doors.forEach((door) => door.setOpen(false));
      const doorFade = easeInOut01(elapsed / 2.4);
      const fadedDoorColor = new pc.Color(
        pc.math.lerp(0.8, 0.02, doorFade),
        pc.math.lerp(0.03, 0.02, doorFade),
        pc.math.lerp(0.03, 0.02, doorFade)
      );
      setDoorGroupColor(roomZeroRuntime, fadedDoorColor);
      setDoorGroupColor(heartRoomRuntime, fadedDoorColor);
      const doorOpacity = pc.math.lerp(1, 0.02, doorFade);
      setDoorGroupOpacity(roomZeroRuntime, doorOpacity);
      setDoorGroupOpacity(heartRoomRuntime, doorOpacity);
      experienceState.introDoorOccluder.enabled = true;
      experienceState.heartDoorOccluder.enabled = true;
      setHeartRoomMood(elapsed + 1.5);
      sceneEffects.heartFireflyVisibility = 0.9;
    }
  });

  setDebugLightLabels();
  bindRigSlider('room0-left-x', 'room0-left-x-value', experienceState.introDoorLightRig.left, 'position.x');
  bindRigSlider('room0-left-y', 'room0-left-y-value', experienceState.introDoorLightRig.left, 'position.y');
  bindRigSlider('room0-left-z', 'room0-left-z-value', experienceState.introDoorLightRig.left, 'position.z');
  bindRigSlider('room0-left-rx', 'room0-left-rx-value', experienceState.introDoorLightRig.left, 'rotation.x');
  bindRigSlider('room0-left-ry', 'room0-left-ry-value', experienceState.introDoorLightRig.left, 'rotation.y');
  bindRigSlider('room0-left-rz', 'room0-left-rz-value', experienceState.introDoorLightRig.left, 'rotation.z');
  bindRigSlider('room0-left-intensity', 'room0-left-intensity-value', experienceState.introDoorLightRig.left, 'intensity');
  bindRigSlider('room0-right-x', 'room0-right-x-value', experienceState.introDoorLightRig.right, 'position.x');
  bindRigSlider('room0-right-y', 'room0-right-y-value', experienceState.introDoorLightRig.right, 'position.y');
  bindRigSlider('room0-right-z', 'room0-right-z-value', experienceState.introDoorLightRig.right, 'position.z');
  bindRigSlider('room0-right-rx', 'room0-right-rx-value', experienceState.introDoorLightRig.right, 'rotation.x');
  bindRigSlider('room0-right-ry', 'room0-right-ry-value', experienceState.introDoorLightRig.right, 'rotation.y');
  bindRigSlider('room0-right-rz', 'room0-right-rz-value', experienceState.introDoorLightRig.right, 'rotation.z');
  bindRigSlider('room0-right-intensity', 'room0-right-intensity-value', experienceState.introDoorLightRig.right, 'intensity');
  bindRigSlider('heart-interior-x', 'heart-interior-x-value', experienceState.heartRoomLightRig.interior, 'position.x');
  bindRigSlider('heart-interior-y', 'heart-interior-y-value', experienceState.heartRoomLightRig.interior, 'position.y');
  bindRigSlider('heart-interior-z', 'heart-interior-z-value', experienceState.heartRoomLightRig.interior, 'position.z');
  bindRigSlider('heart-interior-rx', 'heart-interior-rx-value', experienceState.heartRoomLightRig.interior, 'rotation.x');
  bindRigSlider('heart-interior-ry', 'heart-interior-ry-value', experienceState.heartRoomLightRig.interior, 'rotation.y');
  bindRigSlider('heart-interior-rz', 'heart-interior-rz-value', experienceState.heartRoomLightRig.interior, 'rotation.z');
  bindRigSlider('heart-interior-intensity', 'heart-interior-intensity-value', experienceState.heartRoomLightRig.interior, 'intensity');
  bindRigSlider('heart-transition-x', 'heart-transition-x-value', experienceState.heartRoomLightRig.transition, 'position.x');
  bindRigSlider('heart-transition-y', 'heart-transition-y-value', experienceState.heartRoomLightRig.transition, 'position.y');
  bindRigSlider('heart-transition-z', 'heart-transition-z-value', experienceState.heartRoomLightRig.transition, 'position.z');
  bindRigSlider('heart-transition-rx', 'heart-transition-rx-value', experienceState.heartRoomLightRig.transition, 'rotation.x');
  bindRigSlider('heart-transition-ry', 'heart-transition-ry-value', experienceState.heartRoomLightRig.transition, 'rotation.y');
  bindRigSlider('heart-transition-rz', 'heart-transition-rz-value', experienceState.heartRoomLightRig.transition, 'rotation.z');
  bindRigSlider('heart-transition-intensity', 'heart-transition-intensity-value', experienceState.heartRoomLightRig.transition, 'intensity');

  debugUi.pauseButton?.addEventListener('click', () => {
    const paused = railSequence.togglePause();
    debugUi.pauseButton.textContent = paused ? 'Riprendi percorso' : 'Pausa percorso';
  });

  debugUi.nextButton?.addEventListener('click', () => {
    if (!railSequence.isPaused()) return;
    railSequence.goNext();
  });

  debugUi.performanceButton?.addEventListener('click', () => {
    applyPerformanceMode(!performanceState.enabled);
  });

  debugUi.toggleButton?.addEventListener('click', () => {
    setDebugUiVisible(!debugUiVisible);
  });

  debugUi.copyButton?.addEventListener('click', async () => {
    const payload = debugUi.overlay?.textContent ?? '';

    try {
      await navigator.clipboard.writeText(payload);
      debugUi.copyButton.textContent = 'Copiato';
      window.setTimeout(() => {
        if (debugUi.copyButton) debugUi.copyButton.textContent = 'Copia dati';
      }, 1200);
    } catch (error) {
      console.error('Errore copia dati debug:', error);
      debugUi.copyButton.textContent = 'Copia fallita';
      window.setTimeout(() => {
        if (debugUi.copyButton) debugUi.copyButton.textContent = 'Copia dati';
      }, 1200);
    }
  });

  debugUi.copyHeartLightJsonButton?.addEventListener('click', async () => {
    const payload = JSON.stringify(getHeartRoomLightPayload(), null, 2);

    try {
      await navigator.clipboard.writeText(payload);
      debugUi.copyHeartLightJsonButton.textContent = 'JSON Cuore Copiato';
      setTimeout(() => {
        if (debugUi.copyHeartLightJsonButton) debugUi.copyHeartLightJsonButton.textContent = 'Copia JSON Cuore';
      }, 1200);
    } catch (error) {
      console.error('Copia JSON cuore fallita:', error);
      debugUi.copyHeartLightJsonButton.textContent = 'Copia Fallita';
      setTimeout(() => {
        if (debugUi.copyHeartLightJsonButton) debugUi.copyHeartLightJsonButton.textContent = 'Copia JSON Cuore';
      }, 1200);
    }
  });

  function setDebugUiVisible(visible) {
    debugUiVisible = visible;
    if (debugUi.panel) debugUi.panel.style.display = visible ? 'block' : 'none';
    if (debugUi.overlay) debugUi.overlay.style.display = visible ? 'block' : 'none';
    if (debugUi.toggleButton) debugUi.toggleButton.textContent = visible ? 'Nascondi debug' : 'Mostra debug';
  }

  function buildDebugState() {
    const cameraPos = cameraPivot.getPosition();
    const cameraRot = cameraPivot.getEulerAngles();
    const activeRoomId = manager.getActiveRoom();
    const currentStep = railSequence.getCurrentStep();

    return {
      camera: {
        activeRoom: activeRoomId,
        accordion: activeRoomId >= 0 ? getRoomSequenceLabel(activeRoomId) : 'nessuno',
        step: currentStep?.label ?? 'attesa avvio',
        rail: railSequence.isPaused() ? 'in pausa' : railSequence.hasStarted() ? 'attivo' : 'non avviato',
        position: {
          x: Number(cameraPos.x.toFixed(2)),
          y: Number(cameraPos.y.toFixed(2)),
          z: Number(cameraPos.z.toFixed(2))
        },
        rotation: {
          x: Number(cameraRot.x.toFixed(2)),
          y: Number(cameraRot.y.toFixed(2)),
          z: Number(cameraRot.z.toFixed(2))
        },
        fov: Number(camera.camera.fov.toFixed(2))
      },
      global: {
        ambient: lightRig.ambient,
        key: lightRig.key,
        roomFill: lightRig.roomFill,
        interior: lightRig.interior,
        transition: lightRig.transition,
      cameraFovGlobal: lightRig.cameraFovGlobal,
      performanceMode: performanceState.enabled
      },
      rooms: roomRuntime.map((roomState) => {
        const config = {
          fill: lightRig.rooms[roomState.id].fill,
          interior: lightRig.rooms[roomState.id].interior,
          transition: lightRig.rooms[roomState.id].transition
        };

        if (roomState.id === 0) {
          config.introDoors = lightRig.introDoors;
        }

        if (roomState.id === 9) {
          config.heartCore = lightRig.heartCore;
          config.fireflies = lightRig.fireflies;
          config.cameraFovHeart = lightRig.cameraFovHeart;
        }

        return {
          id: roomState.id,
          label: getRoomSequenceLabel(roomState.id),
          active: roomState.id === activeRoomId,
          sliders: config,
          live: {
            fill: Number(roomState.softFillLight.light.intensity.toFixed(3)),
            interior: Number(roomState.interiorLight.light.intensity.toFixed(3)),
            transition: Number(roomState.transitionLight.light.intensity.toFixed(3)),
            lights: Object.fromEntries(
              roomState.roomLights.map((light) => [light.name, Number(light.light.intensity.toFixed(3))])
            )
          }
        };
      })
    };
  }

  function updateDebugPanel() {
    const activeRoomId = manager.getActiveRoom();
    const debugState = buildDebugState();
    if (debugUi.nextButton) {
      debugUi.nextButton.disabled = !railSequence.isPaused();
      debugUi.nextButton.style.opacity = railSequence.isPaused() ? '1' : '0.5';
    }

    const jsonText = JSON.stringify(debugState, null, 2);
    debugUi.cameraDebug.textContent = JSON.stringify(debugState.camera, null, 2);
    debugUi.roomsDebug.textContent = JSON.stringify(debugState.rooms, null, 2);
    if (debugUi.room0LightDebug) {
      debugUi.room0LightDebug.textContent = JSON.stringify(getRoom0LightPayload(), null, 2);
    }
    if (debugUi.heartLightDebug) {
      debugUi.heartLightDebug.textContent = JSON.stringify(getHeartRoomLightPayload(), null, 2);
    }
    if (debugUi.overlay) debugUi.overlay.textContent = jsonText;
    updateDebugLightLabels();
  }

  applyPerformanceMode(false);

  function jumpToRoomForDebug(roomId) {
    const targetRoom = roomRuntime.find((roomState) => roomState.id === roomId);
    if (!targetRoom) return;

    if (railSequence.hasStarted() && !railSequence.isPaused()) {
      railSequence.togglePause();
    }

    cameraPivot.setPosition(0, 1.75, targetRoom.room.zCenter + 2.6);
    cameraPivot.setEulerAngles(0, 180, 0);
    manager.onRoomEnter(roomId);

    roomRuntime.forEach((roomState) => {
      const shouldOpen = roomState.id === roomId;
      roomState.doors.forEach((door) => door.setOpen(shouldOpen));
    });
  }

  // ===== SISTEMA DI DEBUG: Modalità editing modelli =====
  const debugMode = {
    active: false,
    selectedEntity: null,
    editableEntities: []
  };

  // Raccogli tutti i modelli editabili
  function collectEditableEntities(entity) {
    if (entity.name && (entity.name.includes('cube') || entity.name.includes('camera') || entity.name.includes('helmet') || entity.name.includes('remains'))) {
      debugMode.editableEntities.push(entity);
    }
    entity.children.forEach(child => collectEditableEntities(child));
  }

  // Raccogli entità dopo che la scena è costruita
  app.root.children.forEach(child => collectEditableEntities(child));

  function printEntityData(entity) {
    const pos = entity.getLocalPosition();
    const euler = entity.getLocalEulerAngles();
    const scale = entity.getLocalScale();
    
    const data = {
      name: entity.name,
      position: `new pc.Vec3(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
      rotation: `new pc.Vec3(${euler.x.toFixed(2)}, ${euler.y.toFixed(2)}, ${euler.z.toFixed(2)})`,
      scale: `new pc.Vec3(${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)})`
    };
    
    console.log(`%c=== ${entity.name} ===`, 'font-weight: bold; color: #0f0;');
    console.log(`Position: ${data.position}`);
    console.log(`Rotation: ${data.rotation}`);
    console.log(`Scale: ${data.scale}`);
    console.log(`Full data:`, data);
  }

  // Listener per il tasto R - attiva/disattiva modalità debug
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'q' && !(debugMode.active && debugMode.selectedEntity)) {
      e.preventDefault();
      setDebugUiVisible(!debugUiVisible);
      return;
    }

    if (e.key.toLowerCase() === 'r') {
      debugMode.active = !debugMode.active;
      console.log(`%c[DEBUG] Modalità editing: ${debugMode.active ? 'ON' : 'OFF'}`, 
        `color: ${debugMode.active ? '#0f0' : '#f00'}; font-weight: bold;`);
      
      if (debugMode.active) {
        console.log('%c[DEBUG] Modelli disponibili:', 'color: #0ff;');
        debugMode.editableEntities.forEach((ent, i) => {
          console.log(`${i}: ${ent.name}`);
        });
        console.log('%c[DEBUG] Comandi:', 'color: #0ff;');
        console.log('  - MOUSE: muovi su modello per selezionare');
        console.log('  - WASD: sposta il modello selezionato');
        console.log('  - FRECCE: ruota il modello selezionato');
        console.log('  - Q/E: scala il modello selezionato');
        console.log('  - O: stampa dati in console');
        console.log('  - R: disattiva modalità editing');
      }
    }
    
    if (debugMode.active && debugMode.selectedEntity) {
      const step = 0.1;
      const rotStep = 5;
      const scaleStep = 0.1;
      
      switch(e.key.toLowerCase()) {
        case 'w':
          debugMode.selectedEntity.setLocalPosition(
            debugMode.selectedEntity.getLocalPosition().add(new pc.Vec3(0, step, 0))
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 's':
          debugMode.selectedEntity.setLocalPosition(
            debugMode.selectedEntity.getLocalPosition().add(new pc.Vec3(0, -step, 0))
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 'a':
          debugMode.selectedEntity.setLocalPosition(
            debugMode.selectedEntity.getLocalPosition().add(new pc.Vec3(-step, 0, 0))
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 'd':
          debugMode.selectedEntity.setLocalPosition(
            debugMode.selectedEntity.getLocalPosition().add(new pc.Vec3(step, 0, 0))
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 'arrowup':
          debugMode.selectedEntity.rotate(rotStep, 0, 0);
          printEntityData(debugMode.selectedEntity);
          break;
        case 'arrowdown':
          debugMode.selectedEntity.rotate(-rotStep, 0, 0);
          printEntityData(debugMode.selectedEntity);
          break;
        case 'arrowleft':
          debugMode.selectedEntity.rotate(0, rotStep, 0);
          printEntityData(debugMode.selectedEntity);
          break;
        case 'arrowright':
          debugMode.selectedEntity.rotate(0, -rotStep, 0);
          printEntityData(debugMode.selectedEntity);
          break;
        case 'q':
          const scale = debugMode.selectedEntity.getLocalScale();
          debugMode.selectedEntity.setLocalScale(
            new pc.Vec3(scale.x + scaleStep, scale.y + scaleStep, scale.z + scaleStep)
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 'e':
          const scale2 = debugMode.selectedEntity.getLocalScale();
          debugMode.selectedEntity.setLocalScale(
            new pc.Vec3(Math.max(0.1, scale2.x - scaleStep), 
                       Math.max(0.1, scale2.y - scaleStep), 
                       Math.max(0.1, scale2.z - scaleStep))
          );
          printEntityData(debugMode.selectedEntity);
          break;
        case 'o':
          if (debugMode.selectedEntity) {
            printEntityData(debugMode.selectedEntity);
          }
          break;
      }
    }
  });

  // Raycast per selezionare modelli
  const rayOrigin = new pc.Vec3();
  const rayTarget = new pc.Vec3();
  const rayDirection = new pc.Vec3();
  const rayEnd = new pc.Vec3();
  app.on('update', (dt) => {
    playerController.update(dt);
    manager.update(cameraPivot.getPosition(), dt);

    const activeRoom = manager.getActiveRoom();
    // if (activeRoom === 1 && rooms[1].helmet) {
    //   rooms[1].helmet.rotate(0, 30 * dt, 0);
    // }

    railSequence.update(dt);
    updateDebugPanel();

    // Sistema debug: seleziona modello con mouse
    if (debugMode.active) {
      const canvas = document.getElementById('app');
      const rect = canvas.getBoundingClientRect();
      const clientX = event?.clientX ?? rect.left + rect.width * 0.5;
      const clientY = event?.clientY ?? rect.top + rect.height * 0.5;
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      camera.camera.screenToWorld(mouseX, mouseY, camera.camera.nearClip, rayOrigin);
      camera.camera.screenToWorld(mouseX, mouseY, camera.camera.farClip, rayTarget);
      rayDirection.sub2(rayTarget, rayOrigin).normalize();
      rayEnd.copy(rayOrigin).add(rayDirection.clone().mulScalar(camera.camera.farClip));
      
      const rigidbodySystem = app.systems.rigidbody;
      const result = rigidbodySystem?.raycastFirst ? rigidbodySystem.raycastFirst(rayOrigin, rayEnd) : null;

      if (result) {
        const entity = result.entity;
        if (debugMode.editableEntities.includes(entity)) {
          debugMode.selectedEntity = entity;
          if (!entity._debugHighlight) {
            entity._originalOpacity = entity.render?.material?.opacity || 1;
            entity._debugHighlight = true;
          }
        }
      } else {
        debugMode.selectedEntity = null;
      }

      // Visual feedback
      debugMode.editableEntities.forEach(ent => {
        if (ent.render && ent.render.material) {
          ent.render.material.opacity = ent === debugMode.selectedEntity ? 0.8 : (ent._originalOpacity || 1);
        }
      });
    }
  });

  warmupRenderableAssets(app.root);
  window.requestAnimationFrame(() => {
    app.renderNextFrame = true;
    window.requestAnimationFrame(() => {
      app.renderNextFrame = true;
      markSceneReady();
    });
  });
}

buildWorld().catch((error) => {
  console.error('Errore inizializzazione scena:', error);
});
