'use strict';

angular.module('ipdb').controller('LocationTreeCtrl', function($scope, locationTree, contextMenu, $modal) {
  $scope.options = [
    {
      title: 'Дерево устройств',
      type: 'eq'
    },
    {
      title: 'Дерево IP-адресов',
      type: 'ip'
    },
    {
      title: 'Все вместе',
      type: 'ipe'
    }
  ];
  
  // init tree:
  $scope.kOptions = locationTree.newkOptions($scope.options[0].type);
 
  $scope.$on('kendoWidgetCreated', function(event, widget) {
    // the event is emitted for every widget; if we have multiple
    // widgets in this controller, we need to check that the event
    // is for the one we're interested in.
    if (widget === $scope.treeview) {
      locationTree.treeview = $scope.treeview;

      //FIXME: brutal hack for the right click events
      // $scope.treeview.element.on('mousedown', '.k-in', function(event) {
      //   // Handle right click events...
      //   if (event.which === 3) {
      //     var $item = $(event.target);
      //     console.log($scope.treeview.dataItem($item));
      //   }
      // });
    }
  });

  $scope.newEqTab = function($event) {
    //FIXME: because i can't bind dblclick to child nodes of a kendo treeview
    if ($event.target.localName == 'span') {
      $event.stopPropagation();
      locationTree.newEqTab();
    }
  };

  $scope.optionSel = function(index) {
    locationTree.reloadTree({ treeType: $scope.options[index].type });
  };

  $scope.contextMenu = function($event) {
    // FIXME: native right click events will be implemented in Q2.2014
    // so far - workaround...
    
    $scope.treeview.select($event.target);
    var selected = $scope.treeview.dataItem($event.target);

    $scope.contextMenuShared = {
      selected: selected,
      eqObjId: selected.id,
      eqLabel: selected.text
    };
    
    var menu = [];

    if (selected.obj_type === 'LOCA') {
      menu.push({label: 'Создать в ' + selected.text, call: createNew, icon: 'glyphicon-plus'});
    } else {
      menu.push({label: selected.text, call: function(){}, disabled: true});
    }
    
    // common part
    menu.push.apply(menu, [
      {divider: true},
      {label: 'Вырезать объект', disabled: true},
      {label: 'Вставить объект', disabled: true},
      {divider: true},
      {label: 'Журнал', call: showHistory, icon: 'glyphicon-book'},
    ]);
    
    var options = {};

    contextMenu.set(menu, options);

    function showHistory() {
      $modal.open({
        templateUrl: '/partials/modals/modalObjHistory',
        controller: 'ModalObjectHistoryCtrl',
        scope: $scope,
        //size: 'lg'
        windowClass: 'full-width-modal'
      });
    }

    function createNew() {
      var modalScope = $scope.$new(true);
      modalScope.parentObjId = $scope.contextMenuShared.eqObjId;
      modalScope.eqLabel = $scope.contextMenuShared.eqLabel;
      $modal.open({
        templateUrl: '/partials/modals/modalEqNewGeneral',
        controller: 'ModalEqNewGeneralCtrl',
        scope: modalScope,
        //size: 'lg'
        //windowClass: 'full-width-modal'
      });
    }
  };

  $scope.$onRootScope('locTree:collapse', function() {
    // collapse all items
    $scope.treeview.collapse('.k-item');
  });

  $scope.$onRootScope('socket:locTree', function() {
    // re-read all items
    locationTree.resetCache();
    locationTree.reloadTree();
  });
  
  $scope.$onRootScope('locTree:expand', function(event, eqObjId) {
    if (locationTree.treeview !== null) {
      locationTree.getNodeSeq(eqObjId).then(function(nodeSeq) {
        locationTree.expandBranch(nodeSeq);
      });
    }
  });

});

angular.module('ipdb').controller('ModalEqNewGeneralCtrl', function($scope, common, eqTab) {
  $scope.data = {};
  
  // init
  common.view.post({
    'eq_types': {},
    'eq_stnames': {},
    'ip_free': {parentObjId: $scope.parentObjId}
  }).then(function(data) {
    $scope.eqtypes = data.eq_types;
    $scope.statusNames = data.eq_stnames;
    $scope.ipFreeAddrs = data.ip_free;
    
    $scope.data.status = $scope.statusNames[17];  // default status = "Используется"
    $scope.data.isDyn = true;
  });

  //args.eqObjId, args.name, args.mac, args.every, null, args.isTrunk]},
  $scope.confirm = function() {
    common.edit.get({
      fname: 'ip_add',
      args: {
        ifObjId: $scope.iface.ifObjId,
        ip: $scope.data.ip,
        isDyn: $scope.data.isDyn
      }
    }).then(function() {
      $scope.$close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.$watch('data.type', function() {
    if (!$scope.data.type) return;

    $scope.show = {general: true}; // reset
    
    if (['пк', 'сервер', 'виртуальный сервер', 'ноутбук', 'принт-сервер'].indexOf($scope.data.type.toLowerCase()) !== -1) {
      $scope.show.ipaddr = true;
    }
    
    $scope.eqvendors = {};
    // if (!$scope.data.type) return; // skip empty
    common.view.get('eq_vendors', {eqtype: $scope.data.type}).then(function(data) {
      $scope.eqvendors = data;
      $scope.data.vendor = $scope.eqvendors[Object.keys($scope.eqvendors)[0]];
    });
  });

  $scope.$watch('eqvendors', function() {
    $scope.eqmodels = {};
    common.view.get('eq_models', {eqtype: $scope.data.type, eqvendor: $scope.data.vendor}).then(function(data) {
      $scope.eqmodels = data;
      $scope.data.model = $scope.eqmodels[Object.keys($scope.eqmodels)[0]];
    });
  });

  $scope.getFioTypeahead = function(text) {
    return eqTab.getFioTypeahead(text);
  };

  $scope.onIpChange = function onIpChange(newip) {
    if (!newip) return; // skip empty

    $scope.data.iperr = null;
    eqTab.getIpInfo(newip).then(function(data) {
      $scope.data.net = data;
    }, function(err) {
      if (err === 'err') {
        $scope.data.iperr = 'err';
      } else if (err === 'unknown') {
        $scope.data.iperr = 'success';
      }
    });
  };

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $scope.$dismiss();
  };
});


