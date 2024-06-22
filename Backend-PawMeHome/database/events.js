const {pool} = require('../config/db'); 


const getEvents = async () => {
    const res = await pool.query('SELECT * FROM events');
    return res.rows;
};

const getEventById = async (id) => {
    const res = await pool.query('SELECT * FROM events WHERE EventID = $1', [id]);
    return res.rows[0];
};
const createEvent = async (event) => {
    const { petid, eventType, titleofevent, eventdate, details, files, images } = event;
    console.log(event);
    try {

        const res = await pool.query(
            `INSERT INTO events (petid, typeofevent, titleofevent, eventdate, details) 
             VALUES ($1, $2, $3, $4, $5) RETURNING eventid;`,
            [petid, eventType, titleofevent, eventdate, details]
        );

        
        if (res.rows && res.rows.length > 0) {
            const eventid = res.rows[0].eventid;

           
            for (const file of files) {
                await pool.query(
                    `INSERT INTO event_files (eventid, file_uri, name) 
                     VALUES ($1, $2, $3);`,
                    [eventid, file.uri, file.name]
                );
            }

           
            for (const image of images) {
                await pool.query(
                    `INSERT INTO event_images (eventid, image_uri) 
                     VALUES ($1, $2);`,
                    [eventid, image.uri]
                );
            }

            return { success: true, eventid };
        } else {
          
            return { success: false, message: "No event was created." };
        }
    } catch (error) {
        
        console.error("Error creating event:", error);
        return { success: false, message: error.message };
    }
};


const updateEvent = async (event) => {
    const { eventid, titleofevent, details, files, images } = event;
    try {
        
        await pool.query(
            `UPDATE events 
             SET titleofevent = $1,  details = $2
             WHERE eventid = $3;`,
            [titleofevent, details, eventid]
        );

        
        await pool.query(
            `DELETE FROM event_files 
             WHERE eventid = $1;`,
            [eventid]
        );

       
        await pool.query(
            `DELETE FROM event_images 
             WHERE eventid = $1;`,
            [eventid]
        );

      
        for (const file of files) {
            await pool.query(
                `INSERT INTO event_files (eventid, file_uri, name) 
                 VALUES ($1, $2, $3);`,
                [eventid, file.uri, file.name]
            );
        }

       
        for (const image of images) {
            await pool.query(
                `INSERT INTO event_images (eventid, image_uri) 
                 VALUES ($1, $2);`,
                [eventid, image.uri]
            );
        }

        return { success: true };
    } catch (error) {
        console.error("Eroare la actualizarea evenimentului:", error);
        return { success: false, message: error.message };
    }
};



const getEventsByPetId = async (petid) => {
   
    const res = await pool.query('SELECT * FROM events WHERE petid = $1 ORDER BY eventDate ASC', [petid]);
    const allEvents = res.rows;

   
    return { allEvents };
};

async function getEventsByPetIdAndDate(petId, date) {
    console.log("Executing query with petId:", petId, "and date:", date);
    const res = await pool.query(`
        SELECT e.*, 
            array_agg(DISTINCT ei.image_uri) AS images,
            array_agg(DISTINCT ef.file_uri) AS files
        FROM events e
        LEFT JOIN event_images ei ON e.eventid = ei.eventid
        LEFT JOIN event_files ef ON e.eventid = ef.eventid
        WHERE e.petId = $1 AND DATE(e.eventDate) = $2
        GROUP BY e.eventid;
    `, [petId, date]);
    const events = res.rows;
    return events;
}

const getEventsByPetIdAndMonth = async (petId, year, month) => {
    try {
       
        const query = `
            SELECT * FROM events
            WHERE petid = $1
            AND EXTRACT(YEAR FROM eventdate) = $2
            AND EXTRACT(MONTH FROM eventdate) = $3
        `;
        
      
        const result = await pool.query(query, [petId, year, month]);
        
       
        return result.rows;
    } catch (error) {
        
        throw error;
    }
};


const getEventDetails = async (eventId) => {
    try {
  
        const eventDetailsQuery = `
            SELECT * FROM events WHERE eventid = $1;
        `;
        const eventDetailsResult = await pool.query(eventDetailsQuery, [eventId]);
        const eventDetails = eventDetailsResult.rows[0];

        if (!eventDetails) {
            throw new Error('Event not found');
        }

     
        const eventFilesQuery = `
            SELECT * FROM event_files WHERE eventid = $1;
        `;
        const eventFilesResult = await pool.query(eventFilesQuery, [eventId]);
        const eventFiles = eventFilesResult.rows;

        const eventImagesQuery = `
            SELECT * FROM event_images WHERE eventid = $1;
        `;
        const eventImagesResult = await pool.query(eventImagesQuery, [eventId]);
        const eventImages = eventImagesResult.rows;

     
        const eventNotificationsQuery = `
            SELECT * FROM notifications WHERE event_id = $1;
        `;
        const eventNotificationsResult = await pool.query(eventNotificationsQuery, [eventId]);
        const eventNotifications = eventNotificationsResult.rows;

        const eventData = {
            eventDetails,
            eventFiles,
            eventImages,
            eventNotifications
        };

        return eventData;
    } catch (error) {
        throw new Error('Error fetching event details: ' + error.message);
    }
};




module.exports = { getEvents,updateEvent, getEventById, createEvent, getEventsByPetId, getEventsByPetIdAndDate, getEventsByPetIdAndMonth, getEventDetails};
