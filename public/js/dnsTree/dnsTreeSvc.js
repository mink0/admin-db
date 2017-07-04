'use strict';

angular.module('ipdb').service('dnsTree', function($http, $rootScope) {
  this.treeview = null;
  this.kOptions = null;

  var self = this;

  this.newkOptions = function() {
    this.kDataSource = new kendo.data.HierarchicalDataSource({
      transport: {
        read: {
          url: '/api/get/dns_domains',
          dataType: 'json',   // jsonp for cross-domain requests, use jsonp to avoid caching also
          cache: false
        }
      },
      schema: {
        model: {
          id: 'obj_id',
          hasChildren: 'child_counter',
          fields: {
            text: 'domain_name'
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

  this.newDnsTab = function() {
    //var selected = self.treeview.dataSource.get(self.treeview.select());
    var selected = self.treeview.dataItem(self.treeview.select());
    if (selected && !selected.hasChildren) {
      $rootScope.$emit('rightTabs:newTab', {
        type: 'dns',
        dns: selected.text,
        dnsObjId: selected.obj_id,
        comments: selected.descr,
        ztype: selected.zone_type,
        fwip: selected.forward_ip
      });
    }
  };

  this.selectNode = function(dnsObjId) {
    if (self.treeview.dataSource.get(dnsObjId)) {
      self.treeview.select(self.treeview.findByUid(self.treeview.dataSource.get(dnsObjId).uid));
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

  this.reloadTree = function() {
    // save selected
    var selected;
    if (self.treeview.select().length > 0) {
      selected = self.treeview.dataItem(self.treeview.select()).obj_id;
    }
    // collapse all items and restore expanded nodes
    this.reloadData(function() {
      if (selected) {
        self.selectNode(selected);
      }
    });
  };

});
