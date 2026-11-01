"use strict";

// 成品相片：三種相紙都是真的「那個東西」，再貼上老日曆、車票、尪仔標、郵票這些小物。
const FRAME_STYLES = {
  album:{ ink:"#efe6d2" },
  postcard:{ ink:"#23435a" },
  red:{ ink:"#ffe9b8" },
  floral:{ ink:"#4a1c14" },
  notebook:{ ink:"#26415e" },
  news:{ ink:"#1d1a15" },
  yearbook:{ ink:"#f3e0ad" },
  theater:{ ink:"#ffd95c" }
};
const HAND = "'LXGW WenKai TC','Noto Serif TC',serif";
const SERIF = "'Noto Serif TC',serif";
const PHOTO_W = 520, PHOTO_H = 390;
const PHOTO_SLOTS = [{x:66,y:76,tilt:-.022},{x:316,y:444,tilt:.018},{x:66,y:808,tilt:-.014}];
// 上方有報頭、招牌的相紙，照片往下排
const LOW_SLOTS = [{x:60,y:206,tilt:-.016},{x:320,y:548,tilt:.014},{x:60,y:878,tilt:-.012}];
const CN_DAYS = "日一二三四五六";

function font(c,weight,size,family=SERIF){ c.font = `${weight} ${size}px ${family}`; }

function rotated(c,x,y,angle,draw){ c.save(); c.translate(x,y); c.rotate(angle); draw(); c.restore(); }

function verticalText(c,text,x,centerY,gap){
  const chars=[...text], top=centerY-(chars.length-1)*gap/2;
  c.textAlign="center"; c.textBaseline="middle";
  chars.forEach((ch,i)=>c.fillText(ch,x,top+i*gap));
}

function fibers(c,w,h,count,light){
  for(let i=0;i<count;i++){
    const white=Math.random()<light;
    c.fillStyle=`rgba(${white?"255,255,255":"0,0,0"},${.02+Math.random()*.05})`;
    c.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*20,1);
  }
}

function vignette(c,color){
  const g=c.createRadialGradient(450,750,420,450,750,990);
  g.addColorStop(0,`rgba(${color},0)`); g.addColorStop(1,`rgba(${color},.42)`);
  c.fillStyle=g; c.fillRect(0,0,900,1500);
}

// ── 三種相紙底 ─────────────────────────────
function paperAlbum(c){
  c.fillStyle="#1e1a16"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,7000,.75);
  vignette(c,"0,0,0");
  // 相本裝訂邊：打孔穿棉繩
  c.fillStyle="#2a241e"; c.fillRect(0,0,34,1500);
  c.lineWidth=6; c.lineCap="round";
  [270,750,1230].forEach(y=>{
    c.fillStyle="#0a0806"; c.beginPath(); c.arc(19,y,9,0,7); c.fill();
    c.strokeStyle="#e9dfc6"; c.beginPath(); c.moveTo(-4,y); c.lineTo(19,y); c.stroke();
  });
  c.lineCap="butt";
}

function paperPostcard(c){
  c.fillStyle="#efe3c8"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,6000,.5);
  vignette(c,"120,80,30");
  // 航空信封的紅藍斜紋邊
  const band=20, unit=46;
  c.save();
  c.beginPath(); c.rect(0,0,900,1500); c.rect(band,band,860,1460); c.clip("evenodd");
  for(let i=-3;i<60;i++){
    c.fillStyle=i%2?"#23507a":"#b5281f";
    c.save(); c.translate(i*unit*1.4,0); c.transform(1,0,-.6,1,0,0);
    c.fillRect(0,0,unit*.72,1500*1); c.restore();
  }
  c.restore();
}

function paperRed(c){
  const g=c.createLinearGradient(0,0,900,1500);
  g.addColorStop(0,"#b42a1f"); g.addColorStop(.5,"#a12218"); g.addColorStop(1,"#8c1b13");
  c.fillStyle=g; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,5000,.4);
  // 灑金
  for(let i=0;i<520;i++){
    c.fillStyle=`rgba(236,196,104,${.25+Math.random()*.6})`;
    const s=1+Math.random()*5;
    rotated(c,Math.random()*900,Math.random()*1500,Math.random()*3,()=>c.fillRect(-s/2,-s/2,s,s*.7));
  }
  vignette(c,"70,8,4");
  c.strokeStyle="#e6c26a"; c.lineWidth=6; c.strokeRect(22,22,856,1456);
  c.lineWidth=2; c.strokeRect(34,34,832,1432);
  [[34,34,0],[866,34,Math.PI/2],[866,1466,Math.PI],[34,1466,-Math.PI/2]].forEach(([x,y,a])=>rotated(c,x,y,a,()=>paperCutCorner(c)));
}

// 窗花剪紙的四角
function paperCutCorner(c){
  c.fillStyle="#e6c26a";
  c.beginPath(); c.moveTo(0,0); c.lineTo(112,0); c.quadraticCurveTo(100,30,74,30); c.quadraticCurveTo(58,34,56,56); c.quadraticCurveTo(34,58,30,74); c.quadraticCurveTo(30,100,0,112); c.closePath(); c.fill();
  c.fillStyle="#9c2017";
  [[20,20,10],[46,20,6],[20,46,6]].forEach(([x,y,r])=>{ c.beginPath(); c.arc(x,y,r,0,7); c.fill(); });
}

// 阿嬤的棉被花布：大紅底、粉牡丹
function peony(c,x,y,r){
  c.fillStyle="#2f7d5a";
  for(let i=0;i<5;i++){ const a=i*1.26+x; rotated(c,x+Math.cos(a)*r*1.1,y+Math.sin(a)*r*1.1,a,()=>{ c.beginPath(); c.ellipse(0,0,r*.72,r*.3,0,0,7); c.fill(); }); }
  [[1,"#f28ea3",9],[.72,"#f7b5c2",7],[.44,"#fde3e4",6]].forEach(([k,color,count])=>{
    c.fillStyle=color;
    for(let i=0;i<count;i++){ const a=i/count*6.283+k; c.beginPath(); c.arc(x+Math.cos(a)*r*k*.62,y+Math.sin(a)*r*k*.62,r*k*.46,0,7); c.fill(); }
  });
  c.fillStyle="#f4c84a"; c.beginPath(); c.arc(x,y,r*.14,0,7); c.fill();
}

function paperFloral(c){
  c.fillStyle="#b3241f"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,4000,.4);
  for(let row=0;row<8;row++) for(let col=0;col<6;col++){
    const x=(col+(row%2)*.5)*190-30, y=row*210+20;
    peony(c,x,y,62);
    c.fillStyle="#fbe6a0"; c.beginPath(); c.arc(x+96,y+104,15,0,7); c.fill();
    c.fillStyle="#2c6fa0"; c.beginPath(); c.arc(x+96,y+104,6,0,7); c.fill();
  }
  vignette(c,"70,8,4");
}

function clothPatch(c,x,y,w,h){
  c.save(); c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=14; c.shadowOffsetY=5;
  c.fillStyle="#f6ecd4"; c.fillRect(x,y,w,h); c.restore();
  c.strokeStyle="#b3241f"; c.lineWidth=3; c.setLineDash([14,9]); c.strokeRect(x+10,y+10,w-20,h-20); c.setLineDash([]);
}

// 國小作業簿：綠格子、紅線、老師的甲上
function paperNotebook(c){
  c.fillStyle="#f4eddb"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,4000,.5);
  c.strokeStyle="rgba(84,140,104,.5)"; c.lineWidth=1.5;
  for(let x=20;x<900;x+=72){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,1500); c.stroke(); }
  for(let y=20;y<1500;y+=72){ c.beginPath(); c.moveTo(0,y); c.lineTo(900,y); c.stroke(); }
  c.strokeStyle="#c9402f"; c.lineWidth=3; c.beginPath(); c.moveTo(38,0); c.lineTo(38,1500); c.stroke();
}

function gradeStamp(c,x,y,word){
  rotated(c,x,y,-.22,()=>{
    c.strokeStyle=c.fillStyle="#c9281e"; c.lineWidth=7; c.globalAlpha=.86;
    c.beginPath(); c.arc(0,0,76,0,7); c.stroke();
    font(c,700,54,HAND); c.textAlign="center"; c.textBaseline="middle"; c.fillText(word,0,3);
    c.globalAlpha=1;
  });
}

function bookLabel(c,x,y,scene,roc){
  const w=222, h=282;
  rotated(c,x,y,.03,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.35)"; c.shadowBlur=10; c.shadowOffsetY=4;
    c.fillStyle="#fffaf0"; c.fillRect(-w/2,-h/2,w,h); c.restore();
    c.strokeStyle="#c9402f"; c.lineWidth=3; c.strokeRect(-w/2+8,-h/2+8,w-16,h-16);
    c.fillStyle="#26415e"; c.textAlign="center"; c.textBaseline="middle";
    font(c,700,35); c.fillText("國語作業簿",0,-82);
    font(c,700,24,HAND); c.textAlign="left";
    c.fillText("班級：願望班",-w/2+24,-22);
    c.fillText(`地點：${scene.icon}`,-w/2+24,24);
    c.fillText(`日期：${roc}`,-w/2+24,70);
  });
}

function pencil(c,x,y,angle){
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.35)"; c.shadowBlur=8; c.shadowOffsetY=5;
    c.fillStyle="#e9b52e"; c.fillRect(-120,-11,220,22); c.restore();
    c.fillStyle="#c9972a"; c.fillRect(-120,3,220,8);
    c.fillStyle="#e8c8a0"; c.beginPath(); c.moveTo(100,-11); c.lineTo(138,0); c.lineTo(100,11); c.fill();
    c.fillStyle="#2a2a2a"; c.beginPath(); c.moveTo(126,-3.5); c.lineTo(138,0); c.lineTo(126,3.5); c.fill();
    c.fillStyle="#b9b9b0"; c.fillRect(-136,-11,18,22);
    c.fillStyle="#e27f8c"; c.fillRect(-158,-11,24,22);
  });
}

function goldStar(c,x,y,r,color="#e8b72e"){
  c.fillStyle=color; c.beginPath();
  for(let i=0;i<10;i++){ const a=i*Math.PI/5-Math.PI/2, q=i%2?r*.45:r; c.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q); }
  c.closePath(); c.fill();
}

// 老報紙：直排報頭、灰字欄
function paperNews(c){
  c.fillStyle="#e6dcc0"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,9000,.3);
  vignette(c,"110,80,40");
}

// 小字內文：用真的字直排，看起來才像報紙
function newsText(c,text,x,y,w,h){
  const chars=[...text.repeat(40)], size=17, rows=Math.floor(h/(size+2));
  c.fillStyle="rgba(40,34,26,.82)"; font(c,600,size); c.textAlign="center"; c.textBaseline="middle";
  let i=0;
  for(let col=x+w-size/2;col>x;col-=size+7) for(let row=0;row<rows;row++) c.fillText(chars[i++],col,y+row*(size+2)+size/2);
}

function newsMasthead(c,date,roc,serial){
  c.fillStyle="#1d1a15"; font(c,700,112); c.textAlign="left"; c.textBaseline="middle"; c.fillText("願望日報",48,104);
  font(c,700,24); c.textAlign="right";
  c.fillText(`中華民國${date.getFullYear()-1911}年${date.getMonth()+1}月${date.getDate()}日`,852,62);
  c.fillText(`星期${CN_DAYS[date.getDay()]}　第 ${serial} 號`,852,100);
  c.fillText("零售每份壹圓",852,138);
  c.fillRect(44,176,812,6); c.fillRect(44,186,812,2);
}

// 畢業冊：藍布面、燙金字
function paperYearbook(c){
  c.fillStyle="#1f3450"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,9000,.55);
  vignette(c,"6,12,26");
  c.strokeStyle="#d8b65e"; c.lineWidth=5; c.strokeRect(24,24,852,1452);
  c.lineWidth=2; c.strokeRect(36,36,828,1428);
}

function schoolBadge(c,x,y,r,word){
  c.strokeStyle=c.fillStyle="#d8b65e"; c.lineWidth=4;
  c.beginPath(); c.arc(x,y,r,0,7); c.stroke();
  c.lineWidth=2; c.beginPath(); c.arc(x,y,r-9,0,7); c.stroke();
  goldStar(c,x,y-2,r*.56,"#d8b65e");
  c.fillStyle="#1f3450"; font(c,700,r*.32); c.textAlign="center"; c.textBaseline="middle"; c.fillText(word,x,y);
}

// 戲院看板：深藍底、膠卷孔、手繪大字
function paperTheater(c){
  c.fillStyle="#13202e"; c.fillRect(0,0,900,1500);
  fibers(c,900,1500,6000,.5);
  vignette(c,"0,0,0");
  c.fillStyle="#05090e"; c.fillRect(0,0,38,1500); c.fillRect(862,0,38,1500);
  c.fillStyle="#f3e6cc";
  for(let y=14;y<1500;y+=46){ [9,871].forEach(x=>c.fillRect(x,y,20,26)); }
}

function paintedTitle(c,title){
  c.textAlign="center"; c.textBaseline="middle";
  font(c,700,30); c.fillStyle="#f3e6cc"; c.fillText("★ 本 日 放 映 ★",450,52);
  let size=96; do{ font(c,700,size); size-=4; }while(c.measureText(title).width>760);
  c.lineWidth=12; c.strokeStyle="#a8181c"; c.lineJoin="round"; c.strokeText(title,450,128);
  c.fillStyle="#ffd95c"; c.fillText(title,450,128);
}

function movieTicket(c,x,y,angle,serial){
  const w=220, h=120;
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.6)"; c.shadowBlur=12; c.shadowOffsetY=5;
    c.fillStyle="#e9a6a0"; c.fillRect(-w/2,-h/2,w,h); c.restore();
    c.strokeStyle="#7a241f"; c.lineWidth=2; c.strokeRect(-w/2+7,-h/2+7,w-14,h-14);
    c.setLineDash([6,6]); c.beginPath(); c.moveTo(w/2-58,-h/2); c.lineTo(w/2-58,h/2); c.stroke(); c.setLineDash([]);
    c.fillStyle="#7a241f"; c.textAlign="center"; c.textBaseline="middle";
    font(c,700,34); c.fillText("戲 票",-34,-16);
    font(c,600,19); c.fillText(`全票 壹圓`,-34,26);
    font(c,600,16); c.fillText(serial.slice(0,3),w/2-30,0);
  });
}

// ── 舊照片 ─────────────────────────────
function deckle(c,x,y,w,h){
  const step=14, bite=3.6;
  c.beginPath(); c.moveTo(x,y);
  for(let p=x;p<x+w;p+=step) c.quadraticCurveTo(p+step/2,y-bite,p+step,y);
  for(let p=y;p<y+h;p+=step) c.quadraticCurveTo(x+w+bite,p+step/2,x+w,p+step);
  for(let p=x+w;p>x;p-=step) c.quadraticCurveTo(p-step/2,y+h+bite,p-step,y+h);
  for(let p=y+h;p>y;p-=step) c.quadraticCurveTo(x-bite,p-step/2,x,p-step);
  c.closePath();
}

function photoCorners(c,w,h,border){
  const size=66, o=border+9;
  [[-o,-o,1,1],[w+o,-o,-1,1],[w+o,h+o,-1,-1],[-o,h+o,1,-1]].forEach(([x,y,sx,sy])=>{
    c.fillStyle="#d9c9a4";
    c.beginPath(); c.moveTo(x,y); c.lineTo(x+size*sx,y); c.lineTo(x,y+size*sy); c.closePath(); c.fill();
    c.strokeStyle="rgba(0,0,0,.35)"; c.lineWidth=1.5; c.stroke();
  });
}

function tape(c,x,y,angle,color){
  rotated(c,x,y,angle,()=>{
    c.fillStyle=color; c.fillRect(-62,-17,124,34);
    c.strokeStyle="rgba(255,255,255,.2)"; c.lineWidth=1;
    for(let i=-56;i<62;i+=12){ c.beginPath(); c.moveTo(i,-17); c.lineTo(i+4,17); c.stroke(); }
  });
}

function oldPhoto(c,img,slot,kind,caption){
  const w=PHOTO_W, h=PHOTO_H, border=20;
  rotated(c,slot.x+w/2,slot.y+h/2,slot.tilt,()=>{
    c.translate(-w/2,-h/2);
    c.save();
    c.shadowColor="rgba(10,5,0,.55)"; c.shadowBlur=20; c.shadowOffsetY=9;
    deckle(c,-border,-border,w+border*2,h+border*2);
    c.fillStyle="#fbf5e6"; c.fill();
    c.restore();
    if(kind==="news") c.filter="grayscale(1) contrast(1.12)";
    c.drawImage(img,0,0,w,h);
    c.filter="none";
    c.strokeStyle="rgba(60,40,20,.3)"; c.lineWidth=1; c.strokeRect(0,0,w,h);
    if(caption){
      // 照相館常見的白字題字
      c.save(); c.fillStyle="#fff"; c.shadowColor="rgba(0,0,0,.8)"; c.shadowBlur=5;
      font(c,700,27,HAND); c.textAlign="left"; c.textBaseline="alphabetic"; c.fillText(caption,16,h-16); c.restore();
    }
    if(kind==="album") photoCorners(c,w,h,border);
    if(kind==="postcard"||kind==="notebook"){ tape(c,w/2,-border,.03,"rgba(226,206,150,.78)"); }
    if(kind==="red"){ c.strokeStyle="#e6c26a"; c.lineWidth=3; c.strokeRect(-border+6,-border+6,w+border*2-12,h+border*2-12); }
  });
}

// ── 小物 ─────────────────────────────
function calendar(c,x,y,angle,date){
  const w=196, h=264;
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=14; c.shadowOffsetY=6;
    c.fillStyle="#fdf8ea"; c.fillRect(-w/2,-h/2,w,h); c.restore();
    c.fillStyle="#b5281f"; c.fillRect(-w/2,-h/2,w,50);
    c.fillStyle="#fff3d6"; font(c,700,25); c.textAlign="center"; c.textBaseline="middle";
    c.fillText(`民國${date.getFullYear()-1911}年`,0,-h/2+25);
    c.fillStyle="#3a2a1c"; font(c,700,28); c.fillText(`${date.getMonth()+1} 月`,0,-h/2+78);
    const sunday=date.getDay()===0;
    c.fillStyle=sunday?"#b5281f":"#1f1a16"; font(c,700,112); c.fillText(String(date.getDate()),0,16);
    font(c,700,27); c.fillStyle="#3a2a1c"; c.fillText(`星期${CN_DAYS[date.getDay()]}`,0,h/2-54);
    font(c,600,22); c.fillStyle="#7a5a3a"; c.fillText(lunarText(date),0,h/2-22);
    // 撕下來的鋸齒
    c.fillStyle="rgba(0,0,0,.28)";
    for(let i=0;i<9;i++){ c.beginPath(); c.arc(-w/2+11+i*22,-h/2-1,5,0,7); c.fill(); }
  });
}

function lunarText(date){
  try{
    const parts=new Intl.DateTimeFormat("zh-TW-u-ca-chinese",{month:"long",day:"numeric"}).formatToParts(date);
    const month=parts.find(p=>p.type==="month").value, day=Number(parts.find(p=>p.type==="day").value);
    const ones="一二三四五六七八九十"[(day-1)%10];
    const name=day<=10?`初${ones}`:day<20?`十${ones}`:day===20?"二十":day<30?`廿${ones}`:"三十";
    return `農曆${month}${name}`;
  }catch(_){ return ""; }
}

function trainTicket(c,x,y,angle,title,serial){
  const w=330, h=150, dest=title.length>5?title.slice(0,5):title;
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=12; c.shadowOffsetY=5;
    c.fillStyle="#d7e3b8"; c.fillRect(-w/2,-h/2,w,h); c.restore();
    c.strokeStyle="#4a6a3a"; c.lineWidth=2; c.strokeRect(-w/2+8,-h/2+8,w-16,h-16);
    c.fillStyle="#2a3f22"; c.textBaseline="middle"; c.textAlign="center";
    font(c,700,20); c.fillText("普 通 車 ‧ 願 望 號",0,-h/2+30);
    let size=42;
    do{ font(c,700,size); size-=2; }while(c.measureText(`願望 → ${dest}`).width>w-48);
    c.fillText(`願望 → ${dest}`,0,4);
    font(c,600,19); c.textAlign="left"; c.fillText("票價 壹圓",-w/2+20,h/2-27);
    c.textAlign="right"; c.fillText(`No. ${serial}`,w/2-20,h/2-27);
    // 剪票口
  });
}

function pogCard(c,x,y,radius,word,angle){
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=12; c.shadowOffsetY=5;
    c.fillStyle="#f4d34c"; c.beginPath(); c.arc(0,0,radius,0,7); c.fill(); c.restore();
    for(let i=0;i<16;i++){
      c.fillStyle=i%2?"#d8301f":"#f4d34c";
      const a=i*Math.PI/8;
      c.beginPath(); c.moveTo(0,0); c.arc(0,0,radius-7,a,a+Math.PI/8); c.closePath(); c.fill();
    }
    c.lineWidth=5; c.strokeStyle="#1d3f7a"; c.beginPath(); c.arc(0,0,radius-3,0,7); c.stroke();
    c.fillStyle="#fff6df"; c.beginPath(); c.arc(0,0,radius*.56,0,7); c.fill();
    c.strokeStyle="#1d3f7a"; c.lineWidth=3; c.stroke();
    c.fillStyle="#b5281f"; font(c,700,radius*.62); c.textAlign="center"; c.textBaseline="middle"; c.fillText(word,0,3);
  });
}

function stamp(c,x,y,angle,scene,title){
  const w=210, h=250;
  rotated(c,x,y,angle,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.4)"; c.shadowBlur=10; c.shadowOffsetY=4;
    c.fillStyle="#fbf5e6"; c.beginPath();
    const r=7, step=20;
    c.moveTo(-w/2,-h/2);
    for(let p=-w/2;p<w/2;p+=step) c.arc(p+step/2,-h/2,r,Math.PI,0,false);
    for(let p=-h/2;p<h/2;p+=step) c.arc(w/2,p+step/2,r,-Math.PI/2,Math.PI/2,false);
    for(let p=w/2;p>-w/2;p-=step) c.arc(p-step/2,h/2,r,0,Math.PI,false);
    for(let p=h/2;p>-h/2;p-=step) c.arc(-w/2,p-step/2,r,Math.PI/2,-Math.PI/2,false);
    c.closePath(); c.fill(); c.restore();
    if(scene){
      const pw=w-36, ph=h-76, sr=Math.max(pw/scene.naturalWidth,ph/scene.naturalHeight);
      const sw=pw/sr, sh=ph/sr;
      c.drawImage(scene,(scene.naturalWidth-sw)/2,(scene.naturalHeight-sh)/2,sw,sh,-pw/2,-h/2+18,pw,ph);
    }
    c.fillStyle="#b5281f"; font(c,700,21); c.textAlign="left"; c.textBaseline="middle"; c.fillText("壹圓",-w/2+18,h/2-30);
    c.textAlign="right"; font(c,600,17); c.fillStyle="#3a2a1c"; c.fillText(title.slice(0,6),w/2-18,h/2-30);
  });
}

function postmark(c,x,y,color,top,bottom){
  rotated(c,x,y,-.16,()=>{
    c.strokeStyle=c.fillStyle=color; c.globalAlpha=.8;
    c.lineWidth=5; c.beginPath(); c.arc(0,0,96,0,7); c.stroke();
    c.lineWidth=2; c.beginPath(); c.arc(0,0,84,0,7); c.stroke();
    c.beginPath(); c.moveTo(-84,-20); c.lineTo(84,-20); c.moveTo(-84,26); c.lineTo(84,26); c.stroke();
    c.textAlign="center"; c.textBaseline="middle";
    font(c,700,24); c.fillText(top,0,-50);
    font(c,700,27); c.fillText(bottom,0,3);
    font(c,700,24); c.fillText("願望郵便",0,54);
    c.globalAlpha=1;
  });
}

function fuDiamond(c,x,y,size){
  rotated(c,x,y,Math.PI/4,()=>{
    c.save(); c.shadowColor="rgba(0,0,0,.45)"; c.shadowBlur=14; c.shadowOffsetY=5;
    c.fillStyle="#f0cf7c"; c.fillRect(-size/2,-size/2,size,size); c.restore();
    c.strokeStyle="#a12218"; c.lineWidth=4; c.strokeRect(-size/2+10,-size/2+10,size-20,size-20);
    c.rotate(-Math.PI/4);
    c.fillStyle="#a12218"; font(c,700,size*.68); c.textAlign="center"; c.textBaseline="middle"; c.fillText("福",0,4);
  });
}

function blessing(c,text,color,x,width,top,bottom,family=HAND){
  c.textAlign="left"; c.textBaseline="alphabetic";
  let size=50;
  const measure=()=>{
    font(c,700,size,family);
    const lines=[]; let line="";
    [...text].forEach(ch=>{ const t=line+ch; if(c.measureText(t).width>width && line && !"，。、！？；：」』）".includes(ch)){ lines.push(line); line=ch; } else line=t; });
    if(line) lines.push(line);
    return lines;
  };
  let lines=measure();
  while(size>24 && lines.length*size*1.45>bottom-top){ size-=2; lines=measure(); }
  const start=top+(bottom-top-lines.length*size*1.45)/2+size;
  c.fillStyle=color;
  lines.forEach((line,i)=>c.fillText(line,x,start+i*size*1.45));
}

function ruledLines(c,x,width,top,gap,count,color){
  c.strokeStyle=color; c.lineWidth=1.5; c.setLineDash([3,6]);
  for(let i=0;i<count;i++){ c.beginPath(); c.moveTo(x,top+i*gap); c.lineTo(x+width,top+i*gap); c.stroke(); }
  c.setLineDash([]);
}

// ── 組起來 ─────────────────────────────
async function renderCollage(c,{images,frame,scene,sceneImage,blessingText}){
  const date=new Date(), serial=String(Math.floor(Math.random()*90000)+10000);
  const roc=`${date.getFullYear()-1911}.${date.getMonth()+1}.${date.getDate()}`;
  const text=blessingText||"願您平安健康，天天歡喜。";
  await Promise.allSettled([
    document.fonts.load(`700 40px 'LXGW WenKai TC'`,text+scene.title+"留影"),
    document.fonts.load(`700 40px 'Noto Serif TC'`,scene.title+scene.poem+"民國普通車願望號票價壹圓福好運星期月年農曆明信片郵便國語作業簿班級地點日期老師評語甲上優本報記者今日前往採訪鄉親都說子平安最要緊大家歡喜合照留念轉來坐影業全省聯映日報日報中華星期第零售每份同窗留念畢業贈言勿忘影中人友誼長存本日放映戲全學校屆")
  ]);
  c.canvas.width=900; c.canvas.height=1500;
  const caption=`${scene.title}留影 ${roc}`;

  if(frame==="album"){
    paperAlbum(c);
    images.forEach((img,i)=>oldPhoto(c,img,PHOTO_SLOTS[i],"album",i===2?caption:""));
    calendar(c,752,206,.05,date);
    trainTicket(c,180,640,-1.38,scene.title,serial);
    c.fillStyle=FRAME_STYLES.album.ink; font(c,700,50,HAND); verticalText(c,scene.title,748,1000,52);
    pogCard(c,762,1192,56,"好",.2);
    blessing(c,text,FRAME_STYLES.album.ink,86,750,1254,1466);
  }else if(frame==="postcard"){
    paperPostcard(c);
    images.forEach((img,i)=>oldPhoto(c,img,PHOTO_SLOTS[i],"postcard",i===2?caption:""));
    stamp(c,758,214,.03,sceneImage,scene.title);
    postmark(c,742,412,"#2b2b2b",scene.icon,roc);
    calendar(c,166,640,-.06,date);
    trainTicket(c,752,1030,1.42,scene.title,serial);
    c.fillStyle=FRAME_STYLES.postcard.ink; font(c,700,28); c.textAlign="left"; c.textBaseline="middle";
    c.fillText("明信片　POST CARD",74,1262);
    ruledLines(c,70,760,1346,56,2,"rgba(35,67,90,.55)");
    blessing(c,text,FRAME_STYLES.postcard.ink,74,750,1290,1464);
  }else if(frame==="floral"){
    paperFloral(c);
    images.forEach((img,i)=>oldPhoto(c,img,PHOTO_SLOTS[i],"red",i===2?caption:""));
    calendar(c,752,226,.05,date);
    trainTicket(c,180,640,-1.38,scene.title,serial);
    clothPatch(c,664,876,172,330);
    c.fillStyle=FRAME_STYLES.floral.ink; font(c,700,44,HAND); verticalText(c,scene.title.slice(0,6),750,1040,50);
    clothPatch(c,52,1244,796,226);
    blessing(c,text,FRAME_STYLES.floral.ink,84,732,1262,1452);
  }else if(frame==="notebook"){
    paperNotebook(c);
    images.forEach((img,i)=>oldPhoto(c,img,PHOTO_SLOTS[i],"notebook",i===2?caption:""));
    bookLabel(c,750,232,scene,roc);
    pencil(c,170,650,-.5);
    goldStar(c,100,520,44); goldStar(c,214,760,34,"#d8503f");
    gradeStamp(c,750,1020,"甲上");
    c.fillStyle="#c9281e"; font(c,700,34,HAND); c.textAlign="center"; c.textBaseline="middle"; c.fillText("老師評語",750,1168);
    blessing(c,text,FRAME_STYLES.notebook.ink,78,750,1250,1464);
  }else if(frame==="news"){
    paperNews(c);
    newsMasthead(c,date,roc,serial);
    const story=`${scene.title}${scene.poem}本報記者今日前往採訪，鄉親都說日子平安最要緊，大家歡歡喜喜合照留念。`;
    newsText(c,story,616,206,240,330);
    newsText(c,story,44,560,258,306);
    newsText(c,story,616,1006,240,270);
    images.forEach((img,i)=>oldPhoto(c,img,LOW_SLOTS[i],"news",i===2?caption:""));
    c.fillStyle="#1d1a15"; c.fillRect(44,1300,812,4);
    font(c,700,27); c.textAlign="left"; c.textBaseline="middle"; c.fillText(`本報訊　${scene.icon}傳來好消息：`,50,1330);
    blessing(c,text,FRAME_STYLES.news.ink,50,800,1350,1476,SERIF);
  }else if(frame==="yearbook"){
    paperYearbook(c);
    c.fillStyle=FRAME_STYLES.yearbook.ink; font(c,700,74); c.textAlign="center"; c.textBaseline="middle"; c.fillText("同 窗 留 念",450,96);
    font(c,700,26); c.fillText(`民國${date.getFullYear()-1911}年　願望國民學校　第${Number(serial.slice(0,2))}屆畢業`,450,162);
    schoolBadge(c,110,104,52,"願");
    images.forEach((img,i)=>oldPhoto(c,img,LOW_SLOTS[i],"plain",i===2?caption:""));
    c.fillStyle=FRAME_STYLES.yearbook.ink; font(c,700,46,HAND); verticalText(c,"勿忘影中人",738,372,50);
    verticalText(c,"友誼長存",170,738,50);
    verticalText(c,scene.title.slice(0,6),742,1092,44);
    c.save(); c.shadowColor="rgba(0,0,0,.5)"; c.shadowBlur=12; c.fillStyle="#f4ead2"; c.fillRect(60,1300,780,170); c.restore();
    blessing(c,text,"#26334a",84,732,1306,1464);
  }else if(frame==="theater"){
    paperTheater(c);
    paintedTitle(c,scene.title);
    images.forEach((img,i)=>oldPhoto(c,img,LOW_SLOTS[i],"plain",i===2?caption:""));
    goldStar(c,740,270,40,"#ffd95c"); goldStar(c,800,360,28,"#ffd95c"); goldStar(c,696,392,22,"#ffd95c");
    c.fillStyle="#f3e6cc"; font(c,700,32,HAND); verticalText(c,"轉來坐影業",170,738,42);
    movieTicket(c,742,1064,-.12,serial);
    c.fillStyle="#f3e6cc"; font(c,700,26); c.textAlign="center"; c.textBaseline="middle"; c.fillText("全 省 聯 映",742,1190);
    blessing(c,text,FRAME_STYLES.theater.ink,76,748,1300,1470);
  }else{
    paperRed(c);
    images.forEach((img,i)=>oldPhoto(c,img,PHOTO_SLOTS[i],"red",i===2?caption:""));
    calendar(c,752,226,.05,date);
    fuDiamond(c,170,640,190);
    c.fillStyle=FRAME_STYLES.red.ink; font(c,700,50,HAND); verticalText(c,scene.title,748,1000,52);
    pogCard(c,762,1192,56,"福",-.2);
    blessing(c,text,FRAME_STYLES.red.ink,78,744,1250,1452);
  }
}
