angular.module('ipdb').controller('EqTabCtrl', function($scope, eqTab, $modal, common, topNav, n, leftRightTabs) {
  // init
  // *************************************************************************************************

  $scope.eqLabel = $scope.$parent.tab.eqLabel;
  $scope.eqObjId = $scope.$parent.tab.eqObjId;
  var vlansHandlerSet = false;

  // wrapper for lazy reload
  // *************************************************************************************************
  function loadData(callback) {
    var callback = callback || function() {};

    eqTab.getTabData($scope.eqObjId, $scope.eqLabel).then(function(data) {
      //console.log(data);
      
      $scope.data = data;
      $scope.reloadMe = false;

      if (data.eq_spec && data.eq_spec.hasOwnProperty('vlans') && !vlansHandlerSet) {
        // watch for vlans for vlan table reload
        vlansHandlerSet = true;
        $scope.$onRootScope('socket:vlanTree', function() {
          $scope.reloadMe = true;
          if ($scope.$parent.selected === $scope.tab) {
            loadData();
          }
        });
      }
      
      if (data.eq_spec && data.eq_spec.hasOwnProperty('if_vlans')) {
        for (var i=0; i < $scope.data.eq_ifaces.length; i++) {
          if (data.eq_spec.if_vlans && data.eq_spec.if_vlans.hasOwnProperty(data.eq_ifaces[i].ifObjId)) {
            data.eq_ifaces[i].vlans = data.eq_spec.if_vlans[data.eq_ifaces[i].ifObjId];
          }
        }
      }
      
      return callback(null);
    }, function() {
      // error while loading tab //$scope.removeTab(newTabIndex);
      $scope.reloadMe = true;
      return callback('error.load_data');
    });
  }

  loadData(function() {
    if ($scope.eqLabel.slice(0, 3).toLowerCase() === 'ss-') $scope.data.eq_info.model_name = 'Стек коммутаторов';

    $scope.thead = [{
      title: 'Интерфейс',
      column: 'name'
    }, {
      title: 'MAC-адрес',
      column: 'mac'
    }, {
      title: 'Везде',
      column: 'every'
    }, {
      title: 'IP-адрес',
      column: 'addrData.ip'
    // }, {
    //   title: 'Профиль',
    //   column: 'addrData.dhcpP'
    }, {
      title: 'DHCP',
      column: 'addrData.isDyn'
    }, {
      title: 'Транк',
      column: 'isTrunk'
    }];

    if ($scope.data.eq_spec && $scope.data.eq_spec.hasOwnProperty('if_vlans')) {
      $scope.thead.push({
        title: 'VLAN',
        column: 'vlans'
      });
    }

    $scope.sort = {
      column: '',
      descending: false
    };

    $scope.changeSorting = function(column) {
      if ($scope.sort.column === column) {
        $scope.sort.descending = !$scope.sort.descending;
      } else {
        $scope.sort.column = column;
        $scope.sort.descending = false;
      }
    };
  });

  $scope.$onRootScope('socket:eqChange', function() {
    $scope.reloadMe = true;
    if ($scope.$parent.selected === $scope.tab) {
      loadData();
    }
  });
  
  $scope.$parent.$watch('selected', function(newval) {
    // lazy tab reload: reload is happen only when tab is selected
    if (newval === $scope.tab && $scope.reloadMe === true) {
      loadData();
    }
  });

  // *************************************************************************************************
  $scope.expandRight = function() {
    leftRightTabs.toggleRight();
  };

  $scope.eqReFill = function() {
    common.edit.get({
      fname: 'eq_snmp_fill',
      args: {
        eqLabel: $scope.eqLabel
      }
    }).then(function() {
      n.success('Задание поставлено в очередь на выполнение');
      topNav.showTasks();
    });
  };

  $scope.ifIpEdit = function(iface, index) {
    var modalScope = $scope.$new(true);
    modalScope.eqObjId = $scope.eqObjId;
    modalScope.iface = iface;
    modalScope.index = index;
    $modal.open({
      templateUrl: '/partials/modals/modalEqIpEdit',
      controller: 'ModalEqIpEditCtrl',
      windowClass: 'modal fade in',
      scope: modalScope,
      size: 'lg'
    });
  };

  $scope.ifIpNew = function(iface) {
    var modalScope = $scope.$new(true);
    modalScope.iface = iface;
    modalScope.eqObjId = $scope.eqObjId;
    $modal.open({
      templateUrl: '/partials/modals/modalEqIpNew',
      controller: 'ModalEqIpNewCtrl',
      windowClass: 'modal fade in',
      scope: modalScope,
      size: 'lg'
    });
  };

  $scope.ifDelete = function(iface) {
    var modalScope = $scope.$new(true);
    modalScope.eqObjId = $scope.eqObjId;
    modalScope.dlg = {
      no: 'Отмена',
      yes: 'Удалить',
      title: 'Удалить интерфейс ' + iface.name + '?',
      get: {
        fname: 'if_del',
        args: {
          ifObjId: iface.ifObjId
        }
      }
    };
    $modal.open({
      templateUrl: '/partials/modals/modalConfirm',
      controller: 'ModalConfirmCtrl',
      windowClass: 'modal fade in',
      scope: modalScope,
      size: 'lg'
    });
  };

  $scope.ifNew = function($event) {
    $event.stopPropagation();
    var modalScope = $scope.$new(true);
    modalScope.eqObjId = $scope.eqObjId;
    $modal.open({
      templateUrl: '/partials/modals/modalEqIfNew',
      controller: 'ModalEqIfNewCtrl',
      windowClass: 'modal fade in',
      scope: modalScope,
      size: 'lg'
    });
  };

  $scope.ifDhcpEdit = function(iface, index) {
    //iface[item] = false;
    var modalScope = $scope.$new(true);
    modalScope.iface = iface;
    modalScope.index = index;
    modalScope.ip = iface.addrData.ip[index];
    modalScope.dlg = {
      no: 'Отмена',
      yes: 'Сохранить',
      title: 'Сохранить изменения?'
    };
    var md = $modal.open({
      templateUrl: '/partials/modals/modalConfirm',
      controller: 'ModalEqIfDhcpEditCtrl',
      scope: modalScope,
      windowClass: 'modal fade in',
      size: 'lg'
    });
    md.result.then(function() {
      //FIXME: у юры не высылается нотифай, убрать после всего
      n.info('Новое значение флага DHCP для ip ' + modalScope.ip + ' было назначено');
      loadData();
    });
  };

  $scope.ifNameEdit = function(iface) {
    var modalScope = $scope.$new(true);
    modalScope.iface = iface;
    modalScope.editable = 'name';
    modalScope.placeholder = 'Название интерфейса';
    modalScope.eqObjId = $scope.eqObjId;

    var md = $modal.open({
      templateUrl: '/partials/modals/modalEqItemRename',
      controller: 'ModalEqIfNameEditCtrl',
      scope: modalScope,
      windowClass: 'modal fade in',
      size: 'lg'
    });
    // md.result.then(function() {
    //  //n.success('ok!');
    // });
  };

  $scope.ifMacEdit = function(iface) {
    var modalScope = $scope.$new(true);
    modalScope.iface = iface;
    modalScope.placeholder = 'MAC-адрес';
    modalScope.eqObjId = $scope.eqObjId;

    $modal.open({
      templateUrl: '/partials/modals/modalEqIfMacEdit',
      controller: 'ModalEqIfMacEditCtrl',
      scope: modalScope,
      windowClass: 'modal fade in',
      size: 'lg'
    });
  };

  $scope.ifChkEdit = function(item, iface) {
    //iface[item] = false;
    var modalScope = $scope.$new(true);
    modalScope.iface = iface;
    modalScope.item = item;
    modalScope.eqObjId = $scope.eqObjId;
    modalScope.dlg = {
      no: 'Отмена',
      yes: 'Сохранить',
      title: 'Сохранить изменения?'
    };
    var md = $modal.open({
      templateUrl: '/partials/modals/modalConfirm',
      controller: 'ModalEqChbEditCtrl',
      scope: modalScope,
      windowClass: 'modal fade in',
      size: 'lg'
    });
  };
});

angular.module('ipdb').controller('ModalEqIfNameEditCtrl', function($scope, $modalInstance, eqTab) {
  $scope.unchanged = $scope.iface[$scope.editable];

  $scope.confirm = function() {
    eqTab.ifaceEdit({
      eqObjId: $scope.eqObjId,
      ifObjId: $scope.iface.ifObjId,
      name: $scope.iface.name,
      mac: $scope.iface.mac,
      every: $scope.iface.every,
      isTrunk: $scope.iface.isTrunk
    }).then(function() {
      $modalInstance.close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $modalInstance.dismiss();
  };

  $modalInstance.result.then(function() {}, function() {
    $scope.iface[$scope.editable] = $scope.unchanged;
  });

});


angular.module('ipdb').controller('ModalEqChbEditCtrl', function($scope, $modalInstance, eqTab) {
  // $scope.dlg.no = $scope.dlg.yes || 'Отмена';
  // $scope.dlg.yes = $scope.dlg.yes || 'Сохранить';
  // $scope.dlg.title = $scope.dlg.title || 'Сохранить изменения?';

  $scope.confirm = function() {
    eqTab.ifaceEdit({
      eqObjId: $scope.eqObjId,
      ifObjId: $scope.iface.ifObjId,
      name: $scope.iface.name,
      mac: $scope.iface.mac,
      every: $scope.iface.every,
      isTrunk: $scope.iface.isTrunk
    }).then(function() {
      $modalInstance.close();
    }, function(err) {
      $scope.error = err;
    });
  };
  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $modalInstance.dismiss();
  };

  $modalInstance.result.then(function() {}, function() {
    $scope.iface[$scope.item] = !$scope.iface[$scope.item];
  });
});

angular.module('ipdb').controller('ModalEqIfMacEditCtrl', function($scope, $modalInstance, eqTab) {
  $scope.unchanged = $scope.iface.mac;

  $scope.confirm = function() {
    eqTab.ifaceEdit({
      eqObjId: $scope.eqObjId,
      ifObjId: $scope.iface.ifObjId,
      name: $scope.iface.name,
      mac: $scope.iface.mac,
      every: $scope.iface.every,
      isTrunk: $scope.iface.isTrunk
    }).then(function() {
      $modalInstance.close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.calcMac = {
    fromLinux: function(mac) {
      $scope.data.wMac = mac.split(':').join('-');

      var tmp = mac.split(':'),
        cmac = '',
        delim = 0;
      for (var i = 0; i < tmp.length; i++) {
        cmac += tmp[i];
        delim++;
        if (delim === 2 && i !== tmp.length - 1) {
          delim = 0;
          cmac += '.';
        }
      }
      $scope.data.cMac = cmac;
      $scope.iface.mac = $scope.data.lMac;
    },
    fromWindows: function(mac) {
      $scope.data.lMac = mac.split('-').join(':');

      var tmp = mac.split('-'),
        cmac = '',
        delim = 0;
      for (var i = 0; i < tmp.length; i++) {
        cmac += tmp[i];
        delim++;
        if (delim === 2 && i !== tmp.length - 1) {
          delim = 0;
          cmac += '.';
        }
      }
      $scope.data.cMac = cmac;
      $scope.iface.mac = $scope.data.lMac;
    },
    fromCisco: function(mac) {
      var tmp = mac.split('.').join('');
      var cmac = [],
        curPos = 0;
      while (curPos < tmp.length) {
        cmac.push(tmp.slice(curPos, curPos + 2));
        curPos += 2;
      }
      $scope.data.lMac = cmac.join(':');
      $scope.data.wMac = cmac.join('-');
      $scope.iface.mac = $scope.data.lMac;
    }
  };

  $scope.data = {};
  if ($scope.iface.mac) {
    $scope.data.lMac = $scope.iface.mac;
  } else {
    $scope.data.lMac = '00:00:00:00:00:00';
  }

  $scope.calcMac.fromLinux($scope.data.lMac);
  
  $scope.closeAlert = function() {
    delete $scope.error;
  };
  $scope.cancel = function() {
    $modalInstance.dismiss();
  };

  $modalInstance.result.then(function() {}, function() {
    $scope.iface.mac = $scope.unchanged;
  });

});


angular.module('ipdb').controller('ModalEqIfDhcpEditCtrl', function($scope, $modalInstance, eqTab) {
  $scope.confirm = function() {
    eqTab.dhcpProfileEdit({
      ifObjId: $scope.iface.ifObjId,
      ip: $scope.ip,
      isDyn: $scope.iface.addrData.isDyn[$scope.index]
    }).then(function() {
      $modalInstance.close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $modalInstance.dismiss();
  };

  $modalInstance.result.then(function() {}, function() {
    $scope.iface.addrData.isDyn[$scope.index] = !$scope.iface.addrData.isDyn[$scope.index];
  });
});


angular.module('ipdb').controller('ModalEqIfNewCtrl', function($scope, common) {
  $scope.data = {};
  //args.eqObjId, args.name, args.mac, args.every, null, args.isTrunk]},
  $scope.confirm = function() {
    if (!$scope.data.mac) {
      $scope.error = 'Незаполнено значение для MAC-адреса';
      return;
    } 

    common.edit.get({
      fname: 'if_add',
      args: {
        eqObjId: $scope.eqObjId,
        ifname: $scope.data.ifname,
        mac: $scope.data.mac,
        every: $scope.data.every,
        isTrunk: $scope.data.isTrunk
      }
    }).then(function() {
      $scope.$close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $scope.$dismiss();
  };
});


angular.module('ipdb').controller('ModalEqIpNewCtrl', function($scope, common, eqTab) {
  // init
  $scope.data = {
    isDyn: true
  };
  common.view.get('ip_free', {eqObjId: $scope.eqObjId}).then(function(data) {
    $scope.data.ipFreeAddrs = data;
    $scope.data.ip = data[0].ip;
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


angular.module('ipdb').controller('ModalEqIpEditCtrl', function($scope, common, eqTab, rightTabs, $modalInstance) {
  // init
  $scope.data = {
    unchanged: $scope.iface.addrData.ip[$scope.index],
    isDyn: $scope.iface.addrData.isDyn[$scope.index],
    ip: $scope.iface.addrData.ip[$scope.index]
  };
  
  common.view.post({
    eqObjId: $scope.eqObjId,
    ip_free: {},
    dns_by_ip: {
      ip: $scope.data.unchanged
    }
  }).then(function(data) {
    $scope.ipFreeAddrs = data.ip_free;
    $scope.dnsNames = data.dns_by_ip;
    //console.log($scope.iface.addrData.ip[$scope.index])
  });

  $scope.delete = function(ip) {
    var ip = ip || $scope.data.ip;
    common.edit.get({
      fname: 'ip_del',
      args: {
        ifObjId: $scope.iface.ifObjId,
        ip: ip
      }
    }).then(function() {
      $scope.$close();
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.goToNet = function() {
    rightTabs.addTab({
      type: 'ip',
      ip: $scope.data.net.net_addr,
      ipObjId: $scope.data.net.ipObjId,
      comments: $scope.data.net.comments,
    });
  };

  $scope.confirm = function() {
    common.edit.get({
      fname: 'ip_add',
      args: {
        ifObjId: $scope.iface.ifObjId,
        ip: $scope.data.ip,
        isDyn: $scope.data.isDyn
      }
    }).then(function() {
      $scope.delete($scope.data.unchanged);
    }, function(err) {
      $scope.error = err;
    });
  };

  $scope.onIpChange = function onIpChange(newip) {
    $scope.iface.addrData.ip[$scope.index] = newip;
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
  $scope.onIpChange($scope.iface.addrData.ip[$scope.index]);  // for go to network button

  $scope.closeAlert = function() {
    delete $scope.error;
  };

  $scope.cancel = function() {
    $scope.$dismiss();
  };

  $modalInstance.result.then(function() {}, function() {
    $scope.iface.addrData.ip[$scope.index] = $scope.data.unchanged;
  });
});


angular.module('ipdb').controller('FormEqPropCtrl', function($scope, common, eqTab) {
  $scope.form = {}; // FIXME: приходится инициализировать здесь, а не в директиве из-за angular forms 
  
  $scope.$watch('data', function() {
    // trigger directive reload
    $scope.init = [
      {
        view: 'status',
        model: $scope.data.eq_info.status,
        onConfirm: readEqProp
      },
      {
        view: 'statusNames',
        model: [{name: $scope.data.eq_info.status}],
      },
      {
        view: 'serial',
        model: $scope.data.eq_info.serial_number,
        onConfirm: readEqProp
      },
      {
        view: 'fio',
        model: $scope.data.eq_info.fio,
        onConfirm: readUser
      },
      {
        view: 'comments',
        model: $scope.data.eq_info.comments,
        onConfirm: readUser
      }
    ];
  });

  function readEqProp() {
    // load actual data
    return {
      'eq_prop_edit': {
        eqObjId: $scope.eqObjId,
        eqLabel: $scope.eqLabel,
        status: $scope.form.status || null,
        serial: $scope.form.serial || ''
      }
    };
  }

  function readUser() {
    // load actual data
    return {
      'eq_prop_user': {
        eqObjId: $scope.eqObjId,
        fio: $scope.form.fio || null,
        comments: $scope.form.comments || null
      }
    };
  }

  $scope.getFioTypeahead = function(text) {
    return eqTab.getFioTypeahead(text);
  };

  $scope.edit = function() {
    common.view.get({
      fname: 'status_names'
    }).then(function(data) {
      $scope.form.editMode = true;
      $scope.form.statusNames = data;
    });
  };
});
