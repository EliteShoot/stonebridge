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
