'use strict';

/* Controllers */
angular.module('ipdb').controller('TreeContextMenuCtrl', function($scope, contextMenu) {
  $scope.context = {};
  $scope.context.menu = contextMenu.menu;
});

angular.module('ipdb').controller('TopNavCtrl', function($scope, $modal, topNav, websock) {
  $scope.updateDHCP = function() {
    websock.emit('join', 'tasks'); // чтобы сразу увидеть свои задания
    topNav.updateDHCP().then(function(data) {
      //$scope.data = data;
      topNav.showTasks();
    });
  };

  $scope.updateDNS = function() {
    websock.emit('join', 'tasks'); // чтобы сразу увидеть свои задания
    topNav.updateDNS().then(function(data) {
      //$scope.data = data;
      topNav.showTasks();
    });
  };

  $scope.showTasks = function() {
    topNav.showTasks();
  };

  $scope.showHistory = function() {
    $modal.open({
      templateUrl: '/partials/modals/modalHistory',
      controller: 'ModalHistoryCtrl',
      windowClass: 'full-width-modal',
      size: 'lg'
    });
  };
});


angular.module('ipdb').controller('ModalTasksCtrl', function($scope, $modalInstance, websock) {
  $scope.thead = [
    {title: 'Время создания', column: 'create_time'},
    {title: 'Время обновления', column: 'status_time'},
    {title: 'Пользователь', column: 'creator'},
    {title: 'Тип задачи', column: 'task_type'},
    {title: 'Комментарий', column: 'comment'},
    {title: 'Статус', column: 'status'},
    {title: 'Результат', column: 'result_msg'}
  ];
  $scope.table = [];
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

  websock.emit('join', 'tasks');

  websock.on('table', function(table) {
    var out = [];
    for (var i=0; i < table.length; i++) {
      if (table[i].status !== 'Выполнено') {
        table[i].css = true;
        out.push(table[i]);
      } else {
        out.push(table[i]);
      }
    }
    $scope.table = out;
  });

  $scope.close = function () {
    $modalInstance.dismiss();
  };

  $modalInstance.result.finally(function() {
    websock.emit('leave', 'tasks');
  });

});


angular.module('ipdb').controller('ModalHistoryCtrl', function($scope, $modalInstance, eventLog) {
  $scope.close = function () {
    $modalInstance.dismiss();
  };

  $scope.gridOptions = {
    data: 'data.event_log',
    showFilter: true,
    multiSelect: false,
    enableColumnResize: true,
    columnDefs: [{
        field: 'ts',
        displayName: 'Время создания',
        cellFilter: 'date:\'dd.MM.yyyy HH:MM:ss \''
      }, {
        field: 'usr',
        displayName: 'Пользователь'
      }, {
        field: 'label',
        displayName: 'Объект'
      }, {
        field: 'descr',
        displayName: 'Тип задачи'
      }, {
        field: 'message',
        displayName: 'Результат'
      }
    ]
  };

  eventLog.get().then(function(data){
    //console.log(data)
    $scope.data = data;
  });

});

angular.module('ipdb').controller('ModalObjectHistoryCtrl', function($scope, $modalInstance, eventLog) {

  $scope.close = function () {
    $modalInstance.dismiss();
  };

  $scope.gridOptions = {
    data: 'data.event_log',
    multiSelect: false,
    enableColumnResize: true,
    columnDefs: [{
        field: 'ts',
        displayName: 'Время создания',
        cellFilter: 'date:\'dd.MM.yyyy HH:MM:ss \'',
        width: '*'
      }, {
        field: 'usr',
        displayName: 'Пользователь',
        width: '*'
      }, {
        field: 'descr',
        displayName: 'Тип задачи',
        width: '*'
      }, {
        field: 'message',
        displayName: 'Результат',
        width: '*****',
      }
    ]
  };

  eventLog.get($scope.$parent.contextMenuShared.eqObjId, $scope.$parent.contextMenuShared.objIds).then(function(data) {
    $scope.data = data;
    if ($scope.$parent.contextMenuShared.eqLabel) { // && $scope.$parent.contextMenuShared.eqObjId) {
      $scope.data.eqLabel = 'для ' + $scope.$parent.contextMenuShared.eqLabel;
    }
  });
});

angular.module('ipdb').controller('SearchBarCtrl', function($scope, $rootScope, searchBar) {
  // dropdown list
  $scope.search = {};
  $scope.search.focused = false;
  $scope.search.ddList = [
    {label: 'Серийный номер', query: 'serial_number'},
    {label: 'Ярлык', query: 'label'},
    {label: 'MAC-адрес', query: 'mac'},
    {label: 'IP-адрес', query: 'ip_addr'},
    {label: 'DNS-имя', query: 'fqdn'},
    {label: 'ФИО владельца', query: 'fio'},
    {label: 'Подсеть', query: 'net'},
    {label: 'Расположение', query: 'loc'},
    {divider: true},
    {label: 'Везде', query: null}
  ];
  $scope.search.selected = $scope.search.ddList[$scope.search.ddList.length - 1];

  $scope.getTypeahead = function(text) {
    return searchBar.getTypeahead(text, $scope.search.selected.query);
  };

  $scope.select = function(index) {
    $scope.search.selected = $scope.search.ddList[index];
  };

  $scope.dosearch = function() {
    if (!!$scope.search.text) { // not empty string
      searchBar.search($scope.search.text, $scope.search.selected.query).then(function(data) {
        $rootScope.$emit('searchBar:search', {
          text: $scope.search.text,
          data: data.data,
          len: data.length
        });
      });
    }
  };
});


angular.module('ipdb').controller('SearchTabCtrl', function($scope, $rootScope) {
  $scope.openEqTab = function(eqObjId, eqLabel) {
    $rootScope.$emit('rightTabs:newTab', {
      type: 'eq',
      eqLabel: eqLabel,
      eqObjId: eqObjId
    });
  };

  $scope.openIpTab = function(ipObjId, ip, comments) {
    $rootScope.$emit('rightTabs:newTab', {
      type: 'ip',
      ip: ip,
      ipObjId: ipObjId,
      comments: comments
    });
  };

  $scope.openLocTab = function(locObjId) {
    $rootScope.$emit('locTree:expand', locObjId);
  };

});


angular.module('ipdb').controller('LeftTabsCtrl', function($scope, $rootScope, leftRightTabs) {
  $scope.tabs = [
    {
      active: true,
      title: 'Общий вид',
      template: '/partials/leftLocTab',
      collapse: 'locTree:collapse'
    },
    {
      title: 'IP адреса',
      template: '/partials/leftIpTab',
      collapse: 'ipTree:collapse'
    },
    {
      title: 'VLAN',
      template: '/partials/leftVlanTab',
      collapse: 'vlanTree:collapse'
    },
    {
      title: 'DNS',
      template: '/partials/leftDnsTab',
      collapse: 'dnsTree:collapse'
    }
  ];

  $scope.$onRootScope('searchBar:search', function(event, data) {
    if ($scope.tabs[$scope.tabs.length - 1].template !== '/partials/leftSearchTab') {
      $scope.tabs.push({
        title: 'Поиск',
        template: '/partials/leftSearchTab'
      });
    }
    leftRightTabs.resetFullscreen();
    $scope.tabs[$scope.tabs.length - 1].active = true;
    $scope.tabs[$scope.tabs.length - 1].title = 'Поиск (' + data.len + ')';
    $scope.searchResults = data.data;
    $scope.searchString = data.text;
    //console.log($scope.searchString);
  });

  $scope.$onRootScope('locTree:expand', function() {
    $scope.tabs[0].active = true;
  });

  $scope.$onRootScope('ipTree:expand', function() {
    $scope.tabs[1].active = true;
  });

  $scope.$onRootScope('dnsTree:expand', function() {
    $scope.tabs[3].active = true;
  });

  $scope.fullscreen = leftRightTabs.fullscreen;

  $scope.collapse = function(collapse, $event) {
    //FIXME: because of kendotree and nested click events
    if (collapse && $event.target.localName != 'span') {
      $event.stopPropagation();
      $rootScope.$emit(collapse);
    }
  };

});


angular.module('ipdb').controller('RightTabsCtrl', function($scope, n, $rootScope, rightTabs, leftRightTabs) {
  /*
  * Parent controller for all tabs. Communication via inherited Scope.
  * */

  $scope.tabs = [];
/*
 $scope.tabs.push(
    {
      type: 'equip',
      title: '*PCM-000-001',
      active: false,
      template: '/partials/equipTab',
      eqLabel: 'PCM-000-001',
      id: '41473',
    }
  );
*/

  // init tabs from query string
  $scope.tabs = rightTabs.initFromURL();

  $scope.selectTab = function(tab) {
    // NB: this is fired on tab creation too
    rightTabs.expandTree(tab);
    $scope.selected = tab;
  };

  $scope.$onRootScope('rightTabs:newTab', function(event, item) {
    rightTabs.addTab(item);
  });

  $scope.closeTab = function(tab) {
    rightTabs.delTab(tab);
    if ($scope.tabs.length === 0) leftRightTabs.resetFullscreen();
  };

  $scope.fullscreen = leftRightTabs.fullscreen;

  $scope.fsToggle = function($event) {
    leftRightTabs.toggleRight();
  /*
    n.info($event.target.localName + '.' + $event.target.className);
    if ($event.target.className == 'hscrollbar') {
      leftRightTabs.toggleRight();
    }
  */
  };
});


angular.module('ipdb').controller('WelcomeCtrl', function(leftRightTabs) {
  leftRightTabs.resetFullscreen();
});

