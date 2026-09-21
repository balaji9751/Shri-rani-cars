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
  // Mobile Sidebar Toggle
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('admin-sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }

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

function closeMobileSidebar() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
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
async function handleImageFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  showToast(`Optimizing ${files.length} image${files.length > 1 ? 's' : ''} from gallery...`, 'info');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const compressed = await compressImageFile(file, 1200, 800, 0.85);
    AdminDashboard.carFormImages.push(compressed);
  }
  renderImageGalleryThumbnails();
  showToast('Photos added to vehicle gallery!', 'success');
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
          <button type="button" class="btn-thumb-action edit-btn" onclick="openPhotoStudioForCarImage(${idx})" title="Edit / Crop / Zoom Photo">
            <i class="fas fa-crop-alt"></i>
          </button>
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

  try {
    const getVal = (id, defaultVal = '') => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : defaultVal;
    };
    const getNum = (id, defaultVal = 0) => {
      const el = document.getElementById(id);
      const n = Number(el ? el.value : defaultVal);
      return isNaN(n) ? defaultVal : n;
    };
    const getChecked = (id) => {
      const el = document.getElementById(id);
      return el ? el.checked : false;
    };

    const brand = getVal('form-car-brand', 'Maruti Suzuki');
    const model = getVal('form-car-model', '');
    const variant = getVal('form-car-variant', '');
    const year = getNum('form-car-year', 2022);
    const price = getNum('form-car-price', 0);
    const isNegotiable = getChecked('form-car-negotiable');
    const fuel = getVal('form-car-fuel', 'Petrol');
    const transmission = getVal('form-car-trans', 'Manual');
    const kms = getNum('form-car-kms', 0);
    const bodyType = getVal('form-car-body', 'SUV');
    const color = getVal('form-car-color', '');
    const owners = getVal('form-car-owners', '1st Owner');
    const regYear = getNum('form-car-regyear', year);
    const insurance = getVal('form-car-insurance', '');
    const location = getVal('form-car-location', 'TN 54 (Salem)');
    const description = getVal('form-car-desc', '');
    const status = getVal('form-car-status', 'Available');
    const isFeatured = getChecked('form-car-featured');

    const title = `${brand} ${model} ${variant}`.trim();

    // Primary image & gallery
    const gallery = AdminDashboard.carFormImages.length > 0 
      ? [...AdminDashboard.carFormImages] 
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
      features: [...AdminDashboard.carFormFeatures],
      image_url: primaryImage,
      gallery: gallery
    };

    if (AdminDashboard.editingCarId) {
      await window.CarService.updateCar(AdminDashboard.editingCarId, carPayload);
      showToast('Car details updated successfully!', 'success');
      logActivity(`Updated vehicle: ${title}`);
    } else {
      await window.CarService.addCar(carPayload);
      showToast('New car published to showroom!', 'success');
      logActivity(`Published new vehicle: ${title}`);
    }

    await loadDashboardData();
    navigateTo('cars');
  } catch (err) {
    console.error('Car submit error:', err);
    showToast('Failed to save car. Please try again.', 'error');
  }
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
// 6. HOMEPAGE & HERO CAROUSEL BANNERS MANAGER
// ==========================================================================
function renderHomepageManager() {
  const cfg = AdminDashboard.homepageConfig || {};
  
  // Set fallback fields
  const headingEl = document.getElementById('hp-hero-heading');
  const subEl = document.getElementById('hp-hero-sub');
  const imgEl = document.getElementById('hp-hero-image');
  const prevEl = document.getElementById('hp-hero-preview');

  if (headingEl) headingEl.value = cfg.heroHeading || '';
  if (subEl) subEl.value = cfg.heroSubtitle || cfg.heroSub || '';
  if (imgEl) imgEl.value = cfg.heroImage || '';
  if (prevEl) prevEl.src = cfg.heroImage || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';

  renderHeroBannersList();
}

function renderHeroBannersList() {
  const container = document.getElementById('hero-banners-list-container');
  if (!container) return;

  const banners = (AdminDashboard.homepageConfig && Array.isArray(AdminDashboard.homepageConfig.heroBanners)) 
    ? AdminDashboard.homepageConfig.heroBanners 
    : [];

  if (banners.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; background: #F8FAFC; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <i class="fas fa-images" style="font-size: 2.5rem; color: #94A3B8; margin-bottom: 0.75rem;"></i>
        <h4 style="font-size: 1rem; font-weight: 700; color: #071426;">No Banner Slides Added</h4>
        <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 1rem;">Add dynamic hero banner slides that auto-rotate on the showroom landing page.</p>
        <button type="button" class="btn btn-lime btn-sm" onclick="openAddBannerModal()">
          <i class="fas fa-plus-circle"></i> + Add First Banner Slide
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = banners.map((banner, index) => {
    const isActive = banner.active !== false;
    const hasText = !!(banner.heading?.trim() || banner.tag?.trim() || banner.sub?.trim());
    return `
      <div class="banner-slide-admin-card">
        <!-- Left info -->
        <div class="banner-slide-main-info">
          <div class="banner-slide-thumb-box">
            <img src="${banner.image}" alt="${banner.heading || 'Banner'}" style="${banner.pos ? `object-position: ${banner.pos};` : ''} ${banner.filter && banner.filter !== 'none' ? `filter: ${banner.filter};` : ''}">
          </div>
          <div class="banner-slide-details">
            <div class="banner-slide-badges">
              <span class="slide-num-badge">
                Slide #${index + 1}
              </span>
              <span class="slide-status-badge ${isActive ? 'status-live' : 'status-disabled'}">
                ${isActive ? '● Live on Showroom' : '○ Disabled'}
              </span>
              ${hasText ? `
                <span class="slide-tag-badge">
                  <i class="fas ${banner.tagIcon || 'fa-certificate'}"></i> ${banner.tag || 'Caption'}
                </span>
              ` : `
                <span class="slide-bright-badge">
                  ✨ 100% Brightness Photo
                </span>
              `}
            </div>
            <h4 class="slide-heading-text">
              ${banner.heading ? banner.heading : '<span class="slide-pure-photo-hint">📸 Pure Photo Banner (No Text Overlay)</span>'}
            </h4>
            <p class="slide-sub-text">
              ${banner.sub ? banner.sub : 'Displays in full original brightness and clarity on showroom.'}
            </p>
          </div>
        </div>

        <!-- Right actions -->
        <div class="banner-slide-actions-bar">
          <button type="button" class="btn btn-outline btn-sm btn-slide-toggle" onclick="toggleBannerActive('${banner.id}')" title="${isActive ? 'Disable from Showroom' : 'Enable in Showroom'}">
            <i class="fas ${isActive ? 'fa-eye-slash' : 'fa-eye'}"></i> <span>${isActive ? 'Disable' : 'Enable'}</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm btn-slide-edit" onclick="openEditBannerModal('${banner.id}')" title="Edit Slide">
            <i class="fas fa-edit"></i> <span>Edit</span>
          </button>
          <button type="button" class="btn btn-danger-outline btn-sm btn-slide-delete" onclick="deleteBannerSlide('${banner.id}')" title="Delete Slide">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Image File Compressor for Fast Loading on Slow Internet
function compressImageFile(file, maxWidth = 1400, maxHeight = 900, quality = 0.88) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Transform State for Banner Framing
let bannerTransformState = {
  zoom: 100,
  pos: 'center',
  rotate: 0,
  flipH: false,
  flipV: false,
  filter: 'none',
  grid: true
};

// Modal Controllers for Banner Slides
function openAddBannerModal() {
  document.getElementById('banner-modal-title').innerHTML = '<i class="fas fa-plus-circle text-primary"></i> Add Hero Banner Slide';
  document.getElementById('banner-edit-id').value = '';
  document.getElementById('banner-tag-input').value = '';
  document.getElementById('banner-icon-select').value = 'fa-certificate';
  document.getElementById('banner-heading-input').value = '';
  document.getElementById('banner-sub-input').value = '';
  document.getElementById('banner-image-input').value = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
  document.getElementById('banner-preview-img').src = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
  document.getElementById('banner-active-input').checked = true;

  bannerTransformState = {
    zoom: 100,
    pos: 'center',
    rotate: 0,
    flipH: false,
    flipV: false,
    filter: 'none',
    grid: true
  };

  const zoomSlider = document.getElementById('banner-zoom-slider');
  const posSelect = document.getElementById('banner-pos-select');
  if (zoomSlider) zoomSlider.value = 100;
  if (posSelect) posSelect.value = 'center';

  updateBannerFilterButtons('none');
  adjustBannerCrop();
  syncCropLivePreview();

  const modal = document.getElementById('bannerModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function openEditBannerModal(id) {
  const banners = (AdminDashboard.homepageConfig && Array.isArray(AdminDashboard.homepageConfig.heroBanners)) 
    ? AdminDashboard.homepageConfig.heroBanners 
    : [];
  const banner = banners.find(b => String(b.id) === String(id));
  if (!banner) return;

  document.getElementById('banner-modal-title').innerHTML = '<i class="fas fa-edit text-primary"></i> Edit Hero Banner Slide';
  document.getElementById('banner-edit-id').value = banner.id;
  document.getElementById('banner-tag-input').value = banner.tag || '';
  document.getElementById('banner-icon-select').value = banner.tagIcon || 'fa-certificate';
  document.getElementById('banner-heading-input').value = banner.heading || '';
  document.getElementById('banner-sub-input').value = banner.sub || '';
  document.getElementById('banner-image-input').value = banner.image || '';
  document.getElementById('banner-preview-img').src = banner.image || '';
  document.getElementById('banner-active-input').checked = banner.active !== false;

  bannerTransformState = {
    zoom: banner.zoom || 100,
    pos: banner.pos || 'center',
    rotate: banner.rotate || 0,
    flipH: banner.flipH || false,
    flipV: banner.flipV || false,
    filter: banner.filter || 'none',
    grid: true
  };

  const zoomSlider = document.getElementById('banner-zoom-slider');
  const posSelect = document.getElementById('banner-pos-select');
  if (zoomSlider) zoomSlider.value = bannerTransformState.zoom;
  if (posSelect) posSelect.value = bannerTransformState.pos;

  updateBannerFilterButtons(bannerTransformState.filter);
  adjustBannerCrop();
  syncCropLivePreview();

  const modal = document.getElementById('bannerModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeBannerModal() {
  const modal = document.getElementById('bannerModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function handleBannerFileInput(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  showToast('Optimizing mobile photo from gallery...', 'info');
  const compressed = await compressImageFile(file, 1600, 900, 0.88);
  
  const input = document.getElementById('banner-image-input');
  if (input) input.value = compressed;
  
  updateBannerLivePreview(compressed);
  showToast('Photo loaded ready for framing & save!', 'success');
}

function updateBannerLivePreview(url) {
  const prevImg = document.getElementById('banner-preview-img');
  if (prevImg) {
    prevImg.src = url || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
  }
}

function adjustBannerCrop() {
  const zoomSlider = document.getElementById('banner-zoom-slider');
  const zoomVal = document.getElementById('banner-zoom-val');
  const posSelect = document.getElementById('banner-pos-select');
  const prevImg = document.getElementById('banner-preview-img');

  if (zoomSlider) {
    bannerTransformState.zoom = parseInt(zoomSlider.value, 10) || 100;
  }
  if (posSelect) {
    bannerTransformState.pos = posSelect.value;
  }
  if (zoomVal) {
    zoomVal.textContent = `${bannerTransformState.zoom}%`;
  }

  if (prevImg) {
    const scale = bannerTransformState.zoom / 100;
    const scaleX = bannerTransformState.flipH ? -scale : scale;
    const scaleY = bannerTransformState.flipV ? -scale : scale;
    prevImg.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${bannerTransformState.rotate}deg)`;
    prevImg.style.objectPosition = bannerTransformState.pos;
    prevImg.style.filter = bannerTransformState.filter;
  }
}

function stepBannerZoom(delta) {
  const zoomSlider = document.getElementById('banner-zoom-slider');
  if (zoomSlider) {
    let current = parseInt(zoomSlider.value, 10) || 100;
    current = Math.max(50, Math.min(250, current + delta));
    zoomSlider.value = current;
    adjustBannerCrop();
  }
}

function rotateBannerPhoto(deg) {
  bannerTransformState.rotate = (bannerTransformState.rotate + deg) % 360;
  adjustBannerCrop();
  showToast(`Rotated to ${bannerTransformState.rotate}°`, 'info');
}

function flipBannerPhoto(axis) {
  if (axis === 'H') {
    bannerTransformState.flipH = !bannerTransformState.flipH;
  } else if (axis === 'V') {
    bannerTransformState.flipV = !bannerTransformState.flipV;
  }
  adjustBannerCrop();
}

function toggleBannerGrid() {
  const grid = document.getElementById('banner-grid-overlay');
  if (grid) {
    bannerTransformState.grid = !bannerTransformState.grid;
    grid.style.display = bannerTransformState.grid ? 'block' : 'none';
  }
}

function resetBannerCrop() {
  bannerTransformState = {
    zoom: 100,
    pos: 'center',
    rotate: 0,
    flipH: false,
    flipV: false,
    filter: 'none',
    grid: true
  };
  const zoomSlider = document.getElementById('banner-zoom-slider');
  const posSelect = document.getElementById('banner-pos-select');
  if (zoomSlider) zoomSlider.value = 100;
  if (posSelect) posSelect.value = 'center';
  const grid = document.getElementById('banner-grid-overlay');
  if (grid) grid.style.display = 'block';

  updateBannerFilterButtons('none');
  adjustBannerCrop();
  showToast('Framing & filters reset to 100% default', 'info');
}

function setBannerFilter(filterVal, btnEl) {
  bannerTransformState.filter = filterVal;
  updateBannerFilterButtons(filterVal);
  adjustBannerCrop();
}

function updateBannerFilterButtons(activeFilter) {
  const btns = document.querySelectorAll('.banner-filter-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('data-filter') === activeFilter) {
      btn.classList.add('active');
      btn.style.background = '#071426';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#071426';
    } else {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  });
}

function syncCropLivePreview() {
  const headInput = document.getElementById('banner-heading-input');
  const tagInput = document.getElementById('banner-tag-input');
  const iconSelect = document.getElementById('banner-icon-select');
  const cropHead = document.getElementById('crop-head-preview');
  const cropTag = document.getElementById('crop-tag-badge');
  const captionBox = document.getElementById('banner-caption-preview-box');
  const indicator = document.getElementById('banner-brightness-indicator');

  const headText = headInput ? headInput.value.trim() : '';
  const tagText = tagInput ? tagInput.value.trim() : '';
  const icon = iconSelect ? iconSelect.value : 'fa-certificate';

  const hasAnyText = Boolean(headText || tagText);

  if (captionBox) {
    if (hasAnyText) {
      captionBox.style.display = 'block';
      if (cropHead) {
        cropHead.textContent = headText || '';
        cropHead.style.display = headText ? 'block' : 'none';
      }
      if (cropTag) {
        cropTag.innerHTML = `<i class="fas ${icon}"></i> ${tagText}`;
        cropTag.style.display = tagText ? 'inline-block' : 'none';
      }
      if (indicator) {
        indicator.innerHTML = '📝 Caption Overlay Mode';
        indicator.style.color = '#071426';
        indicator.style.background = '#E2E8F0';
      }
    } else {
      captionBox.style.display = 'none';
      if (indicator) {
        indicator.innerHTML = '✨ Full Brightness (Photo Only)';
        indicator.style.color = '#059669';
        indicator.style.background = '#ECFDF5';
      }
    }
  }
}

async function handleBannerSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('banner-edit-id').value;
  const tag = document.getElementById('banner-tag-input').value.trim();
  const tagIcon = document.getElementById('banner-icon-select').value;
  const heading = document.getElementById('banner-heading-input').value.trim();
  const sub = document.getElementById('banner-sub-input').value.trim();
  const image = document.getElementById('banner-image-input').value.trim();
  const active = document.getElementById('banner-active-input').checked;

  if (!AdminDashboard.homepageConfig.heroBanners) {
    AdminDashboard.homepageConfig.heroBanners = [];
  }

  const bannerData = {
    tag,
    tagIcon,
    heading,
    sub,
    image,
    active,
    zoom: bannerTransformState.zoom || 100,
    pos: bannerTransformState.pos || 'center',
    rotate: bannerTransformState.rotate || 0,
    flipH: bannerTransformState.flipH || false,
    flipV: bannerTransformState.flipV || false,
    filter: bannerTransformState.filter || 'none'
  };

  if (editId) {
    // Update existing
    const idx = AdminDashboard.homepageConfig.heroBanners.findIndex(b => String(b.id) === String(editId));
    if (idx !== -1) {
      AdminDashboard.homepageConfig.heroBanners[idx] = {
        ...AdminDashboard.homepageConfig.heroBanners[idx],
        ...bannerData
      };
      showToast('Banner slide updated successfully!');
      logActivity(`Updated hero banner slide: ${heading || 'Photo Slide'}`);
    }
  } else {
    // Add new
    const newBanner = {
      id: 'banner_' + Date.now(),
      ...bannerData
    };
    AdminDashboard.homepageConfig.heroBanners.push(newBanner);
    showToast('New banner slide added to showroom carousel!');
    logActivity(`Added new hero banner slide: ${heading || 'Photo Slide'}`);
  }

  await window.CarService.saveHomepageConfig(AdminDashboard.homepageConfig);
  closeBannerModal();
  renderHeroBannersList();
}

async function toggleBannerActive(id) {
  if (!AdminDashboard.homepageConfig.heroBanners) return;
  const banner = AdminDashboard.homepageConfig.heroBanners.find(b => String(b.id) === String(id));
  if (banner) {
    banner.active = banner.active === false ? true : false;
    await window.CarService.saveHomepageConfig(AdminDashboard.homepageConfig);
    showToast(banner.active ? 'Slide activated on showroom!' : 'Slide disabled from showroom.');
    renderHeroBannersList();
  }
}

async function deleteBannerSlide(id) {
  if (!confirm('Are you sure you want to delete this banner slide?')) return;
  if (!AdminDashboard.homepageConfig.heroBanners) return;

  AdminDashboard.homepageConfig.heroBanners = AdminDashboard.homepageConfig.heroBanners.filter(b => String(b.id) !== String(id));
  await window.CarService.saveHomepageConfig(AdminDashboard.homepageConfig);
  showToast('Banner slide deleted.');
  logActivity('Deleted a hero banner slide');
  renderHeroBannersList();
}

async function saveHomepageConfig(e) {
  e.preventDefault();
  const heroHeading = document.getElementById('hp-hero-heading').value.trim();
  const heroSub = document.getElementById('hp-hero-sub').value.trim();
  const heroImage = document.getElementById('hp-hero-image').value.trim();

  AdminDashboard.homepageConfig = {
    ...AdminDashboard.homepageConfig,
    heroHeading,
    heroSubtitle: heroSub,
    heroSub,
    heroImage
  };

  await window.CarService.saveHomepageConfig(AdminDashboard.homepageConfig);
  showToast('Homepage fallback configuration saved successfully!');
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

// ==========================================================================
// VEHICLE PHOTO STUDIO & CROP EDITOR CONTROLLER
// ==========================================================================
const PhotoStudio = {
  activeIdx: null,
  rawSrc: '',
  aspect: '16-9',
  zoom: 100,
  panX: 0,
  panY: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  showGrid: true
};

function openPhotoStudioForCarImage(idx) {
  const imgUrl = AdminDashboard.carFormImages[idx];
  if (!imgUrl) return;

  PhotoStudio.activeIdx = idx;
  PhotoStudio.rawSrc = imgUrl;
  
  // Reset edits for fresh opening
  PhotoStudio.aspect = '16-9';
  PhotoStudio.zoom = 100;
  PhotoStudio.panX = 0;
  PhotoStudio.panY = 0;
  PhotoStudio.rotate = 0;
  PhotoStudio.flipH = false;
  PhotoStudio.flipV = false;
  PhotoStudio.brightness = 100;
  PhotoStudio.contrast = 100;
  PhotoStudio.showGrid = true;

  // Sync Slider UI
  syncStudioSlidersToState();

  // Populate Images
  const editorImg = document.getElementById('studio-editor-image');
  const deskImg = document.getElementById('studio-desktop-preview-img');
  const mobImg = document.getElementById('studio-mobile-preview-img');
  const carNamePrev = document.getElementById('studio-preview-car-name');

  const currentCarName = (document.getElementById('form-car-title') && document.getElementById('form-car-title').value.trim()) 
    || 'Certified Vehicle';
  if (carNamePrev) carNamePrev.textContent = currentCarName;

  if (editorImg) editorImg.src = imgUrl;
  if (deskImg) deskImg.src = imgUrl;
  if (mobImg) mobImg.src = imgUrl;

  // Apply default 16:9 aspect ratio pill
  document.querySelectorAll('.studio-aspect-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
  const viewport = document.getElementById('studio-viewport');
  if (viewport) {
    viewport.className = 'studio-canvas-viewport aspect-16-9';
  }

  applyStudioTransforms();

  const modal = document.getElementById('carPhotoStudioModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closePhotoStudioModal() {
  const modal = document.getElementById('carPhotoStudioModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function setStudioAspect(aspectKey, btnEl) {
  PhotoStudio.aspect = aspectKey;
  document.querySelectorAll('.studio-aspect-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const viewport = document.getElementById('studio-viewport');
  if (viewport) {
    viewport.className = `studio-canvas-viewport aspect-${aspectKey}`;
  }
  applyStudioTransforms();
}

function rotateStudioPhoto(degrees) {
  PhotoStudio.rotate = (PhotoStudio.rotate + degrees) % 360;
  applyStudioTransforms();
}

function flipStudioPhoto(axis) {
  if (axis === 'H') PhotoStudio.flipH = !PhotoStudio.flipH;
  if (axis === 'V') PhotoStudio.flipV = !PhotoStudio.flipV;
  applyStudioTransforms();
}

function toggleStudioGrid() {
  PhotoStudio.showGrid = !PhotoStudio.showGrid;
  const grid = document.getElementById('studio-grid-lines');
  if (grid) grid.style.display = PhotoStudio.showGrid ? 'block' : 'none';
}

function resetStudioEdits() {
  PhotoStudio.zoom = 100;
  PhotoStudio.panX = 0;
  PhotoStudio.panY = 0;
  PhotoStudio.rotate = 0;
  PhotoStudio.flipH = false;
  PhotoStudio.flipV = false;
  PhotoStudio.brightness = 100;
  PhotoStudio.contrast = 100;

  syncStudioSlidersToState();
  applyStudioTransforms();
  showToast('All image adjustments reset', 'info');
}

function syncStudioSlidersToState() {
  const zEl = document.getElementById('studio-zoom');
  const pyEl = document.getElementById('studio-pan-y');
  const pxEl = document.getElementById('studio-pan-x');
  const brEl = document.getElementById('studio-brightness');
  const ctEl = document.getElementById('studio-contrast');

  if (zEl) zEl.value = PhotoStudio.zoom;
  if (pyEl) pyEl.value = PhotoStudio.panY;
  if (pxEl) pxEl.value = PhotoStudio.panX;
  if (brEl) brEl.value = PhotoStudio.brightness;
  if (ctEl) ctEl.value = PhotoStudio.contrast;

  updateSliderValueLabels();
}

function updateSliderValueLabels() {
  const zLbl = document.getElementById('studio-zoom-val');
  const pyLbl = document.getElementById('studio-pan-y-val');
  const pxLbl = document.getElementById('studio-pan-x-val');
  const brLbl = document.getElementById('studio-brightness-val');
  const ctLbl = document.getElementById('studio-contrast-val');

  if (zLbl) zLbl.textContent = `${PhotoStudio.zoom}%`;
  if (pyLbl) pyLbl.textContent = `${PhotoStudio.panY}px`;
  if (pxLbl) pxLbl.textContent = `${PhotoStudio.panX}px`;
  if (brLbl) brLbl.textContent = `${PhotoStudio.brightness}%`;
  if (ctLbl) ctLbl.textContent = `${PhotoStudio.contrast}%`;
}

function applyStudioTransforms() {
  // Read current slider inputs if available
  const zEl = document.getElementById('studio-zoom');
  const pyEl = document.getElementById('studio-pan-y');
  const pxEl = document.getElementById('studio-pan-x');
  const brEl = document.getElementById('studio-brightness');
  const ctEl = document.getElementById('studio-contrast');

  if (zEl) PhotoStudio.zoom = Number(zEl.value);
  if (pyEl) PhotoStudio.panY = Number(pyEl.value);
  if (pxEl) PhotoStudio.panX = Number(pxEl.value);
  if (brEl) PhotoStudio.brightness = Number(brEl.value);
  if (ctEl) PhotoStudio.contrast = Number(ctEl.value);

  updateSliderValueLabels();

  const scale = PhotoStudio.zoom / 100;
  const scaleX = PhotoStudio.flipH ? -1 : 1;
  const scaleY = PhotoStudio.flipV ? -1 : 1;
  const transformCss = `translate(${PhotoStudio.panX}px, ${PhotoStudio.panY}px) scale(${scale}) rotate(${PhotoStudio.rotate}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
  const filterCss = `brightness(${PhotoStudio.brightness}%) contrast(${PhotoStudio.contrast}%)`;

  // Apply to Main Editor
  const editorImg = document.getElementById('studio-editor-image');
  if (editorImg) {
    editorImg.style.transform = transformCss;
    editorImg.style.filter = filterCss;
  }

  // Apply to Desktop Live Preview
  const deskImg = document.getElementById('studio-desktop-preview-img');
  if (deskImg) {
    deskImg.style.transform = transformCss;
    deskImg.style.filter = filterCss;
  }

  // Apply to Mobile Live Preview
  const mobImg = document.getElementById('studio-mobile-preview-img');
  if (mobImg) {
    mobImg.style.transform = transformCss;
    mobImg.style.filter = filterCss;
  }
}

// Render edited photo to high-res canvas and save to inventory gallery
async function saveStudioEditedPhoto() {
  if (PhotoStudio.activeIdx === null || !PhotoStudio.rawSrc) return;

  showToast('Rendering high-res edited car photo...', 'info');

  try {
    const canvas = document.createElement('canvas');
    let outW = 1200;
    let outH = 675; // 16:9

    if (PhotoStudio.aspect === '4-3') { outW = 1200; outH = 900; }
    else if (PhotoStudio.aspect === '3-2') { outW = 1200; outH = 800; }
    else if (PhotoStudio.aspect === '1-1') { outW = 1000; outH = 1000; }

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = PhotoStudio.rawSrc;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image for rendering'));
    });

    // Draw background
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, outW, outH);

    // Apply Filter on Canvas Context
    ctx.filter = `brightness(${PhotoStudio.brightness}%) contrast(${PhotoStudio.contrast}%)`;

    // Apply Transformations
    ctx.save();
    ctx.translate(outW / 2 + PhotoStudio.panX * (outW / 360), outH / 2 + PhotoStudio.panY * (outH / 240));
    ctx.rotate((PhotoStudio.rotate * Math.PI) / 180);
    ctx.scale(
      (PhotoStudio.zoom / 100) * (PhotoStudio.flipH ? -1 : 1), 
      (PhotoStudio.zoom / 100) * (PhotoStudio.flipV ? -1 : 1)
    );

    // Draw image centered
    const imgAspect = img.width / img.height;
    const targetAspect = outW / outH;
    let renderW = outW;
    let renderH = outH;

    if (imgAspect > targetAspect) {
      renderW = outH * imgAspect;
      renderH = outH;
    } else {
      renderW = outW;
      renderH = outW / imgAspect;
    }

    ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
    ctx.restore();

    // Export as high-quality WebP
    const editedDataUrl = canvas.toDataURL('image/webp', 0.88);
    AdminDashboard.carFormImages[PhotoStudio.activeIdx] = editedDataUrl;

    renderImageGalleryThumbnails();
    closePhotoStudioModal();
    showToast('✨ Photo edits & framing applied to vehicle gallery!', 'success');
  } catch (err) {
    console.error('Studio render error:', err);
    showToast('Failed to render edited photo: ' + err.message, 'error');
  }
}

