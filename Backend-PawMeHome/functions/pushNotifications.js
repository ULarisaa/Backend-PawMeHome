const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const cron = require('node-cron');
const moment = require('moment');
const { pool } = require('../config/db');

let expo = new Expo();

async function sendPushNotification(token, message, id) {
  if (!Expo.isExpoPushToken(token)) {
    throw new Error(`Push token ${token} is not a valid Expo push token`);
  }

  const messages = [{
    to: token,
    sound: 'default',
    body: message,
    data: {
      targetScreen: 'Notifications',
      selectedType: 'reminder',
      notificationId: id,
    },
  }];

  const chunks = expo.chunkPushNotifications(messages);
  let tickets = [];
  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending notification chunk:", error);
      throw error;
    }
  }
  return tickets;
}

router.post('/send', async (req, res) => {
  const { token, message } = req.body;

  if (!token || !message) {
    return res.status(400).send('Token and message are required');
  }

  try {
    const ticket = await sendPushNotification(token, message);
    res.status(200).json({
      message: 'Notification sent successfully.',
      ticket: ticket
    });
    console.log(ticket);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

const calculateRemindertime = (startDate, remindertime) => {
  const startDateUTC = moment.utc(startDate);

  switch (remindertime) {
    case 'onTime':
      return startDateUTC;
    case '15mBefore':
      return startDateUTC.subtract(15, 'minutes');
    case '30mBefore':
      return startDateUTC.subtract(30, 'minutes');
    case '1hBefore':
      return startDateUTC.subtract(1, 'hour');
    case '2hBefore':
      return startDateUTC.subtract(2, 'hours');
    case '1dBefore':
      return startDateUTC.subtract(1, 'day');
    default:
      return startDateUTC;
  }
};


const scheduleNotifications = () => {
  console.log('Scheduling notifications...');
  cron.schedule('* * * * *', async () => {
    console.log('Checking for upcoming events...');
    const query = `
      SELECT 
        n.notification_id,
        n.user_token,
        e.typeofevent AS event,
        e.details,
        e.titleofevent,
        n.start_date,
        n.remindertime,
        n.reminder_type,
        n.selected_days,
        n.end_date,
        n.type
      FROM 
        notifications n
      JOIN 
        events e ON n.event_id = e.eventid
      WHERE n.type = 'reminder' AND n.notified = false;
    `;

    try {
      const { rows } = await pool.query(query);
      console.log('Fetched notifications:', rows);

      for (const notification of rows) {
        console.log('Processing notification:', notification);
        const appSettingsQuery = await pool.query(
          'SELECT notifications FROM app_settings WHERE user_id = $1',
          [notification.user_id]
        );

        if (appSettingsQuery.rows.length > 0 && appSettingsQuery.rows[0].notifications === false) {
          console.log('Notifications are disabled for this user.');
          continue;
        }

        const now = moment.utc();

        let sendNotification = false;

        if (notification.reminder_type === 'once') {
          const remindertime = calculateRemindertime(notification.start_date, notification.remindertime);
          if (now.isSame(remindertime, 'minute')) {
            sendNotification = true;
          }
        } else if (notification.reminder_type === 'cyclically') {
          const selectedDays = notification.selected_days ? notification.selected_days.split(',') : [];
          const isDaySelected = selectedDays.includes(now.format('dddd').toLowerCase());
          
          const startDateUTC = moment.utc(notification.start_date);
          const endDateUTC = moment.utc(notification.end_date);
          const isWithinDateRange = now.isBetween(startDateUTC, endDateUTC, null, '[]');

          if (isDaySelected && isWithinDateRange) {
            sendNotification = true;
          }
        }

        if (sendNotification) {
          const startDate = moment(notification.start_date).format('DD MMMM YYYY HH:mm');
          const message = `Reminder: Your event ${notification.titleofevent} is coming up on ${startDate}.`;
          const id = notification.notification_id;
          try {
            const ticket = await sendPushNotification(notification.user_token, message, id);
            console.log('Notification sent successfully.', message, 'Ticket:', ticket);

            await pool.query(`UPDATE notifications SET notified = true WHERE notification_id = $1`, [notification.notification_id]);
          } catch (error) {
            console.error('Failed to send notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check events:', error);
    }
  });
};

module.exports = { router, sendPushNotification, scheduleNotifications };
