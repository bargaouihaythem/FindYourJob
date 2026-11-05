const { chromium } = require('playwright');
const PW='password123';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true});
  const c=await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  const p=await c.newPage();
  await p.goto('http://localhost:4200/login',{waitUntil:'networkidle'});
  await p.fill('#username','manager.devops'); await p.fill('#password',PW);
  await p.click('button:has-text("Se connecter")');
  await p.waitForFunction(()=>!!localStorage.getItem('token'),null,{timeout:20000});
  await p.goto('http://localhost:4200/manager/candidates',{waitUntil:'networkidle'});
  await p.waitForSelector('tbody tr',{timeout:20000}); await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const t=document.querySelector('table.table-with-dropdowns');
    const ths=[...t.querySelectorAll('thead th')];
    const row=t.querySelector('tbody tr');
    const tds=[...row.children];
    return {scrollW:t.scrollWidth, cols:ths.map((h,i)=>({h:h.innerText.replace(/\n/g,' ').trim().slice(0,18),
      w:Math.round((tds[i]||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width)}))};
  }),null,1));
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
