// Login page script for Clevio Pro dashboard.
// Handles submission of the login form and redirects on success.

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // Logged in successfully
        window.location.href = '/dashboard.html';
      } else if (res.status === 401) {
        const data = await res.json();
        errorEl.textContent = data.error || 'Invalid credentials';
        errorEl.style.display = 'block';
      } else {
        errorEl.textContent = 'An unexpected error occurred';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Failed to connect to server';
      errorEl.style.display = 'block';
    }
  });
});