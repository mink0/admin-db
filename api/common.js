/**
 * Common utils for node.js
 */


/**
 * Выводим ошибки пользователю
 */
var ErrorHandler = function(req, res, next, runOnEnd) {
  this.req = req;
  this.res = res;
  this.next = next;
  this.runOnEnd = runOnEnd;
  this.defaultMsg = 'PostgreSQL: ошибка выполнения операции';
};
ErrorHandler.prototype.error = function(err) {
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
};
exports.ErrorHandler = ErrorHandler;

