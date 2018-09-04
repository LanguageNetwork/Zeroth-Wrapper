const Logger = require('./Logger');
const log = Logger.getLogger('Main');
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const WebSocketClient = require('websocket').client;
const fileUpload = require('express-fileupload');

const client = new WebSocketClient({closeTimeout: 10});
const app = express();

app.use(morgan('combined', {stream: {write: function(str) {log.info(str)}}}));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(fileUpload({abortOnLimit: true, limits: {fileSize: 500 * 1024}})); // limit 500kb

Logger.init();

client.on('connectFailed', error => {
  log.error(error);
});


const sendFile = (data, connection) => {
  return new Promise((resolve, reject) => {
    connection.sendBytes(data, (res, error) => {

      if(error) {
        reject(error);
      }

      log.info('Sent audio');
      resolve();
    });
  });
};

app.get('/health', (req, res) => {
  return res.send('UP');
});

app.post('/korean', (req, res) => {
  if (!req.files) {
    return res.status(400).send('No files were uploaded.');
  }

  if (!req.files.sampleFile.mimetype.startsWith('audio')) {
    return res.status(413).send('Only audio files allowed.');
  }

  client.connect(`${process.env.WS_ENDPOINT}`);

  client.on('connect', async connection => {
    log.info('Opened websocket connection');

    let transcription = '';

    sendFile(req.files.sampleFile.data, connection)
      .then(() => {
        connection.sendUTF('EOS', () => log.info('Sent EOS'));
      });

    connection.on('message', data => {
      log.info('onMessage', data);

      const jsonData = JSON.parse(data.utf8Data);
      transcription = jsonData.transcript;
    });

    connection.on('close', (code, reason) => {
      log.info('Connection closed', code, reason);
      res.send(transcription);
    });
  });
});

// module.exports = app;