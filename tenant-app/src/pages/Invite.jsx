import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/liff';
import { api, getPropertyId } from '../lib/api';

export default function Invite() {
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    const pid         = params.get('pid') || getPropertyId();

    if (!inviteToken || !pid) {
      setStatus('error');
      setMsg('Invite link ไม่ถูกต้อง');
      return;
    }

    // บันทึก propertyId
    localStorage.setItem('rm_pid', pid);

    const lineToken = getAccessToken();
    if (!lineToken) {
      setStatus('error');
      setMsg('ไม่สามารถดึง LINE token ได้ กรุณาเปิดใหม่');
      return;
    }

    api.acceptInvite({ inviteToken, lineAccessToken: lineToken, propertyId: pid })
      .then(() => setStatus('success'))
      .catch(e => { setStatus('error'); setMsg(e.message); });
  }, []);

  if (status === 'loading') return (
    <div className="center-msg">
      <p className="icon">⏳</p>
      <p className="sub">กำลังลงทะเบียน...</p>
    </div>
  );

  if (status === 'success') return (
    <div className="center-msg">
      <p className="icon">🎉</p>
      <p className="title">ลงทะเบียนสำเร็จ!</p>
      <p className="sub" style={{ marginTop: 4 }}>คุณสามารถใช้งานระบบได้แล้ว</p>
      <a href="/tenant-app/" className="btn btn-primary" style={{ marginTop: 24, width: 'auto', padding: '12px 32px', textDecoration: 'none' }}>
        ไปหน้าหลัก
      </a>
    </div>
  );

  return (
    <div className="center-msg">
      <p className="icon">❌</p>
      <p className="title">ลงทะเบียนไม่สำเร็จ</p>
      <p className="sub" style={{ marginTop: 4 }}>{msg}</p>
    </div>
  );
}
