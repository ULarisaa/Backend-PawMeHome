const express = require('express');
const router = express.Router();
const {pool} = require('../config/db');


router.use(express.json());

router.post('/change-units', async (req, res) => {
    try {
        const { user_id, units } = req.body;

  
        const query = 'UPDATE app_settings SET units = $1 WHERE user_id = $2';
        const values = [units, user_id];


        await pool.query(query, values);

        res.status(200).json({ message: 'Units updated successfully' });
    } catch (error) {
        console.error('Error updating units:', error);
        res.status(500).json({ error: 'Failed to update units' });
    }
});

router.post('/change-settings', async (req, res) => {
    try {
        const { user_id, alert, notifications } = req.body;

      
        const query = 'UPDATE app_settings SET alert = $1, notifications = $2 WHERE user_id = $3';
        const values = [alert, notifications, user_id];


        await pool.query(query, values);

        res.status(200).json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});


router.get('/app-settings/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

   
        const query = 'SELECT * FROM app_settings WHERE user_id = $1';
        const values = [userId];

        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Settings not found for the specified user ID' });
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});




module.exports = router;
