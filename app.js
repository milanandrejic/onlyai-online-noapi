/* OnlyAI Online 1.1 — Daten und Versionen ausschließlich im Browser; KI wahlweise lokal im Browser (WebLLM, ohne API-Schlüssel) oder über eigenen Worker. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const DB_NAME = 'onlyai_online_1_1';
  let db, item = null, allItems = [], dirty = false, busy = false, preview = null, toastTimer;
  let workerUrl = localStorage.getItem('onlyai_worker_url') || '';
  let accessCode = sessionStorage.getItem('onlyai_access_code') || '';
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random().toString(36).slice(2)));
  const fmt = iso => iso ? new Date(iso).toLocaleString('de-DE', {dateStyle:'medium',timeStyle:'short'}) : '-';
  const slug = s => String(s||'OnlyAI').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß_-]+/gi,'_').slice(0,55);
  function toast(message, error=false) { const b=$('toast'); b.textContent=message; b.className='toast visible'+(error?' error':''); clearTimeout(toastTimer); toastTimer=setTimeout(()=>b.className='toast',5300); }
  function reqToPromise(req) {return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function openDB() {return new Promise((resolve,reject)=>{let r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const store=r.result.createObjectStore('items',{keyPath:'id'});store.createIndex('updated_at','updated_at');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function getAll() {let tx=db.transaction('items','readonly');return await reqToPromise(tx.objectStore('items').getAll());}
  async function getOne(id) {let tx=db.transaction('items','readonly');return await reqToPromise(tx.objectStore('items').get(id));}
  async function putOne(x) {x.updated_at=now();return await new Promise((resolve,reject)=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').put(x);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function makeItem(x={}) {return {id:uuid(),title:'Neue Idee',kind:'Gedanke',raw_text:'',source_filename:'',levels:{1:'',2:'',3:'',4:'',5:''},history:{1:[],2:[],3:[],4:[],5:[]},links:{2:[],3:[]},status:'bestandsaufnahme',created_at:now(),updated_at:now(),...x};}
  function hasText(x,n) {return Boolean((x.levels?.[n]||'').trim());}
  function latestLevel(x) {let n=0;for(let i=1;i<=5;i++)if(hasText(x,i))n=i;return n;}
  function setDirty(v=true) {dirty=v; $('workspace').classList.toggle('unsaved',v); updateStatus();}
  function updateStatus() {
    if(!item)return;
    $('item-status').textContent=dirty?'Ungespeichert':(item.status==='erkenntnisstand'?'Erkenntnisbestand':'Bestandsaufnahme');
    $('btn-promote').textContent=item.status==='erkenntnisstand'?'Zur Bestandsaufnahme zurück':'Nach Prüfung freigeben';
    $('btn-promote').disabled=item.status!=='erkenntnisstand' && !$('output5').value.trim();
    $('promotion-description').textContent=item.status==='erkenntnisstand'?'Dieser Eintrag wurde von dir ausdrücklich freigegeben. Eine Rücknahme ist möglich.':'Noch nicht freigegeben. Erst nach deiner Prüfung von Ebene 5 wird dieser Eintrag in 03_Erkenntnisbestand aufgenommen.';
    for(let n=1;n<=5;n++){let v=$('output'+n).value.trim(), e=$('indicator'+n);e.textContent=v?'Bearbeitet':'Offen';e.classList.toggle('done',Boolean(v));}
  }
  function pullFromForm(){if(!item)return;item.title=$('title').value.trim()||'Unbenannte Quelle';item.kind=$('kind').value||'Gedanke';item.raw_text=$('raw-text').value;for(let i=1;i<=5;i++)item.levels[i]=$('output'+i).value;}
  async function persistDraft(){if(!item)return;pullFromForm();await putOne(item);setDirty(false);await refreshItems();}
  async function refreshItems(){allItems=(await getAll()).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));let q=$('search').value.trim().toLocaleLowerCase();const res=allItems.filter(x=>!q||[x.title,x.kind,x.raw_text].join(' ').toLocaleLowerCase().includes(q));for(let [status,list,count] of [['bestandsaufnahme','list-bestand','count-bestand'],['erkenntnisstand','list-erkenntnis','count-erkenntnis']]){let xs=res.filter(x=>x.status===status);$(count).textContent=allItems.filter(x=>x.status===status).length;$(list).innerHTML=xs.length?xs.map(x=>`<button class="item-entry ${item?.id===x.id?'active':''}" data-item-id="${escapeHTML(x.id)}"><span class="entry-title">${escapeHTML(x.title)}</span><span class="entry-sub">${escapeHTML(x.kind)} · Ebene ${latestLevel(x)} · ${fmt(x.updated_at)}</span></button>`).join(''):'<div class="list-empty">Noch keine Einträge</div>';}document.querySelectorAll('[data-item-id]').forEach(b=>b.addEventListener('click',()=>loadItem(b.dataset.itemId)));}
  async function loadItem(id){if(dirty && !confirm('Es gibt ungespeicherte Änderungen. Ohne Speichern wechseln?'))return;let x=await getOne(id);if(!x){toast('Eintrag nicht gefunden',true);return;}item=x;item.levels||={};item.history||={};item.links||={};for(let n=1;n<=5;n++){item.levels[n]??='';item.history[n]??=[];}item.links[2]??=[];item.links[3]??=[];
    $('welcome').hidden=true;$('workspace').hidden=false;$('title').value=item.title||'';$('kind').value=item.kind||'Gedanke';if(!$('kind').value)$('kind').value='Sonstiges';$('raw-text').value=item.raw_text||'';$('source-filename').textContent=item.source_filename||'';
    for(let n=1;n<=5;n++){$('output'+n).value=item.levels[n];refreshVersionPanel(n);}
    $('item-id').textContent='#'+item.id.slice(0,8);setDirty(false);await refreshItems();await loadCandidates(2);await loadCandidates(3);window.scrollTo({top:0,behavior:'smooth'});
  }
  async function createItem(){if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;let x=makeItem();await putOne(x);dirty=false;await loadItem(x.id);$('title').focus();$('title').select();}
  function getCurrentLinks(n){const selector='#candidates'+n+' input[type=checkbox]:checked';return Array.from(document.querySelectorAll(selector)).map(c=>c.value);}
  async function loadCandidates(n){if(!item)return;let current=new Set(item.links?.[n]||[]);let base=allItems.filter(x=>x.id!==item.id&&x.status==='bestandsaufnahme');
    const tokens=s=>new Set(String(s||'').toLocaleLowerCase().match(/[a-zäöüß]{4,}/g)||[]);
    let ours=tokens((item.title||'')+' '+item.raw_text.slice(0,1000));let scoring=x=>{let xs=tokens(x.title+' '+x.raw_text.slice(0,750));let overlap=[...xs].filter(t=>ours.has(t)).length;return overlap/Math.max(1,Math.min(ours.size,xs.size));};
    base.sort((a,b)=> n===2?scoring(b)-scoring(a):scoring(a)-scoring(b));
    // Bereits gewählte Quellen bleiben sichtbar, auch falls sie nicht zu den ersten Vorschlägen gehören.
    let chosen=base.filter(x=>current.has(x.id));let proposed=base.filter(x=>!current.has(x.id)).slice(0,20);let xs=[...chosen,...proposed];
    $('candidates'+n).innerHTML=xs.length?xs.map(x=>`<label class="candidate"><input type="checkbox" value="${escapeHTML(x.id)}" ${current.has(x.id)?'checked':''}><div><b>${escapeHTML(x.title)}</b><small>${escapeHTML(x.kind)} · ${(x.raw_text||'').length} Zeichen</small></div></label>`).join(''):'<p class="muted">Noch keine weitere Quelle vorhanden. Erfasse zunächst eine zweite Idee.</p>';
    $('candidates'+n).querySelectorAll('input').forEach(c=>c.addEventListener('change',()=>{item.links[n]=getCurrentLinks(n);setDirty(true);}));
  }
  function refreshVersionPanel(n){const history=item.history?.[n]||[];let el=$('versions'+n);el.innerHTML='<option value="">Version wählen …</option>'+history.map(v=>`<option value="${v.version}">V${v.version} · ${fmt(v.at)} · ${escapeHTML(v.source||'Gespeichert')}</option>`).reverse().join('');$('version-label'+n).textContent=history.length?`${history.length} gespeicherte Version(en) · neueste V${history[history.length-1].version}`:'Noch keine Version gespeichert.';}
  async function saveVersion(n,source='Manuell gespeichert') {if(!item)return;pullFromForm();if(!item.levels[n].trim()){toast('Ebene '+n+': Das Ergebnisfeld ist leer.',true);return;}let h=item.history[n];const v={version:(h.at(-1)?.version||0)+1,at:now(),source,text:item.levels[n],links:[...(item.links[n]||[])]};h.push(v);await putOne(item);setDirty(false);refreshVersionPanel(n);await refreshItems();toast('Ebene '+n+' als V'+v.version+' gespeichert');return v;}
  function openVersion(n){let ver=Number($('versions'+n).value);let v=item?.history[n]?.find(x=>x.version===ver);if(!v){toast('Bitte zuerst eine Version auswählen.',true);return;}preview={n,version:v};$('version-heading').textContent=`Ebene ${n} · Version ${ver}`;$('version-details').textContent=`${fmt(v.at)} · ${v.source}. Wiederherstellen überschreibt keine frühere Version.`;$('version-text').value=v.text;$('version-overlay').hidden=false;}
  async function restoreVersion(){if(!preview)return;let {n,version:v}=preview;$('output'+n).value=v.text;item.links[n]=[...(v.links||[])];await saveVersion(n,`Wiederhergestellt aus V${v.version}`);$('version-overlay').hidden=true;preview=null;await loadCandidates(2);await loadCandidates(3);}
  function offlineWorksheet(n){let snip=item.raw_text.trim().slice(0,1200), base=`OFFLINE-ARBEITSBLATT · Ebene ${n}\nKeine KI-Auswertung. Diese Vorlage muss eigenständig bearbeitet werden.\n\nTitel: ${item.title}\nQuelle: ${item.kind}\n`;
    let linked=[...(item.links?.[n]||[])].map(id=>allItems.find(x=>x.id===id)?.title).filter(Boolean).join('; ');
    switch(n){
      case 1:return base+`\nAUSGANGSMATERIAL (Auszug, nicht automatisch analysiert)\n${snip||'[Originaltext noch leer]'}\n\nKernaussage:\n- \n\nBesondere Beobachtungen:\n- \n\nOffene Fragen:\n- `;
      case 2:return base+`\nGewählte Vergleichsquellen: ${linked||'(noch keine)'}\n\nNeue Hypothese (darf nicht nur das Original paraphrasieren):\n- \n\nWarum ergibt sie sich aus der Kombination?\n- \n\nWas steht in KEINER Quelle ausdrücklich?\n- \n\nDenkbares Gegenbeispiel:\n- `;
      case 3:return base+`\nFachfremde Vergleichsquellen: ${linked||'(noch keine)'}\n\nWelche Struktur lässt sich übertragen?\n- \n\nWas wird dadurch plötzlich denkbar?\n- \n\nWo bricht die Analogie?\n- `;
      case 4:return base+`\nZu prüfende Hypothese (aus Ebene 2/3):\n- \n\nMechanismus / Wirkungsfolge:\n- \n\nNotwendige Bedingungen:\n- \n\nGegenmechanismen / Alternativerklärungen:\n- \n\nKonkreter Prüfschritt und Widerlegungskriterium:\n- `;
      case 5:return base+`\nMögliche Entwicklung 1 / 2 / 3:\n- \n\nHANDLUNGSOPTION A\nWer handelt / Zielgruppe:\nKonkrete Handlung und erste drei Schritte:\nNutzen / Aufwand / Risiken:\nPrüfbarer Pilot / Abbruchkriterium:\n\nHANDLUNGSOPTION B\nWer handelt / Zielgruppe:\nKonkrete Handlung und erste drei Schritte:\nNutzen / Aufwand / Risiken:\nPrüfbarer Pilot / Abbruchkriterium:\n\nHANDLUNGSOPTION C\nWer handelt / Zielgruppe:\nKonkrete Handlung und erste drei Schritte:\nNutzen / Aufwand / Risiken:\nPrüfbarer Pilot / Abbruchkriterium:`;
    }
  }
  async function offlineRun(n){if(!item)return;let old=$('output'+n).value.trim();if(old&&!confirm('Neue Offline-Vorlage erzeugen? Das bisherige Ergebnis bleibt in den gespeicherten Versionen erhalten, falls es bereits gespeichert wurde.'))return;
    pullFromForm();item.levels[n]=offlineWorksheet(n);$('output'+n).value=item.levels[n];await saveVersion(n,'Offline-Arbeitsblatt');}
  function validateWorkerUrl(s){let url=new URL(s);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('HTTPS-Worker-Adresse ohne Passwort oder Parameter eingeben.');if(!/\.workers\.dev$/.test(url.hostname)&&!confirm('Diese Adresse endet nicht auf workers.dev. Nur einem eigenen vertrauenswürdigen HTTPS-Backend Zugang geben. Fortfahren?'))throw Error('Verbindung nicht übernommen.');return url.origin+url.pathname.replace(/\/$/,'');}
  async function connectionTest(){const url=$('worker-url').value.trim(),code=$('access-code').value.trim()||accessCode;let norm=validateWorkerUrl(url);if(!code)throw Error('Bitte den privaten Zugangscode eingeben.');const response=await fetch(norm+'/health',{method:'GET',headers:{'X-OnlyAI-Access-Code':code},cache:'no-store'});let j=await response.json().catch(()=>({}));if(!response.ok)throw Error(j.error||'Verbindungstest fehlgeschlagen: HTTP '+response.status);return norm;}
  async function runKI(n){if(busy)return;if(!item)return;try{
      if(engineMode==='local'||!workerUrl||!accessCode){await runLocal(n);return;}
      pullFromForm();if(!item.raw_text.trim())throw Error('Für eine KI-Untersuchung muss zuerst Originalmaterial vorliegen.');
      item.links[2]=getCurrentLinks(2);item.links[3]=getCurrentLinks(3);await putOne(item);
      const refs=(item.links[n]||[]).map(id=>allItems.find(x=>x.id===id)).filter(Boolean).map(x=>({title:x.title,kind:x.kind,text:x.raw_text.slice(0,3600),level1:(x.levels?.[1]||'').slice(0,1600)}));
      busy=true;document.body.classList.add('busy');toast('KI-Untersuchung für Ebene '+n+' gestartet …');
      const body={level:n,title:item.title,kind:item.kind,raw_text:item.raw_text.slice(0,19000),previous:Object.fromEntries([1,2,3,4].filter(x=>x<n).map(x=>[x,(item.levels?.[x]||'').slice(0,11000)])),references:refs};
      const resp=await fetch(workerUrl+'/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-OnlyAI-Access-Code':accessCode},body:JSON.stringify(body),cache:'no-store'});
      const j=await resp.json().catch(()=>({error:'Ungültige Serverantwort'}));if(!resp.ok)throw Error(j.error||'KI-Anfrage fehlgeschlagen ('+resp.status+')');if(!j.text?.trim())throw Error('Die KI hat keinen verwendbaren Text geliefert.');
      $('output'+n).value=j.text;await saveVersion(n,'KI-Untersuchung · '+(j.model||'OpenAI'));toast('KI-Ergebnis für Ebene '+n+' gespeichert.');
    }catch(e){toast(e.message||String(e),true);}finally{busy=false;document.body.classList.remove('busy');}}
  // ===== Lokale KI im Browser (WebLLM / WebGPU) – kein API-Schlüssel, keine Server =====
  const WEBLLM_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.87/+esm';
  const LOCAL_MODELS={'Qwen2.5-1.5B-Instruct-q4f16_1-MLC':'Schnell · ca. 1 GB Download · einfachere Qualität','Qwen2.5-3B-Instruct-q4f16_1-MLC':'Empfohlen · ca. 2 GB Download · gute Balance','Qwen2.5-7B-Instruct-q4f16_1-MLC':'Beste Qualität · ca. 5 GB Download · braucht starke Grafikkarte'};
  let engineMode=localStorage.getItem('onlyai_engine')||'local';
  let localModel=localStorage.getItem('onlyai_local_model')||'Qwen2.5-3B-Instruct-q4f16_1-MLC';
  if(!LOCAL_MODELS[localModel])localModel='Qwen2.5-3B-Instruct-q4f16_1-MLC';
  let llm=null,llmModelId='',llmLib=null,llmLoading=null;
  const clip=(s,n)=>{s=String(s||'').trim();return s.length>n?s.slice(0,n)+' […]':s;};
  function setLocalProgress(p){const pct=Math.round((p?.progress||0)*100);const bar=$('local-progress-bar'),txt=$('local-progress-text');if($('local-progress'))$('local-progress').hidden=false;if(bar)bar.style.width=pct+'%';if(txt)txt.textContent=(p?.text||'Lade Modell …');}
  async function loadLocal(){
    if(!('gpu' in navigator))throw Error('Dieser Browser unterstützt WebGPU nicht. Bitte am Computer ein aktuelles Chrome oder Edge verwenden.');
    if(llm&&llmModelId===localModel)return llm;
    if(llmLoading)return await llmLoading;
    llmLoading=(async()=>{
      llmLib||=await import(WEBLLM_URL);
      if(llm){try{await llm.unload();}catch{}llm=null;llmModelId='';}
      llm=await llmLib.CreateMLCEngine(localModel,{initProgressCallback:setLocalProgress});
      llmModelId=localModel;updateConnectionBadge();return llm;
    })();
    try{return await llmLoading;}finally{llmLoading=null;}
  }
  const SYSTEM_BASE='Du bist ein sorgfältiger Denkpartner für Ideenentwicklung. Antworte ausschließlich auf Deutsch, konkret und ohne Floskeln. Erfinde keine Fakten, Studien, Zahlen oder Zitate. Kennzeichne Vermutungen ausdrücklich als Hypothese. Schreibe Reintext ohne Markdown-Zeichen (keine Sternchen, keine #); gliedere mit kurzen Zwischenüberschriften in Großbuchstaben und Spiegelstrichen.';
  const LEVEL_TASKS={
    1:'AUFGABE EBENE 1 – BESTANDSAUFNAHME: Verstehe das Originalmaterial zunächst für sich, ohne Vernetzung. Liefere: KERNAUSSAGE (1–2 Sätze), STILLE ANNAHMEN (was wird vorausgesetzt, aber nicht gesagt), BESONDERE BEOBACHTUNGEN, WAS NICHT AUSDRÜCKLICH GESAGT WIRD, OFFENE FRAGEN.',
    2:'AUFGABE EBENE 2 – NEUE HYPOTHESEN: Nicht zusammenfassen. Entwickle drei überraschende, nachvollziehbare Mechanismus-Hypothesen, die in keiner Quelle ausdrücklich stehen (nutze die Vergleichsquellen, falls vorhanden; sonst kennzeichne es als Gedankenexperiment). Je Hypothese: HYPOTHESE, WARUM SIE SICH AUS DER KOMBINATION ERGIBT, DENKBARES GEGENBEISPIEL.',
    3:'AUFGABE EBENE 3 – FACHFREMDE VERBINDUNGEN: Verschränke die bisherigen Hypothesen mit drei ganz anderen Lebens- oder Wissensbereichen (z. B. Biologie, Logistik, Architektur, Handwerk, Spiel, Ökologie). Je Verbindung: BEREICH, ÜBERTRAGBARE STRUKTUR, WAS WIRD DADURCH DENKBAR, WO BRICHT DIE ANALOGIE. Analogie ist kein Beweis.',
    4:'AUFGABE EBENE 4 – MECHANISMEN UND PRÜFUNG: Wähle die zwei aussichtsreichsten Hypothesen und prüfe sie kritisch. Je Hypothese: WIRKUNGSFOLGE, NOTWENDIGE BEDINGUNGEN, GEGENMECHANISMEN UND ALTERNATIVERKLÄRUNGEN, KONKRETER PRÜFSCHRITT, WIDERLEGUNGSKRITERIUM. Behaupte keine empirische Bestätigung.',
    5:'AUFGABE EBENE 5 – ENTWICKLUNGEN UND HANDLUNGSOPTIONEN: Nenne zuerst kurz zwei bis drei mögliche Entwicklungen. Dann drei klar unterscheidbare HANDLUNGSOPTIONEN A, B, C. Je Option: WER HANDELT / ZIELGRUPPE, KONKRETE HANDLUNG UND ERSTE DREI SCHRITTE, NUTZEN / AUFWAND / RISIKEN, PILOT UND ABBRUCHKRITERIUM.'
  };
  function localMessages(n){
    const refs=(item.links?.[n]||[]).map(id=>allItems.find(x=>x.id===id)).filter(Boolean).slice(0,2);
    let u=`TITEL: ${item.title}\nART: ${item.kind}\n\nORIGINALMATERIAL:\n${clip(item.raw_text,3000)}`;
    for(let i=1;i<n;i++){const t=(item.levels?.[i]||'').trim();if(t)u+=`\n\nERGEBNIS EBENE ${i}:\n${clip(t,700)}`;}
    if(refs.length)u+='\n\nVERGLEICHSQUELLEN:\n'+refs.map(x=>`- ${x.title} (${x.kind}): ${clip(x.raw_text,500)}`).join('\n');
    return [{role:'system',content:SYSTEM_BASE+'\n\n'+LEVEL_TASKS[n]},{role:'user',content:u}];
  }
  async function runLocal(n){
    pullFromForm();if(!item.raw_text.trim())throw Error('Für eine KI-Untersuchung muss zuerst Originalmaterial vorliegen.');
    item.links[2]=getCurrentLinks(2);item.links[3]=getCurrentLinks(3);await putOne(item);
    busy=true;document.body.classList.add('busy');$('btn-stop').hidden=false;
    const ta=$('output'+n);const old=ta.value;
    try{
      if(item.raw_text.length>3000)toast('Hinweis: Lokal werden die ersten 3000 Zeichen des Originals ausgewertet.');
      if(!(llm&&llmModelId===localModel))toast('Lokale KI wird geladen – beim ersten Mal einige Minuten (Download), danach gespeichert …');
      const eng=await loadLocal();
      if(old.trim()&&old!==item.history[n].at(-1)?.text)await saveVersion(n,'Vor lokaler KI gesichert');
      ta.value='';let text='',finish='';
      toast('Lokale KI schreibt Ebene '+n+' …');
      const stream=await eng.chat.completions.create({messages:localMessages(n),stream:true,temperature:0.7,top_p:0.9,max_tokens:1000});
      for await(const ch of stream){const c=ch.choices?.[0];text+=c?.delta?.content||'';if(c?.finish_reason)finish=c.finish_reason;ta.value=text;ta.scrollTop=ta.scrollHeight;}
      if(!text.trim()){ta.value=old;throw Error('Die lokale KI hat keinen Text geliefert.');}
      if(finish==='length')text+='\n\n[Hinweis: Ausgabe wegen Längenbegrenzung gekürzt. Bei Bedarf „Neu untersuchen“ oder von Hand ergänzen.]';
      ta.value=text;await saveVersion(n,'Lokale KI · '+localModel.split('-Instruct')[0]);toast('Ergebnis für Ebene '+n+' gespeichert.');
    }finally{$('btn-stop').hidden=true;}
  }
  function updateConnectionBadge(){
    const k=$('key-status');let txt,on=false;
    if(engineMode==='local'){on=Boolean(llm&&llmModelId===localModel);txt=on?'Lokale KI bereit · kein Schlüssel':'Lokale KI · lädt beim ersten Start';}
    else{on=Boolean(workerUrl&&accessCode);txt=on?'KI-Dienst verbunden':'Worker-Modus · nicht verbunden';}
    k.textContent=txt;k.classList.toggle('online',on);
  }
  // Minimaler ZIP/OOXML-Leser für Word- und ODT-Dokumente, ohne externe JavaScript-Bibliothek.
  function u16(d,i){return d.getUint16(i,true)} function u32(d,i){return d.getUint32(i,true)}
  async function zipEntry(bytes,name){let d=new DataView(bytes),n=d.byteLength, eocd=-1;for(let i=n-22;i>=Math.max(0,n-66000);i--)if(u32(d,i)===0x06054b50){eocd=i;break;}if(eocd<0)throw Error('ZIP/DOCX: ungültiges Archiv.');let count=u16(d,eocd+10),p=u32(d,eocd+16);for(let k=0;k<count;k++){if(u32(d,p)!==0x02014b50)throw Error('ZIP-Inhaltsverzeichnis defekt.');let method=u16(d,p+10),csize=u32(d,p+20),fnl=u16(d,p+28),extra=u16(d,p+30),comm=u16(d,p+32),off=u32(d,p+42),fn=new TextDecoder().decode(new Uint8Array(bytes,p+46,fnl));if(fn===name){if(u32(d,off)!==0x04034b50)throw Error('ZIP-Datensatz fehlerhaft.');let start=off+30+u16(d,off+26)+u16(d,off+28),body=new Uint8Array(bytes,start,csize);if(method===0)return new TextDecoder().decode(body);if(method===8){if(!('DecompressionStream' in window))throw Error('Dieser Browser unterstützt den Word-Import nicht. Bitte Chrome/Edge aktualisieren.');const stream=new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return await new Response(stream).text();}throw Error('Nicht unterstützte ZIP-Kompression: '+method);}
      p+=46+fnl+extra+comm;}
    throw Error('Dokumentinhalt '+name+' nicht gefunden.');}
  function xmlText(xml,format){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('Dokument-XML konnte nicht gelesen werden.');const match=(el,n)=>el.localName===n;let paras=Array.from(doc.getElementsByTagName('*')).filter(e=>match(e,'p')||match(e,'h'));
    return paras.map(p=>{if(format==='docx')return Array.from(p.getElementsByTagName('*')).filter(x=>match(x,'t')||match(x,'tab')||match(x,'br')).map(x=>match(x,'t')?(x.textContent||''):(match(x,'tab')?'\t':'\n')).join('');return p.textContent||'';}).join('\n').replace(/\n{4,}/g,'\n\n\n').trim();}
  async function readInputFile(file){let name=file.name.toLowerCase();if(file.size>14_000_000)throw Error('Datei ist für den Browserimport zu groß (max. 14 MB).');
    if(name.endsWith('.docx'))return xmlText(await zipEntry(await file.arrayBuffer(),'word/document.xml'),'docx');
    if(name.endsWith('.odt'))return xmlText(await zipEntry(await file.arrayBuffer(),'content.xml'),'odt');
    if(name.endsWith('.pdf'))throw Error('PDF-Text bitte zunächst im PDF-Reader markieren und hier einfügen. PDF-Import folgt in einer späteren Version.');
    if(/\.(txt|md|html?|csv|json|xml|log)$/i.test(name))return await file.text();throw Error('Dieses Dateiformat wird online noch nicht unterstützt: '+file.name);
  }
  async function importFile(file,bulk=false){let content=await readInputFile(file);if(!content.trim())throw Error('Keine auslesbaren Textinhalte in '+file.name);if(bulk){const x=makeItem({title:file.name.replace(/\.[^.]+$/,''),kind:'Ebene-1-Dokument',raw_text:content.slice(0,110000),source_filename:file.name});await putOne(x);return x;}
    if(!item)await createItem();$('raw-text').value=content.slice(0,110000);$('source-filename').textContent=file.name;item.source_filename=file.name;setDirty(true);toast('Dokument eingelesen. Bitte Originaltext prüfen und Quelle speichern.');}
  // Minimale standardkonforme .docx-Exportdatei, ohne Drittbibliotheken.
  const utf8=x=>new TextEncoder().encode(x);
  let crcTable=null;function crc32(bytes){if(!crcTable){crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);return c>>>0;});}let c=0xffffffff;for(let v of bytes)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function zipStore(files){const arr=[],dir=[];let off=0;const le16=(v)=>[v&255,(v>>>8)&255],le32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];for(const [name,content] of Object.entries(files)){const nm=utf8(name),body=utf8(content),crc=crc32(body),header=Uint8Array.from([...le32(0x04034b50),...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(body.length),...le32(body.length),...le16(nm.length),...le16(0),...nm]);arr.push(header,body);dir.push(Uint8Array.from([...le32(0x02014b50),...le16(20),...le16(20),...le16(0),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(body.length),...le32(body.length),...le16(nm.length),...le16(0),...le16(0),...le16(0),...le16(0),...le32(0),...le32(off),...nm]));off+=header.length+body.length;}let ds=dir.reduce((s,d)=>s+d.length,0),end=Uint8Array.from([...le32(0x06054b50),...le16(0),...le16(0),...le16(dir.length),...le16(dir.length),...le32(ds),...le32(off),...le16(0)]);return new Blob([...arr,...dir,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});}
  function wordXML(s){const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));let paragraphs=s.split('\n').map(line=>`<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`).join('');return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`;}
  function makeDocx(title,text){const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':wordXML(title+'\n\n'+text)};return zipStore(files);}
  function download(blob,filename){const a=document.createElement('a');let url=URL.createObjectURL(blob);a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},3000);}
  function exportWord(n){if(!item)return;const s=$('output'+n).value.trim();if(!s){toast('Noch kein Text in dieser Ebene.',true);return;}let text=`OnlyAI Online · Ebene ${n}\nQuelle: ${item.title}\nArt: ${item.kind}\nDatum: ${fmt(now())}\n\n${s}`;download(makeDocx(item.title,text),`OnlyAI_Ebene_${n}_${slug(item.title)}.docx`);}
  async function backupAll(){let xs=await getAll();let data={format:'onlyai-online-backup',format_version:1,exported_at:now(),items:xs};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'OnlyAI_Datensicherung_'+new Date().toISOString().slice(0,10)+'.json');toast(xs.length+' Einträge gesichert. JSON-Datei bitte sicher aufbewahren.');}
  async function restoreBackup(file){if(file.size>50_000_000)throw Error('Datensicherung ist zu groß.');const data=JSON.parse(await file.text());if(data.format!=='onlyai-online-backup'||!Array.isArray(data.items))throw Error('Keine OnlyAI-Online-Datensicherung. Ältere Windows-SQLite-Dateien werden nicht direkt unterstützt.');if(!confirm(`${data.items.length} Einträge importieren? Bereits vorhandene Einträge mit derselben ID werden ersetzt; bitte vorher selbst eine Sicherung erstellen.`))return;for(const x of data.items){if(!x.id||typeof x.title!=='string'||typeof x.raw_text!=='string'||!x.levels||!x.history)continue;await putOne(x);}item=null;setDirty(false);$('workspace').hidden=true;$('welcome').hidden=false;await refreshItems();toast('Datensicherung eingelesen.');}
  async function createDemo(){const x=makeItem({title:'DEMO – Wenn automatische Nachbestellung Gewohnheiten konserviert',kind:'Gedanke',raw_text:'DEMO, kein Originalentwurf: Eine Einkaufsliste schlägt Nachkauf vor, sobald der Vorrat unter den Standardwert sinkt. Aber die Standardmenge stammt von früher. Der tatsächliche Bedarf hat sich verändert.'});
    x.levels={1:'DEMO · Ausgangsgedanke: Ein Bestandswert erzeugt eine Nachkaufempfehlung. Offene Annahme: Der alte Schwellenwert gilt weiterhin.',2:'DEMO · Neue Hypothese: Automatisierte Wiederholung kann veraltete Bedürfnisse in künftige Käufe übersetzen.',3:'DEMO · Fremde Verbindung: Auch Wartungsintervalle oder Software-Abonnements können überholte Vorgaben wiederholen. Die Analogie muss im Einzelfall geprüft werden.',4:'DEMO · Mechanismus: Alter Sollwert → automatisches Signal → Wiederholung; Gegenprobe: Anpassung des Sollwerts nach Bedarfsänderung.',5:'DEMO · Mögliche Entwicklung: Bedarfsgesteuerte statt normgesteuerte Wiederbeschaffung.\n\nOption A: Haushalts-App überprüft monatlich den tatsächlichen Bedarf.\nOption B: Dienstleister testet 30 automatische Bestellregeln von Unternehmen.\nOption C: Pilot mit einer Produktgruppe, Bestellung erst nach expliziter Nachfrage.\n\nJe Option: Zielgruppe, Aufwand, Einsparung, Risiken und erste Messgröße gesondert überprüfen.'};
    for(let i=1;i<=5;i++)x.history[i]=[{version:1,at:now(),source:'Vorbereitete Demo – keine KI',text:x.levels[i],links:[]}];await putOne(x);dirty=false;await loadItem(x.id);toast('Offline-Beispiel angelegt – keine KI-Auswertung.');}
  async function init(){try{db=await openDB();}catch(e){document.body.innerHTML='<main style="font-family:sans-serif;margin:8vw;max-width:800px"><h1>Browser-Speicherung nicht verfügbar</h1><p>Bitte diese Seite über GitHub Pages oder einen lokalen Webserver mit Chrome/Edge öffnen. Privaten Modus prüfen.</p></main>';return;}
    // modal
    $('btn-api').onclick=()=>{$('worker-url').value=workerUrl;$('access-code').value='';document.querySelector(`input[name=engine][value=${engineMode}]`).checked=true;$('local-model').value=localModel;$('modal-overlay').hidden=false;};
    $('local-model').innerHTML=Object.entries(LOCAL_MODELS).map(([id,d])=>`<option value="${id}">${id.split('-Instruct')[0]} – ${d}</option>`).join('');$('local-model').value=localModel;
    $('btn-load-local').onclick=async()=>{try{localModel=$('local-model').value;localStorage.setItem('onlyai_local_model',localModel);$('btn-load-local').disabled=true;await loadLocal();toast('Lokale KI geladen und einsatzbereit.');}catch(e){toast(e.message||String(e),true);}finally{$('btn-load-local').disabled=false;}};
    $('btn-stop').onclick=()=>{try{llm?.interruptGenerate();}catch{}};
    $('btn-close-modal').onclick=()=>{$('modal-overlay').hidden=true;};
    $('btn-save-config').onclick=()=>{try{engineMode=document.querySelector('input[name=engine]:checked').value;localModel=$('local-model').value;const u=$('worker-url').value.trim();if(u){workerUrl=validateWorkerUrl(u);const c=$('access-code').value.trim();if(c)accessCode=c;localStorage.setItem('onlyai_worker_url',workerUrl);if(accessCode)sessionStorage.setItem('onlyai_access_code',accessCode);}if(engineMode==='worker'&&(!workerUrl||!accessCode))throw Error('Für den Worker-Modus Adresse und Zugangscode eingeben – oder „Lokal im Browser“ wählen.');localStorage.setItem('onlyai_engine',engineMode);localStorage.setItem('onlyai_local_model',localModel);$('modal-overlay').hidden=true;updateConnectionBadge();toast('KI-Einstellungen gespeichert.');}catch(e){toast(e.message,true);}};
    $('btn-test-connection').onclick=async()=>{try{await connectionTest();toast('Worker erreichbar. Zugangscode akzeptiert und API-Secret vorhanden.');}catch(e){toast(e.message,true);}};
    $('btn-disconnect').onclick=()=>{workerUrl='';accessCode='';localStorage.removeItem('onlyai_worker_url');sessionStorage.removeItem('onlyai_access_code');$('worker-url').value='';$('access-code').value='';updateConnectionBadge();toast('KI-Verbindung getrennt.');};
    $('btn-help').onclick=()=>{$('help-overlay').hidden=false;};$('btn-close-help').onclick=()=>{$('help-overlay').hidden=true;};
    $('btn-close-version').onclick=$('btn-version-cancel').onclick=()=>{$('version-overlay').hidden=true;preview=null;};$('btn-version-restore').onclick=()=>restoreVersion().catch(e=>toast(e.message,true));
    $('btn-new').onclick=$('btn-welcome-new').onclick=()=>createItem().catch(e=>toast(e.message,true));
    $('btn-demo').onclick=$('btn-sidebar-demo').onclick=()=>createDemo().catch(e=>toast(e.message,true));
    $('search').oninput=()=>refreshItems().catch(e=>toast(e.message,true));
    $('btn-save-all').onclick=()=>persistDraft().then(()=>toast('Entwurf gespeichert. Versionen entstehen über „Ergebnis speichern“.')).catch(e=>toast(e.message,true));
    $('btn-backup').onclick=()=>backupAll().catch(e=>toast(e.message,true));
    $('btn-import-backup').onclick=()=>$('backup-file').click();$('backup-file').onchange=async e=>{try{if(e.target.files[0])await restoreBackup(e.target.files[0]);}catch(err){toast(err.message,true);}e.target.value='';};
    $('file-input').onchange=async e=>{try{if(e.target.files[0])await importFile(e.target.files[0]);}catch(err){toast(err.message,true);}e.target.value='';};
    $('bulk-files').onchange=async e=>{let ok=0,errors=[];for(const f of [...e.target.files]){try{await importFile(f,true);ok++;}catch(err){errors.push(f.name+': '+err.message);}}await refreshItems();toast(ok+' Dateien aufgenommen.'+(errors.length?' '+errors.length+' Fehler: '+errors[0]:''),!!errors.length);e.target.value='';};
    for(let id of ['title','kind','raw-text',...Array.from({length:5},(_,i)=>'output'+(i+1))])$(id).addEventListener('input',()=>setDirty(true));
    for(let n=1;n<=5;n++){
      document.querySelector(`.btn-offline[data-level="${n}"]`).onclick=e=>{e.currentTarget.closest("details").open=false;offlineRun(n).catch(err=>toast(err.message,true));};
      document.querySelector(`.btn-generate[data-level="${n}"]`).onclick=e=>{e.currentTarget.closest("details").open=false;runKI(n);};
      document.querySelector(`.btn-save-version[data-level="${n}"]`).onclick=()=>saveVersion(n).catch(e=>toast(e.message,true));
      document.querySelector(`.btn-edit[data-level="${n}"]`).onclick=()=>{$('output'+n).readOnly=false;$('output'+n).focus();toast('Ebene '+n+': Text bearbeiten und mit „Ergebnis speichern“ versionieren.');};
      document.querySelector(`.btn-view-version[data-level="${n}"]`).onclick=()=>openVersion(n);
      document.querySelector(`.btn-export[data-level="${n}"]`).onclick=()=>exportWord(n);
    }
    $('btn-candidates2').onclick=()=>loadCandidates(2);$('btn-candidates3').onclick=()=>loadCandidates(3);
    $('btn-promote').onclick=async()=>{if(!item)return;if(item.status==='erkenntnisstand'){if(confirm('Eintrag in die Bestandsaufnahme zurückgeben?')){item.status='bestandsaufnahme';await putOne(item);updateStatus();await refreshItems();}return;}
      if(!$('output5').value.trim()){toast('Vorher Ebene 5 bearbeiten.',true);return;}if(!confirm('Die Ebenen 1–5 sind von dir geprüft? Nur mit deiner ausdrücklichen Freigabe soll dieser Eintrag in 03_Erkenntnisbestand wechseln.'))return;
      await persistDraft();item.status='erkenntnisstand';await putOne(item);updateStatus();await refreshItems();toast('Ausdrücklich in den Erkenntnisbestand übernommen.');};
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    await refreshItems();updateConnectionBadge();
  }
  document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);toast('Programm konnte nicht starten: '+e.message,true);}));
})();
