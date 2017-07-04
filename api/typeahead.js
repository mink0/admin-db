var pg = require('pg');
/*
* Все функции здесь работаюст без авторизации для ускорения работы
* Проверь работу connection pool
* */

module.exports = function(req, res, next) {
  var lib = {
    'type_ahead': function(args, callback) {
    var MAX_LEN = 8; // number of items in typeahead
    var sFields = ['label', 'serial_number', 'fio', 'fqdn', 'host(ip_addr)', 'text(mac)',
      'vendor_name', 'model_name', 'type_name', 'comments'];

    // convert for ILIKE search:
    if (args.in === 'ip_addr') {
      args.in = 'host(' + args.in + ')';
    } else if (args.in === 'mac') {
      args.in = 'text(' + args.in + ')';
    }

    if(!args.q || args.q.length > 128)
      return callback('Превышена допустимая длинна строки поиска');
    if (args.in) {
      if (args.in !== 'net' && args.in !=='loc' && sFields.indexOf(args.in) < 0)
        return callback('Неизвестный параметр поиска ' + args.in);
    }

    var query, values;
    if (args.in) {
      // строгий, но медленный поиск ILIKE в одной колонке
      if (args.in === 'net') {
        query = "SELECT addr, note FROM nets_ip_v WHERE (nets_ip_v.addr, nets_ip_v.note)::text ILIKE '%'||$1||'%' ORDER BY addr, note LIMIT " + MAX_LEN;
      } else if (args.in === 'loc') {
        query = 'SELECT loc_type_name, name, tree_f_get_path(obj_id) FROM loc_v WHERE ' +
        'to_tsvector((name, loc_type_name, tree_f_get_path(obj_id))::text) @@ plainto_tsquery($1) ' +
        'ORDER BY loc_type_name, name LIMIT ' + MAX_LEN;
      } else {
        query = 'SELECT DISTINCT ' + args.in + ' FROM all_equip_v WHERE ' + args.in + " ILIKE  '%'||$1||'%' " + " ORDER BY " + args.in + " ASC LIMIT " + MAX_LEN;
      }
      values = [args.q];
    } else {
      // FIXME: для скорости нужен full text search
      // для еще большей скорости нужны GIN или to_tsvector индексы в таблице и русские словари: http://sergey-freelancer.blogspot.ru/2011/02/postgresql.html
      // чтобы правильно работал full text search, нужно создавать отдельные векторы для полей с русскими символами
      values = [args.q];
      var sor = sFields[0] + " ILIKE '%'||$1||'%' ";
      for (var i=1; i < sFields.length; i++)
        sor += (" OR " + sFields[i] + " ILIKE '%'||$1||'%' ");


      query = 'SELECT ' + sFields.join() + ' FROM all_equip_v WHERE ' +
        sor + ' ORDER BY LABEL LIMIT ' + MAX_LEN * MAX_LEN;
    }

    //var pgclient = res.locals.pgClientNoAuth;
    pg.defaults = res.locals.pg.defaults;
    pg.connect(function(err, client, done) {
      if (err) {
        err.status = 503;
        err.msg = 'ошибка подключения к базе данных';
        return callback(err);
      }
      //console.log(args.q); console.log(query.split("'||$1||'").join(args.q) + ';');
      client.query(query, values, function(err, res) {
        done();
        if (err) return callback(err);
        //console.log(res.rows);
        // filter and limit the results
        var out = [], count = 0;
        for(var i = 0; i < res.rows.length; i++) {
          if (count >= MAX_LEN) break;
          for(var k in res.rows[i]) {
            if (count >= MAX_LEN) break;
            if (res.rows[i][k]
              && out.indexOf(res.rows[i][k]) < 0
              && res.rows[i][k].toLowerCase().indexOf(args.q.toLowerCase()) > -1) {
              out.push(res.rows[i][k]);
              count++;
            }
          }
        }
        return callback(null, out);
      });
    });
    }
  };

  // parse input parameters
  var p = req.query;
  // run
  lib['type_ahead'](p, function(err, result) {
    if (err) console.error(err);
    res.send(result);
  });
};
