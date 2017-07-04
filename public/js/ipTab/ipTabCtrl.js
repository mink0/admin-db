angular.module('ipdb').controller('IpTabCtrl', function($scope, $rootScope, ipTab, rightTabs, leftRightTabs, $modal, n) {
  $scope.ip = $scope.tab.ip;
  $scope.ipObjId = $scope.tab.ipObjId;
  $scope.comments = $scope.tab.comments;

  $scope.expandRight = function() {
    leftRightTabs.toggleRight();
  };

  // wrapper for lazy reload
  function loadData(callback) {
    var callback = callback || function(){};

    ipTab.getTabData($scope.ipObjId, $scope.ip).then(function(data) {
      // console.log(data);

      $scope.data = data;
      $scope.data.comments = $scope.comments;
      $scope.reloadMe = false;
      return callback(null);
    }, function() {
      // error while loading tab //$scope.removeTab(newTabIndex);
      $scope.reloadMe = true;
      return callback('error-load-data');
      //return $timeout(loadData, 1000);
    });
  }

  loadData(function() {
    $scope.thead = [
      { title: 'IP-адрес', column: 'ip_addr' },
      { title: 'DNS-имя', column: 'dns' },
      { title: 'MAC-адрес', column: 'mac' },
      { title: 'ФИО', column: 'fio' },
      { title: 'Отдел', column: 'depart' },
      { title: 'Тел.', column: 'phone_num' },
      { title: 'Расположение', column: 'path' },
      { title: 'DHCP-профиль', column: 'profile_name' },
      { title: 'Коммент.', column: 'comments' },
    ];

    $scope.sort = {
      column: '',
      descending: false
    };

    $scope.changeSorting = function(column) {
      if ($scope.sort.column == column) {
        $scope.sort.descending = !$scope.sort.descending;
      } else {
        $scope.sort.column = column;
        $scope.sort.descending = false;
      }
    };
  });

  $scope.openTab = function(iface) {
    if (iface.label && iface.equip_obj_id) {
      $rootScope.$emit('rightTabs:newTab', {
        type: 'eq',
        eqLabel: iface.label,
        eqObjId: iface.equip_obj_id
      });
    } else {
      rightTabs.addTabsBy({ ip: iface.ip_addr });
    }
  };

  $scope.ifDhcpProfileEdit = function(ip, pname) {
    var modalScope = $scope.$new(true);
    modalScope.placeholder = 'Название профиля';
    modalScope.unchanged = pname;
    modalScope.ip = ip;
    var md = $modal.open({
      templateUrl: '/partials/modals/modalEqIfDhcpProfileEdit',
      controller: 'ModalEqIfDhcpProfileEditCtrl',
      scope: modalScope,
      windowClass: 'modal fade in',
      size: 'lg'
    });
    md.result.then(function() {
      //FIXME: у юры не высылается нотифай, убрать после
      n.info('Новый DHCP профиль для ip ' + ip + ' был назначен');
      loadData();
    });
  };

  $scope.loadData = loadData;

  $scope.$onRootScope('socket:eqChange', function() {
    $scope.reloadMe = true;
    if ($scope.$parent.selected === $scope.tab) {
      loadData();
    }
  });

  $scope.$parent.$watch('selected', function(newval) {
    // lazy tab reload: reload is happen only when tab is selected
    if (newval === $scope.tab && $scope.reloadMe === true) {
      loadData();
    }
  });
});


angular.module('ipdb').controller('ModalEqIfDhcpProfileEditCtrl', function($scope, eqTab, common) {
  $scope.data = {};

  common.view.get('dhcp_pnames').then(function(data) {
    //console.log(data);
    $scope.pnames = data;
    $scope.data.pname = $scope.pnames[$scope.unchanged] || $scope.pnames[Object.keys($scope.pnames)[0]];
  });

  $scope.reset = function() {
    eqTab.dhcpProfileEdit($scope.ip, null).then(function() {
      $scope.$close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.confirm = function() {
    eqTab.dhcpProfileEdit($scope.ip, $scope.data.pname).then(function() {
      $scope.$close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $scope.$dismiss();
  };

});

angular.module('ipdb').controller('FormIpPropCtrl', function($scope, common, $modal) {
  // API
  // view -  имя св-ва в $scope.form
  // model - для инициализации ng-model в форме
  // onConfirm - во время отправки запроса на сервер здесь происходит чтение всех свойств объекта $scope.form

  $scope.form = {}; // FIXME: приходится инициализировать здесь, а не в директиве из-за angular forms
  $scope.$watch('data', function() {
    // trigger directive reload
    $scope.init = [
      {
        view: 'gw',
        model: $scope.data.net_info.info.gw,
        onConfirm: readDhcpProp
      },
      {
        view: 'dhcpPnames',
        model: [{name: $scope.data.net_info.dhcp.profile_name}],
      },
      {
        view: 'dhcp_profile',
        model: $scope.data.net_info.dhcp.profile_name,
        onConfirm: readDhcpProp
      },
      {
        view: 'shared_name',
        model: $scope.data.net_info.dhcp.shared_net_name,
        onConfirm: readDhcpProp
      },
      {
        view: 'comments',
        model: $scope.comments,
        onConfirm: readNetProp
      },
      {
        view: 'pool_start',
        model: $scope.data.net_info.dhcp.pool_start_addr,
        onConfirm: readDhcpPool
      },
      {
        view: 'pool_amount',
        model: $scope.data.net_info.dhcp.pool_amount,
        onConfirm: readDhcpPool
      },
    ];
  });

  function readDhcpProp() {
    return {
      'net_dhcp_set': {
        ip: $scope.ip,
        gw: $scope.form.gw || null,
        dhcp_profile: $scope.form.dhcp_profile || null,
        shared_name: $scope.form.shared_name || ''
      }
    };
  }

  function readNetProp() {
    return {
      'net_comments_edit': {
        ipObjId: $scope.ipObjId,
        comments: $scope.form.comments || null,
      }
    };
  }

  function readDhcpPool() {
    return {
      'net_pool_set': {
        ip: $scope.ip,
        pool_start: $scope.form.pool_start || null,
        pool_amount: $scope.form.pool_amount || null
      }
    };
  }

  $scope.removeDHCP = function() {
    var modalScope = $scope.$new(true);
    modalScope.dlg = {
      no: 'Отмена',
      yes: 'Удалить',
      title: 'Удалить все настройки DHCP для ' + $scope.ip + ' ?'
    };
    var md = $modal.open({
      templateUrl: '/partials/modals/modalConfirm',
      scope: modalScope,
      controller: 'ModalConfirmCtrl',
      windowClass: 'modal fade in',
      size: 'lg'
    });
    md.result.then(function() {
      common.edit.post({
        'net_dhcp_del': {
          ip: $scope.ip
        }
      }).then(function(data) {
        $scope.form.editMode = false;
        $scope.loadData();
      });
    });
  };

  $scope.edit = function() {
    common.view.get('dhcp_pnames2').then(function(data) {
      $scope.form.editMode = true;
      $scope.form.dhcpPnames = data;
    });
  };
});
