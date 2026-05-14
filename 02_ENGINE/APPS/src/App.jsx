import React, { useState } from 'react';

const App = () => {
  const [tactics, setTactics] = useState([
    {
      id: 1,
      title: "K'Sante Burst Build",
      source: "YouTube / Midbeast",
      core: "特定アイテムのシナジーで火力が30%向上",
      tag: "NEW",
      timestamp: "2026-04-05 12:00"
    },
    {
      id: 2,
      title: "Patch 14.x Meta Shift",
      source: "Official Patch Notes",
      core: "ジャングルキャンプの経験値バフによるフルクリア環境への移行",
      tag: "ANALYZED",
      timestamp: "2026-04-04 18:30"
    }
  ]);

  return (
    <>
      <div className="sidebar">
        <h1 className="gold-gradient-text" style={{ fontSize: '1.8rem' }}>ANTIGRAVITY</h1>
        <p style={{ fontSize: '0.7rem', color: 'gray', marginBottom: '2rem' }}>SOVEREIGN OS v1.0</p>
        
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>AGENTS</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '1rem' }}><span className="status-dot status-online"></span> Sentinel</li>
            <li style={{ marginBottom: '1rem' }}><span className="status-dot status-online"></span> Scout</li>
            <li style={{ marginBottom: '1rem' }}><span className="status-dot status-idle"></span> Commander</li>
          </ul>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>REVENUE</h3>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>¥5,400 <span style={{ fontSize: '0.7rem', color: '#2ecc71' }}>+12%</span></div>
        </div>
      </div>

      <div className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Intelligence Nexus</h2>
            <p>斥候スカウトが捕捉した最新の戦毅・知能ストック</p>
          </div>
          <button style={{ 
            background: 'none', 
            border: '1px solid #d4af37', 
            color: '#d4af37', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}>
            MANUAL REFRESH
          </button>
        </header>

        <div className="card-grid">
          {tactics.map(t => (
            <div key={t.id} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span className="badge">{t.tag}</span>
                <span style={{ fontSize: '0.7rem', color: '#555' }}>{t.timestamp}</span>
              </div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{t.title}</h3>
              <p style={{ marginBottom: '1rem' }}>{t.core}</p>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>Source: {t.source}</div>
              
              <button style={{ 
                marginTop: '1.5rem',
                width: '100%',
                background: 'linear-gradient(135deg, #d4af37 0%, #f1c40f 100%)',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: '#000'
              }}>
                VIEW DETAILS
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '3rem' }} className="panel">
          <h3 style={{ marginBottom: '1rem' }}>Sovereign Orders (指令板)</h3>
          <p>王の指揮官が待機中の指令を表示します。</p>
          <div style={{ borderTop: '1px solid #222', marginTop: '1rem', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>note記事の錬成案承認待ち</span>
              <span className="badge">PENDING</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
