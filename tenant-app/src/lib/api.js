import { getAccessToken } from './liff';

// propertyId เก็บใน localStorage หลังจาก load ครั้งแรก
export function getPropertyId() {
  // URL param มีความสำคัญสูงสุด (invite link หรือ rich menu)
  const urlPid = new URLSearchParams(window.location.search).get('pid');
  if (urlPid) {
    localStorage.setItem('rm_pid', urlPid);
    return urlPid;
  }
  return localStorage.getItem('rm_pid') || '';
}

function headers() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    'x-property-id': getPropertyId(),
    'Content-Type': 'application/json',
  };
}

async function request(method, path, body) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export const api = {
  getMe:          ()       => request('GET',  '/api/liff/me'),
  listInvoices:   ()       => request('GET',  '/api/liff/invoices'),
  getInvoice:     (id)     => request('GET',  `/api/liff/invoices/${id}`),
  acceptInvite:   (body)   => request('POST', '/api/liff/invite/accept', body),
  listRepairs:    ()       => request('GET',  '/api/liff/repairs'),

  createRepair(formData) {
    return fetch('/api/liff/repairs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'x-property-id': getPropertyId(),
      },
      body: formData,
    }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'แจ้งซ่อมไม่สำเร็จ');
      return d;
    });
  },

  uploadSlip(invoiceId, file) {
    const fd = new FormData();
    fd.append('slip', file);
    return fetch(`/api/liff/invoices/${invoiceId}/slip`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'x-property-id': getPropertyId(),
      },
      body: fd,
    }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'อัปโหลดไม่สำเร็จ');
      return d;
    });
  },
};
