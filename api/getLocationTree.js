exports.ajax = function(req, res, next) {
  var ROOT_LEVEL = 1;
  
  if (!req.query.hasOwnProperty('obj_id')) {
    req.query['obj_id'] = ROOT_LEVEL; // root level of tree
  }
  var client = res.locals.pgClient;
  client.query('SELECT * from tree_v WHERE parent_obj_id = $1 ORDER BY obj_weight DESC, obj_name ASC', [req.query['obj_id']], function(err, result) {
    if (err) throw err;
    //console.log(result.rows);
    return res.jsonp(result.rows);
  });
};

exports.full = function(req, res, next) {
  client.connect(function(err) {
    if(err) {
      return console.error('could not connect to postgres', err);
    }
    client.query('SELECT * from tree_v ORDER BY obj_id asc', [], function(err, result) {
      if (err) return callback(err);

      function processTable(data, idField, foreignKey, rootLevel) {
        var hash = {};

        for (var i = 0; i < data.length; i++) {
          var item = data[i];
          var id = item[idField];
          var parentId = item[foreignKey];

          hash[id] = hash[id] || [];
          hash[parentId] = hash[parentId] || [];

          item.items = hash[id];
//          if (item.items) {
//            item.spriteCssClass = 'rootfolder';
//          }
          item.text = item['obj_name'];
          hash[parentId].push(item);
        }

        return hash[rootLevel];
      }

      var data = processTable(result.rows, "obj_id", "parent_obj_id", 1);
      // console.log(data);
      res.jsonp(data);
    });
  });
};
