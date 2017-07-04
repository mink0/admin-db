var intel = require('intel');
var path = require('path');

var LOGS_DIR = path.join(__dirname, './../logs/');

require('intel').console();
intel.config({
  formatters: {
    'simple': {
      'format': '[%(levelname)s] %(message)s',
      'colorize': true
    },
    'details': {
      'format': '[%(date)s] %(name)s.%(levelname)s: %(message)s',
      'strip': true
    },
    'json': {
      'format': '%O'
    }
  },
  handlers: {
    'terminal': {
      'class': intel.handlers.Console,
      'formatter': 'simple',
      //'level': intel.VERBOSE
    },
    'fileAll': {
      'class': intel.handlers.Rotating,
      //'level': intel.WARN,
      'file': path.join(LOGS_DIR, 'main.log'),
      'formatter': 'details',
    },
    'fileErr': {
      'class': intel.handlers.Rotating,
      'level': intel.WARN,
      'file': path.join(LOGS_DIR, 'error.log'),
      'formatter': 'details',
    },
    'json': {
      'class': intel.handlers.Rotating,
      'level': intel.INFO,
      'file': path.join(LOGS_DIR, 'log.json'),
      'formatter': 'json',
    }
  },
  loggers: {
    'root': {
      'handlers': ['terminal', 'fileAll', 'fileErr', 'json'],
      'level': 'TRACE',
      'handleExceptions': true,
      'exitOnError': true,
      'propagate': false
    }
  }
});

module.exports = intel;

