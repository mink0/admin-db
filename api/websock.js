var pg = require('pg');

var CLIENT_UPDATE_DELAY = 500,
    TASKS_LIMIT = 100;

module.exports = function(io) {
  var tasksTable = {
    rows: [],
    _ts: new Date() - CLIENT_UPDATE_DELAY,
    _isRun: false,
    _forceGet: function(callback) {
      this._ts = new Date();
      this._isRun = true;
      //console.debug('fetching task table...');
      var self = this;
      var callback = callback || function() {};
      pg.query('SELECT * FROM tasks_v ORDER by id DESC LIMIT $1', [TASKS_LIMIT], function(err, res) {
        self._isRun = false;
        if (err) return callback(err);
        // save table
        self.rows = res.rows;
        //console.debug('task table fetched: ', res.rows[0]);
        return callback(null, self.rows);
      });
    },
    get: function(callback) {
      var callback = callback || function() {};
      var ts = new Date();
      var self = this;
      if (self._isRun) {
        //console.debug('the task is already running');
        return callback('error.task_is_set');
      }
      else if (ts - this._ts < CLIENT_UPDATE_DELAY) {
        // prevent client flooding
        var delay = CLIENT_UPDATE_DELAY - (ts - this._ts);
        if (delay < 0) delay = 0;
        self._isRun = true;
        setTimeout(function() {
          return self._forceGet(callback);
        }, delay);
      } else {
        return self._forceGet(callback);
      }
    }
  };

  var evLog = {
    rows: [],
    changed: [],
    _isRun: false,
    get: function(callback) {
      var self = this;
      var callback = callback || function() {};
      if (this._isRun) return callback('task_is_running');
      self._isRun = true;
      pg.query('SELECT id,ts,usr,obj_id,action_name,message FROM ev_log ORDER by id DESC LIMIT 10', function(err, res) {
        //console.debug('fetching log table...');
        if (err) {
          this._isRun = false;
          return callback(err);
        }
        // save table
        self.rows = res.rows;
        self._isRun = false;
        return callback(null, res.rows);
      });
    },
    objectArrayDiff: function(a1, a2) {
      //Find values that are in result1 but not in result2
      var uniqueResultOne = a1.filter(function(obj) {
        return !a2.some(function(obj2) {
          return obj.id == obj2.id;
        });
      });

      //Find values that are in result2 but not in result1
      var uniqueResultTwo = a2.filter(function(obj) {
        return !a1.some(function(obj2) {
          return obj.id == obj2.id;
        });
      });

      //Combine the two arrays of unique entries
      return uniqueResultOne.concat(uniqueResultTwo);
    },
    getChanged: function(callback) {
      var self = this;
      var callback = callback || function() {};
      var lastId = this.rows[0].id;
      this.get(function(err, rows) {
        if (err) return callback(err);
        var changed = [];
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].id > lastId) changed.push(rows[i]);
        }
        // console.log('res:', self.objectArrayDiff(oldRows, rows));
        if (changed.length === 0) return callback('no_new_events');
        return callback(null, changed);
      });
    }
  };

  io.on('connection', function(socket) {
    console.debug('[' + io.sockets.name + '] ' + socket.id + ' connected');

    socket.on('disconnect', function() {
      console.debug('[' + io.sockets.name + '] ' + socket.id + ' disconnected');
    });

    socket.on('leave', function(channel) {
      console.debug('[' + io.sockets.name + '] ' + socket.id + ' left: ' + channel);
      socket.leave(channel);
    });

    socket.on('join', function(channel) {
      console.debug('[' + io.sockets.name + '] ' + socket.id + ' joined: ' + channel);
      socket.join(channel);
      if (channel === 'tasks') {
        // first client
        if (io.sockets.clients('tasks').length === 1) {
          tasksTable.get(function(err, res) {
            // выдать уже актуальную информацию
            if (!err) socket.emit('table', res);
          });
          // сразу выдать хоть какую-то информацию
          // socket.emit('table', tasksTable.rows);
        }
      }
    });
  });


  // DB LISTEN
  /////////////////////////////////////////////
  console.info('> pg: connecting to ' + pg.defaults.host);
  pg = new pg.Client();
  pg.connect(function(err) {
    if (err) {
      err.status = 503;
      err.msg = 'ошибка подключения к базе данных';
      throw err;
    }
    // fetch initial tables:
    tasksTable.get();
    evLog.get();
  });

  // listen all
  pg.query('LISTEN task_data_change;LISTEN tree_obj_append;LISTEN tree_obj_del;LISTEN tree_obj_move;LISTEN location_rename;' +
    'LISTEN equip_data_change;LISTEN vlan_list_change;LISTEN dns_data_change');
  var sent = {}; //loc:'', ip:'', dns:'', vlan:'', eqchange:''};
  pg.on('notification', function(msg) {
    //console.debug(msg);

    if (msg.channel.toLowerCase() === 'task_data_change') {
      if (io.sockets.clients('tasks').length > 0) { // check that clients exist
        tasksTable.get(function(err, res) {
          if (!err) io.sockets.in('tasks').emit('table', res);
        });
      }
    } else {
      //console.log('message:', msg);
      evLog.getChanged(function(err, changed) {
        if (!err) {
          io.sockets.emit('evlog', changed);
        }
      });
      if (['tree_obj_append', 'tree_obj_del', 'tree_obj_move', 'location_rename'].indexOf(msg.channel.toLowerCase()) !== -1) {
        if (sent.loc !== msg.processId) {
          io.sockets.emit('locTree', msg.channel.toLowerCase());
          sent.loc = msg.processId;
        }
      }
      if (['vlan_list_change', 'equip_data_change'].indexOf(msg.channel.toLowerCase()) !== -1) {
        if (sent.vlan !== msg.processId) {
          io.sockets.emit('vlanTree', msg.channel.toLowerCase());
          sent.vlan = msg.processId;
        }
      }
      if (msg.channel.toLowerCase() === 'dns_data_change') {
        if (sent.dns !== msg.processId) {
          io.sockets.emit('dnsTree', msg.channel.toLowerCase());
          sent.dns = msg.processId;
        }
      }
      if (msg.channel.toLowerCase() === 'equip_data_change') {
        if (sent.eqchange !== msg.processId) {
          io.sockets.emit('eqChange', msg.channel.toLowerCase());
          sent.eqchange = msg.processId;
        }
      }
    }
  });

  function getChanged(callback) {
    var callback = callback || function() {};
    pg.query('SELECT id,ts,usr,obj_id,action_name,message FROM ev_log ORDER by id DESC LIMIT 10', function(err, res) {
      if (err) return callback(err);

      if (res.rows.length > 0) {
        //console.log(res.rows);
        var changed = objectArrayDiff(res.rows, lastChanged);
        lastChanged = res.rows;
        return callback(null, changed);
      }
    });
  }
};
