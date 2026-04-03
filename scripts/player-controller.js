/**
 * First person controller modulare:
 * - Desktop: WASD + mouse lock
 * - Mobile: dual touch zones
 * - WebXR: pulsante Enter VR + locomotion da gamepad thumbstick
 */
export function createPlayerController(app, pivot, camera, ui) {
  const state = {
    speed: 4.2,
    sprintSpeed: 6.8,
    yaw: 0,
    pitch: 0,
    lookSensitivity: 0.14,
    touchLookSensitivity: 0.09,
    moveInput: { x: 0, z: 0 },
    lookInput: { x: 0, y: 0 },
    xrActive: false
  };

  const keys = { forward: false, backward: false, left: false, right: false, sprint: false };

  const onMouseMove = (e) => {
    if (document.pointerLockElement !== app.graphicsDevice.canvas || state.xrActive) return;
    state.yaw -= e.movementX * state.lookSensitivity;
    state.pitch = pc.math.clamp(state.pitch - e.movementY * state.lookSensitivity, -80, 80);
  };

  app.graphicsDevice.canvas.addEventListener('click', () => {
    if (!state.xrActive) app.graphicsDevice.canvas.requestPointerLock();
  });
  window.addEventListener('mousemove', onMouseMove);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') keys.forward = true;
    if (e.code === 'KeyS') keys.backward = true;
    if (e.code === 'KeyA') keys.left = true;
    if (e.code === 'KeyD') keys.right = true;
    if (e.code === 'ShiftLeft') keys.sprint = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.forward = false;
    if (e.code === 'KeyS') keys.backward = false;
    if (e.code === 'KeyA') keys.left = false;
    if (e.code === 'KeyD') keys.right = false;
    if (e.code === 'ShiftLeft') keys.sprint = false;
  });

  setupTouch(ui.moveZone, ui.lookZone, state);
  setupXr(app, camera, ui.xrButton, state);

  function update(dt) {
    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + state.moveInput.x;
    const inputZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) + state.moveInput.z;

    const speed = keys.sprint ? state.sprintSpeed : state.speed;
    const forward = pivot.forward.clone().mulScalar(inputZ * speed * dt);
    const right = pivot.right.clone().mulScalar(inputX * speed * dt);

    // Lock movimento sul piano orizzontale.
    forward.y = 0;
    right.y = 0;

    const position = pivot.getPosition().clone().add(forward).add(right);
    pivot.setPosition(position);

    if (!state.xrActive) {
      state.yaw -= state.lookInput.x * state.touchLookSensitivity;
      state.pitch = pc.math.clamp(state.pitch - state.lookInput.y * state.touchLookSensitivity, -80, 80);
      pivot.setEulerAngles(0, state.yaw, 0);
      camera.setLocalEulerAngles(state.pitch, 0, 0);
    }

    updateXrLocomotion(app, pivot, state, dt);
  }

  return { update };
}

function setupTouch(moveZone, lookZone, state) {
  const touches = {
    move: { id: null, startX: 0, startY: 0 },
    look: { id: null, x: 0, y: 0 }
  };

  const begin = (target, slot, e) => {
    const t = e.changedTouches[0];
    slot.id = t.identifier;
    slot.startX = t.clientX;
    slot.startY = t.clientY;
    if (target === 'look') {
      touches.look.x = 0;
      touches.look.y = 0;
    }
  };

  moveZone.addEventListener('touchstart', (e) => begin('move', touches.move, e), { passive: false });
  lookZone.addEventListener('touchstart', (e) => begin('look', touches.look, e), { passive: false });

  window.addEventListener(
    'touchmove',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touches.move.id) {
          const dx = (t.clientX - touches.move.startX) / 56;
          const dy = (t.clientY - touches.move.startY) / 56;
          state.moveInput.x = pc.math.clamp(dx, -1, 1);
          state.moveInput.z = pc.math.clamp(-dy, -1, 1);
        }
        if (t.identifier === touches.look.id) {
          state.lookInput.x = t.clientX - touches.look.startX;
          state.lookInput.y = t.clientY - touches.look.startY;
          touches.look.startX = t.clientX;
          touches.look.startY = t.clientY;
        }
      }
      e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touches.move.id) {
        touches.move.id = null;
        state.moveInput.x = 0;
        state.moveInput.z = 0;
      }
      if (t.identifier === touches.look.id) {
        touches.look.id = null;
        state.lookInput.x = 0;
        state.lookInput.y = 0;
      }
    }
  });
}

function setupXr(app, camera, xrButton, state) {
  if (!app.xr) {
    xrButton.disabled = true;
    xrButton.textContent = 'WebXR non disponibile';
    return;
  }

  app.xr.on('start', () => {
    state.xrActive = true;
    xrButton.textContent = 'Exit WebXR';
  });

  app.xr.on('end', () => {
    state.xrActive = false;
    xrButton.textContent = 'Enter WebXR (VR)';
  });

  xrButton.addEventListener('click', () => {
    if (state.xrActive) {
      app.xr.end();
      return;
    }

    if (app.xr.isAvailable(pc.XRTYPE_VR)) {
      camera.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
        optionalFeatures: ['hand-tracking']
      });
    }
  });
}

function updateXrLocomotion(app, pivot, state, dt) {
  if (!state.xrActive || !app.xr.input) return;
  const sources = app.xr.input.inputSources;
  let moveX = 0;
  let moveY = 0;

  for (const src of sources) {
    const pad = src.gamepad;
    if (!pad || pad.axes.length < 2) continue;
    moveX += pad.axes[2] ?? pad.axes[0] ?? 0;
    moveY += pad.axes[3] ?? pad.axes[1] ?? 0;
  }

  const forward = pivot.forward.clone().mulScalar(-moveY * state.speed * dt);
  const right = pivot.right.clone().mulScalar(moveX * state.speed * dt);
  forward.y = 0;
  right.y = 0;
  pivot.setPosition(pivot.getPosition().clone().add(forward).add(right));
}
