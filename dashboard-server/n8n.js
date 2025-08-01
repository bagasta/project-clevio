/*
 * n8n Public API Client (JavaScript)
 *
 * This module exposes a `N8nApiClient` class that wraps the n8n public
 * REST API.  It implements methods corresponding to each documented
 * endpoint in the OpenAPI specification at
 * https://n8n.chiefaiofficer.id/api/v1/docs/swagger-ui-init.js.  The
 * client requires an API key which is passed in the `X-N8N-API-KEY`
 * header for all requests【203074212987127†L2869-L2874】.
 *
 * Usage example:
 *
 *   const { N8nApiClient } = require('./n8n_api_client');
 *   const client = new N8nApiClient('YOUR_API_KEY');
 *   client.getWorkflows({ limit: 10 }).then(console.log).catch(console.error);
 *
 * Notes:
 *   - Methods throw an Error for non‑successful HTTP responses.  The
 *     error message contains the status code and response body for
 *     easier debugging.
 *   - Boolean query parameters are converted to 'true' or 'false'
 *     strings as required by the API.
 *   - Request bodies should be plain JavaScript objects and will be
 *     serialised to JSON automatically.
 */

class N8nApiClient {
  /**
   * Create a new API client.
   *
   * @param {string} apiKey - Your n8n API key. It will be sent via the
   *   `X-N8N-API-KEY` header on every request.
   * @param {string} [baseUrl] - Base URL of the API. Defaults to
   *   `https://n8n.chiefaiofficer.id/api/v1`.
   */
  constructor(apiKey, baseUrl = 'https://n8n.chiefaiofficer.id/api/v1') {
    if (!apiKey) {
      throw new Error('An API key is required to use the n8n API');
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Internal helper to perform a fetch request.
   *
   * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE).
   * @param {string} path - API path beginning with '/'.
   * @param {object} [options] - Optional options.
   * @param {object} [options.params] - Query parameters; undefined values are ignored.
   * @param {object|Array} [options.body] - Body to send as JSON.
   * @returns {Promise<any>} Parsed JSON or text response. Returns null for 204 responses.
   * @private
   */
  async _request(method, path, { params, body } = {}) {
    if (!path.startsWith('/')) {
      throw new Error("Path must start with '/'");
    }
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'boolean') {
          url.searchParams.append(key, value ? 'true' : 'false');
        } else {
          url.searchParams.append(key, value);
        }
      }
    }
    const fetchOptions = {
      method,
      headers: this.headers,
    };
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // -----------------------------------------------------------------------
  // Audit
  // -----------------------------------------------------------------------
  /**
   * Generate a security audit for your n8n instance【203074212987127†L76-L131】.
   *
   * @param {object} [options]
   * @param {number} [options.daysAbandonedWorkflow]
   *   Number of days after which a workflow is considered abandoned【203074212987127†L96-L100】.
   * @param {Iterable<string>} [options.categories]
   *   Audit categories to include (credentials, database, nodes, filesystem, instance)【203074212987127†L96-L111】.
   * @returns {Promise<any>} Audit report【203074212987127†L121-L130】.
   */
  async generateAudit(options = {}) {
    const { daysAbandonedWorkflow, categories } = options;
    const additionalOptions = {};
    if (typeof daysAbandonedWorkflow === 'number') {
      additionalOptions.daysAbandonedWorkflow = daysAbandonedWorkflow;
    }
    if (categories) {
      additionalOptions.categories = Array.from(categories);
    }
    const body = Object.keys(additionalOptions).length
      ? { additionalOptions }
      : undefined;
    return this._request('POST', '/audit', { body });
  }

  // -----------------------------------------------------------------------
  // Credentials
  // -----------------------------------------------------------------------
  /**
   * Create a credential【203074212987127†L149-L161】.
   *
   * @param {object} credential - Credential definition.
   * @returns {Promise<any>} Newly created credential【203074212987127†L164-L174】.
   */
  async createCredential(credential) {
    return this._request('POST', '/credentials', { body: credential });
  }

  /**
   * Delete a credential by ID【203074212987127†L186-L224】.
   *
   * @param {string} credentialId - ID of the credential.
   * @returns {Promise<any>} Deleted credential【203074212987127†L208-L216】.
   */
  async deleteCredential(credentialId) {
    return this._request('DELETE', `/credentials/${credentialId}`);
  }

  /**
   * Retrieve the schema for a credential type【203074212987127†L227-L305】.
   *
   * @param {string} credentialTypeName - Name of the credential type【203074212987127†L238-L245】.
   * @returns {Promise<any>} JSON schema for the credential type【203074212987127†L249-L295】.
   */
  async getCredentialSchema(credentialTypeName) {
    return this._request('GET', `/credentials/schema/${credentialTypeName}`);
  }

  /**
   * Transfer a credential to another project【203074212987127†L1019-L1070】.
   *
   * @param {string} credentialId - ID of the credential【203074212987127†L1029-L1032】.
   * @param {string} destinationProjectId - Target project ID【203074212987127†L1042-L1046】.
   * @returns {Promise<any>} Success indicator【203074212987127†L1056-L1068】.
   */
  async transferCredential(credentialId, destinationProjectId) {
    const body = { destinationProjectId };
    return this._request('PUT', `/credentials/${credentialId}/transfer`, { body });
  }

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------
  /**
   * Retrieve all users【203074212987127†L1159-L1199】.
   *
   * @param {object} [options]
   * @param {number} [options.limit] - Maximum records to return【203074212987127†L1168-L1175】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L1168-L1173】.
   * @param {boolean} [options.includeRole] - Include user role in response【203074212987127†L1175-L1176】.
   * @param {string} [options.projectId] - Filter by project ID【203074212987127†L1178-L1187】.
   * @returns {Promise<any>} User list【203074212987127†L1190-L1197】.
   */
  async getUsers(options = {}) {
    const { limit, cursor, includeRole, projectId } = options;
    const params = { limit, cursor, includeRole, projectId };
    return this._request('GET', '/users', { params });
  }

  /**
   * Create one or more users【203074212987127†L1211-L1242】.
   *
   * @param {Array<object>} users - Array of user objects with `email` and optional `role`【203074212987127†L1224-L1234】.
   * @returns {Promise<any>} Creation result【203074212987127†L1244-L1273】.
   */
  async createUsers(users) {
    return this._request('POST', '/users', { body: users });
  }

  /**
   * Retrieve a user by ID or email【203074212987127†L1286-L1317】.
   *
   * @param {string} userIdentifier - User ID or email【203074212987127†L1296-L1301】.
   * @param {object} [options]
   * @param {boolean} [options.includeRole] - Include user role【203074212987127†L1300-L1301】.
   * @returns {Promise<any>} User object【203074212987127†L1303-L1311】.
   */
  async getUser(userIdentifier, options = {}) {
    const { includeRole } = options;
    const params = { includeRole };
    return this._request('GET', `/users/${userIdentifier}`, { params });
  }

  /**
   * Delete a user【203074212987127†L1319-L1344】.
   *
   * @param {string} userIdentifier - User ID or email【203074212987127†L1327-L1331】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1333-L1345】.
   */
  async deleteUser(userIdentifier) {
    return this._request('DELETE', `/users/${userIdentifier}`);
  }

  /**
   * Change a user's global role【203074212987127†L1348-L1399】.
   *
   * @param {string} userIdentifier - User ID or email【203074212987127†L1358-L1361】.
   * @param {string} newRoleName - New role (`global:admin` or `global:member`)【203074212987127†L1370-L1376】.
   * @returns {Promise<any>} Success indicator【203074212987127†L1385-L1398】.
   */
  async changeUserRole(userIdentifier, newRoleName) {
    const body = { newRoleName };
    return this._request('PATCH', `/users/${userIdentifier}/role`, { body });
  }

  // -----------------------------------------------------------------------
  // Executions
  // -----------------------------------------------------------------------
  /**
   * Retrieve executions【203074212987127†L314-L371】.
   *
   * @param {object} [options]
   * @param {boolean} [options.includeData] - Include execution data【203074212987127†L316-L320】.
   * @param {string} [options.status] - Filter by status (`error`, `success`, `waiting`)【203074212987127†L321-L333】.
   * @param {string} [options.workflowId] - Filter by workflow ID【203074212987127†L335-L342】.
   * @param {string} [options.projectId] - Filter by project ID【203074212987127†L345-L354】.
   * @param {number} [options.limit] - Maximum results【203074212987127†L356-L359】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L356-L359】.
   * @returns {Promise<any>} List of executions【203074212987127†L363-L371】.
   */
  async getExecutions(options = {}) {
    const { includeData, status, workflowId, projectId, limit, cursor } = options;
    const params = { includeData, status, workflowId, projectId, limit, cursor };
    return this._request('GET', '/executions', { params });
  }

  /**
   * Retrieve a single execution【203074212987127†L382-L408】.
   *
   * @param {string} executionId - Execution ID【203074212987127†L394-L397】.
   * @param {object} [options]
   * @param {boolean} [options.includeData] - Include execution data【203074212987127†L397-L399】.
   * @returns {Promise<any>} Execution details【203074212987127†L401-L408】.
   */
  async getExecution(executionId, options = {}) {
    const { includeData } = options;
    const params = { includeData };
    return this._request('GET', `/executions/${executionId}`, { params });
  }

  /**
   * Delete an execution【203074212987127†L419-L451】.
   *
   * @param {string} executionId - Execution ID【203074212987127†L429-L432】.
   * @returns {Promise<any>} Deleted execution【203074212987127†L434-L441】.
   */
  async deleteExecution(executionId) {
    return this._request('DELETE', `/executions/${executionId}`);
  }

  // -----------------------------------------------------------------------
  // Workflows
  // -----------------------------------------------------------------------
  /**
   * Create a workflow【203074212987127†L646-L676】.
   *
   * @param {object} workflow - Workflow definition【203074212987127†L656-L664】.
   * @returns {Promise<any>} New workflow【203074212987127†L667-L676】.
   */
  async createWorkflow(workflow) {
    return this._request('POST', '/workflows', { body: workflow });
  }

  /**
   * Retrieve workflows【203074212987127†L686-L753】.
   *
   * @param {object} [options]
   * @param {boolean} [options.active] - Filter by active status【203074212987127†L697-L703】.
   * @param {string} [options.tags] - Comma‑separated tag names【203074212987127†L705-L713】.
   * @param {string} [options.name] - Filter by workflow name【203074212987127†L716-L724】.
   * @param {string} [options.projectId] - Filter by project ID【203074212987127†L727-L735】.
   * @param {boolean} [options.excludePinnedData] - Exclude pinned data【203074212987127†L738-L745】.
   * @param {number} [options.limit] - Maximum workflows【203074212987127†L748-L753】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L748-L753】.
   * @returns {Promise<any>} Workflow list【203074212987127†L754-L763】.
   */
  async getWorkflows(options = {}) {
    const {
      active,
      tags,
      name,
      projectId,
      excludePinnedData,
      limit,
      cursor,
    } = options;
    const params = {
      active,
      tags,
      name,
      projectId,
      excludePinnedData,
      limit,
      cursor,
    };
    return this._request('GET', '/workflows', { params });
  }

  /**
   * Retrieve a single workflow【203074212987127†L771-L804】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L793-L795】.
   * @param {object} [options]
   * @param {boolean} [options.excludePinnedData] - Exclude pinned data【203074212987127†L784-L790】.
   * @returns {Promise<any>} Workflow object【203074212987127†L796-L805】.
   */
  async getWorkflow(workflowId, options = {}) {
    const { excludePinnedData } = options;
    const params = { excludePinnedData };
    return this._request('GET', `/workflows/${workflowId}`, { params });
  }

  /**
   * Delete a workflow【203074212987127†L815-L846】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L825-L828】.
   * @returns {Promise<any>} Deleted workflow【203074212987127†L831-L837】.
   */
  async deleteWorkflow(workflowId) {
    return this._request('DELETE', `/workflows/${workflowId}`);
  }

  /**
   * Update a workflow【203074212987127†L848-L893】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L858-L861】.
   * @param {object} workflow - Updated workflow definition【203074212987127†L863-L869】.
   * @returns {Promise<any>} Updated workflow【203074212987127†L874-L883】.
   */
  async updateWorkflow(workflowId, workflow) {
    return this._request('PUT', `/workflows/${workflowId}`, { body: workflow });
  }

  /**
   * Activate a workflow【203074212987127†L896-L921】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L907-L910】.
   * @returns {Promise<any>} Activated workflow【203074212987127†L912-L920】.
   */
  async activateWorkflow(workflowId) {
    return this._request('POST', `/workflows/${workflowId}/activate`);
  }

  /**
   * Deactivate a workflow【203074212987127†L931-L963】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L941-L945】.
   * @returns {Promise<any>} Deactivated workflow【203074212987127†L947-L955】.
   */
  async deactivateWorkflow(workflowId) {
    return this._request('POST', `/workflows/${workflowId}/deactivate`);
  }

  /**
   * Transfer a workflow to another project【203074212987127†L966-L1016】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L976-L979】.
   * @param {string} destinationProjectId - Destination project ID【203074212987127†L989-L993】.
   * @returns {Promise<any>} Success indicator【203074212987127†L1003-L1016】.
   */
  async transferWorkflow(workflowId, destinationProjectId) {
    const body = { destinationProjectId };
    return this._request('PUT', `/workflows/${workflowId}/transfer`, { body });
  }

  /**
   * Get tags for a workflow【203074212987127†L1072-L1097】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L1083-L1085】.
   * @returns {Promise<any>} List of tags【203074212987127†L1088-L1096】.
   */
  async getWorkflowTags(workflowId) {
    return this._request('GET', `/workflows/${workflowId}/tags`);
  }

  /**
   * Update tags for a workflow【203074212987127†L1110-L1153】.
   *
   * @param {string} workflowId - Workflow ID【203074212987127†L1119-L1121】.
   * @param {Iterable<string>} tagIds - Array of tag IDs【203074212987127†L1123-L1130】.
   * @returns {Promise<any>} Updated tag list【203074212987127†L1134-L1144】.
   */
  async updateWorkflowTags(workflowId, tagIds) {
    const body = { tagIds: Array.from(tagIds) };
    return this._request('PUT', `/workflows/${workflowId}/tags`, { body });
  }

  // -----------------------------------------------------------------------
  // Tags
  // -----------------------------------------------------------------------
  /**
   * Create a tag【203074212987127†L454-L483】.
   *
   * @param {object} tag - Tag definition【203074212987127†L463-L470】.
   * @returns {Promise<any>} Created tag【203074212987127†L474-L483】.
   */
  async createTag(tag) {
    return this._request('POST', '/tags', { body: tag });
  }

  /**
   * Retrieve tags【203074212987127†L495-L520】.
   *
   * @param {object} [options]
   * @param {number} [options.limit] - Maximum number to return【203074212987127†L505-L509】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L505-L509】.
   * @returns {Promise<any>} Tag list【203074212987127†L511-L519】.
   */
  async getTags(options = {}) {
    const { limit, cursor } = options;
    const params = { limit, cursor };
    return this._request('GET', '/tags', { params });
  }

  /**
   * Retrieve a single tag【203074212987127†L528-L552】.
   *
   * @param {string} tagId - Tag ID【203074212987127†L538-L541】.
   * @returns {Promise<any>} Tag object【203074212987127†L543-L551】.
   */
  async getTag(tagId) {
    return this._request('GET', `/tags/${tagId}`);
  }

  /**
   * Delete a tag【203074212987127†L561-L593】.
   *
   * @param {string} tagId - Tag ID【203074212987127†L569-L572】.
   * @returns {Promise<any>} Deleted tag【203074212987127†L575-L583】.
   */
  async deleteTag(tagId) {
    return this._request('DELETE', `/tags/${tagId}`);
  }

  /**
   * Update a tag【203074212987127†L596-L643】.
   *
   * @param {string} tagId - Tag ID【203074212987127†L604-L607】.
   * @param {object} tag - Tag definition【203074212987127†L609-L617】.
   * @returns {Promise<any>} Updated tag【203074212987127†L621-L630】.
   */
  async updateTag(tagId, tag) {
    return this._request('PUT', `/tags/${tagId}`, { body: tag });
  }

  // -----------------------------------------------------------------------
  // Variables
  // -----------------------------------------------------------------------
  /**
   * Create a variable【203074212987127†L1444-L1463】.
   *
   * @param {object} variable - Variable definition【203074212987127†L1454-L1460】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1465-L1467】.
   */
  async createVariable(variable) {
    return this._request('POST', '/variables', { body: variable });
  }

  /**
   * Retrieve variables【203074212987127†L1476-L1507】.
   *
   * @param {object} [options]
   * @param {number} [options.limit] - Maximum variables【203074212987127†L1486-L1491】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L1490-L1491】.
   * @returns {Promise<any>} Variable list【203074212987127†L1494-L1503】.
   */
  async getVariables(options = {}) {
    const { limit, cursor } = options;
    const params = { limit, cursor };
    return this._request('GET', '/variables', { params });
  }

  /**
   * Delete a variable【203074212987127†L1510-L1535】.
   *
   * @param {string} variableId - Variable ID【203074212987127†L1521-L1524】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1526-L1528】.
   */
  async deleteVariable(variableId) {
    return this._request('DELETE', `/variables/${variableId}`);
  }

  /**
   * Update a variable【203074212987127†L1537-L1573】.
   *
   * @param {string} variableId - Variable ID【203074212987127†L1544-L1546】.
   * @param {object} variable - Updated definition【203074212987127†L1546-L1553】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1557-L1573】.
   */
  async updateVariable(variableId, variable) {
    return this._request('PUT', `/variables/${variableId}`, { body: variable });
  }

  // -----------------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------------
  /**
   * Create a project【203074212987127†L1576-L1600】.
   *
   * @param {object} project - Project definition【203074212987127†L1586-L1596】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1598-L1600】.
   */
  async createProject(project) {
    return this._request('POST', '/projects', { body: project });
  }

  /**
   * Retrieve projects【203074212987127†L1609-L1640】.
   *
   * @param {object} [options]
   * @param {number} [options.limit] - Maximum projects【203074212987127†L1619-L1624】.
   * @param {string} [options.cursor] - Pagination cursor【203074212987127†L1619-L1624】.
   * @returns {Promise<any>} Project list【203074212987127†L1627-L1635】.
   */
  async getProjects(options = {}) {
    const { limit, cursor } = options;
    const params = { limit, cursor };
    return this._request('GET', '/projects', { params });
  }

  /**
   * Delete a project【203074212987127†L1643-L1670】.
   *
   * @param {string} projectId - Project ID【203074212987127†L1653-L1656】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1659-L1671】.
   */
  async deleteProject(projectId) {
    return this._request('DELETE', `/projects/${projectId}`);
  }

  /**
   * Update a project【203074212987127†L1673-L1709】.
   *
   * @param {string} projectId - Project ID【203074212987127†L1653-L1656】.
   * @param {object} project - Updated project definition【203074212987127†L1681-L1688】.
   * @returns {Promise<any>} `null` on success【203074212987127†L1694-L1708】.
   */
  async updateProject(projectId, project) {
    return this._request('PUT', `/projects/${projectId}`, { body: project });
  }

  // -----------------------------------------------------------------------
  // Source Control
  // -----------------------------------------------------------------------
  /**
   * Pull changes from remote source control【203074212987127†L1402-L1439】.
   *
   * @param {object} pullOptions - Options for the pull【203074212987127†L1412-L1422】.
   * @returns {Promise<any>} Import result【203074212987127†L1423-L1432】.
   */
  async sourceControlPull(pullOptions) {
    return this._request('POST', '/source-control/pull', { body: pullOptions });
  }
}

// Helper to create and immediately activate a workflow from the template
// definitions stored in `public/templates.json`. The caller supplies the ID of
// the desired template, along with optional overrides for the workflow name
// and system message. After creation the workflow is activated and a run is
// triggered so the caller receives an execution ID.
const fs = require('fs');
const path = require('path');

const TEMPLATES_FILE = path.resolve(__dirname, '../public/templates.json');

async function createAndActivateWorkflow(templateId, agentName, systemMessage) {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) throw new Error('N8N_API_KEY not configured');
  const baseUrl = process.env.N8N_BASE_URL || 'https://n8n.chiefaiofficer.id/api/v1';

  const client = new N8nApiClient(apiKey, baseUrl);

  // Load templates list and locate the requested template
  const templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
  const found = templates.find(t => t.id === templateId);
  if (!found) throw new Error(`Template '${templateId}' not found`);
  const workflow = JSON.parse(JSON.stringify(found.workflow));
  if (agentName) workflow.name = agentName;
  if (systemMessage) workflow.systemMessage = systemMessage;

  const created = await client.createWorkflow(workflow);
  const workflowId = created.id || created.data?.id;

  try {
    await client.activateWorkflow(workflowId);
  } catch (err) {
    // Activation failure should not crash agent creation; log and continue
    console.error('Failed to activate workflow', err.message);
  }

  let executionId;
  try {
    const exec = await client._request('POST', '/workflows/run', {
      body: { workflowId },
    });
    executionId = exec && (exec.id || exec.data?.id);
  } catch (err) {
    // Running the workflow is optional; ignore errors
    executionId = undefined;
  }

  return { workflowId, executionId };
}

module.exports = { N8nApiClient, createAndActivateWorkflow };
