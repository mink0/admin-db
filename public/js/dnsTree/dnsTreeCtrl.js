'use strict';

angular.module('ipdb').controller('DnsTreeCtrl', function($scope, dnsTree) {
  // init tree:
  $scope.kOptions = dnsTree.newkOptions();

  $scope.$on('kendoWidgetCreated', function(event, widget) {
    // the event is emitted for every widget; if we have multiple
    // widgets in this controller, we need to check that the event
    // is for the one we're interested in.
    if (widget === $scope.treeview) {
      dnsTree.treeview = $scope.treeview;
    }
  });

  $scope.openTab = function($event) {
    //FIXME: because i can't bind dblclick to child nodes of a kendo treeview
    if ($event.target.localName == 'span') {
      $event.stopPropagation();
      dnsTree.newDnsTab();
    }
  };

  $scope.$onRootScope('dnsTree:collapse', function() {
    // collapse all items
    $scope.treeview.collapse('.k-item');
  });

  $scope.$onRootScope('dnsTree:expand', function(event, dnsObjId) {
    if (dnsTree.treeview !== null) {
      dnsTree.selectNode(dnsObjId);
    }
  });

  $scope.$watch('filterStr', function(newVal, oldVal) {
    if (dnsTree.treeview !== null) {
      if (!newVal) {
        dnsTree.treeview.dataSource.filter({});
      } else {
        dnsTree.treeview.dataSource.filter({
          field: 'text',
          operator: 'contains',
          value: $scope.filterStr
        });
      }
    }
  });

  $scope.$onRootScope('socket:dnsTree', function() {
    // re-read all items
    dnsTree.reloadTree();
  });

});
