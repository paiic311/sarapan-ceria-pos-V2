import React, { useState } from 'react';
import { Save, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';
import { useStore, syncWithServer } from '../store/useStore';
import localforage from 'localforage';
import { API_URL } from '../config';

const Settings = () => {
  const { isOffline, initData } = useStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const handleManualSync = async () => {
    if (isOffline) {
      setSyncStatus('Tidak dapat menyinkronkan saat offline.');
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('Menyinkronkan dengan server...');
    try {
      await syncWithServer();
      setSyncStatus('Sinkronisasi berhasil!');
    } catch (err) {
      setSyncStatus('Sinkronisasi gagal. Silakan coba lagi nanti.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  const handleClearData = async () => {
  if (!window.confirm(
    "PERINGATAN!\n\nSemua data akan dihapus dari database dan perangkat.\n\nTindakan ini tidak dapat dibatalkan.\n\nLanjutkan?"
  )) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/reset-all-data`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Gagal menghapus data dari server');
    }

    await localforage.clear();
    await initData();

    alert('Semua data berhasil dihapus.');
  } catch (error) {
    console.error(error);
    alert('Gagal menghapus semua data.');
  }
};

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="table-container" style={{ padding: 24, marginBottom: 24 }}>
        <h3 className="header-title" style={{ fontSize: '1.25rem', marginBottom: 16 }}>Data & Sinkronisasi</h3>
        <p className="text-muted mb-6">Kelola bagaimana data aplikasi Anda disimpan dan disinkronkan ke berbagai perangkat.</p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <button 
            className="btn btn-primary" 
            onClick={handleManualSync} 
            disabled={isSyncing || isOffline}
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} /> 
            {isSyncing ? 'Menyinkronkan...' : 'Paksa Sinkronisasi ke Cloud'}
          </button>
          {syncStatus && <span className={syncStatus.includes('gagal') || syncStatus.includes('Tidak dapat') ? 'text-danger' : 'text-success'}>{syncStatus}</span>}
        </div>
        
        <div style={{ background: 'var(--surface-hover)', padding: 16, borderRadius: 'var(--radius)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <strong>Status:</strong> {isOffline ? <span className="text-danger">Offline - Menggunakan Penyimpanan Lokal</span> : <span className="text-success">Online - Sinkronisasi Otomatis</span>}
        </div>
      </div>

      <div className="table-container" style={{ padding: 24, border: '1px solid var(--danger)' }}>
        <h3 className="header-title text-danger" style={{ fontSize: '1.25rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={20} /> Zona Berbahaya
        </h3>
        <p className="text-muted mb-6">Tindakan di sini bersifat permanen dan tidak dapat dibatalkan.</p>
        
        <button className="btn btn-danger" onClick={handleClearData}>
          <Trash2 size={18} /> Hapus Semua Data
        </button>
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Settings;
