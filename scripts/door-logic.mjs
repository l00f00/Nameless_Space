/**
 * Door logic: crea una porta da un modello GLB e gestisce apertura/chiusura fluida.
 */
export function createDoor(app, config) {
  const pivot = new pc.Entity(`${config.name}-pivot`);
  pivot.setPosition(config.pivotPos);
  config.root.addChild(pivot);

  const door = config.containerAsset.resource.instantiateRenderEntity({ castShadows: true });
  door.name = config.name;
  door.setLocalPosition(config.localPos.clone().sub(config.pivotPos));
  const panelWidth = config.panelWidth || 0.9;
  door.setLocalScale(panelWidth, 2.4, 0.1);
  // Orientamento verticale: ruotiamo secondo configurazione o default 0° su X/Z
  const rot = config.rotation || new pc.Vec3(0, 0, 0);
  door.setLocalEulerAngles(rot.x, rot.y, rot.z);
  pivot.addChild(door);

  const material = new pc.StandardMaterial();
  material.diffuse = config.color;
  material.metalness = 0.55;
  material.useMetalness = true;
  material.gloss = 0.42;
  material.update();

  applyMaterialRecursively(door, material);

  const state = {
    currentYaw: 0,
    targetYaw: 0,
    openYaw: config.openYaw,
    speed: 1.55 // apertura più pesante e cinematica
  };

  function setOpen(isOpen) {
    state.targetYaw = isOpen ? state.openYaw : 0;
  }

  function update(dt) {
    state.currentYaw = pc.math.lerp(state.currentYaw, state.targetYaw, 1 - Math.exp(-dt * state.speed));
    pivot.setLocalEulerAngles(0, state.currentYaw, 0);
  }

  app.on('update', update);

  return {
    entity: door,
    setOpen,
    destroy: () => app.off('update', update)
  };
}

function applyMaterialRecursively(entity, material) {
  if (entity.render) entity.render.material = material;
  entity.children.forEach((child) => applyMaterialRecursively(child, material));
}
