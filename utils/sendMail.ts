require('dotenv').config();
import nodemailer, {Transporter} from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

interface EmailOptions {
  email: string;
  subject: string;
  template: string;
  data: {[key:string]:any};
}

export const sendMail = async ({ email, subject, template, data }: EmailOptions) => {
  // Create a transporter object using SMTP transport
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // e.g., 'smtp.gmail.com'
    port: Number(process.env.SMTP_PORT) || 587,
    service: process.env.SMTP_SEVICE,
    auth: {
      user: process.env.SMTP_USER, // your SMTP username
      pass: process.env.SMTP_PASS, // your SMTP password
    },
  });

  // Render the EJS template
  const templatePath = path.join(__dirname, '../mails', `${template}`);
  const html = await ejs.renderFile(templatePath, data);
  // Define email options
  const mailOptions = {
    from: `"E-LEARNING" <${process.env.SMTP_USER}>`,
    to: email, 
    subject,
    html,
  };

  // Send the email
  await transporter.sendMail(mailOptions);
};
