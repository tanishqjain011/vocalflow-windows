const fetch = require('node-fetch');

async function fetchDeepgramBalance(apiKey) {
  if (!apiKey || apiKey === 'YOUR_DEEPGRAM_API_KEY_HERE') {
    return { amount: null, units: 'credits', projectName: 'N/A', error: 'No API key' };
  }

  try {
    // Step 1: get projects
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!projectsRes.ok) throw new Error(`Projects HTTP ${projectsRes.status}`);
    const projectsData = await projectsRes.json();
    const project = projectsData.projects?.[0];
    if (!project) throw new Error('No projects found');

    // Step 2: try balances endpoint
    const balRes = await fetch(
      `https://api.deepgram.com/v1/projects/${project.project_id}/balances`,
      { headers: { Authorization: `Token ${apiKey}` } }
    );

    // 403 = free tier / no billing access — show key is valid but balance hidden
    if (balRes.status === 403) {
      return {
        amount: null,
        units: 'credits',
        projectName: project.name ?? 'My Project',
        error: null,
        freeTier: true,
      };
    }

    if (!balRes.ok) throw new Error(`Balances HTTP ${balRes.status}`);
    const balData = await balRes.json();
    const bal = balData.balances?.[0];

    return {
      amount: bal?.amount ?? 0,
      units: bal?.units ?? 'credits',
      projectName: project.name ?? 'My Project',
      error: null,
      freeTier: false,
    };
  } catch (err) {
    console.error('[Balance] Deepgram error:', err.message);
    return { amount: null, projectName: 'N/A', error: err.message };
  }
}

async function fetchGroqBalance(apiKey) {
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY_HERE') {
    return { status: 'No API key', models: 0, error: 'No API key' };
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { status: 'Active ✓', models: data.data?.length ?? 0, error: null };
  } catch (err) {
    return { status: 'Error', models: 0, error: err.message };
  }
}

module.exports = { fetchDeepgramBalance, fetchGroqBalance };