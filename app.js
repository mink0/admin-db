/**
 * Module dependencies
 */

var express = require('express'),
  api = require('./api'),
  http = require('http'),
  pg = require('pg'),
  path = require('path'),
  passport = require('passport'),
  SpnegoStrategy = require('passport-spnego').Strategy,
  websock = require('./api/websock'),
  dashboard = require('./lib/dashboard'),
  intel = require('./config/intel'),
  config = require('./config');

/**
 * Configuration
 */

var log = intel.getLogger('root');
log.info('> starting logger..');

var app = express();

pg.defaults.host = config[app.get('env')].postgres.host;
pg.defaults.database = config[app.get('env')].postgres.database;
pg.defaults.user = config[app.get('env')].postgres.user;
pg.defaults.password = config[app.get('env')].postgres.password;

// all environments
app.set('port', process.env.PORT || 3000);
app.set('ip', process.env.IP || null);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.favicon(path.join(__dirname, '/public/img/favicon.ico'))); // app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.cookieParser());
app.use(express.session({
  secret: 'd(")b zzZZZzz.....:)'
}));
app.use(passport.initialize());
app.use(passport.session());

// custom middleware
// все функции, объявленные здесь, становятся доступными в каждом view
app.use(function(req, res, next) {
  res.locals.ldapClient = ldapClient;
  return next();
});

// router
app.use(app.router);

// обработка ошибок. размещать после app.use(app.router)
app.use(function(req, res, next) {
  // обработчик 404 ошибки, 3 параметра на вход: (req, res, next)
  return res.status(404).render('404', {
    url: req.url
  });
});

if (app.get('env') === 'development') {
  app.use(express.errorHandler());
}

if (app.get('env') === 'production') {
  // обработчики ошибок express принимают 4 аргумента!
  app.locals.errorHandler = function(err, req, res, next) {
    if (err) {
      var status = 500,
        msg = 'Внутренняя Ошибка Сервера';

      if (typeof err === 'object') {
        // custom errors:
        if (err.message.slice(0, 3) === 'gss') {
          status = 401;
          msg = 'SPNEGO: ошибка аутентификации';
          return res.render('kerberos', {
            info: msg
          });
        }
        if (err.status) status = err.status;
        if (err.msg) msg = err.msg;

        // print error
        if (err.msg) log.error(err.msg);
        log.error(err);
      }

      var accept = req.headers.accept || ''; // copy from express.errorHandler()
      if (accept.indexOf('html') > -1) {
        return res.render('error', {
          erStatus: status,
          erMsg: msg
        });
      } else {
        res.json({
          error: status + ': ' + msg
        });
      }
    } else {
      return res.send(500);
    }
  };

  app.use(app.locals.errorHandler); // error-handling middleware are typically defined very last
}


/**
 * Routes
 */

app.get('/login',
  function(req, res, next) {
    // запускаем custom callback проверку, чтобы отловить ситуацию, когда пользователь не смог аутентифицироваться по Spnego
    passport.authenticate('spnego')(req, res, next);

    if (res.statusCode === 401) {
      return res.render('kerberos', {
        info: 'Необходимо войти в домен Windows и настроить поддержку автоматической аутентификации для Вашего браузера'
      });
    }
  },
  function(req, res, next) {
    // успешная аутентификация
    res.setHeader('WWW-Authenticate', req.negotiate_token);
    log.info('> SPNEGO: ' + req.user.username + ' authenticated');
    if (req.session.returnTo) {
      var returnTo = req.session.returnTo;
      delete req.session.returnTo;
      return res.redirect(returnTo);
    }
    return res.render('info', {
      header: 'KERBEROS',
      subHeader: 5,
      info: 'Пользователь ' + req.user.username + ' аутентифицирован'
    });
  }
);

/**
 * serve partials
 */

app.get('/partials/:viewname', ensureAuthenticated, function(req, res) {
  res.render('partials/' + req.params.viewname);
});

app.get('/partials/:dirname/:viewname', ensureAuthenticated, function(req, res) {
  res.render('partials/' + req.params.dirname + '/' + req.params.viewname);
});

/**
 * serve static files via express
 * TODO: поднять отдельный сервер для статики
 */

app.get('/assets/:filename', function(req, res) {
  res.sendfile(path.resolve(__dirname, 'public', 'assets', req.params.filename));
});

/**
 * API
 */

app.post('/api/get', ensureAuthenticated, dbAuthorize, api.ipdbView);
//app.get('/api/get/type_ahead', api.typeahead); // skip auth for speed up!
app.get('/api/get/:fname', ensureAuthenticated, dbAuthorize, api.ipdbView);

app.post('/api/post', ensureAuthenticated, dbAuthorize, api.ipdbChange);
app.get('/api/post/:fname', ensureAuthenticated, dbAuthorize, api.ipdbChange);

app.get('/admin', express.basicAuth(function(user, pass) {
  return user === 'admin' || pass === 'admin';
}), function(req, res) {
  res.render('dashboard');
});

// весь дальнейший роутинг осуществляется в Angular
app.get('*', ensureAuthenticated, function(req, res) {
  res.render('index', {
    username: req.user.username
  });
});

/**
 * Start Express server
 */

var server = http.createServer(app).listen(app.get('port'), app.get('ip'), function() {
  log.info('> express server listening on %s:%s', app.get('ip') || '*', app.get('port'));
});

/**
 * Socket.io
 */

log.info('> starting socket.io server...');
// main window. clients.
var io = require('socket.io').listen(server);
// dasboard only
var io2 = io.of('/dashboard');
io.set('log level', 2);
websock(io);
dashboard(io2);

/**
 * Ldap clinet init
 */

log.info('> ldap: connecting to ldap://ldap.vkb.ru...');
var ldap = require('ldapjs');
var ldapClient = ldap.createClient({
  url: 'ldap://ldap.vkb.ru',
  maxConnections: 5,
});

ldapClient.bind('vkb\\ldapsearch', '567890', function(err) {
  if (err) log.error(err);
});

/**
 * Authorization
 */

var PassportUsers = function() {
  this.userlist = [];
  this.index = 1; // should start with 1 for passport
};
PassportUsers.prototype = {
  new: function(username) {
    if (typeof username !== 'string' || username.indexOf('@') === -1) {
      log.log('Error: incorrect Passport username:', username);
      return null;
    }
    var user = {
      id: this.index,
      name: username.split('@')[0],
      username: username
    };
    this.index++;
    this.userlist.push(user);
    return user;
  },
  get: function(id) {
    for (var i in this.userlist)
      if (this.userlist[i].id == id) return this.userlist[i];
    return null;
  },
  findOne: function(username) {
    for (var i in this.userlist)
      if (this.userlist[i].username == username) return this.userlist[i];
    return null;
  },
  findOrCreate: function(username) {
    var user = this.findOne(username) || this.new(username);
    return user;
  }
};
var passportUsers = new PassportUsers();

// сериалайзеры нужны для поддержки сессий
passport.serializeUser(function(user, done) {
  //log.log("passport.serializeUser user=", user);
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  //log.log("passport.deserializeUser id=", id);
  done(null, passportUsers.get(id));
});

// Use the SPNEGO within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.
if (process.env.NOAUTH === undefined) {
  passport.use(new SpnegoStrategy({
      keytab: path.join(__dirname, './lib/krb5/krb5-http.keytab'),
      service: 'HTTP/ipdb.vkb.ru'
    },
    function(username, password, done) {
      // аутентификация по spnego. авторизация в postgres.
      if (!username || !username.split('@')[0]) {
        return done(null, false, {
          message: 'Неизвестный пользователь: ' + username
        });
      }
      return done(null, passportUsers.findOrCreate(username));
    }
  ));
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else if (app.get('env') === 'development') {
    // для отладки программы без натройки авторизации
    var user_tst = 'test@VKB.RU';
    var user = passportUsers.findOrCreate(user_tst);
    req.logIn(user, function(err) {
      if (err) return next(err);
      log.log('> test user ' + user_tst + ' started session without authentication!');
      return next();
    });
  } else {
    req.session.returnTo = req.url; // запоминаем url и отправляем на авторизацию
    return res.redirect('/login');
  }
}

function dbAuthorize(req, res, next) {
  // авторизация пользователя в базе. создаем client и передеаем его через res.locals.

  var rUserName = req.user.name;
  if (!rUserName) {
    var err = new Error('ошибка авторизации: неизвестное имя пользователя');
    next(err);
  }

  // Здесь определяется интерфейс node postgreSQL. Мы не используем connection pool из-за способа авторизации в postgres.
  // NB: чтобы не плодить мертвые сессии, вешаем client.end на 'drain' событие.
  // UPD 11.2013: похоже, что все пофиксили и drain уже не нужен
  var client = new pg.Client();
  // app.locals.pgOnDrain.count++;
  // auto disconnect client after last query ends
  // client.on('drain', client.end.bind(client));
  // client.on('drain', res.locals.pgOnDrain);

  client.connect(function(err) {
    if (err) {
      err.status = 503;
      err.msg = 'ошибка подключения к базе данных';
      return next(err);
    }
  });

  // FIXME: ....
  client.query('SET SESSION AUTHORIZATION ' + rUserName + '; SET ROLE ' + rUserName + '; SELECT current_user, session_user', function(err, result) {
    if (err) {
      client.end();
      err.status = 401;
      err.msg = 'ошибка авторизации пользователя ' + rUserName + ' в базе данных';
      return next(err);
    }

    if (result.rows[0].current_user != result.rows[0].session_user ||
      result.rows[0].session_user != rUserName) {
      client.end();
      err = new Error();
      err.status = 401;
      err.msg = 'ошибка проверки авторизации пользователя ' + rUserName + ' в базе данных';
      return next(err);
    }
    // сохраняем авторизованную сессию и передаем управление
    res.locals.pgClient = client;
    return next();
  });
}
