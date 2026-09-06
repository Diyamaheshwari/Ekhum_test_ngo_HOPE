const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hope_ngo.sqlite');
const FALLBACK_DB_PATH = path.join(__dirname, 'hope_donations_data.json');

let db = null;
let isNativeSqlite = false;

try {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.warn('SQLite init error, fallback to JSON:', err.message);
      initJsonStore();
    } else {
      console.log('Connected to SQLite database at:', DB_PATH);
      isNativeSqlite = true;
      initSqliteSchema();
    }
  });
} catch (e) {
  console.warn('sqlite3 module fallback to JSON file store:', e.message);
  initJsonStore();
}

function initSqliteSchema() {
  const query = `
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id TEXT UNIQUE NOT NULL,
      api_key TEXT DEFAULT 'ek_live_hopehopecamp_367634',
      campaign_slug TEXT DEFAULT 'hope_hopecamp',
      beneficiary_ngo TEXT DEFAULT 'Hope Fund',
      urn_80g TEXT DEFAULT 'AAATC1234F2180G1',
      title TEXT DEFAULT 'Mr.',
      first_name TEXT,
      last_name TEXT,
      donor_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      alt_phone TEXT,
      tax_id TEXT NOT NULL,
      dob TEXT,
      gender TEXT DEFAULT 'Male',
      donor_type TEXT DEFAULT 'Individual',
      citizenship TEXT DEFAULT 'Indian',
      address TEXT NOT NULL,
      street_address_2 TEXT,
      pincode TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'India',
      is_80g_requested INTEGER DEFAULT 1,
      pan_holder_name TEXT,
      certificate_language TEXT DEFAULT 'en',
      is_anonymous INTEGER DEFAULT 0,
      consent_email INTEGER DEFAULT 1,
      consent_whatsapp INTEGER DEFAULT 1,
      consent_sms INTEGER DEFAULT 1,
      preferred_channel TEXT DEFAULT 'both',
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      fundraiser_id TEXT,
      volunteer_code TEXT,
      comments TEXT,
      custom_form_data TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      is_monthly INTEGER DEFAULT 0,
      cause TEXT NOT NULL,
      gateway TEXT DEFAULT 'razorpay',
      fallback_gateway TEXT DEFAULT 'cashfree',
      payment_id TEXT,
      order_id TEXT,
      signature TEXT,
      status TEXT DEFAULT 'completed',
      receipt_80g_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.run(query, (err) => {
    if (err) console.error('Error initializing SQLite schema:', err);
    else console.log('SQLite EKhum Hope Fund Schema initialized.');
  });
}

function initJsonStore() {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify([], null, 2));
  }
}

function getJsonData() {
  try {
    return JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8') || '[]');
  } catch (err) {
    return [];
  }
}

function saveJsonData(data) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
}

const dbLayer = {
  createDonation: (d) => {
    return new Promise((resolve, reject) => {
      const receiptNo = 'HOPE-80G-' + Date.now().toString().slice(-6) + '-' + Math.floor(1000 + Math.random() * 9000);
      const fullName = d.name || d.donor_name || `${d.title || ''} ${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Aarav Sharma';
      
      const record = {
        donation_id: d.donation_id || 'DON-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        api_key: d.apiKey || d.api_key || 'ek_live_hopehopecamp_367634',
        campaign_slug: d.campaignSlug || d.campaign_slug || 'hope_hopecamp',
        beneficiary_ngo: 'Hope Fund',
        urn_80g: 'AAATC1234F2180G1',
        title: d.title || 'Mr.',
        first_name: d.firstName || d.first_name || fullName.split(' ')[0] || '',
        last_name: d.lastName || d.last_name || fullName.split(' ').slice(1).join(' ') || '',
        donor_name: fullName,
        email: d.email || d.donor_email,
        phone: d.phone || d.donor_phone,
        alt_phone: d.altPhone || d.alt_phone || '',
        tax_id: (d.taxId || d.pan_number || d.pan || '').toUpperCase(),
        dob: d.dob || d.birthdate || '',
        gender: d.gender || 'Male',
        donor_type: d.donorType || d.donor_type || 'Individual',
        citizenship: d.citizenship || 'Indian',
        address: d.address || d.street_address_1 || '',
        street_address_2: d.street_address_2 || '',
        pincode: d.pincode || d.zip_code || '',
        city: d.city || '',
        state: d.state || '',
        country: d.country || 'India',
        is_80g_requested: d.is80GRequested !== undefined ? (d.is80GRequested ? 1 : 0) : 1,
        pan_holder_name: d.panHolderName || d.pan_holder_name || fullName,
        certificate_language: d.certificateLanguage || 'en',
        is_anonymous: d.isAnonymous ? 1 : 0,
        consent_email: d.consentEmail !== undefined ? (d.consentEmail ? 1 : 0) : 1,
        consent_whatsapp: d.consentWhatsapp !== undefined ? (d.consentWhatsapp ? 1 : 0) : 1,
        consent_sms: d.consentSms !== undefined ? (d.consentSms ? 1 : 0) : 1,
        preferred_channel: d.preferredChannel || 'both',
        utm_source: d.utm_source || 'direct',
        utm_medium: d.utm_medium || 'web',
        utm_campaign: d.utm_campaign || 'hope_hopecamp',
        fundraiser_id: d.fundraiser_id || '',
        volunteer_code: d.volunteer_code || '',
        comments: d.comments || '',
        custom_form_data: typeof d.customFormData === 'object' ? JSON.stringify(d.customFormData) : (d.custom_form_data || '{}'),
        amount: parseFloat(d.amount),
        currency: d.currency || 'INR',
        is_monthly: d.isMonthly || d.is_monthly ? 1 : 0,
        cause: d.cause || 'Hope Fund Initiative',
        gateway: d.gateway || 'razorpay',
        fallback_gateway: d.fallbackGateway || d.fallback_gateway || 'cashfree',
        payment_id: d.payment_id || 'PAY_' + Date.now(),
        order_id: d.order_id || 'ORD_' + Date.now(),
        signature: d.signature || 'SIG_VERIFIED',
        status: d.status || 'completed',
        receipt_80g_no: receiptNo,
        created_at: new Date().toISOString()
      };

      if (isNativeSqlite && db) {
        const sql = `
          INSERT INTO donations (
            donation_id, api_key, campaign_slug, beneficiary_ngo, urn_80g, title, first_name, last_name,
            donor_name, email, phone, alt_phone, tax_id, dob, gender, donor_type, citizenship,
            address, street_address_2, pincode, city, state, country, is_80g_requested, pan_holder_name,
            certificate_language, is_anonymous, consent_email, consent_whatsapp, consent_sms, preferred_channel,
            utm_source, utm_medium, utm_campaign, fundraiser_id, volunteer_code, comments, custom_form_data,
            amount, currency, is_monthly, cause, gateway, fallback_gateway, payment_id, order_id, signature, status, receipt_80g_no, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;
        db.run(
          sql,
          [
            record.donation_id, record.api_key, record.campaign_slug, record.beneficiary_ngo, record.urn_80g,
            record.title, record.first_name, record.last_name, record.donor_name, record.email, record.phone, record.alt_phone,
            record.tax_id, record.dob, record.gender, record.donor_type, record.citizenship, record.address,
            record.street_address_2, record.pincode, record.city, record.state, record.country, record.is_80g_requested,
            record.pan_holder_name, record.certificate_language, record.is_anonymous, record.consent_email,
            record.consent_whatsapp, record.consent_sms, record.preferred_channel, record.utm_source, record.utm_medium,
            record.utm_campaign, record.fundraiser_id, record.volunteer_code, record.comments, record.custom_form_data,
            record.amount, record.currency, record.is_monthly, record.cause, record.gateway, record.fallback_gateway,
            record.payment_id, record.order_id, record.signature, record.status, record.receipt_80g_no, record.created_at
          ],
          function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, ...record });
          }
        );
      } else {
        const records = getJsonData();
        record.id = records.length + 1;
        records.unshift(record);
        saveJsonData(records);
        resolve(record);
      }
    });
  },

  getAllDonations: (limit = 50) => {
    return new Promise((resolve, reject) => {
      if (isNativeSqlite && db) {
        db.all('SELECT * FROM donations ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      } else {
        const records = getJsonData();
        resolve(records.slice(0, limit));
      }
    });
  },

  getStats: () => {
    return new Promise((resolve, reject) => {
      if (isNativeSqlite && db) {
        const sql = `
          SELECT 
            COUNT(*) as total_donations,
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(DISTINCT email) as unique_donors
          FROM donations
          WHERE status = 'completed'
        `;
        db.get(sql, [], (err, row) => {
          if (err) return reject(err);
          resolve({
            totalDonations: row.total_donations || 0,
            totalAmount: row.total_amount || 0,
            uniqueDonors: row.unique_donors || 0,
            childrenHelped: Math.floor((row.total_amount || 0) / 1000) + 125
          });
        });
      } else {
        const records = getJsonData().filter(r => r.status === 'completed');
        const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        const uniqueDonors = new Set(records.map(r => r.email)).size;
        resolve({
          totalDonations: records.length,
          totalAmount: totalAmount,
          uniqueDonors: uniqueDonors,
          childrenHelped: Math.floor(totalAmount / 1000) + 125
        });
      }
    });
  }
};

module.exports = dbLayer;
