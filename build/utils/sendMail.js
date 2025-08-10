"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = void 0;
require('dotenv').config();
const nodemailer_1 = __importDefault(require("nodemailer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendMail = async ({ email, subject, template, data }) => {
    // Create a transporter object using SMTP transport
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST, // e.g., 'smtp.gmail.com'
        port: Number(process.env.SMTP_PORT) || 587,
        service: process.env.SMTP_SEVICE,
        auth: {
            user: process.env.SMTP_USER, // your SMTP username
            pass: process.env.SMTP_PASS, // your SMTP password
        },
    });
    // Render the EJS template
    const templatePath = path_1.default.join(__dirname, '../mails', `${template}`);
    const html = await ejs_1.default.renderFile(templatePath, data);
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
exports.sendMail = sendMail;
