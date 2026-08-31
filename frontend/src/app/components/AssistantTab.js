'use client';

import React, { useState, useEffect } from 'react';
import { Search, QrCode, UserPlus, RefreshCw, Send, Check, Printer, X, SlidersHorizontal } from 'lucide-react';
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

  // Others popup modal
  const [showOthersModal, setShowOthersModal] = useState(false);
  // Temp state inside the modal (so user can cancel without saving)
  const [modalAge, setModalAge] = useState('');
  const [modalWeight, setModalWeight] = useState('');
  const [modalHeight, setModalHeight] = useState('');
  const [modalAllergies, setModalAllergies] = useState('');

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

  // Open the Others modal, pre-populating temp state from current values
  const openOthersModal = () => {
    setModalAge(age);
    setModalWeight(weight);
    setModalHeight(height);
    setModalAllergies(allergies);
    setShowOthersModal(true);
  };

  // Save modal values back to main state
  const saveOthersModal = () => {
    setAge(modalAge);
    setWeight(modalWeight);
    setHeight(modalHeight);
    setAllergies(modalAllergies);
    setShowOthersModal(false);
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

  // Determine if any "Others" data has been filled
  const hasOthersData = age || weight || height || allergies;

  return (
    <>
      {/* Main no-scroll layout wrapper */}
      <div className="doctor-panel-wrapper fade-in">


        {/* Two-column content area */}
        <main className="doctor-content">

          {/* LEFT: Search + Patient Form */}
          <section className="left-scroll-container">

            {/* Search Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>Search Patient</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Search by Tel No or Name"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    style={{ paddingRight: '36px' }}
                  />
                  <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
                <button className="btn btn-primary" onClick={handleSearch} disabled={loadingSearch} style={{ padding: '10px 14px' }}>
                  {loadingSearch ? '...' : <Search size={16} />}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid rgba(0,100,200,0.15)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,80,180,0.1)' }}>
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => selectPatient(p)}
                      style={{ padding: '9px 14px', borderBottom: '1px solid rgba(0,100,200,0.08)', cursor: 'pointer', fontSize: '0.95rem', color: '#0f172a' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,100,200,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <strong style={{ color: 'var(--color-secondary)' }}>{p.name}</strong> - {p.telephone} ({p.age} yrs)
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,100,200,0.05)', border: '1px solid rgba(0,100,200,0.12)', borderRadius: '8px', padding: '10px 12px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <QrCode size={26} style={{ color: 'var(--text-secondary)' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Scan QR Code</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick check-in</div>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.78rem' }} onClick={handleScanQrMock}>Scanner</button>
              </div>
            </div>

            {/* Patient Details Form */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>Confirm Patient Details</h3>

              {/* Q No + Visit Date */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '76px' }}>
                  <label className="label-glass" style={{ fontSize: '0.8rem' }}>Q No</label>
                  <input type="number" className="input-glass" value={queueNumber} onChange={e => setQueueNumber(e.target.value)} style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 'bold', padding: '9px 6px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label-glass" style={{ fontSize: '0.8rem' }}>Visit Date</label>
                  <input type="date" className="input-glass" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={{ padding: '9px 10px' }} />
                </div>
              </div>

              {/* Name + Telephone + QR */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.8rem' }}>Patient Name</label>
                    <input type="text" className="input-glass" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={{ padding: '9px 12px' }} />
                  </div>
                  <div>
                    <label className="label-glass" style={{ fontSize: '0.8rem' }}>Telephone No</label>
                    <input type="text" className="input-glass" placeholder="Mobile / Landline" value={telephone} onChange={e => setTelephone(e.target.value)} style={{ padding: '9px 12px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <label className="label-glass" style={{ fontSize: '0.7rem' }}>Patient QR</label>
                  <div style={{ width: '86px', height: '86px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <QrCanvas text={qrCodeData} size={82} />
                  </div>
                </div>
              </div>

              {/* Others data summary badges */}
              {hasOthersData && (
                <div style={{ background: 'rgba(0,100,200,0.05)', border: '1px solid rgba(0,100,200,0.15)', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '2px' }}>Info:</span>
                  {age && <span style={{ fontSize: '0.8rem', background: 'rgba(0,100,200,0.1)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>Age: {age}y</span>}
                  {weight && <span style={{ fontSize: '0.8rem', background: 'rgba(0,180,216,0.1)', color: 'var(--color-secondary)', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>Wt: {weight}kg</span>}
                  {height && <span style={{ fontSize: '0.8rem', background: 'rgba(5,150,105,0.1)', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>Ht: {height}cm</span>}
                  {allergies && <span style={{ fontSize: '0.78rem', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>⚠ {allergies.length > 22 ? allergies.slice(0, 22) + '…' : allergies}</span>}
                </div>
              )}

              {/* Action buttons row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr', gap: '8px' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.9rem', padding: '10px 8px' }} onClick={handleUpdateAndSend}><Send size={15} /> Update &amp; Send</button>
                <button className="btn btn-secondary" style={{ fontSize: '0.9rem', padding: '10px 8px' }} onClick={handleUpdateOnly}><Check size={15} /> Update Only</button>
                <button className="btn btn-danger" style={{ fontSize: '0.9rem', padding: '10px 8px' }} onClick={handleClear}>Clear</button>
              </div>

              {/* Action buttons row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--color-secondary)', fontSize: '0.85rem', padding: '9px 6px' }}
                  onClick={async () => patientId
                    ? await showAlert(`Records loaded for patient ID: ${patientId}`, 'Patient Records')
                    : await showAlert('No patient selected.', 'No Patient')}
                >
                  Reports
                </button>

                {/* Others button — opens popup */}
                <button
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem', padding: '9px 6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    border: hasOthersData ? '1px solid var(--color-secondary)' : undefined,
                    color: hasOthersData ? 'var(--color-secondary)' : undefined,
                    position: 'relative'
                  }}
                  onClick={openOthersModal}
                  title="Set Age, Weight, Height & Allergies"
                >
                  <SlidersHorizontal size={14} />
                  Others
                  {hasOthersData && (
                    <span style={{
                      position: 'absolute', top: '-5px', right: '-5px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: 'var(--color-secondary)', border: '2px solid white'
                    }} />
                  )}
                </button>

                <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '9px 6px' }} onClick={handlePrintCard}><Printer size={14} /> Token</button>
              </div>
            </div>

          </section>

          {/* RIGHT: Queue View */}
          <section className="right-scroll-container">
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>Realtime Patient Queue</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date: {visitDate}</span>
                </div>
                <button className="btn btn-secondary" onClick={fetchQueue} disabled={loadingQueue} style={{ padding: '8px 12px' }}>
                  <RefreshCw size={14} /> Refresh
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
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: isActive ? 'rgba(0, 119, 230, 0.08)' : 'rgba(0,100,200,0.03)',
                          border: isActive ? '1px solid var(--color-primary)' : '1px solid rgba(0,100,200,0.12)',
                          borderRadius: '10px', padding: '12px 18px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{
                            background: isActive ? 'var(--color-primary)' : 'rgba(0,100,200,0.1)',
                            width: '40px', height: '40px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '1.1rem',
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
                            fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', fontWeight: '600',
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
          </section>

        </main>
      </div>

      {/* ═══ "Others" Popup Modal — Age / Weight / Height / Allergies ═══ */}
      {showOthersModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowOthersModal(false); }}
        >
          <div style={{
            background: '#ffffff', borderRadius: '18px',
            width: '100%', maxWidth: '420px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
            border: '1px solid rgba(0,100,200,0.15)',
            overflow: 'hidden',
            animation: 'scaleUp 0.18s ease forwards'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(0,100,200,0.06), rgba(0,180,216,0.04))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <SlidersHorizontal size={18} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>Patient Details</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Age, vitals &amp; allergy information</p>
                </div>
              </div>
              <button
                onClick={() => setShowOthersModal(false)}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Age */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Age (Years)</label>
                <input
                  type="number" placeholder="Age in years" value={modalAge}
                  onChange={e => setModalAge(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '1rem', background: '#f8fafc', color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#0077e6'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Weight + Height */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Weight (kg)</label>
                  <input
                    type="number" placeholder="e.g. 70" value={modalWeight}
                    onChange={e => setModalWeight(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '1rem', background: '#f8fafc', color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#0077e6'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Height (cm)</label>
                  <input
                    type="number" placeholder="e.g. 175" value={modalHeight}
                    onChange={e => setModalHeight(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '1rem', background: '#f8fafc', color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#0077e6'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Allergies</label>
                <textarea
                  rows={3} placeholder="Food, medicine, or environmental allergies..."
                  value={modalAllergies} onChange={e => setModalAllergies(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '0.95rem', resize: 'none', background: '#f8fafc', color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
                {modalAllergies && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.73rem', color: '#ef4444' }}>⚠ Allergy alert will be shown on patient card.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', background: '#f8fafc' }}>
              <button
                onClick={() => setShowOthersModal(false)}
                style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: '600', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={saveOthersModal}
                style={{ flex: 2, padding: '10px', fontSize: '0.9rem', fontWeight: '700', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,153,255,0.3)' }}
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
