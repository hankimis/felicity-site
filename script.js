function openConsultModal() {
  document.getElementById('consult-modal').style.display = 'block';
}
function closeConsultModal() {
  document.getElementById('consult-modal').style.display = 'none';
}
// ESC 키로 모달 닫기
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeConsultModal();
});
// 모달 바깥 클릭 시 닫기
window.addEventListener('click', function(e) {
  const modal = document.getElementById('consult-modal');
  if (e.target === modal) closeConsultModal();
}); 