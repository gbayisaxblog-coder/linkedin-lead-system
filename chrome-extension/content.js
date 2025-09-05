class LinkedInExtractor {
  constructor() {
    this.isRunning = false;
    this.currentPage = 1;
    this.maxPagesPerSession = 30;
    this.extractedLeads = [];
    this.dailyEmailTarget = 100;
    this.validEmailsFound = 0;
    this.apiEndpoint = 'https://linkedin-lead-system-production.up.railway.app/api';
    this.currentFilterHash = '';
  }

  async start(emailTarget = 100) {
    if (this.isRunning) {
      console.log('Already running!');
      return;
    }
    
    this.dailyEmailTarget = emailTarget;
    this.isRunning = true;
    this.currentPage = 1;
    this.extractedLeads = [];
    
    // Get current filter state to avoid duplicates
    this.currentFilterHash = this.getCurrentFilterHash();
    
    console.log('🚀 Starting extraction');
    console.log(`📧 Target: ${this.dailyEmailTarget} verified emails`);
    console.log(`🔍 Filter hash: ${this.currentFilterHash}`);
    
    // Check if this filter was already processed
    const processed = await this.wasFilterProcessed(this.currentFilterHash);
    if (processed) {
      alert('This filter combination was already extracted. Please change at least one filter.');
      this.isRunning = false;
      return;
    }
    
    try {
      // Extract up to 30 pages
      for (let page = 1; page <= this.maxPagesPerSession && this.isRunning; page++) {
        console.log(`📄 Page ${page}/${this.maxPagesPerSession}`);
        
        await this.waitForResults();
        const leads = this.extractFromPage();
        
        if (leads.length === 0) {
          console.log('No more leads found');
          break;
        }
        
        console.log(`Found ${leads.length} leads`);
        
        // Check for duplicates before sending
        const newLeads = await this.filterDuplicates(leads);
        console.log(`${newLeads.length} are new (not duplicates)`);
        
        if (newLeads.length > 0) {
          await this.sendToBackend(newLeads);
          this.extractedLeads.push(...newLeads);
        }
        
        // Update progress
        chrome.runtime.sendMessage({
          type: 'progress',
          currentPage: page,
          totalLeads: this.extractedLeads.length
        });
        
        // Check email target
        await this.checkProgress();
        if (this.validEmailsFound >= this.dailyEmailTarget) {
          console.log('✅ Email target reached!');
          break;
        }
        
        // Next page
        if (page < this.maxPagesPerSession) {
          const hasNext = await this.nextPage();
          if (!hasNext) break;
          await this.delay(4000);
        }
      }
      
      // Mark filter as processed
      await this.markFilterProcessed(this.currentFilterHash);
      
      console.log(`✅ Complete! Extracted ${this.extractedLeads.length} new leads`);
      
      chrome.runtime.sendMessage({
        type: 'complete',
        totalLeads: this.extractedLeads.length,
        validEmails: this.validEmailsFound
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      chrome.runtime.sendMessage({
        type: 'error',
        message: error.message
      });
    } finally {
      this.isRunning = false;
    }
  }

  getCurrentFilterHash() {
    // Create unique hash from current filters
    const filters = [];
    
    // Get all active filter pills
    document.querySelectorAll('.search-reusables__filter-pill-button').forEach(pill => {
      filters.push(pill.textContent.trim());
    });
    
    // Get search keywords if any
    const searchBox = document.querySelector('input[placeholder*="Search"]');
    if (searchBox?.value) {
      filters.push(`search:${searchBox.value}`);
    }
    
    // Sort and join for consistent hash
    return filters.sort().join('|');
  }

  async wasFilterProcessed(filterHash) {
    const stored = await chrome.storage.local.get(['processedFilters']);
    const processed = stored.processedFilters || [];
    return processed.includes(filterHash);
  }

  async markFilterProcessed(filterHash) {
    const stored = await chrome.storage.local.get(['processedFilters']);
    const processed = stored.processedFilters || [];
    if (!processed.includes(filterHash)) {
      processed.push(filterHash);
      await chrome.storage.local.set({ 
        processedFilters: processed,
        lastProcessed: new Date().toISOString()
      });
    }
  }

  async filterDuplicates(leads) {
    // Get existing lead hashes from storage
    const stored = await chrome.storage.local.get(['leadHashes']);
    const existingHashes = new Set(stored.leadHashes || []);
    
    const newLeads = [];
    const newHashes = [];
    
    for (const lead of leads) {
      // Create unique hash for each lead
      const hash = `${lead.name}|${lead.company}|${lead.title}`.toLowerCase();
      
      if (!existingHashes.has(hash)) {
        newLeads.push(lead);
        newHashes.push(hash);
        existingHashes.add(hash);
      }
    }
    
    // Update stored hashes
    if (newHashes.length > 0) {
      await chrome.storage.local.set({ 
        leadHashes: Array.from(existingHashes)
      });
    }
    
    return newLeads;
  }

  async waitForResults() {
    for (let i = 0; i < 30; i++) {
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
        const nameEl = el.querySelector('.artdeco-entity-lockup__title a span[aria-hidden="true"]');
        const name = nameEl?.textContent?.trim();
        
        const titleEl = el.querySelector('.artdeco-entity-lockup__subtitle span[aria-hidden="true"]');
        const title = titleEl?.textContent?.trim();
        
        const companyEl = el.querySelector('.artdeco-entity-lockup__caption span[aria-hidden="true"]');
        let company = companyEl?.textContent?.trim() || '';
        company = company.split('·')[0].trim();
        
        const locationEl = el.querySelector('.artdeco-entity-lockup__meta span[aria-hidden="true"]');
        const location = locationEl?.textContent?.trim();
        
        const linkEl = el.querySelector('.artdeco-entity-lockup__title a');
        const profileUrl = linkEl?.href;
        
        // Extract time in role
        const fullText = el.textContent;
        let timeInRole = '';
        let timeAtCompany = '';
        
        if (fullText.includes('month') && fullText.includes('in role')) {
          const match = fullText.match(/(\d+\s+months?\s+in\s+role)/);
          if (match) timeInRole = match[1];
        }
        
        if (fullText.includes('month') && fullText.includes('in company')) {
          const match = fullText.match(/(\d+\s+months?\s+in\s+company)/);
          if (match) timeAtCompany = match[1];
        }
        
        // Check for recently hired badge
        const recentlyHired = el.querySelector('[aria-label*="Recently hired"]') !== null ||
                             (timeInRole.includes('month') && parseInt(timeInRole) < 12);
        
        if (name && title && company) {
          leads.push({
            id: `${Date.now()}_${idx}`,
            name,
            title,
            company,
            location: location || '',
            profileUrl: profileUrl || '',
            timeInRole,
            timeAtCompany,
            recentlyHired,
            extractedAt: new Date().toISOString(),
            filterHash: this.currentFilterHash
          });
        }
      } catch (err) {
        console.error(`Error extracting lead ${idx}:`, err);
      }
    });
    
    return leads;
  }

  async nextPage() {
    const nextBtn = document.querySelector('.artdeco-pagination__button--next:not([disabled])');
    if (!nextBtn) return false;
    
    nextBtn.click();
    await this.delay(3000);
    return true;
  }

  async sendToBackend(leads) {
    try {
      const response = await fetch(`${this.apiEndpoint}/leads/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
      });
      
      const result = await response.json();
      console.log(`📤 Sent ${leads.length} new leads to backend`);
      return result;
    } catch (error) {
      console.error('Backend error:', error);
    }
  }

  async checkProgress() {
    try {
      const response = await fetch(`${this.apiEndpoint}/leads/stats`);
      const stats = await response.json();
      this.validEmailsFound = stats.verifiedEmails || 0;
      console.log(`📊 Progress: ${this.validEmailsFound}/${this.dailyEmailTarget} emails verified`);
    } catch (error) {
      console.error('Error checking progress:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Extraction stopped');
  }

  async clearDuplicateHistory() {
    await chrome.storage.local.remove(['processedFilters', 'leadHashes']);
    console.log('🧹 Cleared duplicate history');
  }
}

const extractor = new LinkedInExtractor();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'start':
      extractor.start(message.emailTarget || 100);
      sendResponse({ status: 'started' });
      break;
    case 'stop':
      extractor.stop();
      sendResponse({ status: 'stopped' });
      break;
    case 'clear_history':
      extractor.clearDuplicateHistory();
      sendResponse({ status: 'cleared' });
      break;
    case 'updateEndpoint':
      extractor.apiEndpoint = message.endpoint;
      sendResponse({ status: 'updated' });
      break;
  }
  return true;
});

console.log('✅ LinkedIn Extractor loaded - Manual filter, auto-extract, no duplicates!');
