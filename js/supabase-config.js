// ==========================================================================
// SHRI RANI CARS — MASTER SUPABASE & REALTIME DATA SERVICE
// Fast Real-Time Synchronization with Postgres & Optimistic Local Cache
// ==========================================================================

const SUPABASE_URL = 'https://cuvopwwzauvsulyvaxfn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Sw0TNJ0N6J4YQaghbSYuUw_7q-tujbP';

// Initialize Supabase client
let supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('⚡ Supabase Client initialized successfully');
      return supabaseClient;
    }
  } catch (e) {
    console.warn('Supabase initialization fallback to local storage:', e);
  }
  return null;
}
getSupabaseClient();

// LocalStorage Keys for persistent fallback & offline sync
const STORAGE_KEYS = {
  CARS: 'shri_rani_cars_inventory_v1',
  ENQUIRIES: 'shri_rani_cars_enquiries_v1',
  HOMEPAGE: 'shri_rani_homepage_v1',
  SETTINGS: 'shri_rani_settings_v1',
  BRANCHES: 'shri_rani_branches_v1',
  ADMIN_TOKEN: 'shri_rani_cars_admin_session_v1',
  FAVORITES: 'shri_rani_cars_favs_v1'
};

// Data Service API Wrapper
window.CarService = {
  client: supabaseClient,

  // =========================================================================
  // 1. CAR INVENTORY CRUD (FAST LOCAL-FIRST + BACKGROUND ASYNC SYNC)
  // =========================================================================
  async getCars(options = { backgroundSync: true }) {
    // 1. Return cached cars immediately (0ms response time)
    const localCars = this.getLocalCars();

    // 2. Trigger asynchronous background sync with Supabase without blocking UI
    if (options.backgroundSync) {
      setTimeout(() => this.fetchCarsNetwork(), 10);
    }

    return localCars;
  },

  async fetchCarsNetwork() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await Promise.race([
        client.from('cars').select('*').order('created_at', { ascending: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
      ]);

      if (!error && Array.isArray(data)) {
        const currentLocal = localStorage.getItem(STORAGE_KEYS.CARS);
        const newStr = JSON.stringify(data);
        if (currentLocal !== newStr) {
          localStorage.setItem(STORAGE_KEYS.CARS, newStr);
          this.broadcastEvent('shri_rani_cars_sync', { eventType: 'RELOAD', data });
        }
        return data;
      }
    } catch (err) {
      // Background sync error - silent fallback to local storage
    }
    return null;
  },

  async addCar(carData) {
    const newCar = {
      ...carData,
      id: carData.id || 'car_' + Date.now(),
      created_at: carData.created_at || new Date().toISOString()
    };

    // 1. Instant Optimistic Local Add (< 2ms)
    this.syncLocalAdd(newCar);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'INSERT', new: newCar });

    // 2. Background Asynchronous Postgres Insert
    const client = getSupabaseClient();
    if (client) {
      client.from('cars').insert([newCar]).select().then(({ data, error }) => {
        if (!error && data && data[0]) {
          this.syncLocalUpdate(newCar.id, data[0]);
        }
      }).catch(e => console.warn('Background addCar sync:', e));
    }

    return { success: true, data: newCar };
  },

  async updateCar(id, updatedFields) {
    // 1. Instant Optimistic Local Update (< 2ms)
    const updated = this.syncLocalUpdate(id, updatedFields);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'UPDATE', new: updated || { id, ...updatedFields } });

    // 2. Background Asynchronous Postgres Update
    const client = getSupabaseClient();
    if (client) {
      client.from('cars').update(updatedFields).eq('id', id).select().then(({ data, error }) => {
        if (!error && data && data[0]) {
          this.syncLocalUpdate(id, data[0]);
        }
      }).catch(e => console.warn('Background updateCar sync:', e));
    }

    return { success: true, data: updated };
  },

  async deleteCar(id) {
    // 1. Instant Optimistic Local Delete (< 2ms)
    this.syncLocalDelete(id);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'DELETE', old: { id } });

    // 2. Background Asynchronous Postgres Delete
    const client = getSupabaseClient();
    if (client) {
      client.from('cars').delete().eq('id', id).then().catch(e => console.warn('Background deleteCar sync:', e));
    }

    return { success: true };
  },

  // =========================================================================
  // 2. ENQUIRIES CRUD (FAST LOCAL-FIRST + BACKGROUND ASYNC SYNC)
  // =========================================================================
  async getEnquiries(options = { backgroundSync: true }) {
    const localEnqs = this.getLocalEnquiries();
    if (options.backgroundSync) {
      setTimeout(() => this.fetchEnquiriesNetwork(), 10);
    }
    return localEnqs;
  },

  async fetchEnquiriesNetwork() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await Promise.race([
        client.from('enquiries').select('*').order('created_at', { ascending: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
      ]);

      if (!error && data) {
        const current = localStorage.getItem(STORAGE_KEYS.ENQUIRIES);
        const newStr = JSON.stringify(data);
        if (current !== newStr) {
          localStorage.setItem(STORAGE_KEYS.ENQUIRIES, newStr);
          this.broadcastEvent('shri_rani_enquiries_sync', { eventType: 'RELOAD', data });
        }
        return data;
      }
    } catch (e) {}
    return null;
  },

  async submitEnquiry(enquiry) {
    const item = {
      id: 'enq_' + Date.now(),
      customer_name: enquiry.customer_name || 'Customer',
      phone: enquiry.phone || '',
      car_name: enquiry.car_name || '',
      enquiry_type: enquiry.enquiry_type || 'General Inquiry',
      city: enquiry.city || 'Salem',
      preferred_date: enquiry.preferred_date || '',
      expected_price: enquiry.expected_price || '',
      kms: enquiry.kms || '',
      status: 'New',
      created_at: new Date().toISOString()
    };

    let enquiries = this.getLocalEnquiries();
    enquiries.unshift(item);
    localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
    this.broadcastEvent('shri_rani_enquiries_sync', { eventType: 'INSERT', new: item });

    const client = getSupabaseClient();
    if (client) {
      client.from('enquiries').insert([item]).then().catch(e => console.warn('Enquiry background insert:', e));
    }

    return item;
  },

  async updateEnquiry(id, fields) {
    let enquiries = this.getLocalEnquiries();
    const idx = enquiries.findIndex(e => String(e.id) === String(id));
    if (idx !== -1) {
      enquiries[idx] = { ...enquiries[idx], ...fields };
      localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
      this.broadcastEvent('shri_rani_enquiries_sync', { eventType: 'UPDATE', new: enquiries[idx] });
    }

    const client = getSupabaseClient();
    if (client) {
      client.from('enquiries').update(fields).eq('id', id).then().catch(e => console.warn('Enquiry background update:', e));
    }

    return true;
  },

  async deleteEnquiry(id) {
    let enquiries = this.getLocalEnquiries().filter(e => String(e.id) !== String(id));
    localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
    this.broadcastEvent('shri_rani_enquiries_sync', { eventType: 'DELETE', old: { id } });

    const client = getSupabaseClient();
    if (client) {
      client.from('enquiries').delete().eq('id', id).then().catch(e => console.warn('Enquiry background delete:', e));
    }

    return true;
  },

  // =========================================================================
  // 3. SETTINGS & HOMEPAGE CONFIG (FAST LOCAL-FIRST + BACKGROUND ASYNC SYNC)
  // =========================================================================
  async getSettings() {
    let currentSettings = {
      businessName: 'Shri Rani Cars',
      phone1: '9750332585',
      phone2: '7550172585',
      whatsapp: '7550172585',
      email: 'contact@shriranicars.com',
      address: 'Mangamma Salai, Near RTO Office, Puthupalayam, Vazhapadi, Salem - 636115',
      hours: 'Mon - Sun: 9:00 AM - 8:30 PM'
    };

    try {
      const local = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (local) currentSettings = JSON.parse(local);
    } catch (e) {}

    // Background fetch
    setTimeout(async () => {
      const client = getSupabaseClient();
      if (!client) return;
      try {
        const { data, error } = await client.from('settings').select('*').eq('key', 'dealership_settings').single();
        if (!error && data && data.value) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.value));
        }
      } catch (e) {}
    }, 20);

    return currentSettings;
  },

  async saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.broadcastEvent('shri_rani_settings_sync', { key: 'dealership_settings', value: settings });

    const client = getSupabaseClient();
    if (client) {
      client.from('settings').upsert({
        key: 'dealership_settings',
        value: settings,
        updated_at: new Date().toISOString()
      }).then().catch(e => console.warn('Settings background save:', e));
    }
  },

  async getHomepageConfig() {
    let currentConfig = {
      heroHeading: 'Tested, Certified & Road Ready',
      heroSubtitle: '140-Point Quality Inspection • Instant Financing • Salem & Vazhapadi',
      heroImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
      heroBanners: [
        {
          id: 'banner_1',
          tag: 'Certified Pre-Owned',
          tagIcon: 'fa-certificate',
          heading: 'Tested, Certified & Road Ready',
          sub: '140-Point Quality Inspection • Instant Financing • Salem & Vazhapadi',
          image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
          active: true
        },
        {
          id: 'banner_2',
          tag: '100% Non-Accidental',
          tagIcon: 'fa-shield-alt',
          heading: 'Multi-Brand Pre-Owned Showroom',
          sub: 'Verified Kilometers • Single Owner Options • Fast RC Transfer',
          image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
          active: true
        },
        {
          id: 'banner_3',
          tag: 'Instant EMI Approval',
          tagIcon: 'fa-bolt',
          heading: 'Lowest Interest Rates & Free Valuation',
          sub: 'Sell or Exchange Your Car for Best Showroom Price',
          image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
          active: true
        }
      ]
    };

    try {
      const local = localStorage.getItem(STORAGE_KEYS.HOMEPAGE);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.heroBanners && Array.isArray(parsed.heroBanners)) {
          currentConfig = parsed;
        }
      }
    } catch (e) {}

    // Background fetch
    setTimeout(async () => {
      const client = getSupabaseClient();
      if (!client) return;
      try {
        const { data, error } = await client.from('settings').select('*').eq('key', 'homepage_config').single();
        if (!error && data && data.value) {
          localStorage.setItem(STORAGE_KEYS.HOMEPAGE, JSON.stringify(data.value));
        }
      } catch (e) {}
    }, 20);

    return currentConfig;
  },

  async saveHomepageConfig(config) {
    localStorage.setItem(STORAGE_KEYS.HOMEPAGE, JSON.stringify(config));
    this.broadcastEvent('shri_rani_settings_sync', { key: 'homepage_config', value: config });

    const client = getSupabaseClient();
    if (client) {
      client.from('settings').upsert({
        key: 'homepage_config',
        value: config,
        updated_at: new Date().toISOString()
      }).then().catch(e => console.warn('Homepage background save:', e));
    }
  },

  // =========================================================================
  // 4. REALTIME LISTENERS & EVENT BROADCASTING
  // =========================================================================
  initRealtime() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      // Cars Channel
      client
        .channel('realtime-cars-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
          console.log('⚡ Realtime Car Event from Supabase:', payload);
          if (payload.eventType === 'INSERT') {
            this.syncLocalAdd(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            this.syncLocalUpdate(payload.new.id, payload.new);
          } else if (payload.eventType === 'DELETE') {
            this.syncLocalDelete(payload.old.id);
          }
          this.broadcastEvent('shri_rani_cars_sync', payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Realtime Cars channel subscribed');
          }
        });

      // Enquiries Channel
      client
        .channel('realtime-enquiries-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, (payload) => {
          console.log('⚡ Realtime Enquiry Event from Supabase:', payload);
          this.broadcastEvent('shri_rani_enquiries_sync', payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Realtime Enquiries channel subscribed');
          }
        });

      // Settings Channel
      client
        .channel('realtime-settings-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
          console.log('⚡ Realtime Settings Event from Supabase:', payload);
          if (payload.new && payload.new.key) {
            if (payload.new.key === 'homepage_config') {
              localStorage.setItem(STORAGE_KEYS.HOMEPAGE, JSON.stringify(payload.new.value));
            } else if (payload.new.key === 'dealership_settings') {
              localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(payload.new.value));
            }
          }
          this.broadcastEvent('shri_rani_settings_sync', payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('⚡ Realtime Settings channel subscribed');
          }
        });

      console.log('⚡ Supabase Realtime Channels configured');
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  },

  broadcastEvent(name, data) {
    window.dispatchEvent(new CustomEvent(name, { detail: data }));
  },

  // Helpers
  getLocalCars() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CARS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  getLocalEnquiries() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ENQUIRIES) || '[]');
    } catch (e) {
      return [];
    }
  },

  syncLocalAdd(car) {
    let cars = this.getLocalCars();
    cars = cars.filter(c => String(c.id) !== String(car.id));
    cars.unshift(car);
    localStorage.setItem(STORAGE_KEYS.CARS, JSON.stringify(cars));
    return car;
  },

  syncLocalUpdate(id, fields) {
    let cars = this.getLocalCars();
    const index = cars.findIndex(c => String(c.id) === String(id));
    if (index !== -1) {
      cars[index] = { ...cars[index], ...fields };
      localStorage.setItem(STORAGE_KEYS.CARS, JSON.stringify(cars));
      return cars[index];
    }
    return null;
  },

  syncLocalDelete(id) {
    let cars = this.getLocalCars();
    cars = cars.filter(c => String(c.id) !== String(id));
    localStorage.setItem(STORAGE_KEYS.CARS, JSON.stringify(cars));
  }
};

// Automatically initialize Realtime on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => window.CarService.initRealtime());
  } else {
    window.CarService.initRealtime();
  }
}
