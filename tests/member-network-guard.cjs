// Test child process only. Never loaded by the application or production build.
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(['localhost','127.0.0.1'].includes(url.hostname))return original(input,init);
 if(url.hostname==='www.youtube.com'&&url.pathname==='/oembed')return new Response(JSON.stringify({provider_name:'YouTube',title:'Synthetic verified video',author_name:'Synthetic channel'}),{headers:{'Content-Type':'application/json'}});
 throw new Error('External network blocked in isolated member-content test');
};
