/*
 * Front-end script for the "Add Your Agent" page.
 * 
 * Ini memuat daftar template dari file statis public/templates.json,
 * menampilkan nama template untuk kenyamanan, kemudian mengisi systemMessage
 * dari data template yang sudah dimuat ketika pilihan berubah.
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
  let templatesData = [];

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
      const res = await fetch('/templates.json');
      if (!res.ok) {
        throw new Error(`Failed to fetch templates: ${res.status} ${res.statusText}`);
      }
      templatesData = await res.json();
      if (!Array.isArray(templatesData)) templatesData = [];
      templateSelect.innerHTML = '<option value="" disabled selected>Pilih template…</option>';
      templatesData.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name || item.id;
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
    const templateId = templateSelect.value;
    if (!templateId) return;
    const tmpl = templatesData.find(t => t.id === templateId);
    const sysMsg = tmpl?.workflow?.systemMessage || '';
    systemMessageInput.value = sysMsg;
  });

  // Kirim permintaan pembuatan agent ke server
  submitAgentBtn.addEventListener('click', async () => {
    const templateId = templateSelect.value;
    const agentName = agentNameInput.value.trim();
    const systemMessage = systemMessageInput.value.trim();
    resultDiv.textContent = '';

    if (!templateId) {
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
        body: JSON.stringify({ templateId, agentName, systemMessage }),
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

