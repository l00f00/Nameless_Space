/**
 * Door logic: crea una porta da un modello GLB e gestisce apertura/chiusura fluida.
 */
export function createDoor(app, config) {
  const anchor = new pc.Entity(`${config.name}-anchor`);
  anchor.setPosition(config.localPos);
  config.root.addChild(anchor);

  const door = config.containerAsset.resource.instantiateRenderEntity({ castShadows: true });
  door.name = config.name;
  door.setLocalPosition(0, 0, 0);
  const scale = config.localScale || new pc.Vec3(config.panelWidth || 0.9, 2.4, 0.1);
  door.setLocalScale(scale.x, scale.y, scale.z);
  const rot = config.rotation || new pc.Vec3(0, 0, 0);
  door.setLocalEulerAngles(rot.x, rot.y, rot.z);
  anchor.addChild(door);

  const material = new pc.StandardMaterial();
  material.diffuse = config.color;
  material.metalness = 0.55;
  material.useMetalness = true;
  material.gloss = 0.42;
  material.update();

  applyMaterialRecursively(door, material);

  const isSliding = config.mode === 'slide';
  const closedLocalPos = new pc.Vec3(0, 0, 0);
  const openLocalPos = config.openOffset ? config.openOffset.clone() : new pc.Vec3();
  const state = isSliding
    ? {
        currentPos: closedLocalPos.clone(),
        targetPos: closedLocalPos.clone(),
        speed: config.speed || 1.55
      }
    : {
        currentYaw: 0,
        targetYaw: 0,
        openYaw: config.openYaw,
        speed: config.speed || 1.55
      };

  function setOpen(isOpen) {
    if (isSliding) {
      state.targetPos.copy(isOpen ? openLocalPos : closedLocalPos);
      return;
    }

    state.targetYaw = isOpen ? state.openYaw : 0;
  }

  function update(dt) {
    if (isSliding) {
      const alpha = 1 - Math.exp(-dt * state.speed);
      state.currentPos.lerp(state.currentPos, state.targetPos, alpha);
      anchor.setLocalPosition(
        config.localPos.x + state.currentPos.x,
        config.localPos.y + state.currentPos.y,
        config.localPos.z + state.currentPos.z
      );
      return;
    }

    state.currentYaw = pc.math.lerp(state.currentYaw, state.targetYaw, 1 - Math.exp(-dt * state.speed));
    anchor.setLocalEulerAngles(0, state.currentYaw, 0);
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
