/*
 * Front-end script for the "Add Your Agent" page.
 * 
 * Ini memuat daftar template dari file statis template-agent/templates.json,
 * menampilkan nama template tanpa ekstensi .json untuk kenyamanan,
 * lalu memuat isi file JSON ketika template dipilih untuk mengambil systemMessage.
 * Setelah formulir diisi, data dikirim ke endpoint /api/agents seperti semula.
 */

document.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.getElementById('createAgentBtn');
  const agentForm = document.getElementById('agentForm');
  const templateSelect = document.getElementById('templateSelect');
  const agentNameInput = document.getElementById('agentName');
  const systemMessageInput = document.getElementById('systemMessage');
  const submitAgentBtn = document.getElementById('submitAgent');
  const resultDiv = document.getElementById('agentResult');

  let templatesLoaded = false;

  // Tampilkan form saat tombol Create Agent diklik dan muat template sekali saja
  createBtn.addEventListener('click', async () => {
    agentForm.style.display = 'block';
    if (!templatesLoaded) {
      await loadTemplates();
    }
  });

  // Mengambil daftar template dari file statis templates.json
  async function loadTemplates() {
    try {
      resultDiv.textContent = '';
      const res = await fetch('/template-agent/templates.json');
      if (!res.ok) {
        throw new Error(`Failed to fetch templates: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      let list;
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.templates)) {
        list = data.templates;
      } else if (data.templates && typeof data.templates === 'object') {
        list = Object.values(data.templates);
      } else if (typeof data === 'object') {
        list = Object.keys(data);
      } else {
        list = [];
      }
      templateSelect.innerHTML = '<option value="" disabled selected>Pilih template…</option>';
      list.forEach((item) => {
        let filename = '';
        if (typeof item === 'string') filename = item;
        else if (item) filename = item.name || item.templateName || item.fileName || '';
        if (!filename) return;
        const label = filename.replace(/\.json$/i, '');
        const opt = document.createElement('option');
        opt.value = filename;
        opt.textContent = label;
        templateSelect.appendChild(opt);
      });
      templatesLoaded = true;
    } catch (err) {
      console.error('Error loading templates:', err);
      resultDiv.textContent = 'Error loading templates: ' + err.message;
    }
  }

  // Memuat detail template (system message) ketika template dipilih
  templateSelect.addEventListener('change', async () => {
    const templateName = templateSelect.value;
    if (!templateName) return;
    try {
      const res = await fetch(`/template-agent/${encodeURIComponent(templateName)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch template details: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const sysMsg =
        data.systemMessage ||
        data.system_message ||
        data.defaultSystemMessage ||
        '';
      systemMessageInput.value = sysMsg;
    } catch (err) {
      console.error('Error fetching template detail:', err);
      resultDiv.textContent = 'Error fetching template detail: ' + err.message;
    }
  });

  // Kirim permintaan pembuatan agent ke server
  submitAgentBtn.addEventListener('click', async () => {
    const templateName = templateSelect.value;
    const agentName = agentNameInput.value.trim();
    const systemMessage = systemMessageInput.value.trim();
    resultDiv.textContent = '';

    if (!templateName) {
      resultDiv.textContent = 'Please select a template.';
      return;
    }
    if (!agentName) {
      resultDiv.textContent = 'Please enter an agent name.';
      return;
    }

    submitAgentBtn.disabled = true;
    resultDiv.textContent = 'Creating agent...';
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName, agentName, systemMessage }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create agent: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      resultDiv.textContent = '';
      const resultList = document.createElement('ul');
      resultList.classList.add('list-unstyled');
      resultList.innerHTML =
        `<li>Workflow ID: ${data.workflowId || '-'}</li>` +
        `<li>Execution ID: ${data.executionId || '-'}</li>`;
      resultDiv.appendChild(resultList);
      if (data.qrString) {
        const canvas = document.createElement('canvas');
        resultDiv.appendChild(canvas);
        QRCode.toCanvas(canvas, data.qrString, { width: 200 }, (error) => {
          if (error) console.error(error);
        });
      }
    } catch (err) {
      console.error('Error creating agent:', err);
      resultDiv.textContent = 'Error creating agent: ' + err.message;
    } finally {
      submitAgentBtn.disabled = false;
    }
  });
});
