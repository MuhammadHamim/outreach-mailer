async function req(method, url, body, headers = {}) {
  const isRaw = body instanceof Blob || body instanceof ArrayBuffer;
  const r = await fetch(url, {
    method, credentials: 'same-origin',
    headers: body && !isRaw ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body === undefined ? undefined : isRaw ? body : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) window.dispatchEvent(new Event('unauth'));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
export const api = {
  get: (u) => req('GET', u),
  post: (u, b = {}) => req('POST', u, b),
  put: (u, b, h) => req('PUT', u, b, h),
  patch: (u, b) => req('PATCH', u, b),
  del: (u) => req('DELETE', u),
};
