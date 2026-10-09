import json, os, sqlite3, uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
ROOT = Path(__file__).parent
DB = os.environ.get('EVENTOS_DB', str(ROOT / 'data' / 'eventos.db'))
Path(DB).parent.mkdir(parents=True, exist_ok=True)
def connection():
    db = sqlite3.connect(DB, timeout=20)
    db.row_factory = sqlite3.Row
    return db
with connection() as db:
    db.execute('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, event_id TEXT NOT NULL, data TEXT NOT NULL)')
    db.execute('CREATE INDEX IF NOT EXISTS records_event_kind ON records(event_id,kind)')
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT / 'public'), **kwargs)
    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_GET(self):
        if self.path == '/api/state':
            with connection() as db: rows = db.execute('SELECT * FROM records').fetchall()
            return self.send_json([dict(json.loads(r['data']), id=r['id'], kind=r['kind'], event_id=r['event_id']) for r in rows])
        if self.path.startswith('/api/'): return self.send_json({'error':'Ruta no encontrada'},404)
        super().do_GET()
    def do_POST(self):
        if self.path != '/api/records': return self.send_json({'error':'Ruta no encontrada'},404)
        try:
            size = int(self.headers.get('Content-Length',0))
            if size > 2000000: return self.send_json({'error':'Archivo demasiado grande'},413)
            payload = json.loads(self.rfile.read(size))
            items = payload if isinstance(payload,list) else [payload]
            if len(items)>3000: raise ValueError('Máximo 3000 registros por carga')
            result=[]
            with connection() as db:
                db.execute("BEGIN IMMEDIATE")
                for item in items:
                    kind=item.get('kind'); event=item.get('event_id','')
                    if kind not in ('event','attendee','agenda','gift'): raise ValueError('Registro inválido')
                    rid=item.get('id') or str(uuid.uuid4())
                    old=db.execute('SELECT * FROM records WHERE id=?',(rid,)).fetchone()
                    if old and (old['kind'] != kind or old['event_id'] != event): raise ValueError('Registro incompatible')
                    if kind!='event' and not db.execute("SELECT id FROM records WHERE id=? AND kind='event'",(event,)).fetchone(): raise ValueError('Evento no encontrado')
                    data=json.loads(old['data']) if old else {}
                    data.update({k:v for k,v in item.items() if k not in ('id','kind','event_id','gift_toggle','gifts')})
                    if 'gift_toggle' in item:
                        gid=item['gift_toggle']
                        gift=db.execute("SELECT data FROM records WHERE id=? AND kind='gift' AND event_id=?",(gid,event)).fetchone()
                        if kind!='attendee' or not gift: raise ValueError('Regalo no encontrado')
                        gifts=data.get('gifts',[])
                        if gid in gifts: gifts=[g for g in gifts if g!=gid]
                        else:
                            all_attendees=db.execute("SELECT data FROM records WHERE kind='attendee' AND event_id=?",(event,)).fetchall()
                            used=sum(gid in json.loads(a['data']).get('gifts',[]) for a in all_attendees)
                            if used>=int(json.loads(gift['data']).get('quantity',0)): raise ValueError('No hay stock disponible de este regalo')
                            gifts=[*gifts,gid]
                        data['gifts']=gifts
                    if kind=='gift':
                        quantity=int(data.get('quantity',0))
                        if quantity<0: raise ValueError('Stock inválido')
                        all_attendees=db.execute("SELECT data FROM records WHERE kind='attendee' AND event_id=?",(event,)).fetchall()
                        used=sum(rid in json.loads(a['data']).get('gifts',[]) for a in all_attendees)
                        if quantity<used: raise ValueError('El stock no puede ser menor que las entregas realizadas')
                        data['quantity']=quantity
                    if not str(data.get('name','')).strip(): raise ValueError('El nombre es obligatorio')
                    if kind=='attendee' and data.get('status','pending') not in ('pending','confirmed','coming','arrived','absent'): raise ValueError('Estado inválido')
                    db.execute('INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',(rid,kind,event,json.dumps(data,ensure_ascii=False)))
                    result.append(dict(data,id=rid,kind=kind,event_id=event))
            self.send_json(result)
        except (ValueError,TypeError,KeyError) as e: self.send_json({'error':str(e)},400)
        except Exception: self.send_json({'error':'No se pudo guardar. Intenta nuevamente.'},500)
    def do_DELETE(self):
        rid=self.path.removeprefix('/api/records/')
        if self.path != '/api/records/'+rid: return self.send_json({'error':'Ruta no encontrada'},404)
        with connection() as db:
            db.execute('DELETE FROM records WHERE id=? OR event_id=?',(rid,rid))
        self.send_json({'ok':True})
if __name__=='__main__':
    port=int(os.environ.get('PORT','8080'))
    print(f'Tibox Eventos disponible en puerto {port}',flush=True)
    ThreadingHTTPServer(('0.0.0.0',port),Handler).serve_forever()
