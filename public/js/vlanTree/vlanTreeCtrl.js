'use strict';

angular.module('ipdb').controller('VlanTreeCtrl', function($scope, vlanTree) {
  // init tree:
  $scope.kOptions = vlanTree.newkOptions();
 
  $scope.$on('kendoWidgetCreated', function(event, widget) {
    // the event is emitted for every widget; if we have multiple
    // widgets in this controller, we need to check that the event
    // is for the one we're interested in.
    if (widget === $scope.treeview) {
      vlanTree.treeview = $scope.treeview;
    }
  });
 
  $scope.openTab = function($event) {
    //FIXME: because i can't bind dblclick to child nodes of a kendo treeview
    if ($event.target.localName === 'span') {
      $event.stopPropagation();
      vlanTree.openTab($scope.treeview);
    }
  };

  $scope.$onRootScope('vlanTree:collapse', function() {
    // collapse all items
    $scope.treeview.collapse('.k-item');
  });

  $scope.$watch('filterStr', function(newVal, oldVal) {
    if (vlanTree.treeview !== null) {
      if (!newVal) {
        vlanTree.treeview.dataSource.filter({});
      } else {
        vlanTree.treeview.dataSource.filter({
          field: 'text',
          operator: 'contains',
          value: $scope.filterStr
        });
      }
    }
  });
  
  $scope.$onRootScope('socket:vlanTree', function() {
    // re-read all items
    vlanTree.reloadTree();
    //no cache is used
  });

});
