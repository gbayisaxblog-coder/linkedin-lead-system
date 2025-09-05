class LinkedInRecentHiresExtractor {
  constructor() {
    this.isRunning = false;
    this.currentPage = 1;
    this.maxPagesPerFilter = 30;
    this.extractedLeads = [];
    this.processedFilters = new Set();
    this.dailyEmailTarget = 100;
    this.validEmailsFound = 0;
    this.apiEndpoint = 'https://linkedin-lead-system-production.up.railway.app/api';
    
    // Track current filters
    this.currentFilters = {
      companySize: null,
      location: null,
      seniority: null,
      yearsInCompany: 'Less than 1 year'
    };
  }

  async start(emailTarget = 100) {
    if (this.isRunning) return;
    
    this.dailyEmailTarget = emailTarget;
    this.isRunning = true;
    this.validEmailsFound = 0;
    
    console.log(`🎯 Starting extraction for recently hired employees`);
    console.log(`📧 Target: ${this.dailyEmailTarget} verified emails`);
    
    // Load processed filters
    const stored = await chrome.storage.local.get(['processedFilters']);
    this.processedFilters = new Set(stored.processedFilters || []);
    
    // Extract with current filters
    await this.extractWithCurrentFilters();
    
    this.isRunning = false;
    console.log(`✅ Complete! ${this.validEmailsFound} emails found`);
  }

  async extractWithCurrentFilters() {
    let totalPagesExtracted = 0;
    
    while (this.isRunning && totalPagesExtracted < this.maxPagesPerFilter) {
      console.log(`📄 Page ${totalPagesExtracted + 1}/${this.maxPagesPerFilter}`);
      
      // Wait for results
      await this.waitForResults();
      
      // Extract leads from current page
      const leads = this.extractFromPage();
      
      if (leads.length === 0) {
        console.log('No more leads found');
        break;
      }
      
      // Mark as recently hired
      leads.forEach(lead => {
        lead.recentlyHired = true;
        lead.filterUsed = this.getCurrentFilterString();
      });
      
      // Send to backend
      await this.sendToBackend(leads);
      
      // Update progress
      await this.checkProgress();
      
      // Check if we reached target
      if (this.validEmailsFound >= this.dailyEmailTarget) {
        console.log(`✅ Target reached: ${this.validEmailsFound} emails`);
        break;
      }
      
      // Go to next page
      const hasNext = await this.nextPage();
      if (!hasNext) break;
      
      totalPagesExtracted++;
      
      // Wait between pages
      await this.delay(4000);
    }
    
    // Save processed filter
    this.processedFilters.add(this.getCurrentFilterString());
    await chrome.storage.local.set({ 
      processedFilters: Array.from(this.processedFilters) 
    });
  }

  getCurrentFilterString() {
    // Read current filters from the page
    const filterElements = document.querySelectorAll('.search-reusables__filter-pill-button');
    const filters = [];
    filterElements.forEach(el => {
      filters.push(el.textContent.trim());
    });
    return filters.join('|');
  }

  async waitForResults() {
    for (let i = 0; i < 30; i++) {
      const results = document.querySelectorAll('[data-view-name="search-entity-result"]');
      if (results.length > 0) {
        await this.delay(2000);
        return true;
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
        // Check if "Recently hired" badge is present
        const recentlyHiredBadge = el.querySelector('[aria-label*="Recently hired"]');
        
        // Extract basic info
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
        
        // Extract time in role/company
        const fullText = el.textContent;
        let timeInRole = '';
        let timeAtCompany = '';
        
        const roleMatch = fullText.match(/(\d+\s+months?\s+in\s+role)/);
        if (roleMatch) timeInRole = roleMatch[1];
        
        const companyMatch = fullText.match(/(\d+\s+months?\s+in\s+company)/);
        if (companyMatch) timeAtCompany = companyMatch[1];
        
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
            hasRecentlyHiredBadge: !!recentlyHiredBadge,
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
      
      // Update message to popup
      chrome.runtime.sendMessage({
        type: 'batch_sent',
        count: leads.length
      });
      
      return result;
    } catch (error) {
      console.error('Backend error:', error);
      // Store locally for retry
      const stored = await chrome.storage.local.get(['failedLeads']);
      const failed = stored.failedLeads || [];
      failed.push(...leads);
      await chrome.storage.local.set({ failedLeads: failed });
    }
  }

  async checkProgress() {
    try {
      const response = await fetch(`${this.apiEndpoint}/leads/stats`);
      const stats = await response.json();
      this.validEmailsFound = stats.verifiedEmails || 0;
      
      console.log(`📊 Progress: ${this.validEmailsFound}/${this.dailyEmailTarget} emails`);
      
      chrome.runtime.sendMessage({
        type: 'progress_update',
        validEmails: this.validEmailsFound,
        target: this.dailyEmailTarget
      });
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
}

// Initialize extractor
const extractor = new LinkedInRecentHiresExtractor();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'start':
      extractor.start(message.maxPages || 100);
      sendResponse({ status: 'started' });
      break;
    case 'stop':
      extractor.stop();
      sendResponse({ status: 'stopped' });
      break;
    case 'status':
      sendResponse({
        isRunning: extractor.isRunning,
        validEmailsFound: extractor.validEmailsFound,
        target: extractor.dailyEmailTarget
      });
      break;
    case 'updateEndpoint':
      extractor.apiEndpoint = message.endpoint;
      sendResponse({ status: 'updated' });
      break;
  }
  return true;
});

console.log('✅ LinkedIn Recent Hires Extractor loaded!');
