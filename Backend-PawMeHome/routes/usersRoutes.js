require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/db');
const { sendAccountVerificationEmail, sendPasswordResetEmail } = require('../config/emailService');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const oauth2Client = new OAuth2Client(CLIENT_ID);
const jwtSecret = process.env.JWT_SECRET;
const router = express.Router();


const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        console.error(`Token verification error: ${error}`);
        res.status(401).json({ message: 'Invalid token' });
    }
};

router.post('/initiate-registration', async (req, res) => {
    const { email, password, first_name, last_name, phone_number, country_prefix, alert_token } = req.body;

    try {
        const userExists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (userExists.rowCount > 0) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('BEGIN');

        const result = await pool.query(
            'INSERT INTO users (email, password, first_name, last_name, phone_number, country_prefix, is_active) VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id',
            [email, hashedPassword, first_name, last_name, phone_number, country_prefix]
        );

        const userId = result.rows[0].id;
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); 

        await pool.query(
            'INSERT INTO account_verifications (user_id, verification_code, expires_at) VALUES ($1, $2, $3)',
            [userId, verificationCode, expiresAt]
        );

        await pool.query(
            'INSERT INTO app_settings (user_id, units, notifications, alert, alert_token) VALUES ($1, $2, $3, $4, $5)',
            [userId, 'metric', true, true, alert_token]
        );

        await pool.query('COMMIT');

        sendAccountVerificationEmail(email, verificationCode);

        res.status(201).json({ message: 'Registration successful. Please verify your email to activate your account.' });
    } catch (error) {
        await pool.query('ROLLBACK');

        console.error(`Error during user registration: ${error.message}`);
        res.status(500).json({ message: 'Failed to register user' });
    }
});




router.post('/finalize-registration', async (req, res) => {
    const { email, verificationCode } = req.body;

    try {
        const userData = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userData.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userData.rows[0].id;

        const verificationData = await pool.query('SELECT verification_code, expires_at FROM account_verifications WHERE user_id = $1', [userId]);
        if (verificationData.rowCount === 0 || new Date(verificationData.rows[0].expires_at) < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        if (verificationData.rows[0].verification_code !== verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);

        res.status(200).json({ message: 'Account activated successfully' });
    } catch (error) {
        console.error(`Error during account finalization: ${error.message}`);
        res.status(500).json({ message: 'Failed to finalize account' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials or account does not exist.' });
        }
        const user = userResult.rows[0];

        if (!user.is_active) {
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); 

   
            await pool.query(
                'INSERT INTO account_verifications (user_id, verification_code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET verification_code = $2, expires_at = $3',
                [user.id, verificationCode, expiresAt]
            );

            await sendAccountVerificationEmail(email, verificationCode);

            return res.status(401).json({ message: 'Account not activated', email: email });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1h' });
        res.json({ token: token, message: 'Login successful', userId: user.id });
    } catch (error) {
        console.error(`Error logging in: ${error.message}`);
        res.status(500).json({ message: 'Error logging in' });
    }
});




router.post('/google-login', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await oauth2Client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleEmail = payload['email'];

        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [googleEmail]);
        if (userResult.rows.length === 0) {
            await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [googleEmail, '']);
            userResult = await pool.query('SELECT * FROM users WHERE email = $1', [googleEmail]);
        }

        const user = userResult.rows[0];
        res.status(200).json({ message: 'Google login/signup successful', userId: user.id });
    } catch (error) {
        console.error(`Google login error: ${error}`);
        res.status(500).json({ message: 'Error during Google login' });
    }
});


router.post('/password-reset', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const userId = userResult.rows[0].id;
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); 
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  
        await pool.query(
            'INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET reset_code = EXCLUDED.reset_code, expires_at = EXCLUDED.expires_at',
            [userId, resetCode, expiresAt]
        );

 
        sendPasswordResetEmail(email, resetCode); 

        res.status(200).json({ message: 'Password reset code sent to email' });
    } catch (error) {
        console.error(`Error in password reset request: ${error.message}`);
        res.status(500).json({ message: 'Error in password reset request' });
    }
});


router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
    
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userResult.rows[0].id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);


        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);


        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);


        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error(`Error in resetting password: ${error.message}`);
        res.status(500).json({ message: 'Error in resetting password' });
    }
});
router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    try {
    
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const userId = userResult.rows[0].id;
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); 


        await pool.query(
            'INSERT INTO account_verifications (user_id, verification_code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET verification_code = EXCLUDED.verification_code, expires_at = EXCLUDED.expires_at',
            [userId, verificationCode, expiresAt]
        );


        sendAccountVerificationEmail(email, verificationCode); 

        res.status(200).json({ message: 'Verification code sent to email' });
    } catch (error) {
        console.error(`Error in resending verification code: ${error.message}`);
        res.status(500).json({ message: 'Error in resending verification code' });
    }
});



router.post('/resend-verification-code', async (req, res) => {
    const { email } = req.body;

    try {
  
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); 
        await pool.query(
            'UPDATE account_verifications SET verification_code = $1, expires_at = $2 WHERE user_id = $3',
            [verificationCode, expiresAt, userId]
        );

        sendAccountVerificationEmail(email, verificationCode); 
        res.status(200).json({ message: 'Verification code resent successfully' });
    } catch (error) {
        console.error(`Error in resending verification code: ${error.message}`);
        res.status(500).json({ message: 'Error in resending verification code' });
    }
});


router.post('/update-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = jwt.verify(token, jwtSecret);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.userId]);
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(400).json({ message: 'Invalid or expired token' });
    }
});

router.post('/password-reset', async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const userId = userResult.rows[0].id;
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); 
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); 

 
        await pool.query(
            'INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET reset_code = EXCLUDED.reset_code, expires_at = EXCLUDED.expires_at',
            [userId, resetCode, expiresAt]
        );

       
        sendPasswordResetEmail(email, resetCode);

        res.status(200).json({ message: 'Password reset code sent to email' });
    } catch (error) {
        console.error(`Error in password reset request: ${error.message}`);
        res.status(500).json({ message: 'Error in password reset request' });
    }
});
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    console.log(req.body);
    console.log(`Type of email: ${typeof email}, Type of code: ${typeof code}`);

    try {
        console.log('Querying user ID...');
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]); 
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userId = userResult.rows[0].id;
        console.log(`User ID retrieved: ${userId}`);

        console.log('Querying verification code...');
        const codeResult = await pool.query(
            'SELECT * FROM account_verifications WHERE user_id = $1 AND verification_code = $2 AND expires_at > NOW()',
            [userId, code]
        );

        if (codeResult.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        console.log('Updating user activation status...');
        await pool.query('UPDATE users SET is_active = true WHERE id = $1', [userId]);


        console.log('Generating JWT token...');
        const token = jwt.sign({ userId: userId, email: email }, jwtSecret, { expiresIn: '1h' });

        res.json({ token: token, message: 'Verification successful, account activated, please log in' });
    } catch (error) {
        console.error(`Error in process: ${error.message}`);
        res.status(500).json({ message: 'Failed to verify code' });
    }
});

router.post('/verify-reset-code', async (req, res) => {
    const { email, resetCode } = req.body;
    try {

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userId = userResult.rows[0].id;


        const resetResult = await pool.query('SELECT * FROM password_resets WHERE user_id = $1 AND reset_code = $2 AND expires_at > NOW()', [userId, resetCode]);
        if (resetResult.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }


        res.status(200).json({ message: 'Reset code verified successfully' });
    } catch (error) {
        console.error(`Error in verifying reset code: ${error.message}`);
        res.status(500).json({ message: 'Error in verifying reset code' });
    }
});




router.post('/pushNotifications/register', authMiddleware, async (req, res) => {
  
    res.status(200).json({ message: 'Push notification token registered successfully' });
});


router.post('/decodeToken', (req, res) => {
    const token = req.body.token;
    
  
    if (!token) {
        return res.status(400).json({ error: 'Token missing' });
    }

    try {
   
        const decoded = jwt.verify(token, jwtSecret);

        const userId = decoded.userId;
        const email = decoded.email;
        
        res.json({ userId: userId, email: email });
    } catch (error) {
     
        console.error('Error decoding token:', error.message);
        res.status(400).json({ error: 'Invalid token' });
    }
});



router.put('/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const { old_email, first_name, last_name, phone_number, country_prefix } = req.body;

      await pool.query(
        'UPDATE users SET email = $1, first_name = $2, last_name = $3, phone_number = $4, country_prefix = $5 WHERE id = $6',
        [old_email, first_name, last_name, phone_number, country_prefix, userId]
      );
  
      res.json({ message: 'User information updated successfully' });
    } catch (error) {
      console.error('Error updating user information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });



router.get('/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;

      const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user.rows[0]);
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/update-user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { old_email, new_email, first_name, last_name, phone_number, country_prefix } = req.body;

        if (new_email) {
            const userExists = await pool.query('SELECT 1 FROM users WHERE email = $1 AND id != $2', [new_email, userId]);
            if (userExists.rowCount > 0) {
                return res.status(400).json({ message: 'Email already in use' });
            }

           
            await pool.query(
                'UPDATE users SET email = $1, first_name = $2, last_name = $3, phone_number = $4, country_prefix = $5 WHERE id = $6',
                [old_email, first_name, last_name, phone_number, country_prefix, userId]
              );

              const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
              const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000); 
              await pool.query(
                  'UPDATE account_verifications SET verification_code = $1, expires_at = $2 WHERE user_id = $3',
                  [verificationCode, expiresAt, userId]
              );
      
              sendAccountVerificationEmail(new_email, verificationCode);
        }

        await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2, phone_number = $3, country_prefix = $4 WHERE id = $5',
            [first_name, last_name, phone_number, country_prefix, userId]
        );

        res.json({ message: 'User information updated successfully' });
    } catch (error) {
        console.error('Error updating user information:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/verify-new-email', async (req, res) => {
    const { userId, code, newEmail } = req.body; 
    console.log(req.body);
    try {

        const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const existingUserId = userResult.rows[0].id;

        const codeResult = await pool.query(
            'SELECT * FROM account_verifications WHERE user_id = $1 AND verification_code = $2 AND expires_at > NOW()',
            [existingUserId, code]
        );
        if (codeResult.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }
        
        await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, existingUserId]);

      

        res.json({ message: 'Email address updated successfully' });
    } catch (error) {
        console.error(`Error in process: ${error.message}`);
        res.status(500).json({ message: 'Failed to verify code and update email address' });
    }
});


  

module.exports = router;
