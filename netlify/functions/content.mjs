import { getStore } from '@netlify/blobs';

const store = getStore('rasen-marketplace-content');
const allowedKinds = new Set(['listing', 'news']);
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
});
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Key' } });
  try {
    const records = await store.get('records', { type: 'json' }) || [];
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const kind = url.searchParams.get('kind');
      if (!allowedKinds.has(kind)) return json({ error: 'Type invalide' }, 400);
      return json({ items: records.filter(x => x.kind === kind && x.status === 'published').sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 100) });
    }
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
    const body = await req.json();
    // Admin actions are protected by a secret environment variable.
    if (body.action === 'moderate') {
      const secret = process.env.ADMIN_KEY;
      if (!secret || req.headers.get('x-admin-key') !== secret) return json({ error: 'Accès refusé' }, 401);
      const id = clean(body.id, 80), status = body.status;
      if (!['published', 'rejected', 'pending'].includes(status)) return json({ error: 'Statut invalide' }, 400);
      const item = records.find(x => x.id === id);
      if (!item) return json({ error: 'Contenu introuvable' }, 404);
      item.status = status; item.updated_at = new Date().toISOString();
      await store.setJSON('records', records);
      return json({ ok: true });
    }
    const kind = body.kind;
    if (!allowedKinds.has(kind)) return json({ error: 'Type invalide' }, 400);
    let item;
    if (kind === 'listing') {
      const type = body.type === 'need' ? 'need' : body.type === 'offer' ? 'offer' : '';
      const cat = clean(body.cat, 40), title = clean(body.title, 75), desc = clean(body.desc, 500), location = clean(body.location, 60), name = clean(body.name, 60), contact = clean(body.contact, 40);
      if (!type || !cat || title.length < 3 || desc.length < 5 || !location || !name || contact.replace(/\D/g, '').length < 8) return json({ error: 'Certains champs sont invalides' }, 400);
      item = { kind, type, cat, icon: clean(body.icon, 8), title, desc, price: clean(body.price, 50) || 'À discuter', location, name, contact };
    } else {
      const title = clean(body.title, 120), category = clean(body.category, 40), author_name = clean(body.author_name, 60), content = clean(body.body, 8000), image_url = clean(body.image_url, 500);
      if (title.length < 3 || !category || !author_name || content.length < 20) return json({ error: 'Certains champs sont invalides' }, 400);
      if (image_url && !/^https:\/\//i.test(image_url)) return json({ error: 'Le lien d’image doit commencer par https://' }, 400);
      item = { kind, title, category, author_name, body: content, image_url: image_url || null };
    }
    item.id = crypto.randomUUID(); item.status = 'pending'; item.created_at = new Date().toISOString();
    records.unshift(item);
    await store.setJSON('records', records.slice(0, 1000));
    return json({ ok: true, id: item.id, status: item.status }, 201);
  } catch (e) {
    console.error(e);
    return json({ error: 'Erreur serveur. Vérifie que Netlify Blobs est activé.' }, 500);
  }
};
