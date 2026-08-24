'use client';

import React, { useEffect, useRef } from 'react';

export default function QrCanvas({ text, size = 140 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    if (!text) {
      // Clear canvas when no text
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(
        canvas,
        text,
        {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',   // black modules
            light: '#ffffff',  // white background
          },
        },
        (err) => {
          if (err) console.error('QR generation error:', err);
        }
      );
    }).catch((err) => console.error('Failed to load qrcode lib:', err));
  }, [text, size]);

  if (!text) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        background: '#f8fafc',
        border: '1.5px dashed #cbd5e1',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/>
          <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
          <rect x="19" y="19" width="2" height="2"/>
        </svg>
        <span style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.3 }}>
          Click Generate
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '6px',
      padding: '4px',
      display: 'inline-flex',
      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: `${size}px`,
          height: `${size}px`,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
