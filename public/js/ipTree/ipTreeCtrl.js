'use strict';

angular.module('ipdb').controller('IpTreeCtrl', function($scope, ipTree, common, contextMenu, $modal) {
  // init tree:
  $scope.kOptions = ipTree.newkOptions();
 
  $scope.$on('kendoWidgetCreated', function(event, widget) {
    // the event is emitted for every widget; if we have multiple
    // widgets in this controller, we need to check that the event
    // is for the one we're interested in.
    if (widget === $scope.treeview) {
      ipTree.treeview = $scope.treeview;
    }
  });
 
  $scope.newIpTab = function($event) {
    //FIXME: because i can't bind dblclick to child nodes of a kendo treeview
    if ($event.target.localName == 'span') {
      $event.stopPropagation();
      ipTree.newIpTab();
    }
  };

  $scope.contextMenu = function($event) {
    // FIXME: native right click events will be implemented in Q2.2014
    // so far - workaround...
    
    $scope.treeview.select($event.target);
    var selected = $scope.treeview.dataItem($event.target);
    
    // эти данные нужны всей менюшке
    $scope.contextMenuShared = {
      selected: selected,
      eqObjId: selected.obj_id,
      eqLabel: selected.text
    };

    var menu =  [
      {label: selected.text, call: function(){}, disabled: true},
      // {divider: true},
      // {label: 'Вырезать объект', disabled: true},
      // {label: 'Вставить объект', disabled: true},
      {divider: true},
      {label: 'Журнал', call: showHistory, icon: 'glyphicon-book'},
    ];
    
    var options = {};

    contextMenu.set(menu, options);

    function showHistory() {
      if (!$scope.contextMenuShared.eqObjId) {
        common.view.get({
          fname: 'tree_children', 
          args: {eqLabel: $scope.contextMenuShared.eqLabel}
        }).then(function(data) {
          $scope.contextMenuShared.objIds = data;
          
          $modal.open({
            templateUrl: '/partials/modals/modalObjHistory',
            controller: 'ModalObjectHistoryCtrl',
            scope: $scope,
            //size: 'lg'
            windowClass: 'full-width-modal'
          });
        });
      } else {
        $modal.open({
          templateUrl: '/partials/modals/modalObjHistory',
          controller: 'ModalObjectHistoryCtrl',
          scope: $scope,
          //size: 'lg'
          windowClass: 'full-width-modal'
        });
      }
    }
  };

  $scope.$onRootScope('ipTree:collapse', function() {
    // collapse all items
    $scope.treeview.collapse('.k-item');
  });

  $scope.$onRootScope('socket:ipTree', function() {
    // re-read all items
    ipTree.resetCache();
    ipTree.reloadTree();
  });
  
  $scope.$onRootScope('ipTree:expand', function(event, ipObjId) {
    if (ipTree.treeview !== null) {
      ipTree.getTreeObjId(ipObjId).then(function(treeObjId) {
        ipTree.getNodeSeq(treeObjId).then(function(nodeSeq) {
          ipTree.expandBranch(nodeSeq);
        });
      });
    }
  });
});
