// Light / dark mode for the website and the Android app. Loaded in <head> so the page never flashes the
// wrong theme. Default follows the device; a choice made with a toggle is remembered.
(function(){
 var KEY='gogo-theme',root=document.documentElement,native=window.GoGoNative;
 var mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
 function stored(){try{var v=localStorage.getItem(KEY);return v==='light'||v==='dark'?v:'system';}catch(e){return 'system';}}
 function systemDark(){try{if(native&&native.isSystemDark)return !!native.isSystemDark();}catch(e){}return mq?mq.matches:true;}
 function resolved(){var s=stored();return s==='system'?(systemDark()?'dark':'light'):s;}
 function sync(){
  var t=resolved(),s=stored();
  document.querySelectorAll('[data-theme-toggle]').forEach(function(b){b.setAttribute('aria-label',t==='dark'?'Switch to light mode':'Switch to dark mode');b.title=b.getAttribute('aria-label');});
  document.querySelectorAll('[data-theme-choice]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-theme-choice')===s));});
 }
 function apply(){
  var t=resolved();root.setAttribute('data-theme',t);root.style.colorScheme=t;
  var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',t==='light'?'#f4f3ef':'#0a0a0a');
  try{if(native&&native.setThemeColors)native.setThemeColors(t==='light');}catch(e){}
  try{window.dispatchEvent(new CustomEvent('gogo-theme',{detail:t}));}catch(e){}
  sync();
 }
 function set(v){try{if(v==='system')localStorage.removeItem(KEY);else localStorage.setItem(KEY,v);}catch(e){}apply();}
 if(mq){var onChange=function(){if(stored()==='system')apply();};if(mq.addEventListener)mq.addEventListener('change',onChange);else if(mq.addListener)mq.addListener(onChange);}
 window.GoGoTheme={resolved:resolved,stored:stored,set:set,toggle:function(){set(resolved()==='dark'?'light':'dark');}};
 apply();
 document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('[data-theme-toggle]').forEach(function(b){b.addEventListener('click',function(){window.GoGoTheme.toggle();});});
  document.querySelectorAll('[data-theme-choice]').forEach(function(b){b.addEventListener('click',function(){set(b.getAttribute('data-theme-choice'));});});
  apply();
 });
})();
