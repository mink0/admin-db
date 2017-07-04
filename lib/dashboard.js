/*
 * dashboard server using sockjs - tiny and fast web sockets
 * server - express server instance
 **/

var path = require('path');
var Tail = require('tail').Tail;

// ---------------------------------------------------------------------------------------------------------------------
module.exports = function(io) {
  // легкий dashboard для мониторинга активности сервера.
  // каналы (rooms):
  //   user - активность пользователя
  //   dboard - сообщения от сервера к клиенту dashboard
  //     тип сообщений:
  //       join/leave
  //       server_inf - инфо с параметрами сервера и процесса node
  //       users_act - инфо с активностью пользователей

  // just becouse we are using multiplexing we need to change io.sockets.in --> io.in:
  //io.sockets.in = io.in;

  var fs = require('fs'),
    os = require('os');

  var HISTORY_MAXLEN = 50,
    CPU_WATCH_TIMEOUT = 10 * 1000,
    MAX_CPU_LOAD = 49,
    MAX_RAM_USAGE = 200 * 1000 * 1000,
    DTF = '%d.%M.%Y %H:%m:%s',
    NODE_START_TIME = new Date().getTime();

  function Buffer(maxlen) {
    this.buffer = [];
    this.maxlen = maxlen;
  }
  Buffer.prototype = {
    push: function(item) {
      if (this.buffer.length + 1 > this.maxlen) this.buffer.shift();
      this.buffer.push(item);
    }
  };

  var actBuf = new Buffer(HISTORY_MAXLEN),
    logBuf = new Buffer(HISTORY_MAXLEN),
    staticInf = {
      hostname: os.hostname()
      //ostype: os.type(),
      //platform: os.platform(),
      //release: os.release()
    },
    onlineInf = {
      loadavg: 'n/a',
      freemem: 'n/a',
      uptime: 'n/a',
      node: {
        cpu: 'n/a',
        mem: 'n/a',
        uptime: 'n/a'
      }
    };

  // FIXME: not working room counters 
  // https://github.com/LearnBoost/socket.io/pull/1428
  // Object #<Namespace> has no method 'clients' 
  // var cUser = 0,
  //   cDboard = 0;

  //console.dir(io);
  io.on('connection', function(socket) {
    console.debug('[' + io.name + '] ' + socket.id + ' connected');
    //console.dir(socket.handshake);
    //io.in('dboard').emit('counter', io.clients().length);
    var out = {
      conns: io.clients().length,
      url: '[dashboard]',
      agent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address.address + ': ' + socket.handshake.address.port,
      ts: formatDate(new Date(), DTF),
    };
    actBuf.push(out);
    io.in('dboard').emit('users_act', out);
    
    socket.on('disconnect', function() {
      console.debug('[' + io.name + '] ' + socket.id + ' disconnected');
      //cUser--;
      var out = {
        conns: io.clients().length - 1,
        url: '[DISCONNECT]',
        agent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address.address + ': ' + socket.handshake.address.port,
        ts: formatDate(new Date(), DTF),
      };
      actBuf.push(out);
      io.in('dboard').emit('users_act', out);
    });

    socket.on('join', function(room) {
      console.debug('[' + io.name + '] ' + socket.id + ' join: ' + room);
      socket.join(room);
      if (room === 'dboard') {
        //cDboard++;
        var out = {
          staticInf: staticInf,
          onlineInf: onlineInf,
          conns: io.clients().length,
          actBuf: actBuf.buffer,
          logBuf: logBuf.buffer
        };
        socket.emit('history', out);
      }
    });

    socket.on('leave', function(room) {
      socket.leave(room);
      console.debug('[' + io.name + '] ' + socket.id + ' left: ' + room);
    });

    socket.on('new_user', function(data) {
      console.debug('[' + io.name + '] ' + socket.id + ' new user');
      //cUser++;
      //console.dir(io);
      var out = {
        conns: io.clients().length,
        ip: socket.handshake.address.address + ': ' + socket.handshake.address.port,
        url: data.url,
        ts: formatDate(new Date(), DTF),
        agent: socket.handshake.headers['user-agent']
      };
      actBuf.push(out);
      io.in('dboard').emit('users_act', out);
    });

    socket.on('user_go', function(data) {
      console.debug('[' + io.name + '] ' + socket.id + ' new user');
      var out = {
        ip: socket.handshake.address.address + ': ' + socket.handshake.address.port,
        url: data.url,
        ts: formatDate(new Date(), DTF),
        agent: socket.handshake.headers['user-agent']
      };
      actBuf.push(out);
      io.in('dboard').emit('users_act', out);
    });
  });

  // register CPU Usage watcher
  setInterval(function() {
    getUsage(function(startTime) {
      setTimeout(function() {
        getUsage(function(endTime) {
          var delta = endTime - startTime;
          var percentage = 100 * (delta / CPU_WATCH_TIMEOUT);
          onlineInf.node.cpu = percentage.toFixed(1) + '%';
          if (percentage.toFixed(1) > MAX_CPU_LOAD) console.warn('CPU загрузка процесса nodejs: %s', onlineInf.node.cpu);
          onlineInf.node.mem = bytesToSize(process.memoryUsage().rss);
          if (process.memoryUsage().rss > MAX_RAM_USAGE) console.warn('Потребляемая память процесса (rss) nodejs: %s', onlineInf.node.mem);
          onlineInf.node.uptime = secondsToString((new Date().getTime() - NODE_START_TIME) / 1000);
          onlineInf.uptime = secondsToString(os.uptime());
          onlineInf.freemem = bytesToSize(os.freemem());
          onlineInf.loadavg = (os.loadavg()[1]).toFixed(2);
          //console.log(onlineInf);
        });
      }, 1000);
    });
  }, CPU_WATCH_TIMEOUT);


  // register online info sender
  setInterval(function() {
    io.in('dboard').emit('server_inf', onlineInf);
  }, CPU_WATCH_TIMEOUT);

  // logger
  var tail = new Tail(path.join(__dirname, '../logs/log.json'));
  var log;
  tail.on('line', function(data) {
    log = JSON.parse(data);
    if (log.level > 0) {
      var out = {
        //type: 'log_info',
        name: log.name,
        levelname: log.levelname,
        ts: formatDate(new Date(log.timestamp), DTF),
        message: log.message
      };
      logBuf.push(out);
      io.in('dboard').emit('log_info', out);
    }
  });


  // service functions
  function bytesToSize(bytes) {
    var sizes = ['n/a', 'bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var i = +Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + sizes[isNaN(bytes) ? 0 : i + 1];
  }

  function secondsToString(seconds) {
    var numyears = Math.floor(seconds / 31536000);
    var numdays = Math.floor((seconds % 31536000) / 86400);
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numseconds = Math.floor((((seconds % 31536000) % 86400) % 3600) % 60);
    return ((numyears ? numyears + 'л.' : '') + (numdays ? numdays + 'д.' : '') + (numhours ? numhours + 'ч.' : '') +
      (numminutes ? numminutes + 'м.' : ('' + numseconds ? numseconds + 'с.' : 'n/a')));
  }

  function getUsage(cb) {
    fs.readFile('/proc/' + process.pid + '/stat', function(err, data) {
      var elems = data.toString().split(' ');
      var utime = parseInt(elems[13]);
      var stime = parseInt(elems[14]);
      cb(utime + stime);
    });
  }

  function formatDate(date, fmt) {
    function pad(value) {
      return (value.toString().length < 2) ? '0' + value : value;
    }
    return fmt.replace(/%([a-zA-Z])/g, function(_, fmtCode) {
      switch (fmtCode) {
        case 'Y':
          return date.getYear() - 100;
        case 'M':
          return pad(date.getMonth() + 1);
        case 'd':
          return pad(date.getDate());
        case 'H':
          return pad(date.getHours());
        case 'm':
          return pad(date.getMinutes());
        case 's':
          return pad(date.getSeconds());
        default:
          throw new Error('Unsupported format code: ' + fmtCode);
      }
    });
  }
}