/**
 * Coordina stanze sequenziali, porte e attivazione esperienze.
 */
export function createExperienceManager(app, lightRig = {}) {
  const rooms = [];
  let activeRoom = -1;
  const lightTransitionSpeed = 4.0; // Velocità di transizione delle luci

  function addRoom(room) {
    rooms.push(room);
  }

  function onRoomEnter(roomId) {
    if (activeRoom === roomId) return;

    activeRoom = roomId;

    rooms.forEach((room) => {
      const isActive = room.id === roomId;
      const roomRig = lightRig.rooms?.[room.id] ?? { fill: 1, interior: 1, transition: 1 };

      // Attiva gradualmente le luci specifiche della stanza
      if (room.roomLights) {
        room.roomLights.forEach(lightEntity => {
          const roomLightMultiplier = lightRig.roomFill ?? 1;
          const targetIntensity = isActive ? (room.disableBaseLights ? 0.0 : (room.lowLight ? 0.035 : 0.12) * roomLightMultiplier * roomRig.fill) : 0.0;
          lightEntity.light.intensity = pc.math.lerp(lightEntity.light.intensity, targetIntensity, lightTransitionSpeed * 0.016); // dt approssimato
        });
      }

      // Le stanze precedenti restano aperte, le successive si richiudono.
      if (room.id > roomId) room.doors.forEach((door) => door.setOpen(false));
    });
  }

  function update(playerPos, dt) {
    // Aggiorna gradualmente le intensità delle luci
    rooms.forEach((room) => {
      const isActive = room.id === activeRoom;
      const roomRig = lightRig.rooms?.[room.id] ?? { fill: 1, interior: 1, transition: 1 };

      // Luce interna spot - stanza 2 poco illuminata
      const interiorMultiplier = lightRig.interior ?? 1;
      const targetInteriorIntensity = isActive ? (room.disableBaseLights ? 0.0 : (room.lowLight ? 0.05 : 0.2) * interiorMultiplier * roomRig.interior) : 0.0;
      room.interiorLight.light.intensity = pc.math.lerp(
        room.interiorLight.light.intensity,
        targetInteriorIntensity,
        lightTransitionSpeed * dt
      );

      // Luci specifiche della stanza - stanza 2 senza luci aggiuntive
      if (room.roomLights) {
        room.roomLights.forEach(lightEntity => {
          const roomLightMultiplier = lightRig.roomFill ?? 1;
          const targetIntensity = isActive ? (room.disableBaseLights ? 0.0 : (room.lowLight ? 0.035 : 0.12) * roomLightMultiplier * roomRig.fill) : 0.0;
          lightEntity.light.intensity = pc.math.lerp(lightEntity.light.intensity, targetIntensity, lightTransitionSpeed * dt);
        });
      }
    });
  }

  return {
    addRoom,
    onRoomEnter,
    update,
    getActiveRoom: () => activeRoom
  };
}
