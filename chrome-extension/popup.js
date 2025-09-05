// Load saved endpoint
chrome.storage.local.get(['apiEndpoint'], (result) => {
  if (result.apiEndpoint) {
    document.getElementById('apiEndpoint').value = result.apiEndpoint;
  }
});

// Start extraction
document.getElementById('startBtn').addEventListener('click', async () => {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  const maxPages = parseInt(document.getElementById('maxPages').value) || 5;
  
  if (!apiEndpoint) {
    showMessage('Please enter your Railway API URL', 'error');
    return;
  }
  
  // Save endpoint
  chrome.storage.local.set({ apiEndpoint });
  
  // Check if on LinkedIn
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes('linkedin.com')) {
    showMessage('Please navigate to LinkedIn Sales Navigator first', 'error');
    return;
  }
  
  // Update endpoint in content script
  await chrome.tabs.sendMessage(tab.id, {
    type: 'updateEndpoint',
    endpoint: apiEndpoint.replace(/\/+$/, '') + '/api'
  });
  
  // Start extraction
  chrome.tabs.sendMessage(tab.id, {
    type: 'start',
    maxPages
  });
  
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('progressBar').style.display = 'block';
  showMessage(`Starting extraction of ${maxPages} pages...`, 'info');
  updateStatus('Extracting...', '-', '0');
});

// Stop extraction
document.getElementById('stopBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'stop' });
  
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  showMessage('Extraction stopped', 'info');
  updateStatus('Stopped', '-', '-');
});

// View stats
document.getElementById('statsBtn').addEventListener('click', async () => {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  
  if (!apiEndpoint) {
    showMessage('Please enter your Railway API URL first', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${apiEndpoint.replace(/\/+$/, '')}/api/leads/stats`);
    const stats = await response.json();
    
    document.getElementById('statsContent').innerHTML = `
      <div class="status-row">
        <span class="status-label">Total Leads:</span>
        <span class="status-value">${stats.totalLeads}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Verified Emails:</span>
        <span class="status-value">${stats.verifiedEmails}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Pending:</span>
        <span class="status-value">${stats.pendingLeads}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Companies:</span>
        <span class="status-value">${stats.totalCompanies}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Conversion Rate:</span>
        <span class="status-value">${stats.conversionRate}%</span>
      </div>
      <div class="status-row">
        <span class="status-label">API Cost:</span>
        <span class="status-value">$${(stats.totalCost || 0).toFixed(3)}</span>
      </div>
    `;
    
    document.getElementById('statsDisplay').style.display = 'block';
  } catch (error) {
    showMessage('Failed to fetch stats: ' + error.message, 'error');
  }
});

// Export CSV
document.getElementById('exportBtn').addEventListener('click', async () => {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  
  if (!apiEndpoint) {
    showMessage('Please enter your Railway API URL first', 'error');
    return;
  }
  
  try {
    showMessage('Generating CSV export...', 'info');
    
    const response = await fetch(`${apiEndpoint.replace(/\/+$/, '')}/api/export/csv`);
    const blob = await response.blob();
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    showMessage('CSV downloaded successfully!', 'success');
  } catch (error) {
    showMessage('Export failed: ' + error.message, 'error');
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'progress') {
    const progress = (message.currentPage / 10) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    updateStatus('Extracting...', message.currentPage, message.totalLeads);
    showMessage(`Page ${message.currentPage}: Found ${message.totalLeads} leads`, 'info');
  } else if (message.type === 'complete') {
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('progressFill').style.width = '100%';
    updateStatus('Complete', '-', message.totalLeads);
    showMessage(`✅ Extraction complete! ${message.totalLeads} leads found. Processing emails...`, 'success');
  } else if (message.type === 'error') {
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    updateStatus('Error', '-', '-');
    showMessage('Error: ' + message.message, 'error');
  }
});

function updateStatus(status, page, leads) {
  document.getElementById('statusText').textContent = status;
  document.getElementById('currentPage').textContent = page;
  document.getElementById('totalLeads').textContent = leads;
}

function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  
  if (type !== 'error') {
    setTimeout(() => {
      messageEl.className = 'message';
    }, 5000);
  }
}
