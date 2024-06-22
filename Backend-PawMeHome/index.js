const express = require('express');
require('dotenv').config();
const { Pool } = require('pg');
const cors = require('cors');

const usersRoutes = require('./routes/usersRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const petRoutes = require('./routes/petsRoutes');
const eventsRoutes = require('./routes/eventsRoutes');
const locationRoutes = require('./routes/locationRoutes');
const appRoutes = require('./routes/appRoutes');
const { router: pushNotificationsRoutes } = require('./functions/pushNotifications');
const { scheduleNotifications } = require('./functions/pushNotifications');
const { scheduleAlerts } = require('./functions/pushAlerts');
const { checkSafeZonesPeriodically } = require('./functions/checkSafeZonesPeriodically');


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

pool.connect(err => {
  if (err) {
    console.error('Connection error', err.stack);
  } else {
    console.log('Connected to database');
  }
});

app.use((req, res, next) => {
  req.pool = pool;
  next();
});

scheduleNotifications();
scheduleAlerts();

app.use('/users', usersRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/pets', petRoutes);
app.use('/events', eventsRoutes);
app.use('/pushNotifications', pushNotificationsRoutes);
app.use('/location', locationRoutes);
app.use('/app', appRoutes);


checkSafeZonesPeriodically();



app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
