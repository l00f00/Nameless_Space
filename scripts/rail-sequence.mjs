/**
 * Sequenza su binario: avanza o torna indietro tra waypoint predefiniti.
 */
export function createRailSequence({ pivot, playerController, manager, statusElement, onStart }) {
  const steps = [];
  const tempPosition = new pc.Vec3();
  let fallbackPitch = 0;
  const state = {
    started: false,
    active: false,
    paused: false,
    currentIndex: -1,
    currentStep: null,
    currentYaw: 0,
    currentPitch: 0,
    stepElapsed: 0,
    holdElapsed: 0,
    reachedTarget: false,
    segmentDistance: 0.001,
    moveSmoothing: 3.6,
    lookSmoothing: 5.2
  };

  function updateStatus() {
    if (!statusElement) return;

    if (!state.started) {
      statusElement.style.display = 'flex';
      statusElement.textContent = 'Premi SPAZIO per iniziare';
      return;
    }

    if (state.paused) {
      statusElement.style.display = 'flex';
      statusElement.textContent = 'Percorso in pausa';
      return;
    }

    statusElement.style.display = 'none';
  }

  function computeAngles(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const flatDistance = Math.max(Math.sqrt(dx * dx + dz * dz), 0.0001);

    return {
      yaw: Math.atan2(-dx, -dz) * pc.math.RAD_TO_DEG,
      pitch: -Math.atan2(dy, flatDistance) * pc.math.RAD_TO_DEG
    };
  }

  function shortestAngleDelta(from, to) {
    let delta = (to - from) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }

  function moveToStep(step, immediate = false) {
    state.currentStep?.onExit?.();
    state.currentStep = step;
    state.stepElapsed = 0;
    state.holdElapsed = 0;
    state.reachedTarget = false;

    if (!step) {
      state.active = false;
      updateStatus();
      return;
    }

    if (typeof step.roomId === 'number') {
      manager.onRoomEnter(step.roomId);
    }

    state.segmentDistance = Math.max(pivot.getPosition().distance(step.position), 0.001);
    if (typeof step.moveSmoothing === 'number') {
      state.moveSmoothing = step.moveSmoothing;
    }
    if (typeof step.lookSmoothing === 'number') {
      state.lookSmoothing = step.lookSmoothing;
    }

    if (immediate) {
      pivot.setPosition(step.position);
      const immediateAngles = computeAngles(step.position, step.lookAt);
      state.currentYaw = immediateAngles.yaw;
      state.currentPitch = immediateAngles.pitch;
      state.reachedTarget = true;
      applyView(immediateAngles.yaw, immediateAngles.pitch);
    }

    step.onEnter?.();
    updateStatus();
  }

  function goTo(index, immediate = false) {
    if (!steps.length) return false;
    const clampedIndex = pc.math.clamp(index, 0, steps.length - 1);
    if (clampedIndex === state.currentIndex && state.currentStep) return false;

    state.currentIndex = clampedIndex;
    moveToStep(steps[state.currentIndex], immediate);
    return true;
  }

  function goNext() {
    return goTo(state.currentIndex + 1);
  }

  function goPrevious() {
    return goTo(state.currentIndex - 1);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!state.started && !event.repeat) {
        start(0);
      }
    }

    if (event.code === 'KeyP' && !event.repeat && state.started) {
      event.preventDefault();
      state.paused = !state.paused;
      updateStatus();
    }
  });

  function addStep(step) {
    steps.push({
      ...step,
      position: step.position.clone(),
      lookAt: step.lookAt.clone()
    });
  }

  function start(index = 0) {
    if (!steps.length) return;
    state.started = true;
    state.active = true;
    if (typeof playerController?.setEnabled === 'function') {
      playerController.setEnabled(false);
    }
    onStart?.();
    state.currentIndex = pc.math.clamp(index, 0, steps.length - 1);
    moveToStep(steps[state.currentIndex], true);
  }

  function update(dt) {
    if (!state.active || !state.currentStep || state.paused) return;

    state.stepElapsed += dt;

    const positionAlpha = 1 - Math.exp(-dt * state.moveSmoothing);
    tempPosition.copy(pivot.getPosition());
    tempPosition.lerp(tempPosition, state.currentStep.position, positionAlpha);
    pivot.setPosition(tempPosition);

    const { yaw: targetYaw, pitch: targetPitch } = computeAngles(tempPosition, state.currentStep.lookAt);
    const rotationAlpha = 1 - Math.exp(-dt * state.lookSmoothing);
    state.currentYaw = pc.math.lerpAngle(state.currentYaw, targetYaw, rotationAlpha);
    state.currentPitch = pc.math.lerp(state.currentPitch, targetPitch, rotationAlpha);

    if (Math.abs(shortestAngleDelta(state.currentYaw, targetYaw)) < 0.02) {
      state.currentYaw = targetYaw;
    }
    if (Math.abs(state.currentPitch - targetPitch) < 0.02) {
      state.currentPitch = targetPitch;
    }

    const distanceToTarget = tempPosition.distance(state.currentStep.position);
    const arrivalThreshold = state.currentStep.arrivalThreshold ?? 0.08;
    const movementProgress = 1 - pc.math.clamp(distanceToTarget / state.segmentDistance, 0, 1);

    if (distanceToTarget <= arrivalThreshold) {
      if (!state.reachedTarget) {
        state.reachedTarget = true;
        pivot.setPosition(state.currentStep.position);
      }
      state.holdElapsed += dt;
    } else {
      state.holdElapsed = 0;
    }

    applyView(state.currentYaw, state.currentPitch);

    state.currentStep.onUpdate?.({
      dt,
      elapsed: state.stepElapsed,
      holdElapsed: state.holdElapsed,
      movementProgress,
      reachedTarget: state.reachedTarget,
      step: state.currentStep
    });

    const shouldAutoAdvance = state.currentStep.autoAdvance !== false;
    const dwell = state.currentStep.dwell ?? 0.8;
    if (shouldAutoAdvance && state.reachedTarget && state.holdElapsed >= dwell) {
      const advanced = goNext();
      if (!advanced) {
        state.active = false;
      }
    }
  }

  function applyView(yaw, pitch) {
    fallbackPitch = pitch;
    if (typeof playerController?.setView === 'function') {
      playerController.setView(yaw, pitch);
      return;
    }

    pivot.setEulerAngles(0, yaw, 0);
    const cameraEntity = pivot.children[0];
    if (cameraEntity) {
      cameraEntity.setLocalEulerAngles(pitch, 0, 0);
    }
  }

  return {
    addStep,
    start,
    update,
    goNext,
    goPrevious,
    getCurrentStep: () => state.currentStep,
    togglePause: () => {
      state.paused = !state.paused;
      updateStatus();
      return state.paused;
    },
    isPaused: () => state.paused,
    hasStarted: () => state.started
  };
}
