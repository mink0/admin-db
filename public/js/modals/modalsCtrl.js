angular.module('ipdb').controller('ModalConfirmCtrl', function($scope, common) {
  $scope.dlg.title = $scope.dlg.title || 'Сохранить изменения?';
  $scope.dlg.no = $scope.dlg.no || 'Отмена';
  $scope.dlg.yes = $scope.dlg.yes || 'Сохранить';

  $scope.confirm = function() {
    if ($scope.dlg.hasOwnProperty('get')) {
      common.edit.get($scope.dlg.get).then(function(){
        $scope.$close();
      },function(err){
        $scope.error = err;
      });
    } else if ($scope.dlg.hasOwnProperty('post')) {
      // TODO:
      //
    } else {
      $scope.$close();
    }
  }; 
  $scope.closeAlert = function() {
    delete $scope.error;
  };
  
  $scope.cancel = function() {
    $scope.$dismiss();
  };

});