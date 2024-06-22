const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/', async (req, res) => { 
  console.log(req.body);

  const { name, birthdate, imageUrl, breed, sex, userId, event_colors } = req.body;

  
  const defaultEventColors = {
    doctor: "#ff0000",
    vaccination: "#ffff00",
    medication: "#0000ff",
    custom: "#00ff00"
  };

  try {
    const result = await req.pool.query(
      'INSERT INTO pets (name, birthdate, imageurl, breed, sex, user_id, event_colors) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', 
      [name, birthdate, imageUrl, breed, sex, userId, event_colors || defaultEventColors]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.put('/:petId', async (req, res) => {
  const { petId } = req.params; 
  const { name, birthdate, imageUrl, breed, sex } = req.body;

  try {
 
    const result = await req.pool.query(
      'UPDATE pets SET name = $1, birthdate = $2, imageurl = $3, breed = $4, sex = $5 WHERE id = $6 RETURNING *',
      [name, birthdate, imageUrl, breed, sex, petId]
    );

    if (result.rows.length === 0) {
  
      return res.status(404).send('Pet not found');
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});




router.post('/upload-image', upload.single('image'), (req, res) => {
  console.log('Request body:', req.body); 
  console.log('Request file:', req.file); 

  if (req.file) {
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('Image URL:', imageUrl); 
    res.json({ imageUrl });
  } else {
    res.status(400).send('No image uploaded');
  }
});


router.get('/', async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM pets');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;


  if (isNaN(parseInt(id))) {
    return res.status(400).send('Invalid ID');
  }

  try {
    const result = await req.pool.query('SELECT * FROM pets WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('Pet not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.delete('/:petId', async (req, res) => {
  const { petId } = req.params;
  
  try {

    await req.pool.query('DELETE FROM events WHERE petid = $1', [petId]);
    await req.pool.query('DELETE FROM notifications WHERE pet_id = $1', [petId]);


    const result = await req.pool.query('DELETE FROM pets WHERE id = $1', [petId]);
    
    if (result.rowCount === 0) {
      return res.status(404).send('Pet not found');
    }

    res.send('Pet deleted successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting pet');
  }
});



router.get('/getByUserId/:userId', async (req, res) => {
  console.log('start');
  const userId = req.params.userId;
  console.log(userId);

  try {
 
    const result = await req.pool.query('SELECT * FROM pets WHERE user_id = $1', [userId]);


    res.json(result.rows);
  } catch (error) {

    console.error('Error fetching pets by user ID:', error.message);
    res.status(500).send('Server error');
  }
});



router.get('/pet-image/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await req.pool.query('SELECT imageurl FROM pets WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const imageUrl = result.rows[0].imageurl;
      res.redirect(imageUrl);
    } else {
      res.status(404).send('Pet image not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/:petId/eventColors', async (req, res) => {
  const { petId } = req.params;

  try {
    const result = await req.pool.query(
      'SELECT event_colors FROM pets WHERE id = $1', 
      [petId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Pet not found');
    }


    const colorsText = result.rows[0].event_colors;

    res.send(colorsText);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.put('/:petId/updateEventColors', async (req, res) => {
  const { petId } = req.params;
  const { eventColors } = req.body;

  try {
    console.log('Received PUT request to update event colors for pet with ID:', petId);
    console.log('New event colors:', eventColors);

    const result = await req.pool.query(
      'UPDATE pets SET event_colors = $1 WHERE id = $2 RETURNING *',
      [eventColors, petId]
    );

    if (result.rows.length === 0) {
      console.log('Pet not found for ID:', petId);
      return res.status(404).send('Pet not found');
    }

    console.log('Event colors updated successfully for pet with ID:', petId);
    res.sendStatus(204); 
  } catch (err) {
    console.error('Error while updating event colors:', err);
    res.status(500).send('Server error');
  }
});



module.exports = router;
