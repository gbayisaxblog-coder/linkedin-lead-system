class LinkedInExtractor {
  constructor() {
    this.isRunning = false;
    this.currentPage = 1;
    this.extractedLeads = [];
    this.apiEndpoint = 'https://linkedin-lead-system-production.up.railway.app/api'; // Will update after Railway deploy
  }

  async start(maxPages = 10) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.currentPage = 1;
    this.extractedLeads = [];
    
    console.log('🚀 Starting LinkedIn extraction...');
    
    try {
      while (this.currentPage <= maxPages && this.isRunning) {
        console.log(`📄 Processing page ${this.currentPage}/${maxPages}...`);
        
        await this.waitForResults();
        const leads = this.extractFromPage();
        
        if (leads.length > 0) {
          this.extractedLeads.push(...leads);
          console.log(`✅ Found ${leads.length} leads on page ${this.currentPage}`);
          
          // Send batch to backend
          await this.sendToBackend(leads);
          
          // Update popup
          chrome.runtime.sendMessage({
            type: 'progress',
            currentPage: this.currentPage,
            totalLeads: this.extractedLeads.length
          });
        } else {
          console.log('⚠️ No leads found on this page');
        }
        
        // Go to next page
        if (this.currentPage < maxPages) {
          const hasNext = await this.nextPage();
          if (!hasNext) {
            console.log('📭 No more pages available');
            break;
          }
        }
        
        this.currentPage++;
      }
      
      console.log(`✅ Extraction complete! Total: ${this.extractedLeads.length} leads`);
      
      chrome.runtime.sendMessage({
        type: 'complete',
        totalLeads: this.extractedLeads.length
      });
      
    } catch (error) {
      console.error('❌ Extraction error:', error);
      chrome.runtime.sendMessage({
        type: 'error',
        message: error.message
      });
    } finally {
      this.isRunning = false;
    }
  }
  
  async waitForResults() {
    for (let i = 0; i < 20; i++) {
      const results = document.querySelectorAll('[data-view-name="search-entity-result"]');
      if (results.length > 0) {
        await this.delay(2000);
        return;
      }
      await this.delay(500);
    }
    throw new Error('Results did not load');
  }
  
  extractFromPage() {
    const leads = [];
    const elements = document.querySelectorAll('[data-view-name="search-entity-result"]');
    
    elements.forEach((el, idx) => {
      try {
        // Extract name
        const nameEl = el.querySelector('.artdeco-entity-lockup__title a span[aria-hidden="true"]');
        const name = nameEl?.textContent?.trim();
        
        // Extract title
        const titleEl = el.querySelector('.artdeco-entity-lockup__subtitle span[aria-hidden="true"]');
        const title = titleEl?.textContent?.trim();
        
        // Extract company
        const companyEl = el.querySelector('.artdeco-entity-lockup__caption span[aria-hidden="true"]');
        const company = companyEl?.textContent?.trim();
        
        // Extract location
        const locationEl = el.querySelector('.artdeco-entity-lockup__meta span[aria-hidden="true"]');
        const location = locationEl?.textContent?.trim();
        
        // Extract profile URL
        const linkEl = el.querySelector('.artdeco-entity-lockup__title a');
        const profileUrl = linkEl?.href;
        
        if (name && title && company) {
          leads.push({
            id: `${Date.now()}_${idx}`,
            name,
            title,
            company: company.replace(' · ', '').split(' · ')[0],
            location: location || '',
            profileUrl: profileUrl || '',
            extractedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Error extracting lead ${idx}:`, err);
      }
    });
    
    return leads;
  }
  
  async nextPage() {
    try {
      const nextBtn = document.querySelector('.artdeco-pagination__button--next:not([disabled])');
      if (!nextBtn) return false;
      
      nextBtn.click();
      await this.delay(3000);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async sendToBackend(leads) {
    try {
      const response = await fetch(`${this.apiEndpoint}/leads/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
      });
      
      const result = await response.json();
      console.log(`📤 Sent ${leads.length} leads to backend:`, result);
      return result;
    } catch (error) {
      console.error('Backend error:', error);
      // Store locally if backend is down
      this.storeLocally(leads);
    }
  }
  
  storeLocally(leads) {
    chrome.storage.local.get(['failedLeads'], (result) => {
      const existing = result.failedLeads || [];
      existing.push(...leads);
      chrome.storage.local.set({ failedLeads: existing });
      console.log(`💾 Stored ${leads.length} leads locally for retry`);
    });
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  stop() {
    this.isRunning = false;
    console.log('🛑 Extraction stopped');
  }
}

// Initialize extractor
const extractor = new LinkedInExtractor();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'start':
      extractor.start(message.maxPages);
      sendResponse({ status: 'started' });
      break;
    case 'stop':
      extractor.stop();
      sendResponse({ status: 'stopped' });
      break;
    case 'status':
      sendResponse({
        isRunning: extractor.isRunning,
        currentPage: extractor.currentPage,
        totalLeads: extractor.extractedLeads.length
      });
      break;
    case 'updateEndpoint':
      extractor.apiEndpoint = message.endpoint;
      sendResponse({ status: 'updated' });
      break;
  }
  return true;
});

console.log('✅ LinkedIn Lead Extractor loaded and ready!');
