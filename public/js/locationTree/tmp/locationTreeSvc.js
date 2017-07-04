'use strict';

angular.module('ipdb').factory('locationTree', function($http, $rootScope, $q, n) {
  return {
    init: init,
    reload: reload,
    newEqTab: newEqTab,
    getNodeSeq: getNodeSeq,
    expandBranch: expandBranch,
    reloadNodes: reloadNodes
  };

  function reload(treeview, tree_type) {
    //$scope.treeview.dataSource.transport.options.read.url = '/api/get/tree_view?t=' + $scope.options[index].qparam;
    //$scope.treeview.dataSource.read();
    var kOpts = init(tree_type);
    treeview.setDataSource(kOpts.dataSource);
  }
  
  function init(tree_type) {
    //treeview = treeV; // store link to kendo treeview. it doesn't work (((
    var qparam = tree_type ? '?t=' + tree_type : '';
    
    var kDataSource = new kendo.data.HierarchicalDataSource({
      transport: {
        read: {
          url: '/api/get/tree_view' + qparam,
          dataType: 'json',   // jsonp for cross-domain requests, use jsonp to avoid caching also
          cache: false
        }
      },
      schema: {
        model: {
          id: 'obj_id',
          hasChildren: 'child_counter',
          fields: {
            text: 'obj_name'
          }
        }
      }
    });
    var kOptions = {
      dataSource: kDataSource,
      //dataTextField: 'obj_name', // moved to dataSource
      expand: function(e) {
        // always reloading child nodes when nodes are expanded
        var dataItem = this.dataItem(e.node);
        dataItem.loaded(false);
      }
      /*
       select: function(e) {
       $scope.curItem = this.dataItem(e.node);
       },
       dataBound: function(e) {
       n.info('dataBound');
       //console.log("DataBound", e.node);
       }, complete: function(e) {
       console.log($scope.treeview);
       }
       */
    };
    
    return kOptions;
  }
  
  
  function newEqTab(treeview) {
    //var selected = treeview.dataSource.get(treeview.select());
    var selected = treeview.dataItem(treeview.select());
    if (selected && selected.obj_type !== 'LOCA') {
      $rootScope.$emit('rightTabs:newTab', {
        type: 'eq',
        eqLabel: selected.text,
        eqObjId: selected.obj_id
        // objType: selected.obj_type
      });
    }
  }
  
  function getNodeSeq(eqObjId) {
    var result = $q.defer();
    $http.get('/api/get/tree_seq', { cache: false, params: { obj_id: eqObjId }})
      .success(function(data) {
        result.resolve(data);
      })
      .error(function(err) {
        result.reject();
        n.error();
      });
    return result.promise;
  }
  
  function reloadNodes(treeview, seq) {
    function getExpandedItems(treeview) {
      var nodes = treeview.dataSource.view();
      return _getExpandedNodes(nodes);
    }

    function _getExpandedNodes(nodes) {
      var node, childCheckedNodes;
      var checkedNodes = [];

      for (var i=0; i<nodes.length; i++) {
        node = nodes[i];
        if (node.expanded) {
          checkedNodes.push(node.obj_id);
        }

        if (node.hasChildren) {
          childCheckedNodes = _getExpandedNodes(node.children.view());
          if (childCheckedNodes.length > 0) {
            checkedNodes = checkedNodes.concat(childCheckedNodes);
          }
        }

      }

      return checkedNodes;
    }


    var expanded = getExpandedItems(treeview, seq);
    var selected = treeview.dataItem(treeview.select()).obj_id;
    // collapse all items
    //treeview.dataSource.read();
    treeview.collapse('.k-item');
    expandNodes(treeview, expanded, function() {
      getNodeSeq(selected).then(function(nodeSeq) {
        expandBranch(treeview, nodeSeq);
      });
    });
  }

  function expandBranch(treeview, path) {
    var path = path || [];
    var node2sel = path.splice(path.length - 1, 1)[0];
    expandNodes(treeview, path, function() {
      treeview.select(treeview.findByUid(treeview.dataSource.get(node2sel).uid));
    });
  }

  function expandNodes(treeview, seq, callback) {
    var seq = seq || [];
    var callback = callback || function(){};
    
    if (seq.length === 0) {
      return callback(); // recursion end
    } else {
      var nodeId = seq[0];
      var dataItem = treeview.dataSource.get(nodeId);
      if (dataItem && dataItem.expanded) {
        seq.splice(0, 1);
        expandNodes(treeview, seq, callback);  // do recursion
      } else {
        var nodeToExpand = treeview.findByUid(dataItem.uid);
        treeview.one('dataBound', function dataBoundHandler() {
          seq.splice(0, 1);
          expandNodes(treeview, seq, callback);  // do recursion
        });
      }
      treeview.expand(nodeToExpand);
    }
  }

  // remove me
  function _expandNode(treeview, seq) {
    var seq = seq || [];

    if (seq.length === 1) {
      treeview.select(treeview.findByUid(treeview.dataSource.get(seq[0]).uid));
      return; // recursion end
    } else {
      var nodeId = seq[0];
      var dataItem = treeview.dataSource.get(nodeId);
      if (dataItem && dataItem.expanded) {
        seq.splice(0, 1);
        expandNode(treeview, seq);  // make recursion
      } else {
        var nodeToExpand = treeview.findByUid(dataItem.uid);
        treeview.one('dataBound', function dataBoundHandler() {
          seq.splice(0, 1);
          expandNode(treeview, seq);  // make recursion
        });
      }
      treeview.expand(nodeToExpand);
    }
  }
 
  function updateWidget(data) {
    var newData = data || $scope.locData.data;
    $scope.locData.data(newData);
  }

  function ajaxNoCache() {
    // prevents IE cache!
    return '?_=' + new Date().getTime();
  }
});
