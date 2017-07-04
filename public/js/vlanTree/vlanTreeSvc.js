'use strict';

angular.module('ipdb').service('vlanTree', function($http, $rootScope, $q, n) {
  this.treeview = null;
  this.kOptions = null;

  var self = this;
  
  this.newkOptions = function() {
    this.kDataSource = new kendo.data.HierarchicalDataSource({
      transport: {
        read: {
          url: '/api/get/tree_view?t=vlans_tree',
          dataType: 'json',   // jsonp for cross-domain requests, use jsonp to avoid caching also
          cache: false
        }
      },
      schema: {
        model: {
          id: 'tree_id',
          hasChildren: 'child_counter',
          fields: {
            text: 'obj_text'
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
  
  this.openTab = function() {
    //var selected = treeview.dataSource.get(treeview.select());
    var selected = self.treeview.dataItem(self.treeview.select());
    if (selected && !selected.hasChildren) {
      if (selected.obj_type === 'EQUIP') {
        $rootScope.$emit('rightTabs:newTab', {
          type: 'eq',
          eqLabel: selected.text,
          eqObjId: selected.obj_id
        });
      } else if (selected.obj_type === 'IFACE') {
        $http.get('/api/get/vlan_get_eq', { params: { if_obj_id: selected.obj_id }})
         .success(function(data) {
            $rootScope.$emit('rightTabs:newTab', {
              type: 'eq',
              eqLabel: data.obj_text,
              eqObjId: data.obj_id
            });
          })
        .error(function(err) {
          n.error('Неизвестное устройство');
        });
      }
    }
  };
  
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

      for (var i = 0; i < nodes.length; i++) {
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
          self.treeview.select(self.treeview.findByUid(self.treeview.dataSource.get(selected).uid));
        }
      });
    });
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

});

