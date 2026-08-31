'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ShieldAlert, Package, Calendar, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function DrugsTab({ API_BASE, showAlert, showConfirm }) {
  const [drugs, setDrugs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(false);

  // New drug form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Tablet');
  const [expiryDate, setExpiryDate] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [notifyThreshold, setNotifyThreshold] = useState('10');
  const [stock, setStock] = useState('');

  // Editing drug state
  const [editingId, setEditingId] = useState(null);
  const [editStock, setEditStock] = useState('');

  useEffect(() => {
    fetchDrugs();
  }, []);

  const fetchDrugs = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiFetch(`/drugs?search=${encodeURIComponent(query)}`);
      setDrugs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDrug = async (e) => {
    e.preventDefault();
    if (!name || !type) {
      await showAlert('Please fill Name and Type fields.', 'Validation Error');
      return;
    }

    const payload = {
      name,
      type,
      expiry_date: expiryDate || null,
      selling_price: parseFloat(sellingPrice) || 0.00,
      buying_price: parseFloat(buyingPrice) || 0.00,
      notify_threshold: parseInt(notifyThreshold) || 10,
      stock: parseInt(stock) || 0
    };

    try {
      await apiFetch('/drugs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await showAlert('New drug added to inventory catalog successfully!', 'Success');
      setShowAddForm(false);
      clearForm();
      fetchDrugs(searchQuery);
    } catch (err) {
      await showAlert('Failed to add new drug to database.', 'Database Error');
    }
  };

  const handleUpdateStock = async (drugId, currentDrug) => {
    if (editStock === '' || isNaN(editStock)) {
      await showAlert('Please enter a valid numeric stock quantity.', 'Input Error');
      return;
    }

    const payload = {
      ...currentDrug,
      stock: parseInt(editStock)
    };

    try {
      await apiFetch(`/drugs/${drugId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setEditingId(null);
      setEditStock('');
      fetchDrugs(searchQuery);
      await showAlert('Inventory stock updated successfully!', 'Inventory Success');
    } catch (err) {
      await showAlert(err.message || 'Failed to update inventory.', 'Update Error');
    }
  };

  const handleDeleteDrug = async (drugId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this drug from the clinic catalog? This action cannot be undone.',
      'Delete Drug'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/drugs/${drugId}`, { method: 'DELETE' });
      fetchDrugs(searchQuery);
      await showAlert('Drug successfully deleted from catalog.', 'Delete Success');
    } catch (err) {
      await showAlert(err.message || 'Failed to delete drug.', 'Delete Error');
    }
  };

  const clearForm = () => {
    setName('');
    setType('Tablet');
    setExpiryDate('');
    setSellingPrice('');
    setBuyingPrice('');
    setNotifyThreshold('10');
    setStock('');
  };

  // Categories defined in requirements & screenshots
  const categories = ['All', 'Tablet', 'Syrup', 'Cream / LA', 'Dropper', 'Treatments & Other'];

  const filteredDrugs = drugs.filter(drug => {
    if (activeCategory === 'All') return true;
    return drug.type === activeCategory;
  });

  return (
    <div className="tab-scroll-wrapper fade-in">
      
      {/* Top Controls Toolbar */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem' }}>Drug Catalog & Inventory</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure drug pricing, alerts, and monitor stock levels</span>
          </div>

          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} /> {showAddForm ? 'Hide Form' : 'Add New Drug'}
          </button>
        </div>

        {/* Categories Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {cat}
              </button>
            );
          })}

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Search drug catalog..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchDrugs(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 16px',
                  fontSize: '0.95rem',
                  borderRadius: '10px',
                  border: '1.5px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#6366f1';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
                }}
              />
              <Search size={16} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      {/* New Drug Form */}
      {showAddForm && (
        <div className="glass-panel" style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '14px', color: 'var(--color-secondary)' }}>Register New Drug Asset</h4>
          <form onSubmit={handleAddDrug} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div>
              <label className="label-glass">Drug Name</label>
              <input type="text" className="input-glass" placeholder="e.g. Paracetamol 500mg" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label-glass">Type / Class</label>
              <select className="input-glass" value={type} onChange={(e) => setType(e.target.value)} style={{ appearance: 'none' }}>
                <option value="Tablet">Tablet</option>
                <option value="Syrup">Syrup</option>
                <option value="Cream / LA">Cream / LA</option>
                <option value="Dropper">Dropper</option>
                <option value="Treatments & Other">Treatments & Other</option>
              </select>
            </div>
            <div>
              <label className="label-glass">Expiry Date</label>
              <input type="date" className="input-glass" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Initial Stock Qty</label>
              <input type="number" className="input-glass" placeholder="e.g. 100" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Selling Price (LKR)</label>
              <input type="number" step="0.01" className="input-glass" placeholder="e.g. 4.50" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Buying Price (LKR)</label>
              <input type="number" step="0.01" className="input-glass" placeholder="e.g. 2.10" value={buyingPrice} onChange={(e) => setBuyingPrice(e.target.value)} />
            </div>
            <div>
              <label className="label-glass">Low Stock Notify Limit</label>
              <input type="number" className="input-glass" value={notifyThreshold} onChange={(e) => setNotifyThreshold(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                Save Asset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Stock Table */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>Drug ID</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>Medicine Name</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>Category</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>Expiry Date</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', textAlign: 'right' }}>S. Price</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', textAlign: 'right' }}>B. Price</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', textAlign: 'center' }}>Stock Status</th>
              <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', textAlign: 'center', width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading catalog inventory...</td>
              </tr>
            ) : filteredDrugs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No drugs registered matching this filter.</td>
              </tr>
            ) : (
              filteredDrugs.map((drug) => {
                const isLowStock = drug.stock <= drug.notify_threshold;
                const isExpired = drug.expiry_date && new Date(drug.expiry_date) < new Date();
                
                return (
                  <tr
                    key={drug.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isLowStock ? 'rgba(239, 68, 68, 0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>#DRG{drug.id}</td>
                    <td style={{ padding: '14px 20px', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {drug.name}
                        {isLowStock && (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--color-danger)',
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>OS</span>
                        )}
                        {isExpired && (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--color-orange)',
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>EXPIRED</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '4px 10px',
                        borderRadius: '12px'
                      }}>{drug.type}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: isExpired ? 'var(--color-orange)' : 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ opacity: 0.5 }} />
                        {drug.expiry_date ? new Date(drug.expiry_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: '500', color: 'var(--color-secondary)' }}>{parseFloat(drug.selling_price).toFixed(2)}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>{parseFloat(drug.buying_price).toFixed(2)}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 'bold',
                        color: isLowStock ? 'var(--color-danger)' : 'var(--color-success)'
                      }}>
                        {drug.stock} units
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {editingId === drug.id ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="number"
                              className="input-glass"
                              value={editStock}
                              onChange={(e) => setEditStock(e.target.value)}
                              placeholder="Qty"
                              style={{ width: '70px', padding: '4px 8px', fontSize: '0.8rem' }}
                            />
                            <button
                              className="btn btn-success"
                              onClick={() => handleUpdateStock(drug.id, drug)}
                              style={{ padding: '6px' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setEditingId(null)}
                              style={{ padding: '6px' }}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingId(drug.id);
                                setEditStock(drug.stock.toString());
                              }}
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              Restock
                            </button>
                            <button
                              onClick={() => handleDeleteDrug(drug.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
