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

// Razorpay SDK Client Initialization (Supports test & live keys)
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_HOPE_NGO_MOCK';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || null;

let razorpayInstance = null;
if (razorpayKeySecret && razorpayKeyId !== 'rzp_test_HOPE_NGO_MOCK') {
  try {
    razorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });
    console.log('Razorpay Gateway initialized in LIVE/TEST mode with provided credentials.');
  } catch (err) {
    console.warn('Razorpay SDK init fallback:', err.message);
  }
}

// Validation Helper for Mandatory Donor Data
function validateDonorData(data) {
  const errors = [];
  if (!data.donor_name || data.donor_name.trim().length < 2) {
    errors.push('Full Name is required and must be at least 2 characters.');
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('A valid Email address is required.');
  }
  if (!data.phone || !/^[0-9+\s\-]{8,15}$/.test(data.phone)) {
    errors.push('A valid Contact Number is required.');
  }
  if (!data.address || data.address.trim().length < 5) {
    errors.push('Full Address is required.');
  }
  if (!data.age || isNaN(data.age) || parseInt(data.age) < 18 || parseInt(data.age) > 120) {
    errors.push('Age is required and must be at least 18 years old.');
  }
  if (!data.pan_number || !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(data.pan_number.trim())) {
    errors.push('Valid 10-character PAN Card Number (e.g. ABCDE1234F) is required for 80G tax receipt compliance.');
  }
  if (!data.amount || isNaN(data.amount) || parseFloat(data.amount) <= 0) {
    errors.push('Donation amount must be greater than zero.');
  }
  return errors;
}

// API Route: Public Config
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    ngoName: 'FOR THE HOPE Foundation',
    razorpayKeyId: razorpayKeyId,
    isSimulationMode: !razorpayInstance,
    currency: 'INR',
    taxExemption80G: true
  });
});

// API Route: Health Check for Render deployment
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'FOR THE HOPE NGO API & Web Service',
    uptime: process.uptime(),
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
    const orderReceipt = 'rcpt_' + Date.now().toString().slice(-8);

    if (razorpayInstance) {
      // Real Razorpay Order Creation
      const options = {
        amount: amountInPaisa,
        currency: currency,
        receipt: orderReceipt,
        notes: {
          donor_name: donorData.donor_name,
          email: donorData.email,
          pan: donorData.pan_number,
          cause: donorData.cause || 'General Fund'
        }
      };

      const order = await razorpayInstance.orders.create(options);
      return res.json({
        success: true,
        isSimulation: false,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: razorpayKeyId
      });
    } else {
      // Simulation / Direct Gateway Sandbox Mode
      const simulatedOrderId = 'order_sim_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      return res.json({
        success: true,
        isSimulation: true,
        orderId: simulatedOrderId,
        amount: amountInPaisa,
        currency: currency,
        key: razorpayKeyId
      });
    }
  } catch (error) {
    console.error('Error creating donation order:', error);
    res.status(500).json({ success: false, message: 'Failed to create donation payment order.' });
  }
});

// API Route: Verify Payment and Record Donor Entry
app.post('/api/donations/verify', async (req, res) => {
  try {
    const {
      donor_name,
      email,
      phone,
      address,
      age,
      pan_number,
      amount,
      cause,
      payment_id,
      order_id,
      signature
    } = req.body;

    const validationErrors = validateDonorData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, errors: validationErrors });
    }

    // Verify Payment Signature if live Razorpay keys are provided
    let verified = true;
    if (razorpayInstance && razorpayKeySecret && signature && !order_id.startsWith('order_sim_')) {
      const generated_signature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(order_id + '|' + payment_id)
        .digest('hex');

      if (generated_signature !== signature) {
        verified = false;
        return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
      }
    }

    // Store Donor Record in SQLite / Data Layer
    const donationRecord = await dbLayer.createDonation({
      donor_name,
      email,
      phone,
      address,
      age,
      pan_number,
      amount,
      cause: cause || 'General Hope Fund',
      payment_id: payment_id || 'pay_sim_' + Date.now(),
      order_id: order_id || 'ord_sim_' + Date.now(),
      signature: signature || 'simulated_valid_signature',
      status: 'completed'
    });

    res.json({
      success: true,
      message: 'Thank you! Your donation to FOR THE HOPE has been processed successfully.',
      donation: donationRecord,
      receiptUrl: `/api/donations/receipt/${donationRecord.receipt_80g_no}`
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Failed to process donor verification.' });
  }
});

// API Route: Get Recent Donations Ticker & Public Feed
app.get('/api/donations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const records = await dbLayer.getAllDonations(limit);
    // Sanitize records for public display (mask sensitive PAN & full address for privacy)
    const sanitized = records.map(r => ({
      id: r.id,
      donation_id: r.donation_id,
      donor_name: r.donor_name,
      amount: r.amount,
      currency: r.currency,
      cause: r.cause,
      receipt_80g_no: r.receipt_80g_no,
      created_at: r.created_at,
      masked_email: r.email ? r.email.replace(/(.{2})(.*)(?=@)/, '$1***') : '***',
      masked_pan: r.pan_number ? r.pan_number.slice(0, 2) + '****' + r.pan_number.slice(-2) : '*****'
    }));
    res.json({ success: true, count: sanitized.length, donations: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch donations feed.' });
  }
});

// API Route: Aggregate Stats for Hero Counters
app.get('/api/donations/stats', async (req, res) => {
  try {
    const stats = await dbLayer.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not calculate impact statistics.' });
  }
});

// API Route: 80G Tax Exemption Receipt Details
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
        ngoName: 'FOR THE HOPE FOUNDATION',
        ngoRegistrationNo: '80G/REG/HOPE/2026/0942',
        panNgo: 'AAATF9842H',
        donorName: donation.donor_name,
        donorEmail: donation.email,
        donorPhone: donation.phone,
        donorAddress: donation.address,
        donorAge: donation.age,
        donorPan: donation.pan_number,
        amount: donation.amount,
        currency: donation.currency,
        cause: donation.cause,
        paymentId: donation.payment_id,
        date: donation.created_at,
        taxDeductionPercent: '50% under Section 80G of Income Tax Act 1961'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving 80G receipt.' });
  }
});

// Catch-all to serve index.html for single page layout
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌟 FOR THE HOPE NGO Platform is running on port ${PORT}`);
  console.log(`🌐 Public Landing Page: http://localhost:${PORT}`);
  console.log(`💳 Razorpay Integration Mode: ${razorpayInstance ? 'LIVE API KEY CONNECTED' : 'SANDBOX / SIMULATED MODE'}`);
  console.log(`====================================================`);
});
