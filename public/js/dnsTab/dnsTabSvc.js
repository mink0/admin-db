angular.module('ipdb').factory('dnsTab', function($http, $q, n) {
  return {
    getTabData: getTabData
  };

  function getTabData(dnsObjId, dns) {
    var d = $q.defer();
    var query = {
      dnsObjId: dnsObjId,
      dns_a: {},
      dns_prop: {}
    };
    $http.post('/api/get', query)
      .success(function(data) {
        d.resolve(data);
      })
      .error(function(err) {
        d.reject();
        n.error('Ошибка загрузки данных о домене ' + dns);
      });
    return d.promise;
  }
});
