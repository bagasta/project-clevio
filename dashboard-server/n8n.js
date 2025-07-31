/*
 * n8n API integration
 *
 * Modul ini menyediakan fungsi untuk membuat workflow baru di instance
 * n8n, langsung mengaktifkannya, dan kemudian mengambil ID eksekusi
 * terbarunya. Semua konfigurasi seperti URL API dan API key diambil
 * dari variabel lingkungan sehingga dapat didefinisikan di file `.env`.
 */

const fs = require('fs').promises;
const axios = require('axios');

// Ambil konfigurasi dari environment. Pastikan nilai‐nilai ini
// didefinisikan dalam file `.env` pada root proyek Anda.
const { N8N_API_URL, N8N_API_KEY } = process.env;

if (!N8N_API_URL || !N8N_API_KEY) {
  console.warn(
    'Warning: N8N_API_URL atau N8N_API_KEY belum didefinisikan. ' +
      'Set nilai variabel lingkungan ini di file .env Anda sebelum menggunakan modul n8n.'
  );
}

/**
 * Membuat workflow baru berdasarkan file JSON, mengaktifkannya,
 * kemudian mengambil execution ID terbaru untuk workflow tersebut.
 *
 * @param {string} jsonFilePath Path ke file JSON yang berisi definisi workflow.
 * @returns {Promise<{ workflowId: string, executionId: (string|null) }>} ID workflow dan execution ID terakhir (jika ada).
 */
async function createAndActivateWorkflow(jsonFilePath) {
  // Baca file JSON dan parse ke objek
  const workflowData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));

  // Buat workflow baru
  const createResp = await axios.post(`${N8N_API_URL}/workflows`, workflowData, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  const createdWorkflow = createResp.data;
  const workflowId = createdWorkflow.id;

  // Aktifkan workflow sehingga segera berjalan (misal webhook/trigger dapat memulai eksekusi)
  await axios.post(
    `${N8N_API_URL}/workflows/${workflowId}/activate`,
    null,
    {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    }
  );

  // Ambil eksekusi terbaru untuk workflow ini. Gunakan limit=1 agar hanya
  // mendapatkan satu item terakhir. Response dari API bisa berupa object dengan
  // properti `data` (array) atau array langsung.
  let executionId = null;
  try {
    const execResp = await axios.get(`${N8N_API_URL}/executions`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
      params: { workflowId, limit: 1 },
    });
    const execData = Array.isArray(execResp.data.data)
      ? execResp.data.data
      : Array.isArray(execResp.data)
      ? execResp.data
      : [];
    if (execData.length > 0) {
      executionId = execData[0].id;
    }
  } catch (err) {
    // Jika tidak ada eksekusi sama sekali atau API mengembalikan error,
    // biarkan executionId tetap null. Anda bisa menangani error ini sesuai kebutuhan.
    console.warn('Gagal mengambil execution ID:', err.message);
  }

  return { workflowId, executionId };
}

module.exports = {
  createAndActivateWorkflow,
};