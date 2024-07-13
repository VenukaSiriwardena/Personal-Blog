document.getElementById('signUpBtn').addEventListener('click', function() {
    var myModal = new bootstrap.Modal(document.getElementById('modalSignin'));
    myModal.show();
  });

  var modalSignin = document.getElementById('modalSignin');
  modalSignin.addEventListener('show.bs.modal', function () {
    document.getElementById('content').classList.add('blurred');
  });
  modalSignin.addEventListener('hide.bs.modal', function () {
    document.getElementById('content').classList.remove('blurred');
  });