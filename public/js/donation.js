// EKhum External Landing Page API & Embed Integration Engine

// Initialize EKhum SDK Engine if external embed.js is loading or offline
if (typeof window.EKhum === 'undefined') {
  window.EKhum = {
    pay: async function (options) {
      console.log('EKhum.pay() invoked for Campaign:', options.campaignSlug, options);
      
      const payload = { ...options };
      const alertBox = document.getElementById('formAlertBox');
      if (alertBox) alertBox.classList.add('d-none');

      const submitBtn = document.getElementById('btnSubmitDonation');
      const origText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Initiating EKhum Gateway...';
      }

      try {
        // Step 1: Request Order Creation via Backend
        const res = await fetch('/api/donations/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const orderRes = await res.json();
        if (!orderRes.success) {
          const errMsg = orderRes.errors ? orderRes.errors.join(', ') : 'Order creation failed.';
          if (options.onError) options.onError({ error: errMsg });
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
          return;
        }

        const rzpKey = orderRes.key || 'rzp_test_1DP5mmOlF5G5ag';
        const rzpAmount = orderRes.amount || Math.round(parseFloat(payload.amount) * 100);

        // Step 2: Trigger Razorpay Checkout SDK Modal
        if (typeof Razorpay !== 'undefined') {
          const rzpOptions = {
            key: rzpKey,
            amount: rzpAmount,
            currency: payload.currency || 'INR',
            name: 'Hope Fund',
            description: `Campaign: Hope (/hope_hopecamp)`,
            order_id: orderRes.orderId,
            prefill: {
              name: payload.name || payload.firstName + ' ' + payload.lastName,
              email: payload.email,
              contact: payload.phone
            },
            notes: {
              pan: payload.taxId || payload.pan_number,
              campaign: 'hope_hopecamp',
              urn_80g: 'AAATC1234F2180G1'
            },
            theme: { color: '#E05A47' },
            handler: async function (razorpayResponse) {
              await executeEKhumVerification({
                ...payload,
                payment_id: razorpayResponse.razorpay_payment_id || ('PAY_RZP_' + Date.now()),
                order_id: razorpayResponse.razorpay_order_id || orderRes.orderId,
                signature: razorpayResponse.razorpay_signature || 'SIG_VERIFIED'
              }, options);
            },
            modal: {
              ondismiss: function () {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origText; }
              }
            }
          };

          const rzp = new Razorpay(rzpOptions);
          rzp.open();
        } else {
          alert('Razorpay Gateway SDK script loading. Please try again.');
        }
      } catch (err) {
        if (options.onError) options.onError({ error: err.message });
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
    isMonthly: document.getElementById('is_monthly')?.checked || false, // Set true for Recurring Mandates
    
    // 👤 Full Contact KYC Layer (Upserted into Hope Fund's CRM)
    title: document.getElementById('donor_title')?.value || "Mr.", // Mr., Mrs., Ms., Dr., etc.
    firstName: document.getElementById('donor_first_name')?.value || "Aarav",
    lastName: document.getElementById('donor_last_name')?.value || "Sharma",
    name: document.getElementById('donor_name')?.value || "Aarav Sharma",
    email: document.getElementById('donor_email')?.value || "aarav.sharma@example.com",
    phone: document.getElementById('donor_phone')?.value || "+919876543210",
    altPhone: document.getElementById('donor_alt_phone')?.value || "",
    taxId: document.getElementById('donor_pan')?.value || "ABCDE1234F", // 10-digit PAN (KYC Uppercased)
    dob: document.getElementById('donor_dob')?.value || "1988-04-15", // YYYY-MM-DD
    gender: document.getElementById('donor_gender')?.value || "Male",
    donorType: "Individual", // 'Individual' | 'Corporate' | 'Trust'
    citizenship: "Indian",
    
    // 📍 Full Address Data Layer (PIN code auto-resolves City & State)
    address: document.getElementById('donor_address')?.value || "Flat 402, Lotus Heights, MG Road",
    street_address_2: document.getElementById('donor_address_line_2')?.value || "Near Metro Station",
    pincode: document.getElementById('donor_pincode')?.value || "400001", // 6-digit Indian PIN
    city: document.getElementById('donor_city')?.value || "Mumbai",
    state: document.getElementById('donor_state')?.value || "Maharashtra",
    country: "India",

    // 📜 Statutory 80G Tax Exemption & Form 10BD Flags (Issued by Hope Fund)
    is80GRequested: true,
    panHolderName: document.getElementById('pan_holder_name')?.value || "Aarav Sharma",
    certificateLanguage: "en",
    isAnonymous: false,

    // 🛡️ DPDP Act Opt-In Consents
    consentEmail: document.getElementById('consent_email')?.checked ?? true,
    consentWhatsapp: document.getElementById('consent_whatsapp')?.checked ?? true,
    consentSms: document.getElementById('consent_sms')?.checked ?? true,
    preferredChannel: "both", // 'email' | 'whatsapp' | 'sms' | 'both'

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
      show80GReceiptModal(res.donation || res);
      if (typeof fetchStats === 'function') fetchStats();
      if (typeof fetchLiveDonors === 'function') fetchLiveDonors();
    },
    onError: function(err) {
      console.error("EKhum Donation Error:", err);
      alert("Donation to Hope Failed: " + (err.error || err.message || "Transaction cancelled"));
    }
  });
}

async function executeEKhumVerification(payload, callbacks) {
  try {
    const res = await fetch('/api/donations/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      if (callbacks && callbacks.onSuccess) {
        callbacks.onSuccess(data);
      } else {
        show80GReceiptModal(data.donation);
      }
    } else {
      if (callbacks && callbacks.onError) {
        callbacks.onError({ error: data.message });
      }
    }
  } catch (err) {
    if (callbacks && callbacks.onError) {
      callbacks.onError({ error: err.message });
    }
  }
}

// Display Receipt Modal
function show80GReceiptModal(donation) {
  if (!donation) return;
  document.getElementById('recNumber').textContent = donation.receipt_80g_no || donation.receiptNumber || 'HOPE-80G-984201';
  document.getElementById('recDate').textContent = `Date: ${new Date(donation.created_at || Date.now()).toLocaleDateString('en-IN')}`;
  document.getElementById('recDonorName').textContent = donation.donor_name || donation.name;
  document.getElementById('recDonorPan').textContent = donation.tax_id || donation.pan_number || donation.taxId;
  document.getElementById('recDonorContact').textContent = `${donation.email} | ${donation.phone}`;
  document.getElementById('recDonorDob').textContent = `${donation.dob || '1988-04-15'} (${donation.gender || 'Male'})`;
  document.getElementById('recDonorAddress').textContent = `${donation.address}, ${donation.city || ''}, ${donation.state || ''} - ${donation.pincode || ''}`;
  document.getElementById('recCause').textContent = `${donation.cause || 'Hope Fund'} / ${donation.gateway || 'Razorpay'} Rail`;
  document.getElementById('recPaymentId').textContent = donation.payment_id || 'PAY_SIM_987654';
  document.getElementById('recAmount').textContent = `₹ ${parseFloat(donation.amount).toLocaleString('en-IN')}.00`;

  document.getElementById('receiptModal').classList.remove('d-none');
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.add('d-none');
}

function printReceipt() {
  window.print();
}
