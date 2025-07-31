const fs = require('fs').promises;
const axios = require('axios');

/**
 * Create a workflow from JSON file, activate it, then fetch latest execution ID.
 * @param {string} apiKey - n8n API key (X-N8N-API-KEY header)
 * @param {string} jsonFilePath - Path to workflow definition JSON file
 * @returns {Promise<{workflowId: string, executionId: (string|null)}>}
 */
async function createAndActivateWorkflow(apiKey, jsonFilePath) {
  // 1. Read workflow definition from JSON file
  const workflowData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));

  // 2. Create new workflow
  const createResp = await axios.post(
    'https://n8n.chiefaiofficer.id/api/v1/workflows',
    workflowData,
    {
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  const createdWorkflow = createResp.data;
  const workflowId = createdWorkflow.id;

  // 3. Activate workflow
  await axios.post(
    `https://n8n.chiefaiofficer.id/api/v1/workflows/${workflowId}/activate`,
    null,
    {
      headers: { 'X-N8N-API-KEY': apiKey }
    }
  );

  // 4. Fetch latest execution (if any) to get executionId
  const execResp = await axios.get(
    `https://n8n.chiefaiofficer.id/api/v1/executions`,
    {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: {
        workflowId: workflowId,
        limit: 1
      }
    }
  );

  let executionId = null;
  if (Array.isArray(execResp.data?.data)) {
    executionId = execResp.data.data.length ? execResp.data.data[0].id : null;
  } else if (Array.isArray(execResp.data)) {
    executionId = execResp.data.length ? execResp.data[0].id : null;
  }

  console.log(`Workflow created (ID: ${workflowId}) and activated.`);
  if (executionId) {
    console.log(`Latest execution ID: ${executionId}`);
  } else {
    console.log('No execution found for this workflow yet.');
  }

  return { workflowId, executionId };
}

module.exports = { createAndActivateWorkflow };

// Example usage
// createAndActivateWorkflow('YOUR_N8N_API_KEY', 'path/to/workflow.json')
//   .then(({ workflowId, executionId }) => {
//     console.log('Workflow ID:', workflowId);
//     console.log('Execution ID:', executionId);
//   })
//   .catch(err => {
//     console.error('Error:', err.message);
//   });
