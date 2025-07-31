document.addEventListener('DOMContentLoaded', () => {
  const navAgents = document.getElementById('navAgents');
  const navSessions = document.getElementById('navSessions');
  const agentsSection = document.getElementById('agentsSection');
  const sessionsSection = document.getElementById('sessionsSection');
  const agentsTableBody = document.getElementById('agentsTable').getElementsByTagName('tbody')[0];
  const newAgentBtn = document.getElementById('newAgentBtn');
  const createAgentModal = new coreui.Modal(document.getElementById('createAgentModal'));
  const createAgentForm = document.getElementById('createAgentForm');
  const agentTemplateSelect = document.getElementById('agentTemplate');
  const agentError = document.getElementById('agentError');

  function showAgents() {
    agentsSection.style.display = '';
    sessionsSection.style.display = 'none';
    navAgents.classList.add('active');
    navSessions.classList.remove('active');
    loadAgents();
  }

  function showSessions() {
    sessionsSection.style.display = '';
    agentsSection.style.display = 'none';
    navSessions.classList.add('active');
    navAgents.classList.remove('active');
  }

  navAgents.addEventListener('click', (e) => {
    e.preventDefault();
    showAgents();
  });
  navSessions.addEventListener('click', (e) => {
    e.preventDefault();
    showSessions();
  });

  async function loadAgents() {
    agentsTableBody.innerHTML = '';
    try {
      const resp = await fetch('/api/agents');
      const data = await resp.json();
      data.forEach(agent => {
        const row = agentsTableBody.insertRow();
        row.insertCell(0).textContent = agent.name;
        row.insertCell(1).textContent = agent.channel;
        row.insertCell(2).textContent = agent.workflowId;
        row.insertCell(3).textContent = agent.executionId || '-';
        row.insertCell(4).textContent = new Date(agent.createdAt).toLocaleString();
      });
    } catch (err) {
      console.error('Failed to load agents', err);
    }
  }

  async function loadTemplates() {
    agentTemplateSelect.innerHTML = '';
    try {
      const resp = await fetch('/api/agent-templates');
      const data = await resp.json();
      data.forEach(tpl => {
        const opt = document.createElement('option');
        opt.value = tpl;
        opt.textContent = tpl;
        agentTemplateSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  }

  newAgentBtn.addEventListener('click', () => {
    agentError.style.display = 'none';
    createAgentForm.reset();
    loadTemplates();
    createAgentModal.show();
  });

  createAgentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('agentName').value.trim();
    const channel = document.getElementById('agentChannel').value;
    const template = agentTemplateSelect.value;
    agentError.style.display = 'none';
    try {
      const resp = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, channel, template })
      });
      if (resp.ok) {
        createAgentModal.hide();
        loadAgents();
      } else {
        const data = await resp.json();
        agentError.textContent = data.error || 'Failed to create agent';
        agentError.style.display = 'block';
      }
    } catch (err) {
      console.error('Error creating agent', err);
      agentError.textContent = 'Network error';
      agentError.style.display = 'block';
    }
  });

  // default view
  showSessions();
});
