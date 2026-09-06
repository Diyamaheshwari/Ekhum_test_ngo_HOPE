require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const dbLayer = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Razorpay Key Credentials
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || null;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || null;

let razorpayInstance = null;
if (razorpayKeyId && razorpayKeySecret) {
  try {
    razorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });
    console.log('Razorpay Gateway initialized with LIVE/TEST Key ID:', razorpayKeyId);
  } catch (err) {
    console.warn('Razorpay SDK init fallback:', err.message);
  }
}

// EKhum Campaign Metadata
const EKHUM_CONFIG = {
  apiKey: process.env.EKHUM_API_KEY || 'ek_live_hopehopecamp_367634',
  campaignSlug: 'hope_hopecamp',
  ngoName: 'Hope Fund',
  urn80G: 'AAATC1234F2180G1',
  primaryGateway: 'razorpay',
  fallbackGateway: 'cashfree',
  enableAutoFailover: true
};

// Validation Helper
function validateDonorData(data) {
  const errors = [];
  const fullName = data.name || data.donor_name || `${data.title || ''} ${data.first_name || ''} ${data.last_name || ''}`.trim();
  const email = data.email || data.donor_email;
  const phone = data.phone || data.donor_phone;
  const address = data.address || data.street_address_1;
  const pan = data.taxId || data.pan_number || data.donor_pan;
  const amount = data.amount;

  if (!fullName || fullName.length < 2) {
    errors.push('Full Name / Donor Name is required (minimum 2 characters).');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid Email address is required.');
  }
  if (!phone || !/^[0-9+\s\-]{8,15}$/.test(phone)) {
    errors.push('A valid Contact Phone Number is required.');
  }
  if (!address || address.trim().length < 5) {
    errors.push('Full Postal Address is required for statutory 80G tax receipt issuance.');
  }
  if (!pan || !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(pan.trim())) {
    errors.push('Valid 10-character PAN Card Number (e.g. ABCDE1234F) is mandatory for 80G tax benefit calculation.');
  }
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    errors.push('Donation amount must be greater than zero.');
  }
  return errors;
}

// API Route: Public Config
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    ngoName: EKHUM_CONFIG.ngoName,
    urn80G: EKHUM_CONFIG.urn80G,
    apiKey: EKHUM_CONFIG.apiKey,
    campaignSlug: EKHUM_CONFIG.campaignSlug,
    razorpayKeyId: razorpayKeyId,
    gateway: EKHUM_CONFIG.primaryGateway,
    fallbackGateway: EKHUM_CONFIG.fallbackGateway,
    enableAutoFailover: EKHUM_CONFIG.enableAutoFailover,
    isSimulationMode: !razorpayInstance,
    currency: 'INR',
    taxExemption80G: true
  });
});

// Health Check for Render
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Hope Fund — EKhum Gateway API',
    campaign: EKHUM_CONFIG.campaignSlug,
    urn80G: EKHUM_CONFIG.urn80G,
    timestamp: new Date().toISOString()
  });
});

// API Route: Create Payment Order
app.post('/api/donations/create-order', async (req, res) => {
  try {
    const donorData = req.body;
    const errors = validateDonorData(donorData);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const amountInPaisa = Math.round(parseFloat(donorData.amount) * 100);
    const currency = donorData.currency || 'INR';
    const orderReceipt = 'rcpt_hope_' + Date.now().toString().slice(-8);

    if (razorpayInstance) {
      try {
        const order = await razorpayInstance.orders.create({
          amount: amountInPaisa,
          currency: currency,
          receipt: orderReceipt,
          notes: {
            campaign: EKHUM_CONFIG.campaignSlug,
            donor_name: donorData.name || donorData.donor_name,
            email: donorData.email,
            pan: donorData.taxId || donorData.pan_number
          }
        });
        return res.json({
          success: true,
          isSimulation: false,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: razorpayKeyId,
          gateway: EKHUM_CONFIG.primaryGateway,
          fallbackGateway: EKHUM_CONFIG.fallbackGateway
        });
      } catch (err) {
        console.warn('Razorpay order creation error:', err.message);
      }
    }

    const simulatedOrderId = 'order_sim_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    return res.json({
      success: true,
      isSimulation: true,
      orderId: simulatedOrderId,
      amount: amountInPaisa,
      currency: currency,
      key: razorpayKeyId || 'rzp_test_hope_fund',
      gateway: EKHUM_CONFIG.primaryGateway,
      fallbackGateway: EKHUM_CONFIG.fallbackGateway
    });
  } catch (error) {
    console.error('Error creating donation order:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
});

// API Route: Verify Payment & Store Record
app.post(['/api/donations/verify', '/api/v1/external/donations/initiate'], async (req, res) => {
  try {
    const payload = req.body;
    const errors = validateDonorData(payload);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Save full KYC and CRM data layer in SQLite
    const donationRecord = await dbLayer.createDonation(payload);

    res.json({
      success: true,
      message: 'Thank you for supporting Hope Fund!',
      receiptNumber: donationRecord.receipt_80g_no,
      urn80G: EKHUM_CONFIG.urn80G,
      donation: donationRecord,
      receiptUrl: `/api/donations/receipt/${donationRecord.receipt_80g_no}`
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record donation verification.' });
  }
});

// API Route: Get Recent Donations
app.get('/api/donations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const records = await dbLayer.getAllDonations(limit);
    const sanitized = records.map(r => ({
      id: r.id,
      donation_id: r.donation_id,
      donor_name: r.donor_name,
      amount: r.amount,
      currency: r.currency,
      cause: r.cause,
      urn_80g: r.urn_80g,
      receipt_80g_no: r.receipt_80g_no,
      created_at: r.created_at,
      masked_email: r.email ? r.email.replace(/(.{2})(.*)(?=@)/, '$1***') : '***',
      masked_pan: r.tax_id ? r.tax_id.slice(0, 2) + '****' + r.tax_id.slice(-2) : '*****'
    }));
    res.json({ success: true, count: sanitized.length, donations: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch donations feed.' });
  }
});

// API Route: Stats
app.get('/api/donations/stats', async (req, res) => {
  try {
    const stats = await dbLayer.getStats();
    res.json({ success: true, stats, urn80G: EKHUM_CONFIG.urn80G });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not calculate statistics.' });
  }
});

// API Route: Receipt
app.get('/api/donations/receipt/:receiptNo', async (req, res) => {
  try {
    const { receiptNo } = req.params;
    const donations = await dbLayer.getAllDonations(500);
    const donation = donations.find(d => d.receipt_80g_no === receiptNo || d.donation_id === receiptNo || String(d.id) === receiptNo);

    if (!donation) {
      return res.status(404).json({ success: false, message: 'Tax receipt record not found.' });
    }

    res.json({
      success: true,
      receipt: {
        receiptNumber: donation.receipt_80g_no,
        ngoName: 'Hope Fund',
        urn80G: 'AAATC1234F2180G1',
        campaignSlug: donation.campaign_slug,
        donorTitle: donation.title,
        donorName: donation.donor_name,
        donorEmail: donation.email,
        donorPhone: donation.phone,
        donorAltPhone: donation.alt_phone,
        donorPan: donation.tax_id,
        donorDob: donation.dob,
        donorGender: donation.gender,
        donorAddress: `${donation.address}, ${donation.street_address_2 || ''}, ${donation.city || ''}, ${donation.state || ''} - ${donation.pincode || ''}, ${donation.country}`,
        amount: donation.amount,
        currency: donation.currency,
        isMonthly: Boolean(donation.is_monthly),
        cause: donation.cause,
        gateway: donation.gateway,
        paymentId: donation.payment_id,
        date: donation.created_at,
        taxDeductionPercent: '50% Tax Exemption under Statutory 80G URN: AAATC1234F2180G1'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving 80G receipt.' });
  }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌟 Hope Fund — EKhum Gateway API running on port ${PORT}`);
  console.log(`🔑 Campaign API Key: ${EKHUM_CONFIG.apiKey}`);
  console.log(`📜 Statutory 80G URN: ${EKHUM_CONFIG.urn80G}`);
  console.log(`💳 Aligned Gateway Rails: Razorpay & Cashfree`);
  console.log(`====================================================`);
});
