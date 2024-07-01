if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }

  const express = require('express');
  const router = express.Router();
  const nodemailer = require("nodemailer");

  router.post('/mailer', (req, res) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMPT_EMAIL,
      pass: process.env.SMPT_PASSWORD,
    },
  });

  const { formData } = req.body
  async function main() {
    if(!formData || !formData.nome || !formData.cognome || !formData.email || !formData.message) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: process.env.SMPT_EMAIL, // sender address
      to: process.env.SMPT_EMAIL, // list of receivers
      subject: `NUOVO CONTATTO DA SITO, DA: ${formData.nome} ${formData.cognome}`, // Subject line
      html: `<b>Nome:</b> ${formData.nome} <br> <b>Congome:</b> ${formData.cognome} <br> <b>Email:</b> ${formData.email} <br> <b>Messaggio:</b> ${formData.message} <br>`,
    });
  
    console.log("Message sent: %s", info.messageId);
    res.status(200).json({message: 'Email sent successfully'})
    // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
  }

  main().catch((error) => {
    console.log(error)
    res.status(400).json({message: 'Error sending email'})
  });
})

    
  module.exports = router