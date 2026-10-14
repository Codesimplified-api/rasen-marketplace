import { getStore } from '@netlify/blobs';
const store = getStore('rasen-marketplace-content');
export default async (req) => {
  const secret = process.env.ADMIN_KEY;
  if (!secret || req.headers.get('x-admin-key') !== secret) return new Response(JSON.stringify({error:'Accès refusé'}), {status:401,headers:{'Content-Type':'application/json'}});
  if (req.method !== 'GET') return new Response('Method not allowed',{status:405});
  const kind = new URL(req.url).searchParams.get('kind');
  if (!['listings','news'].includes(kind)) return new Response(JSON.stringify({error:'Type invalide'}),{status:400,headers:{'Content-Type':'application/json'}});
  const records = await store.get('records',{type:'json'}) || [];
  const mapped = kind === 'listings' ? 'listing' : 'news';
  return new Response(JSON.stringify({items:records.filter(x=>x.kind===mapped&&x.status==='pending')}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
};
