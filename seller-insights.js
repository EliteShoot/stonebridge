/* Non-personal conversion events. A completed inquiry is recorded by the form only after API success. */
(function(){
 document.addEventListener('click',function(event){
  const link=event.target.closest('a[href]');if(!link||typeof window.gtag!=='function')return;
  const href=link.getAttribute('href');
  if(href.startsWith('tel:'))window.gtag('event','phone_click',{page_path:location.pathname,transport_type:'beacon'});
  else if(href.startsWith('mailto:'))window.gtag('event','email_click',{page_path:location.pathname,transport_type:'beacon'});
 });
 document.querySelectorAll('.faq-item').forEach(function(item,i){
  const button=item.querySelector('button'),answer=item.querySelector('p');if(!button||!answer)return;
  answer.id=answer.id||'sb-faq-answer-'+i;button.setAttribute('aria-controls',answer.id);button.setAttribute('aria-expanded',String(item.classList.contains('active')));
  new MutationObserver(function(){button.setAttribute('aria-expanded',String(item.classList.contains('active')));}).observe(item,{attributes:true,attributeFilter:['class']});
 });
})();

/* Shared public-site scroll reveals and an unobstructed return-to-top control. */
(function(){
  function initMotion(){
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const selectors = 'main h2, main h3, main p, main .label, main .project, main .pillar, main .so-card, main .guide-related a, main .sb-seo-grid > article, main .approach-photo, main .philosophy-photo, main .feature-image, main .map, main .text-link, main .actions';
    const excluded = '.hero,.about-hero,.so-hero,.guide-hero,.sell-hero,form,.modal,.legal-modal,[role="dialog"],.stage,.approach-caption';
    if(!reduced.matches && 'IntersectionObserver' in window){
      const candidates = Array.from(document.querySelectorAll(selectors)).filter(function(el){return !el.closest(excluded);});
      const selected = new Set(candidates);
      const observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
        });
      },{threshold:0.06,rootMargin:'0px 0px -32px 0px'});
      candidates.forEach(function(el,i){
        for(let parent=el.parentElement;parent;parent=parent.parentElement){if(selected.has(parent))return;}
        const rect=el.getBoundingClientRect();
        if(!rect.height || rect.top < window.innerHeight * .94)return;
        el.style.setProperty('--sb-reveal-delay', (i % 3) * 65 + 'ms');
        el.classList.add('sb-reveal');observer.observe(el);
      });
      document.addEventListener('focusin',function(event){
        const target=event.target.closest('.sb-reveal');
        if(target){target.classList.add('is-visible');observer.unobserve(target);}
      });
      reduced.addEventListener('change',function(event){
        if(event.matches){document.querySelectorAll('.sb-reveal').forEach(function(el){el.classList.add('is-visible');});observer.disconnect();}
      });
    }
    if(document.querySelector('.sb-back-top'))return;
    const button=document.createElement('button');
    button.type='button';button.className='sb-back-top';button.hidden=true;
    button.setAttribute('aria-label','Back to top');button.title='Back to top';
    button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(button);
    let scheduled=false;
    function update(){
      scheduled=false;
      let clearance=16;
      document.querySelectorAll('.mobile-actions,.mobile-nav,.bottom-nav,.sticky-cta').forEach(function(nav){
        const rect=nav.getBoundingClientRect(),style=getComputedStyle(nav);
        if(style.display!=='none' && style.visibility!=='hidden' && ['fixed','sticky'].includes(style.position) && rect.height && rect.top<window.innerHeight && rect.bottom>window.innerHeight/2){
          clearance=Math.max(clearance,window.innerHeight-rect.top+14);
        }
      });
      button.style.setProperty('--sb-bottom-clearance',clearance+'px');
      const modalOpen=Array.from(document.querySelectorAll('.modal.open,.legal-modal.open,.modal-backdrop.open,[role="dialog"][open]')).some(function(el){return el.getBoundingClientRect().height>0;});
      const editing=document.activeElement && document.activeElement.matches('input,textarea,select,[contenteditable="true"]');
      button.hidden=window.scrollY<Math.max(500,window.innerHeight*.65) || modalOpen || editing;
    }
    function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);document.addEventListener('click',schedule);
    if(window.visualViewport){window.visualViewport.addEventListener('resize',schedule,{passive:true});}
    if('ResizeObserver' in window){const ro=new ResizeObserver(schedule);document.querySelectorAll('.mobile-actions,.mobile-nav,.bottom-nav,.sticky-cta').forEach(function(el){ro.observe(el);});}
    button.addEventListener('click',function(){window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});});
    update();
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initMotion,{once:true});}else{initMotion();}
})();
