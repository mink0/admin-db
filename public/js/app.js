'use strict';

// Declare app level module which depends on filters, and services

angular.module('ipdb', [
  'ngRoute',
  'ngSanitize',
  // 'ngAnimate',
  'kendo.directives',
  'ui.bootstrap',
  'ngGrid',
  'angular-loading-bar',
  'btford.socket-io',
  'ng-context-menu'
]);


//FIXME: убирает автовыбор первого элемента в typeahed!
angular.module('ipdb').config(['$provide', function ($provide) {
  /**
   * decorates typeahead directive so that it won't autoselect the first element.
   * This is a temporary fix until ui-bootstrap provides this functionality built-in.
   */
  $provide.decorator("typeaheadDirective", ["$delegate","$timeout",function($delegate,$timeout){

    var prevCompile = $delegate[$delegate.length -1].compile;
    $delegate[$delegate.length -1].compile = function(){
      var link = prevCompile.apply($delegate,Array.prototype.slice.call(arguments,0));

      return function(originalScope,elem,attr) {
        var result = link.apply(link,Array.prototype.slice.call(arguments,0));
        //the link creates a new child scope, we need to have access to that one.
        var scope = originalScope.$$childTail;
        var prevSelect = scope.select;

        scope.select = function(activeIdx){
          if (activeIdx < 0) {
            scope.matches = [];
            elem.attr('aria-expanded', false);
            $timeout(function() { elem[0].focus(); }, 0, false);
          } else {
            prevSelect.apply(scope, Array.prototype.slice.call(arguments, 0));
          }
        };
        //we don't have access to a function that happens after getMatchesAsync
        //so we need to listen on a consequence of that function
        scope.$watchCollection("matches",function(){
          scope.activeIdx = -1;
        });
        return result;
      };
    };
    return $delegate;
  }]);
}]);


angular.module('ipdb').config(function($routeProvider, $locationProvider) {
 $routeProvider.
   when('/equip/:eqLabel', {
     templateUrl: 'partials/equipTab/equipTab.html',
     controller: 'EquipCtrl'
   }).
   otherwise({
     //redirectTo: '../partials/404.html'
     redirectTo: '/404'
   });

  // removes hash (#) from urls
  // check browser support for the html5 history API:
  if(window.history && window.history.pushState){
    $locationProvider.html5Mode(true);
  }
});

// хак для замены $broadcast. сообщения между контроллерами бегают в $rootScope. работает быстрее.
// manual annotation for minification
angular.module('ipdb')
  .config(['$provide', function($provide){
    $provide.decorator('$rootScope', ['$delegate', function($delegate){

      Object.defineProperty($delegate.constructor.prototype, '$onRootScope', {
        value: function(name, listener){
          var unsubscribe = $delegate.$on(name, listener);
          this.$on('$destroy', unsubscribe);
        },
        enumerable: false
      });

      return $delegate;
    }]);
  }]);

// Global $http error handler
// manual annotation for minification
angular.module('ipdb').config(['$httpProvider', function($httpProvider) {
  // register the interceptor via an anonymous factory
  $httpProvider.interceptors.push(['$q', 'n', '$log',
    function($q, n, $log) {
      return {
        'response': function(response) {
          if (response.data.error) {
            n.error(response.data.error);
            return $q.reject(response);
          } else {
            return response || $q.when(response);
          }
        },
        'responseError': function(response) {
          // все ошибки со статусом отличным от 200
          var text;
          try {
            text = response.status + (response.data.error ?
              ': ' + JSON.stringify(response.data.error) : '');
          } catch (e) {
            text = 'Код ошибки: ' + response.status;
          } finally {
            $log.error(response);
            n.error(text);
          }
          return $q.reject(response);
        }
      };
    }
  ]);
}]);

angular.module('ipdb').config(function(cfpLoadingBarProvider) {
  cfpLoadingBarProvider.includeSpinner = false;
});
