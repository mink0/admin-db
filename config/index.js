module.exports = {
  development: {
    postgres: {
      host: 'psql.vkb.ru',
      database: 'ipdb_devel',
      user: 'ipdb_http',
      password: 'password',
    },
  },
  production: {
    postgres: {
      host: 'psql.vkb.ru',
      database: 'ipdb_prod',
      user: 'devel',
      password: 'test12345',
    }
  }
};
