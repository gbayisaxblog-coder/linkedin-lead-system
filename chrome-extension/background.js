// Background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message);
  
  if (message.type === 'complete') {
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      title: 'LinkedIn Extraction Complete',
      message: `Successfully extracted ${message.totalLeads} leads!`
    });
  }
});

// Retry failed leads on startup
chrome.runtime.onStartup.addListener(async () => {
  const { failedLeads, apiEndpoint } = await chrome.storage.local.get(['failedLeads', 'apiEndpoint']);
  
  if (failedLeads && failedLeads.length > 0 && apiEndpoint) {
    console.log(`Retrying ${failedLeads.length} failed leads...`);
    
    try {
      const response = await fetch(`${apiEndpoint}/leads/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: failedLeads })
      });
      
      if (response.ok) {
        chrome.storage.local.remove('failedLeads');
        console.log('Successfully retried failed leads');
      }
    } catch (error) {
      console.error('Failed to retry leads:', error);
    }
  }
});
