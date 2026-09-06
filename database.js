const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hope_ngo.sqlite');
const FALLBACK_DB_PATH = path.join(__dirname, 'hope_donations_data.json');

let db = null;
let isNativeSqlite = false;

// Attempt to load sqlite3; fallback to JSON file storage if native driver build is absent
try {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.warn('SQLite initialization error, switching to File JSON store:', err.message);
      initJsonStore();
    } else {
      console.log('Connected to SQLite database at:', DB_PATH);
      isNativeSqlite = true;
      initSqliteSchema();
    }
  });
} catch (e) {
  console.warn('sqlite3 module warning:', e.message, '- Using robust JSON file store.');
  initJsonStore();
}

function initSqliteSchema() {
  const query = `
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id TEXT UNIQUE NOT NULL,
      donor_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      age INTEGER NOT NULL,
      pan_number TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      cause TEXT NOT NULL,
      payment_id TEXT,
      order_id TEXT,
      signature TEXT,
      status TEXT DEFAULT 'completed',
      receipt_80g_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.run(query, (err) => {
    if (err) console.error('Error creating SQLite schema:', err);
    else console.log('SQLite Schema initialized successfully.');
  });
}

function initJsonStore() {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify([], null, 2));
  }
}

function getJsonData() {
  try {
    const raw = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

function saveJsonData(data) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
}

// Database Layer API
const dbLayer = {
  createDonation: (donationData) => {
    return new Promise((resolve, reject) => {
      const receiptNo = 'HOPE-80G-' + Date.now().toString().slice(-6) + '-' + Math.floor(1000 + Math.random() * 9000);
      const record = {
        donation_id: donationData.donation_id || 'DON-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        donor_name: donationData.donor_name,
        email: donationData.email,
        phone: donationData.phone,
        address: donationData.address,
        age: parseInt(donationData.age, 10),
        pan_number: donationData.pan_number.toUpperCase(),
        amount: parseFloat(donationData.amount),
        currency: donationData.currency || 'INR',
        cause: donationData.cause || 'General Hope Fund',
        payment_id: donationData.payment_id || 'PAY_TEST_' + Date.now(),
        order_id: donationData.order_id || 'ORD_TEST_' + Date.now(),
        signature: donationData.signature || 'SIG_VERIFIED',
        status: donationData.status || 'completed',
        receipt_80g_no: receiptNo,
        created_at: new Date().toISOString()
      };

      if (isNativeSqlite && db) {
        const sql = `
          INSERT INTO donations 
          (donation_id, donor_name, email, phone, address, age, pan_number, amount, currency, cause, payment_id, order_id, signature, status, receipt_80g_no, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          sql,
          [
            record.donation_id,
            record.donor_name,
            record.email,
            record.phone,
            record.address,
            record.age,
            record.pan_number,
            record.amount,
            record.currency,
            record.cause,
            record.payment_id,
            record.order_id,
            record.signature,
            record.status,
            record.receipt_80g_no,
            record.created_at
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

  getDonationByPaymentId: (paymentId) => {
    return new Promise((resolve, reject) => {
      if (isNativeSqlite && db) {
        db.get('SELECT * FROM donations WHERE payment_id = ? OR donation_id = ?', [paymentId, paymentId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      } else {
        const records = getJsonData();
        const found = records.find(r => r.payment_id === paymentId || r.donation_id === paymentId);
        resolve(found || null);
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
            childrenHelped: Math.floor((row.total_amount || 0) / 1000) + 125 // Includes baseline community impact
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
