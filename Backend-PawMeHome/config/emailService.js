const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'Yahoo', 
  auth: {
      user: process.env.EMAIL_USERNAME, 
      pass: process.env.EMAIL_PASSWORD  
  }
});



async function sendPasswordResetEmail(recipientEmail, resetCode) {
    const subject = 'Password Reset Request';
    const htmlMessage = `
        <p>Dear user,</p>
        <p>You have requested to reset your password for your PawMeHome account.</p>
        <p>Your password reset code is: <strong>${resetCode}</strong></p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <p>Best regards,<br/>The PawMeHome Team</p>
    `;
    const mailOptions = {
        from: '"PawMeHome" <larisa_usvat@yahoo.com>',
        to: recipientEmail,
        subject: subject,
        html: htmlMessage,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent successfully');
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
}



async function sendAccountVerificationEmail(recipientEmail, verificationCode) {
    const subject = 'Account Verification Required';
    const htmlMessage = `
        <p>Dear user,</p>
        <p>Please verify your account by using this verification code: <strong>${verificationCode}</strong></p>
        <p>If you did not request this verification code, please ignore this email.</p>
        <p>Best regards,<br/>The PawMeHome Team</p>
    `;
    const mailOptions = {
        from: '"PawMeHome" <larisa_usvat@yahoo.com>',
        to: recipientEmail,
        subject: subject,
        html: htmlMessage,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Account verification email sent successfully');
    } catch (error) {
        console.error('Error sending account verification email:', error);
    }
}


module.exports = { sendAccountVerificationEmail, sendPasswordResetEmail };