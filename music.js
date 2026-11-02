"use strict";

// 〈雨夜花〉國樂演奏版：二胡、梆笛、撥弦、揚琴都是真實樂器的錄音取樣，由 Web Audio 依譜演奏。來源見 assets/CREDITS.md。
// 曲：鄧雨賢（1944 年歿），只用旋律、不用歌詞。
// 記譜依簡譜空間的版本（3/4）：[音高, 拍數]，音高用 C 大調 MIDI 編號。
const G3=55, A3=57, C4=60, D4=62, E4=64, G4=67;
const BARS = [
  { chord:"C",  notes:[[G3,.5],[A3,.5],[G3,1],[E4,1]] },
  { chord:"Am", notes:[[E4,.5],[D4,.5],[C4,.5],[A3,.5],[G3,1]] },
  { chord:"C",  notes:[[C4,.5],[D4,.5],[E4,1],[G4,.5],[C4,.25],[D4,.25]] },
  { chord:"G",  notes:[[E4,.5],[E4,.5],[D4,2]] },
  { chord:"C",  notes:[[G4,.5],[G4,.5],[G4,.5],[E4,.25],[G4,.25],[E4,1]] },
  { chord:"Am", notes:[[E4,.5],[D4,.25],[E4,.25],[D4,.5],[C4,.5],[A3,1]] },
  { chord:"C",  notes:[[G3,.5],[A3,.5],[G3,1],[E4,1]] },
  { chord:"C",  notes:[[E4,.5],[D4,.5],[C4,2]] }
];
const CHORDS = { C:[48,60,64,67], Am:[45,60,64,69], G:[43,59,62,67] };
const BPM = 84;
const BEAT = 60/BPM;
const midiToHz = n => 440*Math.pow(2,(n-69)/12);

const RetroMusic = (() => {
  let ac=null, master=null, mix=null, room=null, timer=null, nextBarTime=0, barIndex=0, pass=0, playing=false, keeper=null;

  // 一個房間的殘響：老錄音的空氣感都在這裡
  function makeRoom(){
    const length=ac.sampleRate*1.7, impulse=ac.createBuffer(2,length,ac.sampleRate);
    for(let ch=0;ch<2;ch++){
      const data=impulse.getChannelData(ch);
      for(let i=0;i<length;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3.2);
    }
    const reverb=ac.createConvolver(), wet=ac.createGain();
    reverb.buffer=impulse; wet.gain.value=.34;
    reverb.connect(wet).connect(master);
    return reverb;
  }

  function out(node,send=.5){
    node.connect(mix);
    const gain=ac.createGain(); gain.gain.value=send;
    node.connect(gain).connect(room);
  }

  // 每個音的錄音與它實際的音高，用最近的一支移調，所以不會聽得出變調
  const SAMPLES={"erhu":[["erhu-D4",62.02],["erhu-F4",65.04],["erhu-Gs4",67.95],["erhu-B4",70.86],["erhu-D5",74.02],["erhu-F5",77.04],["erhu-Gs5",80.03]],"dizi":[["dizi-077",77.04],["dizi-079",79.08],["dizi-081",81.04],["dizi-084",84.27],["dizi-086",86.25],["dizi-088",88.23],["dizi-091",91.08]],"pluck":[["koto-G2",43],["koto-A2",45],["koto-C3",48.06],["koto-B3",59.06],["koto-C4",60.06],["koto-D4",62.02],["koto-E4",63.97],["koto-G4",66.92],["koto-A4",68.95]],"dulcimer":[["dulcimer-B4",71.06],["dulcimer-C5",72.06],["dulcimer-D5",74.02],["dulcimer-E5",75.97],["dulcimer-G5",79.08],["dulcimer-A5",81.04]]};
  let loading=null;
  const buffers={};
  function loadSamples(){
    if(!loading) loading=Promise.all(Object.values(SAMPLES).flat().map(async([name])=>{
      const response=await fetch(`assets/music/${name}.mp3`);
      buffers[name]=await ac.decodeAudioData(await response.arrayBuffer());
    })).catch(error=>{ console.warn("音樂載入失敗",error); loading=null; });
    return loading;
  }

  // 人不會每個音都一樣大、一樣準時
  const human=(amount)=>(Math.random()*2-1)*amount;

  function play(group,midi,t,dur,level,{from=null,attack=.015,release=.07,send=.4}={}){
    const [name,root]=SAMPLES[group].reduce((best,item)=>Math.abs(item[1]-midi)<Math.abs(best[1]-midi)?item:best);
    if(!buffers[name]) return;
    t=Math.max(t,ac.currentTime);
    const src=ac.createBufferSource(), env=ac.createGain(), rate=Math.pow(2,(midi-root)/12);
    src.buffer=buffers[name];
    if(from===null) src.playbackRate.value=rate;
    else{
      // 從上一個音滑過來，音程越大滑得越久
      const leap=Math.abs(midi-from);
      src.playbackRate.setValueAtTime(rate*Math.pow(2,(from-midi)/12),t);
      src.playbackRate.setTargetAtTime(rate,t,leap>2?.05:.025);
    }
    env.gain.setValueAtTime(.0001,t);
    env.gain.linearRampToValueAtTime(level,t+attack);
    env.gain.setTargetAtTime(.0001,t+dur,release);
    src.connect(env); out(env,send);
    src.start(t); src.stop(t+dur+release*6);
  }

  let erhuMidi=null, erhuEnd=0;
  function erhuLine(notes,level){
    notes.forEach(([midi,at,dur])=>{
      const from=erhuMidi!==null && at-erhuEnd<.25 && erhuMidi!==midi ? erhuMidi : null;
      play("erhu",midi,at+human(.008),dur+.05,level*(1+human(.1)),{from,attack:from===null?.05:.03,release:.09,send:.45});
      erhuMidi=midi; erhuEnd=at+dur;
    });
  }

  function dizi(midi,t,dur,level){
    play("dizi",midi,t+human(.006),dur+.03,level*(1+human(.08)),{attack:.012,release:.06,send:.5});
  }

  function pluck(midi,t,level){ play("pluck",midi,t+human(.006),1.6,level*(1+human(.12)),{attack:.002,release:.3,send:.25}); }
  function dulcimer(midi,t,level=.3){ play("dulcimer",midi,t+human(.005),1.4,level*(1+human(.15)),{attack:.002,release:.35,send:.45}); }

  // 三輪編曲：二胡先唱，笛子在句尾應和；第二輪換笛子，二胡托在底下；第三輪一起收
  function scheduleBar(bar,t,index){
    let at=t;
    const line=bar.notes.map(([midi,beats])=>{ const note=[midi,at,beats*BEAT]; at+=beats*BEAT; return note; });
    const [bass,...upper]=CHORDS[bar.chord];
    const lead=level=>line.forEach(([midi,start,dur])=>dizi(midi+24,start,dur,level));
    if(pass===0){
      erhuLine(line.map(([m,a,d])=>[m+12,a,d]),.85);
      if(index===3||index===7){ dizi(upper[2]+12,t+1.5*BEAT,.75*BEAT,.4); dizi(upper[1]+12,t+2.25*BEAT,.7*BEAT,.4); }
    }else if(pass===1){
      lead(.6);
      erhuLine([[upper[1],t,1.5*BEAT],[upper[2],t+1.5*BEAT,1.4*BEAT]],.42);
    }else{
      erhuLine(line.map(([m,a,d])=>[m+12,a,d]),.75);
      lead(.34);
    }
    pluck(bass,t,.6);
    [1,2].forEach(beat=>upper.forEach(n=>pluck(n,t+beat*BEAT,.2)));
    if(pass>0) [0,1,2,1,2,1].forEach((n,i)=>dulcimer(upper[n]+12,t+i*BEAT/2));
  }

  function tick(){
    if(ac.state!=="running"){ ac.resume().catch(()=>{}); return; }
    if(nextBarTime<ac.currentTime) nextBarTime=ac.currentTime+.12; // 手機被暫停過，從現在接著放
    while(nextBarTime<ac.currentTime+.8){
      scheduleBar(BARS[barIndex],nextBarTime,barIndex);
      nextBarTime+=3*BEAT;
      barIndex=(barIndex+1)%BARS.length;
      if(barIndex===0){ pass=(pass+1)%3; nextBarTime+=3*BEAT; } // 一輪之後空一小節
    }
  }

  function context(){
    if(!ac){
      ac=new (window.AudioContext||window.webkitAudioContext)();
      const limiter=ac.createDynamicsCompressor();
      limiter.threshold.value=-12; limiter.ratio.value=8;
      master=ac.createGain(); master.gain.value=.0001;
      master.connect(limiter).connect(ac.destination);
      mix=ac.createGain(); mix.connect(master);
      room=makeRoom();
      ac.addEventListener("statechange",()=>{ if(playing && ac.state!=="running") ac.resume().catch(()=>{}); });
    }
    return ac;
  }

  // iPhone 只在 click/touchend 裡才准出聲，而且靜音鍵會把 Web Audio 一起關掉；
  // 播一段無聲的 <audio>，聲音就走媒體音量，靜音鍵開著也聽得到
  function unlock(){
    context();
    if(ac.state!=="running") ac.resume().catch(()=>{});
    const blip=ac.createBufferSource();
    blip.buffer=ac.createBuffer(1,1,ac.sampleRate);
    blip.connect(ac.destination); blip.start();
    if(!keeper){
      const rate=8000, size=rate, wav=new DataView(new ArrayBuffer(44+size));
      [..."RIFF"].forEach((ch,i)=>wav.setUint8(i,ch.charCodeAt(0)));
      wav.setUint32(4,36+size,true);
      [..."WAVEfmt "].forEach((ch,i)=>wav.setUint8(8+i,ch.charCodeAt(0)));
      wav.setUint32(16,16,true); wav.setUint16(20,1,true); wav.setUint16(22,1,true);
      wav.setUint32(24,rate,true); wav.setUint32(28,rate,true); wav.setUint16(32,1,true); wav.setUint16(34,8,true);
      [..."data"].forEach((ch,i)=>wav.setUint8(36+i,ch.charCodeAt(0)));
      wav.setUint32(40,size,true);
      for(let i=0;i<size;i++) wav.setUint8(44+i,128);
      keeper=new Audio(URL.createObjectURL(new Blob([wav],{type:"audio/wav"})));
      keeper.loop=true; keeper.setAttribute("playsinline","");
    }
    if(keeper.paused) keeper.play().catch(()=>{});
  }

  function start(){
    if(playing) return Promise.resolve();
    unlock();
    playing=true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.66,ac.currentTime,.4);
    barIndex=0; pass=0; nextBarTime=0; erhuMidi=null;
    return loadSamples().then(()=>{
      if(!playing || timer!==null) return;
      tick(); timer=setInterval(tick,250);
    });
  }

  function stop(){
    if(!playing) return;
    playing=false; clearInterval(timer); timer=null;
    keeper?.pause();
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.0001,ac.currentTime,.15);
  }

  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden && playing){ ac.resume().catch(()=>{}); keeper?.play().catch(()=>{}); }
  });

  return { start, stop, unlock, toggle:()=>playing?(stop(),false):(start(),true), isPlaying:()=>playing, context, output:()=>master };
})();

// 扭蛋機音效：一樣現場合成
const RetroSfx = (() => {
  const ctx = () => RetroMusic.context();
  function noise(duration,freq,level,type="bandpass"){
    const ac=ctx(); if(!ac) return;
    const t=ac.currentTime, buffer=ac.createBuffer(1,ac.sampleRate*duration,ac.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const src=ac.createBufferSource(), filter=ac.createBiquadFilter(), gain=ac.createGain();
    src.buffer=buffer; filter.type=type; filter.frequency.value=freq; filter.Q.value=4; gain.gain.value=level;
    src.connect(filter).connect(gain).connect(ac.destination); src.start(t);
  }
  function ring(freq,duration,level){
    const ac=ctx(); if(!ac) return;
    const t=ac.currentTime, osc=ac.createOscillator(), gain=ac.createGain();
    osc.frequency.value=freq; gain.gain.setValueAtTime(level,t); gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain).connect(ac.destination); osc.start(t); osc.stop(t+duration);
  }
  return {
    coin(){ ring(3200,.25,.09); ring(4700,.18,.05); },
    tick(){ noise(.05,1900,.5); },
    clunk(){ noise(.14,300,1.1); },
    roll(){ noise(.5,700,.4); },
    pop(){ noise(.1,1200,.8); ring(880,.5,.09); },
    page(){ noise(.3,2400,.22,"highpass"); },
    ignite(){ noise(.25,2600,.5); noise(1.4,420,.5); }
  };
})();
window.RetroSfx = RetroSfx;
