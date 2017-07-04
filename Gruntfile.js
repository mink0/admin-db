'use strict';
/*
 *  Based on yeomans angular-fullstack
 *  FIXME: usemin пока не умеет работать с jade, поэтому сейчас:
 *     скрипты и css вставляются только через html теги
 *     не работает вставка сжатых картинок, можно делать вручную из директории images, все картинки остаются без сжатия
 *  FIXME: для kendo-ui не работает сжатие css
 *  FIXME: для kendo-ui не работает bower-install
 */
module.exports = function(grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    yeoman: {
      // configurable paths
      app: 'public',
      dist: 'dist'
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>*',
            'logs/**/*'
            // '<%= yeoman.dist %>/public/css/*',
            // '<%= yeoman.dist %>/public/img/*',
            // '<%= yeoman.dist %>/public/js/*',
            // '<%= yeoman.dist %>/public/views/*',
            // '<%= yeoman.dist %>/public/api/*',
            // '<%= yeoman.dist %>/app.js',
            // '<%= yeoman.dist %>/package.json'
          ]
        }]
      }
    },

    // Copies only NECESSARY files to places other tasks can use
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= yeoman.app %>',
          dest: '<%= yeoman.dist %>/public',
          src: [
            '*.{ico,png,txt}',
            '.htaccess',
            'bower_components/**/*',
            'assets/**/*',
            'img/{,*/}*.{webp}',
            'fonts/**/*',
            'img/**/*' //FIXME: usemin пока не умеет работать с jade файлами, убрать в будущем
          ]
        }, {
          expand: true,
          dot: true,
          cwd: 'views',
          dest: '<%= yeoman.dist %>/views',
          src: ['**/*.jade', '!tmp/**/*']
        }, {
          expand: true,
          dot: true,
          cwd: 'api',
          dest: '<%= yeoman.dist %>/api',
          src: ['**/*.js', '!tmp/**/*']
        }, {
          expand: true,
          dest: '<%= yeoman.dist %>',
          src: [
            'package.json',
            'app.js',
            'lib/**/*',
            'node_modules/**/*',
            'logs/',
            '.foreverignore',
            'Gruntfile.js'
          ]
        }]
      },
      styles: {
        expand: true,
        cwd: '<%= yeoman.app %>/css',
        dest: '.tmp/styles/',
        src: '{,*/}*.css'
      },
      //      'kendo-ui': {
      //        expand: true,
      //        cwd: '<%= yeoman.app %>/css',
      //        dest: '.tmp/styles/',
      //        src: '{,*/}*.css'
      //      }
    },

    // Add vendor prefixed styles
    autoprefixer: {
      options: {
        browsers: ['last 1 version']
      },
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/styles/',
          src: '{,*/}*.css',
          dest: '.tmp/styles/'
        }]
      }
    },

    // Automatically inject Bower components into the app
    bowerInstall: {
      app: {
        src: 'views/**/*.jade',
        exclude: ['angular-kendo-ui', 'kendo-ui'],
        ignorePath: '<%= yeoman.app %>/'
      }
      // css: {
      //   html: 'views/layout.jade',
      //   ignorePath: '<%= yeoman.app %>/'
      // }
    },

    // The following *-min tasks produce minified files in the dist folder
    imagemin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/img',
          src: '{,*/}*.{png,jpg,jpeg,gif}',
          dest: '<%= yeoman.dist %>/public/images'
        }]
      }
    },

    svgmin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/img',
          src: '{,*/}*.svg',
          dest: '<%= yeoman.dist %>/public/images'
        }]
      }
    },

    htmlmin: {
      dist: {
        options: {
          //collapseWhitespace: true,
          //collapseBooleanAttributes: true,
          //removeCommentsFromCDATA: true,
          //removeOptionalTags: true
        },
        files: [{
          expand: true,
          cwd: 'views',
          src: ['*.html', 'partials/**/*.html'],
          dest: '<%= yeoman.dist %>/views'
        }]
      }
    },


    // Allow the use of non-minsafe AngularJS files. Automatically makes it
    // minsafe compatible so Uglify does not destroy the ng references
    ngmin: {
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/concat/scripts',
          src: '*.js',
          dest: '.tmp/concat/scripts'
        }]
      }
    },

    // Renames files for browser caching purposes
    rev: {
      dist: {
        files: {
          src: [
            '<%= yeoman.dist %>/public/scripts/{,*/}*.js',
            '<%= yeoman.dist %>/public/styles/{,*/}*.css',
            '<%= yeoman.dist %>/public/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}',
            '<%= yeoman.dist %>/public/styles/fonts/*'
          ]
        }
      }
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically
    // concat, minify and revision files. Creates configurations in memory so
    // additional tasks can operate on them
    useminPrepare: {
      html: ['views/{,*/}*.jade'],
      options: {
        dest: '<%= yeoman.dist %>/public'
      }
    },

    // Performs rewrites based on rev and the useminPrepare configuration
    usemin: {
      html: ['<%= yeoman.dist %>/views/{,*/}*.html',
        '<%= yeoman.dist %>/views/{,*/}*.jade'
      ],
      css: ['<%= yeoman.dist %>/public/styles/{,*/}*.css'],
      options: {
        assetsDirs: ['<%= yeoman.dist %>/public']
      }
    },

    // Run some tasks in parallel to speed up the build process
    concurrent: {
      dist: [
        'copy:styles',
        'imagemin',
        'svgmin',
        'htmlmin'
      ]
    },
    shell: {
      options: {
        stdout: true,
        stderr: true
      },
      server: {
        command: 'NODE_ENV=production PORT=80 IP=172.20.8.6 forever start /srv/ipdb-web/dist/app.js'
      },
      test: {
        command: 'ls -l'
      },
      spnego: {
        command: 'npm install git+ssh://dns.vkb.ru/var/opt/git/passport-spnego.git'
      },
      nocap: {
        command: 'sudo setcap "cap_net_bind_service=+ep" `which node`'
      }
    }
  });

  grunt.registerTask('build', [
    'clean:dist',
    'useminPrepare',
    'concurrent:dist',
    'autoprefixer',
    'concat',
    'ngmin',
    'copy:dist',
    'cssmin',
    'uglify',
    'rev',
    'usemin'
  ]);

  grunt.registerTask('default', [
    //'bower-install',
    'build'
  ]);

  grunt.registerTask('bower-install', ['bowerInstall']);

  grunt.registerTask('server', ['shell:server']);

};
