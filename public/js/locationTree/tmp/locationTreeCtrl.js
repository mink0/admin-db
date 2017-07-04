'use strict';

angular.module('ipdb').controller('LocationTreeCtrl', function($scope, locationTree, n) {
  $scope.options = [
    {
      title: 'Дерево устройств',
      type: ''
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
  $scope.kOptions = locationTree.init($scope.options[0].type);
 
  // $scope.$onRootScope("kendoRendered", function(event, widget) {
  //   n.d('rendered!');
  // })

  $scope.newEqTab = function($event) {
    //FIXME: because i can't bind dblclick to child nodes of a kendo treeview
    if ($event.target.localName == 'span') {
      $event.stopPropagation();
      locationTree.newEqTab($scope.treeview);
    }
  };

  $scope.optionSel = function(index) {
    locationTree.reload($scope.treeview, $scope.options[index].type);
  };

  $scope.$onRootScope('locTree:collapse', function() {
    // collapse all items
    $scope.treeview.collapse('.k-item');
  });

  $scope.$onRootScope('socket:locTree', function() {
    // re-read all items
    //$scope.kOptions.dataSource.read();
    locationTree.reloadNodes($scope.treeview);
  });
  
  $scope.$onRootScope('locTree:expand', function(event, eqObjId) {
    locationTree.getNodeSeq(eqObjId).then(function(nodeSeq) {
      locationTree.expandBranch($scope.treeview, nodeSeq);
    });
  });
});
