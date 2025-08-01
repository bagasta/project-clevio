// public/js/dashboard-api.js
document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('statusBadge');
  const refreshBtn  = document.getElementById('refreshStatus');
  const qrContainer = document.getElementById('qrContainer');
  const sendForm    = document.getElementById('sendForm');
  const sendResult  = document.getElementById('sendResult');

  // Fetch & render client status + QR
  async function loadStatus() {
    statusBadge.textContent = 'Loading…';
    qrContainer.innerHTML = '';
    try {
      const res = await fetch('http://localhost:3000/status');
      const { ready, qr } = await res.json();
      if (ready) {
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'badge bg-success';
      } else {
        statusBadge.textContent = qr ? 'Waiting QR scan' : 'Initializing';
        statusBadge.className = 'badge bg-warning text-dark';
        if (qr) await renderQR(qr);
      }
    } catch (e) {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'badge bg-danger';
      console.error(e);
    }
  }

  // Render QR code via qrcode lib
  async function renderQR(qrString) {
    qrContainer.innerHTML = '<canvas id="qrCanvas"></canvas>';
    const canvas = document.getElementById('qrCanvas');
    QRCode.toCanvas(canvas, qrString, { width: 200 }, (err) => {
      if (err) console.error(err);
    });
  }

  // Send message handler
  sendForm.addEventListener('submit', async e => {
    e.preventDefault();
    sendResult.textContent = 'Sending…';
    const payload = {
      chatId: document.getElementById('chatId').value.trim(),
      content: document.getElementById('content').value.trim()
    };
    try {
      const res = await fetch('http://localhost:3000/messages/send', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        sendResult.innerHTML = `<span class="text-success">Sent! ID: ${data.messageId}</span>`;
      } else {
        sendResult.innerHTML = `<span class="text-danger">Error: ${data.error}</span>`;
      }
    } catch (err) {
      sendResult.innerHTML = `<span class="text-danger">Network error</span>`;
      console.error(err);
    }
  });

  // Bind refresh
  refreshBtn.addEventListener('click', loadStatus);

  // Initial load
  loadStatus();
});
