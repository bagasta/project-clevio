// Dashboard script for Clevio Pro
// Handles session management, real-time updates via SSE, and modal interactions

document.addEventListener('DOMContentLoaded', () => {
  const sessionsTable = document.getElementById('sessionsTable').getElementsByTagName('tbody')[0];
  const newSessionBtn = document.getElementById('newSessionBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const createSessionModal = new coreui.Modal(document.getElementById('createSessionModal'));
  const editWebhookModal = new coreui.Modal(document.getElementById('editWebhookModal'));
  const qrModal = new coreui.Modal(document.getElementById('qrModal'));
  const createSessionForm = document.getElementById('createSessionForm');
  const editWebhookForm = document.getElementById('editWebhookForm');

  let eventSource;

  // Initialize SSE connection for real-time updates
  function initSSE() {
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      const sessions = JSON.parse(event.data);
      renderSessions(sessions);
    };
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          initSSE();
        }
      }, 5000);
    };
  }

  // Render sessions table
  function renderSessions(sessions) {
    sessionsTable.innerHTML = '';
    sessions.forEach(session => {
      const row = sessionsTable.insertRow();
      
      // Name
      row.insertCell(0).textContent = session.name;
      
      // Status with badge
      const statusCell = row.insertCell(1);
      const statusBadge = document.createElement('span');
      statusBadge.className = `badge ${getStatusBadgeClass(session.status)}`;
      statusBadge.textContent = session.status;
      statusCell.appendChild(statusBadge);
      
      // Webhook
      const webhookCell = row.insertCell(2);
      webhookCell.textContent = session.webhook || 'Not set';
      
      // Created At
      const createdAtCell = row.insertCell(3);
      createdAtCell.textContent = new Date(session.createdAt).toLocaleString();
      
      // Actions
      const actionsCell = row.insertCell(4);
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'd-flex gap-2';
      
      // QR Code button (only show if status is 'qr')
      if (session.status === 'qr' && session.qr) {
        const qrBtn = document.createElement('button');
        qrBtn.className = 'btn btn-info btn-sm';
        qrBtn.innerHTML = '<i class="fa-solid fa-qrcode"></i>';
        qrBtn.title = 'Show QR Code';
        qrBtn.onclick = () => showQRCode(session.qr);
        actionsDiv.appendChild(qrBtn);
      }
      
      // Edit webhook button
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-warning btn-sm';
      editBtn.innerHTML = '<i class="fa-solid fa-edit"></i>';
      editBtn.title = 'Edit Webhook';
      editBtn.onclick = () => editWebhook(session.name, session.webhook);
      actionsDiv.appendChild(editBtn);
      
      // Rescan button
      const rescanBtn = document.createElement('button');
      rescanBtn.className = 'btn btn-secondary btn-sm';
      rescanBtn.innerHTML = '<i class="fa-solid fa-refresh"></i>';
      rescanBtn.title = 'Rescan QR';
      rescanBtn.onclick = () => rescanSession(session.name);
      actionsDiv.appendChild(rescanBtn);
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteBtn.title = 'Delete Session';
      deleteBtn.onclick = () => deleteSession(session.name);
      actionsDiv.appendChild(deleteBtn);
      
      actionsCell.appendChild(actionsDiv);
    });
  }

  // Get status badge class
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'ready': return 'bg-success';
      case 'authenticated': return 'bg-info';
      case 'qr': return 'bg-warning text-dark';
      case 'failed': return 'bg-danger';
      case 'disconnected': return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }

  // Show QR Code modal
  function showQRCode(qrString) {
    const canvas = document.getElementById('qrCanvas');
    QRCode.toCanvas(canvas, qrString, { width: 256 }, (err) => {
      if (err) {
        console.error('Error generating QR code:', err);
        return;
      }
      qrModal.show();
    });
  }

  // Create new session
  newSessionBtn.addEventListener('click', () => {
    createSessionModal.show();
  });

  createSessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sessionName').value.trim();
    const webhook = document.getElementById('sessionWebhook').value.trim();
    const errorEl = document.getElementById('createError');
    
    errorEl.style.display = 'none';
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, webhook })
      });
      
      if (response.ok) {
        createSessionModal.hide();
        createSessionForm.reset();
      } else {
        const data = await response.json();
        errorEl.textContent = data.error || 'Failed to create session';
        errorEl.style.display = 'block';
      }
    } catch (error) {
      console.error('Error creating session:', error);
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  // Edit webhook
  function editWebhook(sessionName, currentWebhook) {
    document.getElementById('editSessionName').value = sessionName;
    document.getElementById('editSessionWebhook').value = currentWebhook || '';
    editWebhookModal.show();
  }

  editWebhookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('editSessionName').value;
    const webhook = document.getElementById('editSessionWebhook').value.trim();
    const errorEl = document.getElementById('editError');
    
    errorEl.style.display = 'none';
    
    try {
      const response = await fetch(`/api/sessions/${name}/webhook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook })
      });
      
      if (response.ok) {
        editWebhookModal.hide();
      } else {
        const data = await response.json();
        errorEl.textContent = data.error || 'Failed to update webhook';
        errorEl.style.display = 'block';
      }
    } catch (error) {
      console.error('Error updating webhook:', error);
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  // Rescan session
  async function rescanSession(sessionName) {
    if (!confirm(`Are you sure you want to rescan session "${sessionName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionName}/rescan`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(`Failed to rescan session: ${data.error}`);
      }
    } catch (error) {
      console.error('Error rescanning session:', error);
      alert('Network error');
    }
  }

  // Delete session
  async function deleteSession(sessionName) {
    if (!confirm(`Are you sure you want to delete session "${sessionName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionName}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const data = await response.json();
        alert(`Failed to delete session: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Network error');
    }
  }

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  });

  // Initialize
  initSSE();
});

