var utils = require('./utils'),
  async = require('async'),
  Netmask = require('netmask').Netmask;

module.exports = function(req, res, next) {
  /*
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
   * ПРИМЕР ВХОДНЫХ ДАННЫХ:
   *  {
   *    eqLabel: 'PCM-000-001',
   *    eqObjId: 10012,
   *    location: {},
   *    treeseq: {},
   *    ipobjid: {
   *      eqObjId: 1900,
   *      eqLabel: 'SRV-000-001'
   *    },
   *  }
   * */

  var lib = {
    'type_ahead': function type_ahead(args, callback) {
      args.ta = true;
      return this.full_search(args, callback);
    },
    'full_search': function full_search(args, callback) {
      /* Полнотекстовый поиск. Как по всем, так и по отдельным полям */
      if (!args.q) return callback(null, []);

      var MAX_SEARCH_RESULTS = 1000,
      MAX_QUERY_LEN          = 100,
      MAX_TA_LEN             = 8;
      var allowedInList = [
        'serial_number',
        'label',
        'mac',
        'ip_addr',
        'fqdn',
        'fio',
        'net',
        'loc',
      ];
      var filterFields = ['obj_id', 'equip_obj_id', 'parent_obj_id']; // фильтр работает только для typeahead

      if (args.q.length > MAX_QUERY_LEN)
        return callback(null, {warning: 'Превышена допустимая длинна строки поиска'});

      if (args.in && allowedInList.indexOf(args.in) < 0)
        return callback('Неизвестный параметр поиска');

      var taLimit = '';
      if (args.ta) {
        if (args.in === 'net' || args.in == 'loc') {
          taLimit = ' LIMIT ' + MAX_TA_LEN;
        } else {
          taLimit = ' LIMIT ' + MAX_TA_LEN*MAX_TA_LEN;
        }
      }

      function findNet(callback) {
        client.query("SELECT obj_id, addr, note FROM nets_ip_v WHERE (nets_ip_v.addr, nets_ip_v.note)::text ILIKE '%'||$1||'%'" + taLimit, [args.q], function(err, res) {
          if (err) return callback(err);
          return callback(null, res.rows);
        });
      }

      function findLoc(callback) {
        client.query('SELECT obj_id, loc_type_name, name, tree_f_get_path(obj_id) FROM loc_v WHERE ' +
          'to_tsvector((name, loc_type_name, tree_f_get_path(obj_id))::text) @@ plainto_tsquery($1) ' +
          'ORDER BY loc_type_name, name' + taLimit, [args.q], function(err, res) {
          if (err) return callback(err);
          return callback(null, res.rows);
        });
      }

      function findEquip(callback) {
        var query, values;

        var RE_MAC_TIRE = /^(([A-Fa-f0-9]{2}[-]){5}[A-Fa-f0-9]{2}[,]?)+$/;
        var RE_MAC_CISCO = /^(([A-Fa-f0-9]{4}[.]){2}[A-Fa-f0-9]{4}[,]?)+$/;

        if (RE_MAC_TIRE.test(args.q)) {
          args.q = args.q.split('-').join(':');
        } else if (RE_MAC_CISCO.test(args.q)) {
          args.q = args.q.split('.').join('');
          var mac = '';
          for (var i=0; i<args.q.length; i+=2) {
            mac += (args.q[i] + args.q[i+1] + ':');
          }
          args.q = mac.slice(0, mac.length - 1);
        }

        if (args.in) {
          // convert for ILIKE search:
          if (args.in === 'mac') {
            args.q = args.q.trim();
            args.q = args.q.split('.').join(':');
            args.q = args.q.split('-').join(':');
            args.q = args.q.split(' ').join(':');
          }
          // if (args.in === 'ip_addr') {
          //   args.in = 'host(' + args.in + ')';
          // } else if (args.in === 'mac') {
          //   args.in = 'text(' + args.in + ')';
          // }
          // строгий, но медленный поиск ILIKE в одной колонке
          // FIXME: "SELECT $4 FROM all_equip_v WHERE $3 ILIKE '%'||$1||'%' ORDER BY $2" + taLimit; - сделал проверку args.in вначале
          query = "SELECT * FROM all_equip_loc_v WHERE " + args.in + "::text ILIKE '%'||$1||'%' ORDER BY $2" + taLimit;
          values = [args.q, args.in];
        } else {
          values = [args.q];
          query = "SELECT * FROM all_equip_loc_v WHERE all_equip_loc_v::text ILIKE '%'||$1||'%' ORDER BY parent_obj_name, type_name" + taLimit;
        }
        //console.log(args.q); console.log(query.split("'||$1||'").join(args.q) + ';');
        client.query(query, values, function(err, res) {
          if (err) return callback(err);
          return callback(null, res.rows);
        });
      }

      function buildPopover(row, q, qIn) {
        var popoverLbl = {
          label: 'Ярлык',
          serial_number: 'Серийный №',
          ip_addr: 'IP-адрес',
          mac: 'MAC-адрес',
          fio: 'ФИО',
          depart: 'Отдел',
          phone_num: 'Тел.',
          comments: 'Коммент.',
          fqdn: 'DNS-имя',
          vendor_name: 'Произв.',
          model_name: 'Модель',
          type_name: 'Тип',
          status: 'Статус',
          net: 'Подсеть',
          note: 'Коммент.',
          obj_id: 'id',
          equip_obj_id: 'id',
          parent_obj_id: 'p_id',
          parent_obj_name: 'Расп.'
        };
        var ending = '\n';

        var popover = '';
        // по всем элементам в row для заполнения popover
        if (qIn) {
          if (qIn === 'net') {
            popover += popoverLbl[qIn] + ': ' + row.addr + ending;
          } else if (qIn === 'loc') {
            popover += popoverLbl[qIn] + ': ' + row.tree_f_get_path + ending;
          } else {
            popover += popoverLbl[qIn] + ': ' + row[qIn] + ending;
          }
        } else {
          for (var key in row) {
            if (popoverLbl[key] && row[key] && row[key].toLowerCase().indexOf(q) !== -1) {
              popover += popoverLbl[key] + ': ' + row[key] + ending;
            }
            //else if (key && key !== 'label' && key !== 'equip_obj_id') {
            //    out[keys[k]][results[k][i].equip_obj_id][key] = results[k][i][key];
            //}
          }
        }
        return popover;
      }

      var searchIn = {
        eq: findEquip,
        ip: findNet,
        loc: findLoc
      };
      if (args.in === 'net') {
        searchIn = { ip: findNet };
      } else if (args.in === 'loc') {
        searchIn = { loc: findLoc };
      } else if (args.in) {
        searchIn = { eq: findEquip };
      }

      async.parallel(searchIn, function(err, results) {
        if (err) return callback(err);
        //console.log(results);

        if (args.ta) {
          // typeahead
          var out = [], count = 0;
          // по всем результатам
          for (var k in results) {
            if (!results.hasOwnProperty(k)) continue;

            if (count >= MAX_TA_LEN) break;
            for(var i = 0, len = results[k].length; i < len; i++) {
              if (count >= MAX_TA_LEN) break;
              if (args.in) {
                if (args.in === 'loc') {
                  out.push(results[k][i]['tree_f_get_path']);
                  count++;
                } else if (args.in === 'net') {
                  out.push(results[k][i]['addr']);
                  count++;
                } else {
                  if (results[k][i][args.in]
                    && filterFields.indexOf(args.in) < 0
                    && out.indexOf(results[k][i][args.in]) < 0)
                    {
                      out.push(results[k][i][args.in]);
                      count++;
                    }
                }
              } else {
                for(var e in results[k][i]) {
                  if (!results[k][i].hasOwnProperty(e)) continue;
                  if (count >= MAX_TA_LEN) break;
                  if (results[k][i][e]
                    && filterFields.indexOf(e) < 0
                    && out.indexOf(results[k][i][e]) < 0
                    && (results[k][i][e].toLowerCase().indexOf(args.q.toLowerCase()) > -1 || e === 'tree_f_get_path'))
                    {
                      out.push(results[k][i][e]);
                      count++;
                    }
                }
              }
            }
          }
          return callback(null, out);
        } else {
          // fulltext search
          var outobj = {},  // объект с результатами
            out = {},       // объект массивов с ссылками на эти результаты
            q = args.q.toLowerCase(),
            resLen = 0,
            qIn = args.in,
            pkey;
          // по всем результатам
          for (var k in results) {
            if (!results.hasOwnProperty(k)) continue;

            if (results[k].length > 0) {
              outobj[k] = {};
              out[k] = [];
            }
            // по каждому row в res.rows
            // используем for loop для бОльшей производительности
            for (var i=0, len=results[k].length; i<len; i++) {
              if (resLen > MAX_SEARCH_RESULTS) return callback(null, {warning: 'Уточните запрос, слишком много результатов'});

              if (k === 'eq') {
                pkey = results[k][i].equip_obj_id;
                if (!outobj[k][pkey]) {
                  resLen++;
                  outobj[k][pkey] = {
                    eqLabel: results[k][i].label,
                    eqObjId: results[k][i].equip_obj_id,
                    ipList: [],
                    dnsList: [],
                    type: results[k][i].type_name,
                    mac: results[k][i].mac,
                    dns: results[k][i].fqdn,
                    loc: results[k][i].parent_obj_name,
                    fio: results[k][i].fio,
                    comments: results[k][i].comments
                  };
                  out[k].push(outobj[k][pkey]);
                }
                // заполним массив ipList, dnsList
                if (results[k][i].ip_addr) {
                  if (outobj[k][pkey].ipList.indexOf(results[k][i].ip_addr) === -1) {
                    outobj[k][pkey].ipList.push(results[k][i].ip_addr);
                    if (typeof results[k][i].fqdn === 'string' || results[k][i].fqdn instanceof String)
                      outobj[k][pkey].dnsList.push(results[k][i].fqdn.split('.')[0]);
                    else
                      outobj[k][pkey].dnsList.push(' ');
                  }
                }
                outobj[k][pkey].popover = buildPopover(results[k][i], q, qIn);
              } else if (k === 'ip') {
                pkey = results[k][i].obj_id;
                if (!outobj[pkey]) {
                  resLen++;
                  outobj[k][pkey] = {
                    ip: results[k][i].addr,
                    ipObjId: results[k][i].obj_id,
                    comments: results[k][i].note
                  };
                  out[k].push(outobj[k][pkey]);
                }
                outobj[k][pkey].popover = buildPopover(results[k][i], q, qIn);
              } else if (k === 'loc') {
                pkey = results[k][i].obj_id;
                if (!outobj[pkey]) {
                  resLen++;
                  outobj[k][pkey] = {
                    name: results[k][i].name,
                    locObjId: results[k][i].obj_id,
                    locType: results[k][i].loc_type_name,
                    path: results[k][i].tree_f_get_path.replace(/> /g, '/')
                  };
                  out[k].push(outobj[k][pkey]);
                }
                outobj[k][pkey].popover = results[k][i].tree_f_get_path.replace(/> /g, '/');
              }
            }
            /*
             if (res.rows[i].ip_addr) row.popover += 'IP-адрес: ' + res.rows[i].ip_addr + ending;
             if (res.rows[i].fqdn) row.popover += 'DNS&nbsp;имя: ' + res.rows[i].fqdn + ending;
             if (res.rows[i].comments) row.popover += 'Комментарий: ' + res.rows[i].comments + ending;
             if (res.rows[i].fio) row.popover += 'ФИО: ' + res.rows[i].fio + ending;
             if (res.rows[i].serial_number) row.popover += 'Серийный&nbsp;№: ' + res.rows[i].serial_number + ending;
             */
            //out.push(row);
          }

          out.length = resLen;
          // NB: важно возвращать массивы чтобы сохранить порядок сортировки
          //console.log(out);
          return callback(null, out);
        }
      });
    },
    'tree_obj_id': function tree_obj_id(args, callback) {
      client.query('SELECT tree_obj_id FROM nets_ip_tree_v WHERE obj_id = $1', [args.obj_id], function(err, res) {
        if (err) return callback(err);
        if (res.rowCount == 0) return callback(null, null);
        return callback(null, res.rows[0].tree_obj_id); // а тут есть )
      });
    },
    'eq_objid': function eq_objid(args, callback) {
      // find obj_id by label
      if (!args.eqLabel && !args.ip)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      var query, values;
      if (args.eqLabel) {
        query = 'SELECT obj_id FROM equip_obj_v WHERE LOWER(label) = LOWER($1)';
        values = [args.eqLabel];
      } else if (args.ip) {
        query = 'SELECT equip_obj_id AS obj_id FROM all_equip_v WHERE ip_addr = $1';
        values = [args.ip];
      }
      client.query(query, values, function(err, res) {
        if (err) return callback(err);
        if (res.rowCount == 0) return callback(null, null); // нет устройства
        return callback(null, res.rows[0].obj_id); // а тут есть )
      });
    },
    'ip_objid': function ip_objid(args, callback) {
      // find obj_id by label
      if (!args.ip)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      client.query('SELECT obj_id, note FROM nets_ip_v WHERE addr = $1', [args.ip], function(err, res) {
        if (err) return callback(err);
        if (res.rowCount == 0) return callback(null, null); // нет устройства
        return callback(null, { ipObjId: res.rows[0].obj_id, comments: res.rows[0].note }); // а тут есть )
      });
    },
    'net_objid': function net_objid(args, callback) {
      // find net obj_id by ip
      if (!args.ip)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      client.query('SELECT net_addr, net_obj_id FROM addrs_ip_v WHERE addr = $1', [args.ip], function(err, res) {
        if (err) return callback(null, 'err'); // неправильный ip
        if (res.rowCount == 0) return callback(null, 'unknown'); // нет сети
        return callback(null, res.rows[0]); // а тут есть
      });
    },
    'tree_seq': function tree_seq(args, callback) {
      // load branch sequence for branch expanding
      //console.log(args);
      var columns = {};
      if (args.t === 'nets_ip_tree') {
        columns = {
          rootLevel: '1',
          table: 'nets_ip_tree_v',
          objId: 'tree_obj_id',
          parentObjId: 'parent_tree_obj_id'
        }
      } else {
        columns = {
          rootLevel: '1',
          table: 'tree_v',
          objId: 'obj_id',
          parentObjId: 'parent_obj_id',
        }
      }

      if (!args[columns.objId])
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      var seq = [args[columns.objId]];
      function doReqursion(node_id) {
        findParent(node_id, function(err, parent) {
          if (err) return callback(err);
          if (parent == columns.rootLevel || parent === null) {
            // return here:
            seq.reverse();
            return callback(null, seq);
          } else {
            seq.push(parent);
            doReqursion(parent);
          }
        });
      }

      //client.query('SELECT parent_obj_id FROM tree_v WHERE obj_id = $1', [node_id], function(err, res) {
      function findParent(node_id, cb) {
        client.query('SELECT ' + columns.parentObjId + ' FROM ' + columns.table + ' WHERE '+ columns.objId +' = $1', [node_id], function(err, res) {
          if (err) return cb(err);
          if (res.rows.length == 0) {
            return cb(null, null)
          } else {
            return cb(null, res.rows[0][columns.parentObjId]);
          }
        });
      }

      doReqursion(seq[0]);
    },
    'tree_children': function tree_children(args, callback) {
      // получения списка вложенных objId для журнала событий дерева подсетей

      var seq = [], t, count = 0;
      function doReqursion(node_id) {
        findChildren(node_id, function(err, res) {
          if (err) return callback(err);
          count--;
          if (res !== null) {
            res.forEach(function(node) {
              t = {};
              t[node.tree_obj_id] = node.obj_id
              seq.push(node);
              doReqursion(node.tree_obj_id);
            });
          } else if (res === null && count === 0) {
            // return here:
            var out = [];
            seq.forEach(function(node) {
              if (node.obj_id) out.push(node.obj_id);
            });
            return callback(null, out);
          }
        });
      }

      //client.query('SELECT parent_obj_id FROM tree_v WHERE obj_id = $1', [node_id], function(err, res) {
      function findChildren(node_id, cb) {
        count++;
        client.query('SELECT tree_obj_id, obj_id, parent_tree_obj_id FROM nets_ip_tree_v WHERE parent_tree_obj_id = $1', [node_id], function(err, res) {
          if (err) return cb(err);
          if (res.rowCount === 0) {
            return cb(null, null)
          } else {
            return cb(null, res.rows);
          }
        });
      }

      doReqursion(args.eqLabel);
    },
    'dns_domains': function dns_domains(args, callback) {
      client.query('SELECT obj_id, domain_name, descr, zone_type, forward_ip FROM dns_domains_v ORDER BY domain_name DESC', [], function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'dns_prop': function dns_prop(args, callback) {
      client.query('SELECT domain_name, descr, zone_type, forward_ip FROM dns_domains_v WHERE obj_id=$1', [args.dnsObjId], function(err, res) {
        if (err) return callback(err);
        if (res.rowCount == 0) return callback(null, null); // нет устройства
        return callback(null, res.rows[0]); // а тут есть )
      });
    },
    'dns_a': function dns_a(args, callback) {
      if (!args.dnsObjId)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      client.query('SELECT * FROM dns_rr_a_v WHERE domain_obj_id=$1 ORDER BY rname DESC', [args.dnsObjId], function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'dns_by_ip': function dns_by_ip(args, callback) {
      if (!args.ip)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      client.query('SELECT rname, domain_name, fqdn FROM dns_rr_a_v where rvalue=$1 ORDER BY rname DESC', [args.ip], function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'event_log': function event_log(args, callback) {
      //console.log(args);
      if (args.objId || args.objIds) {
        //SELECT ts, usr, label, action_name, message FROM ev_log LEFT OUTER JOIN equip_obj_v ON equip_obj_v.obj_id = ev_log.obj_id where ev_log.obj_id = 19768 order by id desc;
        var id = [args.objId];
        if (args.objIds) id = args.objIds;
        client.query('SELECT ts, usr, label, descr, message FROM ev_log_v LEFT OUTER JOIN equip_obj_v ON equip_obj_v.obj_id = ev_log_v.obj_id where ev_log_v.obj_id = ANY($1::int[]) ORDER BY id DESC', [id], function(err, res) {
          if (err) return callback(err);
          return callback(null, res.rows);
        });
      } else {
        client.query('SELECT ts, usr, label, descr, message FROM ev_log_v LEFT OUTER JOIN equip_obj_v ON equip_obj_v.obj_id = ev_log_v.obj_id order by id desc LIMIT 5000', function(err, res) {
          if (err) return callback(err);
          return callback(null, res.rows);
        });
      }
    },
    'tree_view': function(args, callback) {
      // Kendo UI tree
      var columns = {};
      if (args.t === 'nets_ip_tree') {
        columns = {
          rootLevel: '1',
          table: 'nets_ip_tree_v',
          objId: 'tree_obj_id',
          parentObjId: 'parent_tree_obj_id',
          orderBy: 'addr, addr_text'
        };
      } else if (args.t === 'vlans_tree') {
        columns = {
          rootLevel: '1',
          table: 'vlan_tree_v',
          objId: 'tree_id',
          parentObjId: 'parent_tree_id',
          orderBy: 'vlan_number, obj_text'
        };
      } else {
        columns = {
          rootLevel: '1',
          table: 'tree_v',
          objId: 'obj_id',
          parentObjId: 'parent_obj_id',
          orderBy: 'obj_weight DESC, obj_name ASC'
        };
        if (args.t === 'ip') {
          columns.table = 'tree_ip_v';
        } else if (args.t === 'ipe') {
          columns.table = 'tree_ip_all_v';
        }
      }

      var objId = args[columns.objId] || columns.rootLevel;

      client.query({
        text: 'SELECT * FROM ' + columns.table + ' WHERE ' + columns.parentObjId + ' = $1 ORDER BY ' + columns.orderBy,
        values: [objId]
      }, function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows);
      });
    },
    'vlan_get_eq': function vlan_get_eq(args, callback) {
      if (!args.if_obj_id)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      client.query('select obj_text, obj_id from vlan_tree_v where tree_id IN (SELECT parent_tree_id from vlan_tree_v where obj_id=$1)', [args.if_obj_id], function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows[0]);
      });
    },
    'net_info': function net_info(args, callback) {
      if (!args.ip)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      client.query('SELECT default_gw, netmask, profile_name, pool_start_addr, pool_amount, shared_net_name FROM dhcp_net_settings_v WHERE net_addr = $1',
        [args.ip], function(err, res) {
          if (err) return callback(err);
          var res = res.rows[0] || {};
          var net = new Netmask(args.ip);
          var gw = res.default_gw || net.first;
          return callback(null, {
            dhcp: res,
            info: {
              gw: gw,
              mask: net.mask,
              first: net.first,
              last: net.last,
              size: net.size
            }});
        });
    },
    'net_addrs': function net_addrs(args, callback) {
      // model, status, username etc..
      // FIXME: нахреначено, объединить с net_info
      if (!args.ipObjId)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      var pool = {};
      client.query('SELECT pool_start_addr, pool_amount FROM dhcp_net_settings_v WHERE net_addr = $1', [args.ip], function(err, res) {
        if (err) console.error(err);
        else if (res.rows.length > 0)
          pool = {start: res.rows[0].pool_start_addr, amount: res.rows[0].pool_amount};
        client.query({
          text: 'SELECT ip_addr, mac, fio, depart, phone_num, comments, profile_name, ' +
                      'fqdn, label, equip_obj_id, tree_f_get_path(equip_obj_id) as path FROM all_equip_v A ' +
                'LEFT OUTER JOIN dhcp_addr_settings_v D ON A.ip_addr = D.addr ' +
                'WHERE A.ip_addr IN (SELECT addr FROM addrs_ip_v WHERE net_obj_id = $1) ORDER BY ip_addr',
          values: [args.ipObjId]
        }, function(err, res) {
          if (err) return callback(err);
          //console.log(res);

          var out = {}, resLen = 0;
          // show maximum info
          for (var i=0; i<res.rows.length; i++) {
            if (!out[res.rows[i].ip_addr]) {
              resLen++;
              out[res.rows[i].ip_addr] = {
                mac: [],
                dns: []
              };
            }
            for (var key in res.rows[i]) {
              if (!res.rows[i].hasOwnProperty(key)) continue;

              if (key === 'mac') {
                if (out[res.rows[i].ip_addr].mac.indexOf(res.rows[i].mac) === -1) {
                  out[res.rows[i].ip_addr].mac.push(res.rows[i].mac);
                }
              } else if (key === 'fqdn') {
                if (out[res.rows[i].ip_addr].dns.indexOf(res.rows[i].fqdn) === -1) {
                  out[res.rows[i].ip_addr].dns.push(res.rows[i].fqdn);
                }
              // } else if (key === 'path') {
              //   out[res.rows[i].ip_addr][key] = res.rows[i][key].split('> ').join('\\');
              } else { // not null, undef etc...
                out[res.rows[i].ip_addr][key] = res.rows[i][key];
              }
            }
          }

          // add addresses from pool
          var nextIpAddress = function(ip) {
            var item, octets;
            octets = ip.split('.');
            if (octets.length != 4)
              throw new Error('invalid ipv4 address format');
            for (var i = octets.length - 1; i >= 0; i--) {
              item = parseInt(octets[i]);
              if (item < 255) {
                octets[i] = (item + 1).toString();
                for (var j = i + 1; j < 4; j++) {   // цикл сработатет при переходе через 255
                  octets[j] = '0';
                }
                break;
              }
            }
            return octets.join('.')
          }

          if (pool.start && res.rows.length > 0) {
            var ip = pool.start;
            for (var i = 0; i<pool.amount; i++) {
              out[ip] = {
                ip_addr: ip,
                type: 'pool',
                comments: 'Зарезервировано под DHCP пул'
              };
              ip = nextIpAddress(ip);
            }
          }

          // convert to array to make it sortable:
          var outAr = [];
          for (var k in out) {
            if (out.hasOwnProperty(k)) {
              outAr.push(out[k]);
            }
          }

          // console.log('---------------------------------------------------------------\n')
          // console.log(outAr);
          return callback(null, outAr);
        });
      });
    },
    'eq_info': function eq_info(args, callback) {
      // model, status, username etc..
      if (!args.eqObjId)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      client.query('SELECT label, serial_number, fio, depart, phone_num, comments, fqdn, vendor_name, model_name, ' +
        'type_name, status FROM all_equip_v where equip_obj_id = $1', [args.eqObjId], function(err, res) {
        if (err) return callback(err);
        return callback(null, res.rows[0]);
      });
    },
    'eq_ifaces': function eq_ifaces(args, callback) {
      // вся информация об интерфейсах (level2 && level3)
      // JOIN ifaces_v and dhcp_addr_settings_v
      if (!args.eqObjId)
        return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
      client.query({
        text: 'SELECT I.obj_id, I.if_name, I.mac, I.dhcpoffer_everywhere, I.ip_addr, I.assigned_dhcp, I.is_trunk ' +
              'FROM ifaces_v I WHERE I.equip_obj_id = $1 ORDER by I.if_name, I.ip_addr',
        values: [args.eqObjId]
      }, function(err, res) {
        if (err) return callback(err);
        var arr = [], ifaces = {}, rs = res.rows;
        for (var i = 0; i < rs.length; i++) {
          if (!ifaces[rs[i].obj_id]) {
            ifaces[rs[i].obj_id] = {
              ifObjId: rs[i].obj_id,
              name: rs[i].if_name,
              mac: rs[i].mac,
              every: rs[i].dhcpoffer_everywhere,
              isTrunk: rs[i].is_trunk,
              addrData: { ip:[], isDyn:[], dhcpP:[] },  // will be filled below
              addrDataRows: 0 // number of rows addrData
            };
            arr.push(ifaces[rs[i].obj_id]);
          }
          // fill addrData
          ifaces[rs[i].obj_id].addrData.ip.push(rs[i].ip_addr);
          ifaces[rs[i].obj_id].addrData.isDyn.push(rs[i].assigned_dhcp);
          ifaces[rs[i].obj_id].addrData.dhcpP.push(rs[i].param_profile_id);
          ifaces[rs[i].obj_id].addrDataRows++;
        }
        return callback(null, arr); //return callback(null, ifaces);
      });
    },
    'eq_spec': function eq_spec(args, callback) {
      // load equipment-specific properties
      if (!args.eqLabel || !args.eqObjId) return callback(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');

      var type = args.eqLabel.slice(0,3).toLowerCase();

      function getILO(callback) {
        var rs = null;
        client.query('SELECT * FROM ifaces_ilo_v WHERE equip_obj_id = $1', [args.eqObjId], function(err, res) {
          if (err) return callback(err);

          if (res.rowCount !== 0) {
            rs = {
              mac: res.rows[0].mac,
              ip: res.rows[0].ip_addr
            };
          }
          return callback(null, rs);
        });
      }

      function getMGMT(callback) {
        var rs = null;
        client.query('SELECT ip_addr FROM mgmt_access_equip_ip_v WHERE equip_id = $1', [args.eqObjId], function(err, res) {
          if (err) return callback(err);
          if (res.rowCount === 0) return callback(null, rs);

          rs = { ip: res.rows[0].ip_addr };
          client.query('SELECT rvalue, fqdn FROM dns_rr_a_v where rvalue = $1', [rs.ip], function(err, res) {
            if (err) return callback(null, rs);

            if (res.rowCount !== 0) {
              rs.fqdn = res.rows[0].fqdn
            }
            return callback(null, rs);
          });
        });
      }

      function getVlans(callback) {
        var rs = null;
        var items = {};
        client.query('SELECT DISTINCT ON (vlan_number, net_addr) if_vlan_v.vlan_name, vlan_number, net_addr, net_obj_id FROM if_vlan_v ' +
          'LEFT OUTER JOIN vlan_network_v ON if_vlan_v.vlan_obj_id = vlan_network_v.vlan_obj_id WHERE equip_obj_id = $1 ORDER BY vlan_number', [args.eqObjId], function(err, res) {
          if (err) return callback(err);
          if (res.rowCount === 0) return callback(null, rs);

          rs = [];
          for (var i=0; i<res.rows.length; i++) {
            if (!items.hasOwnProperty(res.rows[i].vlan_name)) {
              // create new
              items[res.rows[i].vlan_name] = {
                n: res.rows[i].vlan_number,
                name: res.rows[i].vlan_name,
                nets: [res.rows[i].net_addr]
              }
              rs.push(items[res.rows[i].vlan_name]);
            } else {
              items[res.rows[i].vlan_name].nets.push(res.rows[i].net_addr);
            }
          }
          return callback(null, rs);
        });
      }

      function getIfVlans(callback) {
        var rs = null;
        client.query('SELECT vlan_number, if_obj_id FROM if_vlan_v WHERE equip_obj_id = $1', [args.eqObjId], function(err, res) {
          if (err) return callback(err);
          if (res.rowCount === 0) return callback(null, rs);

          rs = {};
          for (var i=0; i<res.rowCount; i++) {
            if (!rs.hasOwnProperty(res.rows[i].if_obj_id)) {
              // create new
              rs[res.rows[i].if_obj_id] = [res.rows[i].vlan_number]
            } else {
              rs[res.rows[i].if_obj_id].push(res.rows[i].vlan_number);
            }
          }

          return callback(null, rs);
        });
      }

      var query = {};
      if (type === 'srv') {
        query.ilo = getILO;
      }
      if (['swi', 'cam', 'ss-', 'cnv', 'ups', 'mdm'].indexOf(type) > -1) {
        query.ip_mgmt = getMGMT;
      }
      if (['swi', 'ss-', 'fwl'].indexOf(type) > -1) {
        query.vlans = getVlans;
        query.if_vlans = getIfVlans;
      }

      if (Object.keys(query).length === 0) {
        // no data at all
        return callback(null, null);
      }

      async.parallel(query, function(err, results) {
        //console.log(err, results);
        if (err) return callback(err);
        return callback(null, results);
      });
    },
    'eq_edit': function(args, callback) {
      // быстро определяем equip_view для любого типа устройтсв.
      // возможно придется переделать на switch (query.fname.eqLabel.toLowerCase().substring(0, 3))
      // TODO написать тест для equip_view
      var fn = utils.getDBfname('equip_view', args.eqLabel);
      if (fn.err) return callback(fn.err);
      client.query('SELECT * from ' + fn + ' WHERE obj_id = $1', [args.eqObjId], function (err, res) {
        if (err) return callback(err);
        return callback(null, res.rows[0]);
      });
    },
    'status_names': function(args, callback) {
      // FIXME: remove me, new api in eq_stnames
      //status names
      client.query('SELECT * from equip_status_v', function (err, res) {
        if (err) return callback(err);
        var elem, results = [];
        for (var i in res.rows) {
          elem = {};
          //elem[res.rows[i]['name']] = res.rows[i]['obj_id'];
          elem.name = res.rows[i]['name'];
          results.push(elem);
        }
        return callback(null, results);
      });
    },
    'dhcp_pnames': function(args, callback) {
      // dhcp profiles names
      client.query('SELECT obj_id, name from dhcp_profiles_v', function(err, res) {
        if (err) return callback(err);
        //console.log(res.rows);
        var out = {}; //{null: 'Сбросить на значение по умолчанию'}; // для сброса профиля
        res.rows.forEach(function(row) {
          out[row.obj_id] = row.name;
        });
        return callback(null, out);
      });
    },
    'dhcp_pnames2': function(args, callback) {
      // dhcp profiles names
      client.query('SELECT obj_id, name from dhcp_profiles_v', function(err, res) {
        if (err) return callback(err);
        var elem, results = [];
        for (var i in res.rows) {
          elem = {};
          elem.name = res.rows[i]['name'];
          results.push(elem);
        }
        return callback(null, results);
      });
    },
    'cur_loc': function(args, callback) {
      client.query('SELECT parent_obj_id, tree_f_get_path(parent_obj_id) from tree_v where obj_id = $1', [args.eqObjId], function (err, res) {
        if (err) return callback(err);
        var results = {};
        results.parent_obj_id = null;
        results.tree_path = '';
        if (res.rowCount != 0) {
          results.parent_obj_id = res.rows[0].parent_obj_id;
          results.tree_path = res.rows[0].tree_f_get_path;
        }
        return callback(null, results);
      });
    },
    'location': function(args, callback) {
      client.query('SELECT obj_id, tree_f_get_path(obj_id) from tree_v where obj_type = \'LOCA\' ORDER BY tree_f_get_path', function (err, res) {
        //console.log(res.rows);
        if (err) return callback(err);
        var results = [];
        var elem;
        for (var i in res.rows) {
          elem = {};
          elem[res.rows[i]['tree_f_get_path']] = res.rows[i]['obj_id'];
          results.push(elem);
        }
        return callback(null, results);
      });
    },
    'eq_types': function(args, callback) {
      client.query('select obj_id, name from equip_types_v', function (err, res) {
        if (err) return callback(err);

        var out = {};
        res.rows.forEach(function(row) {
          out[row.obj_id] = row.name;
        });
        return callback(null, out);
      });
    },
    'eq_vendors': function(args, callback) {
      function getAllVendors() {
        client.query('select obj_id, name from equip_vendors_v', function (err, res) {
          if (err) return callback(err);

          var out = {};
          res.rows.forEach(function(row) {
            out[row.obj_id] = row.name;
          });
          return callback(null, out);
        });
      }
      if (!args.eqtype) {
        getAllVendors();
      } else {
        client.query('SELECT DISTINCT ON (vendor_name) obj_id, vendor_name FROM equip_models_v WHERE type_name=$1', [args.eqtype], function (err, res) {
          if (err) return callback(err);

          if (res.rows.length === 0) {
            getAllVendors();
          } else {
            var out = {};
            res.rows.forEach(function(row) {
              out[row.obj_id] = row.vendor_name;
            });
            return callback(null, out);
          }
        });
      }
    },
    'eq_models': function(args, callback) {
      client.query('SELECT DISTINCT  obj_id, name FROM equip_models_v WHERE type_name=$1 AND vendor_name=$2', [args.eqtype, args.eqvendor], function (err, res) {
        if (err) return callback(err);

        var out = {};
        res.rows.forEach(function(row) {
          out[row.obj_id] = row.name;
        });
        return callback(null, out);
      });
    },
    'eq_stnames': function(args, callback) {
      // status names
      client.query('SELECT obj_id, name FROM equip_status_v', function (err, res) {
        if (err) return callback(err);

        var out = {};
        res.rows.forEach(function(row) {
          out[row.obj_id] = row.name;
        });
        return callback(null, out);
      });
    },
    'ip_free': function ip_free(args, callback) {

      function getParentObj(cb) {
        if (args.eqObjId) {
          // find Parent ObjId first!  just using cur_loc for now..
          client.query('SELECT parent_obj_id from tree_v where obj_id = $1', [args.eqObjId], function(err, res) {
            if (err) return cb(err);

            var parentObjId = null;
            if (res.rowCount !== 0) {
              parentObjId = res.rows[0].parent_obj_id;
            }
            return cb(null, parentObjId);
          });
        } else if (args.parentObjId) {
          return cb(null, args.parentObjId);
        } else {
          return cb(arguments.callee.name + ': ошибка проверки входных параметров (' + JSON.stringify(arguments) + ')');
        }
      }

      getParentObj(function(err, parentObjId) {
        if (err) return callback(err);

        // load ip adresses
        client.query('SELECT net_addr, addr from addrs_ip_v WHERE net_addr IN ' +
          '(SELECT net_addr from gen_loc_nets_v where location_obj_id = $1) ORDER BY addr', [parentObjId], function(err, res) {
            //console.log(res.rows);
            if (err) return callback(err);

            var netip = {};
            for (var i in res.rows) {
              if (!netip.hasOwnProperty(res.rows[i].net_addr))
                netip[res.rows[i].net_addr] = [];
              netip[res.rows[i].net_addr].push(res.rows[i].addr);
            }
            //console.log(netip);

            var nextIpAddress = function(ip) {
                var item, octets;
                octets = ip.split('.');
                if (octets.length != 4)
                  throw new Error('invalid ipv4 address format');
                for (var i = octets.length - 1; i >= 0; i--) {
                  item = parseInt(octets[i]);
                  if (item < 255) {
                    octets[i] = (item + 1).toString();
                    for (var j = i + 1; j < 4; j++) { // цикл сработатет при переходе через 255
                      octets[j] = '0';
                    }
                    break;
                  }
                }
                return octets.join('.')
              }
              //          console.log(nextIpAddress('172.20.1.1'));
              //          console.log(nextIpAddress('172.20.255.255'));

            var results = [];
            //var results = {};
            var mask, tmp, nhosts, lastoct, ip, obj;
            for (var netaddr in netip) {
              // find first free addr: 172.20.1.0/24
              //net = netaddr.slice(0, netaddr.indexOf('/') - 1); // 172.20.1.0
              mask = netaddr.slice(netaddr.indexOf('/') + 1); // 24
              nhosts = Math.pow(2, 32 - mask) - 2; // 254 // num of available hosts in network
              lastoct = netaddr.slice(netaddr.lastIndexOf('.') + 1, netaddr.indexOf('/')); // 0
              tmp = (parseInt(lastoct) + 1).toString(); // 1
              ip = netaddr.slice(0, netaddr.lastIndexOf('.') + 1) + tmp; // hah, first address to begin! //172.20.1.1
              for (var i = 0; i < nhosts; i++) {
                if (netip[netaddr].indexOf(ip) == -1) {
                  obj = {};
                  obj.net = netaddr;
                  obj.ip = ip;
                  //obj[netaddr] = ip;
                  results.push(obj);
                  break;
                } else {
                  ip = nextIpAddress(ip);
                }
              }
            }
            return callback(null, results);
          });
      });
    },
    'get_username': function(args, callback) {
      var ldap = res.locals.ldapClient;
      var opts = {
        filter: '(&(&(&(objectclass=user)(objectcategory=person)(name=*' + args.q + '*))))',
        scope: 'sub',
        attributes: ['name'], //, 'sAMAccountName'],
        sizeLimit: 8
      };

      var out = [];
      ldap.search('OU=РКК,DC=gkb,DC=rsc,DC=energia,DC=ru', opts, function(err, res) {
        res.on('searchEntry', function(data) {
          var user = data.object;
          //console.dir(user);
          out.push(user.name);
        });
        res.on('error', function(err) {
          //console.error('error: ' + err.message);
          return callback(null, out);
        });
        res.on('end', function(result) {
          //console.log('status: ' + result.status);
          return callback(null, out);
        });
      });
    },

  }
  exports.lib = lib; // for testing

  // prepare
  var rUserName = req.user.name; //var rUserName = res.locals.user;
  var client = res.locals.pgClient;
  var requestError = new utils.ErrorHandler(req, res, next);

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
