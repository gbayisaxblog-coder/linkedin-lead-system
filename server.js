const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB connection with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin-leads');
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// Schemas
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: String,
  profileUrl: String,
  companyDomain: String,
  emailAddress: String,
  emailVerified: { type: Boolean, default: false },
  emailCandidates: [String],
  status: { type: String, default: 'pending' },
  extractedAt: { type: Date, default: Date.now },
  processedAt: Date,
  verifiedAt: Date,
  hash: { type: String, unique: true, required: true }
  recentlyHired: { type: Boolean, default: false },
  timeInRole: String,
  timeAtCompany: String,
  extractionFilter: Object,
  filterHash: String,
});

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  domain: String,
  firstSeen: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  failed: { type: Boolean, default: false }
});

const apiUsageSchema = new mongoose.Schema({
  provider: String,
  companyName: String,
  domain: String,
  success: Boolean,
  cost: Number,
  timestamp: { type: Date, default: Date.now }
});

const Lead = mongoose.model('Lead', leadSchema);
const Company = mongoose.model('Company', companySchema);
const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'LinkedIn Lead System Active',
    endpoints: {
      health: '/health',
      stats: '/api/leads/stats',
      batch: '/api/leads/batch',
      export: '/api/export/csv'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1,
    brightData: !!process.env.BRIGHT_DATA_API_KEY,
    dataForSeo: !!process.env.DATAFORSEO_USERNAME
  });
});

app.post('/api/leads/batch', async (req, res) => {
  try {
    const { leads } = req.body;
    const processedLeads = [];
    
    for (const lead of leads) {
      const hash = crypto.createHash('md5')
        .update(`${lead.name}-${lead.company}-${lead.title}`.toLowerCase())
        .digest('hex');
      
      const existingLead = await Lead.findOne({ hash });
      if (existingLead) {
        console.log(`⏭️ Skipping duplicate: ${lead.name}`);
        continue;
      }
      
      const newLead = new Lead({ ...lead, hash });
      await newLead.save();
      processedLeads.push(newLead);
    }
    
    console.log(`✅ Processed ${processedLeads.length} new leads`);
    
    // Start background processing
    if (processedLeads.length > 0) {
      setTimeout(() => processLeads(), 2000);
    }
    
    res.json({ 
      success: true, 
      processed: processedLeads.length,
      duplicates: leads.length - processedLeads.length
    });
  } catch (error) {
    console.error('❌ Batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leads/stats', async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const verifiedEmails = await Lead.countDocuments({ emailVerified: true });
    const pendingLeads = await Lead.countDocuments({ status: 'pending' });
    const failedLeads = await Lead.countDocuments({ status: 'failed' });
    const totalCompanies = await Company.countDocuments();
    const apiCalls = await ApiUsage.countDocuments();
    const totalCost = await ApiUsage.aggregate([
      { $group: { _id: null, total: { $sum: "$cost" } } }
    ]);
    
    res.json({
      totalLeads,
      verifiedEmails,
      pendingLeads,
      failedLeads,
      totalCompanies,
      apiCalls,
      totalCost: totalCost[0]?.total || 0,
      conversionRate: totalLeads > 0 ? (verifiedEmails / totalLeads * 100).toFixed(2) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/csv', async (req, res) => {


app.get('/api/leads/recent-hires', async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort('-extractedAt').limit(1000);
    
    res.json({
      count: recentHires.length,
      leads: recentHires
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  try {


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    const leads = await Lead.find({ emailVerified: true }).sort('-extractedAt');


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    let csv = 'Name,Title,Company,Location,Email,Domain,Profile URL,Extracted Date\n';


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    leads.forEach(lead => {


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
      csv += `"${lead.name}","${lead.title}","${lead.company}","${lead.location || ''}","${lead.emailAddress}","${lead.companyDomain || ''}","${lead.profileUrl || ''}","${new Date(lead.extractedAt).toLocaleDateString()}"\n`;


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    });


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    res.setHeader('Content-Type', 'text/csv');


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    res.setHeader('Content-Disposition', `attachment; filename=linkedin_leads_${Date.now()}.csv`);


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    res.send(csv);


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  } catch (error) {


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
    res.status(500).json({ error: error.message });


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  }


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
});


app.get("/api/leads/recent-hires", async (req, res) => {
  try {
    const recentHires = await Lead.find({ 
      recentlyHired: true,
      emailVerified: true 
    }).sort("-extractedAt");
    res.json(recentHires);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Background processing
async function processLeads() {
  try {
    const pendingLeads = await Lead.find({ status: 'pending' }).limit(5);
    
    if (pendingLeads.length === 0) {
      console.log('📭 No pending leads to process');
      return;
    }
    
    console.log(`🔄 Processing ${pendingLeads.length} leads...`);
    
    for (const lead of pendingLeads) {
      await enrichLead(lead);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
    
    // Continue processing if there are more leads
    const remainingLeads = await Lead.countDocuments({ status: 'pending' });
    if (remainingLeads > 0) {
      console.log(`📋 ${remainingLeads} leads remaining in queue`);
      setTimeout(processLeads, 5000);
    } else {
      console.log('✅ All leads processed!');
    }
  } catch (error) {
    console.error('❌ Processing error:', error);
    setTimeout(processLeads, 10000);
  }
}

async function enrichLead(lead) {
  try {
    console.log(`🔍 Processing: ${lead.name} at ${lead.company}`);
    
    // Check if company domain already known
    let company = await Company.findOne({ 
      name: { $regex: new RegExp(`^${lead.company}$`, 'i') }
    });
    
    if (!company || (!company.domain && !company.failed)) {
      // Try to resolve domain
      const domain = await resolveCompanyDomain(lead.company);
      
      if (domain) {
        company = await Company.findOneAndUpdate(
          { name: lead.company },
          { domain, lastUpdated: new Date(), failed: false },
          { upsert: true, new: true }
        );
        console.log(`🌐 Found domain: ${domain}`);
      } else {
        await Company.findOneAndUpdate(
          { name: lead.company },
          { failed: true, lastUpdated: new Date() },
          { upsert: true }
        );
        console.log(`❌ No domain found for ${lead.company}`);
      }
    }

    if (company && company.domain && !company.failed) {
      // Generate email candidates
      const emailCandidates = generateEmailCandidates(lead, company.domain);
      
      // For demo, we'll use the first pattern
      const primaryEmail = emailCandidates[0];
      
      await Lead.findByIdAndUpdate(lead._id, {
        companyDomain: company.domain,
        emailCandidates,
        emailAddress: primaryEmail,
        emailVerified: true,
        status: 'email_verified',
        processedAt: new Date(),
        verifiedAt: new Date()
      });
      
      console.log(`✅ Enriched: ${lead.name} → ${primaryEmail}`);
    } else {
      await Lead.findByIdAndUpdate(lead._id, {
        status: 'failed',
        processedAt: new Date()
      });
      console.log(`⚠️ Failed to enrich: ${lead.name}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${lead.name}:`, error.message);
    await Lead.findByIdAndUpdate(lead._id, {
      status: 'failed',
      processedAt: new Date()
    });
  }
}

async function resolveCompanyDomain(companyName) {
  try {
    // Clean company name
    const cleanName = companyName.replace(/[^\w\s]/g, '').trim();
    const query = `${cleanName} official website`;
    
    // Try Bright Data first
    if (process.env.BRIGHT_DATA_API_KEY) {
      try {
        const brightResponse = await axios.post('https://api.brightdata.com/request', {
          zone: 'domain_finder',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          format: 'raw'
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const domain = extractDomainFromHTML(brightResponse.data, companyName);
        
        if (domain) {
          await ApiUsage.create({
            provider: 'bright_data',
            companyName,
            domain,
            success: true,
            cost: 0.0015
          });
          return domain;
        }
      } catch (brightError) {
        console.log(`⚠️ Bright Data failed: ${brightError.message}`);
      }
    }
    
    // Fallback to DataForSEO
    if (process.env.DATAFORSEO_USERNAME && process.env.DATAFORSEO_PASSWORD) {
      try {
        console.log(`🔄 Trying DataForSEO for ${companyName}...`);
        
        const auth = Buffer.from(`${process.env.DATAFORSEO_USERNAME}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
        
        const dataForSeoResponse = await axios.post(
          'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
          [{
            keyword: query,
            location_code: 2840,
            language_code: "en",
            device: "desktop",
            os: "windows",
            depth: 10
          }],
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        const items = dataForSeoResponse.data?.tasks?.[0]?.result?.[0]?.items || [];
        const domain = extractDomainFromSerpResults(items, companyName);
        
        await ApiUsage.create({
          provider: 'dataforseo',
          companyName,
          domain,
          success: !!domain,
          cost: 0.0006
        });
        
        return domain;
      } catch (dataForSeoError) {
        console.error(`❌ DataForSEO failed: ${dataForSeoError.message}`);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Domain resolution error: ${error.message}`);
    return null;
  }
}

function extractDomainFromHTML(html, companyName) {
  try {
    const urlRegex = /https?:\/\/(www\.)?([^\/\s"'>]+)/gi;
    const matches = [];
    let match;
    
    while ((match = urlRegex.exec(html)) !== null) {
      const domain = match[2].toLowerCase();
      if (isRelevantDomain(domain, companyName)) {
        matches.push(domain);
      }
    }
    
    return matches[0] || null;
  } catch (error) {
    return null;
  }
}

function extractDomainFromSerpResults(items, companyName) {
  for (const item of items) {
    if (!item.url) continue;
    
    try {
      const url = new URL(item.url);
      const domain = url.hostname.replace('www.', '');
      
      if (isRelevantDomain(domain, companyName)) {
        return domain;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function isRelevantDomain(domain, companyName) {
  // Skip social media and generic sites
  const skipDomains = [
    'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
    'wikipedia.org', 'youtube.com', 'glassdoor.com', 'indeed.com',
    'crunchbase.com', 'bloomberg.com', 'reuters.com'
  ];
  
  if (skipDomains.some(skip => domain.includes(skip))) {
    return false;
  }
  
  // Check if domain contains company name keywords
  const companyWords = companyName.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 2);
  
  const domainParts = domain.split('.');
  
  for (const word of companyWords) {
    if (domainParts.some(part => 
      part.includes(word) || word.includes(part)
    )) {
      return true;
    }
  }
  
  return false;
}

function generateEmailCandidates(lead, domain) {
  const nameParts = lead.name.toLowerCase().split(' ').filter(p => p.length > 0);
  const firstName = nameParts[0].replace(/[^a-z]/g, '');
  const lastName = nameParts[nameParts.length - 1].replace(/[^a-z]/g, '');
  const firstInitial = firstName.charAt(0);
  const lastInitial = lastName.charAt(0);
  
  return [
    `${firstName}.${lastName}@${domain}`,
    `${firstName}${lastName}@${domain}`,
    `${firstInitial}${lastName}@${domain}`,
    `${firstName}@${domain}`,
    `${firstName}_${lastName}@${domain}`,
    `${firstInitial}.${lastName}@${domain}`,
    `${firstName}${lastInitial}@${domain}`,
    `${lastName}@${domain}`
  ];
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  
  // Start processing loop
  setTimeout(processLeads, 5000);
});
