'use strict';

/* Filters */

angular.module('ipdb').filter('interpolate', function (version) {
  return function (text) {
    return String(text).replace(/\%VERSION\%/mg, version);
  }
});

angular.module('ipdb').filter('highlight', function(){
  return function(input, search) {
    if (typeof input === 'string' && search) {
      return input.replace(new RegExp(search, 'gi'), '<strong>$&</strong>');
      //return input.replace(search, '<strong>$&</strong>', 'gi');
    } else {
      return input;
    }
  };
});
