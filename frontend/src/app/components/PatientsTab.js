'use client';

import React, { useState, useEffect } from 'react';
import { Search, Upload, FileText, Image as ImageIcon, Calendar, Edit2, Check, RefreshCw, Trash2, Eye, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function PatientsTab({ API_BASE, showAlert, showConfirm }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');

  // Edit Mode state
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [allergies, setAllergies] = useState('');

  // Diagnostic Images upload
  const [imageFile, setImageFile] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [patientImages, setPatientImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  // Medical History (visits & investigations)
  const [visitHistory, setVisitHistory] = useState([]);
  const [investigationsHistory, setInvestigationsHistory] = useState([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientDetails(selectedPatient.id);
    }
  }, [selectedPatient]);

  const fetchPatients = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiFetch(`/patients?search=${encodeURIComponent(query)}`);
      setPatients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Returns [startDate, endDate] for the active filter (as Date objects)
  const getFilteredPatients = () => {
    if (dateFilter === 'all') return patients;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoff;
    if (dateFilter === 'today') cutoff = today;
    else if (dateFilter === 'yesterday') {
      cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 1);
    } else if (dateFilter === 'last7') {
      cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 6);
    } else if (dateFilter === 'last30') {
      cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 29);
    }
    return patients.filter(p => {
      if (!p.last_visit_date) return false;
      const v = new Date(p.last_visit_date);
      const vDay = new Date(v.getFullYear(), v.getMonth(), v.getDate());
      if (dateFilter === 'today') return vDay.getTime() === today.getTime();
      if (dateFilter === 'yesterday') return vDay.getTime() === cutoff.getTime();
      return vDay >= cutoff;
    });
  };

  const filteredPatients = getFilteredPatients();

  const fetchPatientDetails = async (patientId) => {
    try {
      const [visitData, invData, imgData] = await Promise.all([
        apiFetch(`/patients/${patientId}/history`),
        apiFetch(`/patients/${patientId}/investigations`),
        apiFetch(`/patients/${patientId}/images`)
      ]);
      setVisitHistory(visitData);
      setInvestigationsHistory(invData);
      setPatientImages(imgData);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setEditMode(false);
    setName(patient.name);
    setTelephone(patient.telephone);
    setAge(patient.age.toString());
    setWeight(patient.weight ? patient.weight.toString() : '');
    setHeight(patient.height ? patient.height.toString() : '');
    setAllergies(patient.allergies || '');
  };

  const handleSaveChanges = async () => {
    if (!name || !telephone || !age) {
      await showAlert('Please fill out Name, Telephone, and Age fields.', 'Input Error');
      return;
    }

    try {
      const updated = await apiFetch(`/patients/${selectedPatient.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name, telephone,
          age: parseInt(age),
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          allergies
        })
      });
      setSelectedPatient(updated);
      setEditMode(false);
      fetchPatients(searchQuery);
      await showAlert('Patient demographic changes saved successfully!', 'Profile Update');
    } catch (err) {
      await showAlert('Failed to update patient demographic details.', 'Update Error');
    }
  };

  const handleDeletePatient = async () => {
    const confirmed = await showConfirm(
      `Are you sure you want to permanently delete "${selectedPatient.name}" and ALL their medical records? This action cannot be undone.`,
      'Delete Patient'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/patients/${selectedPatient.id}`, { method: 'DELETE' });
      await showAlert(`Patient "${selectedPatient.name}" has been permanently deleted.`, 'Patient Deleted');
      setSelectedPatient(null);
      setEditMode(false);
      fetchPatients(searchQuery);
    } catch (err) {
      await showAlert('Failed to delete patient. Please try again.', 'Delete Error');
    }
  };

  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      await showAlert('Please select a diagnostic scan image file first.', 'No File Selected');
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('caption', imageCaption);

    try {
      await apiFetch(`/patients/${selectedPatient.id}/images`, {
        method: 'POST',
        body: formData
      });
      await showAlert('Diagnostic scan image stored in database successfully!', 'Upload Success');
      setImageFile(null);
      setImageCaption('');
      const fileInput = document.getElementById('image-upload-input');
      if (fileInput) fileInput.value = '';
      fetchPatientDetails(selectedPatient.id);
    } catch (err) {
      await showAlert('Failed to store scan file in database.', 'Upload Error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this diagnostic scan image from the database?',
      'Delete Scan'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/patients/${selectedPatient.id}/images/${imageId}`, { method: 'DELETE' });
      await showAlert('Diagnostic scan image deleted successfully.', 'Scan Deleted');
      fetchPatientDetails(selectedPatient.id);
    } catch (err) {
      await showAlert('Failed to delete scan image.', 'Delete Error');
    }
  };

  return (
    <div className="grid-container fade-in" style={{
      gridTemplateColumns: 'repeat(12, 1fr)',
      padding: '12px 4px',
      maxWidth: '1400px',
      margin: '0 auto',
      gap: '20px'
    }}>

      {/* LEFT COLUMN: Patient search list */}
      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Patients Directory</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-muted)' }}>
              {filteredPatients.length} of {patients.length}
            </span>
          </h3>

          {/* Search Row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="input-glass"
                placeholder="Name or Telephone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchPatients(searchQuery)}
              />
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button className="btn btn-primary" onClick={() => fetchPatients(searchQuery)}>
              Go
            </button>
          </div>

          {/* Directory Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>Loading directory...</p>
            ) : filteredPatients.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                {dateFilter !== 'all' ? 'No patients visited in this period.' : 'No patients found.'}
              </p>
            ) : (
              filteredPatients.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    style={{
                      background: selectedPatient?.id === p.id ? 'rgba(0,100,200,0.08)' : 'rgba(0,100,200,0.02)',
                      border: selectedPatient?.id === p.id ? '1.5px solid var(--color-primary)' : '1px solid rgba(0,100,200,0.12)',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    {/* Left: name + tel/age */}
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: selectedPatient?.id === p.id ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Tel: {p.telephone} | Age: {p.age} yrs
                      </div>
                    </div>
                    {/* Right: last visit badge */}
                    {p.last_visit_date && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '2px', flexShrink: 0,
                        background: selectedPatient?.id === p.id ? 'rgba(0,100,200,0.12)' : 'rgba(0,100,200,0.06)',
                        border: '1px solid rgba(0,100,200,0.15)',
                        borderRadius: '8px', padding: '6px 10px', minWidth: '74px'
                      }}>
                        <Calendar size={13} color="var(--color-primary)" />
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Last visit</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                          {new Date(p.last_visit_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Patient Medical records profile */}
      <div style={{ gridColumn: 'span 8' }}>



        {selectedPatient ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Filter pills inside top of first panel */}
            <div className="glass-panel" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginRight: '4px' }}>Filter by visit:</span>
                {[
                  { key: 'all',       label: 'All Patients' },
                  { key: 'today',     label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'last7',     label: 'Last 7 Days' },
                  { key: 'last30',    label: 'Last 30 Days' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setDateFilter(f.key)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '22px',
                      fontSize: '0.9rem',
                      fontWeight: dateFilter === f.key ? '600' : '400',
                      border: dateFilter === f.key ? '2px solid var(--color-primary)' : '1.5px solid var(--glass-border)',
                      background: dateFilter === f.key ? 'rgba(0,100,200,0.12)' : 'transparent',
                      color: dateFilter === f.key ? 'var(--color-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.18s'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>



            {/* Demographics Profile Panel */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                    Patient Profile ID: #000{selectedPatient.id}
                  </span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '2px' }}>{selectedPatient.name}</h2>
                </div>

                {editMode ? (
                  <button className="btn btn-success" style={{ padding: '8px 16px' }} onClick={handleSaveChanges}>
                    <Check size={16} /> Save
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '8px 16px' }}
                      onClick={handleDeletePatient}
                      title="Permanently delete this patient"
                    >
                      <Trash2 size={16} /> Delete Patient
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setEditMode(true)}>
                      <Edit2 size={16} /> Edit Profile
                    </button>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <label className="label-glass">Full Name</label>
                  <input type="text" className="input-glass" value={name} onChange={(e) => setName(e.target.value)} disabled={!editMode} />
                </div>
                <div>
                  <label className="label-glass">Telephone Number</label>
                  <input type="text" className="input-glass" value={telephone} onChange={(e) => setTelephone(e.target.value)} disabled={!editMode} />
                </div>
                <div>
                  <label className="label-glass">Age</label>
                  <input type="number" className="input-glass" value={age} onChange={(e) => setAge(e.target.value)} disabled={!editMode} />
                </div>
                <div>
                  <label className="label-glass">Weight (kg)</label>
                  <input type="number" className="input-glass" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={!editMode} />
                </div>
                <div>
                  <label className="label-glass">Height (cm)</label>
                  <input type="number" className="input-glass" value={height} onChange={(e) => setHeight(e.target.value)} disabled={!editMode} />
                </div>
                <div>
                  <label className="label-glass">Allergies</label>
                  <input type="text" className="input-glass" value={allergies} onChange={(e) => setAllergies(e.target.value)} disabled={!editMode} />
                </div>
              </div>
            </div>

            {/* Quick Access to Investigations (11 Laboratory Parameters Grid) */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--color-secondary)' }}>
                Laboratory Investigations History
              </h3>

              {investigationsHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No clinical laboratory values recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1000px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>FBC</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>FBS</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Lipid Profile</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>UFR</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>C-RP</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>ESR</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Dengue NS1</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Influenza</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>LFT</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>TFT</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>RFT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investigationsHistory.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px', fontWeight: 'bold' }}>{new Date(inv.test_date).toLocaleDateString()}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.fbc || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.fbs || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.lipid_profile || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.ufr || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.crp || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.esr || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.dengue_ns1 || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.influenza_ag || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.lft || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.tft || '--'}</td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{inv.rft || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Diagnostic Image Upload & Gallery */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--color-secondary)' }}>
                Diagnostic Scan Uploads
              </h3>

              {/* Upload Form */}
              <form onSubmit={handleImageUpload} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '12px', marginBottom: '20px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <div>
                  <label className="label-glass" style={{ fontSize: '0.75rem' }}>Select Image File</label>
                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files[0])}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label className="label-glass" style={{ fontSize: '0.75rem' }}>Description / Caption</label>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="e.g. Chest X-Ray, Abdomen scan"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px', width: '100%', fontSize: '0.85rem' }} disabled={uploadingImage}>
                    {uploadingImage ? '...' : <><Upload size={14} /> Upload</>}
                  </button>
                </div>
              </form>

              {/* Diagnostic Images List */}
              {patientImages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No diagnostic scans stored in database yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {patientImages.map(img => {
                    const fullUrl = (img.image_url && (img.image_url.startsWith('data:') || img.image_url.startsWith('http')))
                      ? img.image_url
                      : `${API_BASE.replace('/api', '')}${img.image_url}`;
                    return (
                      <div key={img.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        <div
                          onClick={() => setPreviewImage({ url: fullUrl, caption: img.caption, date: img.uploaded_at })}
                          style={{ position: 'relative', width: '100%', height: '120px', overflow: 'hidden', cursor: 'pointer' }}
                          title="Click to view full scan"
                        >
                          <img
                            src={fullUrl}
                            alt={img.caption || 'Diagnostic Scan'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                          >
                            <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Eye size={12} /> View Full
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: '8px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: '6px' }}>
                            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.caption || 'Scan'}</strong>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{new Date(img.uploaded_at).toLocaleDateString()}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                            title="Delete scan from database"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Diagnostic Image Lightbox Modal */}
            {previewImage && (
              <div
                onClick={() => setPreviewImage(null)}
                style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 200000, padding: '20px', backdropFilter: 'blur(4px)'
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#111827', borderRadius: '12px', border: '1px solid #374151',
                    maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                  }}
                >
                  <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151' }}>
                    <div>
                      <strong style={{ color: '#f3f4f6', fontSize: '0.95rem' }}>{previewImage.caption || 'Diagnostic Scan'}</strong>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '10px' }}>{new Date(previewImage.date).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => setPreviewImage(null)}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', background: '#000' }}>
                    <img
                      src={previewImage.url}
                      alt={previewImage.caption || 'Diagnostic Scan'}
                      style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visit History Log */}
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--color-secondary)' }}>
                Clinical Encounter History
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visitHistory.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No previous visits logged.</p>
                ) : (
                  visitHistory.map(visit => (
                    <div key={visit.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '15px' }}>
                      <div style={{ borderRight: '1px solid var(--glass-border)', paddingRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                          <Calendar size={14} style={{ color: 'var(--color-secondary)' }} />
                          {new Date(visit.visit_date).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Visit ID: #{visit.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 'bold', marginTop: '4px' }}>Fee: {visit.total_fee} LKR</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '0.9rem' }}>
                          <strong>Diagnosis:</strong> {visit.diagnosis || 'General checkup'}
                        </p>

                        {visit.prescriptions && visit.prescriptions.length > 0 && (
                          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px' }}>
                            <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Prescription Issued:</strong>
                            <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {visit.prescriptions.map((rx, rxIdx) => (
                                <li key={rxIdx}>
                                  {rx.medicine_name} - {rx.dosage} for {rx.duration_days} Days
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {visit.next_visit_plan && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-orange)' }}>
                            <strong>Follow up Plan:</strong> {visit.next_visit_plan}
                            {visit.next_visit_date && ` (Scheduled: ${new Date(visit.next_visit_date).toLocaleDateString()})`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ display: 'flex', height: '100%', flexDirection: 'column', minHeight: '600px' }}>
            {/* Filter bar always shown at top */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', marginRight: '4px' }}>Filter by visit:</span>
              {[
                { key: 'all',       label: 'All Patients' },
                { key: 'today',     label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'last7',     label: 'Last 7 Days' },
                { key: 'last30',    label: 'Last 30 Days' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '22px',
                    fontSize: '0.9rem',
                    fontWeight: dateFilter === f.key ? '600' : '400',
                    border: dateFilter === f.key ? '2px solid var(--color-primary)' : '1.5px solid var(--glass-border)',
                    background: dateFilter === f.key ? 'rgba(0,100,200,0.12)' : 'transparent',
                    color: dateFilter === f.key ? 'var(--color-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.18s'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Empty state */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <FileText size={64} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ fontSize: '1.1rem' }}>No patient selected</p>
              <p style={{ fontSize: '0.85rem' }}>Select a patient from the directory on the left to review medical history and scans.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
