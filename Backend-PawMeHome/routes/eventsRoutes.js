const express = require('express');
const eventsDb = require('../database/events'); 
const router = express.Router();

router.use(express.json());

router.get('/', async (req, res) => {
    try {
        const events = await eventsDb.getEvents();
        res.json(events);
    } catch (err) {
        console.error('Error fetching events:', err.message);
        res.status(500).send(err.message);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const event = await eventsDb.getEventById(req.params.id);
        if (event) {
            res.json(event);
        } else {
            res.status(404).send('Event not found');
        }
    } catch (err) {
        console.error('Error fetching event:', err.message);
        res.status(500).send(err.message);
    }
});


router.post('/', async (req, res) => {
    try {
        const event = await eventsDb.createEvent(req.body);
        res.status(201).json(event);
    } catch (err) {
        console.error('Error creating new event:', err.message);
        res.status(500).send(err.message);
    }
});

router.get('/:eventId/details', async (req, res) => {
    const eventId = req.params.eventId;
    try {
        const eventDetails = await eventsDb.getEventDetails(eventId); 
        res.status(200).json(eventDetails);
        console.log(eventDetails);
    } catch (err) {
        console.error('Error fetching event details:', err.message);
        res.status(500).send(err.message);
    }
});

router.post('/:eventId/update', async (req, res) => {
    const eventId = req.params.eventId;
    const eventData = req.body;
    eventData.eventid = eventId; 
    console.log(eventData);

    try {
        const result = await eventsDb.updateEvent(eventData);
        if (result.success) {
            res.status(200).json({ message: 'Event updated successfully' });
        } else {
            res.status(500).json({ error: result.message });
        }
    } catch (err) {
        console.error('Error updating event:', err.message);
        res.status(500).send(err.message);
    }
});



router.get('/pets/:petId', async (req, res) => {
    try {
        const { petId } = req.params; 
        const events = await eventsDb.getEventsByPetId(petId); 
        res.json(events); 
    } catch (err) {
        console.error('Error fetching events for pet:', err.message);
        res.status(500).send(err.message);
    }
});

router.get('/:petId/date/:date', async (req, res) => {
    try {
        const { petId } = req.params;
        const { date } = req.params; 
        
        const events = await eventsDb.getEventsByPetIdAndDate(petId, date);
        res.json(events);
    } catch (err) {
        console.error('Error fetching events for pet on specific date:', err.message);
        res.status(500).send(err.message);
    }
});
router.delete('/:id', async (req, res) => {
    console.log("ID received:", req.params.id);  
    const client = await req.pool.connect();  
    try {
        await client.query('BEGIN'); 

      
        const deleteFilesResult = await client.query('DELETE FROM event_files WHERE eventid = $1', [req.params.id]);
        console.log(`Deleted ${deleteFilesResult.rowCount} files associated with event ${req.params.id}`);

       
        const deleteImagesResult = await client.query('DELETE FROM event_images WHERE eventid = $1', [req.params.id]);
        console.log(`Deleted ${deleteImagesResult.rowCount} images associated with event ${req.params.id}`);

     
        const deleteNotifResult = await client.query('DELETE FROM notifications WHERE event_id = $1', [req.params.id]);
        console.log(`Deleted ${deleteNotifResult.rowCount} notifications associated with event ${req.params.id}`);

 
        const deleteEventResult = await client.query('DELETE FROM events WHERE eventid = $1', [req.params.id]);
        if (deleteEventResult.rowCount === 0) {
            throw new Error("Event not found");
        }
        console.log(`Deleted event ${req.params.id}`);

        await client.query('COMMIT'); 
        res.send(`Event, associated files, images, and notifications deleted successfully`);
    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error('Failed to delete event and associated data:', error);
        res.status(500).send(error.message);
    } finally {
        client.release();
    }
});


router.get('/:petId/:year/:month', async (req, res) => {
    try {
        const { petId, year, month } = req.params; 
        const events = await eventsDb.getEventsByPetIdAndMonth(petId, year, month); 
        res.json(events); 
    } catch (err) {
        console.error('Error fetching events for pet and month:', err.message);
        res.status(500).send(err.message);
    }
});




module.exports = router;
