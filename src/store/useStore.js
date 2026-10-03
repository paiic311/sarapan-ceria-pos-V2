import { create } from 'zustand';
import localforage from 'localforage';
import { format } from 'date-fns';
import { socket } from '../socket';
import { API_URL } from '../config';

// Configure localforage
localforage.config({
  name: 'SarapanCeriaPOS',
  version: 1.0,
  storeName: 'pos_data'
});

const generateId = () => Math.random().toString(36).substr(2, 9);
const getTodayString = () => format(new Date(), 'yyyy-MM-dd');

export const useStore = create((set, get) => ({
  vendors: [],
  products: [],
  dailyRecords: {}, // { '2023-10-27': { date: '2023-10-27', records: [...] } }
  isOffline: !navigator.onLine,
  setupSocket: () => {
    socket.connect();

    socket.off('data:changed');

    socket.on('data:changed', async () => {
      console.log('Data berubah dari device lain');
      await get().initData();
    });
  },
  
  // Initialization
  initData: async () => {
    try {
      const [vendorsResponse, productsResponse, dailyRecordsResponse] = await Promise.all([
        fetch(`${API_URL}/vendors`),
        fetch(`${API_URL}/products`),
        fetch(`${API_URL}/daily-records/full`)
      ]);
      
      const vendors = await vendorsResponse.json();
      const productsData = await productsResponse.json();
      const dailyRecordsData = await dailyRecordsResponse.json();
      console.log('DAILY RECORDS DARI SERVER:', dailyRecordsData);

      const products = productsData.map(product => ({
        id: product.id,
        vendorId: product.vendor_id,
        name: product.name,
        basePrice: Number(product.base_price),
        salePrice: Number(product.sale_price),
        createdAt: product.created_at
      }));

      const dailyRecords = {};

      dailyRecordsData.forEach(record => {
        const date = new Date(record.date).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Jakarta'
        });

        if (!dailyRecords[date]) {
          dailyRecords[date] = {
            date,
            records: []
          };
        }

        let dailyRecord = dailyRecords[date].records.find(
          r => r.id === record.record_id
        );

        if (!dailyRecord) {
          dailyRecord = {
            id: record.record_id,
            vendorId: record.vendor_id,
            note: record.note || '',
            isHandedOver: Boolean(record.is_handed_over),
            items: []
          };

          dailyRecords[date].records.push(dailyRecord);
        }

        if (record.item_id) {
          dailyRecord.items.push({
            id: record.item_id,
            productId: record.product_id || '',
            productName: record.product_name || '',
            basePrice: Number(record.base_price) || 0,
            salePrice: Number(record.sale_price) || 0,
            qtyTitip: Number(record.qty_titip) || 0,
            qtySold: Number(record.qty_sold) || 0
          });
        }
      });

      set({ vendors, products, dailyRecords });
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  },

  setOfflineStatus: (status) => set({ isOffline: status }),

  // --- Vendors ---
  addVendor: async (vendor) => {
    const newVendor = {
      ...vendor,
      id: generateId(),
      createdAt: new Date().toISOString()
    };

    const response = await fetch(`${API_URL}/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newVendor)
    });

    if (!response.ok) {
      throw new Error('Gagal menyimpan vendor ke server');
    }

    const vendors = [...get().vendors, newVendor];
    set({ vendors });
  },
  
  updateVendor: async (id, updatedData) => {
    try{
      const response = await fetch(`${API_URL}/vendors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui vendor di server');
      }

      const vendors = get().vendors.map(v =>
        v.id === id ? { ...v, ...updatedData } : v
      );

      set({ vendors });
    } catch (error) {
      console.error("Gagal memperbarui vendor:", error);
      throw error;
    }
  },

  deleteVendor: async (id) => {
    try {
      const response = await fetch(`${API_URL}/vendors/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
      throw new Error('Gagal menghapus vendor dari server');
      }

      const vendors = get().vendors.filter(v => v.id !== id);

      set({ vendors });
    } catch (error) {
      console.error('Gagal delete vendor:', error);
      throw error;
    }
  },

  // --- Products ---
  addProduct: async (product) => {
    try {
      const newProduct = {
        ...product,
        id: generateId(),
        createdAt: new Date().toISOString()
      };

      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProduct)
      });

      if (!response.ok) {
        throw new Error('Gagal menyimpan produk ke server');
      }

      const products = [...get().products, newProduct];

      set({ products });
    } catch (error) {
      console.error('Gagal menambahkan produk:', error);
      throw error;
    }
  },

  updateProduct: async (id, updatedData) => {
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui produk di server');
      }

      const products = get().products.map(p => p.id === id ? { ...p, ...updatedData } : p);
      set({ products });
    } catch (error) {
      console.error('Gagal memperbarui produk:', error);
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Gagal menghapus produk dari server');
      }

      const products = get().products.filter(p => p.id !== id);
      
      set({ products });
    } catch (error) {
      console.error('Gagal menghapus produk:', error);
      throw error;
    }
  },

  // --- Daily Records ---
  addDailyVendorRecord: async (date, vendorId) => {
  try {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) {
      dailyRecords[date] = {
        date,
        records: []
      };
    }

    // Jangan boleh vendor yang sama masuk 2x
    if (
      dailyRecords[date].records.find(
        r => r.vendorId === vendorId
      )
    ) {
      return;
    }

    const vendorProducts = get().products.filter(
      p => p.vendorId === vendorId
    );

    const recordId = generateId();

    const initialItems =
      vendorProducts.length > 0
        ? vendorProducts.map(p => ({
            id: generateId(),
            productId: p.id,
            productName: p.name,
            basePrice: p.basePrice || 0,
            salePrice: p.salePrice || 0,
            qtyTitip: 0,
            qtySold: 0
          }))
        : [{
            id: generateId(),
            productId: '',
            productName: '',
            basePrice: 0,
            salePrice: 0,
            qtyTitip: 0,
            qtySold: 0
          }];

    // Simpan vendor harian ke MySQL
    const recordResponse = await fetch(
      `${API_URL}/daily-records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: recordId,
          date,
          vendorId,
          note: '',
          isHandedOver: false
        })
      }
    );

    if (!recordResponse.ok) {
      throw new Error('Gagal menyimpan daily record');
    }

    // Simpan produk-produknya ke MySQL
    for (const item of initialItems) {
      const itemResponse = await fetch(
        `${API_URL}/daily-items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: item.id,
            dailyRecordId: recordId,
            productId: item.productId || null,
            productName: item.productName,
            basePrice: item.basePrice,
            salePrice: item.salePrice,
            qtyTitip: item.qtyTitip,
            qtySold: item.qtySold
          })
        }
      );

      if (!itemResponse.ok) {
        throw new Error('Gagal menyimpan daily item');
      }
    }

    // Update tampilan aplikasi
    const newRecord = {
      id: recordId,
      vendorId,
      note: '',
      isHandedOver: false,
      items: initialItems
    };

    dailyRecords[date] = {
      ...dailyRecords[date],
      records: [
        ...dailyRecords[date].records,
        newRecord
      ]
    };

    set({ dailyRecords });

  } catch (error) {
    console.error(
      'Gagal menambahkan daily record:',
      error
    );

    throw error;
  }
  },

  updateDailyRecordNote: async (date, recordId, note) => {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) return;

    const record = dailyRecords[date].records.find(
      r => r.id === recordId
    );

    if (!record) return;

    const newRecords = dailyRecords[date].records.map(r =>
      r.id === recordId
        ? { ...r, note }
        : r
      );
      
      dailyRecords[date] = {
        ...dailyRecords[date],
        records: newRecords
      };

      set ({ dailyRecords });

      await fetch(`${API_URL}/daily-records/${recordId}`, {
        method: `PUT`,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note,
          isHandedOver: record.isHandedOver
        })
      });

      await localforage.setItem(
        'dailyRecords', dailyRecords
      );
  },

  updateDailyItem: async (date, recordId, itemIndex, itemData) => {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) return;

    const newRecords = dailyRecords[date].records.map(r => {
      if (r.id !== recordId) return r;
      
      const newItems = [...r.items];

      if (itemIndex >= newItems.length) {
        newItems.push(itemData);

      } else {
        newItems[itemIndex] = {
          ...newItems[itemIndex],
          ...itemData
        };
      }
      return {
        ...r,
        items: newItems
      };
    });

    dailyRecords[date] = {
      ...dailyRecords[date],
      records: newRecords
    };
    set({ dailyRecords });

    const item = newRecords.find(r => r.id === recordId)?.items[itemIndex];

    if (item?.id) {
      await fetch(`${API_URL}/daily-items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: item.productId,
          productName: item.productName,
          basePrice: item.basePrice,
          salePrice: item.salePrice,
          qtyTitip: item.qtyTitip,
          qtySold: item.qtySold
        })
      });
    }
  },

  addEmptyItemToRecord: async (date, recordId) => {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) return;

    const item = {
      id: generateId(),
      productId: '',
      productName: '',
      basePrice: 0,
      salePrice: 0,
      qtyTitip: 0,
      qtySold: 0
    };

    const newRecords = dailyRecords[date].records.map(r => {
      if (r.id !== recordId) return r;

      return {
        ...r,
        items: [...r.items, item]
      };
    });

    dailyRecords[date] = {
      ...dailyRecords[date],
      records: newRecords
    };

    set({ dailyRecords });

    await fetch(`${API_URL}/daily-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: item.id,
        dailyRecordId: recordId,
        productId: null,
        productName: '',
        basePrice: 0,
        salePrice: 0,
        qtyTitip: 0,
        qtySold: 0
      })
    });
  },
  
  deleteDailyItem: async (date, recordId, itemIndex) => {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) return;

    const record = dailyRecords[date].records.find(
      r => r.id === recordId
    );

    if (!record) return;

    const item = record.items[itemIndex];

    if (!item) return;
    const response = await fetch(
      `${API_URL}/daily-items/${item.id}`,
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    throw new Error('Gagal menghapus daily item');
  }

  const newRecords = dailyRecords[date].records.map(r => {
    if (r.id !== recordId) return r;

    return {
      ...r,
      items: r.items.filter((_, idx) => idx !== itemIndex)
    };
  });

  dailyRecords[date] = {
    ...dailyRecords[date],
    records: newRecords
  };
  set({ dailyRecords });
  await localforage.setItem('dailyRecords', dailyRecords);
  },

  toggleDailyRecordHandedOver: async (date, recordId) => {
    const dailyRecords = { ...get().dailyRecords };
    
    if (!dailyRecords[date]) return;

    const record = dailyRecords[date].records.find(
      r => r.id === recordId
    );
    if (!record) return;

    const newStatus = !record.isHandedOver;

    const newRecords = dailyRecords[date].records.map(r =>
      r.id === recordId
        ? { ...r, isHandedOver: newStatus }
        : r
    );

    dailyRecords[date] = {
      ...dailyRecords[date],
      records: newRecords
    };

     const Response = await fetch(
      `${API_URL}/daily-records/${recordId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          note: record.note || '',
          isHandedOver: newStatus
        })
      }
    );

    if (!Response.ok) {
      throw new Error('Gagal memperbarui status uang di serahkan');
    }

    set ({dailyRecords});

    await localforage.setItem(
      `dailyRecords`,
      dailyRecords
    )
  },

  updateEntireDailyRecord: async (date, updatedDayRecord) => {
    const dailyRecords = { ...get().dailyRecords };

    if (!dailyRecords[date]) return;
      dailyRecords[date] = updatedDayRecord;

      set ({ dailyRecords });
      await localforage.setItem(
        `dailyRecords`,
        dailyRecords
      );
  },

  deleteDailyRecord: async (date, recordId) => {
  const dailyRecords = { ...get().dailyRecords };

  if (!dailyRecords[date]) return;

  const response = await fetch(
    `${API_URL}/daily-records/${recordId}`,
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    throw new Error('Gagal menghapus daily record');
  }

  const newRecords = dailyRecords[date].records.filter(
    r => r.id !== recordId
  );

  dailyRecords[date] = {
    ...dailyRecords[date],
    records: newRecords
  };

  set({ dailyRecords });

  await localforage.setItem(
    'dailyRecords',
    dailyRecords
  );
  },
}));

// Sync helper (mock for now, could be integrated with Firebase/Supabase later)
export const syncWithServer = async () => {
    console.log("Syncing with server...");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Sync complete!");
};
