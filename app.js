// imports
require('dotenv').config();
const Logger = require('./Logger');
const log = Logger.getLogger('Main');
const express = require('express');
const morgan = require('morgan');
const WebSocketClient = require('websocket').client;
const axios = require('axios');
const fileUpload = require('express-fileupload');
const {apiMarketRequestValidator} = require('@apimarket/apimarket-server');
const client = new WebSocketClient({closeTimeout: 10});
const app = express();
const pjson = require('./package.json');

// fields
const PORT = process.env.PORT || 3000;
const CREDENTIALS = process.env.OPEN_ID_CREDENTIALS;
const OPENID_ENDPOINT = process.env.OPEN_ID_ENDPOINT;
const WS_ENDPOINT_KOR = process.env.WS_ENDPOINT_KOR;
const WS_ENDPOINT_ENG = process.env.WS_ENDPOINT_ENG;
let accessToken = {access_token: '', expiration: new Date()};

// init
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

const obtainToken = () => {
  return new Promise((resolve, reject) => {
    if (accessToken.expiration <= new Date(new Date().getTime() + 5 * 1000)) {
      const b64 = Buffer.from(CREDENTIALS).toString('base64');
      axios.post(OPENID_ENDPOINT,
        'grant_type=client_credentials',
        {headers: {Authorization: "Basic " + b64, MediaType: 'application/x-www-form-urlencoded'}})
        .then(response => {
          const data = response['data'];
          accessToken = {
            access_token: data['access_token'],
            expiration: new Date(new Date().getTime() + data['expires_in'] * 1000)
          };
          resolve();
        })
        .catch(error => {
          reject(error);
        })
    } else {
      resolve();
    }
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

  obtainToken()
    .then(() => {
      if (key === 'korean') {
        client.connect(WS_ENDPOINT_KOR + accessToken['access_token']);
      } else {
        client.connect(WS_ENDPOINT_ENG + accessToken['access_token']);
      }
    })
    .catch(error => {
      log.error(error);
      res.status(503).send('Service temporarily unavailable.');
    });

  client.on('connectFailed', error => {
    log.error(error.toString().split('\n')[0]);
    res.status(503).send('Service temporarily unavailable.');
  });

  client.on('connect', connection => {
    log.info('Opened websocket connection');
    let result = {};

    sendFile(file['data'], connection)
      .then(() => connection.sendUTF('EOS', () => log.info('Sent EOS')))
      .catch(error => log.error(error));

    connection.on('message', data => {
      log.info('onMessage', data);
      const json = JSON.parse(data['utf8Data']);
      if(json.hasOwnProperty('transcript')) {
        result = {transcript: json['transcript']};
      }
    });

    connection.on('close', (code, reason) => {
      log.info('Connection closed', code, reason);
      res.send(JSON.stringify(result));
    });
  });
});

log.info('Starting ' + pjson.name + '-' + pjson.version);
app.listen(PORT, () => log.info(`Server listening on port: ${PORT}`));