const express = require('express');
const router = express.Router();
const db = require('./../config/db');



router.post('/safe_zone', async (req, res) => { 
  const { name, petId, vertices } = req.body;
  const { vertex1, vertex2, vertex3, vertex4 } = vertices;

  try {
    const result = await req.pool.query(
      'INSERT INTO safe_zones (name, pet_id, vertex_1_latitude, vertex_1_longitude, vertex_2_latitude, vertex_2_longitude, vertex_3_latitude, vertex_3_longitude, vertex_4_latitude, vertex_4_longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [name, petId, vertex1.latitude, vertex1.longitude, vertex2.latitude, vertex2.longitude, vertex3.latitude, vertex3.longitude, vertex4.latitude, vertex4.longitude]
    );
    const newSafeZone = result.rows[0];
    res.json(newSafeZone);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


router.put('/safe_zone/:id', async (req, res) => {
  const { id } = req.params;
  const { name, petId, vertices } = req.body;
  const { vertex1, vertex2, vertex3, vertex4 } = vertices;

  try {
    const result = await req.pool.query(
      'UPDATE safe_zones SET name = $1, pet_id = $2, vertex_1_latitude = $3, vertex_1_longitude = $4, vertex_2_latitude = $5, vertex_2_longitude = $6, vertex_3_latitude = $7, vertex_3_longitude = $8, vertex_4_latitude = $9, vertex_4_longitude = $10 WHERE id = $11 RETURNING *',
      [name, petId, vertex1.latitude, vertex1.longitude, vertex2.latitude, vertex2.longitude, vertex3.latitude, vertex3.longitude, vertex4.latitude, vertex4.longitude, id]
    );

    const updatedSafeZone = result.rows[0];
    if (updatedSafeZone) {
      res.json(updatedSafeZone);
    } else {
      res.status(404).send('Safe Zone not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});



router.get('/safe_zone', async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM safe_zones');
    const safeZones = result.rows;
    res.json(safeZones);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/pet/:petId', async (req, res) => {
    const petId = parseInt(req.params.petId); 

    try {
      const result = await req.pool.query('SELECT * FROM safe_zones WHERE pet_id = $1', [petId]);
      const safeZones = result.rows;
      res.json(safeZones);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

  
  


router.get('/safe_zone/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await req.pool.query('SELECT * FROM safe_zones WHERE id = $1', [id]);
    const safeZone = result.rows[0];
    if (safeZone) {
      res.json(safeZone);
    } else {
      res.status(404).send('Safe Zone not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


router.delete('/safe_zone/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await req.pool.query('DELETE FROM safe_zones WHERE id = $1 RETURNING *', [id]);
    const deletedSafeZone = result.rows[0];
    if (deletedSafeZone) {
      res.send('Safe Zone deleted successfully');
    } else {
      res.status(404).send('Safe Zone not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
router.get('/walking/:pet_id', async (req, res) => {
  const { pet_id } = req.params;
  try {
  
    const petQuery = await req.pool.query('SELECT device_id FROM pets WHERE id = $1', [pet_id]);
    
    

    if (petQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    const device_id = petQuery.rows[0].device_id;


    const walkingQuery = await req.pool.query('SELECT is_walking FROM location WHERE device_id = $1', [device_id]);
   
    

    if (walkingQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Location data not found' });
    }


    const is_walking = walkingQuery.rows[0].is_walking;
    res.json({ is_walking });
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const pool = {
  query: async (query, params) => {
    if (query.includes('SELECT device_id FROM pets WHERE id = $1')) {
      if (params[0] === 28) {
        return { rows: [{ device_id: 123 }] };
      } else {
        return { rows: [] };
      }
    }
    if (query.includes('SELECT latitude, longitude, in_safe_zone FROM location WHERE device_id = $1')) {
      if (params[0] === 123) {
        return { rows: [{ latitude: 40.7128, longitude: -74.0060, in_safe_zone: true }] };
      } else {
        return { rows: [] };
      }
    }
  }
};

router.get('/:pet_id', async (req, res) => {
  const { pet_id } = req.params;


  try {
    const petQuery = await req.pool.query('SELECT device_id FROM pets WHERE id = $1', [pet_id]);
  
    if (petQuery.rows.length === 0) {
      console.log('Pet not found for ID:', pet_id);
      return res.status(404).json({ error: 'Pet not found' });
    }

    const device_id = petQuery.rows[0].device_id;
    const coordinatesQuery = await req.pool.query('SELECT latitude::numeric, longitude::numeric, in_safe_zone FROM location WHERE device_id = $1', [device_id]);

    if (coordinatesQuery.rows.length === 0) {
      console.log('Location data not found for device ID:', device_id);
      return res.status(404).json({ error: 'Location data not found' });
    }

   
    res.json(coordinatesQuery.rows[0]);
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/update', async (req, res) => {
  const { lat, lon, device_id } = req.body;
  
  if (!lat || !lon || !device_id) {
    return res.status(400).send('Latitude, longitude, and device_id are missing');
  }

  try {
    const result = await req.pool.query(
      'UPDATE location SET latitude = $1, longitude = $2, "timestamp" = $3 WHERE device_id = $4 RETURNING id',
      [lat, lon, new Date(), device_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).send('Device ID not found');
    }

    res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).send('Error updating data');
  }
});

router.post('/addDevice', async (req, res) => {
  const { pet_id, device_id } = req.body;

  if (!pet_id || !device_id) {
    return res.status(400).send('Pet_id și device_id lipsesc');
  }

  const client = await req.pool.connect();  

  try {
    await client.query('BEGIN');  

  
    const petResult = await client.query(
      'UPDATE pets SET device_id = $1 WHERE id = $2 RETURNING *',
      [device_id, pet_id]
    );

    if (petResult.rows.length === 0) {
      await client.query('ROLLBACK');  
      return res.status(404).send('Animalul nu a fost găsit');
    }


    const locationResult = await client.query(
      'UPDATE location SET device_id = $1 WHERE device_id = $2',
      [device_id, petResult.rows[0].device_id]
    );

    if (locationResult.rowCount === 0) {
      await client.query(
        'INSERT INTO location (device_id, latitude, longitude, in_safe_zone, "timestamp") VALUES ($1, 0, 0, true, $2)',
        [device_id, new Date()]
      );
    }

    await client.query('COMMIT'); 
    res.status(200).json({ status: 'success', data: petResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');  
    console.error('Eroare la actualizarea datelor:', error);
    res.status(500).send('Eroare la actualizarea datelor');
  } finally {
    client.release(); 
  }
});

router.post('/updateIsWalking', async (req, res) => {
  try {
      const { petId, isWalking } = req.body;

  
      const petQuery = await req.pool.query(
          'SELECT device_id FROM pets WHERE id = $1',
          [petId]
      );

      if (petQuery.rows.length === 0) {
          return res.status(404).send('Nu s-a găsit animalul cu ID-ul specificat');
      }

      const device_id = petQuery.rows[0].device_id;

   
      const updateQuery = await req.pool.query(
          'UPDATE location SET is_walking = $1 WHERE device_id = $2',
          [isWalking, device_id]
      );

      res.status(200).send('Valoarea is_walking a fost actualizată cu succes');
  } catch (error) {
      console.error('Eroare la actualizarea valorii is_walking:', error);
      res.status(500).send('Eroare la actualizarea valorii is_walking');
  }
});



module.exports = router;
