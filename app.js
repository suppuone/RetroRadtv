(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stationLogo = station => String(station?.logo||station?.favicon||station?.image||station?.['tvg-logo']||station?.tvg_logo||station?.icon||'').trim();
  const initialsFor = title => String(title||'LIVE').trim().split(/\s+/).filter(Boolean).slice(0,3).map(word=>word[0]).join('').toUpperCase()||'TV';
  function logoInitials(image){const card=image.closest('.radio-mini-card,.tv-rail-card,.preset-card,.result-row'),title=card?.querySelector('.radio-mini-card b,.tv-rail-copy b,.preset-card>b,.result-copy b')?.textContent||$('radio-title')?.textContent||'LIVE';return initialsFor(title);}
  document.addEventListener('error',event=>{const image=event.target;if(!image||image.tagName!=='IMG')return;const source=image.currentSrc||image.src;if(/^http:\/\//i.test(source)&&image.dataset.httpsRetry!=='1'){image.dataset.httpsRetry='1';image.src=source.replace(/^http:/i,'https:');return;}const fallback=document.createElement('span');if(image.classList.contains('station-logo-badge')){fallback.className='station-logo-fallback';fallback.textContent=logoInitials(image);}else{fallback.className='logo-fallback';fallback.textContent=logoInitials(image);}image.replaceWith(fallback);},true);
  const RADIO_STORE='retrotvra.radio-presets.v1',TV_STORE='retrotvra.tv-presets.v1',TV_ORDER_STORE='retrotvra.tv-order.v1',RADIO_HIDDEN_STORE='retrotvra.radio-hidden.v1',TV_HIDDEN_STORE='retrotvra.tv-hidden.v1',VOLUME_STORE='retrotvra.volume.v1',THEME_STORE='retrotvra.theme.v2',RADIO_SKIN_STORE='retrotvra.radio-skin.v1',LEGACY_THEME_ENABLED_STORE='retrotvra.legacy-theme-enabled.v1',THEME_SWITCH_ENABLED_STORE='retrotvra.theme-switch-enabled.v1',RECENT_STORE='retrotvra.recent.v2';
  let radios=[],tvs=[],radioPresets={},tvPresets={},recentHistory=[],radioIndex=-1,tvIndex=-1,presetMode='radio',selectedTVPresetKey=null,browserKind='radio',browserSource='library',onlineRows=[],onlineTVCache=null,onlineCountries=[],onlineGenres=[],onlineOffset=0,onlineVisibleLimit=100,onlineHasMore=false,onlineSearchDone=false,hls=null,radioHls=null,currentRadioSource='',toastTimer=null,dragState=null,languageCatalog=[],languageNameByCode=new Map(),languageNameByKey=new Map();
  const audio=$('radio-audio'),video=$('tv-video');
  const THEME_GLOW={retro:'warm',modern:'white',ultra:'color'};
  let legacyThemeEnabled=false,themeSwitchEnabled=true;
  try{const legacySetting=localStorage.getItem(LEGACY_THEME_ENABLED_STORE),themeSetting=localStorage.getItem(THEME_SWITCH_ENABLED_STORE);if(legacySetting!==null)legacyThemeEnabled=legacySetting==='true';if(themeSetting!==null)themeSwitchEnabled=themeSetting==='true';}catch{}
  let radioSkin='modern';try{radioSkin=localStorage.getItem(RADIO_SKIN_STORE)==='legacy'?'legacy':'modern';}catch{}
  if(!legacyThemeEnabled)radioSkin='modern';
  document.body.dataset.radioSkin=radioSkin;
  let themeMode='retro';try{themeMode=localStorage.getItem(THEME_STORE)||'retro';}catch{}
  if(!['retro','modern','ultra'].includes(themeMode))themeMode='retro';
  let glowMode=THEME_GLOW[themeMode];
  const DEFAULT_TV_DEMO={name:'BBC News (demo stream)',group:'World News · Demo',country:'United Kingdom',url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',logo:'',demoAutoStart:true};
  let defaultTVAutoMuted=false;
  let meterAudio=null,meterContext=null,meterAnalyser=null,meterGain=null,meterSource=null,meterBins=null,meterFrame=0,meterLevel=0,meterLastPaint=0;
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
        meterLevel+=(energy-meterLevel)*(energy>meterLevel?.40:.14);
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const phase=reduced?0:t;
        const baseline=h-2;
        const gradient=c.createLinearGradient(0,h*.64,w,h);
        gradient.addColorStop(0,'#7762b7');gradient.addColorStop(.45,'#329bc8');gradient.addColorStop(1,'#36c4df');
        c.globalCompositeOperation='lighter';c.strokeStyle=gradient;
        const lines=reduced?16:32,steps=140;
        for(let layer=0;layer<2;layer++){
          for(let line=0;line<lines;line++){
            const strand=line/(lines-1);
            c.beginPath();
            for(let step=0;step<=steps;step++){
              const u=step/steps,x=u*w;
              const sample=hasSignal?meterBins[Math.min(meterBins.length-1,Math.floor(u*150))]/255:meterLevel;
              const shape=Math.pow(Math.max(0,Math.sin(u*Math.PI*3.2-phase*.65+layer*1.6+strand*.5)),2);
              const secondary=.5+.5*Math.sin(u*Math.PI*6+phase*.42+strand);
              const amplitude=h*(.12+Math.min(.8,meterLevel)*.15+sample*.08);
              const y=baseline-shape*(.3+strand*.7)*amplitude*(.65+secondary*.35);
              if(step===0)c.moveTo(x,y);else c.lineTo(x,y);
            }
            c.globalAlpha=.17+strand*.20;c.lineWidth=.8;c.shadowColor='#35b6d9';c.shadowBlur=line%8===0?4:0;c.stroke();
          }
        }
        c.shadowBlur=0;
        c.globalAlpha=1;c.globalCompositeOperation='source-over';meterFrame=requestAnimationFrame(draw);
      };
      draw();
    }

  }

  function loadStore(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}
  function setRadioVolume(level,persist=true){const value=Math.max(0,Math.min(100,Math.round(Number(level)||0)));$('radio-volume').value=String(value);$('radio-volume').style.setProperty('--volume-fill',`${value}%`);$('radio-volume-track').style.setProperty('--volume-angle',`${-135+value*2.7}deg`);audio.volume=value/100;$('volume-number').textContent=String(value);if(persist)saveStore(VOLUME_STORE,value);}
  function toggleRadioSkin(){if(!legacyThemeEnabled)return;radioSkin=radioSkin==='legacy'?'modern':'legacy';document.body.dataset.radioSkin=radioSkin;try{localStorage.setItem(RADIO_SKIN_STORE,radioSkin);}catch{}notify(radioSkin==='legacy'?'Version 1 radio look enabled':'Version 2 radio look enabled');}
  // Theme switching is deliberately presentation-only: it does not navigate,
  // reload, or touch either live media element, so the current stream continues.
  function applyTheme(value,force=false){if(!themeSwitchEnabled&&!force){const select=$('theme-choice');if(select)select.value=themeMode;return;}themeMode=['retro','modern','ultra'].includes(value)?value:'retro';glowMode=THEME_GLOW[themeMode];document.body.dataset.theme=themeMode;document.body.dataset.glow=glowMode;const select=$('theme-choice');if(select)select.value=themeMode;try{localStorage.setItem(THEME_STORE,themeMode);}catch{}}
  function syncThemeSettings(){const legacy=$('legacy-theme-enabled'),theme=$('theme-switch-enabled'),picker=$('theme-choice');legacy.checked=legacyThemeEnabled;theme.checked=themeSwitchEnabled;picker.disabled=!themeSwitchEnabled;document.body.dataset.themeSwitch=themeSwitchEnabled?'on':'off';}
  function setLegacyThemeEnabled(enabled){legacyThemeEnabled=Boolean(enabled);try{localStorage.setItem(LEGACY_THEME_ENABLED_STORE,String(legacyThemeEnabled));}catch{}if(!legacyThemeEnabled){legacyRadioTapCount=0;clearTimeout(legacyRadioTapTimer);if(radioSkin==='legacy'){radioSkin='modern';document.body.dataset.radioSkin='modern';try{localStorage.setItem(RADIO_SKIN_STORE,'modern');}catch{}}}}
  function setThemeSwitchEnabled(enabled){themeSwitchEnabled=Boolean(enabled);try{localStorage.setItem(THEME_SWITCH_ENABLED_STORE,String(themeSwitchEnabled));}catch{}syncThemeSettings();}
  function saveStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('This browser could not save your presets.');}}
  function stationKey(item){return String(item?.stationuuid||item?.url_resolved||item?.url||item?.name||'');}
  function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  let closeSplash=()=>{};
  function addFestivalGreeting(splash,customOccasions=[]){
    const now=new Date(),month=String(now.getMonth()+1).padStart(2,'0'),day=String(now.getDate()).padStart(2,'0'),key=`${month}-${day}`,year=now.getFullYear();
    const diwaliDates={2026:'11-08',2027:'10-29',2028:'10-17',2029:'11-05',2030:'10-26'};
    const pongalDates={2026:'01-14',2027:'01-15',2028:'01-15',2029:'01-14',2030:'01-14'};
    const withinFestivalDays=(dateKey,before,after)=>{if(!dateKey)return false;const [m,d]=dateKey.split('-').map(Number),festivalDay=Date.UTC(year,m-1,d),today=Date.UTC(year,now.getMonth(),now.getDate()),offset=Math.round((today-festivalDay)/86400000);return offset>=-before&&offset<=after;};
    let greeting='',festive=false;
    const todayUtc=Date.UTC(year,now.getMonth(),now.getDate());
    for(const occasion of Array.isArray(customOccasions)?customOccasions:[]){
      const match=String(occasion?.date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),text=String(occasion?.text||'').trim();if(!match||!text)continue;
      const eventMonth=Number(match[2])-1,eventDay=Number(match[3]);if(eventMonth<0||eventMonth>11||eventDay<1||eventDay>31)continue;
      const validated=new Date(Date.UTC(Number(match[1]),eventMonth,eventDay));if(validated.getUTCMonth()!==eventMonth||validated.getUTCDate()!==eventDay)continue;
      const eventUtc=Date.UTC(Number(match[1]),eventMonth,eventDay);
      if(todayUtc===eventUtc){greeting=text.slice(0,60);festive=true;break;}
    }
    if(!greeting&&key==='12-25'){greeting='HAPPY CHRISTMAS';festive=true;}
    else if(!greeting&&key==='01-01'){greeting='HAPPY NEW YEAR';festive=true;}
    else if(!greeting&&withinFestivalDays(pongalDates[year],0,0)){greeting='HAPPY PONGAL';festive=true;}
    else if(!greeting&&withinFestivalDays(diwaliDates[year],0,0)){greeting='HAPPY DEEPAVALI';festive=true;}
    else if(!greeting){const hour=now.getHours();greeting=hour<12?'GOOD MORNING':hour<17?'GOOD AFTERNOON':'GOOD EVENING';}
    const card=$('card');if(!card)return false;
    const existing=$('cardContainer')?.querySelector('.festival-orbit, .splash-greeting-large');
    if(existing){
      if(existing.matches('.festival-orbit')){existing.dataset.greeting=greeting;const node=existing.querySelector('textPath')?.firstChild;if(node?.nodeType===Node.TEXT_NODE)node.nodeValue=greeting;}
      else existing.textContent=greeting;
      return festive;
    }
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('class','festival-orbit');svg.dataset.greeting=greeting;svg.setAttribute('viewBox','0 0 420 420');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(ns,'path');path.setAttribute('id','festival-orbit-path');path.setAttribute('d','M 48 14 H 372 A 34 34 0 0 1 406 48 V 372 A 34 34 0 0 1 372 406 H 48 A 34 34 0 0 1 14 372 V 48 A 34 34 0 0 1 48 14 Z');path.setAttribute('d',Array(3).fill(path.getAttribute('d')).join(' '));svg.append(path);
    const text=document.createElementNS(ns,'text'),textPath=document.createElementNS(ns,'textPath');textPath.setAttribute('href','#festival-orbit-path');textPath.setAttribute('startOffset','70.233333%');textPath.setAttribute('text-anchor','middle');textPath.textContent=greeting;
    const animate=document.createElementNS(ns,'animate');animate.setAttribute('begin','indefinite');animate.setAttribute('attributeName','startOffset');animate.setAttribute('from','70.233333%');animate.setAttribute('to','36.9%');animate.setAttribute('dur','5s');animate.setAttribute('calcMode','linear');animate.setAttribute('fill','freeze');animate.addEventListener('endEvent',()=>{if(!svg.isConnected)return;const label=document.createElement('div');label.className='splash-greeting-large';label.textContent=svg.dataset.greeting;svg.replaceWith(label);});textPath.append(animate);text.append(textPath);svg.append(text);$('cardContainer')?.append(svg);animate.beginElement();return festive;
  }
  function startSplashConfetti(splash,festive=false){
    const canvas=$('splash-confetti'),ctx=canvas?.getContext('2d');if(!canvas||!ctx)return()=>{};
    const colors=['#06b6d4','#3b82f6','#8b5cf6','#ec4899','#fbbf24','#ffffff'];let width=0,height=0,raf=0,last=0,nextRocketAt=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rockets=[],sparks=[];
    function resize(){const dpr=Math.min(devicePixelRatio||1,1.5),rect=splash.getBoundingClientRect();width=rect.width;height=rect.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
    function launchRocket(){const splashRect=splash.getBoundingClientRect(),card=$('card')?.getBoundingClientRect(),left=card?card.left-splashRect.left:width*.2,right=card?card.right-splashRect.left:width*.8,bottom=card?card.bottom-splashRect.top:height*.75,side=Math.random()<.5?'left':'right',x=side==='left'?Math.max(7,left-9):Math.min(width-7,right+9),y=Math.min(height-12,bottom-15-Math.random()*Math.min(70,height*.1));rockets.push({x,y,vx:(side==='left'?-1:1)*(.2+Math.random()*1.2),vy:-(8+Math.random()*4),life:20+Math.random()*12,color:colors[Math.floor(Math.random()*colors.length)]});nextRocketAt=performance.now()+(reduced?950:420+Math.random()*260);}
    function explode(rocket){const rayCount=reduced?42:68,baseAngle=Math.random()*Math.PI*2;for(let i=0;i<rayCount;i++){const angle=baseAngle+Math.PI*2*i/rayCount+(Math.random()-.5)*.09,speed=3+Math.random()*5.8,life=30+Math.random()*28;sparks.push({ox:rocket.x,oy:rocket.y,x:rocket.x,y:rocket.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:.8+Math.random()*1.6,color:Math.random()<.18?'#ffffff':colors[Math.floor(Math.random()*colors.length)],life,maxLife:life});}}
    function draw(time=0){
      if(!splash.isConnected)return;if(time-last<16){raf=requestAnimationFrame(draw);return;}last=time;
      if(performance.now()>nextRocketAt)launchRocket();
      ctx.clearRect(0,0,width,height);
      const active=[];for(const r of rockets){ctx.save();ctx.strokeStyle=r.color;ctx.lineWidth=2.5;ctx.lineCap='round';ctx.globalAlpha=.95;ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-r.vx*2.3,r.y-r.vy*2.3);ctx.stroke();ctx.restore();r.x+=r.vx;r.y+=r.vy;r.vy+=.12;if(--r.life>0)active.push(r);else explode(r);}rockets=active;
      sparks=sparks.filter(p=>p.life>0);for(const p of sparks){ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.strokeStyle=p.color;ctx.lineWidth=p.size;ctx.lineCap='round';ctx.shadowColor=p.color;ctx.shadowBlur=3;ctx.beginPath();ctx.moveTo(p.ox,p.oy);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.vx*=.992;p.life--;}
      raf=requestAnimationFrame(draw);
    }
    resize();draw();window.addEventListener('resize',resize);const stop=()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);rockets=[];sparks=[];ctx.clearRect(0,0,width,height);};stop.setFestive=value=>{festive=Boolean(value);};return stop;
  }
  function initSplash(){
    const splash=$('welcome-splash-v2'),button=$('splash-v2-continue'),card=$('card');if(!splash||!button)return;const splashStartedAt=performance.now();
    const festive=addFestivalGreeting(splash);let dismissed=false,finishTimer=0;const stopConfetti=startSplashConfetti(splash,festive);const finish=(immediate=false)=>{if(dismissed)return;if(immediate){clearTimeout(finishTimer);dismissed=true;stopConfetti();document.removeEventListener('keydown',escapeSplash);splash.classList.add('leaving');window.setTimeout(()=>splash.remove(),360);return;}const remaining=8000-(performance.now()-splashStartedAt);if(remaining>0){clearTimeout(finishTimer);finishTimer=window.setTimeout(()=>finish(),remaining);return;}clearTimeout(finishTimer);dismissed=true;stopConfetti();document.removeEventListener('keydown',escapeSplash);splash.classList.add('leaving');window.setTimeout(()=>splash.remove(),360);};const escapeSplash=event=>{if(event.key==='Escape'){event.preventDefault();finish(true);}};closeSplash=finish;card?.addEventListener('click',()=>finish(true));document.addEventListener('keydown',escapeSplash);finishTimer=window.setTimeout(()=>finish(),8000);
    fetch('data/app-settings.json',{cache:'no-cache'}).then(response=>response.ok?response.json():null).then(settings=>{if(settings){const config=settings?.splash||{};
        const festiveFromSettings=addFestivalGreeting(splash,config.occasions||[]);stopConfetti.setFestive?.(festiveFromSettings);
        if(config.title)$('splash-v2-title').textContent=config.title;
        if(config.line1)$('splash-v2-line1').textContent=config.line1;
        if(config.line2)$('splash-v2-line2').textContent=config.line2;
        if(/^#[0-9a-f]{6}$/i.test(config.backgroundColor||''))splash.style.setProperty('--splash-bg',config.backgroundColor);
        if(/^#[0-9a-f]{6}$/i.test(config.textColor||''))splash.style.setProperty('--splash-text',config.textColor);
        if(/^#[0-9a-f]{6}$/i.test(config.accentColor||''))splash.style.setProperty('--splash-accent',config.accentColor);
        if(config.logo){const image=$('splash-v2-logo-image');image.onload=()=>{image.hidden=false;$('splash-v2-default-icon').hidden=true;};image.onerror=()=>{image.hidden=true;$('splash-v2-default-icon').hidden=false;};image.src=/^(https?:|data:image\/)/i.test(config.logo)?config.logo:new URL(config.logo,document.baseURI).href;}
      }}).catch(()=>{});
  }
  function formatClock(){const d=new Date();$('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}).toUpperCase();const day=$('radio-clock-day');if(day){day.textContent=d.toLocaleDateString([], {weekday:'short'}).slice(0,2);const time=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',hour12:true}).match(/^(.+?)\s*(AM|PM)$/i);$('radio-clock-time').textContent=time?time[1]:d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});$('radio-clock-meridiem').textContent=time?time[2].toUpperCase():'';$('radio-clock-date').textContent=d.toLocaleDateString([], {month:'short',day:'2-digit',year:'numeric'}).toUpperCase();}}
  initSplash();
  const hinduRssUrl='https://www.thehindu.com/news/national/feeder/default.rss';
  function setRadioNews(headlines){
    const track=$('radio-news-track');if(!track)return;
    const clean=(headlines||[]).map(item=>String(item||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,12);
    const items=clean.length?clean:['Latest national headlines will appear when the feed is reachable'];
    const group=items.map(headline=>`<span class="ticker-headline">${safe(headline)}</span>`).join('');
    track.innerHTML=`<div class="ticker-marquee"><div class="ticker-group">${group}</div><div class="ticker-group" aria-hidden="true">${group}</div></div>`;
    track.classList.toggle('ticker-static',!clean.length);
  }
  async function loadRadioNews(){
    const rss2json=`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(hinduRssUrl)}`;
    try{
      const response=await fetch(rss2json,{cache:'no-store'});if(!response.ok)throw new Error(`RSS service returned ${response.status}`);
      const data=await response.json();const headlines=(data.items||[]).map(item=>item.title);if(!headlines.length)throw new Error('No news items in feed');setRadioNews(headlines);
    }catch(error){console.warn('Could not refresh The Hindu ticker:',error);setRadioNews([]);}
  }
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
    const storedRecent=loadStore(RECENT_STORE,[]);recentHistory=Array.isArray(storedRecent)?storedRecent.filter(item=>item&&item.url&&item.name).slice(0,40):[];
    saveStore(RADIO_STORE,radioPresets);saveStore(TV_STORE,tvPresets);
    fillCountries();populateExploreFilters();renderPresets();renderTVRail();renderRemotePresets();renderRadioDisplay();renderExplore();
  }
  function listFor(kind){return kind==='tv'?Object.values(tvPresets):Object.values(radioPresets);}
  function selectedCountry(kind){return $(kind==='tv'?'tv-country':'radio-country')?.value||'all';}
  function currentRows(kind){const rows=listFor(kind);const country=selectedCountry(kind);return rows.filter(item=>country==='all'||String(item.country||'').toLowerCase()===country.toLowerCase());}
  function setScreen(screenId){
    if(screenId==='tv-screen'&&(audio.src||radioHls))stopRadio();
    if(screenId==='radio-screen'&&(video.src||video.currentSrc))stopTV();
    document.querySelectorAll('.screen').forEach(node=>node.classList.toggle('active',node.id===screenId));
    document.querySelectorAll('.nav-item').forEach(node=>node.classList.toggle('active',node.dataset.screen===screenId));
    document.querySelectorAll('[data-mode-screen]').forEach(node=>{const active=node.dataset.modeScreen===screenId;node.classList.toggle('selected',active);node.setAttribute('aria-selected',String(active));});
    $('mode-label').textContent=screenId==='radio-screen'?'◉ RADIO MODE':screenId==='tv-screen'?'▣ TV MODE':screenId==='presets-screen'?'★ YOUR PRESETS':'⌕ EXPLORE';
    if(screenId==='presets-screen')renderPresets();
    if(screenId==='tv-screen')queueMicrotask(()=>{if(document.querySelector('.screen.active')?.id!=='tv-screen'||hls||video.src||video.currentSrc)return;playTV(DEFAULT_TV_DEMO);});
  }
  function stepScreen(direction){const order=['radio-screen','tv-screen','presets-screen','explore-screen'],active=document.querySelector('.screen.active')?.id,index=Math.max(0,order.indexOf(active));setScreen(order[(index+direction+order.length)%order.length]);}
  function radioCurrent(){return radios[radioIndex]||null;}
  function tvCurrent(){return tvs[tvIndex]||null;}
  function drawRadio(){
    const station=radioCurrent(),art=$('radio-art');art.classList.toggle('playing',!audio.paused);
    if(!station){art.innerHTML='<div class="radio-dot-texture" aria-hidden="true"></div><div class="record-mark"><span class="radio-signal-icon" aria-hidden="true">◉</span><b class="radio-center-title">Choose a station</b><small class="radio-center-country">WORLD RADIO</small><div class="record-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';art.classList.toggle('glow-off',glowMode==='off');$('radio-status').textContent='READY · SELECT A PRESET OR EXPLORE';formatClock();return;}
    const key=stationKey(station),saved=Boolean(radioPresets[key]),logo=stationLogo(station),stationName=station.name||'Internet Radio',name=safe(stationName),country=safe(station.country||'WORLD RADIO'),details=safe([station.country||'Internet radio',station.codec||'LIVE',station.bitrate?`${station.bitrate} KBPS`:null].filter(Boolean).join(' · '));
    const starHTML='<button class="mini-star '+(saved?'saved':'')+'" id="radio-star" aria-label="'+(saved?'Remove station from':'Add station to')+' presets">'+(saved?'★':'☆')+'</button>';
    art.style.backgroundImage='radial-gradient(circle at 50% 48%,#343438,#15171a 68%,#0d0f12)';art.innerHTML='<div class="radio-dot-texture" aria-hidden="true"></div><canvas class="sound-rays" id="sound-rays" aria-hidden="true"></canvas><div class="radio-glow-bloom" aria-hidden="true"></div><div class="radio-glow-ring" aria-hidden="true"></div><div class="speaker-aura" aria-hidden="true"></div><div class="speaker-cone" aria-hidden="true"></div><div class="record-mark"><span class="radio-signal-icon" aria-hidden="true">◉</span><b class="radio-center-title">'+name+'</b><small class="radio-center-country">'+country+'</small><div class="record-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="radio-art-caption">'+starHTML+'<div><h1 id="radio-title">'+name+'</h1><p id="radio-subtitle">'+details+'</p></div></div>';art.classList.toggle('glow-off',glowMode==='off');
    $('radio-status').textContent=audio.paused?'READY · PRESS PLAY TO LISTEN':'TUNED IN · LIVE RADIO';formatClock();
  }
  function updateRadioShortcutFocus(target){
    const cards=[...target.querySelectorAll('.radio-mini-card')];if(!cards.length)return;
    const bounds=target.getBoundingClientRect(),center=bounds.left+bounds.width/2,reach=Math.max(1,bounds.width*.65);
    for(const card of cards){const rect=card.getBoundingClientRect(),distance=Math.abs(rect.left+rect.width/2-center),focus=Math.max(0,1-distance/reach);card.style.setProperty('--rail-scale',(0.52+focus*.68+(card.classList.contains('active')?.10:0)).toFixed(3));card.style.setProperty('--rail-opacity',(0.45+focus*.55).toFixed(3));card.style.zIndex=String(Math.round(focus*10));}
  }
  function renderRadioShortcuts(){const target=$('radio-station-strip');if(!target)return;const rows=currentRows('radio').slice(0,10);const current=radioCurrent();if(current&&!rows.some(row=>stationKey(row)===stationKey(current)))rows.unshift(current);target.innerHTML=rows.map((station,index)=>{const logo=stationLogo(station),name=station.name||'Radio';return `<button type="button" class="radio-mini-card ${radioCurrent()&&stationKey(radioCurrent())===stationKey(station)?'active':''}" data-radio-shortcut="${index}" title="${safe(name)}" aria-label="Play ${safe(name)}"><span class="radio-mini-logo">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:`<span class="logo-fallback">${safe(initialsFor(name))}</span>`}</span><b>${safe(name)}</b></button>`;}).join('')||'<span class="empty-note">Save stations in Explore to add quick tune cards.</span>';target.querySelectorAll('[data-radio-shortcut]').forEach(button=>button.addEventListener('click',()=>{if(target.dataset.dragged==='true'){delete target.dataset.dragged;return;}const station=rows[Number(button.dataset.radioShortcut)];if(station)playRadio(station);}));
    if(!target.dataset.autoTuneReady){
      let settleTimer=0;
      target.addEventListener('scroll',()=>{
        clearTimeout(settleTimer);
        settleTimer=setTimeout(()=>{
          if(target.classList.contains('dragging')||!$('radio-screen').classList.contains('active'))return;
          const center=target.scrollLeft+target.clientWidth/2;
          const cards=[...target.querySelectorAll('[data-radio-shortcut]')];
          const nearest=cards.sort((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-center)-Math.abs(b.offsetLeft+b.offsetWidth/2-center))[0];
          if(nearest&&!nearest.classList.contains('active'))nearest.click();
        },320);
      },{passive:true});
      target.dataset.autoTuneReady='true';
    }
    if(!target.dataset.focusEffectReady){target.addEventListener('scroll',()=>requestAnimationFrame(()=>updateRadioShortcutFocus(target)),{passive:true});window.addEventListener('resize',()=>updateRadioShortcutFocus(target));target.dataset.focusEffectReady='true';}
    requestAnimationFrame(()=>{const active=target.querySelector('.radio-mini-card.active');if(active){const rail=target.getBoundingClientRect(),card=active.getBoundingClientRect();target.scrollTo({left:Math.max(0,active.offsetLeft-(target.clientWidth-active.offsetWidth)/2),behavior:'smooth'});}updateRadioShortcutFocus(target);});
    if(!target.dataset.desktopScrollReady){let drag=null;target.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&target.scrollWidth>target.clientWidth){target.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});target.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;drag={x:event.clientX,left:target.scrollLeft,moved:false,pointerId:event.pointerId,captured:false};});target.addEventListener('pointermove',event=>{if(!drag)return;const delta=event.clientX-drag.x;if(Math.abs(delta)>5&&!drag.moved){drag.moved=true;try{target.setPointerCapture(drag.pointerId);drag.captured=true;}catch{}}if(drag.moved){target.classList.add('dragging');target.scrollLeft=drag.left-delta;event.preventDefault();}});const finish=event=>{if(!drag)return;if(drag.moved){target.dataset.dragged='true';setTimeout(()=>delete target.dataset.dragged,180);}if(drag.captured&&target.hasPointerCapture(drag.pointerId)){try{target.releasePointerCapture(drag.pointerId);}catch{}}drag=null;target.classList.remove('dragging');};target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);window.addEventListener('pointerup',finish);target.dataset.desktopScrollReady='true';}
  }
  function renderRadioDisplay(){if(!radioPresets||!Object.keys(radioPresets).length)return;const current=radioCurrent();if(current&&!radioPresets[stationKey(current)])radioIndex=-1;const rows=currentRows('radio');if(!current&&rows.length){const selected=rows[0];radioIndex=radios.findIndex(s=>stationKey(s)===stationKey(selected));}drawRadio();renderRadioShortcuts();}
  function rememberPlayed(kind,station){if(!station)return;const key=kind==='tv'?station.url:stationKey(station),row={kind,key,url:station.url||station.url_resolved||'',name:station.name||'Untitled',country:station.country||'',logo:stationLogo(station),playedAt:Date.now()};recentHistory=[row,...recentHistory.filter(item=>!(item.kind===kind&&item.key===key))].slice(0,40);saveStore(RECENT_STORE,recentHistory);if(presetMode==='recent')renderPresets();}
  async function playRadio(station){
    const src=station?.url_resolved||station?.url;
    if(!src){notify('This station has no playable stream URL.');return;}
    currentRadioSource=src;
    const key=stationKey(station);radioIndex=radios.findIndex(s=>stationKey(s)===key);if(radioIndex<0){radios.unshift(station);radioIndex=0;}
    if(hls||video.src||video.currentSrc)stopTV();
    stopSoundRays();if(radioHls){radioHls.destroy();radioHls=null;}audio.pause();audio.removeAttribute('src');audio.load();
    // Match v1's direct-stream order. HLS sources must be attached through
    // Hls.js instead of being assigned to audio.src as a playlist URL.
    setRadioVolume(Math.min(40,Number($('radio-volume').value||30)));
    $('equalizer').classList.remove('playing');drawRadio();$('radio-status').textContent='CONNECTING · '+(station.name||'RADIO');rememberPlayed('radio',station);renderRadioShortcuts();
    const onRadioStarted=()=>{$('radio-art').classList.add('playing');$('equalizer').classList.add('playing');startSoundRays();$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';$('radio-status').textContent=`Playing · ${station.name||'Internet radio'}`;};
    const onRadioFailed=error=>{console.error('Radio playback failed:',currentRadioSource,error||'play() rejected');if(location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource)){$('radio-status').textContent='HTTPS REQUIRED · THIS STREAM USES HTTP';notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');}else{$('radio-status').textContent='STREAM COULD NOT START';notify('This station stream could not start. Try another station.');}};
    const isHls=/\.m3u8(?:$|[?#])/i.test(src);
    if(isHls&&window.Hls&&Hls.isSupported()){
      const player=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:18});radioHls=player;
      player.on(Hls.Events.MANIFEST_PARSED,()=>{if(radioHls!==player)return;audio.play().then(onRadioStarted).catch(onRadioFailed);});
      player.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&radioHls===player){const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);$('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'RADIO STREAM UNAVAILABLE';console.error('Radio HLS error:',data.type,data.details,currentRadioSource);notify(insecure?'This station uses an HTTP link, which secure pages block. Use an HTTPS stream.':'This radio stream is unavailable right now. Try another station.');player.destroy();radioHls=null;audio.pause();audio.removeAttribute('src');audio.load();$('radio-art').classList.remove('playing');$('equalizer').classList.remove('playing');stopSoundRays();$('radio-play').textContent='▶';}});
      player.on(Hls.Events.MEDIA_ATTACHED,()=>{if(radioHls===player)player.loadSource(src);});
      player.attachMedia(audio);
    }else if(isHls&&audio.canPlayType('application/vnd.apple.mpegurl')){
      audio.src=src;
      try{await audio.play();onRadioStarted();}catch(error){onRadioFailed(error);}
    }else if(isHls){
      const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);
      $('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'HLS PLAYER UNAVAILABLE';
      notify(insecure?'This station uses an HTTP link, which secure pages block. Use an HTTPS stream.':'The HLS playback component did not load. Refresh the app and try again.');
    }else{
      audio.src=src;
      try{await audio.play();onRadioStarted();}catch(error){onRadioFailed(error);}
    }
    renderPresets();
  }
  function toggleRadio(){if(!audio.src){const rows=currentRows('radio'),selected=radioCurrent(),station=rows.find(item=>selected&&stationKey(item)===stationKey(selected))||rows[0];if(station)playRadio(station);else notify('Choose a radio preset first.');return;}if(audio.paused){audio.play().then(()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';}).catch(error=>{console.error('Radio resume failed:',currentRadioSource,error);if(location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource)){ $('radio-status').textContent='HTTPS REQUIRED · THIS STREAM USES HTTP';notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');}else notify('This stream could not be resumed. Try another station.');});}else audio.pause();}
  function stopRadio(){stopSoundRays();if(radioHls){radioHls.destroy();radioHls=null;}audio.pause();audio.removeAttribute('src');audio.load();currentRadioSource='';$('radio-art').classList.remove('playing');$('radio-play').textContent='▶';$('radio-play').title='Play';$('equalizer').classList.remove('playing');$('radio-status').textContent='STOPPED';}
  function stepRadio(direction){const rows=currentRows('radio');if(!rows.length)return;const current=radioCurrent();let index=rows.findIndex(s=>stationKey(s)===stationKey(current||{}));index=(index+direction+rows.length)%rows.length;playRadio(rows[index]);}
  function togglePreset(kind,station){
    if(kind==='radio'){const key=stationKey(station),hidden=new Set(loadStore(RADIO_HIDDEN_STORE,[])),isShared=radios.some(item=>stationKey(item)===key);if(radioPresets[key]){delete radioPresets[key];if(isShared)hidden.add(key);}else{radioPresets[key]=station;hidden.delete(key);}saveStore(RADIO_HIDDEN_STORE,[...hidden]);saveStore(RADIO_STORE,radioPresets);drawRadio();if(!audio.paused){stopSoundRays();startSoundRays();}renderPresets();renderExplore();}
    else{const key=station.url,hidden=new Set(loadStore(TV_HIDDEN_STORE,[])),isShared=tvs.some(item=>item.url===key);if(tvPresets[key]){delete tvPresets[key];if(isShared)hidden.add(key);}else{tvPresets[key]=station;hidden.delete(key);}saveStore(TV_HIDDEN_STORE,[...hidden]);saveStore(TV_STORE,tvPresets);saveStore(TV_ORDER_STORE,Object.keys(tvPresets));drawTV();renderPresets();renderTVRail();renderRemotePresets();renderExplore();}
  }
  function renderRemotePresets(){
    const target=$('remote-presets');if(!target)return;const allRows=currentRows('tv'),rows=allRows.slice(0,20),picker=$('remote-channel-select');
    picker.innerHTML='<option value="">Choose a channel</option>'+allRows.map(station=>`<option value="${safe(station.url)}">${safe(station.name||'TV channel')}</option>`).join('');picker.value=tvCurrent()?.url||'';
    target.innerHTML=rows.map((station,index)=>`<button class="remote-key remote-preset-key ${tvCurrent()?.url===station.url?'active':''}" type="button" data-remote-preset="${index}" aria-pressed="${tvCurrent()?.url===station.url}" aria-label="Play ${safe(station.name||'TV channel')}" title="${safe(station.name||'TV channel')}">${String(index+1).padStart(2,'0')}</button>`).join('')||'<span class="empty-note">Save TV channels as presets to use quick select.</span>';
    target.querySelectorAll('[data-remote-preset]').forEach(button=>button.addEventListener('click',()=>{const station=rows[Number(button.dataset.remotePreset)];if(station)playTV(station);}));
  }
  function renderTVRail(){
    const target=$('tv-rail');if(!target)return;const rows=currentRows('tv');const playing=tvCurrent();if(playing&&!rows.some(row=>row.url===playing.url))rows.unshift(playing);
    const picture=$('tv-display').querySelector('.tv-picture');if(picture&&target.contains(picture))$('tv-display').prepend(picture);
    target.innerHTML=rows.map((station,index)=>{const logo=stationLogo(station),name=station.name||'TV channel';return `<div tabindex="0" class="tv-rail-card ${tvCurrent()?.url===station.url?'active':''}" data-tv-url="${safe(station.url)}" aria-label="Play ${safe(name)}"><span class="tv-rail-logo">${logo?`<img src="${safe(logo)}" alt="">`:`<span class="logo-fallback">${safe(initialsFor(name))}</span>`}</span><span class="tv-rail-copy"><b>${safe(name)}</b><small>${safe(station.country||station.group||'TV')}</small></span></div>`;}).join('')||'<span class="empty-note">No TV presets yet — save channels from Explore.</span>';
    target.querySelectorAll('[data-tv-url]').forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('.tv-picture'))return;const station=rows.find(s=>s.url===card.dataset.tvUrl);if(station&&station.url!==tvCurrent()?.url)playTV(station);}));
    if(!target.dataset.carouselReady){
      let settle=0;
      target.addEventListener('scroll',()=>{
        const center=target.scrollLeft+target.clientWidth/2;
        target.querySelectorAll('.tv-rail-card').forEach(card=>{const distance=Math.abs(card.offsetLeft+card.offsetWidth/2-center);card.style.setProperty('--tv-card-scale',String(Math.max(.65,1.15-distance/450)));});
        clearTimeout(settle);settle=setTimeout(()=>{
          if(target.matches('.dragging')||!$('tv-screen').classList.contains('active'))return;
          const center=target.scrollLeft+target.clientWidth/2;
          const card=[...target.querySelectorAll('.tv-rail-card')].sort((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-center)-Math.abs(b.offsetLeft+b.offsetWidth/2-center))[0];
          const station=currentRows('tv').find(row=>row.url===card?.dataset.tvUrl);
          if(station&&tvCurrent()?.url!==station.url){stopTVVolumeRamp();tvVolumeRampStarted=true;tvVolumeRampExpected=.05;video.volume=.05;updateTVNumbers();playTV(station);}
        },280);
      },{passive:true});target.dataset.carouselReady='true';
    }
    renderRemotePresets();const active=target.querySelector('.tv-rail-card.active');if(active&&picture&&!tvFullscreenActive){active.append(picture);active.classList.add('tv-video-card');}if(active)target.scrollTo({left:Math.max(0,active.offsetLeft-(target.clientWidth-active.offsetWidth)/2),behavior:'smooth'});
    if(!target.dataset.dragReady){target.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&target.scrollWidth>target.clientWidth){target.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});target.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;dragState={x:event.clientX,left:target.scrollLeft,moved:false};target.setPointerCapture(event.pointerId);target.classList.add('dragging');});target.addEventListener('pointermove',event=>{if(!dragState)return;const d=event.clientX-dragState.x;if(Math.abs(d)>4)dragState.moved=true;if(dragState.moved){target.scrollLeft=dragState.left-d;event.preventDefault();}});const end=event=>{if(!dragState)return;if(dragState.moved){target.dataset.dragged='true';setTimeout(()=>delete target.dataset.dragged,120);}if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);dragState=null;target.classList.remove('dragging');};target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('click',event=>{if(target.dataset.dragged==='true'){event.preventDefault();event.stopPropagation();delete target.dataset.dragged;}},true);target.dataset.dragReady='true';}
  }
  let tvVolumeRampTimer=0,tvVolumeRampStarted=false,tvVolumeRampExpected=.05;
  function stopTVVolumeRamp(){clearInterval(tvVolumeRampTimer);tvVolumeRampTimer=0;}
  function startTVVolumeRamp(){
    if(tvVolumeRampStarted)return;
    tvVolumeRampStarted=true;
    if(video.muted||Math.abs(video.volume-.05)>.001)return;
    tvVolumeRampTimer=setInterval(()=>{
      if(video.muted||Math.abs(video.volume-tvVolumeRampExpected)>.001){stopTVVolumeRamp();return;}
      if(video.paused)return;
      tvVolumeRampExpected=Math.min(.10,Math.round((tvVolumeRampExpected+.01)*100)/100);
      video.volume=tvVolumeRampExpected;updateTVNumbers();
      if(tvVolumeRampExpected>=.10)stopTVVolumeRamp();
    },1000);
  }
  function updateTVNumbers(){
    const volume=$('tv-volume-number'),channel=$('tv-channel-number');
    if(volume)volume.textContent=String(video.muted?0:Math.round(video.volume*100));
    const station=tvCurrent(),index=currentRows('tv').findIndex(row=>row.url===station?.url);
    if(channel)channel.textContent=index<0?'—':String(index+1);
  }
  function drawTV(){updateTVNumbers();const station=tvCurrent();if(!station){$('tv-title').textContent='Choose a channel';$('tv-subtitle').textContent='Live channels from your presets';$('fullscreen-channel-name').textContent='Choose a channel';$('fullscreen-channel-country').textContent='TV';$('tv-star').textContent='☆';$('tv-star').classList.remove('saved');$('remote-favorite').classList.remove('saved');$('tv-placeholder').hidden=false;return;}$('tv-title').textContent=station.name||'TV';$('tv-subtitle').textContent=[station.country,station.group].filter(Boolean).join(' · ')||'Live television';$('fullscreen-channel-name').textContent=station.name||'TV';$('fullscreen-channel-country').textContent=[station.country,station.group].filter(Boolean).join(' · ')||'TV';const saved=Boolean(tvPresets[station.url]);$('tv-star').textContent=saved?'★':'☆';$('tv-star').classList.toggle('saved',saved);$('remote-favorite').classList.toggle('saved',saved);$('tv-placeholder').hidden=Boolean(video.currentSrc||video.src);renderTVRail();}
  function stopTV(){if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();$('tv-toggle').textContent='▶';drawTV();}
  async function playTV(station){
    if(!station)return;if(tvCurrent()?.url!==station.url&&tvCurrent()){stopTVVolumeRamp();tvVolumeRampStarted=true;tvVolumeRampExpected=.05;video.volume=.05;}if(station.demoAutoStart){video.muted=true;defaultTVAutoMuted=true;}else if(defaultTVAutoMuted){video.muted=false;defaultTVAutoMuted=false;}const rows=currentRows('tv');tvIndex=tvs.findIndex(s=>s.url===station.url);if(tvIndex<0){tvs.unshift(station);tvIndex=0;}if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();
    if(audio.src||radioHls)stopRadio();
    const url=station.url||'';drawTV();$('tv-placeholder').hidden=true;rememberPlayed('tv',station);
    if(/\.m3u8($|\?)/i.test(url)&&window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,maxBufferLength:15});hls.loadSource(url);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().then(()=>{$('tv-toggle').textContent='Ⅱ';}).catch(()=>notify('Press play on the video to start.')));hls.on(Hls.Events.ERROR,(_e,data)=>{if(data.fatal)notify('This channel is not available right now.');});}
    else{video.src=url;try{await video.play();$('tv-toggle').textContent='Ⅱ';}catch{notify('Press play on the video to start this channel.');}}
    drawTV();renderPresets();
  }
  function stepTV(direction){const rows=currentRows('tv');if(!rows.length)return;let i=rows.findIndex(s=>s.url===tvCurrent()?.url);if(i<0)i=direction>0?-1:0;i=(i+direction+rows.length)%rows.length;playTV(rows[i]);}
  let tvFullscreenActive=false,tvNativeFullscreen=false;
  const tvFullscreenButton=document.querySelector('[data-remote="fullscreen"]');
  let tvZoomed=false;
  function fitTVFullscreenVideo(){
    if(!tvFullscreenActive)return;
    const stage=$('tv-display'),w=stage.clientWidth,h=stage.clientHeight;
    const ratio=video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:16/9;
    const width=(tvZoomed?Math.max:Math.min)(w,h*ratio),height=width/ratio;
    video.classList.toggle('tv-zoomed',tvZoomed);
    document.querySelectorAll('[data-fullscreen-action=zoom],[data-fullscreen-action=normal]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.fullscreenAction==='zoom')===tvZoomed)));
    video.style.setProperty('width',`${width}px`,'important');
    video.style.setProperty('height',`${height}px`,'important');
  }
  function syncTVFullscreenLayout(){
    const stage=$('tv-display');
    const width=window.visualViewport?.width||window.innerWidth;
    const height=window.visualViewport?.height||window.innerHeight;
    const mobile=window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
    // Rotate the complete player and its controls if the browser refuses orientation lock.
    stage.classList.toggle('landscape-fallback',tvFullscreenActive&&mobile&&height>width);
    stage.style.setProperty('--tv-viewport-width',`${width}px`);
    stage.style.setProperty('--tv-viewport-height',`${height}px`);
    requestAnimationFrame(fitTVFullscreenVideo);
  }
  async function toggleTVFullscreen(){
    if(tvFullscreenActive){exitTVFullscreen();return;}
    const shell=$('tv-fullscreen-shell'),stage=$('tv-display');
    const picture=stage.querySelector('.tv-picture');if(picture)stage.prepend(picture);
    shell._homeParent=shell.parentNode;shell._homeNext=shell.nextSibling;document.body.append(shell);
    tvFullscreenActive=true;stage.classList.add('cinema-mode');
    document.body.classList.add('tv-fullscreen-open');
    tvFullscreenButton?.setAttribute('aria-pressed','true');
    syncTVFullscreenLayout();
    try{
      const request=shell.requestFullscreen||shell.webkitRequestFullscreen;
      if(request){await request.call(shell);tvNativeFullscreen=true;}
    }catch{tvNativeFullscreen=false;}
    if(!tvFullscreenActive)return;
    if(window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0){
      try{await screen.orientation?.lock?.('landscape');}catch{}
    }
    if(tvFullscreenActive)syncTVFullscreenLayout();
    else{try{screen.orientation?.unlock?.();}catch{}}
  }
  function exitTVFullscreen(){
    tvFullscreenActive=false;tvNativeFullscreen=false;video.style.removeProperty('width');video.style.removeProperty('height');
    $('tv-display').classList.remove('cinema-mode','landscape-fallback');
    document.body.classList.remove('tv-fullscreen-open');
    const shell=$('tv-fullscreen-shell');if(shell._homeParent){shell._homeParent.insertBefore(shell,shell._homeNext?.parentNode===shell._homeParent?shell._homeNext:null);shell._homeParent=null;}
    tvFullscreenButton?.setAttribute('aria-pressed','false');
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(document.fullscreenElement||document.webkitFullscreenElement){try{Promise.resolve(exit?.call(document)).catch(()=>{});}catch{}}
    try{screen.orientation?.unlock?.();}catch{}
    renderTVRail();
  }
  video.addEventListener('loadedmetadata',fitTVFullscreenVideo);
  video.addEventListener('resize',fitTVFullscreenVideo);
  window.addEventListener('resize',syncTVFullscreenLayout);
  window.visualViewport?.addEventListener('resize',syncTVFullscreenLayout);
  window.addEventListener('orientationchange',syncTVFullscreenLayout);

  function updatePresetCounts(){$('preset-radio-count').textContent=String(Object.keys(radioPresets).length);$('preset-tv-count').textContent=String(Object.keys(tvPresets).length);}
  function reorderPreset(kind,from,to){
    const presets=kind==='tv'?tvPresets:radioPresets,keys=Object.keys(presets),a=keys.indexOf(from),b=keys.indexOf(to);
    if(a<0||b<0||a===b)return;
    keys.splice(a,1);keys.splice(b,0,from);
    const reordered=Object.fromEntries(keys.map(key=>[key,presets[key]]));
    if(kind==='tv'){tvPresets=reordered;saveStore(TV_STORE,reordered);saveStore(TV_ORDER_STORE,keys);renderTVRail();renderRemotePresets();}
    else{radioPresets=reordered;saveStore(RADIO_STORE,reordered);renderRadioShortcuts();}
    renderPresets();renderExplore();
  }
  function enablePresetDragging(target,rows){
    const kind=presetMode,key=station=>kind==='tv'?station.url:stationKey(station);
    target.querySelectorAll('.preset-drag-handle').forEach(handle=>{
      const card=handle.closest('[data-preset-index]');let drag=null;
      handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
      handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();drag={id:event.pointerId,to:null};handle.setPointerCapture(event.pointerId);card.classList.add('preset-dragging');});
      handle.addEventListener('pointermove',event=>{if(!drag)return;event.preventDefault();event.stopPropagation();const over=document.elementFromPoint(event.clientX,event.clientY)?.closest('#preset-grid [data-preset-index]');target.querySelectorAll('.preset-drop-target').forEach(item=>item.classList.remove('preset-drop-target'));drag.to=over&&over!==card?Number(over.dataset.presetIndex):null;if(drag.to!==null)over.classList.add('preset-drop-target');if(event.clientY<90)window.scrollBy(0,-12);else if(event.clientY>innerHeight-90)window.scrollBy(0,12);});
      const finish=event=>{if(!drag)return;event.stopPropagation();const to=drag.to;drag=null;card.classList.remove('preset-dragging');target.querySelectorAll('.preset-drop-target').forEach(item=>item.classList.remove('preset-drop-target'));if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);if(event.type==='pointerup'&&to!==null)reorderPreset(kind,key(rows[Number(card.dataset.presetIndex)]),key(rows[to]));};
      handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
      handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const from=Number(card.dataset.presetIndex),to=from+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);if(rows[to]){reorderPreset(kind,key(rows[from]),key(rows[to]));target.querySelector(`[data-preset-index="${to}"] .preset-drag-handle`)?.focus();}});
    });
  }
  function renderPresets(){
    updatePresetCounts();const target=$('preset-grid');$('clear-recent').hidden=presetMode!=='recent';$('preset-footnote').firstChild.textContent=presetMode==='recent'?'History is stored only on this device. ': 'Drag ⠿ to change priority · Tap to play · ★ to remove ';if(presetMode==='recent'){ $('preset-priority-control').hidden=true;$('preset-selection-label').textContent='RECENTLY PLAYED';target.classList.add('recent-history-grid');target.innerHTML=recentHistory.map((entry,index)=>`<button class="preset-card recent-history-card" type="button" data-recent-index="${index}"><span class="channel-number">${entry.kind==='tv'?'TV':'RADIO'} · ${new Date(entry.playedAt||Date.now()).toLocaleDateString()}</span><span class="preset-logo">${entry.logo?`<img src="${safe(entry.logo)}" loading="lazy" alt="">`:entry.kind==='tv'?'TV':'♫'}</span><b>${safe(entry.name)}</b><small>${safe(entry.country||'Recently played')}</small></button>`).join('')||'<div class="empty-note">Your radio and TV history will appear here.</div>';target.querySelectorAll('[data-recent-index]').forEach(button=>button.addEventListener('click',()=>{const entry=recentHistory[Number(button.dataset.recentIndex)];if(!entry)return;const list=entry.kind==='tv'?tvs:radios,item=list.find(row=>(entry.kind==='tv'?row.url:stationKey(row))===entry.key)||Object.values(entry.kind==='tv'?tvPresets:radioPresets).find(row=>(entry.kind==='tv'?row.url:stationKey(row))===entry.key);if(item){setScreen(entry.kind==='tv'?'tv-screen':'radio-screen');entry.kind==='tv'?playTV(item):playRadio(item);}}));return;}target.classList.remove('recent-history-grid');const rows=currentRows(presetMode);$('preset-priority-control').hidden=true;
    if(presetMode==='tv'&&(!rows.some(item=>item.url===selectedTVPresetKey)))selectedTVPresetKey=tvCurrent()?.url&&rows.some(item=>item.url===tvCurrent().url)?tvCurrent().url:rows[0]?.url||null;
    const selected=rows.find(item=>item.url===selectedTVPresetKey);$('preset-selection-label').textContent=selected?`SELECTED · ${selected.name||'TV CHANNEL'}`:'SELECT A TV CHANNEL';
    target.innerHTML=rows.map((station,index)=>{const title=station.name||'Untitled station',logo=stationLogo(station);return `<article class="preset-card ${presetMode==='tv'&&tvCurrent()?.url===station.url||presetMode==='radio'&&stationKey(radioCurrent()||{})===stationKey(station)?'active':''} ${presetMode==='tv'&&selectedTVPresetKey===station.url?'priority-selected':''}" tabindex="0" role="button" data-preset-index="${index}"><span class="channel-number">CH ${String(index+1).padStart(2,'0')}</span><button type="button" class="preset-drag-handle" aria-label="Drag to change priority; use arrow keys with keyboard" title="Drag to change priority">⠿</button><button class="preset-star" type="button" data-preset-star="${safe(presetMode==='tv'?station.url:stationKey(station))}" aria-label="Remove preset">★</button><span class="preset-logo">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:safe(title.slice(0,11))}</span><b>${safe(title)}</b><small>${safe(station.country||station.group||'Live')}</small></article>`;}).join('')||'<div class="empty-note">No presets in this section yet. Save stations from Explore.</div>';
    target.querySelectorAll('[data-preset-index]').forEach(card=>{const station=rows[Number(card.dataset.presetIndex)];card.addEventListener('click',event=>{if(event.target.closest('[data-preset-star],.preset-drag-handle'))return;if(presetMode==='tv')selectedTVPresetKey=station.url;renderPresets();if(presetMode==='tv')playTV(station);else{setScreen('radio-screen');playRadio(station);}});card.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===card){if(presetMode==='tv')selectedTVPresetKey=station.url;if(presetMode==='tv')playTV(station);else{setScreen('radio-screen');playRadio(station);}renderPresets();}});});
    enablePresetDragging(target,rows);
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
  function cleanLanguageName(value){return String(value||'').trim().replace(/\s+/g,' ').replace(/\b\p{L}/gu,letter=>letter.toLocaleUpperCase());}
  function rememberLanguage(name,code=''){
    const label=cleanLanguageName(name);if(!label)return;
    if(!languageCatalog.some(item=>item.toLocaleLowerCase()===label.toLocaleLowerCase()))languageCatalog.push(label);
    languageNameByKey.set(label.toLocaleLowerCase(),label);
    if(code)for(const alias of String(code).split(/[;,|\s]+/).filter(Boolean))languageNameByCode.set(alias.toLowerCase(),label);
  }
  function languageFromCode(code){
    const key=String(code||'').trim().toLowerCase();if(!key)return '';
    if(languageNameByCode.has(key))return languageNameByCode.get(key);
    try{const label=new Intl.DisplayNames(['en'],{type:'language'}).of(key);if(label&&label.toLowerCase()!==key.toLowerCase())return cleanLanguageName(label);}catch{}
    return '';
  }
  function languageNames(station){
    const found=new Set(),fields=[station.language,station.languages,station.languagecodes];
    for(const field of fields){for(const raw of (Array.isArray(field)?field:[field])){
      for(const part of String(raw||'').split(/[;,|]+/).map(value=>value.trim()).filter(Boolean)){
        const key=part.toLowerCase(),known=languageNameByKey.get(key)||languageFromCode(key);
        if(known){rememberLanguage(known,key);found.add(known);}
        else if(/^[a-z]{2,3}$/i.test(part)){continue;}
        else{const label=cleanLanguageName(part);rememberLanguage(label);found.add(label);}
      }
    }}
    const name=String(station.name||station.channelName||'').toLocaleLowerCase();
    for(const language of languageCatalog)if(name.includes(language.toLocaleLowerCase()))found.add(language);
    if(!found.size&&/\b(bbc|cnn|dw english|france 24|al jazeera english|abc news|reuters|nhk world|trt world|arirang|ndtv|aaj tak|dd news)\b/i.test(name))found.add('English');
    return [...found];
  }
  async function loadLanguageCatalog(){
    const jobs=[fetchJson('https://iptv-org.github.io/api/languages.json'),fetchJson('https://de1.api.radio-browser.info/json/languages?order=name&limit=5000')];
    const results=await Promise.allSettled(jobs);
    for(const result of results)if(result.status==='fulfilled'&&Array.isArray(result.value))for(const item of result.value){
      const name=item.name||item.language||item.english_name||'';const code=item.code||item.iso_639||item.iso639_3||item.iso639||'';if(name)rememberLanguage(name,code);
    }
    populateExploreFilters();
  }
  function populateExploreFilters(){
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets,rows=[...source,...Object.values(store)];
    const countries=browserSource==='online'&&onlineCountries.length?onlineCountries:[...new Set(rows.map(s=>String(s.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const genres=browserSource==='online'&&onlineGenres.length?onlineGenres:[...new Set(rows.map(s=>stationGenre(s,browserKind)))].sort((a,b)=>a.localeCompare(b));
    const allStationRows=[...radios,...tvs,...Object.values(radioPresets),...Object.values(tvPresets),...onlineRows,...(onlineTVCache||[])];
    const languages=[...new Set([...languageCatalog,...allStationRows.flatMap(languageNames)])].sort((a,b)=>a.localeCompare(b));
    const replace=(id,items,label)=>{const select=$(id),old=select.value;select.innerHTML=`<option value="all">All ${label}</option>`+items.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(items.includes(old))select.value=old;};
    replace('explore-country',countries,'countries');replace('explore-genre',genres,'genres');replace('explore-language',languages,'languages');
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
    const query=$('explore-search').value.trim(),country=$('explore-country').value,genre=$('explore-genre').value,language=$('explore-language').value;
    if(!loadMore){onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;}onlineSearchDone=true;
    $('discovery-status').textContent='Searching the online catalog…';$('explore-results').innerHTML='<div class="loading-note">Loading channels…</div>';
    try{
      if(browserKind==='radio'){
        const hosts=['https://de1.api.radio-browser.info/json','https://nl1.api.radio-browser.info/json'];let found=null,lastError;
        for(const base of hosts){try{const params=new URLSearchParams({limit:'100',offset:String(onlineOffset),order:'clickcount',reverse:'true',hidebroken:'true'});if(query)params.set('name',query);if(country!=='all')params.set('country',country);if(genre!=='all')params.set('tag',genre);if(language!=='all')params.set('language',language.toLowerCase());found=await fetchJson(`${base}/stations/search?${params}`);break;}catch(error){lastError=error;}}
        if(!found)throw lastError||new Error('Radio catalog unavailable');
        const next=found.filter(s=>s.url_resolved||s.url).map(s=>({...s,_kind:'radio',url:s.url_resolved||s.url}));
        onlineRows=loadMore?[...onlineRows,...next.filter(x=>!onlineRows.some(y=>stationKey(y)===stationKey(x)))]:next;onlineHasMore=next.length===100;onlineOffset+=next.length;
      }else{
        if(!onlineTVCache){
          const base='https://iptv-org.github.io/api';$('discovery-status').textContent='Loading the global TV directory (first use may take a little longer)…';
          const [channels,streams,logos,countries,categories]=await Promise.all([fetchJson(`${base}/channels.json`),fetchJson(`${base}/streams.json`),fetchJson(`${base}/logos.json`),fetchJson(`${base}/countries.json`),fetchJson(`${base}/categories.json`)]);
          const countryNames=new Map(countries.map(c=>[c.code,c.name])),categoryNames=new Map(categories.map(c=>[c.id,c.name])),channelMap=new Map(channels.map(c=>[c.id,c])),logoMap=new Map();
          for(const logo of logos)if(logo.in_use&&!logoMap.has(logo.channel))logoMap.set(logo.channel,logo.url);
          onlineTVCache=streams.filter(s=>s.url&&s.channel&&channelMap.has(s.channel)).map(s=>{const c=channelMap.get(s.channel),genres=(c.categories||[]).map(id=>categoryNames.get(id)||id),languages=c.languages||[];return{name:s.title||c.name,channelName:c.name,alt_names:c.alt_names||[],country:countryNames.get(c.country)||c.country||'Unknown',countryCode:c.country||'',languages,language:languages.join(','),group:genres.join(', ')||'Other',tags:genres.join(','),genre:genres[0]||'Other',logo:logoMap.get(c.id)||'',url:s.url,quality:s.quality||'',labels:s.labels||[],_kind:'tv',is_nsfw:c.is_nsfw};}).filter(s=>!s.is_nsfw&&!/nsfw|adult/i.test(s.labels.join(' ')));
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
    const q=$('explore-search').value.trim().toLowerCase(),country=$('explore-country').value,genre=$('explore-genre').value,language=$('explore-language').value,sortBy=$('explore-sort').value;
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets;
    const keyOf=s=>browserKind==='tv'?s.url:stationKey(s),merged=new Map(source.map(s=>[keyOf(s),s]));
    for(const item of Object.values(store))if(item&&keyOf(item))merged.set(keyOf(item),item);
    let rows=browserSource==='online'?onlineRows.map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown',_languages:languageNames(s)})):[...merged.values()].map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown',_languages:languageNames(s)}));
    if(country!=='all')rows=rows.filter(s=>s._country===country);
    if(genre!=='all')rows=rows.filter(s=>[s._genre,...String(s.tags||'').split(/[;,|]/),...String(s.group||'').split(/[;,|]/),...(Array.isArray(s.categories)?s.categories:[])].some(value=>String(value).trim().toLowerCase()===genre.toLowerCase()));
    if(language!=='all')rows=rows.filter(s=>s._languages.includes(language));
    if(q)rows=rows.filter(s=>`${s.name||''} ${s._genre} ${s._country} ${s.tags||''} ${s.language||''} ${s.group||''}`.toLowerCase().includes(q));
    const groupKey=sortBy==='name'?null:sortBy==='country'?'_country':'_genre',collator=new Intl.Collator(undefined,{sensitivity:'base'});
    rows.sort((a,b)=>groupKey?collator.compare(a[groupKey],b[groupKey])||collator.compare(a.name||'',b.name||''):collator.compare(a.name||'',b.name||''));
    if(browserSource==='online'&&browserKind==='tv'&&language!=='all')rows.sort((a,b)=>(parseInt(String(b.quality||'').match(/\d+/)?.[0]||'0')-parseInt(String(a.quality||'').match(/\d+/)?.[0]||'0'))||a.name.localeCompare(b.name));
    const visibleRows=browserSource==='online'&&browserKind==='tv'?rows.slice(0,Math.min(onlineVisibleLimit,language!=='all'?20:onlineVisibleLimit)):rows;
    const groups=new Map();for(const row of visibleRows){const heading=groupKey?row[groupKey]:'All channels';if(!groups.has(heading))groups.set(heading,[]);groups.get(heading).push(row);}
    const target=$('explore-results');let html='';
    for(const [heading,items] of groups){html+=`<h2 class="result-group-title">${safe(heading)} <small>${items.length}</small></h2>`;html+=items.map(s=>{const logo=stationLogo(s),key=keyOf(s),saved=Boolean(store[key]),quality=browserKind==='tv'?(s.quality||'LIVE'):[s.codec,s.bitrate?`${s.bitrate} kbps`:null].filter(Boolean).join(' · ')||'LIVE';return `<button class="result-row" type="button" data-result-kind="${browserKind}" data-result-key="${safe(key)}">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:`<span class="result-icon">${browserKind==='tv'?'▣':'♫'}</span>`}<span class="result-copy"><b>${safe(s.name||'Untitled channel')}</b><small>${safe(s._genre)} · ${safe(s._country)}</small></span><small class="result-quality">${safe(quality)}</small><b class="result-star">${saved?'★':'☆'}</b></button>`;}).join('');}
    if(!html&&browserSource==='online')html=`<div class="empty-note">${onlineSearchDone?'No channels match. Try another name, country, or genre.':'Choose filters, then search the online catalog to discover more channels.'}</div>`;
    if(!html&&browserSource==='library')html='<div class="empty-note">No channels match those filters.</div>';
    if(browserSource==='online'&&onlineHasMore&&(browserKind==='radio'||(language==='all'&&rows.length>visibleRows.length)))html+='<button class="load-more-online" id="load-more-online" type="button">LOAD MORE CHANNELS</button>';
    target.innerHTML=html;
    $('browser-summary').textContent=browserSource==='online'&&browserKind==='tv'&&language!=='all'?`Showing up to ${visibleRows.length} ${language} channels · best available stream quality first · ${rows.length} matches`:`${browserSource==='online'&&browserKind==='tv'&&rows.length>visibleRows.length?`Showing ${visibleRows.length} of ${rows.length}`:rows.length} ${browserKind==='tv'?'TV channels':'radio stations'} · sorted by ${sortBy==='name'?'channel name':sortBy}`;
    target.querySelectorAll('[data-result-kind]').forEach(button=>button.addEventListener('click',()=>{const kind=button.dataset.resultKind,key=button.dataset.resultKey,sourceList=kind==='tv'?tvs:radios,station=sourceList.find(s=>(kind==='tv'?s.url:stationKey(s))===key)||Object.values(kind==='tv'?tvPresets:radioPresets).find(s=>(kind==='tv'?s.url:stationKey(s))===key)||onlineRows.find(s=>(kind==='tv'?s.url:stationKey(s))===key);if(!station)return;if(kind==='tv'){if(!tvPresets[station.url])togglePreset('tv',station);setScreen('tv-screen');playTV(station);}else{if(!radioPresets[stationKey(station)])togglePreset('radio',station);setScreen('radio-screen');playRadio(station);}}));
    $('load-more-online')?.addEventListener('click',()=>{if(browserKind==='radio')discoverOnline(true);else{onlineVisibleLimit+=100;renderExplore();}});
  }

  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>setScreen(button.dataset.screen)));
  document.querySelectorAll('[data-mode-screen]').forEach(button=>button.addEventListener('click',()=>setScreen(button.dataset.modeScreen)));
  let pageSwipeStart=null,suppressPresetSwipeClickUntil=0;
  document.addEventListener('click',event=>{if(Date.now()<suppressPresetSwipeClickUntil&&event.target.closest('#presets-screen')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.querySelectorAll('.screen').forEach(screen=>{
    screen.addEventListener('pointerdown',event=>{
      const onPresets=screen.id==='presets-screen',interactive=event.target.closest('button,input,select,textarea,a,video,.dial-wrap,.tv-rail,.explore-results');
      if(event.pointerType==='mouse'||event.target.closest('.priority-pad,.preset-drag-handle')||(interactive&&!onPresets)||(!onPresets&&event.target.closest('.preset-grid'))){pageSwipeStart=null;return;}
      pageSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId,screen:screen.id};
    });
    screen.addEventListener('pointerup',event=>{
      const start=pageSwipeStart;pageSwipeStart=null;if(!start||start.id!==event.pointerId||start.screen!==document.querySelector('.screen.active')?.id)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2){if(start.screen==='presets-screen')suppressPresetSwipeClickUntil=Date.now()+500;stepScreen(dx<0?1:-1);}
    });
    screen.addEventListener('pointercancel',()=>{pageSwipeStart=null;});
  });
  document.querySelectorAll('[data-preset-mode]').forEach(button=>button.addEventListener('click',()=>{presetMode=button.dataset.presetMode;document.querySelectorAll('[data-preset-mode]').forEach(item=>item.classList.toggle('selected',item===button));renderPresets();}));
  $('theme-choice').addEventListener('change',event=>applyTheme(event.target.value));
  $('legacy-theme-enabled').addEventListener('change',event=>setLegacyThemeEnabled(event.target.checked));
  $('theme-switch-enabled').addEventListener('change',event=>setThemeSwitchEnabled(event.target.checked));
  // Triple taps on either player screen change its skin. Glow follows the skin.
  let themeTapBatch={count:0,surface:'',screen:'',timer:0},themePointerStart=null,legacyRadioTapCount=0,legacyRadioTapTimer=0;
  document.querySelectorAll('#radio-screen,#tv-screen').forEach(screen=>{
    screen.addEventListener('pointerdown',event=>{themePointerStart={screen:screen.id,id:event.pointerId,x:event.clientX,y:event.clientY};});
    screen.addEventListener('pointerup',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const start=themePointerStart;themePointerStart=null;if(!start||start.screen!==screen.id||start.id!==event.pointerId||Math.hypot(event.clientX-start.x,event.clientY-start.y)>18)return;
    if(event.target.closest('button,a,input,select,textarea,.preset-grid,.explore-results,.remote-panel'))return;
    const artTap=Boolean(event.target.closest('#radio-art')),surface=artTap?'radio-art':screen.id;
    if(screen.id==='radio-screen'&&!artTap){clearTimeout(themeTapBatch.timer);themeTapBatch={count:0,surface:'',screen:'',timer:0};if(!legacyThemeEnabled)return;legacyRadioTapCount++;clearTimeout(legacyRadioTapTimer);if(legacyRadioTapCount>=10){legacyRadioTapCount=0;toggleRadioSkin();return;}legacyRadioTapTimer=window.setTimeout(()=>{legacyRadioTapCount=0;},8000);return;}
    if(screen.id==='radio-screen'&&artTap){legacyRadioTapCount=0;clearTimeout(legacyRadioTapTimer);}
    if(themeTapBatch.screen!==screen.id||themeTapBatch.surface!==surface||themeTapBatch.count===0){clearTimeout(themeTapBatch.timer);themeTapBatch={count:0,surface,screen:screen.id,timer:0};}
    themeTapBatch.count++;clearTimeout(themeTapBatch.timer);
    if(themeTapBatch.count>=3){themeTapBatch={count:0,surface:'',screen:'',timer:0};if(themeSwitchEnabled){const themes=['retro','modern','ultra'];applyTheme(themes[(themes.indexOf(themeMode)+1)%themes.length]);notify(`${themeMode.toUpperCase()} theme`);}return;}
    themeTapBatch.timer=window.setTimeout(()=>{themeTapBatch={count:0,surface:'',screen:'',timer:0};},650);
  });});
  document.querySelectorAll('[data-browser-kind]').forEach(button=>button.addEventListener('click',()=>{browserKind=button.dataset.browserKind;onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineCountries=[];onlineGenres=[];onlineSearchDone=false;document.querySelectorAll('[data-browser-kind]').forEach(item=>item.classList.toggle('selected',item===button));populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  document.querySelectorAll('[data-browser-source]').forEach(button=>button.addEventListener('click',()=>{browserSource=button.dataset.browserSource;document.querySelectorAll('[data-browser-source]').forEach(item=>item.classList.toggle('selected',item===button));$('online-search-row').hidden=browserSource!=='online';onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineSearchDone=false;populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  $('discover-online').addEventListener('click',()=>discoverOnline());
  $('explore-search').addEventListener('keydown',event=>{if(event.key==='Enter'&&browserSource==='online'){event.preventDefault();discoverOnline();}});
    $('explore-search').addEventListener('input',renderExplore);$('explore-country').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-genre').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-language').addEventListener('change',()=>{if(browserSource==='online'){onlineVisibleLimit=20;discoverOnline();}else renderExplore();});$('explore-sort').addEventListener('change',renderExplore);
  $('radio-country').addEventListener('change',()=>{renderRadioDisplay();renderPresets();});
  $('tv-country').addEventListener('change',()=>{renderTVRail();renderPresets();});
  $('radio-play').addEventListener('click',toggleRadio);$('radio-prev').addEventListener('click',()=>stepRadio(-1));$('radio-next').addEventListener('click',()=>stepRadio(1));
  $('radio-art').addEventListener('click',event=>{if(!event.target.closest('#radio-star'))return;const station=radioCurrent();if(station)togglePreset('radio',station);});

  $('radio-volume').addEventListener('input',event=>setRadioVolume(event.target.value));
  document.querySelectorAll('[data-radio-volume-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.radioVolumeAction;if(action==='mute'){audio.muted=!audio.muted;button.classList.toggle('muted',audio.muted);button.setAttribute('aria-label',audio.muted?'Unmute radio':'Mute radio');}else if(action==='up'){audio.muted=false;setRadioVolume(Number($('radio-volume').value)+5);}}));
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
  document.querySelectorAll('[data-fullscreen-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.fullscreenAction;if(action==='zoom'||action==='normal'){tvZoomed=action==='zoom';fitTVFullscreenVideo();return;}if(action==='home'){exitTVFullscreen();setScreen('tv-screen');$('tv-screen').scrollIntoView({behavior:'smooth',block:'start'});return;}if(action==='previous'){stepTV(-1);return;}if(action==='next'){stepTV(1);return;}if(action==='play'){if(video.paused)video.play().catch(()=>notify('Press play to resume this channel.'));else video.pause();return;}if(action==='mute'){video.muted=!video.muted;$('tv-display').classList.toggle('is-muted',video.muted);button.setAttribute('aria-label',video.muted?'Unmute':'Mute');}}));

  audio.addEventListener('play',()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';drawRadio();startSoundRays();});audio.addEventListener('pause',()=>{stopSoundRays();$('equalizer').classList.remove('playing');$('radio-art').classList.remove('playing');$('radio-play').textContent='▶';$('radio-play').title='Play';drawRadio();});
  audio.addEventListener('waiting',()=>{if(currentRadioSource)$('radio-status').textContent='BUFFERING · '+(radioCurrent()?.name||'RADIO');});
  audio.addEventListener('stalled',()=>{if(currentRadioSource)$('radio-status').textContent='STREAM STALLED · WAITING TO RETRY';});
  audio.addEventListener('error',()=>{if(!currentRadioSource)return;const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);$('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'STREAM COULD NOT LOAD';if(insecure)notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');else console.error('Radio audio error:',audio.error?.code,currentRadioSource);});
  video.addEventListener('playing',startTVVolumeRamp);
  video.addEventListener('play',()=>{$('tv-toggle').textContent='Ⅱ';$('remote-main-play').classList.add('playing');$('tv-display').classList.add('is-playing');$('tv-placeholder').hidden=true;});video.addEventListener('pause',()=>{$('tv-toggle').textContent='▶';$('remote-main-play').classList.remove('playing');$('tv-display').classList.remove('is-playing');});video.addEventListener('volumechange',()=>{if(video.muted||Math.abs(video.volume-tvVolumeRampExpected)>.001){tvVolumeRampStarted=true;stopTVVolumeRamp();}updateTVNumbers();$('tv-display').classList.toggle('is-muted',video.muted);});video.addEventListener('error',()=>{if(video.currentSrc)notify('This TV stream could not be reached.');});
  function onTVFullscreenChange(){
    const element=document.fullscreenElement||document.webkitFullscreenElement;
    if(tvFullscreenActive&&tvNativeFullscreen&&!element)exitTVFullscreen();
    else syncTVFullscreenLayout();
  }
  document.addEventListener('fullscreenchange',onTVFullscreenChange);
  document.addEventListener('webkitfullscreenchange',onTVFullscreenChange);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tvFullscreenActive){event.preventDefault();exitTVFullscreen();}});
  document.addEventListener('keydown',event=>{if(event.target.closest('input,select,textarea,button,video,[contenteditable],.preset-drag-handle'))return;if(event.code==='Space'&&['radio-screen','tv-screen'].includes(document.querySelector('.screen.active')?.id)){event.preventDefault();if(!$('radio-screen').classList.contains('active'))$('tv-toggle').click();else toggleRadio();}if(event.key==='ArrowRight'&&$('tv-screen').classList.contains('active'))stepTV(1);if(event.key==='ArrowLeft'&&$('tv-screen').classList.contains('active'))stepTV(-1);});
  video.volume=0.05;updateTVNumbers();
  const volume=Number(loadStore(VOLUME_STORE,30));setRadioVolume(Number.isFinite(volume)?Math.min(100,Math.max(0,volume)):30);
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
  applyTheme(themeMode,true);syncThemeSettings();
  $('settings-open').addEventListener('click',()=>$('settings-dialog').showModal());
  $('clear-recent').addEventListener('click',()=>{recentHistory=[];saveStore(RECENT_STORE,recentHistory);renderPresets();notify('Recent history cleared.');});
  formatClock();setInterval(formatClock,30000);loadRadioNews();setInterval(loadRadioNews,60*60*1000);loadLanguageCatalog();fetchData().finally(()=>window.setTimeout(closeSplash,650));
})();
