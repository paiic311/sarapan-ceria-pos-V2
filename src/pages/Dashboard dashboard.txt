import React, { useState, useMemo } from 'react';
import { formatNumber } from '../utils/format';
import { Plus, Trash2, ShoppingCart, DollarSign, ChevronDown, ChevronRight, FileText, CheckCircle2, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import Modal from '../components/Modal';
import { format } from 'date-fns';

const Dashboard = () => {
  const { vendors, products, dailyRecords, addDailyVendorRecord, updateDailyItem, addEmptyItemToRecord, deleteDailyItem, deleteDailyRecord, addProduct, updateDailyRecordNote, toggleDailyRecordHandedOver } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [collapsedRecords, setCollapsedRecords] = useState([]);

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const todaysData = dailyRecords[todayDate] || { date: todayDate, records: [] };

  const toggleRecord = (recordId) => {
    if (collapsedRecords.includes(recordId)) {
      setCollapsedRecords(collapsedRecords.filter(id => id !== recordId));
    } else {
      setCollapsedRecords([...collapsedRecords, recordId]);
    }
  };

  const handleAddVendor = () => {
    if (selectedVendor) {
      addDailyVendorRecord(todayDate, selectedVendor);
      setIsModalOpen(false);
      setSelectedVendor('');
    }
  };

  const getVendorName = (vendorId) => {
    const v = vendors.find(v => v.id === vendorId);
    return v ? v.name : 'Vendor Tidak Diketahui';
  };

  // Calculate totals
  const stats = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;

    todaysData.records.forEach(record => {
      record.items.forEach(item => {
        const bp = Number(item.basePrice) || 0;
        const sp = Number(item.salePrice) || 0;
        const qty = Number(item.qtySold) || 0;

        totalSales += bp * qty;
        totalProfit += (sp - bp) * qty;
      });
    });

    return { totalSales, totalProfit };
  }, [todaysData]);

  // Handle product selection or manual typing
  const handleProductChange = (recordId, itemIndex, productName) => {
    const existingProduct = products.find(p => p.name.toLowerCase() === productName.toLowerCase());

    if (existingProduct) {
      updateDailyItem(todayDate, recordId, itemIndex, {
        productId: existingProduct.id,
        productName: existingProduct.name,
        basePrice: existingProduct.basePrice || 0,
        salePrice: existingProduct.salePrice || 0
      });
    } else {
      // New product manually typed
      updateDailyItem(todayDate, recordId, itemIndex, {
        productId: 'temp-' + Date.now(),
        productName: productName
      });
    }
  };

  // Sync to product DB if it's a new product
  const syncProductToDB = async (recordId, vendorId, itemIndex, item) => {
    if (item.productId && item.productId.startsWith('temp-') && item.productName && item.productName.trim() !== '') {
      const newId = await addProduct({
        name: item.productName,
        basePrice: Number(item.basePrice) || 0,
        salePrice: Number(item.salePrice) || 0,
        vendorId: vendorId
      });
      // Update the item with the real ID
      updateDailyItem(todayDate, recordId, itemIndex, {
        productId: newId
      });
    }
  };

  // If basePrice or salePrice changes, and it's a temp product, we update it.
  const handlePriceChange = (recordId, itemIndex, item, field, value) => {
    updateDailyItem(todayDate, recordId, itemIndex, { [field]: Number(value) });
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Penjualan Hari Ini</div>
          <div className="stat-value">Rp {formatNumber(stats.totalSales)}</div>
          <div style={{ position: 'absolute', top: 24, right: 24, color: 'var(--primary)', opacity: 0.2 }}>
            <ShoppingCart size={48} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Keuntungan Hari Ini</div>
          <div className="stat-value text-success">Rp {formatNumber(stats.totalProfit)}</div>
          <div style={{ position: 'absolute', top: 24, right: 24, color: 'var(--primary-dark)', opacity: 0.2 }}>
            <DollarSign size={48} />
          </div>
        </div>
      </div>

      <div className="flex-between mb-6">
        <h2 className="header-title" style={{ fontSize: '1.25rem' }}>Catatan Harian</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Tambah Vendor
        </button>
      </div>

      {todaysData.records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <ShoppingCart size={32} />
          </div>
          <h3 style={{ marginBottom: 8, color: 'var(--text-main)' }}>Belum ada catatan</h3>
          <p>Klik "Tambah Catatan Vendor" untuk mulai mencatat penjualan hari ini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {todaysData.records.map(record => {
            const vendorTotalSales = record.items.reduce((sum, item) => sum + ((item.basePrice || 0) * (item.qtySold || 0)), 0);
            const vendorTotalProfit = record.items.reduce((sum, item) => sum + (((item.salePrice || 0) - (item.basePrice || 0)) * (item.qtySold || 0)), 0);
            return (
              <div key={record.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <datalist id={`products-list-${record.vendorId}`}>
                  {products.filter(p => p.vendorId === record.vendorId || !p.vendorId).map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                <div
                  style={{ padding: '16px 20px', background: 'var(--surface-hover)', borderBottom: collapsedRecords.includes(record.id) ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleRecord(record.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {collapsedRecords.includes(record.id) ? <ChevronRight size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{getVendorName(record.vendorId)}</h3>
                    <div style={{ display: 'flex', gap: '16px', marginLeft: '12px', fontSize: '0.9rem' }}>
                      <span className="text-muted">Total Setor: <strong style={{ color: 'var(--text-main)' }}>Rp {formatNumber(vendorTotalSales)}</strong></span>
                      <span className="text-success">Total Untung: <strong>Rp {formatNumber(vendorTotalProfit)}</strong></span>
                    </div>
                  </div>
                  {/* Penanda Uang Diserahkan */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                    {record.isHandedOver ? (
                      <>
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '50px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <CheckCircle2 size={16} />
                          Uang Diserahkan
                        </span>
                        <button
                          className="btn-icon"
                          style={{ 
                            padding: '4px', 
                            height: 'auto', 
                            width: 'auto', 
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                          title="Batalkan Status Penyerahan"
                          onClick={() => toggleDailyRecordHandedOver(todayDate, record.id)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-outline"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#10b981',
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          background: 'transparent',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius)',
                          fontWeight: '500'
                        }}
                        onClick={() => toggleDailyRecordHandedOver(todayDate, record.id)}
                      >
                        <CheckCircle2 size={16} />
                        <span>Serahkan Uang</span>
                      </button>
                    )}
                  </div>
                </div>

                {!collapsedRecords.includes(record.id) && (
                  <div style={{ padding: '16px' }}>
                    {/* Headers for desktop */}
                    <div className="item-row" style={{ padding: '0 16px 8px', borderBottom: 'none', background: 'transparent', display: window.innerWidth > 1024 ? 'grid' : 'none' }}>
                      <div className="form-label mb-0">Produk</div>
                      <div className="form-label mb-0">Harga Modal (Rp)</div>
                      <div className="form-label mb-0">Harga Jual (Rp)</div>
                      <div className="form-label mb-0">Titip</div>
                      <div className="form-label mb-0">Terjual</div>
                      <div className="form-label mb-0">Sisa</div>
                      <div className="form-label mb-0">Total Setor</div>
                      <div className="form-label mb-0">Keuntungan</div>
                      <div></div>
                    </div>

                    {record.items.map((item, index) => (
                      <div className="item-row" key={index}>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Produk</label>}
                          <input
                            type="text"
                            list={`products-list-${record.vendorId}`}
                            className="form-input"
                            value={item.productName || (item.productId ? (products.find(p => p.id === item.productId)?.name || '') : '')}
                            onChange={(e) => handleProductChange(record.id, index, e.target.value)}
                            onBlur={() => syncProductToDB(record.id, record.vendorId, index, item)}
                            placeholder="Pilih atau ketik produk..."
                            disabled={record.isHandedOver}
                          />
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Harga Modal</label>}
                          <input
                            type="number"
                            className="form-input"
                            value={item.basePrice === 0 ? '' : item.basePrice}
                            onChange={(e) => handlePriceChange(record.id, index, item, 'basePrice', e.target.value)}
                            onBlur={() => syncProductToDB(record.id, record.vendorId, index, item)}
                            disabled={record.isHandedOver}
                          />
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Harga Jual</label>}
                          <input
                            type="number"
                            className="form-input"
                            value={item.salePrice === 0 ? '' : item.salePrice}
                            onChange={(e) => handlePriceChange(record.id, index, item, 'salePrice', e.target.value)}
                            onBlur={() => syncProductToDB(record.id, record.vendorId, index, item)}
                            disabled={record.isHandedOver}
                          />
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Titip</label>}
                          <input
                            type="number"
                            className="form-input"
                            value={item.qtyTitip === 0 ? '' : item.qtyTitip}
                            onChange={(e) => updateDailyItem(todayDate, record.id, index, { qtyTitip: Number(e.target.value) })}
                            disabled={record.isHandedOver}
                          />
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Terjual</label>}
                          <input
                            type="number"
                            className="form-input"
                            value={item.qtySold === 0 ? '' : item.qtySold}
                            onChange={(e) => updateDailyItem(todayDate, record.id, index, { qtySold: Number(e.target.value) })}
                            disabled={record.isHandedOver}
                          />
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Sisa</label>}
                          <div className="total-display text-muted">
                            {((item.qtyTitip || 0) - (item.qtySold || 0))}
                          </div>
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Total Setor</label>}
                          <div className="total-display">
                            Rp {formatNumber((item.basePrice || 0) * (item.qtySold || 0))}
                          </div>
                        </div>
                        <div className="form-group mb-0">
                          {window.innerWidth <= 1024 && <label className="form-label">Keuntungan</label>}
                          <div className="total-display text-success">
                            Rp {formatNumber(((item.salePrice || 0) - (item.basePrice || 0)) * (item.qtySold || 0))}
                          </div>
                        </div>
                        <div className="form-group mb-0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button 
                            className="btn-icon danger" 
                            onClick={() => deleteDailyItem(todayDate, record.id, index)}
                            disabled={record.isHandedOver}
                            style={record.isHandedOver ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => addEmptyItemToRecord(todayDate, record.id)} 
                          style={{ fontSize: '0.85rem', padding: '6px 12px', opacity: record.isHandedOver ? 0.5 : 1, cursor: record.isHandedOver ? 'not-allowed' : 'pointer' }}
                          disabled={record.isHandedOver}
                        >
                          <Plus size={16} /> Tambah Baris Produk
                        </button>
                      </div>

                      <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <FileText size={14} className="text-muted" />
                          <label className="form-label mb-0" style={{ fontSize: '0.8rem' }}>Catatan Vendor (Opsional)</label>
                        </div>
                        <textarea
                          className="form-input"
                          placeholder="Tambahkan catatan khusus untuk hari ini..."
                          value={record.note || ''}
                          onChange={(e) => updateDailyRecordNote(todayDate, record.id, e.target.value)}
                          style={{ minHeight: '60px', resize: 'vertical' }}
                          disabled={record.isHandedOver}
                        />
                      </div>
                    </div>

                    {!record.isHandedOver && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <button 
                          className="btn" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (window.confirm(`Apakah Anda yakin ingin menghapus seluruh catatan penjualan untuk ${getVendorName(record.vendorId)} hari ini?`)) {
                              deleteDailyRecord(todayDate, record.id); 
                            }
                          }} 
                          style={{ 
                            fontSize: '0.85rem', 
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'white',
                            background: 'var(--danger)',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius)',
                            fontWeight: '600'
                          }}
                        >
                          <Trash2 size={16} /> Hapus Catatan Vendor
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Vendor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Pilih Vendor"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleAddVendor} disabled={!selectedVendor}>Tambahkan</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Pilih Vendor</label>
          {vendors.length === 0 ? (
            <p className="text-muted">Tidak ada vendor. Silakan tambah di Data Vendor terlebih dahulu.</p>
          ) : (
            <select
              className="form-input"
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
            >
              <option value="">-- Pilih --</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
