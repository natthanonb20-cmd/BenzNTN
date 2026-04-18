import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/liff';
import { api, getPropertyId } from '../lib/api';
import { Spinner } from '../components';

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
      .then(() => {
        setStatus('success');
        setTimeout(() => { window.location.replace('/tenant-app/'); }, 800);
      })
      .catch(e => { setStatus('error'); setMsg(e.message); });
  }, []);

  if (status === 'loading') return (
    <div className="center-msg">
      <Spinner size={48} />
      <p className="sub" style={{ marginTop: 16 }}>กำลังเชื่อมต่อ LINE...</p>
    </div>
  );

  if (status === 'success') return (
    <div className="center-msg">
      <Spinner size={48} />
      <p className="sub" style={{ marginTop: 16 }}>กำลังเข้าสู่ระบบ...</p>
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
