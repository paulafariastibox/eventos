(() => {
  const STORAGE_KEY = 'tibox_eventos_records_v1';

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const persist = records => localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(raw, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);

    const method = String(init.method || 'GET').toUpperCase();
    let records = load();

    if (url.pathname === '/api/state' && method === 'GET') return jsonResponse(records);

    if (url.pathname === '/api/records' && method === 'POST') {
      try {
        const parsed = typeof init.body === 'string' ? JSON.parse(init.body || '{}') : (init.body || {});
        const items = Array.isArray(parsed) ? parsed : [parsed];
        const result = [];

        for (const source of items) {
          const item = {...source};
          if (!['event','attendee','agenda','gift'].includes(item.kind)) throw new Error('Registro inválido');
          const id = item.id || uid();
          const existingIndex = records.findIndex(r => r.id === id);
          const existing = existingIndex >= 0 ? records[existingIndex] : null;
          const row = existing ? {...existing, ...item, id} : {...item, id};

          if (row.kind !== 'event' && !records.some(r => r.kind === 'event' && r.id === row.event_id)) throw new Error('Evento no encontrado');
          if (!String(row.name || '').trim()) throw new Error('El nombre es obligatorio');
          if (row.kind === 'attendee' && !['pending','confirmed','coming','arrived','absent'].includes(row.status || 'pending')) throw new Error('Estado inválido');

          if (row.kind === 'gift') {
            row.quantity = Number(row.quantity || 0);
            if (row.quantity < 0) throw new Error('Stock inválido');
          }

          if (item.gift_toggle && row.kind === 'attendee') {
            const gid = item.gift_toggle;
            const gift = records.find(r => r.kind === 'gift' && r.id === gid && r.event_id === row.event_id);
            if (!gift) throw new Error('Regalo no encontrado');
            let gifts = Array.isArray(row.gifts) ? [...row.gifts] : [];
            if (gifts.includes(gid)) gifts = gifts.filter(x => x !== gid);
            else {
              const used = records.filter(r => r.kind === 'attendee' && r.event_id === row.event_id && Array.isArray(r.gifts) && r.gifts.includes(gid)).length;
              if (used >= Number(gift.quantity || 0)) throw new Error('No hay stock disponible de este regalo');
              gifts.push(gid);
            }
            row.gifts = gifts;
            delete row.gift_toggle;
          }

          if (existingIndex >= 0) records[existingIndex] = row;
          else records.push(row);
          result.push(row);
        }

        persist(records);
        return jsonResponse(result);
      } catch (e) {
        return jsonResponse({error:e.message || 'No se pudo guardar'}, 400);
      }
    }

    if (url.pathname.startsWith('/api/records/') && method === 'DELETE') {
      const id = decodeURIComponent(url.pathname.slice('/api/records/'.length));
      records = records.filter(r => r.id !== id && r.event_id !== id);
      persist(records);
      return jsonResponse({ok:true});
    }

    return jsonResponse({error:'Ruta no encontrada'}, 404);
  };
})();