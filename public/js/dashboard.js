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
  const selectedTemplateIdInput = document.getElementById('selectedTemplateId');
  const dynamicFieldsContainer = document.getElementById('dynamicFields');

  // Hold the currently selected template and its extracted fields
  let selectedTemplate = null;
  let selectedFields = [];

  // State
  let templates = [];
  let eventSource;

  // No n8n configuration is needed on the client anymore. Workflow
  // creation is proxied through the backend to avoid cross-origin
  // requests from the browser.

  // A map of agent names to the workflow JSON that should be used to create
  // their corresponding n8n workflow.  Populated after successfully creating
  // an agent via the form.  When an agent becomes ready, the workflow is
  // submitted to n8n and removed from this map.
  const workflowMap = {};
  // A set to keep track of agents whose workflows have already been created
  // in n8n.  This prevents duplicate API calls when SSE updates arrive.
  const workflowCreated = {};

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
        // Store selected template and prepare the create modal with dynamic fields
        prepareCreateAgent(tpl);
      });
      templateContainer.appendChild(col);
    });
  }

  /**
   * Extract dynamic fields from the given template's workflow and build
   * input controls into the create agent modal.  This function also
   * populates the hidden inputs for template ID and default webhook
   * path.  If no workflow is present, it falls back to using the
   * template's webhook property.
   *
   * @param {Object} tpl
   */
  function prepareCreateAgent(tpl) {
    selectedTemplate = tpl;
    selectedFields = extractFields(tpl);
    // Set hidden template ID
    selectedTemplateIdInput.value = tpl.id || '';
    // Determine default webhook
    const webhookField = selectedFields.find(f => f.key === 'webhookPath');
    if (webhookField) {
      selectedWebhookInput.value = webhookField.value;
    } else {
      selectedWebhookInput.value = tpl.webhook || '';
    }
    // Clear previous dynamic fields
    dynamicFieldsContainer.innerHTML = '';
    // Create input groups for each extracted field
    selectedFields.forEach(field => {
      const group = document.createElement('div');
      group.className = 'mb-3';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', `field-${field.key}`);
      label.textContent = field.label;
      let input;
      if (field.type === 'boolean') {
        // Checkbox for boolean fields
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-check-input';
        input.id = `field-${field.key}`;
        input.checked = Boolean(field.value);
        // wrap checkbox with form-check
        const formCheck = document.createElement('div');
        formCheck.className = 'form-check';
        formCheck.appendChild(input);
        formCheck.appendChild(label);
        group.appendChild(formCheck);
      } else {
        // Default to text input for strings/numbers
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.id = `field-${field.key}`;
        input.value = field.value !== undefined ? field.value : '';
        group.appendChild(label);
        group.appendChild(input);
      }
      dynamicFieldsContainer.appendChild(group);
    });
    // Hide any previous errors and show the modal
    document.getElementById('createError').style.display = 'none';
    templateModal.hide();
    createAgentModal.show();
  }

  /**
   * Extract configurable fields from the workflow of a template.  This
   * function scans the nodes for known types and returns an array of
   * field descriptors with labels, default values, nodeId and param
   * paths.  Extend this function to add support for additional node
   * types or parameters as needed.
   *
   * @param {Object} tpl
   * @returns {Array<{key: string, label: string, nodeId: string, paramPath: string[], value: any, type?: string}>}
   */
  function extractFields(tpl) {
    const fields = [];
    const workflow = tpl.workflow;
    if (!workflow || !Array.isArray(workflow.nodes)) {
      return fields;
    }
    for (const node of workflow.nodes) {
      const type = node.type;
      const params = node.parameters || {};
      // Webhook path
      if (type === 'n8n-nodes-base.webhook') {
        if (params.path !== undefined) {
          fields.push({
            key: 'webhookPath',
            label: 'Webhook Path',
            nodeId: node.id,
            paramPath: ['parameters', 'path'],
            value: params.path
          });
        }
        // Use webhookId as additional field if desired
        if (node.webhookId) {
          fields.push({
            key: 'webhookId',
            label: 'Webhook ID',
            nodeId: node.id,
            paramPath: ['webhookId'],
            value: node.webhookId
          });
        }
      }
      // AI Agent (tools agent uses the same type)
      if (type === '@n8n/n8n-nodes-langchain.agent' || type === '@n8n/n8n-nodes-langchain.agent/tools' || type === 'n8n-nodes-langchain.agent' || type === 'n8n-nodes-langchain.agent/tools') {
        const options = params.options || {};
        if (options.systemMessage !== undefined) {
          fields.push({
            key: 'systemMessage',
            label: 'System Message',
            nodeId: node.id,
            paramPath: ['parameters', 'options', 'systemMessage'],
            value: options.systemMessage
          });
        }
        if (options.maxIterations !== undefined) {
          fields.push({
            key: 'maxIterations',
            label: 'Max Iterations',
            nodeId: node.id,
            paramPath: ['parameters', 'options', 'maxIterations'],
            value: options.maxIterations
          });
        }
        if (options.returnIntermediateSteps !== undefined) {
          fields.push({
            key: 'returnIntermediateSteps',
            label: 'Return Intermediate Steps',
            nodeId: node.id,
            paramPath: ['parameters', 'options', 'returnIntermediateSteps'],
            value: options.returnIntermediateSteps,
            type: 'boolean'
          });
        }
        if (options.automaticallyPassthroughBinaryImages !== undefined) {
          fields.push({
            key: 'autoPassthroughImages',
            label: 'Automatically Passthrough Binary Images',
            nodeId: node.id,
            paramPath: ['parameters', 'options', 'automaticallyPassthroughBinaryImages'],
            value: options.automaticallyPassthroughBinaryImages,
            type: 'boolean'
          });
        }
      }
      // Postgres memory chat
      if (type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') {
        if (params.tableName !== undefined) {
          fields.push({
            key: 'tableName',
            label: 'Table Name',
            nodeId: node.id,
            paramPath: ['parameters', 'tableName'],
            value: params.tableName
          });
        }
      }
      // OpenAI chat model
      if (type === '@n8n/n8n-nodes-langchain.lmChatOpenAi' || type === '@n8n/n8n-nodes-langchain.openai') {
        const modelParam = params.model || {};
        if (modelParam.value !== undefined) {
          fields.push({
            key: 'model',
            label: 'Model',
            nodeId: node.id,
            paramPath: ['parameters', 'model', 'value'],
            value: modelParam.value
          });
        }
      }
    }
    return fields;
  }

  /**
   * Apply values from user input back into a workflow object.  The
   * fields array should include objects with nodeId, paramPath and
   * updated value.  This function mutates the workflow in place.
   *
   * @param {Object} workflow
   * @param {Array<Object>} fields
   */
  function applyFieldsToWorkflow(workflow, fields) {
    if (!workflow || !Array.isArray(workflow.nodes)) return;
    for (const field of fields) {
      const node = workflow.nodes.find(n => n.id === field.nodeId);
      if (!node) continue;
      // Walk paramPath to set value
      let target = node;
      for (let i = 0; i < field.paramPath.length - 1; i++) {
        const key = field.paramPath[i];
        if (target[key] === undefined) {
          target[key] = {};
        }
        target = target[key];
      }
      const lastKey = field.paramPath[field.paramPath.length - 1];
      // Convert boolean types to proper boolean
      if (field.type === 'boolean') {
        target[lastKey] = Boolean(field.value);
      } else if (!isNaN(field.value) && field.value !== '' && field.key === 'maxIterations') {
        // Convert numeric fields like maxIterations to number
        target[lastKey] = parseInt(field.value, 10);
      } else {
        target[lastKey] = field.value;
      }
    }
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
        // After rendering the sessions, check if any have become ready and
        // trigger workflow creation for them.  This logic ensures that
        // workflows are created only after the WhatsApp session is fully
        // authenticated and ready.
        sessions.forEach(session => {
          if (
            session.status === 'ready' &&
            workflowMap[session.name] &&
            !workflowCreated[session.name]
          ) {
            // Create and activate the n8n workflow for this agent
            createAndActivateWorkflow(session.name, workflowMap[session.name]);
          }
        });
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
   * Create and activate a workflow in n8n for the given agent.  The browser
   * sends the workflow definition to the backend which proxies the request to
   * n8n, avoiding CORS issues.  Upon successful activation, the agent is
   * marked as having its workflow created.
   *
   * @param {string} agentName The name of the agent/session
   * @param {Object} workflow The workflow definition to send to n8n
  */
  async function createAndActivateWorkflow(agentName, workflow) {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow })
      });
      if (!res.ok) {
        console.error('Failed to create workflow via server', await res.text());
        return;
      }
      const data = await res.json();
      const workflowId = data?.id;
      if (!workflowId) {
        console.error('Workflow creation response missing id');
        return;
      }
      console.log(`n8n workflow for agent "${agentName}" created and activated (ID: ${workflowId})`);
      // Mark as created to prevent subsequent attempts
      workflowCreated[agentName] = true;
      delete workflowMap[agentName];
    } catch (err) {
      console.error('Error creating/activating n8n workflow', err);
    }
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
    const errorEl = document.getElementById('createError');
    errorEl.style.display = 'none';
    // Collect values from dynamic fields
    const updatedFields = selectedFields.map(field => {
      const inputEl = document.getElementById(`field-${field.key}`);
      let value;
      if (field.type === 'boolean') {
        value = inputEl.checked;
      } else {
        value = inputEl.value;
      }
      return { ...field, value };
    });
    // Clone workflow from template to avoid mutating the original
    let workflow = null;
    if (selectedTemplate && selectedTemplate.workflow) {
      workflow = JSON.parse(JSON.stringify(selectedTemplate.workflow));
      applyFieldsToWorkflow(workflow, updatedFields);
    }
    // Determine webhook: take from updated fields if present
    let webhook = selectedWebhookInput.value;
    const pathField = updatedFields.find(f => f.key === 'webhookPath');
    if (pathField) {
      webhook = pathField.value;
    }
    try {
      const payload = { name, webhook };
      // Include workflow if available
      if (workflow) {
        payload.workflow = workflow;
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // If the agent is created successfully, store the workflow for
        // n8n integration.  The backend should return the created agent
        // object; however, for our purposes we only need to map the
        // agent name to the workflow definition we used when creating it.
        if (workflow) {
          workflowMap[name] = workflow;
        }
        createAgentModal.hide();
        createAgentForm.reset();
        dynamicFieldsContainer.innerHTML = '';
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

  // Initialisation: load templates and then start the SSE connection
  loadTemplates().then(() => {
    populateTemplateCards();
    initSSE();
  });
});
