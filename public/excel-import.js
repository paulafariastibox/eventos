(()=>{
  const STATUS_MAP={
    '':'pending','pendiente':'pending','pending':'pending',
    'confirmado':'confirmed','confirmada':'confirmed','confirmed':'confirmed',
    'viene llegando':'coming','llegando':'coming','coming':'coming',
    'llegó':'arrived','llego':'arrived','arrived':'arrived',
    'no vendrá':'absent','no vendra':'absent','ausente':'absent','absent':'absent'
  };
  const norm=s=>String(s??'').trim();
  const key=s=>norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const aliases={
    name:['nombre','nombrecompleto','asistente','nombresyapellidos','nombreyapellido'],
    company:['empresa','compania','compañia','organizacion','razonsocial'],
    role:['cargo','puesto','rol'],
    email:['correo','email','mail','correoelectronico'],
    credential:['credencial','ncredencial','numerocredencial','ubicacion','ubicacioncredencial'],
    status:['estado','asistencia','status']
  };
  const findField=(row,field)=>{
    const entries=Object.entries(row);
    const found=entries.find(([h])=>aliases[field].includes(key(h)));
    return found?found[1]:'';
  };
  function currentEventId(){
    const sel=document.querySelector('#eventSelect');
    return sel?.value||'';
  }
  async function saveRows(rows){
    const eventId=currentEventId();
    if(!eventId) throw new Error('Primero crea o selecciona un evento.');
    const items=rows.map(r=>{
      const name=norm(findField(r,'name'));
      if(!name) return null;
      const rawStatus=norm(findField(r,'status')).toLowerCase();
      const normalizedStatus=rawStatus.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return {
        kind:'attendee',event_id:eventId,name,
        company:norm(findField(r,'company')),
        role:norm(findField(r,'role')),
        email:norm(findField(r,'email')),
        credential:norm(findField(r,'credential')),
        status:STATUS_MAP[rawStatus]||STATUS_MAP[normalizedStatus]||'pending'
      };
    }).filter(Boolean);
    if(!items.length) throw new Error('No encontré asistentes. Revisa que exista una columna Nombre.');
    if(items.length>3000) throw new Error('La carga admite hasta 3000 asistentes por archivo.');
    const res=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'No se pudo importar el archivo.');
    if(typeof refresh==='function') await refresh();
    if(typeof toast==='function') toast(`${items.length} asistentes importados`);
  }
  function importFile(){
    const input=document.createElement('input');
    input.type='file';input.accept='.xlsx,.xls,.csv';
    input.onchange=async()=>{
      const file=input.files?.[0]; if(!file)return;
      try{
        let rows=[];
        if(/\.csv$/i.test(file.name)){
          const text=await file.text();
          const wb=XLSX.read(text,{type:'string'});
          rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
        }else{
          const buffer=await file.arrayBuffer();
          const wb=XLSX.read(buffer,{type:'array'});
          rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
        }
        await saveRows(rows);
      }catch(err){
        if(typeof toast==='function') toast(err.message||'No se pudo leer el Excel.');
        else alert(err.message||'No se pudo leer el Excel.');
      }
    };
    input.click();
  }
  function downloadTemplate(){
    const data=[{Nombre:'Ejemplo Persona',Empresa:'Empresa SpA',Cargo:'Gerente TI',Correo:'persona@empresa.cl',Credencial:'A-01',Estado:'Confirmado'}];
    const ws=XLSX.utils.json_to_sheet(data);
    ws['!cols']=[{wch:28},{wch:24},{wch:20},{wch:30},{wch:16},{wch:18}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Asistentes');
    XLSX.writeFile(wb,'plantilla_asistentes_tibox.xlsx');
  }
  function relabel(){
    document.querySelectorAll('[data-action="import"]').forEach(b=>b.textContent='Importar Excel');
    document.querySelectorAll('[data-action="template"]').forEach(b=>b.textContent='Plantilla Excel');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]'); if(!b)return;
    if(b.dataset.action==='import'){
      e.preventDefault();e.stopImmediatePropagation();importFile();
    }else if(b.dataset.action==='template'){
      e.preventDefault();e.stopImmediatePropagation();downloadTemplate();
    }
  },true);
  const observer=new MutationObserver(relabel);
  document.addEventListener('DOMContentLoaded',()=>{relabel();observer.observe(document.body,{childList:true,subtree:true});});
})();