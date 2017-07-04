(function($) {
  //  var socket = new SockJS(sockjs_url);
  var TABLE_LEN = 20;

  function Table(thead, options) {
    this.self = this;
    this.thead = thead;
    this.placeholder = options.placeholder;
    this.tableClass = options.class || '';
    this.maxrows = options.maxrows;

    this.$table = $('<table></table>').addClass(this.tableClass);

    var $row = '<thead>';
    if (typeof thead[0] === 'object') {
      for (var i = 0; i < thead.length; i++) {
        for (var k in thead[i]) {
          if (!thead[i].hasOwnProperty(k)) continue;
          $row += '<th>' + k + '</th>';
        }
      }
    } else {
      for (var i = 0; i < thead.length; i++) {
        $row += '<th>' + thead[i] + '</th>';
      }
    }

    $row += '</thead>';
    this.$table.append($row);

    if (this.placeholder) $(this.placeholder).append(this.$table);
    //return this.$table;
    //return this;
  }
  Table.prototype = {
    rowCount: function() {
      return $('tr', $(this.$table).find('tbody')).length;
    },
    _makeRow: function(row, rowClass, append) {
      //var append = appendLast || false;
      // if ($('#visits tr').length > TABLE_LEN) {
      //   $('#visits tr:last').remove();
      // }
      // $('#visits tbody').prepend('<tr><td>' + url(data.url) + '</td><td>' + data.ip + '</td><td><a title="' + data.agent + '">' + data.agent.split(' ')[0] + '</a></td><td>' + data.ts + '</td></tr>');

      if (this.maxrows && (this.rowCount() + 1) > this.maxrows) {
        // console.log('need delete');
        if (append) {
          $(this.$table).find('tbody > tr:first').remove();
        } else {
          $(this.$table).find('tbody > tr:last').remove();
        }
      }
      var $row = '<tr>';
      if (typeof row === 'object') {
        for (var i = 0; i < this.thead.length; i++) {
          for (var k in this.thead[i]) {
            if (!this.thead[i].hasOwnProperty(k)) continue;
            $row += '<td>' + row[this.thead[i][k]] + '</td>';
          }
        }
      } else {
        for (var i=0; i<row.length; i++) {
          $row += '<td>' + row[i] + '</td>';
        }
      }
      $row += '</tr>';
      return $($row).addClass(rowClass);
    },
    appendRow: function(row, rowClass) {
      this.$table.append(this._makeRow(row, rowClass, true));
    },
    prependRow: function(row, rowClass) {
      this.$table.prepend(this._makeRow(row, rowClass, false));
    }
  };

  var tableVisits = new Table(
    [{
      'Время': 'ts'
    }, {
      'URL': 'url'
    }, {
      'IP': 'ip'
    }, {
      'Браузер': 'agent'
    }], {
      placeholder: '#table-visits',
      class: 'table table-bordered table-hover table-condensed',
      maxrows: TABLE_LEN
    });

  var tableLog = new Table(
    [{
      'Время': 'ts'
    }, {
      'Уровень': 'levelname'
    }, {
      'Источник': 'name'
    }, {
      'Сообщение': 'message'
    }], {
      placeholder: '#table-log',
      class: 'table table-bordered table-hover table-condensed',
      maxrows: 40
    });
  tableLog.prependRow = function(row, rowClass) {
    if (!rowClass) {
      var cl = '';
      if (row.levelname === 'WARN') {
        cl = 'warning';
      } else if (row.levelname === 'ERROR' || row.levelname === 'CRITICAL') {
        cl = 'danger';
      }

      this.$table.prepend(this._makeRow(row, cl, true));
    } else {
      this.$table.prepend(this._makeRow(row, rowClass, true));
    }
  };

  function url(text, maxlen) {
    return '<a href="' + text + '">' + text + '</a>'
  }


  var socket = io.connect('/dashboard');
  // socket.on('connect', function(){
  //   socket.on('event', function(data){});
  //   socket.on('disconnect', function(){});
  // });
  //var sockjs_url = '/dashboard';

  socket.on('connect', function() {
    $('.alerts .reload').addClass('hidden');
    socket.emit('join', 'dboard');
    socket.on('history', function(data) {
      $('#connections').html(data.conns);
      $('#host-name').html(data.staticInf.hostname);
      //$('#host-os').html(data.staticInf.platform + ' ' + data.staticInf.release);
      renderOnlineInf(data.onlineInf);

      for (var i = 0, len = data.actBuf.length; i < len; i++) {
        tableVisits.prependRow(data.actBuf[i]);
      }
      for (var i = 0, len = data.logBuf.length; i < len; i++) {
        tableLog.prependRow(data.logBuf[i]);
      }
    });

    socket.on('server_inf', function(data) {
      renderOnlineInf(data);
    });

    socket.on('users_act', function(data) {
      $('#connections').html(data.conns);
      tableVisits.prependRow(data);
    });

    socket.on('counter', function(data) {
      $('#connections').html(data);
    });

    socket.on('log_info', function(data) {
      tableLog.prependRow(data);
    });

    socket.on('disconnect', function() {
      $('.alerts .ok').click(function() {
        window.location.reload();
      });
      $('.alerts .reload').removeClass('hidden').fadeIn();
      //$('.alerts .reload').fadeIn();
      //alert('Соединение с сервером потеряно. Перезагрузить страницу?');
      // window.setInterval(window.location.reload(), 1000);
    });
  });

  function renderOnlineInf(data) {
    $('#host-load').html(data.loadavg);
    $('#host-upt').html(data.uptime);
    $('#node-upt').html(data.node.uptime);
    $('#host-mem').html(data.freemem);
    $('#node-cpu').html(data.node.cpu);
    $('#node-mem').html(data.node.mem);
  }
  // function renderOnlineActivity(data) {
  //   if ($('#visits tr').length > TABLE_LEN) {
  //     $('#visits tr:last').remove();
  //   }
  //   $('#visits tbody').prepend('<tr><td>' + url(data.url) + '</td><td>' + data.ip + '</td><td><a title="' + data.agent + '">' + data.agent.split(' ')[0] + '</a></td><td>' + data.ts + '</td></tr>');
  // }

  // function renderLog(data) {
  //   if ($('#log tr').length > TABLE_LEN) {
  //     $('#log tr:last').remove();
  //   }
  //   $('#log tbody').prepend('<tr><td>' + data.timestamp + '</td><td>' + data.name + '</td><td>' + data.levelname + '</td><td>' + data.message + '</td></tr>');
  // }

  /*  $(document).on('click', '.panel-heading span.clickable', function(e) {
    var $this = $(this);
    if (!$this.hasClass('panel-collapsed')) {
      $this.parents('.panel').find('.panel-body').slideUp();
      $this.addClass('panel-collapsed');
      $this.find('i').removeClass('glyphicon-chevron-up').addClass('glyphicon-chevron-down');
    } else {
      $this.parents('.panel').find('.panel-body').slideDown();
      $this.removeClass('panel-collapsed');
      $this.find('i').removeClass('glyphicon-chevron-down').addClass('glyphicon-chevron-up');
    }
  });*/

})(jQuery);