import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initLiff } from './lib/liff';
import { getPropertyId } from './lib/api';
import Home          from './pages/Home';
import InvoiceList   from './pages/InvoiceList';
import InvoiceDetail from './pages/InvoiceDetail';
import Invite        from './pages/Invite';
import './index.css';

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initLiff()
      .then(() => setReady(true))
      .catch(e => setError(e.message || 'LIFF init failed'));
  }, []);

  if (error) return (
    <div className="center-msg">
      <p className="icon">⚠️</p>
      <p className="title">เกิดข้อผิดพลาด</p>
      <p className="sub">{error}</p>
    </div>
  );

  if (!ready) return (
    <div className="center-msg">
      <p className="icon spin">⏳</p>
      <p className="sub">กำลังโหลด...</p>
    </div>
  );

  const pid = getPropertyId();
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');

  // ถ้ามี invite token → ไปหน้า accept invite เสมอ (idempotent)
  if (inviteToken) return <Invite />;

  if (!pid) return (
    <div className="center-msg">
      <p className="icon">🔗</p>
      <p className="title">ไม่พบข้อมูลหอพัก</p>
      <p className="sub">กรุณาเปิดผ่านลิงก์ที่เจ้าของหอพักส่งให้</p>
    </div>
  );

  return (
    <BrowserRouter basename="/tenant-app">
      <Routes>
        <Route index              element={<Home />} />
        <Route path="/invoices"   element={<InvoiceList />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="*"           element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
