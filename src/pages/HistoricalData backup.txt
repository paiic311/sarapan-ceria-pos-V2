import React, { useState, useMemo } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, Award, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isWithinInterval, parseISO } from 'date-fns';
import Modal from '../components/Modal';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const saveAndSharePDF = async (doc, filename) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: filename,
        data: pdfBase64,
        directory: Directory.Documents,
      });
      
      await Share.share({
        title: filename,
        url: result.uri,
        dialogTitle: 'Bagikan atau Simpan Laporan'
      });
    } catch (err) {
      console.error('Error saving PDF natively', err);
      alert('Gagal mengekspor PDF di perangkat ini.');
    }
  } else {
    doc.save(filename);
  }
};

const HistoricalData = () => {
  const { dailyRecords, vendors, updateEntireDailyRecord } = useStore();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState(null);

  // Filter records by date range
  const filteredRecords = useMemo(() => {
    const sDate = parseISO(startDate);
    const eDate = parseISO(endDate);
    
    // Sort dates descending
    const sortedDates = Object.keys(dailyRecords).sort((a, b) => new Date(b) - new Date(a));
    
    return sortedDates.filter(date => {
      try {
        return isWithinInterval(parseISO(date), { start: sDate, end: eDate });
      } catch (e) {
        return false;
      }
    }).map(date => dailyRecords[date]);
  }, [dailyRecords, startDate, endDate]);

  // Calculate summaries
  const summary = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    const vendorSales = {};

    filteredRecords.forEach(day => {
      day.records.forEach(record => {
        let recordSales = 0;
        record.items.forEach(item => {
          const bp = Number(item.basePrice) || 0;
          const sp = Number(item.salePrice) || 0;
          const qty = Number(item.qtySold) || 0;
          
          const sales = bp * qty;
          const profit = (sp - bp) * qty;
          
          totalSales += sales;
          totalProfit += profit;
          recordSales += sales;
        });

        if (vendorSales[record.vendorId]) {
          vendorSales[record.vendorId] += recordSales;
        } else {
          vendorSales[record.vendorId] = recordSales;
        }
      });
    });

    let bestVendorId = null;
    let maxSales = -1;
    for (const [vId, sales] of Object.entries(vendorSales)) {
      if (sales > maxSales) {
        maxSales = sales;
        bestVendorId = vId;
      }
    }

    const bestVendor = bestVendorId ? vendors.find(v => v.id === bestVendorId)?.name || 'Unknown' : 'N/A';

    return { totalSales, totalProfit, bestVendor };
  }, [filteredRecords, vendors]);

  const handleEditClick = () => {
    setIsEditMode(true);
    setEditData(JSON.parse(JSON.stringify(selectedRecord)));
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditData(null);
  };

  const handleSaveEdit = async () => {
    if (window.confirm("Apakah Anda yakin ingin menyimpan perubahan laporan harian ini?")) {
      await updateEntireDailyRecord(editData.date, editData);
      setSelectedRecord(editData);
      setIsEditMode(false);
    }
  };

  const handleEditItemChange = (recordIndex, itemIndex, field, value) => {
    const newData = { ...editData };
    newData.records[recordIndex].items[itemIndex][field] = value;
    setEditData(newData);
  };

  const handleEditNoteChange = (recordIndex, value) => {
    const newData = { ...editData };
    newData.records[recordIndex].note = value;
    setEditData(newData);
  };

  const calculateDayTotal = (dayRecord) => {
    let sales = 0;
    let profit = 0;
    dayRecord.records.forEach(r => {
      r.items.forEach(item => {
        const bp = Number(item.basePrice) || 0;
        const sp = Number(item.salePrice) || 0;
        const qty = Number(item.qtySold) || 0;
        sales += bp * qty;
        profit += (sp - bp) * qty;
      });
    });
    return { sales, profit };
  };

  const getVendorName = (vendorId) => {
    const v = vendors.find(v => v.id === vendorId);
    return v ? v.name : 'Unknown Vendor';
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Sarapan Ceria - Laporan Penjualan", 14, 22);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${startDate} hingga ${endDate}`, 14, 30);
    doc.text(`Total Penjualan: Rp ${summary.totalSales.toLocaleString()}`, 14, 36);
    doc.text(`Total Keuntungan: Rp ${summary.totalProfit.toLocaleString()}`, 14, 42);
    doc.text(`Vendor Terlaris: ${summary.bestVendor}`, 14, 48);

    const tableData = filteredRecords.map(day => {
      const totals = calculateDayTotal(day);
      return [
        day.date,
        day.records.length,
        `Rp ${totals.sales.toLocaleString()}`,
        `Rp ${totals.profit.toLocaleString()}`
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['Tanggal', 'Vendor Aktif', 'Total Penjualan', 'Total Keuntungan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    await saveAndSharePDF(doc, `Laporan_Penjualan_${startDate}_hingga_${endDate}.pdf`);
  };

  const exportDailyPDF = async (dayRecord) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Sarapan Ceria - Laporan Harian", 14, 22);
    
    const formattedDate = format(parseISO(dayRecord.date), 'dd MMM yyyy');
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Tanggal: ${formattedDate}`, 14, 30);
    
    const totals = calculateDayTotal(dayRecord);
    doc.text(`Total Penjualan: Rp ${totals.sales.toLocaleString()}`, 14, 36);
    doc.text(`Total Keuntungan: Rp ${totals.profit.toLocaleString()}`, 14, 42);

    let startY = 55;

    dayRecord.records.forEach(record => {
      doc.setFont("helvetica", "bold");
      doc.text(getVendorName(record.vendorId), 14, startY);
      
      let tableStartY = startY + 5;
      
      if (record.note) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        const splitNote = doc.splitTextToSize(`Catatan: ${record.note}`, 180);
        doc.text(splitNote, 14, startY + 6);
        tableStartY += (splitNote.length * 4) + 2;
        doc.setFontSize(11);
      }
      
      const tableData = record.items.map(item => {
        const bp = Number(item.basePrice) || 0;
        const sp = Number(item.salePrice) || 0;
        const qty = Number(item.qtySold) || 0;
        const titip = Number(item.qtyTitip) || 0;
        const sisa = titip - qty;
        return [
          item.productName || 'Produk',
          titip.toString(),
          qty.toString(),
          sisa.toString(),
          `Rp ${(bp * qty).toLocaleString()}`,
          `Rp ${((sp - bp) * qty).toLocaleString()}`
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [['Produk', 'Titip', 'Terjual', 'Sisa', 'Setor', 'Untung']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], halign: 'center' },
        styles: { halign: 'center' },
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 18 },
          4: { fontStyle: 'bold', cellWidth: 38 },
          5: { cellWidth: 38 }
        }
      });

      startY = doc.lastAutoTable.finalY + 15;
      
      if (startY > 270) {
        doc.addPage();
        startY = 20;
      }
    });

    await saveAndSharePDF(doc, `Laporan_Harian_${dayRecord.date}.pdf`);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Tanggal Mulai</label>
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Tanggal Selesai</label>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-outline" onClick={exportPDF} disabled={filteredRecords.length === 0}>
          <Download size={18} /> Ekspor PDF
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Penjualan Periode</div>
          <div className="stat-value">Rp {summary.totalSales.toLocaleString()}</div>
          <div style={{ position: 'absolute', top: 24, right: 24, color: 'var(--primary)', opacity: 0.2 }}>
            <TrendingUp size={48} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Keuntungan Periode</div>
          <div className="stat-value text-success">Rp {summary.totalProfit.toLocaleString()}</div>
          <div style={{ position: 'absolute', top: 24, right: 24, color: 'var(--primary-dark)', opacity: 0.2 }}>
            <DollarSign size={48} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Vendor Terlaris</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '12px' }}>{summary.bestVendor}</div>
          <div style={{ position: 'absolute', top: 24, right: 24, color: 'var(--secondary)', opacity: 0.2 }}>
            <Award size={48} />
          </div>
        </div>
      </div>

      <h2 className="header-title mb-4" style={{ fontSize: '1.25rem' }}>Rincian Harian</h2>
      
      <div className="table-container">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Calendar size={32} />
            </div>
            <h3>Data tidak ditemukan</h3>
            <p>Coba sesuaikan rentang tanggal.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Total Penjualan</th>
                <th>Total Keuntungan</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(day => {
                const totals = calculateDayTotal(day);
                return (
                  <tr key={day.date}>
                    <td className="font-bold">{format(parseISO(day.date), 'dd MMM yyyy')}</td>
                    <td>Rp {totals.sales.toLocaleString()}</td>
                    <td className="text-success">Rp {totals.profit.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setSelectedRecord(day)}>
                        Lihat Detail <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Detail: ${selectedRecord ? format(parseISO(selectedRecord.date), 'dd MMM yyyy') : ''}`}
        footer={
          isEditMode ? (
            <>
              <button className="btn btn-outline" onClick={handleCancelEdit}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Simpan Perubahan</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => { setSelectedRecord(null); setIsEditMode(false); }}>Tutup</button>
              <button className="btn btn-outline" onClick={handleEditClick}>Edit Data</button>
              <button className="btn btn-primary" onClick={() => exportDailyPDF(selectedRecord)}>
                <Download size={18} /> Laporan Harian
              </button>
            </>
          )
        }
      >
        {selectedRecord && !isEditMode && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
             {selectedRecord.records.map((record, i) => (
              <div key={record.id} style={{ marginBottom: i === selectedRecord.records.length - 1 ? 0 : 20, paddingBottom: i === selectedRecord.records.length - 1 ? 0 : 20, borderBottom: i === selectedRecord.records.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h4 className="font-bold" style={{ margin: 0 }}>{getVendorName(record.vendorId)}</h4>
                  {record.isHandedOver && (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      padding: '4px 8px',
                      borderRadius: '50px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={12} />
                      Uang Diserahkan
                    </span>
                  )}
                </div>
                
                {record.note && (
                  <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)', marginBottom: 16, fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--text-muted)' }}>
                      <FileText size={14} /> <span>Catatan:</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{record.note}</div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr 1.5fr', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  <div>Produk</div>
                  <div style={{ textAlign: 'center' }}>Titip</div>
                  <div style={{ textAlign: 'center' }}>Terjual</div>
                  <div style={{ textAlign: 'center' }}>Sisa</div>
                  <div style={{ textAlign: 'right' }}>Setor</div>
                  <div style={{ textAlign: 'right' }}>Untung</div>
                </div>
                {record.items.map((item, idx) => {
                  const bp = Number(item.basePrice) || 0;
                  const sp = Number(item.salePrice) || 0;
                  const qty = Number(item.qtySold) || 0;
                  const titip = Number(item.qtyTitip) || 0;
                  const sisa = titip - qty;
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.5fr 1.5fr', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.productName || 'Produk'}>
                        {item.productName || 'Produk'}
                      </div>
                      <div style={{ textAlign: 'center' }}>{titip}</div>
                      <div style={{ textAlign: 'center' }}>{qty}</div>
                      <div style={{ textAlign: 'center' }}>{sisa}</div>
                      <div style={{ textAlign: 'right', fontWeight: 'bold' }}>Rp {(bp * qty).toLocaleString()}</div>
                      <div style={{ textAlign: 'right', color: 'var(--primary-dark)' }}>Rp {((sp - bp) * qty).toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {selectedRecord && isEditMode && editData && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
            {editData.records.map((record, i) => (
              <div key={record.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h4 className="font-bold" style={{ margin: 0 }}>{getVendorName(record.vendorId)}</h4>
                  {record.isHandedOver && (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      padding: '4px 8px',
                      borderRadius: '50px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={12} />
                      Uang Diserahkan (Terkunci)
                    </span>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    <label className="form-label mb-0" style={{ fontSize: '0.8rem' }}>Catatan Vendor (Opsional)</label>
                    <textarea 
                      className="form-input" 
                      value={record.note || ''}
                      onChange={(e) => handleEditNoteChange(i, e.target.value)}
                      style={{ minHeight: '60px', resize: 'vertical' }}
                      disabled={record.isHandedOver}
                    />
                </div>

                <div>
                  <div className="item-row" style={{ padding: '0 8px 8px', borderBottom: 'none', background: 'transparent', display: window.innerWidth > 1024 ? 'grid' : 'none', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr', gap: '12px' }}>
                    <div className="form-label mb-0">Produk</div>
                    <div className="form-label mb-0">Titip</div>
                    <div className="form-label mb-0">Terjual</div>
                    <div className="form-label mb-0">Harga Modal (Rp)</div>
                    <div className="form-label mb-0">Harga Jual (Rp)</div>
                  </div>
                  
                  {record.items.map((item, idx) => (
                    <div key={idx} className="item-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1.5fr', gap: '12px', padding: window.innerWidth <= 1024 ? '16px' : '8px', borderBottom: '1px solid var(--border)' }}>
                      <div className="form-group mb-0" style={{ display: 'flex', flexDirection: window.innerWidth <= 1024 ? 'column' : 'row', alignItems: window.innerWidth <= 1024 ? 'flex-start' : 'center' }}>
                        {window.innerWidth <= 1024 && <label className="form-label">Produk</label>}
                        <div style={{ fontWeight: 'bold' }}>{item.productName || 'Produk'}</div>
                      </div>
                      <div className="form-group mb-0">
                        {window.innerWidth <= 1024 && <label className="form-label">Titip</label>}
                        <input type="number" className="form-input" value={item.qtyTitip === 0 ? '' : item.qtyTitip} onChange={e => handleEditItemChange(i, idx, 'qtyTitip', Number(e.target.value))} disabled={record.isHandedOver} />
                      </div>
                      <div className="form-group mb-0">
                        {window.innerWidth <= 1024 && <label className="form-label">Terjual</label>}
                        <input type="number" className="form-input" value={item.qtySold === 0 ? '' : item.qtySold} onChange={e => handleEditItemChange(i, idx, 'qtySold', Number(e.target.value))} disabled={record.isHandedOver} />
                      </div>
                      <div className="form-group mb-0">
                        {window.innerWidth <= 1024 && <label className="form-label">Harga Modal</label>}
                        <input type="number" className="form-input" value={item.basePrice === 0 ? '' : item.basePrice} onChange={e => handleEditItemChange(i, idx, 'basePrice', Number(e.target.value))} disabled={record.isHandedOver} />
                      </div>
                      <div className="form-group mb-0">
                        {window.innerWidth <= 1024 && <label className="form-label">Harga Jual</label>}
                        <input type="number" className="form-input" value={item.salePrice === 0 ? '' : item.salePrice} onChange={e => handleEditItemChange(i, idx, 'salePrice', Number(e.target.value))} disabled={record.isHandedOver} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HistoricalData;
