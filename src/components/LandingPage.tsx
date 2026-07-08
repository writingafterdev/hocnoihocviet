import React from 'react';

export function LandingPage() {
  return (
    <div style={{ width: '100%', height: '100vh', border: 'none', margin: 0, padding: 0, overflow: 'hidden' }}>
      <iframe 
        src="/landing.html" 
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="TiengAnhKhong"
      />
    </div>
  );
}
