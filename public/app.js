document.getElementById('year').textContent = new Date().getFullYear();
// Same-origin request: the server assigns an anonymous, short-lived session cookie.
if (!navigator.webdriver) fetch('/api/track', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
