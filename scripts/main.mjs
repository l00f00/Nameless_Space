import { createPlayerController } from './player-controller.mjs';
import { createDoor } from './door-logic.mjs';
import { createTrigger } from './trigger-system.mjs';
import { createExperienceManager } from './experience-manager.mjs';
import { createRailSequence } from './rail-sequence.mjs';

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
  totalAssets = 8; // env texture + 4 textures + 3 models

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
    'Coming soon',
    'Nameless',
    'A Virtual art space curated by Melania Filidei, tech stuff by l00f00'
  ];
  const element = document.getElementById('start-title');
  if (!element) return;

  let lineIndex = 0;
  let charIndex = 0;
  element.textContent = '';

  const typeLine = () => {
    if (lineIndex >= lines.length) return;

    const currentLine = lines[lineIndex];
    if (charIndex < currentLine.length) {
      element.textContent += currentLine.charAt(charIndex);
      charIndex++;
      window.setTimeout(typeLine, lineIndex === 2 ? 24 : 55);
      return;
    }

    lineIndex++;
    charIndex = 0;
    if (lineIndex < lines.length) {
      element.textContent += '\n';
      window.setTimeout(typeLine, 220);
    }
  };

  typeLine();
}

function markSceneReady() {
  sceneInitialized = true;
  updateLoaderProgress();
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
    shadowDistance: 50,
    shadowResolution: isMobile ? 1024 : 2048,
    normalOffsetBias: 0.03,
    shadowBias: 0.2
  });
  directional.setEulerAngles(50, 30, 0);
  app.root.addChild(directional);

  const rooms = [
    createRoom(0, 12, { floorTexture: floorTexture, wallTexture: wallTexture, ceilingTexture: ceilingTexture, doorWidth: 1.82, size: { width: 12, depth: 16 } }), // Stanza zero più grande all'entrata
    createRoom(1, 0, { floorTexture: floorTexture, wallTexture: wallTexture, ceilingTexture: ceilingTexture, doorWidth: 1.82 }),
    createRoom(2, -12, { floorTexture: floorTexture, wallTexture: wallTexture, ceilingTexture: ceilingTexture, doorWidth: 1.82 }),
    createRoom(3, -24, { floorTexture: floorTexture, wallTexture: wallTexture, ceilingTexture: ceilingTexture, doorWidth: 1.82 })
  ];

  // GLB model locale: usato come porta fisica.
  const curtainsGlb = await loadAssetFromUrl('./assets/curtains.glb', 'container');

  // Modelli di test aggiunti dall'utente
  const testModels = {
    camera: await loadAssetFromUrl('./assets/AntiqueCamera.glb', 'container'),
    helmet: await loadAssetFromUrl('./assets/realistic_human_heart.glb', 'container'),
    window: await loadAssetFromUrl('./assets/GlassBrokenWindow.glb', 'container'),
    remains: await loadAssetFromUrl('./assets/remains.glb', 'container'),
  };

  function instantiateModel(asset, position, scale = new pc.Vec3(1, 1, 1), rotation = new pc.Vec3(0, 0, 0)) {
    const entity = asset.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    entity.setPosition(position);
    entity.setLocalScale(scale);
    entity.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
    app.root.addChild(entity);
    return entity;
  }

  function makeTranslucentGrayMaterial() {
    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(0.7, 0.7, 0.7); // Grigio più chiaro
    m.metalness = 0.0;
    m.gloss = 0.3;
    m.opacity = 0.8; // Più luminoso
    m.blendType = pc.BLEND_NORMAL;
    m.alphaTest = 0.0;
    m.useMetalness = true;
    m.update();
    return m;
  }

  const translucentGrayMaterial = makeTranslucentGrayMaterial();
  const fireflyMaterial = new pc.StandardMaterial();
  fireflyMaterial.diffuse = new pc.Color(0.2, 0.02, 0.02);
  fireflyMaterial.emissive = new pc.Color(1.0, 0.12, 0.12);
  fireflyMaterial.emissiveIntensity = 7.5;
  fireflyMaterial.useLighting = false;
  fireflyMaterial.update();
  const sceneEffects = {
    cubesSpinMultiplier: 0.55,
    cubesVisible: 0,
    heartPulseBoost: 0.3,
    heartLightBoost: 0.25,
    heartFireflyVisibility: 0,
    heartFireflySpeed: 0.16,
    orbitLightBoost: 0.35
  };
  const experienceState = {
    room0Cubes: [],
    introDoorLights: [],
    introDoorOccluder: null,
    introOutlineMaterial: null,
    introOutlineEntities: [],
    heartCoreLight: null,
    heartFireflies: []
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
    heartSpotA: 5.02,
    heartSpotB: 4.29,
    heartSpotC: 5.12,
    cameraFovGlobal: 1,
    cameraFovHeart: 2.09,
    rooms: [
      { fill: 1.9, interior: 0.61, transition: 5.44 },
      { fill: 0.5, interior: 8.37, transition: 4.8 },
      { fill: 1, interior: 1, transition: 1 },
      { fill: 1, interior: 1, transition: 1 }
    ]
  };
  const debugUi = {
    panel: document.getElementById('debug-panel'),
    controls: document.getElementById('debug-controls'),
    pauseButton: document.getElementById('pause-rail-btn'),
    nextButton: document.getElementById('next-step-btn'),
    copyButton: document.getElementById('copy-debug-btn'),
    toggleButton: document.getElementById('toggle-debug-btn'),
    overlay: document.getElementById('debug-json-overlay'),
    cameraDebug: document.getElementById('camera-debug'),
    roomsDebug: document.getElementById('rooms-debug'),
    globalAccordion: document.querySelector('details[data-scope="global"]'),
    roomAccordions: Array.from(document.querySelectorAll('.room-accordion details[data-room-id]'))
  };
  let debugUiVisible = false;
  const roomRuntime = [];

  const manager = createExperienceManager(app, lightRig);

  const roomTriggers = [];

  rooms.forEach((room, i) => {
    const doorRoot = new pc.Entity(`door-root-${i}`);
    doorRoot.setPosition(0, 1.2, room.zCenter - 5.85);
    if (i === 0) {
      doorRoot.setPosition(0, -3.4, room.zCenter - 5.85);
    }
    app.root.addChild(doorRoot);
    let managedRoomLights = [];

    const panelHalf = 0.45;
    const doorGap = 0.02;
    const panelWidth = panelHalf * 2;

    const leftCenter = -panelHalf - (doorGap / 2);
    const rightCenter = panelHalf + (doorGap / 2);

    const left = createDoor(app, {
      name: `left-curtain-${i}`,
      containerAsset: curtainsGlb,
      root: doorRoot,
      localPos: new pc.Vec3(leftCenter, 0, 0),
      mode: 'slide',
      openOffset: new pc.Vec3(-1.15, 0, 0),
      color: new pc.Color(0.8, 0.03, 0.03),
      rotation: new pc.Vec3(0, 90, 0),
      localScale: new pc.Vec3(1.2, 1.4, 1.2),
      panelWidth,
      speed: 1.8
    });

    const right = createDoor(app, {
      name: `right-curtain-${i}`,
      containerAsset: curtainsGlb,
      root: doorRoot,
      localPos: new pc.Vec3(rightCenter, 0, 0),
      mode: 'slide',
      openOffset: new pc.Vec3(1.15, 0, 0),
      color: new pc.Color(0.8, 0.03, 0.03),
      rotation: new pc.Vec3(0, -90, 0),
      localScale: new pc.Vec3(1.2, 1.4, 1.2),
      panelWidth,
      speed: 1.8
    });

    // Aggiungi modelli specifici per ogni stanza
    switch (i) {
      // prima stanza
      case 0:
        // Stanza 0: 10 cubi traslucenti grigi distribuiti che ruotano velocemente
        const centerZ = room.zCenter; // Centro della stanza zero (z=12)
        const centerX = 0; // Centro della stanza
        const cubeSpacing = 1.2; // Spazio tra i cubi
        const numCubes = 10;
        const cubes = [];

        for (let j = 0; j < numCubes; j++) {
          const cube = new pc.Entity(`rotating-cube-${i}-${j}`);
          cube.addComponent('render', { type: 'box' });
          cube.setLocalScale(0.8, 0.8, 0.8);
          // Distribuzione circolare
          const angle = (j / numCubes) * Math.PI * 2;
          const radius = 3;
          const x = centerX + radius * Math.cos(angle);
          const z = centerZ + radius * Math.sin(angle);
          const y = 1.5 + Math.sin(j * 0.5) * 0.5; // Variazione altezza
          cube.setPosition(x, y, z);
          cube.render.material = translucentGrayMaterial;
          cube.render.castShadows = true;
          cube.render.receiveShadows = true;
          room.addObject(cube);
          cubes.push(cube);
          experienceState.room0Cubes.push(cube);

          if (j === 0) {
            console.log('%c[CUBES] Configurazione (primo cubo):', 'color: #0f0; font-weight: bold;');
            console.log(`Position[${j}]: new pc.Vec3(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
            console.log("Scale: new pc.Vec3(0.8, 0.8, 0.8)");
            console.log(`(Totale: ${numCubes} cubi distribuiti circolarmente)`);
          }

          // Rotazione automatica veloce in direzioni diverse
          app.on('update', (dt) => {
            cube.enabled = sceneEffects.cubesVisible > 0.5;
            const rotationSpeed = (2.0 + j * 0.3) * sceneEffects.cubesSpinMultiplier; // Velocità variabile
            const rotationAxis = j % 3; // Asse di rotazione diverso
            if (rotationAxis === 0) {
              cube.rotateLocal(rotationSpeed * dt, 0, 0);
            } else if (rotationAxis === 1) {
              cube.rotateLocal(0, rotationSpeed * dt, 0);
            } else {
              cube.rotateLocal(0, 0, rotationSpeed * dt);
            }
          });
        }
        break;

      // seconda stanza
      case 1:
        // Stanza 1: cuore pulsante con sciame di lucciole rosse.
        const heartBasePosition = new pc.Vec3(0, 1.8, room.zCenter - 2.0);
        const heartBaseScale = 0.22;
        const fireflyCount = 50;
        const heart = instantiateModel(
          testModels.helmet,
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

        const heartSpotLightA = new pc.Entity('heart-spot-light-a');
        heartSpotLightA.addComponent('light', {
          type: 'spot',
          color: new pc.Color(1.0, 0.28, 0.24),
          intensity: 1.2,
          innerConeAngle: 22,
          outerConeAngle: 40,
          range: 12,
          castShadows: false
        });
        app.root.addChild(heartSpotLightA);

        const heartSpotLightB = new pc.Entity('heart-spot-light-b');
        heartSpotLightB.addComponent('light', {
          type: 'spot',
          color: new pc.Color(0.9, 0.16, 0.2),
          intensity: 1.0,
          innerConeAngle: 18,
          outerConeAngle: 36,
          range: 11,
          castShadows: false
        });
        app.root.addChild(heartSpotLightB);

        const heartSpotLightC = new pc.Entity('heart-spot-light-c');
        heartSpotLightC.addComponent('light', {
          type: 'spot',
          color: new pc.Color(1.0, 0.1, 0.1),
          intensity: 0.9,
          innerConeAngle: 18,
          outerConeAngle: 34,
          range: 13,
          castShadows: false
        });
        app.root.addChild(heartSpotLightC);

        for (let j = 0; j < fireflyCount; j++) {
          const firefly = new pc.Entity(`heart-firefly-${j}`);
          firefly.addComponent('render', { type: 'sphere' });
          firefly.addComponent('light', {
            type: 'omni',
            color: new pc.Color(1.0, 0.08, 0.08),
            intensity: 0,
            range: 0.9,
            castShadows: false
          });
          firefly.setLocalScale(0.022, 0.022, 0.022);
          firefly.render.material = fireflyMaterial;
          firefly.enabled = false;
          room.addObject(firefly);

          experienceState.heartFireflies.push({
            entity: firefly,
            phase: (j / fireflyCount) * Math.PI * 2,
            radius: 0.75 + (j % 5) * 0.14,
            height: 0.16 + ((j * 17) % 10) * 0.06,
            speed: 0.28 + (j % 7) * 0.045,
            wobble: 0.05 + (j % 4) * 0.018,
            flickerPhase: Math.random() * Math.PI * 2,
            flickerSpeed: 1.3 + (j % 6) * 0.25
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

          heartSpotLightA.setPosition(1.15, heartBasePosition.y + 0.8, room.zCenter - 0.35);
          heartSpotLightA.lookAt(heart.getPosition());
          heartSpotLightA.light.intensity = (0.45 + pulse * 1.1) * lightRig.heartSpotA;

          heartSpotLightB.setPosition(-1.05, heartBasePosition.y + 0.4, room.zCenter - 0.75);
          heartSpotLightB.lookAt(heart.getPosition());
          heartSpotLightB.light.intensity = (0.36 + pulse * 0.9) * lightRig.heartSpotB;

          heartSpotLightC.setPosition(0.0, heartBasePosition.y + 0.55, room.zCenter - 3.25);
          heartSpotLightC.lookAt(heart.getPosition());
          heartSpotLightC.light.intensity = (0.28 + pulse * 0.75) * lightRig.heartSpotC;

          experienceState.heartFireflies.forEach((firefly, index) => {
            const speed = (0.06 + sceneEffects.heartFireflySpeed) * firefly.speed;
            const orbit = timeSeconds * speed + firefly.phase;
            const radius = firefly.radius + Math.sin(orbit * 1.4 + index) * 0.08;
            const x = heartBasePosition.x + Math.cos(orbit) * radius;
            const z = heartBasePosition.z + Math.sin(orbit * 1.15) * (radius * 0.72);
            const y = heartBasePosition.y + firefly.height + Math.sin(orbit * 2.1) * firefly.wobble;
            const flicker = 0.72 + 0.28 * (Math.sin(timeSeconds * firefly.flickerSpeed + firefly.flickerPhase) * 0.5 + 0.5);
            firefly.entity.enabled = sceneEffects.heartFireflyVisibility > 0.05;
            firefly.entity.setPosition(x, y, z);
            firefly.entity.light.intensity = sceneEffects.heartFireflyVisibility * (0.045 + pulse * 0.04) * flicker * lightRig.fireflies;
            firefly.entity.light.range = 0.48 + sceneEffects.heartFireflyVisibility * (0.16 + 0.08 * flicker);
          });
        });
        break;

      // terza stanza
      case 2:
        // Stanza 2: camera antica sospesa nel buio.
        const cameraModel = instantiateModel(testModels.camera, new pc.Vec3(-1.5, 0.25, room.zCenter - 2.5), new pc.Vec3(0.25, 0.25, 0.25), new pc.Vec3(0, 35, 0));
        room.addObject(cameraModel);
        app.on('update', (dt) => {
          cameraModel.rotateLocal(0, 10 * dt, 0);
        });
        break;

      // quarta stanza
      case 3:
        // Stanza 3: Remains (modello principale più piccolo) più basso sul pavimento e più verso sinistra, con luci orbitanti ellittiche
        const remains = instantiateModel(testModels.remains, new pc.Vec3(-2, 0.1, room.zCenter - 3), new pc.Vec3(0.5, 0.5, 0.5), new pc.Vec3(-90, 0, 0));
        room.addObject(remains);
        console.log('%c[REMAINS] Configurazione:', 'color: #ff0; font-weight: bold;');
        console.log("Position: new pc.Vec3(-2, 0.1, room.zCenter - 3)");
        console.log("Scale: new pc.Vec3(0.5, 0.5, 0.5)");
        console.log("Rotation: new pc.Vec3(-90, 0, 0)");
        console.log('%c[REMAINS] Posizione attuale:', 'color: #ff0; font-weight: bold;');
        console.log(remains.getPosition());

        // Disabilita le luci del modello GLB stesso
        function disableLightsRecursive(entity) {
          if (entity.light) {
            entity.light.enabled = false;
          }
          entity.children.forEach(child => disableLightsRecursive(child));
        }
        disableLightsRecursive(remains);

        // Funzione globale per ruotare remains da console
        window.rotateRemains = (x = 0, y = 0, z = 0) => {
          const currentRotation = remains.getLocalEulerAngles();
          remains.setLocalEulerAngles(currentRotation.x + x, currentRotation.y + y, currentRotation.z + z);
          const newRotation = remains.getLocalEulerAngles();
          console.log(`%c[REMAINS] Rotazione aggiornata:`, 'color: #ff0; font-weight: bold;');
          console.log(`new pc.Vec3(${newRotation.x.toFixed(2)}, ${newRotation.y.toFixed(2)}, ${newRotation.z.toFixed(2)})`);
        };

        // Funzione per settare rotazione assoluta
        window.setRemainsRotation = (x, y, z) => {
          remains.setLocalEulerAngles(x, y, z);
          const newRotation = remains.getLocalEulerAngles();
          console.log(`%c[REMAINS] Rotazione settata a:`, 'color: #ff0; font-weight: bold;');
          console.log(`new pc.Vec3(${newRotation.x.toFixed(2)}, ${newRotation.y.toFixed(2)}, ${newRotation.z.toFixed(2)})`);
        };

        console.log('%c[CONSOLE] Comandi disponibili:', 'color: #0ff; font-weight: bold;');
        console.log('rotateRemains(x, y, z) - Ruota di X gradi su ogni asse');
        console.log('setRemainsRotation(x, y, z) - Setta rotazione assoluta');

        // 5 piccole luci bianche che orbitano ellitticamente al centro
        const orbitingLights = [];
        for (let j = 0; j < 5; j++) {
          const light = new pc.Entity(`orbit-light-${i}-${j}`);
          light.addComponent('light', {
            type: 'omni',
            color: new pc.Color(1.0, 1.0, 1.0), // Bianco
            intensity: 0.3, // Piccole luci
            range: 4,
            castShadows: false
          });
          // Posizione iniziale ellittica
          const angle = (j / 5) * Math.PI * 2;
          const ellipseX = 1.5 * Math.cos(angle);
          const ellipseZ = 0.8 * Math.sin(angle);
          light.setPosition(ellipseX, 1.5, room.zCenter - 3 + ellipseZ);
          app.root.addChild(light);
          orbitingLights.push(light);
        }

        // Animazione orbitale ellittica
        app.on('update', (dt) => {
          orbitingLights.forEach((light, j) => {
            const speed = 2000 - sceneEffects.orbitLightBoost * 650;
            const time = performance.now() / speed + j * Math.PI / 2.5; // Velocità diversa per ogni luce
            const ellipseX = 1.5 * Math.cos(time);
            const ellipseZ = 0.8 * Math.sin(time);
            light.setPosition(ellipseX, 1.5, room.zCenter - 3 + ellipseZ);
            light.light.intensity = 0.15 + sceneEffects.orbitLightBoost * 0.45;
            light.light.range = 3.3 + sceneEffects.orbitLightBoost * 1.2;
          });
        });
        break;
    }

    // Luci specifiche per stanza
    if (i === 0) {
      // Prima stanza: nessuna luce ambiente dedicata, si vedono solo le porte.
    } else if (i === 1) {
      // Seconda stanza: niente luce di stanza, solo cuore e lucciole.
    } else if (i === 2) {
      // Terza stanza: poco illuminata, solo le luci orbitanti
      // Rimossa la luce emissiva precedente
    }

    const softFillLight = new pc.Entity(`soft-fill-light-${i}`);
    softFillLight.addComponent('light', {
      type: 'omni',
      color: i === 1 ? new pc.Color(0.42, 0.12, 0.12) : new pc.Color(0.24, 0.24, 0.28),
      intensity: 0,
      range: i === 0 ? 7.5 : 6.5,
      castShadows: false
    });
    softFillLight.setPosition(0, 1.85, room.zCenter - 2.8);
    app.root.addChild(softFillLight);
    managedRoomLights.push(softFillLight);

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

    // Luce di transizione per far intravedere il nuovo spazio
    const transitionLight = new pc.Entity(`transition-light-${i}`);
    transitionLight.addComponent('light', {
      type: 'spot',
      color: new pc.Color(0.8, 0.8, 1.0),
      intensity: 0,
      innerConeAngle: 45,
      outerConeAngle: 60,
      range: 15,
      castShadows: false
    });
    transitionLight.setPosition(0, 3, room.zCenter - 2);
    transitionLight.setEulerAngles(90, 0, 0);
    app.root.addChild(transitionLight);

    manager.addRoom({
      id: i,
      zCenter: room.zCenter,
      doors: [left, right],
      interiorLight,
      transitionLight,
      lowLight: i === 1,
      disableBaseLights: false,
      roomLights: managedRoomLights
    });

    roomRuntime.push({
      id: i,
      room,
      doorRoot,
      doors: [left, right],
      softFillLight,
      interiorLight,
      transitionLight,
      roomLights: managedRoomLights
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

  const roomZeroRuntime = roomRuntime[0];
  const heartRoomRuntime = roomRuntime[1];
  const introDoorHiddenY = -5.8;
  const introDoorVisibleY = 1.2;

  const leftDoorLight = new pc.Entity('intro-door-light-left');
  leftDoorLight.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1.0, 0.32, 0.18),
    intensity: 0,
    range: 5.5,
    castShadows: false
  });
  leftDoorLight.setPosition(-1.2, 1.7, 6.35);
  app.root.addChild(leftDoorLight);
  experienceState.introDoorLights.push(leftDoorLight);

  const rightDoorLight = new pc.Entity('intro-door-light-right');
  rightDoorLight.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1.0, 0.32, 0.18),
    intensity: 0,
    range: 5.5,
    castShadows: false
  });
  rightDoorLight.setPosition(1.2, 1.7, 6.35);
  app.root.addChild(rightDoorLight);
  experienceState.introDoorLights.push(rightDoorLight);

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

  function getHeartSpotLiveState() {
    return {
      heartSpotA: Number(app.root.findByName('heart-spot-light-a')?.light?.intensity ?? 0),
      heartSpotB: Number(app.root.findByName('heart-spot-light-b')?.light?.intensity ?? 0),
      heartSpotC: Number(app.root.findByName('heart-spot-light-c')?.light?.intensity ?? 0)
    };
  }

  function applyPreStartLightPreview() {
    if (railSequence.hasStarted()) return;

    ambient.light.intensity = 0.08 * lightRig.ambient;
    directional.light.intensity = 0.11 * lightRig.key;

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
    const room1Rig = getRoomRig(1);
    ambient.light.intensity = 0.001 * lightRig.ambient;
    directional.light.intensity = 0.0035 * lightRig.key;
    roomZeroRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room0Rig.interior;
    roomZeroRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room0Rig.transition;
    setLightGroupIntensity(roomZeroRuntime.roomLights, 0);
    experienceState.introDoorLights.forEach((light) => {
      light.light.intensity = 0 * lightRig.introDoors;
    });

    heartRoomRuntime.interiorLight.light.intensity = (0.04 + glow * 0.12) * lightRig.interior * room1Rig.interior;
    heartRoomRuntime.transitionLight.light.intensity = (0.02 + glow * 0.07) * lightRig.transition * room1Rig.transition;
    setLightGroupIntensity(
      heartRoomRuntime.roomLights.filter((light) => light.name !== 'red-light'),
      (0.02 + glow * 0.08) * lightRig.roomFill * room1Rig.fill
    );

    sceneEffects.cubesVisible = 0;
    sceneEffects.cubesSpinMultiplier = 0.08;
    sceneEffects.heartPulseBoost = 0.65 + glow * 0.55;
    sceneEffects.heartLightBoost = 0.2 + glow * 0.22;
    sceneEffects.heartFireflyVisibility = glow;
    sceneEffects.heartFireflySpeed = 0.1 + glow * 0.12;
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
    position: new pc.Vec3(0, 1.75, 14.6),
    lookAt: new pc.Vec3(0, 1.7, 6.15),
    dwell: 3.8,
    moveSmoothing: 3.4,
    lookSmoothing: 4.5,
    onEnter: () => {
      const room0Rig = getRoomRig(0);
      const room1Rig = getRoomRig(1);
      sceneEffects.cubesVisible = 0;
      sceneEffects.cubesSpinMultiplier = 0.05;
      sceneEffects.heartFireflyVisibility = 0;
      sceneEffects.heartFireflySpeed = 0.08;
      ambient.light.intensity = 0 * lightRig.ambient;
      directional.light.intensity = 0 * lightRig.key;
      camera.camera.fov = getAdjustedFov(52);
      roomZeroRuntime.room.structureEntities.forEach((entity) => { entity.enabled = true; });
      experienceState.introOutlineEntities.forEach((entity) => { entity.enabled = true; });
      experienceState.introOutlineMaterial.emissiveIntensity = 0.035;
      roomZeroRuntime.doorRoot.setPosition(0, introDoorHiddenY, roomZeroRuntime.room.zCenter - 5.85);
      roomZeroRuntime.doors.forEach((door) => door.setOpen(false));
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
    },
    onUpdate: ({ elapsed }) => {
      const room0Rig = getRoomRig(0);
      const reveal = easeInOut01(elapsed / 2.0);
      const doorRise = easeInOut01(Math.max(0, elapsed - 0.85) / 1.1);
      roomZeroRuntime.doorRoot.setPosition(
        0,
        introDoorHiddenY + (introDoorVisibleY - introDoorHiddenY) * doorRise,
        roomZeroRuntime.room.zCenter - 5.85
      );
      ambient.light.intensity = 0.01 * lightRig.ambient * reveal;
      directional.light.intensity = 0.015 * lightRig.key * reveal;
      roomZeroRuntime.interiorLight.light.intensity = 0.06 * lightRig.interior * room0Rig.interior * reveal;
      roomZeroRuntime.transitionLight.light.intensity = 0.06 * lightRig.transition * room0Rig.transition * reveal;
      setLightGroupIntensity(roomZeroRuntime.roomLights, 0.04 * lightRig.roomFill * room0Rig.fill * reveal);
      experienceState.introOutlineMaterial.emissiveIntensity = 0.028 + reveal * 0.035;
      experienceState.introDoorLights.forEach((light) => {
        light.light.intensity = reveal * 0.12 * lightRig.introDoors;
        light.light.range = 0.9 + reveal * 1.2;
      });
      sceneEffects.cubesVisible = 0;
      experienceState.introDoorOccluder.enabled = reveal < 0.68;
      if (reveal > 0.72) {
        roomZeroRuntime.doors.forEach((door) => door.setOpen(true));
      }
    }
  });

  // seconda stanza
  railSequence.addStep({
    label: 'Tunnel',
    roomId: 1,
    position: new pc.Vec3(0, 1.62, 1.55),
    lookAt: new pc.Vec3(0, 1.2, -2.2),
    dwell: 0.45,
    moveSmoothing: 15.0,
    lookSmoothing: 7.2,
    onEnter: () => {
      roomZeroRuntime.room.structureEntities.forEach((entity) => { entity.enabled = false; });
      roomZeroRuntime.doors.forEach((door) => door.setOpen(true));
      heartRoomRuntime.doors.forEach((door) => door.setOpen(true));
      experienceState.introDoorOccluder.enabled = false;
    },
    onUpdate: ({ elapsed, movementProgress }) => {
      const room0Rig = getRoomRig(0);
      const room1Rig = getRoomRig(1);
      const rush = easeInOut01(Math.max(elapsed, movementProgress * 1.4));
      camera.camera.fov = getAdjustedFov(52 + rush * 34);
      ambient.light.intensity = (0.0008 + rush * 0.0012) * lightRig.ambient;
      directional.light.intensity = 0.003 * lightRig.key;
      roomZeroRuntime.interiorLight.light.intensity = 0 * lightRig.interior * room0Rig.interior;
      roomZeroRuntime.transitionLight.light.intensity = 0 * lightRig.transition * room0Rig.transition;
      setLightGroupIntensity(roomZeroRuntime.roomLights, 0);
      experienceState.introDoorLights.forEach((light) => {
        light.light.intensity = (0.12 - rush * 0.09) * lightRig.introDoors;
      });
      heartRoomRuntime.transitionLight.light.intensity = (0.02 + rush * 0.08) * lightRig.transition * room1Rig.transition;
      sceneEffects.heartFireflyVisibility = 0.16 + rush * 0.46;
      sceneEffects.heartFireflySpeed = 0.08 + rush * 0.1;
      sceneEffects.heartLightBoost = 0.16 + rush * 0.14;
    }
  });

  // terza stanza
  railSequence.addStep({
    label: 'Cuore',
    roomId: 1,
    position: new pc.Vec3(0.0, 1.58, 0.12),
    lookAt: new pc.Vec3(0, 1.24, -2.0),
    dwell: 999,
    autoAdvance: false,
    onUpdate: ({ elapsed, step }) => {
      const orbitSpeed = 0.18;
      const orbitAngle = elapsed * orbitSpeed;
      const orbitCenter = new pc.Vec3(0, 1.84, -2.0);

      let focusOffset = new pc.Vec3(0, 0.02, 0);
      let targetFov = 57;
      let orbitRadius = 2.2;
      let orbitHeight = 1.55;

      if (elapsed > 4 && elapsed <= 8) {
        focusOffset = new pc.Vec3(0.18, 0.12, 0.04);
        targetFov = 45;
        orbitRadius = 1.75;
        orbitHeight = 1.82;
      } else if (elapsed > 8 && elapsed <= 12) {
        focusOffset = new pc.Vec3(-0.14, -0.08, -0.03);
        targetFov = 42;
        orbitRadius = 1.6;
        orbitHeight = 1.38;
      } else if (elapsed > 12) {
        focusOffset = new pc.Vec3(0.05, 0.22, 0.02);
        targetFov = 48;
        orbitRadius = 1.9;
        orbitHeight = 1.95;
      }

      step.position.set(
        orbitCenter.x + Math.cos(orbitAngle) * orbitRadius,
        orbitHeight + Math.sin(orbitAngle * 0.7) * 0.06,
        orbitCenter.z + Math.sin(orbitAngle) * orbitRadius
      );
      step.lookAt.set(
        orbitCenter.x + focusOffset.x,
        orbitCenter.y + focusOffset.y,
        orbitCenter.z + focusOffset.z
      );

      camera.camera.fov = pc.math.lerp(camera.camera.fov, getHeartSceneFov(targetFov), 0.06);
      setHeartRoomMood(elapsed + 1.5);
      sceneEffects.heartFireflyVisibility = 0.9;
    }
  });

  const sliderBindings = [
    ['ambient-slider', 'ambient-value', 'ambient'],
    ['key-slider', 'key-value', 'key'],
    ['fill-slider', 'fill-value', 'roomFill'],
    ['interior-slider', 'interior-value', 'interior'],
    ['transition-slider', 'transition-value', 'transition'],
    ['heart-slider', 'heart-value', 'heartCore'],
    ['firefly-slider', 'firefly-value', 'fireflies'],
    ['door-slider', 'door-value', 'introDoors'],
    ['heart-spot-a-slider', 'heart-spot-a-value', 'heartSpotA'],
    ['heart-spot-b-slider', 'heart-spot-b-value', 'heartSpotB'],
    ['heart-spot-c-slider', 'heart-spot-c-value', 'heartSpotC'],
    ['camera-fov-global-slider', 'camera-fov-global-value', 'cameraFovGlobal'],
    ['camera-fov-heart-slider', 'camera-fov-heart-value', 'cameraFovHeart']
  ];
  const roomSliderBindings = [];
  for (let roomId = 0; roomId < 4; roomId++) {
    roomSliderBindings.push(
      [`room-${roomId}-fill-slider`, `room-${roomId}-fill-value`, roomId, 'fill'],
      [`room-${roomId}-interior-slider`, `room-${roomId}-interior-value`, roomId, 'interior'],
      [`room-${roomId}-transition-slider`, `room-${roomId}-transition-value`, roomId, 'transition']
    );
  }

  sliderBindings.forEach(([sliderId, valueId, key]) => {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    if (!slider || !value) return;

    const syncValue = () => {
      lightRig[key] = Number(slider.value);
      value.textContent = Number(slider.value).toFixed(2);
    };

    slider.addEventListener('input', syncValue);
    syncValue();
  });

  roomSliderBindings.forEach(([sliderId, valueId, roomId, key]) => {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    if (!slider || !value) return;

    const syncValue = () => {
      lightRig.rooms[roomId][key] = Number(slider.value);
      value.textContent = Number(slider.value).toFixed(2);
    };

    slider.addEventListener('input', syncValue);
    syncValue();
  });

  debugUi.pauseButton?.addEventListener('click', () => {
    const paused = railSequence.togglePause();
    debugUi.pauseButton.textContent = paused ? 'Riprendi percorso' : 'Pausa percorso';
  });

  debugUi.nextButton?.addEventListener('click', () => {
    if (!railSequence.isPaused()) return;
    railSequence.goNext();
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

  function formatVec3(vec) {
    return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
  }

  function syncActiveAccordion(activeRoomId) {
    debugUi.roomAccordions.forEach((accordion) => {
      const roomId = Number(accordion.dataset.roomId);
      accordion.open = roomId === activeRoomId;
    });
  }

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
    const heartSpots = getHeartSpotLiveState();

    return {
      camera: {
        activeRoom: activeRoomId,
        accordion: activeRoomId >= 0 ? `Stanza ${activeRoomId}` : 'nessuno',
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
      accordions: {
        globalOpen: Boolean(debugUi.globalAccordion?.open),
        roomOpen: debugUi.roomAccordions
          .filter((accordion) => accordion.open)
          .map((accordion) => Number(accordion.dataset.roomId))
      },
      global: {
        ambient: lightRig.ambient,
        key: lightRig.key,
        roomFill: lightRig.roomFill,
        interior: lightRig.interior,
        transition: lightRig.transition,
        cameraFovGlobal: lightRig.cameraFovGlobal
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

        if (roomState.id === 1) {
          config.heartCore = lightRig.heartCore;
          config.fireflies = lightRig.fireflies;
          config.heartSpotA = lightRig.heartSpotA;
          config.heartSpotB = lightRig.heartSpotB;
          config.heartSpotC = lightRig.heartSpotC;
          config.cameraFovHeart = lightRig.cameraFovHeart;
        }

        return {
          id: roomState.id,
          label: `Stanza ${roomState.id}`,
          active: roomState.id === activeRoomId,
          accordionOpen: debugUi.roomAccordions.find((accordion) => Number(accordion.dataset.roomId) === roomState.id)?.open ?? false,
          sliders: config,
          live: {
            fill: Number(roomState.softFillLight.light.intensity.toFixed(3)),
            interior: Number(roomState.interiorLight.light.intensity.toFixed(3)),
            transition: Number(roomState.transitionLight.light.intensity.toFixed(3)),
            lights: Object.fromEntries(
              roomState.roomLights.map((light) => [light.name, Number(light.light.intensity.toFixed(3))])
            ),
            heartSpots: roomState.id === 1 ? Object.fromEntries(
              Object.entries(heartSpots).map(([key, value]) => [key, Number(value.toFixed(3))])
            ) : undefined
          }
        };
      })
    };
  }

  function updateDebugPanel() {
    const activeRoomId = manager.getActiveRoom();
    const debugState = buildDebugState();

    syncActiveAccordion(activeRoomId);
    if (debugUi.nextButton) {
      debugUi.nextButton.disabled = !railSequence.isPaused();
      debugUi.nextButton.style.opacity = railSequence.isPaused() ? '1' : '0.5';
    }

    const jsonText = JSON.stringify(debugState, null, 2);
    debugUi.cameraDebug.textContent = JSON.stringify(debugState.camera, null, 2);
    debugUi.roomsDebug.textContent = JSON.stringify(debugState.rooms, null, 2);
    if (debugUi.overlay) debugUi.overlay.textContent = jsonText;
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
  const raycaster = new pc.RaycastResult();
  app.on('update', (dt) => {
    playerController.update(dt);
    manager.update(cameraPivot.getPosition(), dt);

    const activeRoom = manager.getActiveRoom();
    // if (activeRoom === 1 && rooms[1].helmet) {
    //   rooms[1].helmet.rotate(0, 30 * dt, 0);
    // }

    roomTriggers.forEach((trigger) => trigger.update(cameraPivot.getPosition()));
    railSequence.update(dt);
    updateDebugPanel();

    // Sistema debug: seleziona modello con mouse
    if (debugMode.active) {
      const canvas = document.getElementById('app');
      const rect = canvas.getBoundingClientRect();
      const mouseX = (event?.clientX - rect.left || 0) / canvas.width * 2 - 1;
      const mouseY = (event?.clientY - rect.top || 0) / canvas.height * -2 + 1;

      const ray = camera.camera.getRay(mouseX, mouseY);
      
      const result = app.systems.rigidbody.raycastFirst(ray.origin, ray.direction, { 
        filterGroup: undefined,
        filterMask: undefined
      });

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

  markSceneReady();
}

buildWorld().catch((error) => {
  console.error('Errore inizializzazione scena:', error);
});
