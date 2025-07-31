// Dashboard script for the updated Clevio Pro dashboard.
// This version renames sessions to agents and introduces a template
// selection step when creating a new agent.  Templates are defined in
// ``/templates.json`` and include a default webhook that is applied
// automatically when the user creates an agent.

document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const sessionsTableBody = document.querySelector('#sessionsTable tbody');
  const newAgentBtn      = document.getElementById('newAgentBtn');
  const logoutBtn        = document.getElementById('logoutBtn');
  const templateModal    = new coreui.Modal(document.getElementById('templateModal'));
  const createAgentModal = new coreui.Modal(document.getElementById('createAgentModal'));
  const editWebhookModal = new coreui.Modal(document.getElementById('editWebhookModal'));
  const qrModal          = new coreui.Modal(document.getElementById('qrModal'));
  const createAgentForm  = document.getElementById('createAgentForm');
  const editWebhookForm  = document.getElementById('editWebhookForm');
  const templateContainer = document.getElementById('templateContainer');
  const selectedWebhookInput = document.getElementById('selectedWebhook');

  // State
  let templates = [];
  let eventSource;

  /**
   * Load templates from templates.json.  This file contains an array of
   * objects with ``id``, ``name``, ``webhook`` and ``description`` fields.
   */
  async function loadTemplates() {
    try {
      const res = await fetch('/templates.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      templates = await res.json();
    } catch (e) {
      console.error('Failed to load templates', e);
      templates = [];
    }
  }

  /**
   * Populate the template modal with cards.  Each card represents a
   * template.  When clicked, the default webhook is stored and the
   * create‑agent modal is opened.
   */
  function populateTemplateCards() {
    templateContainer.innerHTML = '';
    templates.forEach(tpl => {
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <div class="card h-100 template-card" style="cursor: pointer;">
          <div class="card-body">
            <h5 class="card-title">${tpl.name}</h5>
            <p class="card-text">${tpl.description || ''}</p>
          </div>
        </div>`;
      // When a template is chosen, store its webhook and show the create modal
      col.querySelector('.template-card').addEventListener('click', () => {
        selectedWebhookInput.value = tpl.webhook;
        templateModal.hide();
        createAgentModal.show();
      });
      templateContainer.appendChild(col);
    });
  }

  /**
   * Initialise the SSE connection to receive real‑time updates about
   * agents (sessions) from the backend.  On message, update the table.
   */
  function initSSE() {
    // Close previous event source if any
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const sessions = JSON.parse(event.data);
        renderSessions(sessions);
      } catch (e) {
        console.error('Failed to parse SSE data', e);
      }
    };
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Try to reconnect after a delay when the connection is closed
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          initSSE();
        }
      }, 5000);
    };
  }

  /**
   * Compute the badge class for a given status.  This function mirrors
   * the logic of the original dashboard to keep consistent colours.
   *
   * @param {string} status
   * @returns {string}
   */
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'ready':        return 'bg-success';
      case 'authenticated':return 'bg-info';
      case 'qr':           return 'bg-warning text-dark';
      case 'failed':       return 'bg-danger';
      case 'disconnected': return 'bg-secondary';
      default:             return 'bg-light text-dark';
    }
  }

  /**
   * Render the list of sessions (agents) into the table.  Each row
   * displays the agent name, status, webhook, creation time and action
   * buttons.  Action handlers delegate to helper functions.
   *
   * @param {Array<Object>} sessions
   */
  function renderSessions(sessions) {
    sessionsTableBody.innerHTML = '';
    sessions.forEach(session => {
      const row = sessionsTableBody.insertRow();
      // Name
      row.insertCell(0).textContent = session.name;
      // Status badge
      const statusCell = row.insertCell(1);
      const badge = document.createElement('span');
      badge.className = `badge ${getStatusBadgeClass(session.status)}`;
      badge.textContent = session.status;
      statusCell.appendChild(badge);
      // Webhook
      const webhookCell = row.insertCell(2);
      webhookCell.textContent = session.webhook || 'Not set';
      // Created at
      const createdAtCell = row.insertCell(3);
      createdAtCell.textContent = new Date(session.createdAt).toLocaleString();
      // Actions
      const actionsCell = row.insertCell(4);
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'd-flex gap-2';
      // QR button
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
      editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
      editBtn.title = 'Edit Webhook';
      editBtn.onclick = () => editWebhook(session.name, session.webhook);
      actionsDiv.appendChild(editBtn);
      // Rescan button
      const rescanBtn = document.createElement('button');
      rescanBtn.className = 'btn btn-secondary btn-sm';
      rescanBtn.innerHTML = '<i class="fa-solid fa-sync"></i>';
      rescanBtn.title = 'Rescan QR';
      rescanBtn.onclick = () => rescanSession(session.name);
      actionsDiv.appendChild(rescanBtn);
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      deleteBtn.title = 'Delete Agent';
      deleteBtn.onclick = () => deleteSession(session.name);
      actionsDiv.appendChild(deleteBtn);
      actionsCell.appendChild(actionsDiv);
    });
  }

  /**
   * Display a QR code in the QR modal.  Accepts a QR string and uses
   * qrcodejs to draw it onto the canvas element.
   *
   * @param {string} qrString
   */
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

  /**
   * Trigger a rescan of the given agent name.  Uses the existing
   * back‑end endpoint and displays an alert on failure.
   *
   * @param {string} name
   */
  async function rescanSession(name) {
    if (!confirm(`Are you sure you want to rescan agent "${name}"?`)) return;
    try {
      const res = await fetch(`/api/sessions/${name}/rescan`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to rescan agent: ${data.error}`);
      }
    } catch (e) {
      console.error('Error rescanning agent', e);
      alert('Network error');
    }
  }

  /**
   * Delete the given agent via the back‑end.  Confirmation is asked
   * before sending the request.  Displays an alert on error.
   *
   * @param {string} name
   */
  async function deleteSession(name) {
    if (!confirm(`Are you sure you want to delete agent "${name}"?`)) return;
    try {
      const res = await fetch(`/api/sessions/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to delete agent: ${data.error}`);
      }
    } catch (e) {
      console.error('Error deleting agent', e);
      alert('Network error');
    }
  }

  /**
   * Open the edit webhook modal for a given agent.  The current
   * webhook is prefilled.  Error messages are hidden on open.
   *
   * @param {string} name
   * @param {string|null} currentWebhook
   */
  function editWebhook(name, currentWebhook) {
    document.getElementById('editSessionName').value    = name;
    document.getElementById('editSessionWebhook').value = currentWebhook || '';
    document.getElementById('editError').style.display  = 'none';
    editWebhookModal.show();
  }

  // Event bindings
  newAgentBtn.addEventListener('click', () => {
    templateModal.show();
  });

  createAgentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('agentName').value.trim();
    const webhook = selectedWebhookInput.value;
    const errorEl = document.getElementById('createError');
    errorEl.style.display = 'none';
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, webhook })
      });
      if (res.ok) {
        createAgentModal.hide();
        createAgentForm.reset();
      } else {
        const data = await res.json();
        errorEl.textContent = data.error || 'Failed to create agent';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error('Error creating agent', err);
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  editWebhookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = document.getElementById('editSessionName').value;
    const webhook = document.getElementById('editSessionWebhook').value.trim();
    const errorEl = document.getElementById('editError');
    errorEl.style.display = 'none';
    try {
      const res = await fetch(`/api/sessions/${name}/webhook`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook })
      });
      if (res.ok) {
        editWebhookModal.hide();
      } else {
        const data = await res.json();
        errorEl.textContent = data.error || 'Failed to update webhook';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error('Error updating webhook', err);
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login.html';
      }
    } catch (err) {
      console.error('Error logging out', err);
    }
  });

  // Initialisation: load templates, populate UI and open SSE
  loadTemplates().then(populateTemplateCards);
  initSSE();
});
