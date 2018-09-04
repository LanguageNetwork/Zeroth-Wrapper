'use strict';

const pjson = require('./package.json');
const log4js = require('log4js');

module.exports.init = () => {
  log4js.configure({
    appenders: {
      console: {type: 'console'},
      file: {type: 'dateFile', filename: 'logs/zeroth-wrapper-' + pjson.version + '.log'}
    },
    categories: {
      default: {appenders: ['file', 'console'], level: 'info'}
    }
  });
};

module.exports.getLogger = function (className) {
  return log4js.getLogger(className);
};