"use strict";

// 〈雨夜花〉國樂演奏版：二胡、梆笛、月琴、揚琴，全部用 Web Audio 現場合成，不放任何錄音檔。
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

  // 兩種樂器的波形：只給各泛音的強度，其餘交給共鳴
  let waves=null, noiseBuffer=null, grit=null;
  function instruments(){
    if(waves) return;
    const wave=amps=>{ const real=new Float32Array(amps.length+1), imag=new Float32Array(amps.length+1); amps.forEach((v,i)=>imag[i+1]=v); return ac.createPeriodicWave(real,imag); };
    waves={
      // 弓弦的泛音又多又密，高處還有力氣，蛇皮共鳴再把聲音捏細
      erhu:wave(Array.from({length:32},(_,i)=>(i%2?.72:1)/Math.pow(i+1,.72))),
      // 笛子是奇次泛音強、偶次弱
      dizi:wave([1,.2,.52,.08,.3,.05,.17,.03,.09,.02,.05])
    };
    noiseBuffer=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    grit=new Float32Array(1024);
    for(let i=0;i<1024;i++){ const x=i/511.5-1; grit[i]=Math.tanh(x*3.4); }
  }
  function noiseSource(t,end){
    const src=ac.createBufferSource(); src.buffer=noiseBuffer; src.loop=true;
    src.start(t,Math.random()*1.8); src.stop(end);
    return src;
  }
  const filter=(type,hz,q,gain=0)=>{ const f=ac.createBiquadFilter(); f.type=type; f.frequency.value=hz; f.Q.value=q; f.gain.value=gain; return f; };

  // 二胡：一弓拉到底，手指在弦上滑過去。音和音之間是連著的，這是它最像人聲的地方
  let erhuMidi=null, erhuEnd=0;
  function erhuLine(notes,level){
    const t0=notes[0][1], last=notes[notes.length-1], end=last[1]+last[2];
    const osc=ac.createOscillator(), vib=ac.createOscillator(), vibAmt=ac.createGain(), env=ac.createGain(), shaper=ac.createWaveShaper();
    const joined=erhuMidi!==null && t0-erhuEnd<.25;
    osc.setPeriodicWave(waves.erhu);
    osc.frequency.setValueAtTime(midiToHz(joined?erhuMidi:notes[0][0])*(joined?1:.965),t0);
    vib.frequency.value=5.9; vib.connect(vibAmt).connect(osc.detune);
    vibAmt.gain.setValueAtTime(0,t0);
    env.gain.setValueAtTime(.0001,t0);
    env.gain.exponentialRampToValueAtTime(level,t0+(joined?.03:.09));
    let previous=joined?erhuMidi:notes[0][0];
    notes.forEach(([midi,at,dur],i)=>{
      const leap=Math.abs(midi-previous);
      // 音程越大滑得越明顯，先滑才到音
      osc.frequency.setTargetAtTime(midiToHz(midi),Math.max(t0,at-(leap>2?.07:.015)),leap>2?.055:.03);
      // 長音後段才開始揉弦，換音時手指先停下來
      vibAmt.gain.setTargetAtTime(0,at,.02);
      if(dur>.34) vibAmt.gain.setTargetAtTime(32,at+Math.min(.16,dur*.3),.14);
      // 每個音弓壓略放再推，運弓的呼吸
      if(i){ env.gain.setTargetAtTime(level*.74,at-.03,.02); env.gain.setTargetAtTime(level,at+.02,.07); }
      if(dur>.6) env.gain.setTargetAtTime(level*.84,at+dur*.6,.2);
      previous=midi;
    });
    env.gain.setTargetAtTime(.0001,end-.02,.07);
    shaper.curve=grit; shaper.oversample="2x";
    const drive=ac.createGain(); drive.gain.value=.8;
    const trim=ac.createGain(); trim.gain.value=.6;
    const low=filter("highpass",330,.7), nasal=filter("peaking",820,1.4,9), mid=filter("peaking",1750,2,6), edge=filter("peaking",3200,1.6,7), top=filter("lowpass",7000,.5);
    osc.connect(drive).connect(shaper).connect(trim).connect(low).connect(nasal).connect(mid).connect(edge).connect(top).connect(env);
    // 松香磨弦的沙沙聲
    const bow=noiseSource(t0,end+.3), bowBand=filter("bandpass",3000,.8), bowLevel=ac.createGain();
    bowLevel.gain.value=.05;
    bow.connect(bowBand).connect(bowLevel).connect(env);
    out(env,.5);
    osc.start(t0); osc.stop(end+.4); vib.start(t0); vib.stop(end+.4);
    erhuMidi=last[0]; erhuEnd=end;
  }

  // 梆笛：氣聲、笛膜的沙沙聲，長音前帶倚音，顫音是用氣吹出來的
  function dizi(midi,t,dur,level=.2,grace=null){
    const end=t+dur, hz=midiToHz(midi), osc=ac.createOscillator(), env=ac.createGain(), breath=ac.createGain();
    osc.setPeriodicWave(waves.dizi);
    if(grace!==null){
      osc.frequency.setValueAtTime(midiToHz(grace),t);
      osc.frequency.setValueAtTime(hz*.994,t+.065);
      osc.frequency.setTargetAtTime(hz,t+.065,.02);
    }else{
      osc.frequency.setValueAtTime(hz*.985,t);
      osc.frequency.setTargetAtTime(hz,t,.018);
    }
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(level*1.1,t+.022);
    env.gain.setTargetAtTime(level,t+.03,.04);
    env.gain.setTargetAtTime(.0001,end-.03,.045);
    // 氣息起伏，音量比音高動得多
    breath.gain.value=1;
    if(dur>.45){
      const lfo=ac.createOscillator(), amount=ac.createGain(), bend=ac.createGain();
      lfo.frequency.value=5.1;
      amount.gain.setValueAtTime(0,t);
      amount.gain.setTargetAtTime(.2,t+.2,.14);
      bend.gain.value=9;
      lfo.connect(amount).connect(breath.gain); lfo.connect(bend).connect(osc.detune);
      lfo.start(t); lfo.stop(end+.2);
    }
    osc.connect(breath);
    breath.connect(filter("lowpass",9000,.5)).connect(env);
    // 笛膜：泛音推過頭，在 4 到 7 kHz 震出的沙沙亮聲
    const shaper=ac.createWaveShaper(), push=ac.createGain(), buzz=ac.createGain();
    shaper.curve=grit; push.gain.value=3.4; buzz.gain.value=.16;
    breath.connect(push).connect(shaper).connect(filter("highpass",3600,.8)).connect(filter("peaking",5300,1.1,8)).connect(buzz).connect(env);
    // 吹孔的氣聲，起音時多一點
    const air=noiseSource(t,end+.2), airBand=filter("bandpass",Math.min(6000,hz*2.4),.9), airLevel=ac.createGain();
    airLevel.gain.setValueAtTime(.34,t);
    airLevel.gain.setTargetAtTime(.1,t+.03,.05);
    air.connect(airBand).connect(airLevel).connect(env);
    out(env,.55);
    osc.start(t); osc.stop(end+.2);
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

  // 倚音往上鄰音起，五聲音階裡的上一個音
  const SCALE=[0,2,4,7,9];
  function upperNeighbor(midi){
    for(let n=midi+1;n<midi+6;n++) if(SCALE.includes(n%12)) return n;
    return midi+2;
  }

  // 三輪編曲：二胡先唱，笛子在句尾應和；第二輪換笛子，二胡托在底下；第三輪一起收
  function scheduleBar(bar,t,index){
    let at=t;
    const line=bar.notes.map(([midi,beats])=>{ const note=[midi,at,beats*BEAT]; at+=beats*BEAT; return note; });
    const [bass,...upper]=CHORDS[bar.chord];
    const lead=(shift,level)=>line.forEach(([midi,start,dur])=>dizi(midi+shift,start,dur,level,dur>=BEAT*.9?upperNeighbor(midi+shift):null));
    if(pass===0){
      erhuLine(line.map(([m,a,d])=>[m+12,a,d]),.5);
      if(index===3||index===7){ dizi(upper[2]+12,t+1.5*BEAT,.75*BEAT,.13); dizi(upper[1]+12,t+2.25*BEAT,.7*BEAT,.13,upper[2]+12); }
    }else if(pass===1){
      lead(24,.25);
      erhuLine([[upper[1],t,1.5*BEAT],[upper[2],t+1.5*BEAT,1.4*BEAT]],.26);
    }else{
      erhuLine(line.map(([m,a,d])=>[m+12,a,d]),.42);
      lead(24,.15);
    }
    pluck(bass,t,.3,.9);
    [1,2].forEach(beat=>upper.forEach(n=>pluck(n,t+beat*BEAT,.06)));
    if(pass>0) [0,1,2,1,2,1].forEach((n,i)=>dulcimer(upper[n]+12,t+i*BEAT/2));
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
      instruments();
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
    master.gain.setTargetAtTime(.66,ac.currentTime,.4);
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
