export function showError(msg) {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }
  console.error(msg);
}
