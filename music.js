"use strict";

// 〈雨夜花〉演奏版：口琴、二胡、月琴、揚琴，全部用 Web Audio 現場合成，不放任何錄音檔。
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

  // 口琴：兩個微微走音的振盪器加顫音
  function harmonica(midi,t,dur,level=.3){
    const env=ac.createGain(), filter=ac.createBiquadFilter(), vib=ac.createOscillator(), vibAmt=ac.createGain();
    filter.type="lowpass"; filter.frequency.value=1700; filter.Q.value=.6;
    vib.frequency.value=5.2; vibAmt.gain.value=3; vib.connect(vibAmt);
    [["triangle",-4,.6],["sawtooth",4,.12]].forEach(([type,detune,gainLevel])=>{
      const osc=ac.createOscillator(), gain=ac.createGain();
      osc.type=type; osc.frequency.value=midiToHz(midi); osc.detune.value=detune;
      gain.gain.value=gainLevel; vibAmt.connect(osc.detune);
      osc.connect(gain).connect(filter); osc.start(t); osc.stop(t+dur+.4);
    });
    filter.connect(env); out(env,.35);
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(level,t+.05);
    env.gain.setTargetAtTime(level*.7,t+.08,.2);
    env.gain.setTargetAtTime(.0001,t+dur*.92,.1);
    vib.start(t); vib.stop(t+dur+.4);
  }

  // 二胡：弓拉進來、音從下面滑上去，尾音才開始揉弦
  function erhu(midi,t,dur,level=.26){
    const env=ac.createGain(), body=ac.createBiquadFilter(), bright=ac.createBiquadFilter(), vib=ac.createOscillator(), vibAmt=ac.createGain();
    const slide=dur>.3?-85:-35;
    body.type="peaking"; body.frequency.value=950; body.Q.value=1.1; body.gain.value=7;
    bright.type="lowpass"; bright.frequency.value=2500; bright.Q.value=.5;
    vib.frequency.value=5.7;
    vibAmt.gain.setValueAtTime(0,t);
    vibAmt.gain.setValueAtTime(0,t+Math.min(.2,dur*.4));
    vibAmt.gain.linearRampToValueAtTime(dur>.3?19:7,t+Math.min(.55,dur*.85));
    vib.connect(vibAmt);
    [[0,.34],[6,.2]].forEach(([cents,gainLevel])=>{
      const osc=ac.createOscillator(), gain=ac.createGain();
      osc.type="sawtooth"; osc.frequency.value=midiToHz(midi);
      osc.detune.setValueAtTime(slide+cents,t);
      osc.detune.linearRampToValueAtTime(cents,t+.11);
      gain.gain.value=gainLevel; vibAmt.connect(osc.detune);
      osc.connect(gain).connect(body); osc.start(t); osc.stop(t+dur+.5);
    });
    body.connect(bright).connect(env); out(env,.6);
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(level,t+Math.min(.11,dur*.4));
    env.gain.setTargetAtTime(level*.8,t+.14,.3);
    env.gain.setTargetAtTime(.0001,t+dur*.96,.12);
    vib.start(t); vib.stop(t+dur+.5);
  }

  // 月琴：撥一下就散掉的乾淨聲音
  function pluck(midi,t,level,decay=.55){
    [[1,"triangle",1],[2,"sine",.32]].forEach(([harmonic,type,ratio])=>{
      const osc=ac.createOscillator(), env=ac.createGain();
      osc.type=type; osc.frequency.value=midiToHz(midi)*harmonic;
      env.gain.setValueAtTime(.0001,t);
      env.gain.exponentialRampToValueAtTime(level*ratio,t+.006);
      env.gain.exponentialRampToValueAtTime(.0001,t+decay/harmonic);
      osc.connect(env); out(env,.25); osc.start(t); osc.stop(t+decay+.05);
    });
  }

  // 揚琴：高音區輕輕敲，餘音長一點
  function dulcimer(midi,t,level=.06){
    [[0,1],[9,.6]].forEach(([cents,ratio])=>{
      const osc=ac.createOscillator(), env=ac.createGain();
      osc.type="sine"; osc.frequency.value=midiToHz(midi); osc.detune.value=cents;
      env.gain.setValueAtTime(.0001,t);
      env.gain.exponentialRampToValueAtTime(level*ratio,t+.004);
      env.gain.exponentialRampToValueAtTime(.0001,t+1.1);
      osc.connect(env); out(env,.5); osc.start(t); osc.stop(t+1.15);
    });
  }

  function woodblock(t,level=.05){
    const osc=ac.createOscillator(), env=ac.createGain();
    osc.frequency.value=880;
    env.gain.setValueAtTime(level,t);
    env.gain.exponentialRampToValueAtTime(.0001,t+.07);
    osc.connect(env); out(env,.2); osc.start(t); osc.stop(t+.08);
  }

  // 三輪編曲：口琴先唱，二胡接手，最後一起收
  function scheduleBar(bar,t,index){
    let at=t;
    bar.notes.forEach(([midi,beats])=>{
      const dur=beats*BEAT;
      if(pass===0) harmonica(midi+12,at,dur);
      else if(pass===1) erhu(midi+12,at,dur);
      else{ erhu(midi+12,at,dur,.2); harmonica(midi,at,dur,.16); }
      at+=dur;
    });
    const [bass,...upper]=CHORDS[bar.chord];
    pluck(bass,t,.3,.9);
    [1,2].forEach(beat=>upper.forEach(n=>pluck(n,t+beat*BEAT,.06)));
    if(pass===0 && (index===3||index===7)) erhu(upper[2]+12,t+1.5*BEAT,1.4*BEAT,.1); // 樂句尾巴，二胡輕輕應一聲
    if(pass>0) [0,1,2,1,2,1].forEach((n,i)=>dulcimer(upper[n]+12,t+i*BEAT/2));
    if(pass===1) harmonica(upper[0],t,2.8*BEAT,.07);
    if(pass===2) woodblock(t);
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
    if(playing) return;
    unlock();
    playing=true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.8,ac.currentTime,.4);
    barIndex=0; pass=0; nextBarTime=0;
    tick(); timer=setInterval(tick,250);
  }

  function stop(){
    if(!playing) return;
    playing=false; clearInterval(timer);
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
