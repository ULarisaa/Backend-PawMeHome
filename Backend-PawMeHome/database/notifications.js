const {pool} = require('../config/db'); 

const getNotifications = async () => {
    try {
        const { rows } = await pool.query('SELECT * FROM notifications');
        return rows;
    } catch (err) {
        throw err;
    }
};

const getNotificationById = async (id) => {
    try {
        const { rows } = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    } catch (err) {
        throw err;
    }
};
const deleteNotification = async (id) => {
    try {
      const query = {
        text: 'DELETE FROM notifications WHERE notification_id = $1',
        values: [id],
      };
      const result = await pool.query(query);
     
      return result.rowCount > 0;
    } catch (error) {
      
      throw error;
    }
  };

const getNotificationsByPetId = async (petId) => {
    try {
        const { rows } = await pool.query('SELECT * FROM notifications WHERE pet_id = $1', [petId]);
        if (rows.length === 0) {
            return [];  
        }
        return rows; 
    } catch (err) {
        throw err;
    }
};


const markNotificationAsRead = async (id) => {
    try {
        const { rowCount } = await pool.query('UPDATE notifications SET read = TRUE WHERE notification_id = $1 RETURNING *', [id]);
        return rowCount > 0;
    } catch (err) {
        throw err;
    }
};
function dayNameToNumber(dayName) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.indexOf(dayName.toLowerCase());
}


const createNotification = async (notification, repeatDays) => {
    const { pet_id, user_token, message, type, remindertime, details, reminder, reminder_type, selectedDays, start_date, event_id, end_date } = notification;

    try {
       
        const res = await pool.query(
            'INSERT INTO notifications(pet_id, user_token, message, read, type, remindertime, details, reminder, reminder_type, selected_days, start_date, event_id, end_date) VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING notification_id',
            [pet_id, user_token, message, type, remindertime, details, reminder, reminder_type, JSON.stringify(selectedDays), start_date, event_id, end_date]
        );
     
        return res.rows[0];
    } catch (err) {
        throw err;
    }
};


const getUnreadNotificationsCount = async () => {
    try {
        const { rows } = await pool.query('SELECT COUNT(*) AS count FROM notifications WHERE read = FALSE');
        return parseInt(rows[0].count, 10); 
    } catch (error) {
        console.error('Error executing query', error.stack);
        throw error;
    }
};


module.exports = {
    getNotifications,
    getNotificationById,
    markNotificationAsRead,
    createNotification,
    getUnreadNotificationsCount,
    getNotificationsByPetId,
    deleteNotification,
};
