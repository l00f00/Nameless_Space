import { createTrigger } from './trigger-system.js';

/**
 * Coordina stanze sequenziali, porte e attivazione esperienze.
 */
export function createExperienceManager(app) {
  const rooms = [];
  const triggers = [];
  let activeRoom = -1;

  function addRoom(room) {
    rooms.push(room);

    const proximityTrigger = createTrigger(app, {
      name: `door-proximity-${room.id}`,
      center: new pc.Vec3(0, 1.6, room.zCenter - 2.6),
      halfExtents: new pc.Vec3(2.8, 1.8, 4.1),
      onEnter: () => {
        room.doors.forEach((door) => door.setOpen(true));
      }
    });

    triggers.push(proximityTrigger);
    app.root.addChild(proximityTrigger.entity);
  }

  function onRoomEnter(roomId) {
    if (activeRoom === roomId) return;

    activeRoom = roomId;

    rooms.forEach((room) => {
      const isActive = room.id === roomId;
      room.interiorLight.light.intensity = isActive ? 1.7 : 0.0;

      // Le stanze precedenti restano aperte, le successive si richiudono.
      if (room.id > roomId) room.doors.forEach((door) => door.setOpen(false));
    });
  }

  function update(playerPos, dt) {
    void dt;
    triggers.forEach((trigger) => trigger.update(playerPos));
  }

  return { addRoom, onRoomEnter, update };
}
