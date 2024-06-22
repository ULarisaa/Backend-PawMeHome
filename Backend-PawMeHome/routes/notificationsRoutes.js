const express = require('express');
const notificationsDb = require('../database/notifications'); 
const router = express.Router();


router.use(express.json());


router.get('/', async (req, res) => {
    try {
        console.log('Fetching all notifications');
        const notifications = await notificationsDb.getNotifications();
        console.log('Notifications fetched:', notifications);
        res.json(notifications);
    } catch (err) {
        console.error('Error fetching all notifications:', err.message);
        res.status(500).send(err.message);
    }
});

router.get('/unreadCount', async (req, res) => {
    try {
        const count = await notificationsDb.getUnreadNotificationsCount(); 
        res.json({ count });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching unread notifications count');
    }
});


router.get('/:id', async (req, res) => {
    try {
        console.log(`Fetching notification with ID: ${req.params.id}`);
        const notification = await notificationsDb.getNotificationById(req.params.id);
        if (notification) {
            console.log('Notification found:', notification);
            res.json(notification);
        } else {
            console.log('Notification not found');
            res.status(404).send('Notification not found');
        }
    } catch (err) {
        console.error(`Error fetching notification with ID ${req.params.id}:`, err.message);
        res.status(500).send(err.message);
    }
});


router.post('/', async (req, res) => {
    try {
        console.log('Creating new notification:', req.body);

        console.log('req.pool is defined:', req.pool !== undefined);
        const notification = await notificationsDb.createNotification(req.body, req.pool);
        console.log('Notification created:', notification);
        res.status(201).json(notification);
    } catch (err) {
        console.error('Error creating new notification:', err.message);
        res.status(500).send(err.message);
    }
});


router.patch('/:id/read', async (req, res) => {
    try {
        const success = await notificationsDb.markNotificationAsRead(req.params.id);
        if (success) {
            res.status(204).end();
        } else {
            res.status(404).send('Notification not found');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});


router.post('/', async (req, res) => {
    try {
        
        const notification = await notificationsDb.createNotification(req.body, req.pool);
        res.status(201).json(notification);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


router.delete('/:id', async (req, res) => {
    try {
        console.log(`Deleting notification with ID: ${req.params.id}`);
        const success = await notificationsDb.deleteNotification(req.params.id);
        if (success) {
            console.log('Notification deleted successfully');
            res.status(204).end();
        } else {
            console.log('Notification not found');
            res.status(404).send('Notification not found');
        }
    } catch (err) {
        console.error(`Error deleting notification with ID ${req.params.id}:`, err.message);
        res.status(500).send(err.message);
    }
});



module.exports = router;
