require('dotenv').config();
const Logger = require('./Logger');
const log = Logger.getLogger('Main');
const express = require('express');
const morgan = require('morgan');
const WebSocketClient = require('websocket').client;
const fileUpload = require('express-fileupload');
const {apiMarketRequestValidator} = require('@apimarket/apimarket-server');
const client = new WebSocketClient({closeTimeout: 10});
const app = express();
const PORT = process.env.PORT || 3000;

Logger.init();

app.use(apiMarketRequestValidator());
app.use(fileUpload({abortOnLimit: true, limits: {fileSize: 500 * 1024}})); // limit 500kb
app.use(morgan('combined', {
  stream: {
    write: function (str) {
      log.info(str)
    }
  }
}));

client.on('connectFailed', error => {
  log.error(error);
});


const sendFile = (data, connection) => {
  return new Promise((resolve, reject) => {
    connection.sendBytes(data, (res, error) => {
      if (error) {
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

app.post('/speech-to-text', (req, res) => {
  const files = req.files;

  if (!files) {
    return res.status(400).send('No files were uploaded.');
  }

  if (Object.keys(files).length !== 1) {
    return res.status(400).send('Too many files were uploaded. Limit: 1');
  }

  const key = Object.keys(files)[0];
  const file = files[key];

  if (!file['mimetype'].startsWith('audio')) {
    return res.status(415).send(file.mimetype + '. Only audio files allowed.');
  }

  if (key === 'korean') {
    client.connect(process.env.WS_ENDPOINT_KOR)
  } else {
    client.connect(process.env.WS_ENDPOINT_ENG);
  }

  client.on('connect', async connection => {
    log.info('Opened websocket connection');
    let result = '';

    sendFile(file['data'], connection)
      .then(() => connection.sendUTF('EOS', () => log.info('Sent EOS')))
      .catch(error => log.error(error));

    connection.on('message', data => {
      log.info('onMessage', data);
      const json = JSON.parse(data['utf8Data']);
      result = json['transcript'];
    });

    connection.on('close', (code, reason) => {
      log.info('Connection closed', code, reason);
      res.send(result);
    });
  });
});

app.listen(PORT, () => log.info(`Server listening on port: ${PORT}`));