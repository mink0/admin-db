/**
 * Common utils for node.js
 */

var ErrorHandler = function(req, res, next, runOnEnd) {
/* local error Handler for Express. runOnEnd - function that will run on error */
  this.req = req;
  this.res = res;
  this.next = next;
  this.runOnEnd = runOnEnd;
};
ErrorHandler.prototype = {
  defaultMsg: 'PostgreSQL: ошибка выполнения операции',
  error: function(err) {
    if (typeof(err) === 'string') {
      var err = new Error(err);
      err.msg = err.message;
    } else {
      err.msg = err.msg || this.defaultMsg;
    }
    console.error(__filename.split('/').slice(-1)[0] + '> ' + err);
    if (this.runOnEnd) {
      this.runOnEnd();
    }
    return this.res.send({error: err.msg });
  }
};
exports.ErrorHandler = ErrorHandler;

