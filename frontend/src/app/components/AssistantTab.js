'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, QrCode, UserPlus, RefreshCw, Send, Check, Printer, X, SlidersHorizontal, Package, Clock } from 'lucide-react';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const searchDebounceRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Calculate dropdown position from input element
  const updateDropdownPos = () => {
    if (searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  // Close suggestions on outside click; also update position on scroll/resize
  useEffect(() => {
    const handler = (e) => { if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setShowSuggestions(false); };
    const reposition = () => { if (showSuggestions) updateDropdownPos(); };
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [showSuggestions]);

  // Debounced live search
  const handleSearchInput = useCallback((val) => {
    setSearchQuery(val);
    clearTimeout(searchDebounceRef.current);
    if (!val.trim()) { setSearchResults([]); setShowSuggestions(false); return; }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/patients?search=${encodeURIComponent(val)}`);
        setSearchResults(data);
        if (data.length > 0) { updateDropdownPos(); setShowSuggestions(true); }
        else setShowSuggestions(false);
      } catch { setSearchResults([]); }
    }, 300);
  }, []);

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
  const [loadingSearch, setLoadingSearch] = useState(false);

  // ── Medicine Dispensing panel state ──
  const [dispensingList, setDispensingList] = useState([]);
  const [loadingDispensing, setLoadingDispensing] = useState(false);
  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const visitDateRef = useRef(visitDate);
  useEffect(() => { visitDateRef.current = visitDate; }, [visitDate]);

  // Silent refresh — updates list WITHOUT setting loadingDispensing (no blink)
  const silentRefresh = useCallback(async (date) => {
    try {
      const data = await apiFetch(`/queue/dispensing?date=${date || visitDateRef.current}`);
      setDispensingList(data);
      const first = data.find(v => !v.dispensed);
      if (first) setExpandedVisitId(prev => prev ?? first.id);
    } catch (err) {
      console.error('Silent refresh error:', err.message);
    }
  }, []);

  // Initial fetch — shows spinner only on first load
  const fetchDispensing = useCallback(async (date) => {
    setLoadingDispensing(true);
    try {
      const data = await apiFetch(`/queue/dispensing?date=${date || visitDateRef.current}`);
      setDispensingList(data);
      const first = data.find(v => !v.dispensed);
      if (first) setExpandedVisitId(prev => prev ?? first.id);
    } catch (err) {
      console.error('Dispensing fetch error:', err.message);
    } finally {
      setLoadingDispensing(false);
    }
  }, []);

  // Mark medicines as dispensed
  const handleDone = async (visitId) => {
    try {
      await apiFetch(`/queue/${visitId}/dispensed`, { method: 'PUT' });
      setDispensingList(prev => prev.map(v => v.id === visitId ? { ...v, dispensed: true } : v));
    } catch (err) {
      console.error('Dispensed error:', err.message);
    }
  };

  // Helper: parse dosage string
  const parseDosageQty = (dosage = '') => {
    const parts = dosage.split(/[-\s]+/);
    const qty = parseFloat(parts[0]) || 1;
    const freq = (parts[1] || 'TDS').toUpperCase();
    const freqMap = { M: 1, N: 1, BD: 2, TDS: 3, QDS: 4, '8H': 3, '6H': 4, '4H': 6, '2H': 12, EOD: 0.5, WEEKLY: 0.143, STAT: 1, SOS: 1, VESP: 1, NOON: 1 };
    return { qty, freq, freqMult: freqMap[freq] ?? 3 };
  };

  // SSE connection for real-time push + 30s safety-net fallback
  useEffect(() => {
    fetchDispensing(visitDate); // Initial load with spinner

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('gp_clinic_token') : '';
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    let es = null;
    let fallbackInterval = null;

    const clearFallback = () => { if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; } };

    if (token) {
      es = new EventSource(`${API_BASE}/queue/events?token=${encodeURIComponent(token)}`);

      // Doctor confirmed a patient → silent refresh immediately
      es.addEventListener('dispensing:update', () => silentRefresh(visitDateRef.current));

      // SSE connected/reconnected → stop fallback polling
      es.addEventListener('connected', clearFallback);

      // SSE error → start 10s fallback polling until reconnected
      es.onerror = () => {
        if (!fallbackInterval) {
          fallbackInterval = setInterval(() => silentRefresh(visitDateRef.current), 10000);
        }
      };
    }

    // 30s safety-net poll even when SSE is healthy (catches edge cases)
    const safetyNet = setInterval(() => silentRefresh(visitDateRef.current), 30000);

    return () => {
      es?.close();
      clearFallback();
      clearInterval(safetyNet);
    };
  }, [visitDate]);

  const fetchQueue = async () => {
    // kept for legacy compatibility — dispensing now handles the right panel
    fetchDispensing(visitDate);
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
    setShowSuggestions(false);
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
    if (!name || !telephone) {
      await showAlert('Please enter Name and Telephone number.', 'Input Error');
      return;
    }
    const payload = {
      name,
      telephone,
      age: age ? parseInt(age) : null,
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
    if (!name || !telephone) {
      await showAlert('Please enter Name and Telephone number.', 'Input Error');
      return;
    }
    const payload = {
      name,
      telephone,
      age: age ? parseInt(age) : null,
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
              <div style={{ display: 'flex', gap: '8px' }} ref={searchBoxRef}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="input-glass"
                    placeholder="Search by Tel No or Name"
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); handleSearch(); } if (e.key === 'Escape') setShowSuggestions(false); }}
                    onFocus={() => { if (searchResults.length > 0) { updateDropdownPos(); setShowSuggestions(true); } }}
                    style={{ paddingRight: '36px' }}
                    autoComplete="off"
                  />
                  <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
                <button className="btn btn-primary" onClick={() => { setShowSuggestions(false); handleSearch(); }} disabled={loadingSearch} style={{ padding: '10px 14px' }}>
                  {loadingSearch ? '...' : <Search size={16} />}
                </button>
              </div>

              {/* Fallback results list (shown when suggestions hidden but results exist) */}
              {!showSuggestions && searchResults.length > 0 && (
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

          {/* RIGHT: Medicine Dispensing Panel */}
          <section className="right-scroll-container">
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0 }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Package size={18} style={{ color: 'var(--color-primary)' }} />
                    Medicine Dispensing
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date: {visitDate} · Auto-refreshes every 15s</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="date" className="input-glass" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
                  <button className="btn btn-secondary" onClick={() => fetchDispensing(visitDate)} disabled={loadingDispensing} style={{ padding: '7px 12px' }}>
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Content */}
              {loadingDispensing ? (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '8px' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : dispensingList.length === 0 ? (
                <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '10px', padding: '40px', gap: '10px' }}>
                  <Clock size={40} style={{ opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem' }}>Waiting for doctor to complete a visit...</p>
                  <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>Prescriptions will appear here automatically.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                  {dispensingList.map(visit => {
                    const isExpanded = expandedVisitId === visit.id;
                    const isDone = visit.dispensed;

                    return (
                      <div
                        key={visit.id}
                        style={{
                          border: isDone ? '1px solid #d1fae5' : '1.5px solid var(--color-primary)',
                          borderRadius: '12px',
                          background: isDone ? 'rgba(16,185,129,0.04)' : 'rgba(0,100,200,0.04)',
                          overflow: 'hidden',
                          opacity: isDone ? 0.7 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        {/* Card header — clickable to expand/collapse */}
                        <div
                          onClick={() => setExpandedVisitId(isExpanded ? null : visit.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', cursor: 'pointer',
                            background: isDone ? 'rgba(16,185,129,0.07)' : 'rgba(0,100,200,0.06)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                              background: isDone ? '#10b981' : 'var(--color-primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: '700', fontSize: '0.9rem', color: '#fff'
                            }}>
                              {visit.queue_number}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '0.97rem', color: isDone ? '#059669' : 'var(--text-primary)' }}>
                                {visit.name}{visit.age ? ` (${visit.age} yrs)` : ''}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {visit.prescriptions?.length || 0} medicine{visit.prescriptions?.length !== 1 ? 's' : ''}
                                {isDone && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: '600' }}>✓ Dispensed</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {visit.total_fee > 0 && (
                              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                                Rs. {parseFloat(visit.total_fee).toLocaleString()}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Expanded: medicines table */}
                        {isExpanded && (
                          <div style={{ padding: '12px 16px 14px' }}>
                            {/* Allergy warning */}
                            {visit.allergies && (
                              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '6px 12px', marginBottom: '10px', fontSize: '0.8rem', color: '#dc2626', fontWeight: '600' }}>
                                ⚠ Allergies: {visit.allergies}
                              </div>
                            )}

                            {/* Medicines table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                              <thead>
                                <tr style={{ background: 'rgba(0,100,200,0.06)', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '600', borderRadius: '6px 0 0 6px' }}>#</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '600' }}>Medicine</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600' }}>Freq</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600' }}>Qty</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '600' }}>Days</th>
                                  <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '600', borderRadius: '0 6px 6px 0' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visit.prescriptions?.map((rx, i) => {
                                  const parts = (rx.dosage || '').split(/[-\s]+/);
                                  const qty = parseFloat(parts[0]) || 1;
                                  const freq = (parts[1] || 'TDS').toUpperCase();
                                  const freqMap = { M: 1, N: 1, BD: 2, TDS: 3, QDS: 4, '8H': 3, '6H': 4, '4H': 6, EOD: 0.5, WEEKLY: 0.143, STAT: 1, SOS: 1, VESP: 1, NOON: 1 };
                                  const freqMult = freqMap[freq] ?? 3;
                                  const totalQty = freq === 'STAT' ? Math.ceil(qty) : Math.ceil(qty * freqMult * (rx.duration_days || 3));
                                  return (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                      <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{i + 1}.</td>
                                      <td style={{ padding: '7px 10px', fontWeight: '600', color: 'var(--text-primary)' }}>{rx.medicine_name}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--color-secondary)' }}>{freq}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{qty}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>{rx.duration_days}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '700', color: 'var(--color-primary)' }}>{totalQty}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Done button */}
                            {!isDone && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '8px' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '9px 24px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '7px' }}
                                  onClick={() => handleDone(visit.id)}
                                >
                                  <Check size={16} /> Done — Medicines Given
                                </button>
                              </div>
                            )}
                            {isDone && (
                              <div style={{ textAlign: 'center', marginTop: '10px', color: '#10b981', fontWeight: '700', fontSize: '0.88rem' }}>✓ Medicines dispensed</div>
                            )}
                          </div>
                        )}
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
      {/* Fixed-position autocomplete dropdown — renders above ALL containers */}
      {showSuggestions && searchResults.length > 0 && (
        <ul style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          zIndex: 999999,
          listStyle: 'none',
          margin: 0,
          padding: '4px 0',
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {searchResults.slice(0, 8).map(p => (
            <li
              key={p.id}
              onMouseDown={() => selectPatient(p)}
              style={{
                padding: '10px 16px', cursor: 'pointer', display: 'flex',
                flexDirection: 'column', gap: '3px',
                borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{p.name}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{p.telephone}{p.age ? ` | ${p.age} yrs` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
