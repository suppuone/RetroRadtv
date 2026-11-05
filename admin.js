(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const paths = { radio:'data/radio-presets.json', tv:'data/tv-presets.json' };
  let token = '', repo = 'suppuone/RetroRadtv', branch = 'main', activeType = 'radio';
  let drafts = { radio:[], tv:[] }, originals = { radio:null, tv:null }, selectedIndex = -1, undoStack = [], connected = false;

  function status(message, kind = '') {
    for (const id of ['admin-status','admin-workspace-status']) { const el=$(id); if(el){el.textContent=message;el.className=`admin-status ${kind} ${id==='admin-workspace-status'?'admin-workspace-status':''}`;} }
  }
  function validation(message = '', kind = '') {
    const el = $('admin-validation'); el.textContent = message; el.className = `admin-validation ${kind}`;
  }
  function apiHeaders() {
    return { 'Accept':'application/vnd.github+json', 'Authorization':`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28' };
  }
  async function github(url, options = {}) {
    const response = await fetch(url, { ...options, headers:{ ...apiHeaders(), ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `GitHub returned ${response.status}.`);
    return body;
  }
  function decodeBase64(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  function canonical(value) { return JSON.stringify(value); }
  function normalizeCatalog(data, type) {
    if (Array.isArray(data)) return data.map((item, index) => ({ key:String(item.stationuuid || item.url || index), data:{...item} }));
    if (!data || typeof data !== 'object') throw new Error(`The ${type} catalogue is not a JSON object or list.`);
    return Object.entries(data).filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item)).map(([key, item]) => ({ key, data:{...item} }));
  }
  function itemUrl(entry) { return String(entry?.data?.url || entry?.data?.url_resolved || entry?.key || '').trim(); }
  function itemName(entry) { return String(entry?.data?.name || entry?.data?.title || 'Untitled station').trim(); }
  function currentFile(type) {
    const object = {};
    for (const entry of drafts[type]) {
      const data = {...entry.data};
      const key = type === 'tv' ? (data.url || data.url_resolved || entry.key) : (data.stationuuid || data.url_resolved || data.url || entry.key);
      if (type === 'tv') data.url = String(data.url || data.url_resolved || key);
      object[String(key)] = data;
    }
    return object;
  }
  async function readRepoFile(type) {
    const url = `https://api.github.com/repos/${repo}/contents/${paths[type]}?ref=${encodeURIComponent(branch)}`;
    const body = await github(url);
    const text = decodeBase64(body.content);
    const data = JSON.parse(text);
    originals[type] = { sha:body.sha, data, canonical:canonical(data) };
    drafts[type] = normalizeCatalog(data, type);
  }
  async function connect() {
    token = $('admin-token').value.trim();
    repo = $('admin-repo').value.trim(); branch = $('admin-branch').value.trim() || 'main';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { status('Enter a repository in owner/name format.', 'error'); return; }
    if (!token) { status('Paste a GitHub token to connect.', 'error'); return; }
    $('admin-connect').disabled = true; status('Connecting and loading the shared catalogues…');
    try {
      await Promise.all([readRepoFile('radio'), readRepoFile('tv')]);
      connected = true; selectedIndex = -1; undoStack = [];
      $('admin-access').hidden = true; $('admin-workspace').hidden = false;
      status(''); renderAll(); resetEditor();
    } catch (error) {
      connected = false; status(`Could not connect: ${error.message} Check the token, repository, branch, and Contents permission.`, 'error');
    } finally { $('admin-connect').disabled = false; }
  }
  function snapshot() {
    undoStack.push(JSON.stringify(drafts)); if (undoStack.length > 20) undoStack.shift();
    $('admin-undo').disabled = false;
  }
  function undo() {
    const previous = undoStack.pop(); if (!previous) return;
    drafts = JSON.parse(previous); selectedIndex = -1; resetEditor(); renderAll();
  }
  function streamKey(value) { return String(value || '').trim().replace(/\/$/, '').toLowerCase(); }
  function renderList() {
    const list = $('admin-list'), query = $('admin-search').value.trim().toLowerCase(), rows = drafts[activeType];
    const shown = rows.map((entry, index) => ({entry,index})).filter(({entry}) => `${itemName(entry)} ${itemUrl(entry)} ${entry.data.country || ''} ${entry.data.group || entry.data.tags || ''}`.toLowerCase().includes(query));
    $('admin-list-count').textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`;
    $(`admin-${activeType}-count`).textContent = String(rows.length);
    list.innerHTML = shown.length ? shown.map(({entry,index}) => {
      const logo = entry.data.logo || entry.data.favicon || '', initials = itemName(entry).split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
      const country = entry.data.country || entry.data.countryname || 'Country not set', genre = entry.data.group || entry.data.tags || 'Uncategorized';
      return `<div class="admin-entry ${selectedIndex === index ? 'selected' : ''}" data-admin-index="${index}" role="button" tabindex="0" aria-label="Edit ${esc(itemName(entry))}"><span class="admin-entry-logo">${logo ? `<img src="${esc(logo)}" alt="" loading="lazy">` : esc(initials || 'TV')}</span><span class="admin-entry-copy"><b>${esc(itemName(entry))}</b><small>${esc(country)} · ${esc(genre)}</small></span><button class="admin-move" type="button" data-admin-move="-1" data-index="${index}" aria-label="Move up" ${index===0?'disabled':''}>↑</button><button class="admin-move" type="button" data-admin-move="1" data-index="${index}" aria-label="Move down" ${index===rows.length-1?'disabled':''}>↓</button></div>`;
    }).join('') : '<div class="admin-order-hint">No entries match this search.</div>';
    $('admin-undo').disabled = undoStack.length === 0;
  }
  function diffFor(type) {
    if (!originals[type]) return {added:0,changed:0,removed:0};
    const oldMap = new Map(normalizeCatalog(originals[type].data,type).map(entry => [type === 'tv' ? itemUrl(entry) : String(entry.data.stationuuid || entry.key), entry.data]));
    const next = currentFile(type), newMap = new Map(Object.entries(next).map(([key,data]) => [type === 'tv' ? itemUrl({key,data}) : String(data.stationuuid || key), data]));
    let added=0,changed=0,removed=0;
    for (const [key,data] of newMap) { if (!oldMap.has(key)) added++; else if (canonical(oldMap.get(key)) !== canonical(data)) changed++; }
    for (const key of oldMap.keys()) if (!newMap.has(key)) removed++;
    return {added,changed,removed};
  }
  function renderDiff() {
    const chunks = ['radio','tv'].map(type => {
      const d=diffFor(type); return `${type==='radio'?'Radio':'TV'}: +${d.added} added · ${d.changed} edited · −${d.removed} deleted`;
    });
    const dirty = ['radio','tv'].some(type => {const d=diffFor(type);return d.added+d.changed+d.removed>0;});
    $('admin-diff').textContent = dirty ? chunks.join('  |  ') : 'No draft changes.';
    $('admin-publish').disabled = !dirty;
  }
  function renderAll() { renderList(); renderDiff(); }
  function selectType(type) {
    if(editorDirty()&&!window.confirm('Discard the unsaved form changes and switch catalogues?'))return;
    activeType = type; selectedIndex = -1;
    document.querySelectorAll('[data-admin-type]').forEach(button => button.classList.toggle('active',button.dataset.adminType===type));
    $('admin-editor-heading').textContent = `Add a ${type === 'radio' ? 'radio station' : 'TV channel'}`;
    resetEditor(); renderAll();
  }
  function setValue(id, value) { $(id).value = String(value ?? ''); }
  function fillEditor(index) {
    selectedIndex = index;
    const data = drafts[activeType][index]?.data; if (!data) return resetEditor();
    $('admin-editor-heading').textContent = `Edit ${activeType === 'radio' ? 'radio station' : 'TV channel'}`;
    setValue('admin-name',data.name || data.title); setValue('admin-country',data.country || data.countryname);
    setValue('admin-url',data.url || data.url_resolved || drafts[activeType][index].key);
    setValue('admin-group',activeType === 'radio' ? data.tags : data.group);
    setValue('admin-logo',activeType === 'radio' ? (data.favicon || data.logo) : (data.logo || data.favicon));
    setValue('admin-tags',activeType === 'radio' ? (data.state || data.language || '') : (Array.isArray(data.options) ? data.options.join(', ') : data.tags || ''));
    $('admin-delete').disabled = false; validation(); updatePreview(); renderList();
  }
  function editorDirty() {
    const ids=['admin-name','admin-country','admin-url','admin-group','admin-logo','admin-tags'],actual=ids.map(id=>$(id).value.trim());
    if(selectedIndex<0)return actual.some(Boolean);
    const entry=drafts[activeType][selectedIndex];if(!entry)return actual.some(Boolean);const d=entry.data;
    const expected=[d.name||d.title||'',d.country||d.countryname||'',d.url||d.url_resolved||entry.key,activeType==='radio'?(d.tags||''):(d.group||''),activeType==='radio'?(d.favicon||d.logo||''):(d.logo||d.favicon||''),activeType==='radio'?(d.state||d.language||''):(Array.isArray(d.options)?d.options.join(', '):d.tags||'')].map(value=>String(value).trim());
    return actual.some((value,index)=>value!==expected[index]);
  }
  function resetEditor() {
    selectedIndex = -1; ['admin-name','admin-country','admin-url','admin-group','admin-logo','admin-tags'].forEach(id => setValue(id,''));
    $('admin-editor-heading').textContent = `Add a ${activeType === 'radio' ? 'radio station' : 'TV channel'}`;
    $('admin-delete').disabled = true; validation(); updatePreview(); renderList();
  }
  function validWebURL(value, optional = false) {
    if (!value && optional) return true;
    try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
  }
  function updatePreview() {
    const name = $('admin-name').value.trim() || 'Station name', country = $('admin-country').value.trim() || 'Country', group = $('admin-group').value.trim() || (activeType === 'radio' ? 'Radio' : 'Live television');
    $('admin-preview-name').textContent = name; $('admin-preview-meta').textContent = `${country} · ${group}`;
    $('admin-preview-kind').textContent = activeType === 'radio' ? 'RADIO' : 'TV LIVE';
    $('admin-preview-initials').textContent = name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase() || 'FM';
    const img = $('admin-preview-logo'), url = $('admin-logo').value.trim();
    img.hidden = true; img.removeAttribute('src');
    if (url && validWebURL(url)) { img.onload = () => { img.hidden = false; validation('Logo link loaded.','success'); }; img.onerror = () => { img.hidden = true; validation('Logo did not load. Check the image URL; the station can still use its initials.','warning'); }; img.src = url; }
  }
  function saveDraftEntry() {
    const name=$('admin-name').value.trim(),country=$('admin-country').value.trim(),url=$('admin-url').value.trim(),group=$('admin-group').value.trim(),logo=$('admin-logo').value.trim(),extra=$('admin-tags').value.trim();
    if (!name) return validation('Add a station or channel name.','error');
    if (!validWebURL(url)) return validation('Stream URL must be a complete HTTP or HTTPS address.','error');
    if (!validWebURL(logo,true)) return validation('Logo URL must be a complete HTTP or HTTPS address, or left blank.','error');
    const duplicate = drafts[activeType].findIndex((entry,index)=>index!==selectedIndex&&streamKey(itemUrl(entry))===streamKey(url));
    if (duplicate>=0) return validation('That stream URL is already in this catalogue.','error');
    const existing = selectedIndex>=0 ? drafts[activeType][selectedIndex] : {key:url,data:{}};
    const data = {...existing.data,name,country,url};
    if (activeType==='radio') {
      data.url_resolved=url; data.stationuuid=data.stationuuid||existing.key||url; data.tags=group; data.favicon=logo; data.state=extra;
    } else {
      data.group=group; data.logo=logo; data.options=extra?extra.split(',').map(value=>value.trim()).filter(Boolean):(Array.isArray(data.options)?data.options:[]);
    }
    snapshot();
    const entry={key:activeType==='tv'?url:(data.stationuuid||url),data};
    if(selectedIndex>=0)drafts[activeType][selectedIndex]=entry;else drafts[activeType].unshift(entry);
    selectedIndex=activeType==='tv'?drafts[activeType].findIndex(item=>itemUrl(item)===url):drafts[activeType].findIndex(item=>item.key===entry.key);
    fillEditor(selectedIndex); renderAll();
    validation(url.startsWith('http:')?'Saved. This HTTP stream may be blocked when the app is opened over HTTPS.':'Saved to draft. Review the changes before publishing.',url.startsWith('http:')?'warning':'success');
  }
  function deleteDraftEntry() {
    if(selectedIndex<0)return;
    const name=itemName(drafts[activeType][selectedIndex]);if(!window.confirm(`Delete “${name}” from the shared ${activeType==='radio'?'radio':'TV'} catalogue draft?`))return;
    snapshot();drafts[activeType].splice(selectedIndex,1);resetEditor();renderAll();
  }
  function moveEntry(index,delta) {
    const target=index+delta, rows=drafts[activeType];if(target<0||target>=rows.length)return;
    snapshot();[rows[index],rows[target]]=[rows[target],rows[index]];
    selectedIndex=target;fillEditor(target);renderAll();
  }
  function parseM3U(text,type) {
    const lines=text.split(/\r?\n/);const out=[];let meta=null;
    for(const lineRaw of lines){const line=lineRaw.trim();if(line.startsWith('#EXTINF')){
      const comma=line.indexOf(','),title=comma>=0?line.slice(comma+1).trim():'';const attrs={};
      for(const match of line.matchAll(/([\w-]+)="([^"]*)"/g))attrs[match[1].toLowerCase()]=match[2];
      meta={name:title||attrs['tvg-name']||'Imported channel',country:attrs['tvg-country']||attrs.country||'',url:'',group:attrs['group-title']||'',logo:attrs['tvg-logo']||''};
    } else if(line&&!line.startsWith('#')&&meta){meta.url=line;out.push(meta);meta=null;}}
    return out.map(item=> type==='radio'?{name:item.name,country:item.country,url:item.url,url_resolved:item.url,stationuuid:item.url,tags:item.group,favicon:item.logo}:{name:item.name,country:item.country,url:item.url,group:item.group,logo:item.logo,options:[]});
  }
  function parseImport(text,filename,type) {
    if (/\.m3u8?$/i.test(filename)||/^\s*#EXTM3U/m.test(text)) return parseM3U(text,type);
    const parsed=JSON.parse(text);let source=parsed;
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&(parsed.radio||parsed.tv))source=parsed[type]||[];
    if(Array.isArray(source))return source;
    if(source&&typeof source==='object')return Object.values(source);
    throw new Error('The selected file is not a supported JSON or M3U catalogue.');
  }
  async function importFile(file) {
    if(!file)return;
    try {
      const parsed=parseImport(await file.text(),file.name,activeType),normalized=[];
      for(const raw of parsed){
        const item={...raw};item.name=String(item.name||item.title||'').trim();item.url=String(item.url||item.url_resolved||'').trim();
        if(!item.name||!validWebURL(item.url))continue;
        if(activeType==='radio'){item.stationuuid=String(item.stationuuid||item.url_resolved||item.url);item.url_resolved=String(item.url_resolved||item.url);item.favicon=item.favicon||item.logo||'';item.tags=item.tags||item.group||'';}
        else{item.group=item.group||item.tags||'';item.logo=item.logo||item.favicon||'';item.options=Array.isArray(item.options)?item.options:[];}
        normalized.push({key:activeType==='tv'?item.url:(item.stationuuid||item.url),data:item});
      }
      const known=new Set(drafts[activeType].map(entry=>streamKey(itemUrl(entry)))),unique=normalized.filter(entry=>{const key=streamKey(itemUrl(entry));if(known.has(key))return false;known.add(key);return true;});
      if(!unique.length){validation('No new entries with valid names and HTTP(S) stream URLs were found.','warning');return;}
      snapshot();drafts[activeType].push(...unique);renderAll();validation(`Imported ${unique.length} new ${activeType==='radio'?'radio stations':'TV channels'} into the draft. Review before publishing.`, 'success');
    }catch(error){validation(`Import failed: ${error.message}`,'error');}
    $('admin-file').value='';
  }
  function downloadFile(filename,content,type) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJSON() { downloadFile(`${activeType}-presets.json`,JSON.stringify(currentFile(activeType),null,2)+'\n','application/json'); }
  function exportM3U() {
    const lines=['#EXTM3U'];
    for(const entry of drafts[activeType]){const data=entry.data,name=itemName(entry),group=data.group||data.tags||'',logo=data.logo||data.favicon||'';lines.push(`#EXTINF:-1 tvg-name="${name.replace(/"/g,'')}" group-title="${String(group).replace(/"/g,'')}" tvg-logo="${String(logo).replace(/"/g,'')}",${name}`,itemUrl(entry));}
    downloadFile(`${activeType}-presets.m3u`,lines.join('\n')+'\n','audio/x-mpegurl');
  }
  function changedTypes() { return ['radio','tv'].filter(type=>originals[type]&&canonical(currentFile(type))!==originals[type].canonical); }
  async function publish() {
    const changed=changedTypes();if(!changed.length)return;
    const summary=changed.map(type=>{const d=diffFor(type);return `${type}: +${d.added}, ${d.changed} edited, −${d.removed}`;}).join('\n');
    if(!window.confirm(`Publish these catalogue changes to ${repo} (${branch})?\n\n${summary}\n\nEach updated JSON file will create a GitHub commit.`))return;
    $('admin-publish').disabled=true;status('Checking for newer repository changes…');let published=[];
    try {
      for(const type of changed){
        const endpoint=`https://api.github.com/repos/${repo}/contents/${paths[type]}?ref=${encodeURIComponent(branch)}`;
        const latest=await github(endpoint),latestData=JSON.parse(decodeBase64(latest.content));
        if(canonical(latestData)!==originals[type].canonical)throw new Error(`${paths[type]} changed on GitHub since you connected. Close this panel, reconnect, and review the latest version before publishing.`);
        const content=JSON.stringify(currentFile(type),null,2)+'\n';
        const result=await github(`https://api.github.com/repos/${repo}/contents/${paths[type]}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Update ${type} station catalogue via RetroRadtv admin`,content:encodeBase64(content),sha:latest.sha,branch})});
        const saved=currentFile(type);originals[type]={sha:result.content?.sha||latest.sha,data:saved,canonical:canonical(saved)};published.push(type);
      }
      status(`Published ${published.join(' and ')} catalogue${published.length>1?'s':''} to GitHub. Refresh the app after Pages updates.`, 'success');renderAll();
    } catch(error) {
      status(`${published.length?`Published ${published.join(' and ')}; `:''}Publish stopped: ${error.message}`, 'error');renderAll();
    }
  }
  function closeAdmin() {
    if(connected&&(changedTypes().length||editorDirty())&&!window.confirm('Leave admin and discard unpublished draft changes? The GitHub catalogues will remain unchanged.'))return;
    token='';$('admin-token').value='';connected=false;window.location.replace('./index.html');
  }

  $('admin-close').addEventListener('click',closeAdmin);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeAdmin();}});
  $('admin-connect').addEventListener('click',connect);
  document.querySelectorAll('[data-admin-type]').forEach(button=>button.addEventListener('click',()=>selectType(button.dataset.adminType)));
  $('admin-new').addEventListener('click',()=>{if(editorDirty()&&!window.confirm('Discard the unsaved form changes and start a new entry?'))return;resetEditor();});$('admin-save').addEventListener('click',saveDraftEntry);$('admin-delete').addEventListener('click',deleteDraftEntry);$('admin-undo').addEventListener('click',undo);$('admin-publish').addEventListener('click',publish);
  $('admin-search').addEventListener('input',renderList);$('admin-import').addEventListener('click',()=>$('admin-file').click());$('admin-file').addEventListener('change',event=>importFile(event.target.files?.[0]));
  $('admin-export-json').addEventListener('click',exportJSON);$('admin-export-m3u').addEventListener('click',exportM3U);
  $('admin-list').addEventListener('click',event=>{
    const move=event.target.closest('[data-admin-move]');if(move){event.stopPropagation();moveEntry(Number(move.dataset.index),Number(move.dataset.adminMove));return;}
    const row=event.target.closest('[data-admin-index]');if(row){const index=Number(row.dataset.adminIndex);if(index!==selectedIndex&&editorDirty()&&!window.confirm('Discard the unsaved form changes and select another station?'))return;fillEditor(index);}
  });
  $('admin-list').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-admin-index]')){event.preventDefault();fillEditor(Number(event.target.dataset.adminIndex));}});
  ['admin-name','admin-country','admin-url','admin-group','admin-logo','admin-tags'].forEach(id=>$(id).addEventListener('input',updatePreview));
})();
