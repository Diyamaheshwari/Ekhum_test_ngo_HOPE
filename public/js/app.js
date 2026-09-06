// App initialization & general interactivity
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initImpactCalculator();
  initAmountPresets();
  initPincodeAutoResolve();
  fetchStats();
  fetchLiveDonors();
});

// Mobile Nav Toggle & Scroll Header Effect
function initNavigation() {
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  const navbar = document.getElementById('navbar');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  window.addEventListener('scroll', () => {
    if (navbar) {
      if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)';
      } else {
        navbar.style.boxShadow = 'none';
      }
    }
  });
}

// Indian Pincode Auto Resolution to City & State
function initPincodeAutoResolve() {
  const pincodeInput = document.getElementById('donor_pincode');
  const cityInput = document.getElementById('donor_city');
  const stateInput = document.getElementById('donor_state');

  if (!pincodeInput) return;

  const pincodeMap = {
    '400001': { city: 'Mumbai', state: 'Maharashtra' },
    '110001': { city: 'New Delhi', state: 'Delhi' },
    '560001': { city: 'Bengaluru', state: 'Karnataka' },
    '600001': { city: 'Chennai', state: 'Tamil Nadu' },
    '700001': { city: 'Kolkata', state: 'West Bengal' },
    '500001': { city: 'Hyderabad', state: 'Telangana' },
    '380001': { city: 'Ahmedabad', state: 'Gujarat' },
    '411001': { city: 'Pune', state: 'Maharashtra' },
    '302001': { city: 'Jaipur', state: 'Rajasthan' }
  };

  pincodeInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length === 6 && pincodeMap[val]) {
      cityInput.value = pincodeMap[val].city;
      stateInput.value = pincodeMap[val].state;
    }
  });
}

// Impact Calculator Logic
function initImpactCalculator() {
  const slider = document.getElementById('impactSlider');
  const amountDisplay = document.getElementById('calcAmountDisplay');
  const btnText = document.getElementById('btnCalcAmtText');

  const resSchooling = document.getElementById('resSchooling');
  const resMeals = document.getElementById('resMeals');
  const resMedical = document.getElementById('resMedical');
  const resTaxSave = document.getElementById('resTaxSave');

  const btnDonateCalc = document.getElementById('btnDonateFromCalc');

  if (!slider) return;

  function updateCalculator(val) {
    const amount = parseInt(val, 10);
    amountDisplay.textContent = `₹ ${amount.toLocaleString('en-IN')}`;
    btnText.textContent = amount.toLocaleString('en-IN');

    const monthsSchooling = Math.max(1, Math.floor(amount / 800));
    const hotMeals = Math.floor(amount / 25);
    const healthCheckups = Math.max(1, Math.floor(amount / 2000));
    const taxSaving = Math.floor(amount * 0.5);

    resSchooling.textContent = `${monthsSchooling} ${monthsSchooling === 1 ? 'Month' : 'Months'}`;
    resMeals.textContent = `${hotMeals.toLocaleString('en-IN')} Meals`;
    resMedical.textContent = `${healthCheckups} ${healthCheckups === 1 ? 'Child' : 'Children'}`;
    resTaxSave.textContent = `₹ ${taxSaving.toLocaleString('en-IN')}`;
  }

  slider.addEventListener('input', (e) => {
    updateCalculator(e.target.value);
  });

  if (btnDonateCalc) {
    btnDonateCalc.addEventListener('click', () => {
      const currentAmt = slider.value;
      selectAmountPreset(currentAmt);
      document.getElementById('donate').scrollIntoView({ behavior: 'smooth' });
    });
  }

  updateCalculator(slider.value);
}

// Amount Preset Buttons
function initAmountPresets() {
  const presets = document.querySelectorAll('.btn-preset');
  const hiddenInput = document.getElementById('selectedAmount');
  const customWrap = document.getElementById('customAmountWrap');
  const customInput = document.getElementById('donation_amount');
  const submitText = document.getElementById('submitAmountText');

  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      presets.forEach(b => b.classList.remove('active'));

      if (btn.id === 'btnCustomAmount') {
        btn.classList.add('active');
        customWrap.classList.remove('d-none');
        if (customInput) {
          customInput.focus();
          if (customInput.value) {
            updateSelectedAmount(customInput.value);
          }
        }
      } else {
        btn.classList.add('active');
        customWrap.classList.add('d-none');
        const amt = btn.getAttribute('data-amount');
        updateSelectedAmount(amt);
      }
    });
  });

  if (customInput) {
    customInput.addEventListener('input', (e) => {
      if (e.target.value && parseInt(e.target.value) > 0) {
        updateSelectedAmount(e.target.value);
      }
    });
  }
}

function selectAmountPreset(amt) {
  const presets = document.querySelectorAll('.btn-preset');
  const customWrap = document.getElementById('customAmountWrap');
  const customInput = document.getElementById('donation_amount');

  let matched = false;
  presets.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-amount') === String(amt)) {
      btn.classList.add('active');
      matched = true;
    }
  });

  if (!matched) {
    document.getElementById('btnCustomAmount').classList.add('active');
    if (customWrap) customWrap.classList.remove('d-none');
    if (customInput) customInput.value = amt;
  } else {
    if (customWrap) customWrap.classList.add('d-none');
  }

  updateSelectedAmount(amt);
}

function updateSelectedAmount(amt) {
  const hiddenInput = document.getElementById('selectedAmount');
  const submitText = document.getElementById('submitAmountText');
  const formatted = parseInt(amt, 10).toLocaleString('en-IN');
  if (hiddenInput) hiddenInput.value = amt;
  if (submitText) submitText.textContent = formatted;
}

function selectCause(causeName, defaultAmount) {
  selectAmountPreset(defaultAmount);
  document.getElementById('donate').scrollIntoView({ behavior: 'smooth' });
}

async function fetchStats() {
  try {
    const res = await fetch('/api/donations/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      const stats = data.stats;
      document.getElementById('statTotalAmount').textContent = `₹${(stats.totalAmount + 1485000).toLocaleString('en-IN')}`;
      document.getElementById('statChildrenHelped').textContent = `${(stats.childrenHelped).toLocaleString('en-IN')}+`;
      document.getElementById('statTotalDonors').textContent = `${(stats.uniqueDonors + 840).toLocaleString('en-IN')}+`;
    }
  } catch (err) {
    console.log('Stats lookup fallback.');
  }
}
