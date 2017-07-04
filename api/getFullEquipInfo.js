var utils = require('./utils');
var async = require('async');
var lib = require('./ipdbView').lib;

module.exports = function(req, res, next) {
  var eqLabel = req.param('eqLabel').toUpperCase();
  var rUserName = 'test';
  var client = res.locals.pgClient;
  var errorClient = new utils.ErrorHandler(req, res, next, function() {
    //console.log(client);
    client.end();
  });


  loadEqInfo(function(err, results) {
    if (err) return errorClient.error(err);
    if (!results.eqObjId) {
      // новое устройство
      var jade_locals = {
        eqLabel: eqLabel,
        rUserName: rUserName,
        njsClientData: JSON.stringify({
          eqLabel: eqLabel
        })
      };
      //client.end();
      return errorClient.error(eqLabel + ' не существует в базе данных IPdb');
      //return res.render('equip_new', jade_locals);
    } else {
      // устройство уже создано, с интерфейсами или без них
      //console.log(result.rows);
      var ifaces = {}, rs = results.qgen;
      for (var i in rs) {
        if (!ifaces[rs[i].obj_id])
          ifaces[rs[i].obj_id] = {
            ifObjId: rs[i].obj_id,
            name: rs[i].if_name,
            mac: rs[i].mac,
            every: rs[i].dhcpoffer_everywhere,
            isTrunk: rs[i].is_trunk,
            addrData: {ip:[], isDyn:[], dhcpP:[]},  // will be filled below
            addrDataRows: 0
          };
        // fill addrData
        ifaces[rs[i].obj_id].addrData.ip.push(rs[i].ip_addr);
        ifaces[rs[i].obj_id].addrData.isDyn.push(rs[i].assigned_dhcp);
        ifaces[rs[i].obj_id].addrData.dhcpP.push(rs[i].profile_name);
        ifaces[rs[i].obj_id].addrDataRows++;
      }
      //console.log(ifaces);
      
      client.end();
      res.json({
        eqLabel: eqLabel,
        rUserName: rUserName,
        eqObjId: results.eqObjId,
        ifaces: ifaces,
        spec: {
          ilo: results.qilo
        }
      });
    }
  });
};