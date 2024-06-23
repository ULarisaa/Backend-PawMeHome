const pointInPolygon = (point, polygon) => {
    let x = point.latitude, y = point.longitude;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].latitude, yi = polygon[i].longitude;
      let xj = polygon[j].latitude, yj = polygon[j].longitude;
  
      let intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };
  
  const checkIfPetInSafeZone = (petLocation, safeZones) => {
    return safeZones.some(zone => {
      const polygon = [
        { latitude: parseFloat(zone.vertex_1_latitude), longitude: parseFloat(zone.vertex_1_longitude) },
        { latitude: parseFloat(zone.vertex_2_latitude), longitude: parseFloat(zone.vertex_2_longitude) },
        { latitude: parseFloat(zone.vertex_3_latitude), longitude: parseFloat(zone.vertex_3_longitude) },
        { latitude: parseFloat(zone.vertex_4_latitude), longitude: parseFloat(zone.vertex_4_longitude) },
      ];
      return pointInPolygon(petLocation, polygon);
    });
  };
  
  const { pool } = require('../config/db');
  
  const checkSafeZonesPeriodically = async () => {
      const checkCoordinatesInSafeZones = async () => {
          try {
              const locationResult = await pool.query('SELECT id, device_id, latitude, longitude FROM location');
              const coordinates = locationResult.rows;
  
              const safeZonesResult = await pool.query('SELECT * FROM safe_zones');
              const safeZones = safeZonesResult.rows;
  
              const petsResult = await pool.query('SELECT id AS pet_id, device_id FROM pets');
              const pets = petsResult.rows;
  
              const deviceToPetMap = {};
  
              for (const pet of pets) {
                  if (pet.device_id !== null) {
                      if (!deviceToPetMap[pet.device_id]) {
                          deviceToPetMap[pet.device_id] = pet.pet_id;
                      }
                  }
              }
  
              for (const coord of coordinates) {
                  const petId = deviceToPetMap[coord.device_id];
                  if (!petId) {
                    console.error(`No pet_id associated with device_id ${coord.device_id} was found`);
                      continue;
                  }
  
                  const isInSafeZone = checkIfPetInSafeZone(coord, safeZones);
                  await updateInSafeZoneStatus(coord.id, isInSafeZone);
              }
          } catch (error) {
            console.error('Error checking coordinates in safe zones:', error);
          }
      };
  
      checkCoordinatesInSafeZones();
  
      const intervalId = setInterval(checkCoordinatesInSafeZones, 3000);
  };
  
  const updateInSafeZoneStatus = async (locationId, isInSafeZone) => {
      try {
          await pool.query(
              'UPDATE location SET in_safe_zone = $1 WHERE id = $2',
              [isInSafeZone, locationId]
          );
          console.log(`The in_safe_zone status for location with ID ${locationId} was successfully updated to ${isInSafeZone}`);
        } catch (error) {
            console.error(`Error updating the in_safe_zone status for location with ID ${locationId}:`, error);
        }        
  };
  
  module.exports = { checkSafeZonesPeriodically };
  