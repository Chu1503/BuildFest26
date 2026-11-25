// Small behaviours for the marketing pages: mobile menu, header border, scroll reveal, contact form.
// The address that the contact form sends to. Change this one line to your team inbox.
const CONTACT_EMAIL='chiranjeeviv@wisc.edu';

const header=document.getElementById('siteHeader'),toggle=document.getElementById('menuToggle');
if(header){
 const onScroll=()=>header.classList.toggle('scrolled',scrollY>8);onScroll();addEventListener('scroll',onScroll,{passive:true});
 toggle?.addEventListener('click',()=>{const open=header.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu');});
 header.querySelectorAll('.site-nav a').forEach(a=>a.addEventListener('click',()=>{header.classList.remove('open');toggle?.setAttribute('aria-expanded','false');}));
}
for(const el of document.querySelectorAll('[data-year]'))el.textContent=new Date().getFullYear();

const reveal=document.querySelectorAll('.reveal');
if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px'});reveal.forEach(el=>io.observe(el));}
else reveal.forEach(el=>el.classList.add('in'));

const form=document.getElementById('contactForm');
if(form){
 const status=document.getElementById('formStatus'),topic=new URLSearchParams(location.search).get('topic');
 if(topic&&form.topic.querySelector(`option[value="${CSS.escape(topic)}"]`))form.topic.value=topic;
 for(const el of document.querySelectorAll('[data-contact-email]')){if(CONTACT_EMAIL){el.textContent=CONTACT_EMAIL;el.href='mailto:'+CONTACT_EMAIL;}else el.closest('.side-card')?.setAttribute('hidden','');}
 form.addEventListener('submit',e=>{
  e.preventDefault();status.className='form-status';
  if(!form.checkValidity()){form.reportValidity();return;}
  if(!CONTACT_EMAIL){status.classList.add('error');status.textContent='Our inbox is being set up. Please try again soon.';return;}
  const data=new FormData(form),label=form.topic.selectedOptions[0].textContent;
  const body=`${data.get('message')}\n\n— ${data.get('name')}${data.get('org')?`, ${data.get('org')}`:''}\n${data.get('email')}`;
  location.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`GoGo: ${label}`)}&body=${encodeURIComponent(body)}`;
  status.textContent='Your email app should open with the message ready to send.';
 });
}

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
