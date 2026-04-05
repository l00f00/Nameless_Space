/**
 * Trigger invisibile basato su controllo AABB custom.
 * Si appoggia alla posizione del player (camera pivot).
 */
export function createTrigger(app, { name, center, halfExtents, onEnter }) {
  const entity = new pc.Entity(name);
  entity.setPosition(center);

  let inside = false;

  function update(playerPos) {
    const inX = Math.abs(playerPos.x - center.x) <= halfExtents.x;
    const inY = Math.abs(playerPos.y - center.y) <= halfExtents.y;
    const inZ = Math.abs(playerPos.z - center.z) <= halfExtents.z;
    const nowInside = inX && inY && inZ;

    if (nowInside && !inside) onEnter?.();
    inside = nowInside;
  }

  return { entity, update };
}
