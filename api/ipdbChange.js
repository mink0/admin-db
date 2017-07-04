var utils = require('./utils'),
  async = require('async');

module.exports = function(req, res, next) {
  /*
   * Сюда приходят AJAX запросы на ИЗМЕНЕНИЕ данных БД.
   * API v3:
   *   GET для простых запросов (лучше без входных данных). это самый быстрый интерфейс, 1 + 1 пакет
   *   POST для передачи длинных вложенных входных данных
   *  1. HTTP GET:
   *    url: /:fname?param1=value1[,param2=value2]
   *  2. HTTP POST
   * делаем параллельные запросы по всем функциям, перечисленным во входных данных
   * ответ когда все функции закончат выполнение работы
   *    url: /
   *    {
   *      global1: value1,
   *      global2: value2,
   *      ...
   *      fname1 : {param1: value1, param2: value2, ...},
   *      [fname2 : {param1: value1, param2: value2, ...}]
   *      ...
   *    }
   *
   * ПРИМЕР ВХОДНЫХ ДАННЫХ:
   *  {
   *   eqLabel: 'PCM-000-001',
   *   eqObjId: 10012,
   *   location: {},
   *   treeseq: {},
   *   ipobjid: {
   *     eqObjId: 1900,
   *     eqLabel: 'SRV-000-001'
   *   },
   *  }
   * */

  var lib = {
    'task_update_dhcp': function task_update_dhcp(args, callback) {
      log('обновление DHCP', args);
      client.query('SELECT task_f_register_update_dhcp(fqdn, NULL) FROM dhcp_server_list_v WHERE is_active=true', function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'task_update_dns': function task_update_dns(args, callback) {
      log('обновление DNS', args);
      client.query('SELECT task_f_register_update_dns(fqdn, NULL) FROM dns_mgmt_master_v', function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'dns_domain_edit': function dns_domain_edit(args, callback) {
      if (!args.dnsObjId) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('редактирование параметров домена', args);
      //dns_f_domain_edit(i_obj_id bigint, i_new_name character varying, i_new_descr character varying, i_forward_ip inet)
      client.query({
        text: 'SELECT dns_f_domain_edit(i_obj_id:=$1, i_new_name:=$2, i_new_descr:=$3, i_forward_ip:=$4)',
        values: [args.dnsObjId, args.name, args.comments, args.fwip]
      }, function(err, res) {
        if (err) return callback(null, {
          warn: err.message
        });
        return callback(null, 'ok');
      });
    },
    'net_dhcp_set': function net_dhcp_set(args, callback) {
      if (!args.ip) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('редактирование dhcp параметров сети', args);
      //BIGINT dhcp_f_net_settings_set ( I_net_addr INET ,I_profile_name VARCHAR ,I_default_gw INET ,I_shared_net_name VARCHAR )
      client.query({
        text: 'SELECT dhcp_f_net_settings_set(I_net_addr:=$1, I_profile_name:=$2, I_default_gw:=$3, I_shared_net_name:=$4)',
        values: [args.ip, args.dhcp_profile, args.gw, args.shared_name]
      }, function(err, res) {
        if (err) return callback(null, {
          warn: err.message
        });
        return callback(null, 'ok');
      });
    },
    'net_dhcp_del': function net_dhcp_del(args, callback) {
      if (!args.ip) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('удаление dhcp параметров сети', args);
      client.query('SELECT dhcp_f_net_settings_delete($1)', [args.ip], function(err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'net_pool_set': function net_pool_set(args, callback) {
      if (!args.ip) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('создание dhcp pool сети', args);
      //VOID dhcp_f_net_pool_set ( I_net_addr INET ,I_pool_start_addr INET ,I_pool_amount INTEGER ) задаёт пул адресов в сети.
      client.query({
        text: 'SELECT dhcp_f_net_pool_set(I_net_addr:=$1, I_pool_start_addr:=$2, I_pool_amount:=$3)',
        values: [args.ip, args.pool_start, args.pool_amount]
      }, function(err, res) {
        if (err) return callback(null, {
          warn: err.message
        });
        return callback(null, 'ok');
      });
    },
    'net_pool_del': function net_dpool_del(args, callback) {
      if (!args.ip) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('удаление dhcp pool сети', args);
      client.query('SELECT dhcp_f_net_pool_delete($1)', [args.ip], function(err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'net_comments_edit': function net_comments_edit(args, callback) {
      if (!args.ipObjId) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('редактирование комментария для сети', args);
      //VOID ip_f_net_note_change ( I_obj_id BIGINT, I_new_note VARCHAR ) изменяет заметку о сети.
      client.query('SELECT ip_f_net_note_change($1, $2)', [args.ipObjId, args.comments], function(err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'iface_edit': function iface_edit(args, callback) {
      if (!(args.eqObjId && args.ifObjId)) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('редактирование интерфейса', args);
      //VOID iface_f_edit ( I_equip_obj_id BIGINT, I_obj_id BIGINT, I_new_name VARCHAR, I_new_mac MACADDR, I_new_dhcpoffer_everywhere BOOLEAN, I_new_is_trunk BOOLEAN ) изменяет данные об интерфейсе. Если интерфейс с указанным I_obj_id не существует, то у заданного устройства I_equip_obj_id создаётся новый интерфейс.
      client.query({
          text: 'SELECT iface_f_edit($1, $2, $3, $4, $5, $6)',
          values: [null, args.ifObjId, args.name, args.mac, args.every, args.isTrunk]
        },
        function(err, res) {
          //console.dir(client);
          if (err) return callback(null, {warn: err.message});
          return callback(null, 'ok');
        }
      );
    },
    'if_dhcp_edit': function if_dhcp_edit(args, callback) {
      //FIXME: notify не высылается
      //VOID iface_f_ip_edit ( I_if_obj_id BIGINT, I_ip_addr INET, I_assigned_dhcp BOOLEAN )
      if (args.hasOwnProperty('dhcpP')) {
        log('изменение профиля DHCP для ip адреса', args);
        if (args.dhcpP) {
          //BIGINT dhcp_f_addr_settings_set ( I_addr INET ,I_profile_name VARCHAR ) задаёт профиль DHCP указанному IP-адресу.
          client.query('SELECT dhcp_f_addr_settings_set($1, $2)', [args.ip, args.dhcpP], function (err, res) {
            if (err) return callback(null, {warn: err.message});
            return callback(null, 'ok');
          });
        } else {
          //VOID dhcp_f_addr_settings_delete ( I_addr INET ) удаляет привязку профиля DHCP у указанного IP-адреса.
          client.query('SELECT dhcp_f_addr_settings_delete($1)', [args.ip], function (err, res) {
            if (err) return callback(null, {warn: err.message});
            return callback(null, 'ok');
          });
        }
      } else {
        log('редактирование св-ва "получать по DHCP" для ip адреса', args);
        client.query('SELECT iface_f_ip_edit(I_if_obj_id:=$1, I_ip_addr:=$2, I_assigned_dhcp:=$3)', [args.ifObjId, args.ip, args.isDyn], function (err, res) {
          if (err) return callback(null, {warn: err.message});
          return callback(null, 'ok');
        });
      }
    },
    'if_add': function if_add(args, callback) {
      log('добавление нового интерфейса', args);
      //BIGINT iface_f_append ( I_equip_obj_id BIGINT, I_name VARCHAR, I_mac MACADDR, I_dhcpoffer_everywhere BOOLEAN, I_ifindex INTEGER, I_is_trunk BOOLEAN, )
      client.query({
          text: 'SELECT iface_f_append($1, $2, $3, $4, $5, $6)',
          values: [args.eqObjId, args.ifname, args.mac, args.every, null, args.isTrunk]},
        function(err, res) {
          if (err) return callback(null, {warn: err.message});
          return callback(null, 'ok');
        }
      );
    },
    'if_del': function if_del(args, callback) {
      log('удаление интерфейса', args);
      //BIGINT iface_f_delete ( I_obj_id BIGINT ) удаляет интерфейс, его MAC и IP, если есть.
      client.query('SELECT iface_f_delete($1)', [args.ifObjId], function (err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'ip_add': function ip_add(args, callback) {
      log('назначение нового ip адреса', args);
      //VOID iface_f_ip_append ( I_if_obj_id BIGINT, I_ip_addr INET, I_assigned_dhcp BOOLEAN )
      client.query({
          text: 'SELECT iface_f_ip_append($1, $2, $3)',
          values: [args.ifObjId, args.ip, args.isDyn]},
        function(err, res) {
          if (err) return callback(null, {warn: err.message});
          return callback(null, 'ok');
        }
      );
    },
    'ip_del': function ip_del(args, callback) {
      log('удаление ip адреса', args);
      //VOID iface_f_ip_delete ( I_if_obj_id BIGINT, I_ip_addr INET )
      client.query('SELECT iface_f_ip_delete(I_if_obj_id:=$1, I_ip_addr:=$2)', [args.ifObjId, args.ip], function (err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'eq_add_old': function eq_add_old(args, callback) {
      var fnEqAdd = utils.getDBfname('equip_add', eqLabel);
      if (fnEqAdd.err) return callback(fnEqAdd.err);

      if (args.mac && args.ip || args.ip) {
        log('добавление нового устройства, создание интерфейса, назначение ip', args);
        client.query({
            text: 'SELECT iface_f_ip_append(if_obj_id, $12, $13) \
            FROM \
              (SELECT iface_f_append(eq_obj_id, $7, $8, $9, $10, $11) AS if_obj_id \
              FROM \
                (SELECT ' + fnEqAdd + '(I_label:=$1, I_model_id:=$2, I_serial_number:=$3, I_status_name:=$4, I_parent_obj_id:=$5, I_placement:=$6) AS eq_obj_id \
              ) as q1 \
            ) as q2',
            values: [eqLabel, args.model_id, args.serial, args.status_name, args.location, null, 'eth', args.mac, false, null, false, args.ip, true]},
          function(err, res) {
            if (err) return callback(null, {warn: err.message});

            return callback(null, 'ok');
          }
        );
      } else if (args.mac) {
        log('добавление нового устройства, создание интерфейса', args);
        client.query({
            text: 'SELECT iface_f_append(eq_obj_id, $7, $8, $9, $10, $11) AS if_obj_id \
              FROM \
                (SELECT ' + fnEqAdd + '(I_label:=$1, I_model_id:=$2, I_serial_number:=$3, I_status_name:=$4, I_parent_obj_id:=$5, I_placement:=$6) AS eq_obj_id \
              ) as q1',
            values: [eqLabel, args.model_id, args.serial, args.status_name, args.location, null, 'eth', args.mac, false, null, false]},
          function(err, res) {
            if (err) return callback(null, {warn: err.message});

            return callback(null, 'ok');
          }
        );
      } else {
        log('добавление нового устройства', args);
        //BIGINT equip_f_pcm_with_label_append ( I_label VARCHAR, I_model_id BIGINT, I_serial_number VARCHAR, I_status_name VARCHAR, I_parent_obj_id BIGINT, I_placement VARCHAR ) добавляет новый ПК с указаннным ярлыком в дерево
        client.query({
            text: 'SELECT ' + fnEqAdd + '(I_label:=$1, I_model_id:=$2, I_serial_number:=$3, I_status_name:=$4, I_parent_obj_id:=$5, I_placement:=$6)',
            values: [eqLabel, args.model_id, args.serial, args.status_name, args.location, null]},
          function(err, res) {
            console.log(p)
            console.log([eqLabel, args.model_id, args.serial, args.status_name, args.location, null]);
            if (err) return callback(null, {warn: err.message});

            return callback(null, 'ok');
          }
        );
      }
    },
    'eq_snmp_fill': function eq_snmp_fill(args, callback) {
      // BIGINT task_f_register_fill_data ( I_label VARCHAR ,I_ip VARCHAR ,I_community VARCHAR ,I_login VARCHAR ,I_password VARCHAR ) регистрирует задание по заполнению данных об устройстве. Параметры I_login и I_password могут быть NULL.
      if (!(args.eqLabel)) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('загрузка информации с устройства', args);
      client.query('SELECT task_f_register_fill_data(I_label:=$1)', [args.eqLabel], function(err, res) {
        if (err) return callback(err.message);
        return callback(null, 'ok');
      });
    },
    'eq_prop_edit': function eq_prop_edit(args, callback) {
      if (!(args.eqObjId && args.eqLabel)) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('редактирование свойств устройства', args);
      // есть исключение fnEdit для vsr
      var values = [args.eqObjId, args.status, args.serial, null];
      var fnEdit = getDBfname('equip_edit', args.eqLabel, values);
      //console.log(fnEdit);
      if (fnEdit.err) return callback(null, {warn: fnEdit.err});
      client.query(fnEdit.queryText, fnEdit.values, function(err, res) {
        if (err) return callback(null, {warn: err.message});
        return callback(null, 'ok');
      });
    },
    'eq_prop_user': function eq_prop_user(args, callback) {
      if (!(args.eqObjId)) {
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      }
      log('назначение пользователя устройству', args);
      var resSent = false;
      if (!args.fio) {
        doQuery(null);
      } else {
        var ldap = res.locals.ldapClient;
        var opts = {
          filter: '(&(&(&(objectclass=user)(objectcategory=person)(name=*' + args.fio + '*))))',
          scope: 'sub',
          attributes: ['sAMAccountName'],
          sizeLimit: 1,
          timeLimit: 10
        };
        ldap.search('OU=РКК,DC=gkb,DC=rsc,DC=energia,DC=ru', opts, function(err, res) {
          res.on('searchEntry', function(data) {
            doQuery(data.object.sAMAccountName);
            //console.log(user.sAMAccountName);
            //equip_f_assign_to_user ( I_equip_obj_id BIGINT ,I_user_login VARCHAR ,I_comments VARCHAR )
          });
          res.on('error', function(err) {
            if (!resSent) {
              return callback(null, {warn: 'ошибка поиска пользователя с именем ' + args.fio});
            }
          });
          res.on('end', function(result) {
            if (!resSent) {
              return callback(null, {warn: 'пользователь с именем ' + args.fio + ' не найден'});
            }
          });
        });
      }
      function doQuery(user) {
        resSent = true;
        client.query({
            text: 'SELECT equip_f_assign_to_user(I_equip_obj_id:=$1, I_user_login:=$2, I_comments:=$3)',
            values: [args.eqObjId, user, args.comments]
          }, function(err, res) {
            if (err) return callback(null, {warn: err.message});
            return callback(null, 'ok');
        });
      }
    },
  };

  // prepare
  var rUserName = req.user.name;
  var client = res.locals.pgClient;
  var requestError = new utils.ErrorHandler(req, res, next);

  var log = function(msg, args) {
    console.info(rUserName + '> ' + msg, args);
  };

  // parse input parameters
  var p = {}, global = {};
  if (req.params.fname) {
    p[req.params.fname] = req.query; // only for ajax.get requests!
  } else {
    for (var key in req.body)
      // пропускаем кэш (_rnd) (актуально для GET запросов)
      if (key !== '_' && (req.body.hasOwnProperty(key)))
        if (typeof req.body[key] === 'string' || typeof req.body[key] === 'number')
          global[key] = req.body[key];  // для глобальных переменных
        else
          p[key] = req.body[key];
  }

  var results = {};
  // Applies an iterator function to each item in an array in parallel.
  // It wouldn't stop all queries on error. Use eachSeries instead.
  async.each(Object.keys(p), function(fname, callback) {
    if (!lib.hasOwnProperty(fname)) {
      return callback('неизвестная функция: ' + fname);
    }
    // run the function from lib
    //console.log(fname, ' - ', p[fname]);
    var inp = {};
    if (global)
      for (var k in global)
        inp[k] = global[k];
    for (var k in p[fname])
      inp[k] = p[fname][k];
    lib[fname](inp, function(err, res) {
      if (err) return callback(err);
      else {
        results[fname] = res;
        return callback();
      }
    });
  }, function(err) {
    // when all done
    client.end();
    if (err) return requestError.error(err);
    if (req.params.fname)
      results = results[req.params.fname]; // only for single ajax.get requests
    return res.send(results);
  });
};
