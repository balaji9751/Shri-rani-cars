// SHRI RANI CARS - CORE CLIENT JAVASCRIPT & PRODUCT EXPERIENCE

const AppState = {
  cars: [],
  filteredCars: [],
  activeBrand: 'all',
  activeFuel: 'all',
  activeTransmission: 'all',
  activeBodyType: 'all',
  activeBudget: 'all',
  sortBy: 'featured',
  searchQuery: '',
  favorites: JSON.parse(localStorage.getItem('shri_rani_favs_v2') || '[]'),
  currentCar: null,
  currentGalleryIdx: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  initToastShelf();
  initHeroCarousel();
  await loadInventory();
  await syncHomepageFromConfig();
  initListeners();
  initStandaloneCalculator();
  updateWishlistCount();

  // Check URL hash for direct car linking e.g. #car_101
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);

  // Realtime Supabase Sync Listeners
  window.addEventListener('shri_rani_cars_sync', async (e) => {
    console.log('⚡ Realtime cars update received in Showroom App:', e.detail);
    await loadInventory();
  });

  window.addEventListener('shri_rani_settings_sync', async (e) => {
    console.log('⚡ Realtime settings update received in Showroom App:', e.detail);
    await syncHomepageFromConfig();
  });
});

async function syncHomepageFromConfig() {
  try {
    const config = await window.CarService.getHomepageConfig();
    if (config) {
      const sliderWrap = document.getElementById('hero-slider-wrap');
      if (sliderWrap && Array.isArray(config.heroBanners) && config.heroBanners.length > 0) {
        const activeBanners = config.heroBanners.filter(b => b.active !== false);
        if (activeBanners.length > 0) {
          const slidesHtml = activeBanners.map((banner, idx) => `
            <div class="hero-slide ${idx === 0 ? 'active' : ''}">
              <img src="${banner.image}" alt="${banner.heading || 'Sri Rani Cars'}" loading="lazy">
              <div class="hero-slide-caption">
                <span class="hero-slide-tag"><i class="fas ${banner.tagIcon || 'fa-certificate'} text-primary"></i> ${banner.tag || 'Certified Pre-Owned'}</span>
                <h2>${banner.heading || 'Tested, Certified & Road Ready'}</h2>
                <p>${banner.sub || '140-Point Quality Inspection • Instant Financing'}</p>
              </div>
            </div>
          `).join('');

          const dotsHtml = `
            <div class="hero-carousel-dots" id="hero-carousel-dots">
              ${activeBanners.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" onclick="goToHeroSlide(${idx})"></span>`).join('')}
            </div>
          `;

          sliderWrap.innerHTML = slidesHtml + dotsHtml;
          initHeroCarousel();
          return;
        }
      }

      const headingEl = document.getElementById('hero-main-heading');
      const subEl = document.getElementById('hero-main-sub');
      const imgEl = document.getElementById('hero-main-img');

      if (headingEl && config.heroHeading) {
        headingEl.innerHTML = config.heroHeading.replace(/\n/g, '<br>');
      }
      if (subEl && config.heroSubtitle) {
        subEl.textContent = config.heroSubtitle;
      }
      if (imgEl && config.heroImage) {
        imgEl.src = config.heroImage;
      }
    }
  } catch (e) {
    console.warn('Homepage sync error:', e);
  }
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

function initToastShelf() {
  if (!document.getElementById('toast-shelf')) {
    const shelf = document.createElement('div');
    shelf.id = 'toast-shelf';
    shelf.className = 'toast-shelf';
    document.body.appendChild(shelf);
  }
}

// Fetch Inventory from Supabase / Data Service
async function loadInventory() {
  const grid = document.getElementById('inventory-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1rem;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary);"></i>
        <h3 style="margin-top: 1rem; font-weight: 700; color: #0f172a;">Loading Showroom Cars...</h3>
        <p class="text-muted">Fetching certified pre-owned vehicles from Sri Rani Cars.</p>
      </div>
    `;
  }

  const rawCars = await window.CarService.getCars();
  AppState.cars = rawCars.filter(c => c.status !== 'Hidden' && c.status !== 'Draft');
  renderBrandScroller();
  applyFilters();
}

function formatCurrency(num) {
  if (!num) return '₹ 0';
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(2)} Lakh`;
  }
  return `₹ ${Number(num).toLocaleString('en-IN')}`;
}

function calculateMonthlyEmi(price) {
  const principal = price * 0.8; // 80% loan
  const r = 9.5 / (12 * 100);    // 9.5% annual interest
  const months = 60;             // 5 years
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return `EMI from ₹ ${Math.round(emi).toLocaleString('en-IN')}/mo`;
}

// Brand Filter Scroller
function renderBrandScroller() {
  const box = document.getElementById('brand-scroller-box');
  if (!box) return;

  const counts = { all: AppState.cars.length };
  AppState.cars.forEach(c => {
    const b = c.brand || 'Other';
    counts[b] = (counts[b] || 0) + 1;
  });

  const brands = ['all', ...Object.keys(counts).filter(b => b !== 'all').sort()];

  box.innerHTML = brands.map(brand => {
    const isAll = brand === 'all';
    const label = isAll ? 'All Brands' : brand;
    const isActive = AppState.activeBrand === brand;
    return `
      <button type="button" class="brand-pill ${isActive ? 'active' : ''}" onclick="filterByBrand('${brand}')">
        <span>${label}</span>
        <span class="pill-count">${counts[brand] || 0}</span>
      </button>
    `;
  }).join('');
}

function filterByBrand(brand) {
  AppState.activeBrand = brand;
  renderBrandScroller();
  applyFilters();
}

// Filter Logic
function applyFilters() {
  let list = [...AppState.cars];

  // Brand
  if (AppState.activeBrand !== 'all') {
    list = list.filter(c => (c.brand || '').toLowerCase() === AppState.activeBrand.toLowerCase());
  }

  // Fuel
  if (AppState.activeFuel !== 'all') {
    list = list.filter(c => (c.fuel_type || '').toLowerCase() === AppState.activeFuel.toLowerCase());
  }

  // Transmission
  if (AppState.activeTransmission !== 'all') {
    list = list.filter(c => (c.transmission || '').toLowerCase() === AppState.activeTransmission.toLowerCase());
  }

  // Body Type
  if (AppState.activeBodyType !== 'all') {
    list = list.filter(c => (c.body_type || '').toLowerCase() === AppState.activeBodyType.toLowerCase());
  }

  // Budget
  if (AppState.activeBudget !== 'all') {
    const b = AppState.activeBudget;
    if (b === 'under-8') list = list.filter(c => c.price < 800000);
    else if (b === '8-15') list = list.filter(c => c.price >= 800000 && c.price <= 1500000);
    else if (b === '15-25') list = list.filter(c => c.price >= 1500000 && c.price <= 2500000);
    else if (b === 'above-25') list = list.filter(c => c.price > 2500000);
  }

  // Multi-Attribute Omni-Search Engine
  if (AppState.searchQuery.trim()) {
    const rawTokens = AppState.searchQuery.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    
    list = list.filter(c => {
      const haystack = [
        c.title || '',
        c.brand || '',
        c.model || '',
        c.variant || '',
        c.fuel_type || '',
        c.transmission || '',
        c.body_type || '',
        c.owners || '',
        c.color || '',
        c.rto || '',
        c.insurance || '',
        c.description || '',
        String(c.year || ''),
        String(c.reg_year || ''),
        String(c.kms || ''),
        Array.isArray(c.features) ? c.features.join(' ') : ''
      ].join(' ').toLowerCase();

      return rawTokens.every(token => haystack.includes(token));
    });
  }

  // Sort
  if (AppState.sortBy === 'price-low') list.sort((a, b) => a.price - b.price);
  else if (AppState.sortBy === 'price-high') list.sort((a, b) => b.price - a.price);
  else if (AppState.sortBy === 'year-new') list.sort((a, b) => b.year - a.year);
  else if (AppState.sortBy === 'kms-low') list.sort((a, b) => a.kms - b.kms);
  else list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));

  AppState.filteredCars = list;
  renderInventoryGrid();
  
  const countBadge = document.getElementById('inventory-count-badge');
  if (countBadge) countBadge.textContent = `${AppState.filteredCars.length} Cars Available`;
}

// Omni-Search Modal Controllers
function openSearchModal() {
  const modal = document.getElementById('searchModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('omni-search-input');
    if (input) {
      input.value = AppState.searchQuery;
      setTimeout(() => input.focus(), 100);
    }
    updateSearchFeedback();
  }
}

function closeSearchModal() {
  const modal = document.getElementById('searchModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function handleOmniSearchInput(val) {
  AppState.searchQuery = val;
  applyFilters();
  updateSearchFeedback();
}

function quickOmniSearch(query) {
  const input = document.getElementById('omni-search-input');
  if (input) input.value = query;
  AppState.searchQuery = query;
  applyFilters();
  updateSearchFeedback();
}

function clearOmniSearch() {
  const input = document.getElementById('omni-search-input');
  if (input) input.value = '';
  AppState.searchQuery = '';
  applyFilters();
  updateSearchFeedback();
}

function executeSearchModal() {
  closeSearchModal();
  const invSection = document.getElementById('inventory-section');
  if (invSection) {
    invSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function updateSearchFeedback() {
  const feedback = document.getElementById('search-modal-feedback');
  if (!feedback) return;
  if (!AppState.searchQuery.trim()) {
    feedback.innerHTML = `Showing all <strong>${AppState.cars.length}</strong> available showroom vehicles.`;
  } else {
    feedback.innerHTML = `Found <strong style="color: #16a34a;">${AppState.filteredCars.length}</strong> vehicle${AppState.filteredCars.length === 1 ? '' : 's'} matching "<em>${AppState.searchQuery}</em>"`;
  }
}

// Render Main Showroom Grid
function renderInventoryGrid() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;

  if (AppState.filteredCars.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light);">
        <i class="fas fa-car-side" style="font-size: 3rem; color: #94a3b8; margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">No Matching Vehicles Found</h3>
        <p class="text-muted" style="margin-top: 0.35rem;">Try modifying your search or reset filters to see all available showroom cars.</p>
        <button type="button" class="btn btn-primary" style="margin-top: 1.25rem;" onclick="resetFilters()">
          <i class="fas fa-rotate-left"></i> Reset All Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = AppState.filteredCars.map(car => {
    const isSold = car.status === 'Sold';
    const isFav = isFavorited(car.id);
    const mainImg = car.image_url || (car.gallery && car.gallery[0]) || 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80';
    const origPriceHtml = car.original_price && car.original_price > car.price 
      ? `<span class="price-val-orig">${formatCurrency(car.original_price)}</span>` 
      : '';

    return `
      <div class="car-item-card" onclick="viewCarDetails('${car.id}')">
        <!-- Thumbnail -->
        <div class="car-thumb-wrap">
          <img src="${mainImg}" alt="${car.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80'">
          
          <button type="button" class="btn-card-fav ${isFav ? 'active' : ''}" onclick="toggleFavorite('${car.id}', event)" title="Save to Favorites" aria-label="Save to Favorites">
            <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
          </button>
          
          ${car.is_featured ? '<div class="card-badge-feat"><i class="fas fa-star"></i> Featured</div>' : ''}
          
          <div class="card-badge-status ${car.status === 'Sold' ? 'status-badge-sold' : (car.status === 'Reserved' ? 'status-badge-res' : 'status-badge-avail')}">
            ${car.status || 'Available'}
          </div>
        </div>

        <!-- Content -->
        <div class="card-content-area">
          <div class="card-make-line">${car.brand || 'Vehicle'} • ${car.body_type || 'Car'}</div>
          <h3 class="card-car-title">${car.title}</h3>
          <div class="card-variant-text">${car.variant || 'Standard'}</div>

          <!-- Specs Matrix -->
          <div class="card-specs-matrix">
            <div class="matrix-col">
              <i class="fas fa-calendar-alt"></i>
              <span class="matrix-val">${car.year || '2022'}</span>
              <span class="matrix-lbl">Year</span>
            </div>
            <div class="matrix-col">
              <i class="fas fa-tachometer-alt"></i>
              <span class="matrix-val">${(car.kms || 0).toLocaleString('en-IN')} km</span>
              <span class="matrix-lbl">Driven</span>
            </div>
            <div class="matrix-col">
              <i class="fas fa-gas-pump"></i>
              <span class="matrix-val">${car.fuel_type || 'Petrol'}</span>
              <span class="matrix-lbl">Fuel</span>
            </div>
            <div class="matrix-col">
              <i class="fas fa-cogs"></i>
              <span class="matrix-val">${car.transmission || 'Manual'}</span>
              <span class="matrix-lbl">Gear</span>
            </div>
          </div>

          <!-- Price Block -->
          <div class="card-price-block">
            <div class="price-row-wrap">
              <span class="price-val-main">${formatCurrency(car.price)}</span>
              ${origPriceHtml}
            </div>
            <div class="price-meta-subrow">
              <span class="price-emi-text">${calculateMonthlyEmi(car.price)}</span>
              <span class="owner-pill-badge"><i class="fas fa-user-check"></i> ${car.owners || '1st Owner'}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="card-actions-row" onclick="event.stopPropagation()">
            <button type="button" class="btn-card-view" onclick="viewCarDetails('${car.id}')">
              <i class="fas fa-eye"></i> <span>View Details</span>
            </button>
            <a href="https://wa.me/917550172585?text=Hello%20Sri%20Rani%20Cars,%20I%20am%20interested%20in%20*${encodeURIComponent(car.title)}*%20(${car.year},%20${formatCurrency(car.price)}).%20Please%20share%20details." target="_blank" class="btn-card-wa" title="WhatsApp" aria-label="WhatsApp">
              <i class="fab fa-whatsapp"></i>
            </a>
            <a href="tel:9750332585" class="btn-card-call" title="Call Showroom" aria-label="Call">
              <i class="fas fa-phone-alt"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resetFilters() {
  AppState.activeBrand = 'all';
  AppState.activeFuel = 'all';
  AppState.activeTransmission = 'all';
  AppState.activeBodyType = 'all';
  AppState.activeBudget = 'all';
  AppState.searchQuery = '';
  AppState.sortBy = 'featured';

  const sInput = document.getElementById('search-input-box');
  if (sInput) sInput.value = '';

  const fuelSel = document.getElementById('fuel-select-ctrl');
  if (fuelSel) fuelSel.value = 'all';

  const transSel = document.getElementById('trans-select-ctrl');
  if (transSel) transSel.value = 'all';

  const budgetSel = document.getElementById('budget-select-ctrl');
  if (budgetSel) budgetSel.value = 'all';

  const sortSel = document.getElementById('sort-select-ctrl');
  if (sortSel) sortSel.value = 'featured';

  document.querySelectorAll('.pill-tag-btn').forEach(btn => btn.classList.remove('active'));

  renderBrandScroller();
  applyFilters();
}

// ==========================================================================
// ==========================================================================
// FULL-PAGE FLIPKART/AMAZON STYLE CAR PRODUCT VIEW
// ==========================================================================
function viewCarDetails(carId) {
  const car = AppState.cars.find(c => String(c.id) === String(carId));
  if (!car) return;

  AppState.currentCar = car;
  AppState.currentGalleryIdx = 0;

  // Hide Main Landing & Show Product Page View
  const mainShowroom = document.getElementById('main-showroom-view');
  if (mainShowroom) mainShowroom.style.display = 'none';
  
  const productView = document.getElementById('product-page-view');
  if (productView) productView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Dynamic SEO Title & Schema update
  document.title = `${car.title || 'Car'} (${car.year || ''}) for Sale | Shri Rani Cars Vazhapadi, Salem`;
  updateCarStructuredData(car);

  // Update URL hash
  history.pushState(null, '', `#car/${car.id}`);

  // Populate Breadcrumb
  const breadcrumbEl = document.getElementById('breadcrumb-car-name');
  if (breadcrumbEl) breadcrumbEl.textContent = car.title || 'Vehicle Details';

  // Title, Brand Tag & Header
  const brandTagEl = document.getElementById('product-brand-tag');
  if (brandTagEl) brandTagEl.textContent = `${car.brand || 'SRI RANI'}`;

  const titleMainEl = document.getElementById('product-title-main');
  if (titleMainEl) titleMainEl.textContent = car.title || 'Certified Pre-Owned Vehicle';

  // Quick Highlights Row
  const yearBadge = document.getElementById('product-year-badge');
  if (yearBadge) yearBadge.textContent = car.year || '2022';

  const kmBadge = document.getElementById('product-km-badge');
  if (kmBadge) kmBadge.textContent = `${(car.kms || 0).toLocaleString('en-IN')} km`;

  const fuelBadge = document.getElementById('product-fuel-badge');
  if (fuelBadge) fuelBadge.textContent = car.fuel_type || 'Petrol';

  const transBadge = document.getElementById('product-trans-badge');
  if (transBadge) transBadge.textContent = car.transmission || 'Manual';

  const ownerBadge = document.getElementById('product-owner-badge');
  if (ownerBadge) ownerBadge.textContent = car.owners || '1st Owner';

  // Price & Savings Card
  const priceValEl = document.getElementById('product-price-val');
  if (priceValEl) priceValEl.textContent = formatCurrency(car.price);

  const origPriceWrap = document.getElementById('product-orig-price-wrap');
  const origPriceValEl = document.getElementById('product-orig-price-val');
  if (origPriceWrap && origPriceValEl) {
    if (car.original_price && car.original_price > car.price) {
      origPriceValEl.textContent = formatCurrency(car.original_price);
      origPriceWrap.style.display = 'block';
    } else {
      origPriceWrap.style.display = 'none';
    }
  }

  // Monthly EMI
  const emiValEl = document.getElementById('product-emi-val');
  if (emiValEl) emiValEl.textContent = `EMI starts at ${calculateMonthlyEmi(car.price)}/month`;

  // Status Badge
  const statusBadge = document.getElementById('product-status-tag');
  if (statusBadge) {
    const isSold = car.status === 'Sold';
    statusBadge.textContent = isSold ? 'Sold Out' : (car.status || 'Available in Stock');
    statusBadge.className = `product-status-badge ${isSold ? 'status-sold' : ''}`;
  }

  // Favorite Button
  const favBtn = document.getElementById('product-fav-btn');
  if (favBtn) {
    const isFav = isFavorited(car.id);
    favBtn.className = `btn-fav-round ${isFav ? 'active' : ''}`;
    favBtn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-heart"></i>`;
  }

  // Robust Gallery & Image Setup
  let gallery = [];
  if (Array.isArray(car.gallery) && car.gallery.length > 0) {
    gallery = car.gallery.filter(Boolean);
  } else if (typeof car.gallery === 'string' && car.gallery.trim()) {
    try {
      const parsed = JSON.parse(car.gallery);
      if (Array.isArray(parsed)) gallery = parsed.filter(Boolean);
      else gallery = [car.gallery.trim()];
    } catch (e) {
      gallery = car.gallery.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (car.image_url && !gallery.includes(car.image_url)) {
    gallery.unshift(car.image_url);
  }

  if (gallery.length === 0) {
    gallery = ['icons/app-logo.png'];
  }

  AppState.currentGallery = gallery;
  AppState.currentGalleryIdx = 0;
  renderProductGallery(gallery);

  // Technical Specs Grid
  const bodyVal = document.getElementById('spec-body-val');
  if (bodyVal) bodyVal.textContent = car.body_type || 'Sedan / Hatchback';

  const colorVal = document.getElementById('spec-color-val');
  if (colorVal) colorVal.textContent = car.color || 'Standard';

  const insVal = document.getElementById('spec-ins-val');
  if (insVal) insVal.textContent = car.insurance || 'Comprehensive Valid';

  const rtoVal = document.getElementById('spec-rto-val');
  if (rtoVal) rtoVal.textContent = car.rto || 'TN 54 (Salem)';

  // Key Features & Safety Equipment
  const featBox = document.getElementById('product-features-box');
  if (featBox) {
    const defaultFeatures = ['Touchscreen Infotainment', 'Dual Airbags', 'ABS with EBD', 'Power Steering & Windows', 'Reverse Parking Sensors', 'Alloy Wheels', 'Rear AC Vents', 'Remote Central Locking'];
    const featList = (car.features && Array.isArray(car.features) && car.features.length > 0)
      ? car.features
      : defaultFeatures;

    featBox.innerHTML = featList.map(f => `
      <span class="feat-tag"><i class="fas fa-check-circle" style="color: #16a34a;"></i> ${f}</span>
    `).join('');
  }

  // Vehicle Overview Description
  const descEl = document.getElementById('product-desc-paragraph');
  if (descEl) {
    descEl.textContent = car.description || `${car.title} is a genuine certified pre-owned vehicle in pristine condition. Non-accidental, fully inspected by our master technicians, and ready for immediate delivery at Sri Rani Cars showroom, Salem & Vazhapadi.`;
  }

  // Conversion CTAs
  const waBtn = document.getElementById('product-whatsapp-cta');
  if (waBtn) {
    waBtn.onclick = handleProductWhatsAppInquiry;
  }

  const callBtn = document.getElementById('product-call-cta');
  if (callBtn) {
    callBtn.href = 'tel:9750332585';
  }

  // Render All Available / Similar Cars Below Details View
  renderSimilarCars(car);
}

// Dedicated WhatsApp Inquiry Handler with Full Vehicle Details
function handleProductWhatsAppInquiry(e) {
  if (e) e.preventDefault();
  const car = AppState.currentCar;
  if (!car) return;

  const phone = '917550172585';
  const priceText = formatCurrency(car.price);
  const msg = [
    `🚗 *SRI RANI CARS — SHOWROOM VEHICLE INQUIRY*`,
    `---------------------------------------------`,
    `📌 *Vehicle:* ${car.title || 'Car'}`,
    `💰 *Price:* ${priceText}`,
    `📅 *Reg. Year:* ${car.year || 'N/A'}`,
    `⛽ *Fuel Type:* ${car.fuel_type || 'Petrol'}`,
    `⚙️ *Transmission:* ${car.transmission || 'Manual'}`,
    `🛣️ *Kilometers:* ${(car.kms || 0).toLocaleString('en-IN')} km`,
    `👤 *Ownership:* ${car.owners || '1st Owner'}`,
    `🎨 *Color:* ${car.color || 'Standard'}`,
    `📍 *RTO / Location:* ${car.rto || 'TN 54 (Salem)'}`,
    `---------------------------------------------`,
    `Hello Sri Rani Cars! I am interested in purchasing / inspecting this vehicle. Please share full photos, service records, and test drive booking details.`
  ].join('\n');

  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

function renderProductGallery(gallery) {
  const mainImg = document.getElementById('product-main-view-image');
  const thumbsBox = document.getElementById('product-thumbnails-box');

  if (mainImg && gallery.length > 0) {
    const activeImg = gallery[AppState.currentGalleryIdx] || gallery[0];
    mainImg.src = activeImg;
  }

  if (thumbsBox) {
    if (gallery.length > 1) {
      thumbsBox.style.display = 'flex';
      thumbsBox.innerHTML = gallery.map((img, idx) => `
        <img src="${img}" class="product-thumb-item ${idx === AppState.currentGalleryIdx ? 'active' : ''}" onclick="setProductGalleryIdx(${idx})" alt="Thumbnail ${idx + 1}" onerror="this.onerror=null; this.src='icons/app-logo.png';">
      `).join('');
    } else {
      thumbsBox.style.display = 'none';
      thumbsBox.innerHTML = '';
    }
  }
}

function setProductGalleryIdx(idx) {
  const gallery = AppState.currentGallery || [];
  if (idx >= 0 && idx < gallery.length) {
    AppState.currentGalleryIdx = idx;
    renderProductGallery(gallery);
  }
}

function toggleFavoriteFromProduct() {
  if (!AppState.currentCar) return;
  toggleFavorite(AppState.currentCar.id);
  const favBtn = document.getElementById('product-fav-btn');
  if (favBtn) {
    const isFav = isFavorited(AppState.currentCar.id);
    favBtn.className = `btn-fav-round ${isFav ? 'active' : ''}`;
    favBtn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-heart"></i>`;
  }
}

function openTestDriveModalForCurrentCar() {
  const carTitle = AppState.currentCar ? AppState.currentCar.title : '';
  openTestDriveModal(carTitle);
}

// Back to Showroom List
function backToShowroom() {
  const productView = document.getElementById('product-page-view');
  if (productView) productView.classList.remove('active');
  const mainShowroom = document.getElementById('main-showroom-view');
  if (mainShowroom) mainShowroom.style.display = 'block';
  
  // Restore Homepage SEO Title & Remove Car Schema
  document.title = 'Shri Rani Cars — Pre-Owned Luxury Cars Showroom | Vazhapadi, Salem';
  const dynamicSchema = document.getElementById('dynamic-car-jsonld');
  if (dynamicSchema) dynamicSchema.remove();

  history.pushState(null, '', window.location.pathname);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dynamic Schema.org Car JSON-LD Generator
function updateCarStructuredData(car) {
  if (!car) return;
  let dynamicScript = document.getElementById('dynamic-car-jsonld');
  if (!dynamicScript) {
    dynamicScript = document.createElement('script');
    dynamicScript.id = 'dynamic-car-jsonld';
    dynamicScript.type = 'application/ld+json';
    document.head.appendChild(dynamicScript);
  }

  const carSchema = {
    "@context": "https://schema.org",
    "@type": "Car",
    "name": car.title || "Pre-Owned Car",
    "brand": {
      "@type": "Brand",
      "name": car.brand || "Multi-Brand"
    },
    "model": car.title || "Vehicle",
    "productionDate": String(car.year || 2022),
    "vehicleModelDate": String(car.year || 2022),
    "mileageFromOdometer": {
      "@type": "QuantitativeValue",
      "value": car.kms || 0,
      "unitCode": "KMT"
    },
    "fuelType": car.fuel_type || "Petrol",
    "vehicleTransmission": car.transmission || "Manual",
    "color": car.color || "Standard",
    "bodyType": car.body_type || "Car",
    "image": car.image_url || "https://shriranicars.com/icons/icon-512.png",
    "offers": {
      "@type": "Offer",
      "price": car.price || 0,
      "priceCurrency": "INR",
      "availability": car.status === 'Sold' ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      "seller": {
        "@type": "AutoDealer",
        "name": "Shri Rani Cars",
        "telephone": "+919750332585",
        "url": "https://shriranicars.com/"
      }
    }
  };

  dynamicScript.textContent = JSON.stringify(carSchema, null, 2);
}

// Render All Other Available Cars Below Product View (Grid style)
function renderSimilarCars(currentCar) {
  const container = document.getElementById('similar-cars-grid');
  if (!container) return;

  // Get all other available cars in inventory (excluding current car)
  let otherCars = AppState.cars.filter(c => String(c.id) !== String(currentCar.id));

  // Prioritize cars with same brand or same body type, then show all remaining
  otherCars.sort((a, b) => {
    let scoreA = (a.brand === currentCar.brand ? 3 : 0) + (a.body_type === currentCar.body_type ? 2 : 0) + (a.fuel_type === currentCar.fuel_type ? 1 : 0);
    let scoreB = (b.brand === currentCar.brand ? 3 : 0) + (b.body_type === currentCar.body_type ? 2 : 0) + (b.fuel_type === currentCar.fuel_type ? 1 : 0);
    return scoreB - scoreA;
  });

  if (otherCars.length === 0) {
    container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem 0;">No other cars available at this moment.</p>';
    return;
  }

  container.innerHTML = otherCars.map(car => `
    <div class="car-item-card" onclick="viewCarDetails('${car.id}')">
      <div class="car-thumb-wrap">
        <img src="${car.image_url || 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80'}" alt="${car.title}" onerror="this.src='https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80'">
        <div class="card-badge-status ${car.status === 'Sold' ? 'status-badge-sold' : 'status-badge-avail'}">
          ${car.status || 'Available'}
        </div>
      </div>
      <div class="card-content-area">
        <div class="card-make-line">${car.brand || 'CERTIFIED'}</div>
        <h3 class="card-car-title">${car.title}</h3>
        <div class="card-meta-line">
          <span><i class="fas fa-calendar-alt"></i> ${car.year}</span>
          <span><i class="fas fa-gas-pump"></i> ${car.fuel_type}</span>
          <span><i class="fas fa-tachometer-alt"></i> ${(car.kms || 0).toLocaleString('en-IN')} km</span>
        </div>
        <div class="card-price-row">
          <div class="card-price-tag">${formatCurrency(car.price)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// Handle Direct URL hash navigation e.g. #car/car_101
function handleHashNavigation() {
  const hash = window.location.hash;
  if (hash.startsWith('#car/')) {
    const carId = hash.replace('#car/', '');
    if (AppState.cars.length > 0) {
      viewCarDetails(carId);
    } else {
      setTimeout(() => viewCarDetails(carId), 500);
    }
  }
}

// Standalone EMI Calculator
function initStandaloneCalculator() {
  const amountSlider = document.getElementById('calc-amount-slider');
  const rateSlider = document.getElementById('calc-rate-slider');
  const tenureSlider = document.getElementById('calc-tenure-slider');

  if (!amountSlider || !rateSlider || !tenureSlider) return;

  const update = () => {
    const principal = Number(amountSlider.value);
    const rate = Number(rateSlider.value);
    const months = Number(tenureSlider.value) * 12;

    document.getElementById('calc-amount-val').textContent = formatCurrency(principal);
    document.getElementById('calc-rate-val').textContent = `${rate}% p.a.`;
    document.getElementById('calc-tenure-val').textContent = `${tenureSlider.value} Years (${months} Mos)`;

    const r = rate / (12 * 100);
    const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    const totalPayable = emi * months;
    const totalInterest = totalPayable - principal;

    document.getElementById('calc-emi-result').textContent = `₹ ${Math.round(emi).toLocaleString('en-IN')}`;
    document.getElementById('calc-total-interest').textContent = `₹ ${Math.round(totalInterest).toLocaleString('en-IN')}`;
    document.getElementById('calc-total-payable').textContent = `₹ ${Math.round(totalPayable).toLocaleString('en-IN')}`;
  };

  amountSlider.addEventListener('input', update);
  rateSlider.addEventListener('input', update);
  tenureSlider.addEventListener('input', update);
  update();
}

// Wishlist / Saved Cars Count
function updateWishlistCount() {
  const countEls = document.querySelectorAll('.wishlist-counter');
  countEls.forEach(el => {
    el.textContent = AppState.favorites.length;
    el.style.display = AppState.favorites.length > 0 ? 'inline-flex' : 'none';
  });
}

// Test Drive Modal
function openTestDriveModal(carTitle = '') {
  const modal = document.getElementById('testDriveModal');
  const carInput = document.getElementById('td-car-name');
  if (carInput) {
    carInput.value = carTitle || (AppState.currentCar ? AppState.currentCar.title : '');
  }
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeTestDriveModal() {
  const modal = document.getElementById('testDriveModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

async function handleTestDriveSubmit(e) {
  e.preventDefault();
  const carName = document.getElementById('td-car-name').value;
  const name = document.getElementById('td-user-name').value;
  const phone = document.getElementById('td-user-phone').value;
  const date = document.getElementById('td-date').value;
  const city = document.getElementById('td-city').value;

  const enquiry = {
    car_name: carName,
    customer_name: name,
    phone: phone,
    preferred_date: date,
    city: city,
    enquiry_type: 'Test Drive / Showroom Visit'
  };

  await window.CarService.submitEnquiry(enquiry);
  showToast('Test drive request submitted! Opening WhatsApp confirmation...');
  closeTestDriveModal();

  const waMsg = encodeURIComponent(`Hello Sri Rani Cars, I would like to book a Test Drive for *${carName}* on ${date}. My Name: ${name}, Phone: ${phone}, City: ${city}.`);
  window.open(`https://wa.me/917550172585?text=${waMsg}`, '_blank');
}

// Sell Car Modal
function openSellCarModal() {
  const modal = document.getElementById('sellCarModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeSellCarModal() {
  const modal = document.getElementById('sellCarModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

async function handleSellCarSubmit(e) {
  e.preventDefault();
  const brand = document.getElementById('sell-brand').value;
  const model = document.getElementById('sell-model').value;
  const year = document.getElementById('sell-year').value;
  const kms = document.getElementById('sell-kms').value;
  const expectedPrice = document.getElementById('sell-price').value;
  const name = document.getElementById('sell-name').value;
  const phone = document.getElementById('sell-phone').value;
  const city = document.getElementById('sell-city').value;

  const enquiry = {
    car_name: `${year} ${brand} ${model}`,
    kms: kms,
    expected_price: expectedPrice,
    customer_name: name,
    phone: phone,
    city: city,
    enquiry_type: 'Sell Car Valuation'
  };

  await window.CarService.submitEnquiry(enquiry);
  showToast('Valuation request submitted! Opening WhatsApp...');
  closeSellCarModal();

  const waMsg = encodeURIComponent(`Hello Sri Rani Cars, I want to SELL my car:\n- Vehicle: ${year} ${brand} ${model}\n- Kms Driven: ${kms}\n- Expected Price: ${expectedPrice}\n- Name: ${name}\n- Mobile: ${phone}\n- Location: ${city}`);
  window.open(`https://wa.me/917550172585?text=${waMsg}`, '_blank');
}

// Init Event Listeners
function initListeners() {
  const searchInput = document.getElementById('search-input-box');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      applyFilters();
    });
  }

  const heroSearchInput = document.getElementById('hero-quick-search');
  if (heroSearchInput) {
    heroSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        AppState.searchQuery = heroSearchInput.value;
        if (searchInput) searchInput.value = heroSearchInput.value;
        applyFilters();
        document.getElementById('inventory-section').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const fuelSelect = document.getElementById('fuel-select-ctrl');
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      AppState.activeFuel = e.target.value;
      applyFilters();
    });
  }

  const transSelect = document.getElementById('trans-select-ctrl');
  if (transSelect) {
    transSelect.addEventListener('change', (e) => {
      AppState.activeTransmission = e.target.value;
      applyFilters();
    });
  }

  const budgetSelect = document.getElementById('budget-select-ctrl');
  if (budgetSelect) {
    budgetSelect.addEventListener('change', (e) => {
      AppState.activeBudget = e.target.value;
      applyFilters();
    });
  }

  const sortSelect = document.getElementById('sort-select-ctrl');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.sortBy = e.target.value;
      applyFilters();
    });
  }

  document.querySelectorAll('.pill-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.filterType;
      const val = btn.dataset.filterVal;

      if (type === 'fuel') {
        AppState.activeFuel = AppState.activeFuel === val ? 'all' : val;
        if (fuelSelect) fuelSelect.value = AppState.activeFuel;
      } else if (type === 'body') {
        AppState.activeBodyType = AppState.activeBodyType === val ? 'all' : val;
      } else if (type === 'budget') {
        AppState.activeBudget = AppState.activeBudget === val ? 'all' : val;
        if (budgetSelect) budgetSelect.value = AppState.activeBudget;
      }

      document.querySelectorAll(`.pill-tag-btn[data-filter-type="${type}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.filterVal === (type === 'fuel' ? AppState.activeFuel : type === 'body' ? AppState.activeBodyType : AppState.activeBudget));
      });

      applyFilters();
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-layer')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-layer.active').forEach(m => m.classList.remove('active'));
      document.body.style.overflow = '';
    }
  });
}

// ==========================================================================
// HERO BANNER CAROUSEL
// ==========================================================================
let currentHeroSlideIdx = 0;
let heroSlideTimer = null;

function initHeroCarousel() {
  const sliderWrap = document.getElementById('hero-slider-wrap');
  if (!sliderWrap) return;
  
  startHeroAutoSlide();
  
  // Pause on hover, resume on leave
  sliderWrap.addEventListener('mouseenter', () => clearInterval(heroSlideTimer));
  sliderWrap.addEventListener('mouseleave', () => startHeroAutoSlide());
}

function startHeroAutoSlide() {
  clearInterval(heroSlideTimer);
  heroSlideTimer = setInterval(() => {
    const slides = document.querySelectorAll('.hero-slider-wrap .hero-slide');
    if (slides.length <= 1) return;
    currentHeroSlideIdx = (currentHeroSlideIdx + 1) % slides.length;
    showHeroSlide(currentHeroSlideIdx);
  }, 3800);
}

function showHeroSlide(index) {
  const slides = document.querySelectorAll('.hero-slider-wrap .hero-slide');
  const dots = document.querySelectorAll('#hero-carousel-dots .dot');
  if (!slides.length) return;

  currentHeroSlideIdx = index;

  slides.forEach((s, idx) => {
    s.classList.toggle('active', idx === index);
  });

  dots.forEach((d, idx) => {
    d.classList.toggle('active', idx === index);
  });
}

function goToHeroSlide(index) {
  showHeroSlide(index);
  startHeroAutoSlide();
}

// ==========================================================================
// WISHLIST / FAVORITES SYSTEM
// ==========================================================================
function isFavorited(carId) {
  return AppState.favorites.includes(String(carId));
}

function toggleFavorite(carId, e) {
  if (e) e.stopPropagation();
  const idStr = String(carId);
  const idx = AppState.favorites.indexOf(idStr);
  
  if (idx > -1) {
    AppState.favorites.splice(idx, 1);
    showToast('Removed from Saved Vehicles', 'info');
  } else {
    AppState.favorites.push(idStr);
    showToast('❤️ Added to Saved Vehicles!', 'success');
  }

  localStorage.setItem('shri_rani_favs_v2', JSON.stringify(AppState.favorites));
  updateWishlistCount();
  renderInventoryGrid();
  renderFavoritesList();
}

function updateWishlistCount() {
  const count = AppState.favorites.length;
  const badge = document.getElementById('header-fav-count');
  const modalCount = document.getElementById('fav-modal-count');

  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  if (modalCount) {
    modalCount.textContent = count;
  }
}

function openFavoritesModal() {
  renderFavoritesList();
  const modal = document.getElementById('favoritesModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeFavoritesModal() {
  const modal = document.getElementById('favoritesModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function renderFavoritesList() {
  const body = document.getElementById('favorites-modal-body');
  if (!body) return;

  const favCars = AppState.cars.filter(c => AppState.favorites.includes(String(c.id)));

  if (favCars.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <i class="far fa-heart" style="font-size: 3rem; color: #CBD5E1; margin-bottom: 1rem;"></i>
        <h4 style="font-weight: 700; color: #071426; margin-bottom: 0.35rem;">No Saved Vehicles Yet</h4>
        <p class="text-muted" style="font-size: 0.88rem; max-width: 320px; margin: 0 auto 1.25rem;">
          Click the heart icon on any car card to save it for quick reference and comparison.
        </p>
      </div>
    `;
    return;
  }

  body.innerHTML = favCars.map(car => {
    const mainImg = car.image_url || (car.gallery && car.gallery[0]) || 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80';
    return `
      <div class="fav-item-row">
        <img src="${mainImg}" alt="${car.title}" class="fav-item-thumb">
        <div class="fav-item-info">
          <div class="fav-item-title">${car.title}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.2rem;">
            ${car.year} • ${(car.kms || 0).toLocaleString('en-IN')} km • ${car.fuel_type || 'Petrol'}
          </div>
          <div class="fav-item-price">${formatCurrency(car.price)}</div>
        </div>
        <div class="fav-item-actions">
          <button type="button" class="fav-view-btn" onclick="closeFavoritesModal(); viewCarDetails('${car.id}')">
            <i class="fas fa-eye"></i> View
          </button>
          <button type="button" class="fav-remove-btn" onclick="toggleFavorite('${car.id}', event)" title="Remove">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

