'use strict';

angular.module('ipdb').service('locationTree', function($http, $rootScope, $q, n, $cacheFactory, $log) {
  this.treeview = null;
  this.kOptions = null;

  var self = this,
    treeType = '';
 
  this.newkOptions = function(treeTypeOpt) {
    treeType = treeTypeOpt || treeType;
 
    var qparam = treeType ? '?t=' + treeType : '';
    this.kDataSource = new kendo.data.HierarchicalDataSource({
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
    this.kOptions = {
      dataSource: this.kDataSource,
      expand: function(e) {
        // always reloading child nodes when nodes are expanded
        var dataItem = this.dataItem(e.node);
        dataItem.loaded(false);
      }
      // navigate: function(e) {
      //   console.log('Navigated to ' + this.dataItem(e.node));
      //   //$scope.curItem = this.dataItem(e.node);
      // }
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

    return this.kOptions;
  };
  
  this.reloadData = function(treeType, callback) {
    var callback = callback || function(){};

    var kOpts = this.newkOptions(treeType);
    this.treeview.one('dataBound', function() {
      return callback();
    });
    this.treeview.setDataSource(kOpts.dataSource);
  };
  
  this.newEqTab = function() {
    //var selected = this.treeview.dataSource.get(this.treeview.select());
    var selected = this.treeview.dataItem(this.treeview.select());
    if (selected && selected.obj_type !== 'LOCA') {
      $rootScope.$emit('rightTabs:newTab', {
        type: 'eq',
        eqLabel: selected.text,
        eqObjId: selected.obj_id
        // objType: selected.obj_type
      });
    }
  };
  
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


  this.getNodeSeq = function(eqObjId) {
    var result = $q.defer();
    $http.get('/api/get/tree_seq', { params: { obj_id: eqObjId }, cache: true })
      .success(function(data) {
        result.resolve(data);
      })
      .error(function(err) {
        result.reject();
        n.error();
      });
    return result.promise;
  };
  
  this.reloadTree = function(options) {
    var opts = options || {};
    opts.treeType = opts.treeType || treeType;

    function getExpandedItems() {
      var nodes = self.treeview.dataSource.view();
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

    // save expanded and selected
    var expanded = getExpandedItems();
    var selected;
    if (self.treeview.select() > 0) {
      selected = self.treeview.dataItem(self.treeview.select()).obj_id;
    }
    // collapse all items and restore expanded nodes
    this.reloadData(opts.treeType, function() {
      expandNodes(expanded, function() {
        if (selected) {
          self.getNodeSeq(selected).then(function(nodeSeq) {
            self.expandBranch(nodeSeq);
          });
        }
      });
    });
  };

  this.expandBranch = function(path) {
    var path = path || [];
    var node2sel = path.splice(path.length - 1, 1)[0];

    expandNodes(path, function() {
      if (self.treeview.dataSource.get(node2sel)) {
        self.treeview.select(self.treeview.findByUid(self.treeview.dataSource.get(node2sel).uid));
      } else {
        $log.warn('Не могу выделить элемент, родительская ветка не раскрыта');
      }
    });
  };

  function expandNodes(seq, callback) {
    var seq = seq || [];
    var callback = callback || function(){};
    
    if (seq.length === 0) {
      return callback(); // recursion end
    } else {
      var nodeId = seq[0];
      var dataItem = self.treeview.dataSource.get(nodeId);
      if (dataItem && dataItem.expanded) {
        seq.splice(0, 1);
        expandNodes(seq, callback);  // do recursion
      } else {
        var nodeToExpand = self.treeview.findByUid(dataItem.uid);
        self.treeview.one('dataBound', function dataBoundHandler() {
          seq.splice(0, 1);
          expandNodes(seq, callback);  // do recursion
        });
        self.treeview.expand(nodeToExpand);
      }
    }
  }

  this.resetCache = function() {
    //n.d($cacheFactory.info());
    $cacheFactory.get('$http').removeAll();
    //n.d($cacheFactory.info());
  };

  function updateWidget(data) {
    var newData = data || $scope.locData.data;
    $scope.locData.data(newData);
  }

  function ajaxNoCache() {
    // prevents IE cache!
    return '?_=' + new Date().getTime();
  }

});
