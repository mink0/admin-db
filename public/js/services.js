'use strict';

/* Services */
angular.module('ipdb').value('utils', function() {
  return {
    dateFormat: function(format) //author: meizz
    {
      var o = {
        'M+': this.getMonth() + 1, //month
        'd+': this.getDate(), //day
        'h+': this.getHours(), //hour
        'm+': this.getMinutes(), //minute
        's+': this.getSeconds(), //second
        'q+': Math.floor((this.getMonth() + 3) / 3), //quarter
        'S': this.getMilliseconds() //millisecond
      };

      if (/(y+)/.test(format)) format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
      for (var k in o)
        if (new RegExp('(' + k + ')').test(format))
          format = format.replace(RegExp.$1,
            RegExp.$1.length == 1 ? o[k] :
            ('00' + o[k]).substr(('' + o[k]).length));
      return format;
    }
  };
});

angular.module('ipdb').constant('toastr', toastr);

angular.module('ipdb').constant('scrollToTop', scrollToTop({
  text: '' // Text written into the link
}));

angular.module('ipdb').factory('n', function(toastr, $log) {
  var options = {
    'closeButton': false,
    'debug': false,
    'positionClass': 'toast-bottom-right',
    'onclick': null,
    'showDuration': '300',
    'hideDuration': '1000',
    'timeOut': '5000',
    'extendedTimeOut': '1000',
    // 'progressBar': true
  };
  return {
    info: function(msg) {
      toastr.options = options;
      toastr.info(msg);
      $log.info(msg);
    },
    error: function(msg) {
      var msg = msg || 'Ошибка загрузки данных';
      toastr.options = options;
      toastr.options = {
        'closeButton': true,
        'timeOut': '0',
        'extendedTimeOut': '0',
        'positionClass': 'toast-top-right'
      };
      toastr.error(msg);
      $log.error(msg);
    },
    success: function(msg) {
      toastr.options = options;
      toastr.success(msg);
      $log.log(msg);
    },
    warning: function(msg) {
      var msg = msg || 'Ошибка загрузки данных';
      toastr.options = options;
      toastr.warning(msg);
      $log.warn(msg);
    },
    clear: function() {
      toastr.clear();
    },
    d: function(msg) {
      var obj = msg;
      if (typeof msg !== 'string') {
        msg = JSON.stringify(msg);
      }
      toastr.options = options;
      toastr.options.positionClass = 'toast-bottom-full-width';
      toastr.info(msg);
      $log.debug(obj);
    },
    clearLast: function() {
      // TODO
    }
  };
});

angular.module('ipdb').factory('websock', function(socketFactory, $rootScope, $location, $cacheFactory, n) {
  // доступ к вебсокетам 

  //var channels = {};
  var oldUrl = $location.absUrl();
  var dsock = socketFactory({ ioSocket: io.connect('/dashboard') });
  dsock.on('connect', function() {
    dsock.emit('new_user', {
      //agent: navigator.userAgent,
      url: $location.absUrl()
    });
  });

  $rootScope.$on('$locationChangeStart', function(event) {
    if (oldUrl != $location.absUrl()) {
      oldUrl = $location.absUrl();
      dsock.emit('user_go', {
        url: $location.absUrl()
      });
    }
  });
  var socket = socketFactory();
  socket.on('connect', function() {
    n.success('Установлено соединение с сервером');
  });
  socket.on('disconnect', function() {
    n.error('Потеряно соединение с сервером');
  });
  
  socket.on('evlog', function(events) {
    var dic = {
      'ADD ': 'Добавлено',
      'CHAN': 'Изменено',
      'DELE': 'Удалено',
      'MOVE': 'Перемещено'
    };
    for(var i=0; i<events.length; i++) {
      //n.info('<ul><li><b>' + dic[events[i].action_name] + ':</b></li><li>' + events[i].message + '(' + events[i].usr + ')</li></ul>');
      n.info(dic[events[i].action_name] + ': ' + events[i].message + ' [' + events[i].usr + ']');
    }
  });
  socket.on('locTree', function(msg) {
    //n.warning('Обновление: общий вид');
    $rootScope.$emit('socket:locTree');
  });
  socket.on('vlanTree', function(msg) {
    //n.warning('Обновление: VLAN');
    $rootScope.$emit('socket:vlanTree');
  });
  socket.on('dnsTree', function(msg) {
    //n.warning('Обновление: DNS');
    $rootScope.$emit('socket:dnsTree');
  });
  socket.on('ipTree', function(msg) {
    //n.warning('Обновление: IP адреса');
    $rootScope.$emit('socket:ipTree');
  });
  socket.on('eqChange', function(msg) {
    //n.warning('Обновление: свойства оборудования');
    $rootScope.$emit('socket:eqChange');
  });

  return socket;
  
//  var sockjs_url = '/ws/multiplex';
//  var sockjs = new SockJS(sockjs_url); // connect to server
//  var multiplexer = new WebSocketMultiplex(sockjs);
  
//  subscribe('main');
  
//  return {
//    channels: channels,
//    subscribe: subscribe,
//    unsubscribe: unsubscribe
//  };
});


angular.module('ipdb').factory('searchBar', function($http, $q, $rootScope, n) {
  var searchGoing = false;  // если typeahead приходит до результатов поиска
  var searchWas = false; // если typeahead приходит после результатов поиска 
  return {
    getTypeahead: getTypeahead,
    search: search
  };

  function search(string, query) {
    searchGoing = true;
    searchWas = true;
    var d = $q.defer();
    $http.get('/api/get/full_search', { params: { q: string, in: query }})
      .success(function(data) {
        searchGoing = false;
        if (!data.warning && data.length == 0) {
          data.warning ='Ничего не найдено';
        }
        if (data.warning) {
          n.warning(data.warning);
          d.reject();
        } else {
          d.resolve({ data: data, length: data.length });
        }
      })
      .error(function(err) {
        searchGoing = false;
        n.error('Ошибка получения данных поиска');
        d.reject();
      });
    return d.promise;
  }
  
  function getTypeahead(string, query) {
    var final = $q.defer();
    $http.get('/api/get/type_ahead', { params: { q: string, in: query }})
      .success(function(data) {
        if (!searchGoing && !searchWas) {
          final.resolve(data);
        } else {
          final.reject();
          searchWas = false;
        }
      })
      .error(function(err) {
        final.reject();
        //n.warning();
      });
    return final.promise;
  }
});


angular.module('ipdb').factory('contextMenu', function(n) {
  var menu = [];
  var options = {};

  var set = function(newmenu, newoptions) {
    //menu = newmenu;
    angular.copy(newmenu, menu);
    options = newoptions;
  };

  return {
    menu: menu,
    options: options,
    set: set
  };
});


angular.module('ipdb').factory('eventLog', function($http, $q, n) {
  return {
    get: get
  };

  function get(objId, objIds) {
    var d = $q.defer();
    var query = {
      event_log: {}
    };
    
    if (objIds) {
      query.event_log.objIds = objIds;
    } else {
      query.event_log.objId = objId;
    }
    
    $http.post('/api/get', query)
      .success(function(data) {
        d.resolve(data);
      })
      .error(function(err) {
        d.reject();
        n.error('Ошибка получения журнала событий');
      });
    return d.promise;
  }
});



// angular.module('ipdb').factory('commonTabs', function() {
//   var fullscreen = {
//     left: false,
//     right: false
//   };
  
//   return {
// //    fullscreenLeft: fullscreenLeft,
// //    fullscreenRight: fullscreenRight,
//     fullscreen: service,
// //    toggle: {
// //      right: function() {
// //        fullscreenRight = !fullscreenRight;
// //      },
// //      left: function() {
// //        fullscreenLeft = !fullscreenLeft;
// //      }
// //    },
//     swap: function() {
//       service.fullscreenLeft = !service.fullscreenLeft;
//       service.fullscreenRight = !service.fullscreenRight;
//     }
// //    print: function() {
// //      console.log(fullscreenLeft);
// //      console.log(fullscreenRight);
// //    }
//   };
// });

angular.module('ipdb').value('leftRightTabs', {
  fullscreen: {
    left: false,
    right: false
  },
  resetFullscreen: function() {
    this.fullscreen.right = false;
    this.fullscreen.left = false;
  },
  toggleRight: function() {
    this.fullscreen.right = !this.fullscreen.right;
    this.fullscreen.left = false;
  },
  toggleLeft: function() {
    this.fullscreen.left = !this.fullscreen.left;
    this.fullscreen.right = false;
  }
/*
  toggle: {
    self: this,
    right: function() {
      this.self.fullscreen.right = !this.self.fullscreen.right;
      this.self.fullscreen.left = false;
    },
    left: function() {
      this.self.fullscreen.left = !this.self.fullscreen.left;
      this.self.fullscreen.right = false;
    }
  }
*/
});

angular.module('ipdb').factory('rightTabs', function($location, $q, $http, $rootScope, n) {
  var URL_DELIM = ',';
  var scopeTabs = [];
  var path = {
    url: $location.path().substring(1),
    add: function(item) {
      if (this.url !== '') this.url += URL_DELIM;
      this.url += item;
      $location.path(this.url);
    },
    del: function(index) {
      var arr = this.url.split(',');
      arr.splice(index, 1);
      this.url = arr.join(',');
      $location.path(this.url);
    }
  };
  
  return {
    initFromURL: initFromURL,
    addTabsBy: addTabsBy,
    addTab: addTab,
    delTab: delTab,
    expandTree: expandTree
  };

  function getLastTab() {
    var tabs = $scope.tabs; // take tabs from parent scope
    // find new tab
    var newTabIndex = tabs.length - 1; // last tab is new one by default
    for (var i=0; i<tabs.length; i++) {
      if (!tabs[i].rendered) {
        tabs[i].rendered = true;
        newTabIndex = i;
        break;
      }
    }
  }
  
  function addTabsBy(args) {
    var promises = [], inp = [];
    if (args.ip) {
      inp.push({ type: 'eq', eqLabel: args.ip, err: 'ip адрес ' + args.ip });
      promises.push($http.get('/api/get/eq_objid?ip=' + args.ip));
    }
    _addTabsFromPromises(inp, promises);
  }
  
  function initFromURL() {
    if (path.url !== '') {
      if (path.url.charAt(path.url.length - 1) === '/') { // trailing slash remove
        path.url = path.url.slice(0, -1);
      }
    
      var tabs = path.url.split(URL_DELIM);
      var promises = [], inp = [];
      for (var i=0; i<tabs.length; i++) {
        if (/-.*?-/.test(tabs[i])) {
          inp.push({ type: 'eq', eqLabel: tabs[i], err: 'устройство ' + tabs[i] });
          promises.push($http.get('/api/get/eq_objid?eqLabel=' + tabs[i]));
        } else if (/\..*?\..*?\..*?\//.test(tabs[i])) {
          inp.push({ type: 'ip', ip: tabs[i], err: 'сеть ' + tabs[i] });
          promises.push($http.get('/api/get/ip_objid?ip=' + tabs[i]));
        } else if (/\..*?\..*?\./.test(tabs[i])) {
          inp.push({ type: 'eq', eqLabel: tabs[i], err: 'ip адрес ' + tabs[i] });
          promises.push($http.get('/api/get/eq_objid?ip=' + tabs[i]));
        } else if (/^dns=.*?/.test(tabs[i])) {
          var dnsObjId = tabs[i].split('=')[1];
          promises.push($http.get('/api/get/dns_prop?dnsObjId=' + dnsObjId));
          inp.push({ type: 'dns', dnsObjId: dnsObjId, err: 'домен ' + dnsObjId });
        }
      }
      
      _addTabsFromPromises(inp, promises);
    }

    return scopeTabs;
  }
  
  function _addTabsFromPromises(inp, promises) {
    $q.all(promises).then(function(results) {
      var aggregatedData = [];
      angular.forEach(results, function(result) {
        aggregatedData = aggregatedData.concat(result.data);
      });
      for (var i=0; i<inp.length; i++) {
        //console.log(aggregatedData[i]);
        if (aggregatedData[i]) {
          if (inp[i].type === 'eq') {
            addTab({
              type: 'eq',
              eqLabel: inp[i].eqLabel,
              eqObjId: aggregatedData[i],
            }, true);
          } else if (inp[i].type === 'ip') {
            addTab({
              type: 'ip',
              ip: inp[i].ip,
              ipObjId: aggregatedData[i].ipObjId,
              comments: aggregatedData[i].comments,
            }, true);
          } else if (inp[i].type === 'dns') {
            addTab({
              type: 'dns',
              dnsObjId: inp[i].dnsObjId,
              dns: aggregatedData[i].domain_name,
              comments: aggregatedData[i].descr,
              fwip: aggregatedData[i].forward_ip,
              ztype: aggregatedData[i].zone_type
            }, true);
          }
        } else {
          n.warning('Не найдено: ' + inp[i].err + ' :(');
        }
      }
      // FIX: kendo is rendering slow. It will expand last tab after kendo is rendered in any case:
      $rootScope.$on('kendoRendered', function(event, widget) {
        expandTree(scopeTabs[scopeTabs.length - 1]);
      });
    });
  }

  function expandTree(tab) {
    var tab = tab || {};
    switch (tab.type) {
      case 'eq':
        $rootScope.$emit('locTree:expand', tab.eqObjId);
        break;
      case 'ip':
        $rootScope.$emit('ipTree:expand', tab.ipObjId);
        break;
      case 'dns':
        $rootScope.$emit('dnsTree:expand', tab.dnsObjId);
        break;
    }
  }
  
  function delTab(index) {
    scopeTabs.splice(index, 1);
    path.del(index);
  }

  function addTab(item, noUrl) {
    if (item.type === 'eq') {
      if (!noUrl) path.add(item.eqLabel.toUpperCase());
      scopeTabs.push({
        type: 'eq',
        title: item.eqLabel.toUpperCase(),
        template: '/partials/eqTab',
        active: item.active || true,
        eqObjId: item.eqObjId,
        eqLabel: item.eqLabel.toUpperCase()
      });
    } else if (item.type === 'ip') {
      if (!noUrl) path.add(item.ip);
      scopeTabs.push({
        type: 'ip',
        title: item.ip,
        template: '/partials/ipTab',
        active: item.active || true,
        ip: item.ip,
        ipObjId: item.ipObjId,
        comments: item.comments
      });
    } else if (item.type === 'dns') {
      if (!noUrl) path.add('dns='+item.dnsObjId);
      scopeTabs.push({
        type: 'dns',
        title: item.dns,
        template: '/partials/dnsTab',
        active: item.active || true,
        dns: item.dns,
        dnsObjId: item.dnsObjId,
        fwip: item.fwip,
        comments: item.comments,
        ztype: item.ztype
      });
    }
  }
});


angular.module('ipdb').factory('topNav', function($http, $q, $modal, n) {
  return {
    updateDHCP: updateDHCP,
    updateDNS: updateDNS,
    showTasks: showTasks
  };

  function showTasks() {
    $modal.open({
      templateUrl: '/partials/modals/modalTasks',
      controller: 'ModalTasksCtrl',
      windowClass: 'full-width-modal',
      size: 'lg'
    });
//    modalInstance.result.finally(function() {3000
//      n.success('unsubscribe!');
//    });
  }
  
  function updateDHCP() {
    var d = $q.defer();
    $http.get('/api/post/task_update_dhcp')
      .success(function(data) {
        n.success('Задание на обновление службы DHCP отправлено серверу');
        d.resolve(data);
      })
      .error(function(err) {
        n.error('Ошибка добавления задания: ' + err);
        d.reject();
      });
    return d.promise;
  }

  function updateDNS() {
    var d = $q.defer();
    $http.get('/api/post/task_update_dns')
      .success(function(data) {
        n.success('Задание на обновление службы DNS отправлено серверу');
        d.resolve(data);
      })
      .error(function(err) {
        n.error('Ошибка добавления задания: ' + err);
        d.reject();
      });
    return d.promise;
  }
});

angular.module('ipdb').service('common', function($http, $q) {
  var GLOBAL_ERR = 'Ошибка выполнения запроса. Попробуйте позже.';
  this.view = {
    get: function get(args, args2) {
      // /api/get requests
      
      var fname, params;
      if (typeof args === 'object') {
        // API v1-1: {fname: 'if_delete', args: {...}}
        fname = args.fname;
        params = args.args;
      } else {
        // API v1-2: 'if_delete', {eqLabel: 'dsd'}
        fname = args;
        params = args2;
      }

      var d = $q.defer();
      $http.get('/api/get/' + fname, { params: params })
        .success(function(data) {
          if (data.hasOwnProperty('warn')) {
            d.reject(data.warn);
          } else {
            d.resolve(data);
          }
        })
        .error(function(err) {
          d.reject(GLOBAL_ERR);
        });
      return d.promise;
    },
    post: function post(query) {
      // HTTP POST requests
      // API v2: {global1, global1, fname1 : {p1: param1, p2: param2, ...}, [fname2 : {p1: param1, p2: param2, ...}]...
      var d = $q.defer();
      var errors = {}, err = false;
      $http.post('/api/get', query)
        .success(function(data) {
          for (var fname in data) {
            if (!data.hasOwnProperty(fname)) continue;
            if (data[fname].hasOwnProperty('warn')) {
              err = true;
              errors[fname] = data[fname].warn;
            }
          }
          if (err) {
            d.reject(errors);
          } else {
            d.resolve(data);
          }
        })
        .error(function(err) {
          d.reject(err);
        });
      return d.promise;
    }
  };


  this.edit = {
    get: function get(args) {
      // HTTP GET requests
      // API v1: {fname: 'if_delete', query: {...}}
      var d = $q.defer();
      $http.get('/api/post/' + args.fname, { params: args.args })
        .success(function(data) {
          if (data.hasOwnProperty('warn')) {
            d.reject(data.warn);
          } else {
            d.resolve(data);
          }
        })
        .error(function(err) {
          d.reject(GLOBAL_ERR);
        });
      return d.promise;
    },
    post: function post(query) {
      // HTTP POST requests
      // API v2: {global1, global1, fname1 : {p1: param1, p2: param2, ...}, [fname2 : {p1: param1, p2: param2, ...}]...
      var d = $q.defer();
      var errors = {}, err = false;
      $http.post('/api/post', query)
        .success(function(data) {
          for (var fname in data) {
            if (!data.hasOwnProperty(fname)) continue;
            if (data[fname].hasOwnProperty('warn')) {
              err = true;
              errors[fname] = data[fname].warn;
            }
          }
          if (err) {
            d.reject(errors);
          } else {
            d.resolve(data);
          }
        })
        .error(function(err) {
          d.reject(err);
        });
      return d.promise;
    }
  };
});

