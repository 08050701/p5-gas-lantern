"use strict";

// 〈雨夜花〉演奏版：用 Web Audio 現場合成，不放任何錄音檔。
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
  let ac=null, master=null, timer=null, nextBarTime=0, barIndex=0, playing=false;

  // 主旋律：兩個微微走音的振盪器加顫音，聲音接近口琴／手風琴
  function lead(midi,t,dur){
    const env=ac.createGain(), filter=ac.createBiquadFilter(), vib=ac.createOscillator(), vibAmt=ac.createGain();
    filter.type="lowpass"; filter.frequency.value=1500; filter.Q.value=.6;
    vib.frequency.value=5.2; vibAmt.gain.value=2.4; vib.connect(vibAmt);
    [["triangle",-3,.55],["sawtooth",3,.1]].forEach(([type,detune,level])=>{
      const osc=ac.createOscillator(), gain=ac.createGain();
      osc.type=type; osc.frequency.value=midiToHz(midi+12); osc.detune.value=detune;
      gain.gain.value=level; vibAmt.connect(osc.detune);
      osc.connect(gain).connect(filter); osc.start(t); osc.stop(t+dur+.35);
    });
    filter.connect(env).connect(master);
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(.34,t+.05);
    env.gain.setTargetAtTime(.22,t+.08,.2);
    env.gain.setTargetAtTime(.0001,t+dur*.92,.1);
    vib.start(t); vib.stop(t+dur+.35);
  }

  // 伴奏：華爾滋的「蹦、恰、恰」
  function pluck(midi,t,level){
    const osc=ac.createOscillator(), env=ac.createGain();
    osc.type="sine"; osc.frequency.value=midiToHz(midi);
    env.gain.setValueAtTime(.0001,t);
    env.gain.exponentialRampToValueAtTime(level,t+.012);
    env.gain.exponentialRampToValueAtTime(.0001,t+.8);
    osc.connect(env).connect(master); osc.start(t); osc.stop(t+.85);
  }

  function scheduleBar(bar,t){
    let at=t;
    bar.notes.forEach(([midi,beats])=>{ lead(midi,at,beats*BEAT); at+=beats*BEAT; });
    const [bass,...upper]=CHORDS[bar.chord];
    pluck(bass,t,.28);
    [1,2].forEach(beat=>upper.forEach(n=>pluck(n,t+beat*BEAT,.075)));
  }

  function tick(){
    while(nextBarTime<ac.currentTime+.8){
      scheduleBar(BARS[barIndex],nextBarTime);
      nextBarTime+=3*BEAT;
      barIndex=(barIndex+1)%BARS.length;
      if(barIndex===0) nextBarTime+=3*BEAT; // 一輪之後空一小節再重來
    }
  }

  function context(){
    if(!ac){
      ac=new (window.AudioContext||window.webkitAudioContext)();
      master=ac.createGain(); master.gain.value=.0001; master.connect(ac.destination);
    }
    return ac;
  }

  async function start(){
    if(playing) return;
    context();
    await ac.resume();
    playing=true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.8,ac.currentTime,.4);
    barIndex=0; nextBarTime=ac.currentTime+.15;
    tick(); timer=setInterval(tick,250);
  }

  function stop(){
    if(!playing) return;
    playing=false; clearInterval(timer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.0001,ac.currentTime,.15);
  }

  return { start, stop, toggle:()=>playing?(stop(),false):(start(),true), isPlaying:()=>playing, context };
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
