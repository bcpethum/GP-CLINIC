'use client';

import React, { useState, useEffect } from 'react';
import { Search, QrCode, UserPlus, RefreshCw, Send, Check, Printer } from 'lucide-react';
import QrCanvas from './QrCanvas';
import { apiFetch } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// AssistantTab Component
// Displays patient check-in, registration, token printing, and queue monitor
// Accessible to both Assistants and Doctors
// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantTab({ API_BASE: _API_BASE, showAlert, showConfirm, user }) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selected/Form Patient state
  const [patientId, setPatientId] = useState(null);
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [allergies, setAllergies] = useState('');

  const [qrCodeData, setQrCodeData] = useState('');
  const [queueNumber, setQueueNumber] = useState('1');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [queueList, setQueueList] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, [visitDate]);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const data = await apiFetch(`/queue?date=${visitDate}`);
      setQueueList(data);
      const maxQueue = data.reduce((max, item) => item.queue_number > max ? item.queue_number : max, 0);
      setQueueNumber((maxQueue + 1).toString());
    } catch (err) {
      console.error('Error fetching queue:', err.message);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoadingSearch(true);
    try {
      const data = await apiFetch(`/patients?search=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch (err) {
      console.error('Error searching patients:', err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectPatient = (patient) => {
    setPatientId(patient.id);
    setName(patient.name);
    setTelephone(patient.telephone);
    setAge(patient.age.toString());
    setWeight(patient.weight ? patient.weight.toString() : '');
    setHeight(patient.height ? patient.height.toString() : '');
    setAllergies(patient.allergies || '');
    setSearchResults([]);
    setSearchQuery('');
    setQrCodeData(`patient:${patient.id}:${patient.name}:${patient.telephone}`);
  };

  const handleClear = () => {
    setPatientId(null);
    setName(''); setTelephone(''); setAge('');
    setWeight(''); setHeight(''); setAllergies('');
    setSearchQuery(''); setSearchResults([]); setQrCodeData('');
  };

  const handleUpdateOnly = async () => {
    if (!name || !telephone || !age) {
      await showAlert('Please enter Name, Telephone, and Age.', 'Input Error');
      return;
    }
    const payload = {
      name,
      telephone,
      age: parseInt(age),
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      allergies
    };
    try {
      const savedPatient = patientId
        ? await apiFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('/patients', { method: 'POST', body: JSON.stringify(payload) });
      setPatientId(savedPatient.id);
      setQrCodeData(`patient:${savedPatient.id}:${savedPatient.name}:${savedPatient.telephone}`);
      await showAlert(patientId ? 'Patient demographics updated!' : 'New patient registered!', 'Success');
    } catch (err) {
      await showAlert(err.message || 'Failed to save patient.', 'Error');
    }
  };

  const handleUpdateAndSend = async () => {
    if (!name || !telephone || !age) {
      await showAlert('Please enter Name, Telephone, and Age.', 'Input Error');
      return;
    }
    const payload = {
      name,
      telephone,
      age: parseInt(age),
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      allergies
    };
    try {
      const patientData = patientId
        ? await apiFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('/patients', { method: 'POST', body: JSON.stringify(payload) });

      const actualPatientId = patientData.id;
      setPatientId(actualPatientId);
      setQrCodeData(`patient:${actualPatientId}:${patientData.name}:${patientData.telephone}`);

      await apiFetch('/queue', {
        method: 'POST',
        body: JSON.stringify({ patient_id: actualPatientId, date: visitDate })
      });
      await showAlert("Patient registered into today's queue!", 'Queue Registration');
      fetchQueue();
    } catch (err) {
      await showAlert(err.message || 'Error registering in queue.', 'Error');
    }
  };

  const handlePrintCard = async () => {
    if (!name) {
      await showAlert('No patient selected. Cannot print token.', 'No Patient Selected');
      return;
    }
    let qrImageSrc = '';
    if (qrCodeData) {
      try {
        const QRCode = (await import('qrcode')).default;
        qrImageSrc = await QRCode.toDataURL(qrCodeData);
      } catch (err) {
        console.error(err);
      }
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Patient Token</title>
          <style>
            body { font-family: sans-serif; padding: 30px; text-align: center; color: #333; }
            .card { border: 2px solid #0099ff; padding: 20px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
            h2 { color: #0099ff; margin-bottom: 5px; }
            .meta { font-size: 24px; font-weight: bold; margin: 15px 0; color: #f97316; }
            .details { text-align: left; line-height: 1.6; margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; font-size: 14px; }
          </style>
        </head>
        <body onload="window.print();window.close()">
          <div class="card">
            <h2>DOCWALLET CLINIC</h2>
            <p style="color: #666; margin: 0; font-size: 13px;">Patient Check-in Token</p>
            <div class="meta">Queue No: ${queueNumber}</div>
            ${qrImageSrc ? `<img src="${qrImageSrc}" width="120" height="120" />` : ''}
            <div class="details">
              <strong>Name:</strong> ${name}<br/>
              <strong>Age / Phone:</strong> ${age} yrs | ${telephone}<br/>
              <strong>Date:</strong> ${visitDate}<br/>
              <strong>Allergies:</strong> ${allergies || 'None'}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleScanQrMock = async () => {
    const scanData = prompt('Scan QR Simulator:\n\nEnter QR text (patient:ID:Name:Tel):');
    if (!scanData) return;
    if (scanData.startsWith('patient:')) {
      const parts = scanData.split(':');
      const id = parseInt(parts[1]);
      if (id && !isNaN(id)) {
        try {
          const patient = await apiFetch(`/patients/${id}`);
          selectPatient(patient);
          await showAlert(`Loaded: ${patient.name}`, 'Check-in Success');
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      await showAlert('Invalid QR format.', 'Scan Error');
    }
  };

  return (
    <div className="grid-container fade-in" style={{ gridTemplateColumns: 'repeat(12, 1fr)', padding: '12px 4px', maxWidth: '1400px', margin: '0 auto', gap: '20px' }}>

      {/* LEFT COLUMN: Search & Patient Intake Form */}
      <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Search Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>Search Patient</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="input-glass"
                placeholder="Search by Tel No or Name"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Search size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button className="btn btn-primary" onClick={handleSearch} disabled={loadingSearch}>
              {loadingSearch ? '...' : <Search size={18} />}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid rgba(0,100,200,0.15)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,80,180,0.1)' }}>
              {searchResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,100,200,0.08)', cursor: 'pointer', fontSize: '1rem', color: '#0f172a' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,100,200,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <strong style={{ color: 'var(--color-secondary)' }}>{p.name}</strong> - {p.telephone} ({p.age} yrs)
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,100,200,0.05)', border: '1px solid rgba(0,100,200,0.12)', borderRadius: '8px', padding: '12px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <QrCode size={30} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Scan QR Code</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick check-in</div>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleScanQrMock}>Scanner</button>
          </div>
        </div>

        {/* Patient Details Form */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>Confirm Patient Details</h3>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '80px' }}>
              <label className="label-glass">Q No</label>
              <input type="number" className="input-glass" value={queueNumber} onChange={e => setQueueNumber(e.target.value)} style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label-glass">Visit Date</label>
              <input type="date" className="input-glass" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label-glass">Patient Name</label>
                <input type="text" className="input-glass" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="label-glass">Telephone No</label>
                <input type="text" className="input-glass" placeholder="Mobile / Landline" value={telephone} onChange={e => setTelephone(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <label className="label-glass" style={{ fontSize: '0.7rem' }}>Patient QR</label>
              <div style={{ width: '88px', height: '88px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <QrCanvas text={qrCodeData} size={84} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="label-glass">Age</label>
              <input type="number" className="input-glass" placeholder="Age in yrs" value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Weight (kg)</label>
              <input type="number" className="input-glass" placeholder="e.g. 70" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Height (cm)</label>
              <input type="number" className="input-glass" placeholder="e.g. 175" value={height} onChange={e => setHeight(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-glass">Allergies</label>
            <textarea className="input-glass" rows={2} placeholder="Food, medicine, or environmental allergies" value={allergies} onChange={e => setAllergies(e.target.value)} style={{ resize: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleUpdateAndSend}><Send size={16} /> Update &amp; Send</button>
            <button className="btn btn-secondary" onClick={handleUpdateOnly}><Check size={16} /> Update Only</button>
            <button className="btn btn-danger" onClick={handleClear}>Clear</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ color: 'var(--color-secondary)' }}
              onClick={async () => patientId ? await showAlert(`Records loaded for patient ID: ${patientId}`, 'Patient Records') : await showAlert('No patient selected.', 'No Patient')}
            >
              Reports &amp; Other
            </button>
            <button className="btn btn-secondary" onClick={handlePrintCard}><Printer size={16} /> Print Token</button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Queue View */}
      <div style={{ gridColumn: 'span 7' }}>
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem' }}>Realtime Patient Queue</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {visitDate}</span>
            </div>
            <button className="btn btn-secondary" onClick={fetchQueue} disabled={loadingQueue} style={{ padding: '8px 12px' }}>
              <RefreshCw size={14} className={loadingQueue ? 'spin-anim' : ''} /> Refresh
            </button>
          </div>

          {loadingQueue ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading queue...</div>
          ) : queueList.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '8px', padding: '40px' }}>
              <UserPlus size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
              <p>Queue is empty for today.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
              {queueList.map(item => {
                const isActive = item.status === 'Active';
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isActive ? 'rgba(0, 119, 230, 0.08)' : 'rgba(0,100,200,0.03)',
                      border: isActive ? '1px solid var(--color-primary)' : '1px solid rgba(0,100,200,0.12)',
                      borderRadius: '10px',
                      padding: '12px 18px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{
                        background: isActive ? 'var(--color-primary)' : 'rgba(0,100,200,0.1)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        color: isActive ? 'white' : 'var(--color-primary)'
                      }}>
                        {item.queue_number}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1rem', color: isActive ? 'var(--color-primary)' : 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.telephone} | {item.age} yrs</div>
                        {item.allergies && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', background: 'rgba(239,68,68,0.1)', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', marginTop: '4px' }}>
                            Allergies: {item.allergies}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        background: isActive ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)',
                        color: isActive ? 'var(--color-success)' : 'var(--color-warning)'
                      }}>
                        {item.status}
                      </span>
                      <button
                        className="btn btn-secondary"
                        onClick={() => selectPatient({ id: item.patient_id, name: item.name, telephone: item.telephone, age: item.age, weight: item.weight, height: item.height, allergies: item.allergies })}
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
