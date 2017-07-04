angular.module('ipdb').controller('DnsTabCtrl', function($scope, $rootScope, dnsTab, leftRightTabs, rightTabs) {
  $scope.dns = $scope.$parent.tab.dns;
  $scope.dnsObjId = $scope.$parent.tab.dnsObjId;
  $scope.comments = $scope.$parent.tab.comments;
  $scope.fwip = $scope.$parent.tab.fwip;
  $scope.ztype = $scope.$parent.tab.ztype;
  // if ($scope.$parent.tab.ztype === 'M') {
  //   $scope.ztype = 'МАСТЕР';
  // } else {
  //   $scope.ztype = 'ФОРВАРД';
  // }

  $scope.myDblClickHandler = function(row) {
    rightTabs.addTabsBy({ ip: row.rvalue});
  };

  // var buttonCell = 
  //   '<div class="btn-group">' +
  //     '<button class="btn btn-xs btn-primary"><span class="glyphicon glyphicon-plus"></span></button>' +
  //     '<button class="btn btn-xs btn-warning"><span class="glyphicon glyphicon-edit"></span></button>' +
  //     '<button class="btn btn-xs btn-danger"><span class="glyphicon glyphicon-trash"></span></button>' +
  //   '</div>';
  $scope.gridOptions = {
    data: 'data.dns_a',
    showFilter: true,
    multiSelect: false,
    dblClickFn: $scope.myDblClickHandler,
    plugins: [ngGridDoubleClick],
    columnDefs: [
      {field: 'fqdn', displayName: 'DNS-имя'},
      {field: 'rvalue', displayName: 'IP-адрес'},
      {field: 'rttl', displayName: 'TTL'},
      //{field: '', cellTemplate: buttonCell}
    ]
  };
  
  $scope.fullscreen = leftRightTabs.fullscreen;
  $scope.$watch('fullscreen', function(newVal, oldVal){
    //$timeout(function(){
    $('.ngGrid').trigger('resize');
      //layoutPlugin.updateGridLayout();
    //}, 100);
  }, true);


//  var layoutPlugin = new ngGridLayoutPlugin();
//  function ngGridLayoutPlugin() {
//    var self = this;
//    this.grid = null;
//    this.scope = null;
//    this.init = function(scope, grid, services) {
//      self.domUtilityService = services.DomUtilityService;
//      self.grid = grid;
//      self.scope = scope;
//    };
//
//    this.updateGridLayout = function () {
//      if (!self.scope.$$phase) {
//        self.scope.$apply(function(){
//          self.domUtilityService.RebuildGrid(self.scope, self.grid);
//        });
//      }
//      else {
//        // $digest or $apply already in progress
//        self.domUtilityService.RebuildGrid(self.scope, self.grid);
//      }
//    };
//  }
  
  function ngGridDoubleClick() {
    var self = this;
    self.$scope = null;
    self.myGrid = null;

    // The init method gets called during the ng-grid directive execution.
    self.init = function(scope, grid, services) {
      // The directive passes in the grid scope and the grid object which
      // we will want to save for manipulation later.
      self.$scope = scope;
      self.myGrid = grid;
      // In this example we want to assign grid events.
      self.assignEvents();
    };
    self.assignEvents = function() {
      // Here we set the double-click event handler to the header container.
      self.myGrid.$viewport.on('dblclick', self.onDoubleClick);
    };
    // double-click function
    self.onDoubleClick = function(event) {
      self.myGrid.config.dblClickFn(self.$scope.selectedItems[0]);
    };
  }
  
  // wrapper for lazy reload
  function loadData(callback) {
    var callback = callback || function(){};
    dnsTab.getTabData($scope.dnsObjId, $scope.dns).then(function(data) {
      $scope.data = data;
      $scope.reloadMe = false;
      return callback(null);
    }, function() {
      // error while loading tab //$scope.removeTab(newTabIndex);
      $scope.reloadMe = true;
      return callback('error-load-data');
      //return $timeout(loadData, 1000);
    });
  }
  
  loadData();

  $scope.$onRootScope('socket:dnsTree', function() {
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


angular.module('ipdb').controller('FormDnsPropCtrl', function($scope, common, $modal) {
  // API
  // view -  имя св-ва в $scope.form
  // model - для инициализации ng-model в форме
  // onConfirm - во время отправки запроса на сервер здесь происходит чтение всех свойств объекта $scope.form

  $scope.form = {}; // FIXME: приходится инициализировать здесь, а не в директиве из-за angular forms 
  $scope.$watch('data', function() {
    // trigger directive reload
    $scope.init = [
      {
        view: 'fwip',
        model: $scope.data.dns_prop.forward_ip,
        onConfirm: readDomainProp
      },
      {
        view: 'comments',
        model: $scope.data.dns_prop.descr,
        onConfirm: readDomainProp
      },
      {
        view: 'name',
        model: $scope.data.dns_prop.domain_name,
        onConfirm: readDomainProp
      },
      // {
      //   view: 'ztype',
      //   model: $scope.ztype,
      //   onConfirm: readDomainProp
      // },
    ];
  });

  function readDomainProp() {
    return {
      'dns_domain_edit': {
        dnsObjId: $scope.dnsObjId,
        fwip: $scope.form.fwip || null,
        name: $scope.form.name || null,
        comments: $scope.form.comments || ''
      }
    };
  }
  
  $scope.edit = function() {
    $scope.form.editMode = true;
  };
});
