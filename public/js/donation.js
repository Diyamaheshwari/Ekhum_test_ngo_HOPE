// =========================================================================
// 🏛️ BENEFICIARY NGO: Hope Fund (Hope Fund)
// 🎯 CAMPAIGN: Hope (/hope_hopecamp)
// 🔑 CAMPAIGN API KEY: ek_live_hopehopecamp_367634
// 💳 PRIMARY GATEWAY: RAZORPAY (Razorpay Key: rzp_test_TYgiRFkvuT45sT)
// 🔄 FAILOVER GATEWAY: CASHFREE (Cashfree App ID: TEST11030636b10f78ed81182b583c4c63603011)
// 🏢 NGO MASTER TOKEN: ek_live_ff965fc9baa3d65a9e474d7ebf424b61
// 💳 ALIGNED GATEWAY RAILS: Razorpay Gateway Rail, Cashfree UPI Intent Rail
// 📜 80G REGISTRATION URN: AAATC1234F2180G1
// ⚡ REAL-TIME WEBSOCKET FEED: Enabled
// =========================================================================

// EKhum Backend API Base URL (Change to your production API domain if different)
const EKHUM_API_BASE = window.EKHUM_API_BASE || 'https://api.ekhum.org';

// Initialize EKhum v2 SDK Engine with Real-Time Event Bus
if (typeof window.EKhum === 'undefined' || !window.EKhum._isLoaded) {
  const listeners = {};

  window.EKhum = {
    _isLoaded: true,
    _listeners: listeners,

    on: function (eventName, callback) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(callback);
      console.log(`⚡ Registered EKhum Event listener for: ${eventName}`);
      return window.EKhum;
    },

    emit: function (eventName, data) {
      if (listeners[eventName]) {
        listeners[eventName].forEach(fn => {
          try { fn(data); } catch (e) { console.warn(e); }
        });
      }
      if (listeners['*']) {
        listeners['*'].forEach(fn => {
          try { fn(eventName, data); } catch (e) { console.warn(e); }
        });
      }
    },

    pay: async function (options) {
      console.log('⚡ EKhum.pay() invoked for Campaign:', options.campaignSlug, options);

      const opts = options || {};
      const apiKey = opts.apiKey || 'ek_live_hopehopecamp_367634';
      const campaignSlug = opts.campaignSlug || 'hope_hopecamp';

      const alertBox = document.getElementById('formAlertBox');
      if (alertBox) alertBox.classList.add('d-none');

      const submitBtn = document.getElementById('btnSubmitDonation');
      const origText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting Payment Gateway...';
      }

      try {
        // Step 1: Initiate Transaction via EKhum Backend API
        const initiatePayload = {
          api_key: apiKey,
          campaignSlug: campaignSlug,
          amount: Number(opts.amount || 1000),
          currency: (opts.currency || 'INR').toUpperCase(),
          title: opts.title || 'Mr.',
          first_name: opts.firstName || 'Aarav',
          last_name: opts.lastName || 'Sharma',
          name: opts.name || (`${opts.firstName || ''} ${opts.lastName || ''}`.trim()) || 'Aarav Sharma',
          email: opts.email || 'aarav.sharma@example.com',
          phone: opts.phone || '+919876543210',
          alt_phone: opts.altPhone || '',
          taxId: opts.taxId || opts.pan || 'ABCDE1234F',
          birthdate: opts.dob || '1988-04-15',
          gender: opts.gender || 'Male',
          donor_type: opts.donorType || 'Individual',
          citizenship: opts.citizenship || 'Indian',
          street_address_1: opts.address || 'Flat 402, Lotus Heights, MG Road',
          street_address_2: opts.street_address_2 || '',
          pincode: opts.pincode || '400001',
          city: opts.city || 'Mumbai',
          state: opts.state || 'Maharashtra',
          country: opts.country || 'India',
          is_80g_requested: opts.is80GRequested !== undefined ? opts.is80GRequested : true,
          pan_holder_name: opts.panHolderName || opts.name || 'Aarav Sharma',
          is_monthly: Boolean(opts.isMonthly),
          payment_type: opts.isMonthly ? 'monthly_donation' : 'one_time',
          interval: opts.isMonthly ? 'monthly' : 'one_time',
          requestedGateway: opts.gateway || 'razorpay',
          fallback_gateway: opts.fallbackGateway || 'cashfree',
          enable_auto_failover: opts.enableAutoFailover !== undefined ? opts.enableAutoFailover : true,
          consent_email: opts.consentEmail ?? true,
          consent_whatsapp: opts.consentWhatsapp ?? true,
          consent_sms: opts.consentSms ?? true,
          comments: opts.comments || 'Donation in support of Hope for Hope Fund',
          utm_source: opts.utm_source || 'direct',
          utm_medium: opts.utm_medium || 'web',
          utm_campaign: opts.utm_campaign || campaignSlug,
          fundraiser_id: opts.fundraiser_id,
          volunteer_code: opts.volunteer_code,
          landing_page_url: window.location.href,
          referrer: document.referrer || '',
          customFormData: opts.customFormData || {}
        };

        const res = await fetch(`${EKHUM_API_BASE}/api/v1/external/donations/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ekhum-api-key': apiKey
          },
          body: JSON.stringify(initiatePayload)
        });

        const orderRes = await res.json();
        if (!orderRes.success) {
          const errMsg = orderRes.error || orderRes.message || (orderRes.errors ? orderRes.errors.join(', ') : 'Order creation failed.');
          if (opts.onError) opts.onError({ error: errMsg });
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
          return;
        }

        const donationId = orderRes.donationId;
        const activeGateway = (orderRes.gateway || opts.gateway || 'razorpay').toLowerCase();
        const razorpayKey = (orderRes.checkoutPayload && orderRes.checkoutPayload.keyId) || orderRes.keyId || 'rzp_test_TYgiRFkvuT45sT';

        // Step 2: Launch Payment Gateway Modal
        if (activeGateway === 'razorpay' && typeof window.Razorpay !== 'undefined') {
          const rzpOptions = {
            key: razorpayKey,
            amount: (orderRes.checkoutPayload && orderRes.checkoutPayload.amountPaise) || Math.round(Number(initiatePayload.amount) * 100),
            currency: initiatePayload.currency,
            name: (orderRes.organization && orderRes.organization.name) || 'Hope Fund',
            description: `Campaign: Hope (/hope_hopecamp)`,
            order_id: orderRes.orderId && !orderRes.orderId.startsWith('order_ek_ext_') && !orderRes.orderId.startsWith('order_sim_') ? orderRes.orderId : undefined,
            prefill: {
              name: initiatePayload.name,
              email: initiatePayload.email,
              contact: initiatePayload.phone
            },
            notes: {
              donation_id: donationId,
              campaign_slug: campaignSlug,
              pan: initiatePayload.taxId,
              urn_80g: 'AAATC1234F2180G1'
            },
            theme: { color: '#E05A47' },
            handler: async function (razorpayResponse) {
              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying Payment & Generating 80G Receipt...';
              }
              await executeEKhumVerification({
                donationId: donationId,
                orderId: razorpayResponse.razorpay_order_id || orderRes.orderId,
                paymentGateway: 'razorpay',
                razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                razorpayOrderId: razorpayResponse.razorpay_order_id || orderRes.orderId,
                razorpaySignature: razorpayResponse.razorpay_signature,
                name: initiatePayload.name,
                email: initiatePayload.email,
                phone: initiatePayload.phone,
                taxId: initiatePayload.taxId,
                amount: initiatePayload.amount,
                currency: initiatePayload.currency,
                campaignSlug: campaignSlug,
                apiKey: apiKey,
                customFormData: initiatePayload.customFormData
              }, opts);
            },
            modal: {
              ondismiss: function () {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
                fetch(`${EKHUM_API_BASE}/api/v1/external/donations/fail`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-ekhum-api-key': apiKey },
                  body: JSON.stringify({ donationId: donationId, gateway: 'razorpay', reason: 'Modal closed by donor' })
                }).catch(() => {});
                if (opts.onError) opts.onError({ error: 'Payment transaction cancelled by donor' });
              }
            }
          };

          const rzp = new window.Razorpay(rzpOptions);
          rzp.open();
        } else if (activeGateway === 'cashfree' && typeof window.Cashfree !== 'undefined') {
          const cashfree = window.Cashfree({ mode: 'sandbox' });
          cashfree.checkout({
            paymentSessionId: (orderRes.checkoutPayload && orderRes.checkoutPayload.paymentSessionId) || orderRes.orderId,
            redirectTarget: '_modal'
          }).then(async function (cfResult) {
            if (cfResult && cfResult.error) {
              if (opts.onError) opts.onError({ error: cfResult.error.message });
            } else {
              await executeEKhumVerification({
                donationId: donationId,
                orderId: orderRes.orderId,
                paymentGateway: 'cashfree',
                cashfreePaymentId: (cfResult && cfResult.paymentDetails && cfResult.paymentDetails.paymentId) || ('pay_cf_' + Date.now()),
                name: initiatePayload.name,
                email: initiatePayload.email,
                phone: initiatePayload.phone,
                taxId: initiatePayload.taxId,
                amount: initiatePayload.amount,
                currency: initiatePayload.currency,
                campaignSlug: campaignSlug,
                apiKey: apiKey,
                customFormData: initiatePayload.customFormData
              }, opts);
            }
          });
        } else {
          // Direct fallback simulation verification for sandbox environments
          await executeEKhumVerification({
            donationId: donationId,
            orderId: orderRes.orderId,
            paymentGateway: activeGateway,
            razorpayPaymentId: 'pay_sim_' + Date.now(),
            name: initiatePayload.name,
            email: initiatePayload.email,
            phone: initiatePayload.phone,
            taxId: initiatePayload.taxId,
            amount: initiatePayload.amount,
            currency: initiatePayload.currency,
            campaignSlug: campaignSlug,
            apiKey: apiKey,
            customFormData: initiatePayload.customFormData
          }, opts);
        }
      } catch (err) {
        console.error('Payment Initialization Error:', err);
        if (opts.onError) opts.onError({ error: err.message });
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
      }
    },

    autoBind: function (formSelector, config) {
      const form = document.querySelector(formSelector);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          handleDonateSubmit();
        });
      }
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Uppercase PAN input automatically
  const panInput = document.getElementById('donor_pan');
  if (panInput) {
    panInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      const panHolder = document.getElementById('pan_holder_name');
      const firstName = document.getElementById('donor_first_name')?.value || '';
      const lastName = document.getElementById('donor_last_name')?.value || '';
      if (panHolder && (!panHolder.value || panHolder.value === 'Aarav Sharma')) {
        panHolder.value = `${firstName} ${lastName}`.trim();
      }
    });
  }

  // Update Full Name binding dynamically
  const firstNameInput = document.getElementById('donor_first_name');
  const lastNameInput = document.getElementById('donor_last_name');
  const fullNameInput = document.getElementById('donor_name');

  function syncFullName() {
    if (fullNameInput) {
      fullNameInput.value = `${firstNameInput?.value || ''} ${lastNameInput?.value || ''}`.trim();
    }
  }

  if (firstNameInput) firstNameInput.addEventListener('input', syncFullName);
  if (lastNameInput) lastNameInput.addEventListener('input', syncFullName);
});

// Client Validation Helper
function validateEKhumForm() {
  const errors = [];
  const firstName = document.getElementById('donor_first_name')?.value.trim();
  const lastName = document.getElementById('donor_last_name')?.value.trim();
  const email = document.getElementById('donor_email')?.value.trim();
  const phone = document.getElementById('donor_phone')?.value.trim();
  const pan = document.getElementById('donor_pan')?.value.trim().toUpperCase();
  const address = document.getElementById('donor_address')?.value.trim();
  const pincode = document.getElementById('donor_pincode')?.value.trim();
  const amount = document.getElementById('donation_amount')?.value || document.getElementById('selectedAmount')?.value;

  if (!firstName || !lastName) {
    errors.push('First Name and Last Name are required.');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid Email address is required.');
  }

  if (!phone || !/^[0-9+\s\-]{8,15}$/.test(phone)) {
    errors.push('A valid Contact Phone number is required.');
  }

  const panRegex = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/;
  if (!pan || !panRegex.test(pan)) {
    errors.push('Valid 10-digit PAN (taxId e.g. ABCDE1234F) is mandatory for Statutory 80G Receipt.');
  }

  if (!address || address.length < 5) {
    errors.push('Address Line 1 is required.');
  }

  if (!pincode || pincode.length < 6) {
    errors.push('Valid 6-digit Indian Pincode is required.');
  }

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    errors.push('Valid donation amount is required.');
  }

  return errors;
}

// 2. Call EKhum.pay() on your Submit/Donate button click
function handleDonateSubmit() {
  const alertBox = document.getElementById('formAlertBox');
  if (alertBox) alertBox.classList.add('d-none');

  const validationErrors = validateEKhumForm();
  if (validationErrors.length > 0) {
    alertBox.innerHTML = '<strong><i class="fa-solid fa-triangle-exclamation"></i> Please fix the following errors:</strong><ul>' +
      validationErrors.map(err => `<li>${err}</li>`).join('') + '</ul>';
    alertBox.classList.remove('d-none');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  EKhum.pay({
    // 🔑 Specific Campaign Credentials
    apiKey: "ek_live_hopehopecamp_367634",
    campaignSlug: "hope_hopecamp",

    // 💳 Multi-Gateway Smart Failover Engine
    gateway: "razorpay", // Primary Aligned Rail (Razorpay Gateway Rail)
    fallbackGateway: "cashfree", // Automatic Failover Rail
    enableAutoFailover: true,

    // 💰 Donation & Frequency Data Layer
    amount: document.getElementById('donation_amount')?.value || 1000,
    currency: "INR",
    isMonthly: document.getElementById('is_monthly')?.checked || false,

    // 👤 Full Contact KYC Layer (Upserted into Hope Fund's CRM)
    title: document.getElementById('donor_title')?.value || "Mr.",
    firstName: document.getElementById('donor_first_name')?.value || "Aarav",
    lastName: document.getElementById('donor_last_name')?.value || "Sharma",
    name: document.getElementById('donor_name')?.value || "Aarav Sharma",
    email: document.getElementById('donor_email')?.value || "aarav.sharma@example.com",
    phone: document.getElementById('donor_phone')?.value || "+919876543210",
    altPhone: document.getElementById('donor_alt_phone')?.value || "",
    taxId: document.getElementById('donor_pan')?.value || "ABCDE1234F",
    dob: document.getElementById('donor_dob')?.value || "1988-04-15",
    gender: document.getElementById('donor_gender')?.value || "Male",
    donorType: "Individual",
    citizenship: "Indian",

    // 📍 Full Address Data Layer
    address: document.getElementById('donor_address')?.value || "Flat 402, Lotus Heights, MG Road",
    street_address_2: document.getElementById('donor_address_line_2')?.value || "Near Metro Station",
    pincode: document.getElementById('donor_pincode')?.value || "400001",
    city: document.getElementById('donor_city')?.value || "Mumbai",
    state: document.getElementById('donor_state')?.value || "Maharashtra",
    country: "India",

    // 📜 Statutory 80G Tax Exemption & Form 10BD Flags
    is80GRequested: true,
    panHolderName: document.getElementById('pan_holder_name')?.value || "Aarav Sharma",
    certificateLanguage: "en",
    isAnonymous: false,

    // 🛡️ DPDP Act Opt-In Consents
    consentEmail: document.getElementById('consent_email')?.checked ?? true,
    consentWhatsapp: document.getElementById('consent_whatsapp')?.checked ?? true,
    consentSms: document.getElementById('consent_sms')?.checked ?? true,
    preferredChannel: "both",

    // 📣 Marketing Attribution & Campaign Telemetry
    utm_source: new URLSearchParams(window.location.search).get('utm_source') || "google_ads",
    utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || "cpc",
    utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || "hope_hopecamp",
    fundraiser_id: new URLSearchParams(window.location.search).get('fundraiser_id') || undefined,
    volunteer_code: new URLSearchParams(window.location.search).get('vol_code') || undefined,

    // 💬 Donor Comments & Tailored Campaign Custom Fields
    comments: document.getElementById('donor_comments')?.value || "Donation in support of Hope for Hope Fund",
    customFormData: {
      campaign_title: "Hope",
      ngo_beneficiary: "Hope Fund",
      tshirt_size: document.getElementById('tshirt_size')?.value || "L",
      source_landing_page: window.location.href,
      referrer: document.referrer
    },

    // Callbacks
    onSuccess: function(res) {
      console.log("EKhum Donation Success for Hope:", res);
      const receiptNo = res.receiptNumber || (res.donation && res.donation.receiptNumber) || 'REC-SUCCESS';
      alert("🎉 Thank you for supporting Hope Fund!\n\n80G Tax Receipt: " + receiptNo + "\nStatutory 80G URN: AAATC1234F2180G1");
      show80GReceiptModal(res);
      if (typeof fetchStats === 'function') fetchStats();
      if (typeof fetchLiveDonors === 'function') fetchLiveDonors();
    },
    onError: function(err) {
      console.error("EKhum Donation Error:", err);
      alert("Donation to Hope Failed: " + (err.error || err.message || "Transaction cancelled"));
    }
  });
}

// Step 3: Complete Payment Verification Pipeline with EKhum Backend
async function executeEKhumVerification(payload, callbacks) {
  const submitBtn = document.getElementById('btnSubmitDonation');
  try {
    const res = await fetch(`${EKHUM_API_BASE}/api/v1/external/donations/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ekhum-api-key': payload.apiKey || 'ek_live_hopehopecamp_367634'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success || data.verified) {
      if (window.EKhum && typeof window.EKhum.emit === 'function') {
        window.EKhum.emit('payment.success', {
          success: true,
          amount: data.amount || payload.amount,
          paymentId: data.transactionId || payload.razorpayPaymentId || payload.payment_id,
          receiptNumber: data.receiptNumber,
          campaign: payload.campaignSlug || 'hope_hopecamp'
        });
        window.EKhum.emit('receipt.generated', {
          receiptNumber: data.receiptNumber,
          receiptPdfUrl: data.receiptPdfUrl || data.receiptUrl,
          urn80G: 'AAATC1234F2180G1'
        });
      }

      if (callbacks && callbacks.onSuccess) {
        callbacks.onSuccess(data);
      } else {
        show80GReceiptModal(data);
      }
    } else {
      const errMsg = data.error || data.message || 'Payment verification failed.';
      if (callbacks && callbacks.onError) {
        callbacks.onError({ error: errMsg });
      }
    }
  } catch (err) {
    if (callbacks && callbacks.onError) {
      callbacks.onError({ error: err.message || 'Network error during verification' });
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-heart me-2"></i>Donate Now';
    }
  }
}

// Display Receipt Modal with safe element access and complete property coalescing
function show80GReceiptModal(res) {
  if (!res) return;

  const donation = res.donation || res;
  const donor = res.donor || donation.donor || {};

  const recNumber = document.getElementById('recNumber');
  if (recNumber) {
    recNumber.textContent = res.receiptNumber || donation.receipt_80g_no || donation.receiptNumber || donation.receipt_number || 'HOPE-80G-984201';
  }

  const recDate = document.getElementById('recDate');
  if (recDate) {
    recDate.textContent = `Date: ${new Date(donation.created_at || donation.createdAt || Date.now()).toLocaleDateString('en-IN')}`;
  }

  const recDonorName = document.getElementById('recDonorName');
  if (recDonorName) {
    recDonorName.textContent = donor.name || donation.donor_name || donation.name || 'Valued Donor';
  }

  const recDonorPan = document.getElementById('recDonorPan');
  if (recDonorPan) {
    recDonorPan.textContent = donor.taxId || donation.tax_id || donation.pan_number || donation.taxId || 'PAN on file';
  }

  const recDonorContact = document.getElementById('recDonorContact');
  if (recDonorContact) {
    const email = donor.email || donation.email || '';
    const phone = donor.phone || donation.phone || '';
    recDonorContact.textContent = `${email} | ${phone}`.trim().replace(/^\||\|$/g, '') || 'Contact on file';
  }

  const recDonorDob = document.getElementById('recDonorDob');
  if (recDonorDob) {
    recDonorDob.textContent = `${donation.dob || donation.birthdate || '1988-04-15'} (${donation.gender || 'Male'})`;
  }

  const recDonorAddress = document.getElementById('recDonorAddress');
  if (recDonorAddress) {
    const addr = donation.address || donation.street_address_1 || '';
    const city = donation.city || '';
    const state = donation.state || '';
    const pin = donation.pincode || donation.zip_code || '';
    recDonorAddress.textContent = `${addr}, ${city}, ${state} - ${pin}`.replace(/^,\s*|,\s*$/g, '');
  }

  const recCause = document.getElementById('recCause');
  if (recCause) {
    recCause.textContent = `${donation.cause || 'Hope Fund'} / ${(res.paymentGateway || donation.gateway || 'Razorpay').toUpperCase()} Rail`;
  }

  const recPaymentId = document.getElementById('recPaymentId');
  if (recPaymentId) {
    recPaymentId.textContent = res.transactionId || donation.payment_id || donation.gateway_transaction_id || donation.paymentId || 'PAY_VERIFIED';
  }

  const recAmount = document.getElementById('recAmount');
  if (recAmount) {
    const rawAmt = res.amount || donation.amount || 1000;
    recAmount.textContent = `₹ ${parseFloat(rawAmt).toLocaleString('en-IN')}.00`;
  }

  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('d-none');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.add('d-none');
}

function printReceipt() {
  window.print();
}