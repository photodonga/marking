import { chromium } from "/home/claude/ieum/node_modules/playwright/index.mjs";
import { createServer } from "node:http"; import { readFile } from "node:fs/promises"; import path from "node:path";
const here="/home/claude/marking";
const server=createServer(async(req,res)=>{try{const p=path.resolve(here,"."+decodeURIComponent(new URL(req.url,"http://x").pathname));res.writeHead(200,{"Content-Type":p.endsWith(".js")?"text/javascript":"text/html"});res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const b=await chromium.launch();
for(const [w,h,mob] of [[390,844,true]]){
const page=await b.newPage({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob});const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const g=c.getContext('2d');for(let i=0;i<60;i++){g.fillStyle=`hsl(${i*37},70%,50%)`;g.fillRect((i%10)*120,Math.floor(i/10)*150,120,150);}const bl=await new Promise(r=>c.toBlob(r));const u=new Uint8Array(await bl.arrayBuffer());let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s)});
await page.setInputFiles("#fileInput",{name:"a.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});await page.waitForTimeout(600);
const hash=()=>page.evaluate(()=>{const c=document.getElementById('view-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])|0;return h});
await page.click('#btn-blur');await page.waitForTimeout(200);


const box=await page.locator('#view-canvas').boundingBox();
const h0=await hash();
if(mob){await page.touchscreen.tap(box.x+5,box.y+5);}
await page.mouse.move(box.x+box.width*.3,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.6,{steps:6});await page.mouse.up();await page.waitForTimeout(400);
const h1=await hash();
if(mob) await page.locator('#options-bar .option-mode button').nth(1).tap(); else await page.locator('#options-bar .option-mode button').nth(1).click();await page.waitForTimeout(400);const h2=await hash();
const st=await page.evaluate(()=>[...document.querySelectorAll('#options-bar .option-mode button')].map(b=>b.className).join(','));
const r=page.locator('#options-bar .option-intensity input[type=range]');const rb=await r.boundingBox();
if(mob){const cdp=await page.context().newCDPSession(page);const y=rb.y+rb.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rb.x+rb.width*0.5,y}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rb.x+rb.width*(0.5+i*0.07),y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});} else await page.mouse.click(rb.x+rb.width*0.95,rb.y+rb.height/2);await page.waitForTimeout(400);const h3=await hash();
const lab=await page.evaluate(()=>document.querySelector('#options-bar .option-intensity .effect-value-label')?.textContent);
console.log(w,{drawn:h0!==h1,mosaic:h1!==h2,modeBtns:st,slider:h2!==h3,lab,errs});await page.close();}
await b.close();server.close();
