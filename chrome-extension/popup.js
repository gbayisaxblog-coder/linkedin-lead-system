// Pre-filled API URL
const API_URL = 'https://linkedin-lead-system-production.up.railway.app';

// On popup load
document.addEventListener('DOMContentLoaded', () => {
  // Set default values
  document.getElementById('apiEndpoint').value = API_URL;
  document.getElementById('emailTarget').value = '100';
});

// Start extraction
document.getElementById('startBtn').addEventListener('click', async () => {
  const emailTarget = parseInt(document.getElementById('emailTarget').value) || 100;
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('linkedin.com')) {
    alert('Please navigate to LinkedIn Sales Navigator first');
    return;
  }
  
  // Send start message with email target
  chrome.tabs.sendMessage(tab.id, {
    type: 'start',
    emailTarget: emailTarget
  });
  
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('statusText').textContent = `Extracting... Target: ${emailTarget} emails`;
});

// Stop extraction
document.getElementById('stopBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'stop' });
  
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('statusText').textContent = 'Stopped';
});

// Export CSV
document.getElementById('exportBtn').addEventListener('click', () => {
  window.open(`${API_URL}/api/export/csv`, '_blank');
});

// Check stats
document.getElementById('statsBtn').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/api/leads/stats`);
    const stats = await response.json();
    document.getElementById('statsText').textContent = 
      `Leads: ${stats.totalLeads} | Emails: ${stats.verifiedEmails} | Cost: $${(stats.totalCost || 0).toFixed(2)}`;
  } catch (error) {
    document.getElementById('statsText').textContent = 'Error loading stats';
  }
});

// Clear history button (optional)
if (document.getElementById('clearBtn')) {
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Clear duplicate history? This will allow re-extraction of previous filters.')) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { type: 'clear_history' });
      alert('History cleared');
    }
  });
}

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'progress') {
    document.getElementById('statusText').textContent = 
      `Page ${message.currentPage} - ${message.totalLeads} leads extracted`;
  } else if (message.type === 'complete') {
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('statusText').textContent = 
      `Complete! ${message.totalLeads} new leads found`;
  } else if (message.type === 'error') {
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('statusText').textContent = `Error: ${message.message}`;
  }
});
