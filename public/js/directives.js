'use strict';

/* Directives */

angular.module('ipdb').directive('ipdbForm', function(common) {
  // инициализация переменных, рисование кнопочек
  // дефолтные функции edit, cancel
  // + дефолтный API для save

  return {
    restrict: 'E',
    transclude: true,
    scope: true,  // making child scope
    templateUrl: 'partials/forms/formGeneral',
    link: function(scope, elem, attrs) {
      scope.$watch('init', function() {
        // changing $scope.init will trigger directive reload
        // init data
        if (!scope.prefix){
          scope.prefix = 'form';
        }
        
        scope.backup = {};
        for (var i=0; i<scope.init.length; i++) {
          scope.backup[scope.init[i].view] = scope.init[i].model;
          scope.$parent[scope.prefix][scope.init[i].view] = scope.init[i].model;
        }

        if (!scope.edit) {
          scope.edit = function() {
            scope.$parent[scope.prefix].editMode = true;
          };
        }

        if (!scope.cancel) {
          scope.cancel = function() {
            for (var i=0; i<scope.init.length; i++) {
              scope.$parent[scope.prefix][scope.init[i].view] = scope.backup[scope.init[i].view];
            }
            scope.$parent[scope.prefix].editMode = false;
          };
        }

        if (!scope.confirm) {
          scope.confirm = function() {
            var query = {};
            for (var i=0; i<scope.init.length; i++) {
              var formField = scope[scope.prefix].parent[scope.init[i].view];
              if (!formField) continue;
              if (formField.$dirty) {
                if (scope.init[i].hasOwnProperty('onConfirm')) {
                  // onConfirm может быть функцией (для удобства вызова дополнительных сервисов), но все равно должна возвращать объект с параметрами RPC
                  if (typeof scope.init[i].onConfirm === 'function') {
                    angular.extend(query, scope.init[i].onConfirm());
                  } else if (typeof scope.init[i].onConfirm === 'object') {
                    angular.extend(query, scope.init[i].onConfirm);
                  }
                }
              }
            }
            //console.log(query);
            if (scope[scope.prefix].parent.$pristine) {
              scope.$parent[scope.prefix].editMode = false;
            } else {
              // console.log(scope[scope.prefix].parent)
              scope.$parent[scope.prefix].saveMode = true;
              //angular.setTimeout(function() {}, 1000);
              common.edit.post(query).then(function() {
                scope.$parent[scope.prefix].editMode = false;
                scope.$parent[scope.prefix].saveMode = false;
                scope.$parent[scope.prefix].error = null;
                scope[scope.prefix].parent.$setPristine();
              }, function(err) {
                scope.$parent[scope.prefix].saveMode = false;
                var arr = [];
                for (var key in err) {
                  if (!err.hasOwnProperty(key)) continue;
                  arr.push({name: key, err: err[key]});
                }
                scope.$parent[scope.prefix].error = arr;
              });
            }
          };
        }
      });
    }
  };


});


angular.module('ipdb').directive('ngRightClick', function($parse) {
  return function(scope, element, attrs) {
    var fn = $parse(attrs.ngRightClick);
    element.bind('contextmenu', function(event) {
      scope.$apply(function() {
        event.preventDefault();
        fn(scope, {
          $event: event
        });
      });
    });
  };
});

/*
angular.module('ipdb').directive('myEnter', function() {
  return function(scope, element, attrs) {
    element.bind("keydown keypress", function(event) {
      if(event.which === 13) {
        scope.$apply(function(){
          scope.$eval(attrs.ngEnter);
        });

        event.preventDefault();
      }
    });
  };
});*/