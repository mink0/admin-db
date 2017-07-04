'use strict';

angular.module('ipdb').service('ipTree', function($http, $rootScope, $q, $cacheFactory, n) {
  this.treeview = null;
  this.kOptions = null;

  var self = this;
  
  this.getTreeObjId = function(ipObjId, cache) {
    var cache = cache || true;
    
    var d = $q.defer();
    $http.get('/api/get/tree_obj_id?obj_id=' + ipObjId, { cache: cache })
      .success(function(data) {
        if (!data) {
          n.error('Неизвестная подсеть ' + ipObjId);
          d.reject();
        }
        d.resolve(data);
      });
    return d.promise;
  };

  this.newkOptions = function() {
    this.kDataSource = new kendo.data.HierarchicalDataSource({
      transport: {
        read: {
          url: '/api/get/tree_view?t=nets_ip_tree',
          dataType: 'json',   // jsonp for cross-domain requests, use jsonp to avoid caching also
          cache: false
        }
      },
      schema: {
        model: {
          id: 'tree_obj_id',
          hasChildren: 'child_counter',
          fields: {
            text: 'addr_text'
          }
        }
      }
    });
    this.kOptions = {
      dataSource: this.kDataSource,
      //dataTextField: 'obj_name', // moved to dataSource
      expand: function(e) {
        // always reloading child nodes when nodes are expanded
        var dataItem = this.dataItem(e.node);
        dataItem.loaded(false);
      }
    };
  
    return this.kOptions;
  };

  this.newIpTab = function() {
    //var selected = treeview.dataSource.get(treeview.select());
    var selected = self.treeview.dataItem(self.treeview.select());
    if (selected && !selected.hasChildren) {
      $rootScope.$emit('rightTabs:newTab', {
        type: 'ip',
        ip: selected.addr,
        ipObjId: selected.obj_id,
        comments: selected.note
      });
    }
  };
  
  this.getNodeSeq = function(ipObjId, cache) {
    var cache = cache || true;
    
    var result = $q.defer();
    $http.get('/api/get/tree_seq?t=nets_ip_tree', { params: { tree_obj_id: ipObjId }, cache: cache })
      .success(function(data) {
        result.resolve(data);
      })
      .error(function(err) {
        result.reject();
        n.error();
      });
    return result.promise;
  };

  this.expandBranch = function(path) {
    var path = path || [];
    var node2sel = path.splice(path.length - 1, 1)[0];
    expandNodes(path, function() {
      self.treeview.select(self.treeview.findByUid(self.treeview.dataSource.get(node2sel).uid));
    });
  };

  function expandNodes(seq, callback) {
    var seq = seq || [];
    var callback = callback || function(){};
    
    //console.log(self.treeview);
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

  this.reloadData = function(callback) {
    var callback = callback || function(){};

    var kOpts = this.newkOptions();
    this.treeview.one('dataBound', function() {
      return callback();
    });
    this.treeview.setDataSource(kOpts.dataSource);
  };

  this.reloadTree = function(options) {
    var opts = options || {};

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
          checkedNodes.push(node.id);
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
      selected = self.treeview.dataItem(self.treeview.select()).id;
    }
    // collapse all items and restore expanded nodes
    this.reloadData(function() {
      expandNodes(expanded, function() {
        if (selected) {
          self.getNodeSeq(selected).then(function(nodeSeq) {
            self.expandBranch(nodeSeq);
          });
        }
      });
    });
  };
 
  this.resetCache = function() {
    //n.d($cacheFactory.info());
    $cacheFactory.get('$http').removeAll();
    //n.d($cacheFactory.info());
  };

});