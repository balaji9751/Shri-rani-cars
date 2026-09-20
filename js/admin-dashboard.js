// SRI RANI CARS — ADMIN DASHBOARD CONTROLLER & STATE ENGINE

// Global State
const AdminDashboard = {
  currentView: 'dashboard',
  cars: [],
  enquiries: [],
  branches: [],
  logs: [],
  settings: {},
  homepageConfig: {},
  editingCarId: null,
  carFormImages: [], // Array of image URLs/base64 strings
  primaryImageIndex: 0,
  carFormFeatures: ['Air Conditioning', 'Power Steering', 'Power Windows', 'ABS with EBD', 'Dual Airbags', 'Touchscreen Infotainment', 'Reverse Parking Sensors', 'Alloy Wheels'],
  carFilterStatus: 'all',
  carFilterBrand: 'all',
  carFilterFuel: 'all',
  carFilterSort: 'newest',
  carSearchQuery: '',
  enquiryTab: 'all'
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Clear any old stale service worker caches if present
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.includes('shri-rani-cars-v1')) {
          caches.delete(name);
        }
      });
    });
  }

  checkAdminAuthentication();
  await loadDashboardData();
  setupNavigationRoutes();
  setupGlobalListeners();
  renderCurrentView();
});

// Authentication Guard
function checkAdminAuthentication() {
  const token = localStorage.getItem('shri_rani_cars_admin_session_v1');
  const gate = document.getElementById('admin-auth-overlay');
  if (token !== 'authenticated') {
    if (gate) gate.style.display = 'flex';
  } else {
    if (gate) gate.style.display = 'none';
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const pass = document.getElementById('admin-pass-field').value;
  if (pass === 'admin123' || pass === 'srirani' || pass === '9750332585') {
    localStorage.setItem('shri_rani_cars_admin_session_v1', 'authenticated');
    document.getElementById('admin-auth-overlay').style.display = 'none';
    showToast('Welcome back, Admin!', 'success');
    logActivity('Admin logged in to dashboard');
    loadDashboardData();
  } else {
    showToast('Invalid passcode! Please try again.', 'error');
  }
}

function handleAdminLogout() {
  localStorage.removeItem('shri_rani_cars_admin_session_v1');
  logActivity('Admin logged out');
  window.location.href = 'index.html';
}

// Load Core Data from Supabase & Storage
async function loadDashboardData() {
  AdminDashboard.cars = await window.CarService.getCars();
  AdminDashboard.enquiries = await window.CarService.getEnquiries();
  AdminDashboard.settings = await window.CarService.getSettings();
  AdminDashboard.homepageConfig = await window.CarService.getHomepageConfig();

  AdminDashboard.branches = JSON.parse(localStorage.getItem('shri_rani_branches_v1') || JSON.stringify([
    {
      id: 'br_1',
      name: 'Main Showroom (Vazhapadi)',
      address: 'Mangamma Salai, Near RTO Office, Puthupalayam, Vazhapadi, Salem - 636115',
      phone: '97503 32585',
      whatsapp: '75501 72585',
      hours: '9:00 AM - 8:30 PM (All Days)',
      isPrimary: true
    }
  ]));

  AdminDashboard.logs = JSON.parse(localStorage.getItem('shri_rani_logs_v1') || '[]');

  updateHeaderMetrics();
  renderCurrentView();
}

function setupGlobalListeners() {
  // Realtime Events from Supabase
  window.addEventListener('shri_rani_cars_sync', async (e) => {
    console.log('⚡ Realtime cars update in Admin:', e.detail);
    AdminDashboard.cars = await window.CarService.getCars();
    updateHeaderMetrics();
    if (AdminDashboard.currentView === 'dashboard') renderDashboardOverview();
    else if (AdminDashboard.currentView === 'cars') renderCarsManagementTable();
  });

  window.addEventListener('shri_rani_enquiries_sync', async (e) => {
    console.log('⚡ Realtime enquiries update in Admin:', e.detail);
    AdminDashboard.enquiries = await window.CarService.getEnquiries();
    updateHeaderMetrics();
    if (AdminDashboard.currentView === 'dashboard') renderDashboardOverview();
    else if (AdminDashboard.currentView === 'enquiries') renderEnquiriesTable();
  });

  window.addEventListener('shri_rani_settings_sync', async (e) => {
    console.log('⚡ Realtime settings update in Admin:', e.detail);
    AdminDashboard.settings = await window.CarService.getSettings();
    AdminDashboard.homepageConfig = await window.CarService.getHomepageConfig();
    if (AdminDashboard.currentView === 'settings') renderSettings();
    else if (AdminDashboard.currentView === 'homepage') renderHomepageManager();
  });
}

// Activity Logger
function logActivity(action) {
  const item = {
    id: 'log_' + Date.now(),
    action: action,
    timestamp: new Date().toISOString()
  };
  AdminDashboard.logs.unshift(item);
  if (AdminDashboard.logs.length > 50) AdminDashboard.logs.pop();
  localStorage.setItem('shri_rani_logs_v1', JSON.stringify(AdminDashboard.logs));
}

// Toast System
function showToast(message, type = 'success') {
  let shelf = document.getElementById('toast-shelf');
  if (!shelf) {
    shelf = document.createElement('div');
    shelf.id = 'toast-shelf';
    shelf.className = 'toast-shelf';
    document.body.appendChild(shelf);
  }
  const pill = document.createElement('div');
  pill.className = `toast-pill ${type}`;
  pill.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle text-emerald' : 'fa-exclamation-circle text-red'}"></i>
    <span>${message}</span>
  `;
  shelf.appendChild(pill);
  setTimeout(() => {
    pill.style.opacity = '0';
    pill.style.transform = 'translateX(100%)';
    pill.style.transition = 'all 0.3s ease';
    setTimeout(() => pill.remove(), 300);
  }, 3200);
}

// Navigation & Tab Routing
function setupNavigationRoutes() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash, false);

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(newHash, false);
  });
}

function navigateTo(viewName, updateHash = true) {
  AdminDashboard.currentView = viewName;
  if (updateHash) window.location.hash = viewName;

  // Update Sidebar active state
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === viewName);
  });

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Update Page Title in Top Header
  const titleMap = {
    'dashboard': { title: 'Dashboard', sub: 'Manage your inventory and dealership website.' },
    'cars': { title: 'Cars Inventory', sub: 'View, filter, edit, and organize all vehicles.' },
    'add-car': { title: AdminDashboard.editingCarId ? 'Edit Car Listing' : 'Add New Car', sub: 'Fill in specifications, features, and upload photos.' },
    'enquiries': { title: 'Customer Enquiries', sub: 'Manage test drives and car selling requests.' },
    'homepage': { title: 'Homepage Manager', sub: 'Customize public website hero banner and feature cards.' },
    'branches': { title: 'Branches Management', sub: 'Manage showroom locations, contacts, and timings.' },
    'media': { title: 'Media Library', sub: 'Manage vehicle photos and uploaded assets.' },
    'settings': { title: 'Settings', sub: 'Configure business details, contact information, and SEO.' },
    'logs': { title: 'Audit Logs', sub: 'View recent dashboard activity and system history.' }
  };

  const headerInfo = titleMap[viewName] || { title: 'Admin Panel', sub: 'Dealership Management System' };
  document.getElementById('header-view-title').textContent = headerInfo.title;
  document.getElementById('header-view-sub').textContent = headerInfo.sub;

  // Show Active View Panel
  document.querySelectorAll('.admin-view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `view-${viewName}`);
  });

  renderCurrentView();
}

function renderCurrentView() {
  const view = AdminDashboard.currentView;
  if (view === 'dashboard') renderDashboardOverview();
  else if (view === 'cars') renderCarsManagementTable();
  else if (view === 'add-car') renderCarForm();
  else if (view === 'enquiries') renderEnquiriesTable();
  else if (view === 'homepage') renderHomepageManager();
  else if (view === 'branches') renderBranchesList();
  else if (view === 'media') renderMediaLibrary();
  else if (view === 'settings') renderSettings();
  else if (view === 'logs') renderAuditLogs();
}

// Format Price
function formatCurrency(num) {
  if (!num) return '₹ 0';
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2)} Lakh`;
  }
  return `₹ ${Number(num).toLocaleString('en-IN')}`;
}

// Header Metrics Update
function updateHeaderMetrics() {
  const total = AdminDashboard.cars.length;
  const avail = AdminDashboard.cars.filter(c => c.status !== 'Sold' && c.status !== 'Hidden').length;
  const reserved = AdminDashboard.cars.filter(c => c.status === 'Reserved').length;
  const sold = AdminDashboard.cars.filter(c => c.status === 'Sold').length;
  const enqCount = AdminDashboard.enquiries.length;
  const stockVal = AdminDashboard.cars.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

  // Update Stat Cards in Dashboard
  const elTotal = document.getElementById('stat-total-cars');
  const elAvail = document.getElementById('stat-avail-cars');
  const elRes = document.getElementById('stat-res-cars');
  const elSold = document.getElementById('stat-sold-cars');
  const elEnq = document.getElementById('stat-total-enq');

  if (elTotal) elTotal.textContent = total;
  if (elAvail) elAvail.textContent = avail;
  if (elRes) elRes.textContent = reserved;
  if (elSold) elSold.textContent = sold;
  if (elEnq) elEnq.textContent = enqCount;

  // Update Sidebar Badges
  const badgeCars = document.getElementById('badge-cars-count');
  const badgeEnq = document.getElementById('badge-enq-count');
  if (badgeCars) badgeCars.textContent = total;
  if (badgeEnq) badgeEnq.textContent = enqCount;
}

// ==========================================================================
// 1. DASHBOARD OVERVIEW VIEW
// ==========================================================================
function renderDashboardOverview() {
  updateHeaderMetrics();

  // Render Recent Cars (Top 5)
  const recentCarsBody = document.getElementById('dashboard-recent-cars-tbody');
  if (recentCarsBody) {
    const recent = AdminDashboard.cars.slice(0, 5);
    if (recent.length === 0) {
      recentCarsBody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 2rem;">No cars in inventory yet.</td></tr>`;
    } else {
      recentCarsBody.innerHTML = recent.map(car => `
        <tr>
          <td>
            <img src="${car.image_url || 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=200&q=80'}" class="table-car-thumb" alt="${car.title}" onerror="this.src='https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=200&q=80'">
          </td>
          <td>
            <strong style="color: #071426;">${car.title}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${car.brand} • ${car.variant || 'Standard'}</div>
          </td>
          <td>${car.year || '2022'}</td>
          <td style="font-weight: 800; color: #071426;">${formatCurrency(car.price)}</td>
          <td>${(car.kms || 0).toLocaleString('en-IN')} km</td>
          <td><span class="status-pill ${(car.status || 'available').toLowerCase()}">${car.status || 'Available'}</span></td>
          <td style="text-align: right;">
            <button type="button" class="btn btn-outline btn-sm" onclick="editCarFromDashboard('${car.id}')" title="Edit Car">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn btn-danger-outline btn-sm" onclick="promptDeleteCar('${car.id}')" title="Delete Car">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Recent Enquiries (Top 5)
  const recentEnqBody = document.getElementById('dashboard-recent-enq-tbody');
  if (recentEnqBody) {
    const recentEnq = AdminDashboard.enquiries.slice(0, 5);
    if (recentEnq.length === 0) {
      recentEnqBody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 2rem;">No customer enquiries yet.</td></tr>`;
    } else {
      recentEnqBody.innerHTML = recentEnq.map(enq => `
        <tr>
          <td>
            <strong>${enq.customer_name}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${enq.city || 'Salem'}</div>
          </td>
          <td><a href="tel:${enq.phone}" style="font-weight: 600; color: #0284c7;"><i class="fas fa-phone-alt"></i> ${enq.phone}</a></td>
          <td><strong>${enq.car_name || 'Vehicle'}</strong></td>
          <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(enq.created_at).toLocaleDateString()}</td>
          <td><span class="status-pill ${(enq.status || 'new').toLowerCase()}">${enq.status || 'New'}</span></td>
          <td style="text-align: right;">
            <a href="https://wa.me/91${enq.phone.replace(/\D/g,'')}?text=Hello%20${encodeURIComponent(enq.customer_name)},%20Greetings%20from%20Sri%20Rani%20Cars%20regarding%20your%20inquiry%20for%20${encodeURIComponent(enq.car_name)}." target="_blank" class="btn btn-whatsapp btn-sm" title="Reply on WhatsApp">
              <i class="fab fa-whatsapp"></i> Chat
            </a>
          </td>
        </tr>
      `).join('');
    }
  }
}

// ==========================================================================
// 2. CARS MANAGEMENT TABLE & FILTER ENGINE
// ==========================================================================
function renderCarsManagementTable() {
  const tbody = document.getElementById('cars-mgmt-tbody');
  if (!tbody) return;

  let list = [...AdminDashboard.cars];

  // Apply Status Filter
  if (AdminDashboard.carFilterStatus !== 'all') {
    list = list.filter(c => (c.status || '').toLowerCase() === AdminDashboard.carFilterStatus.toLowerCase());
  }

  // Apply Brand Filter
  if (AdminDashboard.carFilterBrand !== 'all') {
    list = list.filter(c => (c.brand || '').toLowerCase() === AdminDashboard.carFilterBrand.toLowerCase());
  }

  // Apply Fuel Filter
  if (AdminDashboard.carFilterFuel !== 'all') {
    list = list.filter(c => (c.fuel_type || '').toLowerCase() === AdminDashboard.carFilterFuel.toLowerCase());
  }

  // Search Query
  if (AdminDashboard.carSearchQuery.trim()) {
    const q = AdminDashboard.carSearchQuery.toLowerCase().trim();
    list = list.filter(c => 
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.brand && c.brand.toLowerCase().includes(q)) ||
      (c.model && c.model.toLowerCase().includes(q)) ||
      (c.variant && c.variant.toLowerCase().includes(q)) ||
      (String(c.year).includes(q))
    );
  }

  // Sort
  if (AdminDashboard.carFilterSort === 'price-low') list.sort((a, b) => a.price - b.price);
  else if (AdminDashboard.carFilterSort === 'price-high') list.sort((a, b) => b.price - a.price);
  else if (AdminDashboard.carFilterSort === 'year-new') list.sort((a, b) => b.year - a.year);
  else if (AdminDashboard.carFilterSort === 'kms-low') list.sort((a, b) => a.kms - b.kms);
  else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 3rem 1.5rem;">
          <i class="fas fa-car-side" style="font-size: 2.5rem; color: #9CA3AF; margin-bottom: 0.75rem;"></i>
          <h4 style="color: #111827; font-weight: 700;">No Cars Matching Filter</h4>
          <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your search criteria or click Add New Car.</p>
          <button type="button" class="btn btn-lime btn-sm" style="margin-top: 1rem;" onclick="openAddCarView()">
            <i class="fas fa-plus"></i> Add Your First Car
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(car => `
    <tr>
      <td>
        <img src="${car.image_url || 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=200&q=80'}" class="table-car-thumb" alt="${car.title}" onerror="this.src='https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=200&q=80'">
      </td>
      <td>
        <strong style="color: #071426; font-size: 0.95rem;">${car.title}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${car.brand} • ${car.model} • ${car.variant || ''}</div>
      </td>
      <td><strong>${car.year || '2022'}</strong></td>
      <td style="font-weight: 800; color: #071426;">${formatCurrency(car.price)}</td>
      <td>${(car.kms || 0).toLocaleString('en-IN')} km</td>
      <td>${car.fuel_type || 'Petrol'}</td>
      <td>
        <select class="form-input-ctrl" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto;" onchange="quickUpdateCarStatus('${car.id}', this.value)">
          <option value="Available" ${car.status === 'Available' ? 'selected' : ''}>Available</option>
          <option value="Reserved" ${car.status === 'Reserved' ? 'selected' : ''}>Reserved</option>
          <option value="Sold" ${car.status === 'Sold' ? 'selected' : ''}>Sold</option>
          <option value="Hidden" ${car.status === 'Hidden' ? 'selected' : ''}>Hidden</option>
          <option value="Draft" ${car.status === 'Draft' ? 'selected' : ''}>Draft</option>
        </select>
      </td>
      <td>
        <button type="button" onclick="toggleFeaturedCar('${car.id}')" style="font-size: 1.2rem; color: ${car.is_featured ? '#d97706' : '#cbd5e1'};" title="Toggle Homepage Feature">
          <i class="fas fa-star"></i>
        </button>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 0.4rem;">
          <button type="button" class="btn btn-outline btn-sm" onclick="editCarFromDashboard('${car.id}')" title="Edit Car">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="duplicateCar('${car.id}')" title="Duplicate Listing">
            <i class="fas fa-copy"></i>
          </button>
          <button type="button" class="btn btn-danger-outline btn-sm" onclick="promptDeleteCar('${car.id}')" title="Delete Car">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Quick Status Switch
async function quickUpdateCarStatus(id, newStatus) {
  await window.CarService.updateCar(id, { status: newStatus });
  showToast(`Car status updated to ${newStatus}`);
  logActivity(`Updated car status to ${newStatus}`);
  await loadDashboardData();
}

// Toggle Featured
async function toggleFeaturedCar(id) {
  const car = AdminDashboard.cars.find(c => String(c.id) === String(id));
  if (!car) return;
  const newFeatured = !car.is_featured;
  await window.CarService.updateCar(id, { is_featured: newFeatured });
  showToast(newFeatured ? 'Car featured on homepage!' : 'Removed from featured');
  logActivity(`Toggled featured status for ${car.title}`);
  await loadDashboardData();
}

// Duplicate Listing
async function duplicateCar(id) {
  const car = AdminDashboard.cars.find(c => String(c.id) === String(id));
  if (!car) return;
  const duplicated = {
    ...car,
    id: 'car_' + Date.now(),
    title: `${car.title} (Copy)`,
    created_at: new Date().toISOString()
  };
  await window.CarService.addCar(duplicated);
  showToast('Car listing duplicated successfully!');
  logActivity(`Duplicated listing for ${car.title}`);
  await loadDashboardData();
}

// ==========================================================================
// 3. ADD / EDIT CAR MULTI-SECTION FORM
// ==========================================================================
function openAddCarView() {
  AdminDashboard.editingCarId = null;
  AdminDashboard.carFormImages = [];
  AdminDashboard.carFormFeatures = [];
  AdminDashboard.primaryImageIndex = 0;
  navigateTo('add-car');
}

function editCarFromDashboard(id) {
  AdminDashboard.editingCarId = id;
  const car = AdminDashboard.cars.find(c => String(c.id) === String(id));
  if (car) {
    AdminDashboard.carFormImages = (car.gallery && car.gallery.length > 0) ? [...car.gallery] : (car.image_url ? [car.image_url] : []);
    AdminDashboard.carFormFeatures = (car.features && Array.isArray(car.features)) ? [...car.features] : [];
    AdminDashboard.primaryImageIndex = 0;
  }
  navigateTo('add-car');
}

function renderCarForm() {
  const formTitle = document.getElementById('car-form-page-heading');
  const submitBtn = document.getElementById('car-form-submit-btn');

  if (AdminDashboard.editingCarId) {
    const car = AdminDashboard.cars.find(c => String(c.id) === String(AdminDashboard.editingCarId));
    if (car) {
      if (formTitle) formTitle.textContent = `Edit Car: ${car.title}`;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined && val !== null ? val : '';
      };
      const setChecked = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
      };

      setVal('form-car-brand', car.brand || 'Maruti Suzuki');
      setVal('form-car-model', car.model || '');
      setVal('form-car-variant', car.variant || '');
      setVal('form-car-year', car.year || 2022);
      setVal('form-car-price', car.price || '');
      setChecked('form-car-negotiable', car.is_negotiable);
      setVal('form-car-fuel', car.fuel_type || 'Petrol');
      setVal('form-car-trans', car.transmission || 'Manual');
      setVal('form-car-kms', car.kms || '');
      setVal('form-car-body', car.body_type || 'SUV');
      setVal('form-car-color', car.color || '');
      setVal('form-car-owners', car.owners || '1st Owner');
      setVal('form-car-regyear', car.reg_year || car.year || 2022);
      setVal('form-car-insurance', car.insurance || '');
      setVal('form-car-location', car.rto || 'TN 54 (Salem)');
      setVal('form-car-desc', car.description || '');
      setVal('form-car-status', car.status || 'Available');
      setChecked('form-car-featured', car.is_featured);

      // Gallery Images
      AdminDashboard.carFormImages = (car.gallery && car.gallery.length > 0) ? [...car.gallery] : (car.image_url ? [car.image_url] : []);
      AdminDashboard.primaryImageIndex = 0;
      renderImageGalleryThumbnails();

      // Features
      AdminDashboard.carFormFeatures = (car.features && Array.isArray(car.features)) ? [...car.features] : [];
      renderCarFeaturesChecklist();
      return;
    }
  }

  // New Car Setup
  if (formTitle) formTitle.textContent = 'Add New Car';
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Publish Car';

  const form = document.getElementById('master-car-form');
  if (form) form.reset();

  AdminDashboard.carFormImages = [];
  AdminDashboard.carFormFeatures = [];
  AdminDashboard.primaryImageIndex = 0;
  renderImageGalleryThumbnails();
  renderCarFeaturesChecklist();
}

// Features Checklist & Custom Input
function renderCarFeaturesChecklist() {
  const container = document.getElementById('features-selection-grid');
  if (!container) return;

  const defaultAllFeatures = [
    'Air Conditioning', 'Power Steering', 'Power Windows', 'ABS with EBD', 'Dual Airbags',
    'Touchscreen Infotainment', 'Reverse Parking Camera', 'Reverse Parking Sensors',
    'Alloy Wheels', 'Sunroof', 'Leather Seats', 'Cruise Control', 'Push Button Start/Stop',
    'Bluetooth Audio', 'Automatic Climate Control', 'Fog Lamps'
  ];

  // Merge with any custom features
  const allAvailable = Array.from(new Set([...defaultAllFeatures, ...AdminDashboard.carFormFeatures]));

  container.innerHTML = allAvailable.map(feat => {
    const isChecked = AdminDashboard.carFormFeatures.includes(feat);
    return `
      <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #374151; background: #F8FAFC; border: 1px solid var(--border-color); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); cursor: pointer;">
        <input type="checkbox" value="${feat}" ${isChecked ? 'checked' : ''} onchange="toggleFeatureItem('${feat}', this.checked)" style="width: 16px; height: 16px; accent-color: #071426;">
        <span>${feat}</span>
      </label>
    `;
  }).join('');
}

function toggleFeatureItem(feat, checked) {
  if (checked) {
    if (!AdminDashboard.carFormFeatures.includes(feat)) AdminDashboard.carFormFeatures.push(feat);
  } else {
    AdminDashboard.carFormFeatures = AdminDashboard.carFormFeatures.filter(f => f !== feat);
  }
}

function addCustomFeature() {
  const input = document.getElementById('custom-feature-input');
  if (!input || !input.value.trim()) return;
  const val = input.value.trim();
  if (!AdminDashboard.carFormFeatures.includes(val)) {
    AdminDashboard.carFormFeatures.push(val);
  }
  input.value = '';
  renderCarFeaturesChecklist();
}

// Image Drag & Drop & Upload Handling
function handleImageFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = function(e) {
      AdminDashboard.carFormImages.push(e.target.result);
      renderImageGalleryThumbnails();
    };
    reader.readAsDataURL(file);
  }
}

function addImageByUrl() {
  const input = document.getElementById('image-url-input-field');
  if (!input || !input.value.trim()) return;
  AdminDashboard.carFormImages.push(input.value.trim());
  input.value = '';
  renderImageGalleryThumbnails();
}

function renderImageGalleryThumbnails() {
  const grid = document.getElementById('uploaded-gallery-grid');
  if (!grid) return;

  if (AdminDashboard.carFormImages.length === 0) {
    grid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align: center; font-size: 0.85rem;">No images uploaded yet. Upload from device or add image URLs above.</p>`;
    return;
  }

  grid.innerHTML = AdminDashboard.carFormImages.map((imgUrl, idx) => {
    const isPrimary = idx === AdminDashboard.primaryImageIndex;
    return `
      <div class="gallery-thumbnail-card ${isPrimary ? 'is-primary' : ''}">
        <img src="${imgUrl}" alt="Car Image ${idx + 1}">
        ${isPrimary ? '<span class="gallery-card-badge">PRIMARY</span>' : ''}
        <div class="gallery-card-actions">
          <button type="button" class="btn-thumb-action" onclick="setAsPrimaryImage(${idx})" title="Set as Primary Cover Photo">
            <i class="fas fa-star"></i>
          </button>
          <button type="button" class="btn-thumb-action delete-btn" onclick="removeGalleryImage(${idx})" title="Delete Image">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setAsPrimaryImage(idx) {
  AdminDashboard.primaryImageIndex = idx;
  renderImageGalleryThumbnails();
  showToast('Primary cover image updated!');
}

function removeGalleryImage(idx) {
  AdminDashboard.carFormImages.splice(idx, 1);
  if (AdminDashboard.primaryImageIndex >= AdminDashboard.carFormImages.length) {
    AdminDashboard.primaryImageIndex = 0;
  }
  renderImageGalleryThumbnails();
}

// Master Car Form Submission
async function handleMasterCarFormSubmit(e) {
  e.preventDefault();

  const brand = document.getElementById('form-car-brand').value;
  const model = document.getElementById('form-car-model').value.trim();
  const variant = document.getElementById('form-car-variant').value.trim();
  const year = Number(document.getElementById('form-car-year').value);
  const price = Number(document.getElementById('form-car-price').value);
  const isNegotiable = document.getElementById('form-car-negotiable').checked;
  const fuel = document.getElementById('form-car-fuel').value;
  const transmission = document.getElementById('form-car-trans').value;
  const kms = Number(document.getElementById('form-car-kms').value);
  const bodyType = document.getElementById('form-car-body').value;
  const color = document.getElementById('form-car-color').value.trim();
  const owners = document.getElementById('form-car-owners').value;
  const regYear = Number(document.getElementById('form-car-regyear').value) || year;
  const insurance = document.getElementById('form-car-insurance').value.trim();
  const location = document.getElementById('form-car-location').value.trim();
  const description = document.getElementById('form-car-desc').value.trim();
  const status = document.getElementById('form-car-status').value;
  const isFeatured = document.getElementById('form-car-featured').checked;

  const title = `${brand} ${model} ${variant}`.trim();

  // Primary image & gallery
  const gallery = AdminDashboard.carFormImages.length > 0 
    ? AdminDashboard.carFormImages 
    : ['https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1000&q=80'];

  const primaryImage = gallery[AdminDashboard.primaryImageIndex] || gallery[0];

  const carPayload = {
    title,
    brand,
    model,
    variant,
    year,
    reg_year: regYear,
    price,
    is_negotiable: isNegotiable,
    kms,
    fuel_type: fuel,
    transmission,
    body_type: bodyType,
    color,
    owners,
    insurance,
    rto: location,
    description,
    status,
    is_featured: isFeatured,
    features: AdminDashboard.carFormFeatures,
    image_url: primaryImage,
    gallery: gallery
  };

  if (AdminDashboard.editingCarId) {
    await window.CarService.updateCar(AdminDashboard.editingCarId, carPayload);
    showToast('Car details updated successfully!');
    logActivity(`Updated vehicle: ${title}`);
  } else {
    await window.CarService.addCar(carPayload);
    showToast('New car published to showroom!');
    logActivity(`Published new vehicle: ${title}`);
  }

  await loadDashboardData();
  navigateTo('cars');
}

// ==========================================================================
// 4. DELETE CONFIRMATION MODAL
// ==========================================================================
let carToDeleteId = null;

function promptDeleteCar(id) {
  carToDeleteId = id;
  const car = AdminDashboard.cars.find(c => String(c.id) === String(id));
  const modal = document.getElementById('confirmDeleteModal');
  const titleEl = document.getElementById('delete-car-name-target');

  if (titleEl && car) titleEl.textContent = car.title;
  if (modal) modal.classList.add('active');
}

function closeDeleteModal() {
  const modal = document.getElementById('confirmDeleteModal');
  if (modal) modal.classList.remove('active');
  carToDeleteId = null;
}

async function confirmExecuteDelete() {
  if (carToDeleteId) {
    const car = AdminDashboard.cars.find(c => String(c.id) === String(carToDeleteId));
    await window.CarService.deleteCar(carToDeleteId);
    showToast('Car deleted from inventory successfully!', 'success');
    logActivity(`Deleted vehicle: ${car ? car.title : carToDeleteId}`);
    closeDeleteModal();
    await loadDashboardData();
  }
}

// ==========================================================================
// 5. ENQUIRIES PAGE & STATUS HANDLER
// ==========================================================================
function renderEnquiriesTable() {
  const tbody = document.getElementById('enquiries-master-tbody');
  if (!tbody) return;

  let list = [...AdminDashboard.enquiries];

  if (AdminDashboard.enquiryTab !== 'all') {
    list = list.filter(e => (e.status || 'new').toLowerCase() === AdminDashboard.enquiryTab.toLowerCase());
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No enquiries found in this category.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(enq => `
    <tr>
      <td>
        <strong style="color: #071426;">${enq.customer_name}</strong>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${enq.city || 'Salem'}</div>
      </td>
      <td>
        <a href="tel:${enq.phone}" style="color: #0284c7; font-weight: 700;"><i class="fas fa-phone-alt"></i> ${enq.phone}</a>
      </td>
      <td>
        <span style="background: #E0F2FE; color: #0369A1; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">${enq.enquiry_type || 'Test Drive'}</span>
      </td>
      <td><strong>${enq.car_name || 'Showroom Vehicle'}</strong></td>
      <td style="font-size: 0.75rem; color: var(--text-muted);">${new Date(enq.created_at).toLocaleDateString()}</td>
      <td>
        <select class="form-input-ctrl" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto;" onchange="updateEnquiryStatus('${enq.id}', this.value)">
          <option value="New" ${(enq.status || 'New') === 'New' ? 'selected' : ''}>New</option>
          <option value="Contacted" ${enq.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="Closed" ${enq.status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 0.4rem;">
          <a href="https://wa.me/91${enq.phone.replace(/\D/g,'')}?text=Hello%20${encodeURIComponent(enq.customer_name)},%20Greetings%20from%20Sri%20Rani%20Cars%20regarding%20your%20inquiry%20for%20${encodeURIComponent(enq.car_name)}." target="_blank" class="btn btn-whatsapp btn-sm" title="Reply on WhatsApp">
            <i class="fab fa-whatsapp"></i> WhatsApp
          </a>
          <button type="button" class="btn btn-danger-outline btn-sm" onclick="deleteEnquiryMaster('${enq.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterEnquiryTab(tab) {
  AdminDashboard.enquiryTab = tab;
  document.querySelectorAll('.enquiry-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderEnquiriesTable();
}

function updateEnquiryStatus(id, newStatus) {
  let enqs = window.CarService.getEnquiries();
  const index = enqs.findIndex(e => String(e.id) === String(id));
  if (index !== -1) {
    enqs[index].status = newStatus;
    localStorage.setItem('shri_rani_cars_enquiries_v1', JSON.stringify(enqs));
    AdminDashboard.enquiries = enqs;
    showToast(`Enquiry status changed to ${newStatus}`);
    logActivity(`Changed lead status to ${newStatus}`);
  }
}

function deleteEnquiryMaster(id) {
  window.CarService.deleteEnquiry(id);
  AdminDashboard.enquiries = window.CarService.getEnquiries();
  renderEnquiriesTable();
  showToast('Enquiry deleted.');
}

// ==========================================================================
// 6. HOMEPAGE MANAGER
// ==========================================================================
function renderHomepageManager() {
  const cfg = AdminDashboard.homepageConfig;
  document.getElementById('hp-hero-heading').value = cfg.heroHeading || '';
  document.getElementById('hp-hero-sub').value = cfg.heroSub || '';
  document.getElementById('hp-hero-image').value = cfg.heroImage || '';
  document.getElementById('hp-hero-preview').src = cfg.heroImage || '';
}

async function saveHomepageConfig(e) {
  e.preventDefault();
  const heroHeading = document.getElementById('hp-hero-heading').value.trim();
  const heroSub = document.getElementById('hp-hero-sub').value.trim();
  const heroImage = document.getElementById('hp-hero-image').value.trim();

  AdminDashboard.homepageConfig = {
    heroHeading,
    heroSubtitle: heroSub,
    heroSub,
    heroImage
  };

  await window.CarService.saveHomepageConfig(AdminDashboard.homepageConfig);
  showToast('Homepage configuration saved successfully!');
  logActivity('Updated Homepage content');
}

// ==========================================================================
// 7. BRANCHES & MEDIA & SETTINGS & LOGS
// ==========================================================================
function renderBranchesList() {
  const container = document.getElementById('branches-cards-container');
  if (!container) return;

  container.innerHTML = AdminDashboard.branches.map(br => `
    <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); position: relative;">
      ${br.isPrimary ? '<span style="position: absolute; top: 12px; right: 12px; background: var(--admin-lime); color: #071426; font-size: 0.68rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: var(--radius-full);">HEAD OFFICE</span>' : ''}
      <h3 style="font-size: 1.15rem; font-weight: 800; color: #071426; margin-bottom: 0.65rem;">${br.name}</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;"><i class="fas fa-map-marker-alt text-red"></i> ${br.address}</p>
      <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; color: #374151;">
        <div><strong>Phone:</strong> ${br.phone}</div>
        <div><strong>WhatsApp:</strong> ${br.whatsapp}</div>
        <div><strong>Hours:</strong> ${br.hours}</div>
      </div>
    </div>
  `).join('');
}

function renderMediaLibrary() {
  const grid = document.getElementById('media-library-grid');
  if (!grid) return;

  // Gather all images from cars and homepage
  let allMedia = [];
  AdminDashboard.cars.forEach(c => {
    if (c.image_url) allMedia.push({ url: c.image_url, label: c.title });
    if (c.gallery && Array.isArray(c.gallery)) {
      c.gallery.forEach(g => { if (g !== c.image_url) allMedia.push({ url: g, label: c.title }); });
    }
  });

  if (AdminDashboard.homepageConfig.heroImage) {
    allMedia.push({ url: AdminDashboard.homepageConfig.heroImage, label: 'Hero Image' });
  }

  grid.innerHTML = allMedia.map((m, idx) => `
    <div style="background: white; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
      <div style="height: 130px; background: #071426;">
        <img src="${m.url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${m.label}">
      </div>
      <div style="padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.72rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 120px;">${m.label}</span>
        <button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${m.url}'); showToast('Image URL copied to clipboard!');" title="Copy URL">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderSettings() {
  const s = AdminDashboard.settings;
  document.getElementById('set-biz-name').value = s.businessName || '';
  document.getElementById('set-biz-addr').value = s.address || '';
  document.getElementById('set-biz-phone1').value = s.phone1 || '';
  document.getElementById('set-biz-phone2').value = s.phone2 || '';
  document.getElementById('set-biz-wa').value = s.whatsapp || '';
  document.getElementById('set-biz-email').value = s.email || '';
  document.getElementById('set-biz-hours').value = s.hours || '';
}

async function saveSettingsSubmit(e) {
  e.preventDefault();
  AdminDashboard.settings = {
    businessName: document.getElementById('set-biz-name').value.trim(),
    address: document.getElementById('set-biz-addr').value.trim(),
    phone1: document.getElementById('set-biz-phone1').value.trim(),
    phone2: document.getElementById('set-biz-phone2').value.trim(),
    whatsapp: document.getElementById('set-biz-wa').value.trim(),
    email: document.getElementById('set-biz-email').value.trim(),
    hours: document.getElementById('set-biz-hours').value.trim()
  };
  await window.CarService.saveSettings(AdminDashboard.settings);
  showToast('Settings updated successfully!');
  logActivity('Updated dealership settings');
}

function renderAuditLogs() {
  const list = document.getElementById('audit-logs-list');
  if (!list) return;

  if (AdminDashboard.logs.length === 0) {
    list.innerHTML = `<p class="text-muted" style="padding: 1.5rem;">No activity logged yet.</p>`;
    return;
  }

  list.innerHTML = AdminDashboard.logs.map(log => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-color);">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <i class="fas fa-history text-muted"></i>
        <strong style="font-size: 0.88rem; color: #071426;">${log.action}</strong>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(log.timestamp).toLocaleString()}</span>
    </div>
  `).join('');
}

// Global UI Setup
function setupGlobalListeners() {
  // Sidebar Collapse Toggle
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('admin-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth < 992) {
        sidebar.classList.toggle('mobile-open');
        document.getElementById('sidebar-overlay').classList.toggle('active');
      } else {
        sidebar.classList.toggle('collapsed');
      }
    });
  }

  // Global Search Dropdown
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const drop = document.getElementById('global-search-dropdown');
      if (!drop) return;
      if (!q) { drop.style.display = 'none'; return; }

      const matchedCars = AdminDashboard.cars.filter(c => c.title.toLowerCase().includes(q)).slice(0, 4);
      const matchedEnq = AdminDashboard.enquiries.filter(enq => enq.customer_name.toLowerCase().includes(q) || enq.phone.includes(q)).slice(0, 3);

      if (matchedCars.length === 0 && matchedEnq.length === 0) {
        drop.innerHTML = `<div style="padding: 1rem; font-size: 0.85rem; color: var(--text-muted);">No results for "${q}"</div>`;
      } else {
        let html = '';
        if (matchedCars.length > 0) {
          html += `<div style="padding: 0.5rem 0.85rem; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Vehicles</div>`;
          html += matchedCars.map(c => `
            <div style="padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="document.getElementById('global-search-dropdown').style.display='none'; editCarFromDashboard('${c.id}')">
              <span><strong>${c.title}</strong> (${c.year})</span>
              <span style="font-weight: 700; color: #071426;">${formatCurrency(c.price)}</span>
            </div>
          `).join('');
        }
        if (matchedEnq.length > 0) {
          html += `<div style="padding: 0.5rem 0.85rem; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Leads</div>`;
          html += matchedEnq.map(e => `
            <div style="padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="document.getElementById('global-search-dropdown').style.display='none'; navigateTo('enquiries');">
              <span><strong>${e.customer_name}</strong> - ${e.phone}</span>
              <span class="status-pill ${e.status || 'new'}">${e.status || 'New'}</span>
            </div>
          `).join('');
        }
        drop.innerHTML = html;
      }
      drop.style.display = 'block';
    });
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
}
