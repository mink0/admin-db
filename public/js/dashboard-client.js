// client for dashboard sending user statistics
var socket = io.connect('/dashboard');

socket.on('connect', function() {
  socket.emit('join', 'user');
  socket.emit('user', window.location.href); // hack to avoid JSON.stringify
});

// socket.onmessage = function (jsonData) {
//   if (jsonData.data === '{"channel":"poller","msg":"ping"}') {     //avoiding JSON.parse
//     socket.send('{"channel":"poller","msg":"pong"}');
//   }
// };
// window.onhashchange = function () {
//   socket.send('{"channel": "client", "msg": "' + window.location.href + '"}');
// };