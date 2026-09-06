// Donation Form & Payment Gateway Integration
let pendingOrderData = null;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('ngoDonationForm');
  if (form) {
    form.addEventListener('submit', handleDonationSubmit);
  }

  // PAN uppercase formatting constraint
  const panInput = document.getElementById('donorPan');
  if (panInput) {
    panInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
});

// Client-side Validation Helper
function validateClientForm(formData) {
  const errors = [];
  
  if (!formData.donor_name || formData.donor_name.trim().length < 2) {
    errors.push('Full Name is required (minimum 2 characters).');
  }
  
  if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.push('Please provide a valid Email Address.');
  }

  if (!formData.phone || !/^[0-9+\s\-]{8,15}$/.test(formData.phone)) {
    errors.push('Please provide a valid 10-digit Contact Number.');
  }

  if (!formData.address || formData.address.trim().length < 5) {
    errors.push('Full Postal Address is required for tax record issuance.');
  }

  const ageNum = parseInt(formData.age, 10);
  if (!formData.age || isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    errors.push('Age must be a valid number (18 years or older).');
  }

  const panRegex = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/;
  if (!formData.pan_number || !panRegex.test(formData.pan_number.trim())) {
    errors.push('Valid 10-character PAN Number (e.g. ABCDE1234F) is mandatory for 80G Tax Exemption.');
  }

  const amtNum = parseFloat(formData.amount);
  if (!formData.amount || isNaN(amtNum) || amtNum <= 0) {
    errors.push('Please select or enter a valid donation amount.');
  }

  return errors;
}

// Form Submission Handler
async function handleDonationSubmit(e) {
  e.preventDefault();
  
  const alertBox = document.getElementById('formAlertBox');
  alertBox.classList.add('d-none');
  alertBox.innerHTML = '';

  const formData = {
    cause: document.getElementById('donationCause').value,
    amount: document.getElementById('selectedAmount').value,
    donor_name: document.getElementById('donorName').value.trim(),
    email: document.getElementById('donorEmail').value.trim(),
    phone: document.getElementById('donorPhone').value.trim(),
    address: document.getElementById('donorAddress').value.trim(),
    age: document.getElementById('donorAge').value.trim(),
    pan_number: document.getElementById('donorPan').value.trim().toUpperCase(),
    currency: 'INR'
  };

  const validationErrors = validateClientForm(formData);
  if (validationErrors.length > 0) {
    alertBox.innerHTML = '<strong><i class="fa-solid fa-triangle-exclamation"></i> Please correct the following:</strong><ul>' +
      validationErrors.map(err => `<li>${err}</li>`).join('') + '</ul>';
    alertBox.classList.remove('d-none');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const submitBtn = document.getElementById('btnSubmitDonation');
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting Payment Gateway...';

  try {
    // Step 1: Request Order Creation from Backend API
    const response = await fetch('/api/donations/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const orderRes = await response.json();

    if (!orderRes.success) {
      throw new Error(orderRes.errors ? orderRes.errors.join(', ') : 'Order creation failed.');
    }

    pendingOrderData = {
      ...formData,
      order_id: orderRes.orderId,
      razorpay_key: orderRes.key
    };

    // Step 2: Handle Checkout Gateway
    if (orderRes.isSimulation || typeof Razorpay === 'undefined' || !orderRes.key || orderRes.key.includes('rzp_test_HOPE_NGO_MOCK')) {
      // Trigger Simulation Modal
      openSimulatedPaymentModal(formData, orderRes);
    } else {
      // Trigger Live Razorpay Modal
      const options = {
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'FOR THE HOPE FOUNDATION',
        description: `Donation for ${formData.cause}`,
        image: '/images/hero.png',
        order_id: orderRes.orderId,
        prefill: {
          name: formData.donor_name,
          email: formData.email,
          contact: formData.phone
        },
        notes: {
          pan: formData.pan_number,
          age: formData.age
        },
        theme: { color: '#E05A47' },
        handler: async function (razorpayResponse) {
          await verifyAndSaveDonation({
            ...formData,
            payment_id: razorpayResponse.razorpay_payment_id,
            order_id: razorpayResponse.razorpay_order_id,
            signature: razorpayResponse.razorpay_signature
          });
        },
        modal: {
          ondismiss: function () {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    }
  } catch (err) {
    alertBox.innerHTML = `<strong>Error:</strong> ${err.message}`;
    alertBox.classList.remove('d-none');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
}

// Payment Simulation Modal Handling
function openSimulatedPaymentModal(formData, orderRes) {
  document.getElementById('simAmtText').textContent = `₹${parseFloat(formData.amount).toLocaleString('en-IN')}`;
  document.getElementById('simNameText').textContent = formData.donor_name;
  document.getElementById('paySimModal').classList.remove('d-none');
}

function cancelSimulatedPayment() {
  document.getElementById('paySimModal').classList.add('d-none');
  pendingOrderData = null;
}

async function confirmSimulatedPayment() {
  if (!pendingOrderData) return;
  document.getElementById('paySimModal').classList.add('d-none');

  const simPaymentId = 'pay_sim_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const simSignature = 'sig_sim_valid_' + Date.now();

  await verifyAndSaveDonation({
    ...pendingOrderData,
    payment_id: simPaymentId,
    order_id: pendingOrderData.order_id,
    signature: simSignature
  });
}

// Step 3: Verify Payment and Display 80G Receipt
async function verifyAndSaveDonation(verificationPayload) {
  try {
    const res = await fetch('/api/donations/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verificationPayload)
    });

    const data = await res.json();

    if (data.success && data.donation) {
      show80GReceiptModal(data.donation);
      document.getElementById('ngoDonationForm').reset();
      selectAmountPreset(1000);
      if (typeof fetchStats === 'function') fetchStats();
      if (typeof fetchLiveDonors === 'function') fetchLiveDonors();
    } else {
      alert('Payment Verification Warning: ' + (data.message || 'Unknown response.'));
    }
  } catch (err) {
    alert('Verification Error: ' + err.message);
  }
}

// Populate and Display 80G Tax Exemption Receipt Modal
function show80GReceiptModal(donation) {
  document.getElementById('recNumber').textContent = donation.receipt_80g_no;
  document.getElementById('recDate').textContent = `Date: ${new Date(donation.created_at).toLocaleDateString('en-IN')}`;
  document.getElementById('recDonorName').textContent = donation.donor_name;
  document.getElementById('recDonorPan').textContent = donation.pan_number;
  document.getElementById('recDonorContact').textContent = `${donation.email} | ${donation.phone}`;
  document.getElementById('recDonorAddress').textContent = `Age: ${donation.age} | ${donation.address}`;
  document.getElementById('recCause').textContent = donation.cause;
  document.getElementById('recPaymentId').textContent = donation.payment_id;
  document.getElementById('recAmount').textContent = `₹ ${parseFloat(donation.amount).toLocaleString('en-IN')}.00`;

  document.getElementById('receiptModal').classList.remove('d-none');
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.add('d-none');
}

function printReceipt() {
  window.print();
}
