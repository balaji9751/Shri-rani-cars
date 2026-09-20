// ==========================================================================
// SRI RANI CARS — MASTER SUPABASE & REALTIME DATA SERVICE
// Fast Real-Time Synchronization with Postgres & Optimistic Local Cache
// ==========================================================================

const SUPABASE_URL = 'https://cuvopwwzauvsulyvaxfn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Sw0TNJ0N6J4YQaghbSYuUw_7q-tujbP';

// Initialize Supabase client
let supabaseClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('⚡ Supabase Client initialized successfully');
  }
} catch (e) {
  console.warn('Supabase initialization fallback to local storage:', e);
}

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
  // 1. CAR INVENTORY CRUD
  // =========================================================================
  async getCars() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cars')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.CARS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, fallback to local cache:', err);
      }
    }

    const localData = localStorage.getItem(STORAGE_KEYS.CARS);
    if (localData) {
      try {
        return JSON.parse(localData);
      } catch (e) {
        console.error('Error parsing local cars data', e);
      }
    }

    if (window.INITIAL_CARS) {
      localStorage.setItem(STORAGE_KEYS.CARS, JSON.stringify(window.INITIAL_CARS));
      return window.INITIAL_CARS;
    }

    return [];
  },

  async addCar(carData) {
    const newCar = {
      ...carData,
      id: carData.id || 'car_' + Date.now(),
      created_at: carData.created_at || new Date().toISOString()
    };

    // Optimistic local add
    this.syncLocalAdd(newCar);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'INSERT', new: newCar });

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cars')
          .insert([newCar])
          .select();

        if (!error && data && data[0]) {
          this.syncLocalUpdate(newCar.id, data[0]);
          return { success: true, data: data[0] };
        }
      } catch (err) {
        console.warn('Supabase addCar error:', err);
      }
    }

    return { success: true, data: newCar };
  },

  async updateCar(id, updatedFields) {
    // Optimistic local update
    const updated = this.syncLocalUpdate(id, updatedFields);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'UPDATE', new: updated || { id, ...updatedFields } });

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cars')
          .update(updatedFields)
          .eq('id', id)
          .select();

        if (!error && data && data[0]) {
          this.syncLocalUpdate(id, data[0]);
          return { success: true, data: data[0] };
        }
      } catch (err) {
        console.warn('Supabase updateCar error:', err);
      }
    }

    return { success: true, data: updated };
  },

  async deleteCar(id) {
    // Optimistic local delete
    this.syncLocalDelete(id);
    this.broadcastEvent('shri_rani_cars_sync', { eventType: 'DELETE', old: { id } });

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('cars')
          .delete()
          .eq('id', id);

        if (!error) return { success: true };
      } catch (err) {
        console.warn('Supabase deleteCar error:', err);
      }
    }

    return { success: true };
  },

  // =========================================================================
  // 2. ENQUIRIES CRUD
  // =========================================================================
  async getEnquiries() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('enquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch enquiries error:', err);
      }
    }

    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ENQUIRIES) || '[]');
    } catch (e) {
      return [];
    }
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

    if (supabaseClient) {
      try {
        await supabaseClient.from('enquiries').insert([item]);
      } catch (e) {
        console.warn('Supabase enquiry insert failed:', e);
      }
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

    if (supabaseClient) {
      try {
        await supabaseClient.from('enquiries').update(fields).eq('id', id);
      } catch (e) {
        console.warn('Supabase enquiry update failed:', e);
      }
    }

    return true;
  },

  async deleteEnquiry(id) {
    let enquiries = this.getLocalEnquiries().filter(e => String(e.id) !== String(id));
    localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
    this.broadcastEvent('shri_rani_enquiries_sync', { eventType: 'DELETE', old: { id } });

    if (supabaseClient) {
      try {
        await supabaseClient.from('enquiries').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase enquiry delete failed:', e);
      }
    }

    return true;
  },

  // =========================================================================
  // 3. SETTINGS & HOMEPAGE CONFIG IN SUPABASE
  // =========================================================================
  async getSettings() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('settings')
          .select('*')
          .eq('key', 'dealership_settings')
          .single();

        if (!error && data && data.value) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.value));
          return data.value;
        }
      } catch (e) {}
    }

    try {
      const local = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (local) return JSON.parse(local);
    } catch (e) {}

    return {
      businessName: 'Sri Rani Cars',
      phone1: '9750332585',
      phone2: '7550172585',
      whatsapp: '7550172585',
      email: 'contact@shriranicars.com',
      address: 'Mangamma Salai, Near RTO Office, Puthupalayam, Vazhapadi, Salem - 636115',
      hours: 'Mon - Sun: 9:00 AM - 8:30 PM'
    };
  },

  async saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.broadcastEvent('shri_rani_settings_sync', { key: 'dealership_settings', value: settings });

    if (supabaseClient) {
      try {
        await supabaseClient.from('settings').upsert({
          key: 'dealership_settings',
          value: settings,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Supabase saveSettings failed:', e);
      }
    }
  },

  async getHomepageConfig() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('settings')
          .select('*')
          .eq('key', 'homepage_config')
          .single();

        if (!error && data && data.value) {
          localStorage.setItem(STORAGE_KEYS.HOMEPAGE, JSON.stringify(data.value));
          return data.value;
        }
      } catch (e) {}
    }

    try {
      const local = localStorage.getItem(STORAGE_KEYS.HOMEPAGE);
      if (local) return JSON.parse(local);
    } catch (e) {}

    return {
      heroHeading: 'Premium Cars. Certified Quality. Unmatched Value.',
      heroSubtitle: "Discover Salem and Vazhapadi's most reliable collection of certified pre-owned vehicles. Rigorous 140-point technical inspection, instant financing, and transparent paperwork.",
      heroImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'
    };
  },

  async saveHomepageConfig(config) {
    localStorage.setItem(STORAGE_KEYS.HOMEPAGE, JSON.stringify(config));
    this.broadcastEvent('shri_rani_settings_sync', { key: 'homepage_config', value: config });

    if (supabaseClient) {
      try {
        await supabaseClient.from('settings').upsert({
          key: 'homepage_config',
          value: config,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Supabase saveHomepageConfig failed:', e);
      }
    }
  },

  // =========================================================================
  // 4. REALTIME LISTENERS & EVENT BROADCASTING
  // =========================================================================
  initRealtime() {
    if (!supabaseClient) return;

    try {
      // Cars Channel
      supabaseClient
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
        .subscribe();

      // Enquiries Channel
      supabaseClient
        .channel('realtime-enquiries-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, (payload) => {
          console.log('⚡ Realtime Enquiry Event from Supabase:', payload);
          this.broadcastEvent('shri_rani_enquiries_sync', payload);
        })
        .subscribe();

      // Settings Channel
      supabaseClient
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
        .subscribe();

      console.log('⚡ Supabase Realtime Channels active');
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
      return data ? JSON.parse(data) : (window.INITIAL_CARS || []);
    } catch (e) {
      return window.INITIAL_CARS || [];
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
  window.CarService.initRealtime();
}
