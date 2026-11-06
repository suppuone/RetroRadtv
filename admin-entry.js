(() => {
  'use strict';
  const title=document.getElementById('admin-discover'),button=document.getElementById('admin-open');
  if(!title||!button)return;
  let taps=0,timer=0;
  title.addEventListener('click',()=>{
    taps++;clearTimeout(timer);timer=setTimeout(()=>{taps=0;},6000);
    if(taps>=7){taps=0;button.hidden=false;button.focus();}
  });
})();
