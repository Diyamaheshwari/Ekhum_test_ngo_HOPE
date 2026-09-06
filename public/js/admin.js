// Admin Data Layer Inspector & Live Donor Wall Renderer

async function fetchLiveDonors() {
  const grid = document.getElementById('donorsGrid');
  const ticker = document.getElementById('donationTicker');
  if (!grid) return;

  try {
    const res = await fetch('/api/donations?limit=12');
    const data = await res.json();

    if (data.success && data.donations) {
      if (data.donations.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted p-4">No donations recorded yet. Be the first to donate!</div>';
        return;
      }

      // Render Donor Cards
      grid.innerHTML = data.donations.map(d => {
        const initial = d.donor_name ? d.donor_name.charAt(0).toUpperCase() : 'H';
        const formattedAmt = parseFloat(d.amount).toLocaleString('en-IN');
        const timeAgo = formatTimeAgo(d.created_at);

        return `
          <div class="donor-card">
            <div class="donor-avatar">${initial}</div>
            <div class="donor-details">
              <h4>${escapeHtml(d.donor_name)}</h4>
              <p><i class="fa-solid fa-heart text-danger"></i> ${escapeHtml(d.cause)}</p>
              <small class="text-muted">${timeAgo} • 80G Verified</small>
            </div>
            <div class="donor-amount">₹${formattedAmt}</div>
          </div>
        `;
      }).join('');

      // Update Ticker
      if (ticker && data.donations.length > 0) {
        ticker.innerHTML = data.donations.slice(0, 5).map(d => `
          <span class="ticker-item">
            <i class="fa-solid fa-heart text-danger"></i> 
            <strong>${escapeHtml(d.donor_name)}</strong> donated ₹${parseFloat(d.amount).toLocaleString('en-IN')} for ${escapeHtml(d.cause)}!
          </span>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to fetch live donors:', err);
    grid.innerHTML = '<div class="text-center p-3 text-muted">Unable to connect to live data layer.</div>';
  }
}

// Data Layer Inspector Modal Handling
async function openAdminModal() {
  document.getElementById('adminModal').classList.remove('d-none');
  await loadAdminData();
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('d-none');
}

async function loadAdminData() {
  const tbody = document.getElementById('adminTableBody');
  const statsRow = document.getElementById('adminStatsRow');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center p-3"><i class="fa-solid fa-spinner fa-spin"></i> Reading database records...</td></tr>';

  try {
    const [donationsRes, statsRes] = await Promise.all([
      fetch('/api/donations?limit=100'),
      fetch('/api/donations/stats')
    ]);

    const donationsData = await donationsRes.json();
    const statsData = await statsRes.json();

    if (statsData.success && statsData.stats) {
      const s = statsData.stats;
      statsRow.innerHTML = `
        <div class="stat-card" style="background:#1E293B; color:#fff;">
          <div class="stat-icon"><i class="fa-solid fa-database text-warning"></i></div>
          <div class="stat-info">
            <h3>${s.totalDonations}</h3>
            <p>Database Total Entries</p>
          </div>
        </div>
        <div class="stat-card" style="background:#1E293B; color:#fff;">
          <div class="stat-icon"><i class="fa-solid fa-indian-rupee-sign text-success"></i></div>
          <div class="stat-info">
            <h3>₹${s.totalAmount.toLocaleString('en-IN')}</h3>
            <p>Recorded Contributions</p>
          </div>
        </div>
        <div class="stat-card" style="background:#1E293B; color:#fff;">
          <div class="stat-icon"><i class="fa-solid fa-user-check text-primary"></i></div>
          <div class="stat-info">
            <h3>${s.uniqueDonors}</h3>
            <p>Unique Donor Email Profiles</p>
          </div>
        </div>
      `;
    }

    if (donationsData.success && donationsData.donations) {
      if (donationsData.donations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center p-3">No records found in database. Submit a donation to view live storage!</td></tr>';
        return;
      }

      tbody.innerHTML = donationsData.donations.map(d => `
        <tr>
          <td><strong>#${d.id}</strong></td>
          <td>${escapeHtml(d.donor_name)}</td>
          <td>${escapeHtml(d.masked_email)}</td>
          <td>***-***-${d.id}</td>
          <td>Verified</td>
          <td><code>${escapeHtml(d.masked_pan)}</code></td>
          <td><strong class="text-success">₹${parseFloat(d.amount).toLocaleString('en-IN')}</strong></td>
          <td><small>${escapeHtml(d.cause)}</small></td>
          <td><span class="badge badge-warning">${escapeHtml(d.receipt_80g_no || 'HOPE-80G')}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger p-3">Error connecting to database layer: ${err.message}</td></tr>`;
  }
}

// Utility Helpers
function formatTimeAgo(isoString) {
  if (!isoString) return 'recently';
  const diffSec = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
