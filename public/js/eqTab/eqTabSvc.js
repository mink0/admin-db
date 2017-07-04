angular.module('ipdb').factory('eqTab', function($http, $q, n) {
  return {
    getTabData: getTabData,
    ifaceEdit: ifaceEdit,
    dhcpProfileEdit: dhcpProfileEdit,
    getIpFreeAddrs: getIpFreeAddrs,
    getIpInfo: getIpInfo,
    getFioTypeahead: getFioTypeahead
  };

  function getFioTypeahead(text) {
    var final = $q.defer();
    $http.get('/api/get/get_username', { params: { q: text }})
      .success(function(data) {
        // if (!searchGoing && !searchWas) {
        //   final.resolve(data);
        // } else {
        //   final.reject();
        //   searchWas = false;
        // }
        final.resolve(data);
      })
      .error(function(err) {
        final.reject();
      });
    return final.promise;
  }
  
  function getIpInfo(ip) {
    var d = $q.defer();
    $http.get('/api/get/net_objid', { params: {ip: ip } })
      .success(function(data) {
        if (!data.net_addr) {
          if (data == 'err') {
            d.reject('err');
          } else if (data == 'unknown') {
            d.reject('unknown');  
          }
        } else {
          $http.get('/api/get/ip_objid', { params: {ip: data.net_addr } })
            .success(function(data2) {
              data2.net_addr = data.net_addr;
              d.resolve(data2);    
            })
            .error(function(err) {
              d.reject(err);
            });
        }
      })
      .error(function(err) {
        d.reject(err);
      });
    return d.promise;
  }

  function getIpNetInfo(ip) {
    var d = $q.defer();
    
    console.log(ip);

    $http.get('/api/get/net_objid', { params: {ip: ip } })
      .success(function(data) {
        if (!data.net_addr) {
          if (data == 'err') {
            d.reject('err');
          } else if (data == 'unknown') {
            d.reject('unknown');  
          }
        } else {
          $http.get('/api/get/net_info', { params: {ip: data.net_addr } })
            .success(function(data) {
              d.resolve(data);    
            })
            .error(function(err) {
              d.reject(err);
            });
        }
      })
      .error(function(err) {
        d.reject(err);
      });
    return d.promise;
  }

  function dhcpProfileEdit() {
    var ip, pname, ifObjId, isDyn;
    if (arguments.length === 2) {
      ip = arguments[0];
      pname = arguments[1];
    } else {
      ip = arguments[0].ip;
      ifObjId = arguments[0].ifObjId;
      isDyn = arguments[0].isDyn;
    }

    var d = $q.defer();
    var fname = 'if_dhcp_edit';

    var query = {};
    query[fname] = {
      ip: ip,
      dhcpP: pname,
      ifObjId: ifObjId,
      isDyn: isDyn
    };
    $http.post('/api/post', query)
      .success(function(data) {
        if (data.hasOwnProperty(fname) && data[fname].hasOwnProperty('warn')) {
          d.reject(data[fname].warn);
        } else {
          d.resolve();
        }
      })
      .error(function(err) {
        d.reject(err);
      });
    return d.promise;
  }

  function ifaceEdit(opts) {
    var d = $q.defer();
    var query = {
      iface_edit: opts
    };
    $http.post('/api/post', query)
      .success(function(data) {
        if (data.hasOwnProperty('iface_edit') && data.iface_edit.hasOwnProperty('warn')) {
          d.reject(data.iface_edit.warn);
        } else {
          d.resolve();
        }
      })
      .error(function(err) {
        d.reject(err);
      });
    return d.promise;
  }

  function getTabData(eqObjId, eqLabel) {
    var d = $q.defer();
    var query = {
      eqLabel: eqLabel,
      eqObjId: eqObjId,
      eq_ifaces: {},
      //dhcp_pnames: {},
      eq_spec: {},
      eq_info: {}
    };
    $http.post('/api/get', query)
      .success(function(data) {
        d.resolve(data);
      })
      .error(function(err) {
        d.reject();
        n.error('Ошибка загрузки данных об оборудовании ' + eqLabel);
      });
    return d.promise;
  }

  function getIpFreeAddrs(eqObjId) {
    var d = $q.defer();
    $http.get('/api/get/ip_free', { params: {eqObjId: eqObjId } })
      .success(function(data) {
        d.resolve(data);
      })
      .error(function(err) {
        d.reject();
        n.error('Ошибка загрузки данных о своободных ip адресах ' + eqObjId);
      });
    return d.promise;
  }

  function findEqTab(eqLabel) {
    var d = $q.defer();
    $http.get('/api/get/eq_objid', { params: {eqLabel: eqLabel } })
      .success(function(data) {
        if (!data) {
          n.error('Неизвестное устройство ' + eqLabel);
          d.reject();
        }
        d.resolve(data);
      })
      .error(function(err) {
        n.error('Ошибка загрузки данных об устройстве ' + eqLabel);
        d.reject();
      });
    return d.promise;
  }
});


// angular.module('ipdb').factory('modalEqItemRename', function($http, $q, n) {
//   return {
//     get: get
//   };

//   function get(objId) {
//     var d = $q.defer();
//     var query = {
//       event_log: {
//         objId: objId
//       }
//     };
//     $http.post('/api/get', query)
//       .success(function(data) {
//         d.resolve(data);
//       })
//       .error(function(err) {
//         d.reject();
//         n.error('Ошибка получения журнала событий');
//       });
//     return d.promise;
//   }
// });
