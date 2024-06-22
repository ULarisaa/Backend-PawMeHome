const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const { pool } = require('../config/db');

let expo = new Expo();


async function sendPushNotification(token, message, petId) {
    if (!Expo.isExpoPushToken(token)) {
        throw new Error(`Tokenul push ${token} nu este un token Expo valid`);
    }

    console.log('Pet ID in sendPushNotification:', petId);

    const messages = [{
        to: token,
        sound: 'default',
        body: message,
        data: {
            targetScreen: 'PetProfile',
            selectedType: 'location',
            selectedItem: petId,
        },
    }];

    const chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    for (let chunk of chunks) {
        try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        } catch (error) {
            console.error("Eroare la trimiterea bucății de notificare:", error);
            throw error;
        }
    }

    await saveAlertToNotificationsTable(message, petId);

    return tickets;
}

const checkAndSendAlerts = async (token) => {
    try {
        const appSettingsQuery = await pool.query(
            'SELECT user_id, alert FROM app_settings WHERE alert_token = $1',
            [token]
        );

        const { user_id, alert } = appSettingsQuery.rows[0];
        if (!alert) {
            console.log('Alerts are disabled for this user.');
            return;
        }

        const petsQuery = await pool.query(
            'SELECT id, name, device_id FROM pets WHERE user_id = $1',
            [user_id]
        );

        if (petsQuery.rows.length === 0) {
            console.error('No pets found for user with ID:', user_id);
            return;
        }

        for (const pet of petsQuery.rows) {
            if (pet.device_id === null || pet.device_id === undefined) {
                console.warn('Pet with ID', pet.id, 'has no associated device_id. Moving to the next pet.');
                continue;
            }

            const safeZonesQuery = await pool.query(
                'SELECT id FROM safe_zones WHERE pet_id = $1',
                [pet.id]
            );

            if (safeZonesQuery.rows.length === 0) {
                console.warn('Pet with ID', pet.id, 'has no defined safe zones. Moving to the next pet.');
                continue;
            }

            const locationQuery = await pool.query(
                'SELECT in_safe_zone, is_walking FROM location WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 1',
                [pet.device_id]
            );

            if (locationQuery.rows.length === 0) {
                console.error('No location data found for pet with ID:', pet.id);
                continue;
            }

            const { in_safe_zone, is_walking } = locationQuery.rows[0];

            let alertMessage = `Alert: ${pet.name} is not in the safe zone!`;

            if (!in_safe_zone && !is_walking) {
                const lastNotificationQuery = await pool.query(
                    'SELECT created_at FROM notifications WHERE pet_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [pet.id]
                );

                if (lastNotificationQuery.rows.length > 0) {
                    const lastNotificationTime = new Date(lastNotificationQuery.rows[0].created_at).getTime();
                    const currentTime = new Date().getTime();
                    const fiveMinutesInMillis = 5 * 60 * 1000;

                    if (currentTime - lastNotificationTime < fiveMinutesInMillis) {
                        console.log('Less than 5 minutes have passed since the last notification for pet_id:', pet.id);
                        continue;
                    }
                }

                await sendPushNotification(token, alertMessage, pet.id);
                console.log('Alert sent:', alertMessage);

                await saveAlertToNotificationsTable(alertMessage, pet.id);
            }
        }

    } catch (error) {
        console.error('Failed to check and send alerts:', error);
    }
};


const saveAlertToNotificationsTable = async (message, petId) => {
    try {
        await pool.query(
            'INSERT INTO notifications (type, message, created_at, pet_id) VALUES ($1, $2, $3, $4)',
            ['alert', message, new Date(), petId]
        );
        console.log('Alert saved to notifications table.');
    } catch (error) {
        console.error('Failed to save alert to notifications table:', error);
    }
};


const scheduleAlerts = () => {
    cron.schedule('*/30 * * * * *', async () => {
        console.log('Verifying and sending alerts...');

        try {
            const tokensQuery = await pool.query('SELECT alert_token FROM app_settings');

            for (const row of tokensQuery.rows) {
                await checkAndSendAlerts(row.alert_token);
            }

        } catch (error) {
            console.error('Failed to fetch Expo tokens:', error);
        }
    });
};

module.exports = { router, sendPushNotification, scheduleAlerts };

