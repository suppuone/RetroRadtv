(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const RADIO_STORE='retrotvra.radio-presets.v1',TV_STORE='retrotvra.tv-presets.v1',TV_ORDER_STORE='retrotvra.tv-order.v1',RADIO_HIDDEN_STORE='retrotvra.radio-hidden.v1',TV_HIDDEN_STORE='retrotvra.tv-hidden.v1',VOLUME_STORE='retrotvra.volume.v1',GLOW_STORE='retrotvra.glow-mode.v1';
  let radios=[],tvs=[],radioPresets={},tvPresets={},radioIndex=-1,tvIndex=-1,presetMode='radio',selectedTVPresetKey=null,browserKind='radio',browserSource='library',onlineRows=[],onlineTVCache=null,onlineCountries=[],onlineGenres=[],onlineOffset=0,onlineVisibleLimit=100,onlineHasMore=false,onlineSearchDone=false,hls=null,toastTimer=null,dragState=null;
  const audio=$('radio-audio'),video=$('tv-video');
  let glowMode='color';try{glowMode=localStorage.getItem(GLOW_STORE)||'color';}catch{}
  let meterAudio=null,meterContext=null,meterAnalyser=null,meterGain=null,meterSource=null,meterBins=null,meterFrame=0,meterLevel=0,meterLastPaint=0,meterPrevious=0,meterBeatPulse=0,meterBeatAt=0;
  function stopSoundRays(){if(meterFrame){cancelAnimationFrame(meterFrame);meterFrame=0;}if(meterAudio)meterAudio.pause();const canvas=$('sound-rays');if(canvas){const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);}}
  function startSoundRays(){
    if(audio.paused)return;
    const canvas=$('sound-rays');if(!canvas)return;
    if(!meterFrame){
      const draw=()=>{
        if(audio.paused){stopSoundRays();return;}
        const now=performance.now();
        if(now-meterLastPaint<24){meterFrame=requestAnimationFrame(draw);return;}
        meterLastPaint=now;
        const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,box.width),h=Math.max(1,box.height);
        if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
        const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
        const t=now/1000;
        let energy=0,hasSignal=false;
        if(meterAnalyser&&meterBins){
          meterAnalyser.getByteFrequencyData(meterBins);
          let sum=0,weight=0;
          const limit=Math.min(180,meterBins.length);
          for(let j=2;j<limit;j++){const wt=j<24?1.7:j<72?1.25:.72;sum+=meterBins[j]*meterBins[j]*wt;weight+=wt;}
          energy=weight?Math.sqrt(sum/weight)/255:0;
          hasSignal=energy>.009;
        }
        // Some public streams block Web Audio analysis. Keep a lively playback-synced
        // fallback in that case; readable beats still come from the analyser where allowed.
        if(!hasSignal)energy=.22+.25*(.5+.5*Math.sin(t*5.2)+.3*Math.sin(t*8.1));
        if(energy>meterPrevious*1.07+.018&&now-meterBeatAt>115){meterBeatPulse=1;meterBeatAt=now;}
        meterPrevious+=(energy-meterPrevious)*(energy>meterPrevious?.42:.16);
        meterBeatPulse*=.88;
        meterLevel+=(energy-meterLevel)*(energy>meterLevel?.40:.14);
        const cx=w/2,cy=h/2,radius=Math.min(w,h)*.315,count=180,beat=Math.min(1,meterLevel*2.4+meterBeatPulse*.72),reach=Math.min(w,h)*.48;
        const waves=glowMode==='warm'?['#ff7a32','#ffbd5b','#ffe7a4']:glowMode==='white'?['#ffffff','#e8f4ff','#b8d8ff']:['#64e9ff','#d278ff','#ffd978'];
        const dotColor=i=>glowMode==='warm'?`hsl(${28+(i/count)*26} 100% ${58+(i%3)*7}%)`:glowMode==='white'?`hsl(${205+(i/count)*30} 100% ${82+(i%3)*5}%)`:`hsl(${190+i/count*360+t*30} 100% 70%)`;
        c.globalCompositeOperation='lighter';
        for(let j=0;j<3;j++){
          const phase=(Math.max(0,now-meterBeatAt)/680+j/3)%1,waveRadius=radius+phase*(reach-radius),waveAlpha=(1-phase)*(.08+meterLevel*.17+meterBeatPulse*.42),waveColor=waves[j];
          c.globalAlpha=Math.min(.88,waveAlpha);c.strokeStyle=waveColor;c.lineWidth=1.3+meterBeatPulse*2.2;c.shadowColor=waveColor;c.shadowBlur=10+meterBeatPulse*16;c.beginPath();c.arc(cx,cy,waveRadius,0,Math.PI*2);c.stroke();
        }
        c.globalAlpha=1;c.shadowBlur=0;c.beginPath();c.arc(cx,cy,radius-2,0,Math.PI*2);c.strokeStyle=glowMode==='warm'?'rgba(255,190,92,.34)':glowMode==='white'?'rgba(232,244,255,.44)':'rgba(86,190,255,.3)';c.lineWidth=1.2;c.stroke();
        for(let i=0;i<count;i++){
          const angle=i*Math.PI*2/count+t*.12-Math.PI/2;
          const bin=meterBins?Math.max(1,Math.min(meterBins.length-2,Math.floor((i/count)*Math.min(180,meterBins.length)))):0;
          const sample=hasSignal?(meterBins[(bin-2+meterBins.length)%meterBins.length]+2*meterBins[(bin-1+meterBins.length)%meterBins.length]+3*meterBins[bin]+2*meterBins[(bin+1)%meterBins.length]+meterBins[(bin+2)%meterBins.length])/9/255:0;
          const ripple=.5+.5*Math.sin(t*5.1-i*.13)+.22*Math.sin(t*8.2+i*.09);
          const amp=hasSignal?Math.min(1,sample*1.15+meterLevel*.48+meterBeatPulse*.24):Math.min(1,.18+ripple*.54+meterLevel*.28+meterBeatPulse*.12);
          const radiusNow=radius+5+amp*(glowMode==='white'?25:34)+beat*8;
          const x=cx+Math.cos(angle)*radiusNow,y=cy+Math.sin(angle)*radiusNow,color=dotColor(i),dotSize=1.15+amp*1.35;
          c.globalAlpha=.62+amp*.38;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=5+amp*12;c.beginPath();c.arc(x,y,dotSize,0,Math.PI*2);c.fill();
        }
        c.globalAlpha=1;c.globalCompositeOperation='source-over';meterFrame=requestAnimationFrame(draw);
      };
      draw();
    }
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
      if(!meterAudio){meterAudio=new Audio();meterAudio.crossOrigin='anonymous';meterAudio.preload='none';}
      if(!meterContext){meterContext=new Ctx();meterAnalyser=meterContext.createAnalyser();meterAnalyser.fftSize=1024;meterAnalyser.smoothingTimeConstant=.32;meterBins=new Uint8Array(meterAnalyser.frequencyBinCount);meterSource=meterContext.createMediaElementSource(meterAudio);meterGain=meterContext.createGain();meterGain.gain.value=0;meterSource.connect(meterAnalyser);meterAnalyser.connect(meterGain);meterGain.connect(meterContext.destination);}
      const src=audio.currentSrc||audio.src;
      if(src&&meterAudio.src!==src){meterAudio.pause();meterAudio.src=src;meterAudio.load();}
      meterContext.resume().then(()=>{if(!audio.paused)meterAudio.play().catch(()=>{});}).catch(()=>{});
    }catch{}
  }

  function loadStore(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}
  function setRadioVolume(level,persist=true){const value=Math.max(0,Math.min(100,Math.round(Number(level)||0)));$('radio-volume').value=String(value);audio.volume=value/100;$('volume-number').textContent=String(value);document.querySelector('.dial-wrap').style.setProperty('--dial-angle',`${-135+value*2.7}deg`);if(persist)saveStore(VOLUME_STORE,value);}
  function setVolumeFromDialPointer(event){const dial=document.querySelector('.dial-wrap'),rect=dial.getBoundingClientRect(),dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);let angle=Math.atan2(dy,dx)*180/Math.PI+90;if(angle>180)angle-=360;angle=Math.max(-135,Math.min(135,angle));setRadioVolume((angle+135)*100/270);}
  function saveStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('This browser could not save your presets.');}}
  function stationKey(item){return String(item?.stationuuid||item?.url_resolved||item?.url||item?.name||'');}
  function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  function formatClock(){const d=new Date();$('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}).toUpperCase();}
  function inferTVCountry(name=''){
    const n=String(name).toLowerCase();
    if(/bbc|star vijay uk|reuters/.test(n))return 'United Kingdom';
    if(/cnn|abc news|discovery|cartoon network|accuweather|hallmark|hbo|create/.test(n))return 'United States';
    if(/al jazeera/.test(n))return 'Qatar';if(/dw english/.test(n))return 'Germany';if(/arirang/.test(n))return 'South Korea';
    if(/kantipur/.test(n))return 'Nepal';if(/africanews/.test(n))return 'Republic of the Congo';if(/nhk/.test(n))return 'Japan';
    if(/france 24/.test(n))return 'France';if(/trt world/.test(n))return 'Turkey';
    return 'India';
  }
  function fillCountries(){
    const fill=(id,rows)=>{const countries=[...new Set(rows.map(s=>String(s.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));$(id).innerHTML='<option value="all">All countries</option>'+countries.map(name=>`<option value="${safe(name)}">${safe(name)}</option>`).join('');};
    fill('radio-country',radios);fill('tv-country',tvs);
  }
  function mergeInitialPresets(remote,storeKey,type){
    const saved=loadStore(storeKey,{}),hiddenKey=type==='tv'?TV_HIDDEN_STORE:RADIO_HIDDEN_STORE,hidden=new Set(loadStore(hiddenKey,[])),merged={...remote};
    for(const key of hidden)delete merged[key];
    for(const [key,item] of Object.entries(saved))if(item&&typeof item==='object'&&!hidden.has(key)){
      if(Object.prototype.hasOwnProperty.call(remote,key))merged[key]={...item,...remote[key]};
      else if(item._kind===type)merged[key]=item;
    }
    return merged;
  }
  function applyTVOrder(presets){
    const keys=Object.keys(presets),saved=loadStore(TV_ORDER_STORE,[]);if(!Array.isArray(saved)||!saved.length)return presets;
    const ordered={};for(const key of saved)if(Object.prototype.hasOwnProperty.call(presets,key))ordered[key]=presets[key];
    for(const key of keys)if(!Object.prototype.hasOwnProperty.call(ordered,key))ordered[key]=presets[key];return ordered;
  }
  async function fetchData(){
    try{
      const [r,t]=await Promise.all([fetch('data/radio-presets.json',{cache:'no-cache'}),fetch('data/tv-presets.json',{cache:'no-cache'})]);
      if(r.ok){const raw=await r.json();radios=Object.entries(raw).map(([key,item])=>({...item,_key:key})).filter(item=>item.url||item.url_resolved);}
      if(t.ok){const raw=await t.json();tvs=Object.entries(raw).map(([key,item])=>({...item,url:item.url||key,country:item.country||inferTVCountry(item.name)})).filter(item=>item.url);}
    }catch{ /* Keep the safe sample presets below if opened without a local web server. */}
    if(!radios.length)radios=[
      {stationuuid:'sample-mirchi',name:'Radio Mirchi Hindi',country:'India',url:'https://stream.zeno.fm/0r0xa792kwzuv',favicon:'',tags:'music hindi'},
      {stationuuid:'sample-bbc',name:'BBC World Service',country:'United Kingdom',url:'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',tags:'news talk'},
      {stationuuid:'sample-kantipur',name:'Kantipur FM',country:'Nepal',url:'https://radio-broadcast.ekantipur.com/stream',tags:'news nepali'},
      {stationuuid:'sample-oli',name:'Oli 96.8 FM',country:'Singapore',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/OLI968FMAAC.aac',tags:'music tamil'}
    ];
    if(!tvs.length)tvs=[
      {name:'BBC News (demo stream)',group:'World News',country:'United Kingdom',url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',logo:''},
      {name:'France 24 English',group:'World News',country:'France',url:'https://live.france24.com/hls/live/2037220/F24_EN_HI_HLS/master.m3u8',logo:''},
      {name:'DW English',group:'World News',country:'Germany',url:'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/stream04/streamPlaylist.m3u8',logo:''}
    ];
    radioPresets=mergeInitialPresets(Object.fromEntries(radios.map(s=>[stationKey(s),s])),RADIO_STORE,'radio');
    tvPresets=applyTVOrder(mergeInitialPresets(Object.fromEntries(tvs.map(s=>[s.url,s])),TV_STORE,'tv'));
    saveStore(RADIO_STORE,radioPresets);saveStore(TV_STORE,tvPresets);
    fillCountries();populateExploreFilters();renderPresets();renderTVRail();renderRemotePresets();renderRadioDisplay();renderExplore();
  }
  function listFor(kind){return kind==='tv'?Object.values(tvPresets):Object.values(radioPresets);}
  function selectedCountry(kind){return $(kind==='tv'?'tv-country':'radio-country')?.value||'all';}
  function currentRows(kind){const rows=listFor(kind);const country=selectedCountry(kind);return rows.filter(item=>country==='all'||String(item.country||'').toLowerCase()===country.toLowerCase());}
  function setScreen(screenId){
    if(screenId==='tv-screen'&&audio.src)stopRadio();
    if(screenId==='radio-screen'&&(video.src||video.currentSrc))stopTV();
    document.querySelectorAll('.screen').forEach(node=>node.classList.toggle('active',node.id===screenId));
    document.querySelectorAll('.nav-item').forEach(node=>node.classList.toggle('active',node.dataset.screen===screenId));
    $('mode-label').textContent=screenId==='radio-screen'?'◉ RADIO MODE':screenId==='tv-screen'?'▣ TV MODE':screenId==='presets-screen'?'★ YOUR PRESETS':'⌕ EXPLORE';
    if(screenId==='presets-screen')renderPresets();
  }
  function stepScreen(direction){const order=['radio-screen','tv-screen','presets-screen','explore-screen'],active=document.querySelector('.screen.active')?.id,index=Math.max(0,order.indexOf(active));setScreen(order[(index+direction+order.length)%order.length]);}
  function radioCurrent(){return radios[radioIndex]||null;}
  function tvCurrent(){return tvs[tvIndex]||null;}
  function drawRadio(){
    const station=radioCurrent();if(!station){$('radio-title').textContent='Choose a station';$('radio-subtitle').textContent='Your radio favourites are ready';$('radio-star').textContent='☆';$('radio-star').classList.remove('saved');return;}
    $('radio-title').textContent=station.name||'Radio station';$('radio-subtitle').textContent=[station.country||'Internet radio',station.codec||'LIVE',station.bitrate?`${station.bitrate} KBPS`:null].filter(Boolean).join(' · ');
    const key=stationKey(station),saved=Boolean(radioPresets[key]);$('radio-star').textContent=saved?'★':'☆';$('radio-star').classList.toggle('saved',saved);$('radio-star').setAttribute('aria-label',saved?'Remove station from presets':'Add radio station to presets');
    const art=$('radio-art');const logo=station.favicon||station.logo;art.style.backgroundImage='radial-gradient(circle at 50% 48%,#343438,#15171a 68%,#0d0f12)';art.innerHTML=(logo?'<img class="station-logo-badge" src="'+safe(logo)+'" alt="" referrerpolicy="no-referrer">':'')+'<canvas class="sound-rays" id="sound-rays" aria-hidden="true"></canvas><div class="speaker-aura" aria-hidden="true"></div><div class="speaker-cone" aria-hidden="true"></div><div class="record-mark"><span>COOLmag</span><b>RADIO</b><small>ON AIR</small></div>';const logoBadge=art.querySelector('.station-logo-badge');if(logoBadge)logoBadge.addEventListener('error',()=>logoBadge.remove(),{once:true});
    $('radio-status').textContent=audio.paused?'READY · PRESS PLAY TO LISTEN':'TUNED IN · LIVE RADIO';
  }
  function renderRadioDisplay(){if(!radioPresets||!Object.keys(radioPresets).length)return;const current=radioCurrent();if(current&&!radioPresets[stationKey(current)])radioIndex=-1;const rows=currentRows('radio');if(!current&&rows.length){const selected=rows[0];radioIndex=radios.findIndex(s=>stationKey(s)===stationKey(selected));}drawRadio();}
  async function playRadio(station){
    if(!station)return;const key=stationKey(station);radioIndex=radios.findIndex(s=>stationKey(s)===key);if(radioIndex<0){radios.unshift(station);radioIndex=0;}
    if(video.src||video.currentSrc)stopTV();
    if(!station.url&&!station.url_resolved){notify('This station has no stream URL.');return;}
    stopSoundRays();setRadioVolume(Math.min(40,Number($('radio-volume').value||30)));const src=station.url_resolved||station.url;audio.src=src;$('equalizer').classList.add('playing');drawRadio();
    try{await audio.play();$('radio-art').classList.add('playing');$('equalizer').classList.add('playing');startSoundRays();$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';$('radio-status').textContent='TUNED IN · LIVE RADIO';}catch{$('radio-status').textContent='PRESS PLAY TO START';notify('This stream could not start automatically. Press play.');}
    renderPresets();
  }
  function toggleRadio(){if(!audio.src){const rows=currentRows('radio');if(rows.length)playRadio(rows[0]);else notify('Choose a radio preset first.');return;}if(audio.paused){audio.play().then(()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';}).catch(()=>notify('This stream could not be started.'));}else audio.pause();}
  function stopRadio(){audio.pause();audio.removeAttribute('src');audio.load();$('radio-play').textContent='▶';$('radio-play').title='Play';$('equalizer').classList.remove('playing');$('radio-status').textContent='STOPPED';}
  function stepRadio(direction){const rows=currentRows('radio');if(!rows.length)return;const current=radioCurrent();let index=rows.findIndex(s=>stationKey(s)===stationKey(current||{}));index=(index+direction+rows.length)%rows.length;playRadio(rows[index]);}
  function togglePreset(kind,station){
    if(kind==='radio'){const key=stationKey(station),hidden=new Set(loadStore(RADIO_HIDDEN_STORE,[])),isShared=radios.some(item=>stationKey(item)===key);if(radioPresets[key]){delete radioPresets[key];if(isShared)hidden.add(key);}else{radioPresets[key]=station;hidden.delete(key);}saveStore(RADIO_HIDDEN_STORE,[...hidden]);saveStore(RADIO_STORE,radioPresets);drawRadio();if(!audio.paused){stopSoundRays();startSoundRays();}renderPresets();renderExplore();}
    else{const key=station.url,hidden=new Set(loadStore(TV_HIDDEN_STORE,[])),isShared=tvs.some(item=>item.url===key);if(tvPresets[key]){delete tvPresets[key];if(isShared)hidden.add(key);}else{tvPresets[key]=station;hidden.delete(key);}saveStore(TV_HIDDEN_STORE,[...hidden]);saveStore(TV_STORE,tvPresets);saveStore(TV_ORDER_STORE,Object.keys(tvPresets));drawTV();renderPresets();renderTVRail();renderRemotePresets();renderExplore();}
  }
  function moveSelectedTVPreset(dx,dy){
    const rows=currentRows('tv'),from=rows.findIndex(item=>item.url===selectedTVPresetKey);if(from<0)return;
    const columns=3,row=Math.floor(from/columns),column=from%columns;
    if((dx<0&&column===0)||(dx>0&&(column===columns-1||from+1>=rows.length))||(dy<0&&row===0)||(dy>0&&from+columns>=rows.length))return;
    const to=from+dx+dy*columns;if(to<0||to>=rows.length)return;
    const keys=Object.keys(tvPresets),a=keys.indexOf(rows[from].url),b=keys.indexOf(rows[to].url);if(a<0||b<0)return;[keys[a],keys[b]]=[keys[b],keys[a]];
    const reordered={};for(const key of keys)reordered[key]=tvPresets[key];tvPresets=reordered;saveStore(TV_STORE,tvPresets);saveStore(TV_ORDER_STORE,keys);renderPresets();renderTVRail();renderRemotePresets();renderExplore();
  }
  function renderRemotePresets(){
    const target=$('remote-presets');if(!target)return;const allRows=currentRows('tv'),rows=allRows.slice(0,20),picker=$('remote-channel-select');
    picker.innerHTML='<option value="">Choose a channel</option>'+allRows.map(station=>`<option value="${safe(station.url)}">${safe(station.name||'TV channel')}</option>`).join('');picker.value=tvCurrent()?.url||'';
    target.innerHTML=rows.map((station,index)=>`<button class="remote-key remote-preset-key ${tvCurrent()?.url===station.url?'active':''}" type="button" data-remote-preset="${index}" aria-label="Play ${safe(station.name||'TV channel')}" title="${safe(station.name||'TV channel')}">${String(index+1).padStart(2,'0')}</button>`).join('')||'<span class="empty-note">Save TV channels as presets to use quick select.</span>';
    target.querySelectorAll('[data-remote-preset]').forEach(button=>button.addEventListener('click',()=>{const station=rows[Number(button.dataset.remotePreset)];if(station)playTV(station);}));
  }
  function renderTVRail(){
    const target=$('tv-rail');if(!target)return;const rows=currentRows('tv');
    target.innerHTML=rows.slice(0,40).map((station,index)=>`<button type="button" class="tv-rail-card ${tvCurrent()?.url===station.url?'active':''}" data-tv-url="${safe(station.url)}" aria-label="Play ${safe(station.name)}"><span class="tv-rail-logo">${station.logo?`<img src="${safe(station.logo)}" alt="">`:'TV'}</span><span class="tv-rail-copy"><b>${safe(station.name||'TV channel')}</b><small>${safe(station.country||station.group||'Live TV')}</small></span></button>`).join('')||'<span class="empty-note">No TV presets yet — save channels from Explore.</span>';
    target.querySelectorAll('[data-tv-url]').forEach(card=>card.addEventListener('click',()=>{const station=rows.find(s=>s.url===card.dataset.tvUrl);if(station)playTV(station);}));
    renderRemotePresets();const active=target.querySelector('.tv-rail-card.active');if(active)target.scrollTo({left:Math.max(0,active.offsetLeft-(target.clientWidth-active.offsetWidth)/2),behavior:'smooth'});
    if(!target.dataset.dragReady){target.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;dragState={x:event.clientX,left:target.scrollLeft,moved:false};target.setPointerCapture(event.pointerId);target.classList.add('dragging');});target.addEventListener('pointermove',event=>{if(!dragState)return;const d=event.clientX-dragState.x;if(Math.abs(d)>4)dragState.moved=true;if(dragState.moved){target.scrollLeft=dragState.left-d;event.preventDefault();}});const end=event=>{if(!dragState)return;if(dragState.moved){target.dataset.dragged='true';setTimeout(()=>delete target.dataset.dragged,120);}if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);dragState=null;target.classList.remove('dragging');};target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('click',event=>{if(target.dataset.dragged==='true'){event.preventDefault();event.stopPropagation();delete target.dataset.dragged;}},true);target.dataset.dragReady='true';}
  }
  function drawTV(){const station=tvCurrent();if(!station){$('tv-title').textContent='Choose a channel';$('tv-subtitle').textContent='Live channels from your presets';$('tv-star').textContent='☆';$('tv-star').classList.remove('saved');$('remote-favorite').classList.remove('saved');$('tv-placeholder').hidden=false;return;}$('tv-title').textContent=station.name||'Live TV';$('tv-subtitle').textContent=[station.country,station.group].filter(Boolean).join(' · ')||'Live television';const saved=Boolean(tvPresets[station.url]);$('tv-star').textContent=saved?'★':'☆';$('tv-star').classList.toggle('saved',saved);$('remote-favorite').classList.toggle('saved',saved);$('tv-placeholder').hidden=Boolean(video.currentSrc||video.src);renderTVRail();}
  function stopTV(){if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();$('tv-toggle').textContent='▶';drawTV();}
  async function playTV(station){
    if(!station)return;const rows=currentRows('tv');tvIndex=tvs.findIndex(s=>s.url===station.url);if(tvIndex<0){tvs.unshift(station);tvIndex=0;}if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();
    if(audio.src)stopRadio();
    const url=station.url||'';drawTV();$('tv-placeholder').hidden=true;
    if(/\.m3u8($|\?)/i.test(url)&&window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,maxBufferLength:15});hls.loadSource(url);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().then(()=>{$('tv-toggle').textContent='Ⅱ';}).catch(()=>notify('Press play on the video to start.')));hls.on(Hls.Events.ERROR,(_e,data)=>{if(data.fatal)notify('This channel is not available right now.');});}
    else{video.src=url;try{await video.play();$('tv-toggle').textContent='Ⅱ';}catch{notify('Press play on the video to start this channel.');}}
    drawTV();renderPresets();
  }
  function stepTV(direction){const rows=currentRows('tv');if(!rows.length)return;let i=rows.findIndex(s=>s.url===tvCurrent()?.url);i=(i+direction+rows.length)%rows.length;playTV(rows[i]);}
  async function toggleTVFullscreen(){if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}return;}if(video.requestFullscreen){try{await video.requestFullscreen();}catch{notify('Fullscreen is not available for this stream.');}}else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else notify('Fullscreen is not available for this stream.');}
  function updatePresetCounts(){$('preset-radio-count').textContent=String(Object.keys(radioPresets).length);$('preset-tv-count').textContent=String(Object.keys(tvPresets).length);}
  function renderPresets(){
    updatePresetCounts();const target=$('preset-grid'),rows=currentRows(presetMode);$('preset-priority-control').hidden=presetMode!=='tv';
    if(presetMode==='tv'&&(!rows.some(item=>item.url===selectedTVPresetKey)))selectedTVPresetKey=tvCurrent()?.url&&rows.some(item=>item.url===tvCurrent().url)?tvCurrent().url:rows[0]?.url||null;
    const selected=rows.find(item=>item.url===selectedTVPresetKey);$('preset-selection-label').textContent=selected?`SELECTED · ${selected.name||'TV CHANNEL'}`:'SELECT A TV CHANNEL';
    target.innerHTML=rows.map((station,index)=>{const title=station.name||'Untitled station',logo=presetMode==='tv'?station.logo:station.logo||station.favicon;return `<article class="preset-card ${presetMode==='tv'&&tvCurrent()?.url===station.url||presetMode==='radio'&&stationKey(radioCurrent()||{})===stationKey(station)?'active':''} ${presetMode==='tv'&&selectedTVPresetKey===station.url?'priority-selected':''}" tabindex="0" role="button" data-preset-index="${index}"><span class="channel-number">CH ${String(index+1).padStart(2,'0')}</span><button class="preset-star" type="button" data-preset-star="${safe(presetMode==='tv'?station.url:stationKey(station))}" aria-label="Remove preset">★</button><span class="preset-logo">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:safe(title.slice(0,11))}</span><b>${safe(title)}</b><small>${safe(station.country||station.group||'Live')}</small></article>`;}).join('')||'<div class="empty-note">No presets in this section yet. Save stations from Explore.</div>';
    target.querySelectorAll('[data-preset-index]').forEach(card=>{const station=rows[Number(card.dataset.presetIndex)];card.addEventListener('click',event=>{if(event.target.closest('[data-preset-star]'))return;if(presetMode==='tv')selectedTVPresetKey=station.url;renderPresets();if(presetMode==='tv')playTV(station);else{setScreen('radio-screen');playRadio(station);}});card.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===card){if(presetMode==='tv')selectedTVPresetKey=station.url;if(presetMode==='tv')playTV(station);else{setScreen('radio-screen');playRadio(station);}renderPresets();}});});
    target.querySelectorAll('[data-preset-star]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const station=rows.find(s=>(presetMode==='tv'?s.url:stationKey(s))===button.dataset.presetStar);if(station)togglePreset(presetMode,station);}));
  }
  function stationGenre(station,kind){
    const raw=kind==='tv'?(station.group||station.genre||station.category||station.tags):(station.genre||station.tags||station.group);
    const value=Array.isArray(raw)?raw.join(','):String(raw||'');
    if(value.trim())return value.split(/[;,|]/).map(part=>part.trim()).filter(Boolean)[0]||'Other';
    const name=String(station.name||'').toLowerCase();
    if(/news|bbc|cnn|ndtv|reuters|talk/.test(name))return 'News';
    if(/devotional|bhakti|spiritual|religious/.test(name))return 'Devotional';
    if(/music|fm|hits|retro|songs|radio/.test(name))return 'Music';
    if(/movie|cinema|film/.test(name))return 'Movies';
    return 'Other';
  }
  function populateExploreFilters(){
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets,rows=[...source,...Object.values(store)];
    const countries=browserSource==='online'&&onlineCountries.length?onlineCountries:[...new Set(rows.map(s=>String(s.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const genres=browserSource==='online'&&onlineGenres.length?onlineGenres:[...new Set(rows.map(s=>stationGenre(s,browserKind)))].sort((a,b)=>a.localeCompare(b));
    const replace=(id,items,label)=>{const select=$(id),old=select.value;select.innerHTML=`<option value="all">All ${label}</option>`+items.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(items.includes(old))select.value=old;};
    replace('explore-country',countries,'countries');replace('explore-genre',genres,'genres');
    $('explore-radio-count').textContent=String(new Set([...radios,...Object.values(radioPresets)].map(stationKey)).size);$('explore-tv-count').textContent=String(new Set([...tvs,...Object.values(tvPresets)].map(s=>s.url).filter(Boolean)).size);
  }
  async function fetchJson(url){const response=await fetch(url,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
  async function loadOnlineFilters(){
    $('discovery-status').textContent='Loading online filters…';
    try{
      if(browserKind==='radio'){
        const base='https://de1.api.radio-browser.info/json';
        const [countries,tags]=await Promise.all([fetchJson(`${base}/countries?order=stationcount&reverse=true&limit=250`),fetchJson(`${base}/tags?order=stationcount&reverse=true&limit=150`)]);
        onlineCountries=countries.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));onlineGenres=tags.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
      }else{
        const base='https://iptv-org.github.io/api';
        const [countries,categories]=await Promise.all([fetchJson(`${base}/countries.json`),fetchJson(`${base}/categories.json`)]);
        onlineCountries=countries.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));onlineGenres=categories.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
      }
      populateExploreFilters();$('discovery-status').textContent='Online catalog ready. Search by name or filter below.';
    }catch(error){$('discovery-status').textContent='Online filters could not load; search by name still works.';}
  }
  async function discoverOnline(loadMore=false){
    const query=$('explore-search').value.trim(),country=$('explore-country').value,genre=$('explore-genre').value;
    if(!loadMore){onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;}onlineSearchDone=true;
    $('discovery-status').textContent='Searching the online catalog…';$('explore-results').innerHTML='<div class="loading-note">Loading channels…</div>';
    try{
      if(browserKind==='radio'){
        const hosts=['https://de1.api.radio-browser.info/json','https://nl1.api.radio-browser.info/json'];let found=null,lastError;
        for(const base of hosts){try{const params=new URLSearchParams({limit:'100',offset:String(onlineOffset),order:'clickcount',reverse:'true',hidebroken:'true'});if(query)params.set('name',query);if(country!=='all')params.set('country',country);if(genre!=='all')params.set('tag',genre);found=await fetchJson(`${base}/stations/search?${params}`);break;}catch(error){lastError=error;}}
        if(!found)throw lastError||new Error('Radio catalog unavailable');
        const next=found.filter(s=>s.url_resolved||s.url).map(s=>({...s,_kind:'radio',url:s.url_resolved||s.url}));
        onlineRows=loadMore?[...onlineRows,...next.filter(x=>!onlineRows.some(y=>stationKey(y)===stationKey(x)))]:next;onlineHasMore=next.length===100;onlineOffset+=next.length;
      }else{
        if(!onlineTVCache){
          const base='https://iptv-org.github.io/api';$('discovery-status').textContent='Loading the global TV directory (first use may take a little longer)…';
          const [channels,streams,logos,countries,categories]=await Promise.all([fetchJson(`${base}/channels.json`),fetchJson(`${base}/streams.json`),fetchJson(`${base}/logos.json`),fetchJson(`${base}/countries.json`),fetchJson(`${base}/categories.json`)]);
          const countryNames=new Map(countries.map(c=>[c.code,c.name])),categoryNames=new Map(categories.map(c=>[c.id,c.name])),channelMap=new Map(channels.map(c=>[c.id,c])),logoMap=new Map();
          for(const logo of logos)if(logo.in_use&&!logoMap.has(logo.channel))logoMap.set(logo.channel,logo.url);
          onlineTVCache=streams.filter(s=>s.url&&s.channel&&channelMap.has(s.channel)).map(s=>{const c=channelMap.get(s.channel),genres=(c.categories||[]).map(id=>categoryNames.get(id)||id);return{name:s.title||c.name,channelName:c.name,alt_names:c.alt_names||[],country:countryNames.get(c.country)||c.country||'Unknown',countryCode:c.country||'',group:genres.join(', ')||'Other',tags:genres.join(','),genre:genres[0]||'Other',logo:logoMap.get(c.id)||'',url:s.url,quality:s.quality||'',labels:s.labels||[],_kind:'tv',is_nsfw:c.is_nsfw};}).filter(s=>!s.is_nsfw&&!/nsfw|adult/i.test(s.labels.join(' ')));
        }
        let filtered=onlineTVCache;
        if(query){const q=query.toLowerCase();filtered=filtered.filter(s=>`${s.name} ${s.channelName} ${s.alt_names.join(' ')} ${s.group} ${s.country}`.toLowerCase().includes(q));}
        if(country!=='all')filtered=filtered.filter(s=>s.country===country);
        if(genre!=='all')filtered=filtered.filter(s=>s.group.split(', ').includes(genre)||s.genre===genre);
        const collator=new Intl.Collator(undefined,{sensitivity:'base'});filtered.sort((a,b)=>collator.compare(a.country,b.country)||collator.compare(a.group,b.group)||collator.compare(a.name,b.name));
        onlineRows=filtered;onlineHasMore=filtered.length>100;
      }
      populateExploreFilters();$('discovery-status').textContent=`${onlineRows.length}${onlineHasMore?'+' : ''} online ${browserKind==='tv'?'TV streams':'radio stations'} found.`;renderExplore();
    }catch(error){onlineRows=[];$('discovery-status').textContent='Could not reach the online catalog. Check your connection and try again.';renderExplore();}
  }
  function renderExplore(){
    const q=$('explore-search').value.trim().toLowerCase(),country=$('explore-country').value,genre=$('explore-genre').value,sortBy=$('explore-sort').value;
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets;
    const keyOf=s=>browserKind==='tv'?s.url:stationKey(s),merged=new Map(source.map(s=>[keyOf(s),s]));
    for(const item of Object.values(store))if(item&&keyOf(item))merged.set(keyOf(item),item);
    let rows=browserSource==='online'?onlineRows.map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown'})):[...merged.values()].map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown'}));
    if(country!=='all')rows=rows.filter(s=>s._country===country);
    if(genre!=='all')rows=rows.filter(s=>[s._genre,...String(s.tags||'').split(/[;,|]/),...String(s.group||'').split(/[;,|]/),...(Array.isArray(s.categories)?s.categories:[])].some(value=>String(value).trim().toLowerCase()===genre.toLowerCase()));
    if(q)rows=rows.filter(s=>`${s.name||''} ${s._genre} ${s._country} ${s.tags||''} ${s.language||''} ${s.group||''}`.toLowerCase().includes(q));
    const groupKey=sortBy==='name'?null:sortBy==='country'?'_country':'_genre',collator=new Intl.Collator(undefined,{sensitivity:'base'});
    rows.sort((a,b)=>groupKey?collator.compare(a[groupKey],b[groupKey])||collator.compare(a.name||'',b.name||''):collator.compare(a.name||'',b.name||''));
    const visibleRows=browserSource==='online'&&browserKind==='tv'?rows.slice(0,onlineVisibleLimit):rows;
    const groups=new Map();for(const row of visibleRows){const heading=groupKey?row[groupKey]:'All channels';if(!groups.has(heading))groups.set(heading,[]);groups.get(heading).push(row);}
    const target=$('explore-results');let html='';
    for(const [heading,items] of groups){html+=`<h2 class="result-group-title">${safe(heading)} <small>${items.length}</small></h2>`;html+=items.map(s=>{const logo=browserKind==='tv'?s.logo:s.favicon||s.logo,key=keyOf(s),saved=Boolean(store[key]),quality=browserKind==='tv'?(s.quality||'LIVE'):[s.codec,s.bitrate?`${s.bitrate} kbps`:null].filter(Boolean).join(' · ')||'LIVE';return `<button class="result-row" type="button" data-result-kind="${browserKind}" data-result-key="${safe(key)}">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:`<span class="result-icon">${browserKind==='tv'?'▣':'♫'}</span>`}<span class="result-copy"><b>${safe(s.name||'Untitled channel')}</b><small>${safe(s._genre)} · ${safe(s._country)}</small></span><small class="result-quality">${safe(quality)}</small><b class="result-star">${saved?'★':'☆'}</b></button>`;}).join('');}
    if(!html&&browserSource==='online')html=`<div class="empty-note">${onlineSearchDone?'No channels match. Try another name, country, or genre.':'Choose filters, then search the online catalog to discover more channels.'}</div>`;
    if(!html&&browserSource==='library')html='<div class="empty-note">No channels match those filters.</div>';
    if(browserSource==='online'&&onlineHasMore&&(browserKind==='radio'||rows.length>visibleRows.length))html+='<button class="load-more-online" id="load-more-online" type="button">LOAD MORE CHANNELS</button>';
    target.innerHTML=html;
    $('browser-summary').textContent=`${browserSource==='online'&&browserKind==='tv'&&rows.length>visibleRows.length?`Showing ${visibleRows.length} of ${rows.length}`:rows.length} ${browserKind==='tv'?'TV channels':'radio stations'} · sorted by ${sortBy==='name'?'channel name':sortBy}`;
    target.querySelectorAll('[data-result-kind]').forEach(button=>button.addEventListener('click',()=>{const kind=button.dataset.resultKind,key=button.dataset.resultKey,sourceList=kind==='tv'?tvs:radios,station=sourceList.find(s=>(kind==='tv'?s.url:stationKey(s))===key)||Object.values(kind==='tv'?tvPresets:radioPresets).find(s=>(kind==='tv'?s.url:stationKey(s))===key)||onlineRows.find(s=>(kind==='tv'?s.url:stationKey(s))===key);if(!station)return;if(kind==='tv'){if(!tvPresets[station.url])togglePreset('tv',station);setScreen('tv-screen');playTV(station);}else{if(!radioPresets[stationKey(station)])togglePreset('radio',station);setScreen('radio-screen');playRadio(station);}}));
    $('load-more-online')?.addEventListener('click',()=>{if(browserKind==='radio')discoverOnline(true);else{onlineVisibleLimit+=100;renderExplore();}});
  }

  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>setScreen(button.dataset.screen)));
  let pageSwipeStart=null,suppressPresetSwipeClickUntil=0;
  document.addEventListener('click',event=>{if(Date.now()<suppressPresetSwipeClickUntil&&event.target.closest('#presets-screen')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.querySelectorAll('.screen').forEach(screen=>{
    screen.addEventListener('pointerdown',event=>{
      const onPresets=screen.id==='presets-screen',interactive=event.target.closest('button,input,select,textarea,a,video,.dial-wrap,.tv-rail,.explore-results');
      if(event.pointerType==='mouse'||event.target.closest('.priority-pad')||(interactive&&!onPresets)||(!onPresets&&event.target.closest('.preset-grid'))){pageSwipeStart=null;return;}
      pageSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId,screen:screen.id};
    });
    screen.addEventListener('pointerup',event=>{
      const start=pageSwipeStart;pageSwipeStart=null;if(!start||start.id!==event.pointerId||start.screen!==document.querySelector('.screen.active')?.id)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2){if(start.screen==='presets-screen')suppressPresetSwipeClickUntil=Date.now()+500;stepScreen(dx<0?1:-1);}
    });
    screen.addEventListener('pointercancel',()=>{pageSwipeStart=null;});
  });
  document.querySelectorAll('[data-preset-mode]').forEach(button=>button.addEventListener('click',()=>{presetMode=button.dataset.presetMode;document.querySelectorAll('[data-preset-mode]').forEach(item=>item.classList.toggle('selected',item===button));renderPresets();}));
  document.querySelectorAll('[data-glow-mode]').forEach(button=>{button.classList.toggle('selected',button.dataset.glowMode===glowMode);button.addEventListener('click',()=>{glowMode=button.dataset.glowMode;try{localStorage.setItem(GLOW_STORE,glowMode);}catch{}document.querySelectorAll('[data-glow-mode]').forEach(item=>item.classList.toggle('selected',item===button));});});
  document.querySelectorAll('[data-browser-kind]').forEach(button=>button.addEventListener('click',()=>{browserKind=button.dataset.browserKind;onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineCountries=[];onlineGenres=[];onlineSearchDone=false;document.querySelectorAll('[data-browser-kind]').forEach(item=>item.classList.toggle('selected',item===button));populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  document.querySelectorAll('[data-browser-source]').forEach(button=>button.addEventListener('click',()=>{browserSource=button.dataset.browserSource;document.querySelectorAll('[data-browser-source]').forEach(item=>item.classList.toggle('selected',item===button));$('online-search-row').hidden=browserSource!=='online';onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineSearchDone=false;populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  $('discover-online').addEventListener('click',()=>discoverOnline());
  $('explore-search').addEventListener('keydown',event=>{if(event.key==='Enter'&&browserSource==='online'){event.preventDefault();discoverOnline();}});
  $('explore-search').addEventListener('input',renderExplore);$('explore-country').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-genre').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-sort').addEventListener('change',renderExplore);
  $('radio-country').addEventListener('change',()=>{renderRadioDisplay();renderPresets();});
  $('tv-country').addEventListener('change',()=>{renderTVRail();renderPresets();});
  $('radio-play').addEventListener('click',toggleRadio);$('radio-prev').addEventListener('click',()=>stepRadio(-1));$('radio-next').addEventListener('click',()=>stepRadio(1));
  $('radio-star').addEventListener('click',()=>{const station=radioCurrent();if(station)togglePreset('radio',station);});
  $('radio-volume').addEventListener('input',event=>setRadioVolume(event.target.value));
  const volumeDial=document.querySelector('.dial-wrap');
  volumeDial.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();volumeDial.setPointerCapture(event.pointerId);setVolumeFromDialPointer(event);});
  volumeDial.addEventListener('pointermove',event=>{if(volumeDial.hasPointerCapture(event.pointerId))setVolumeFromDialPointer(event);});
  $('tv-star').addEventListener('click',()=>{const station=tvCurrent();if(station)togglePreset('tv',station);});
  $('tv-prev').addEventListener('click',()=>stepTV(-1));$('tv-next').addEventListener('click',()=>stepTV(1));$('tv-toggle').addEventListener('click',()=>{if(!video.src&&!video.currentSrc){const rows=currentRows('tv');if(rows.length)playTV(rows[0]);return;}if(video.paused)video.play().then(()=>{$('tv-toggle').textContent='Ⅱ';}).catch(()=>notify('Press play on the video.'));else video.pause();});
  document.querySelectorAll('[data-remote]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.remote;
    if(action==='vol-up'||action==='vol-down'){video.muted=false;video.volume=Math.min(1,Math.max(0,video.volume+(action==='vol-up' ? 0.1 : -0.1)));return;}
    if(action==='channel-up'){stepTV(1);return;}if(action==='channel-down'){stepTV(-1);return;}
    if(action==='play-pause'){$('tv-toggle').click();return;}
    if(action==='favorite'){$('tv-star').click();return;}
    if(action==='mute'){video.muted=!video.muted;button.classList.toggle('muted',video.muted);button.setAttribute('aria-label',video.muted?'Unmute':'Mute');return;}
    if(action==='fullscreen'){toggleTVFullscreen();return;}
    if(action==='power')stopTV();
  }));
  $('remote-channel-select').addEventListener('change',event=>{const station=currentRows('tv').find(item=>item.url===event.target.value);if(station)playTV(station);});
  document.querySelectorAll('[data-rail-scroll]').forEach(button=>button.addEventListener('click',()=>$('tv-rail').scrollBy({left:Number(button.dataset.railScroll)*190,behavior:'smooth'})));
  document.querySelectorAll('[data-priority-x]').forEach(button=>{
    const move=()=>moveSelectedTVPreset(Number(button.dataset.priorityX),Number(button.dataset.priorityY));let holdDelay=null,repeatTimer=null;
    const stopRepeat=()=>{clearTimeout(holdDelay);clearInterval(repeatTimer);holdDelay=repeatTimer=null;};
    button.addEventListener('pointerdown',()=>{move();holdDelay=setTimeout(()=>{repeatTimer=setInterval(move,220);},360);});
    ['pointerup','pointercancel','pointerleave','blur'].forEach(name=>button.addEventListener(name,stopRepeat));
    button.addEventListener('click',event=>{if(event.detail===0)move();});
  });
  audio.addEventListener('play',()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';drawRadio();startSoundRays();});audio.addEventListener('pause',()=>{stopSoundRays();$('equalizer').classList.remove('playing');$('radio-art').classList.remove('playing');$('radio-play').textContent='▶';$('radio-play').title='Play';drawRadio();});audio.addEventListener('error',()=>{if(audio.src)notify('This station stream could not be reached.');});
  video.addEventListener('play',()=>{$('tv-toggle').textContent='Ⅱ';$('remote-main-play').classList.add('playing');$('tv-placeholder').hidden=true;});video.addEventListener('pause',()=>{$('tv-toggle').textContent='▶';$('remote-main-play').classList.remove('playing');});video.addEventListener('error',()=>{if(video.currentSrc)notify('This TV stream could not be reached.');});
  document.addEventListener('keydown',event=>{if(event.code==='Space'&&document.activeElement?.tagName!=='INPUT'){event.preventDefault();if(!$('radio-screen').classList.contains('active'))$('tv-toggle').click();else toggleRadio();}if(event.key==='ArrowRight'&&$('tv-screen').classList.contains('active'))stepTV(1);if(event.key==='ArrowLeft'&&$('tv-screen').classList.contains('active'))stepTV(-1);});
  const volume=Number(loadStore(VOLUME_STORE,30));setRadioVolume(Number.isFinite(volume)?Math.min(40,Math.max(0,volume)):30);
  let pendingInstallPrompt=null;const installButton=$('install-app'),installedModes=['standalone','minimal-ui','fullscreen','window-controls-overlay'].map(mode=>window.matchMedia(`(display-mode: ${mode})`));
  const installedBefore=()=>{try{return localStorage.getItem('retrotvra.installed.v1')==='true';}catch{return false;}};
  const isInstalledApp=()=>Boolean(navigator.standalone)||installedModes.some(query=>query.matches)||installedBefore();
  const updateInstallButton=()=>{if(isInstalledApp()){installButton.hidden=true;pendingInstallPrompt=null;}else installButton.hidden=false;};
  updateInstallButton();installedModes.forEach(query=>query.addEventListener?.('change',updateInstallButton));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();try{localStorage.removeItem('retrotvra.installed.v1');}catch{}pendingInstallPrompt=event;if(!installedModes.some(query=>query.matches)&&!navigator.standalone){installButton.hidden=false;installButton.classList.add('install-ready');}});
  window.addEventListener('appinstalled',()=>{pendingInstallPrompt=null;installButton.classList.remove('install-ready');installButton.hidden=true;try{localStorage.setItem('retrotvra.installed.v1','true');}catch{}notify('COOLmagRaTv added to your home screen.');});
  installButton.addEventListener('click',async()=>{
    if(pendingInstallPrompt){pendingInstallPrompt.prompt();const choice=await pendingInstallPrompt.userChoice;pendingInstallPrompt=null;if(choice.outcome==='accepted')installButton.classList.remove('install-ready');return;}
    if(window.matchMedia('(display-mode:standalone)').matches||navigator.standalone){notify('COOLmagRaTv is already installed.');return;}
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){notify('In Safari, tap Share, then Add to Home Screen.');return;}
    notify('Open the browser menu and choose Install app or Add to Home Screen.');
  });
  if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});}
  formatClock();setInterval(formatClock,30000);fetchData();
})();
