angular.module('ipdb').factory('ipTab', function($http, $q, n) {
  return {
    getTabData: getTabData
  };

  function getId(ip) {
    var d = $q.defer();
    $http.get('/api/get/eq_objid', { params: {eqLabel: ip }})
      .success(function(data) {
        if (!data) {
          n.error('Неизвестный адрес ' + ip);
        d.reject();
        }
        d.resolve(data);
      })
      .error(function(err) {
        n.error('Ошибка загрузки данных о сети ' + ip);
        d.reject();
      });
    return d.promise;
  }

  function getTabData(ipObjId, ip) {
    var d = $q.defer();
    var query = {
      ipObjId: ipObjId,
      ip: ip,
      net_addrs: {},
      net_info: {}
    };
    $http.post('/api/get', query)
      .success(function(data) {
        d.resolve(data);
      })
      .error(function(err) {
        d.reject();
        n.error('Ошибка загрузки данных о сети ' + ip);
      });
    return d.promise;
  }
});
