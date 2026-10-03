import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import Modal from '../components/Modal';

const Vendors = () => {
  const { vendors, addVendor, updateVendor, deleteVendor } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.phone.includes(searchTerm)
  );

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingId(vendor.id);
    setFormData({ name: vendor.name, phone: vendor.phone });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateVendor(editingId, formData);
    } else {
      addVendor(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div>
      <div className="flex-between mb-6">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1, maxWidth: '400px' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Cari vendor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} /> Tambah Vendor
        </button>
      </div>

      <div className="table-container">
        {filteredVendors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Users size={32} />
            </div>
            <h3>Vendor tidak ditemukan</h3>
            <p>Tambahkan vendor baru untuk melihatnya di sini.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>No. HP</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map(vendor => (
                <tr key={vendor.id}>
                  <td className="font-bold">{vendor.name}</td>
                  <td>{vendor.phone || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-icon" onClick={() => openEditModal(vendor)}>
                      <Edit2 size={18} />
                    </button>
                    <button className="btn-icon danger" onClick={() => {const yakin = window.confirm(
                      `Apakah Anda yakin ingin menghapus vendor "${vendor.name}"?`
                    );
                    if (yakin) {
                      deleteVendor(vendor.id);
                    }
                    }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Vendor" : "Tambah Vendor Baru"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.name}>Simpan</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Nama Vendor</label>
          <input 
            type="text" 
            className="form-input" 
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="misal: Budi Bakery"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Nomor HP</label>
          <input 
            type="text" 
            className="form-input" 
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="e.g. 081234567890"
          />
        </div>
      </Modal>
    </div>
  );
};

export default Vendors;
