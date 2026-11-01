"use strict";

// 拍照姿勢框：把人形外框疊在畫面上，人站進框裡比同樣的手勢就好。
// 畫布 400×300；arms 是手臂折線，hands 是 [手勢, x, y, 大小]。
const SHOULDER_L = [146,186], SHOULDER_R = [254,186];
const POSES = {
  thumb:{ label:"比個讚", arms:[[[254,186],[318,250],[326,190]]], hands:[["👍",332,158,17]] },
  thumbs:{ label:"雙手比讚", arms:[[[146,186],[82,250],[74,190]],[[254,186],[318,250],[326,190]]], hands:[["👍",68,158,17],["👍",332,158,17]] },
  ya:{ label:"比 YA", arms:[[[254,186],[312,236],[286,136]]], hands:[["✌️",292,102,17]] },
  yas:{ label:"雙手比 YA", arms:[[[146,186],[88,236],[114,136]],[[254,186],[312,236],[286,136]]], hands:[["✌️",108,102,17],["✌️",292,102,17]] },
  bigheart:{ label:"頭上比大愛心", arms:[[[146,186],[84,104],[188,30]],[[254,186],[316,104],[212,30]]], hands:[["❤️",200,20,12]] },
  heart:{ label:"胸前比愛心", arms:[[[146,186],[132,262],[192,226]],[[254,186],[268,262],[208,226]]], hands:[["❤️",200,214,15]] },
  wave:{ label:"揮揮手", arms:[[[254,186],[330,160],[338,82]]], hands:[["👋",342,50,18]] },
  hurray:{ label:"雙手舉高", arms:[[[146,186],[90,112],[72,44]],[[254,186],[310,112],[328,44]]], hands:[["🖐️",66,26,17],["🖐️",334,26,17]] },
  pray:{ label:"雙手合十", arms:[[[146,186],[140,262],[194,226]],[[254,186],[260,262],[206,226]]], hands:[["🙏",200,204,18]] },
  gongxi:{ label:"恭喜恭喜", arms:[[[146,186],[132,250],[192,214]],[[254,186],[268,250],[208,214]]], hands:[["✊",200,196,17]] },
  muscle:{ label:"秀手臂", arms:[[[254,186],[334,198],[326,122]]], hands:[["💪",336,112,18]] },
  salute:{ label:"敬個禮", arms:[[[254,186],[318,156],[244,86]]], hands:[["✋",252,70,14]] },
  chin:{ label:"手托下巴", arms:[[[254,186],[306,250],[242,152]]], hands:[["✋",238,138,13]] },
  phone:{ label:"打電話", arms:[[[254,186],[312,232],[250,120]]], hands:[["🤙",252,104,16]] },
  ok:{ label:"比 OK", arms:[[[254,186],[316,240],[300,150]]], hands:[["👌",304,122,17]] },
  point:{ label:"指著鏡頭", arms:[[[254,186],[292,250],[226,210]]], hands:[["👉",206,206,16]] },
  fist:{ label:"握拳加油", arms:[[[254,186],[328,174],[326,86]]], hands:[["✊",328,62,17]] },
  hips:{ label:"雙手叉腰", arms:[[[146,186],[84,240],[140,282]],[[254,186],[316,240],[260,282]]], hands:[] },
  arms:{ label:"雙手抱胸", arms:[[[146,186],[134,250],[250,232]],[[254,186],[266,250],[150,232]]], hands:[] },
  duo:{ label:"兩人靠肩", duo:true, hands:[] },
  duoheart:{ label:"兩人合比愛心", duo:true, arms:[[[110,186],[160,126],[188,104]],[[290,186],[240,126],[212,104]]], hands:[["❤️",200,88,17]] }
};

const POSE_SETS = [
  ["老朋友三連拍",["ya","thumb","hurray"]],["阿公的帥氣",["salute","fist","hips"]],["阿嬤的可愛",["chin","heart","wave"]],
  ["好運到",["gongxi","thumbs","bigheart"]],["健康身體好",["muscle","fist","hurray"]],["遠足拍照",["yas","wave","point"]],
  ["放學回家",["wave","ya","arms"]],["過年囉",["gongxi","pray","thumbs"]],["大明星",["chin","hips","point"]],
  ["歌廳秀",["bigheart","point","wave"]],["打電話給你",["phone","heart","wave"]],["老闆請客",["ok","thumb","gongxi"]],
  ["畢業照",["arms","yas","hurray"]],["夫妻同框",["duo","duoheart","thumbs"]],["結拜兄弟",["duo","fist","gongxi"]],
  ["手帕交",["duoheart","chin","yas"]],["拜拜求平安",["pray","gongxi","heart"]],["棒球冠軍",["hurray","fist","thumbs"]],
  ["兵仔敬禮",["salute","hips","fist"]],["好吃讚",["thumb","ok","chin"]],["戲院海報",["hips","arms","point"]],
  ["孫子教的",["yas","heart","phone"]],["年輕的我",["hips","ya","bigheart"]],["你最棒",["point","thumbs","muscle"]],
  ["好久不見",["wave","duo","pray"]],["今天真開心",["hurray","heart","ya"]],["OK 沒問題",["ok","thumbs","salute"]],
  ["大力士",["muscle","arms","fist"]],["愛你喔",["bigheart","heart","duoheart"]],["再見再見",["pray","thumb","wave"]]
];

const PoseGuide = (() => {
  let bag=[], current=null;

  function armLines(pose){ return (pose.arms||[]).map(pts=>pts.map(p=>p.join(",")).join(" ")); }

  function bodyShapes(x,scale=1){
    const at=(px,py)=>`${x+(px-200)*scale},${300-(300-py)*scale}`;
    return `<circle cx="${x}" cy="${300-(300-112)*scale}" r="${44*scale}"/><path d="M${at(140,192)} Q${at(200,158)} ${at(260,192)} L${at(274,310)} L${at(126,310)}Z"/>`;
  }

  function svg(pose){
    const bodies=pose.duo ? bodyShapes(120,.86)+bodyShapes(280,.86) : bodyShapes(200);
    const lines=armLines(pose).map(points=>`<polyline points="${points}"/>`).join("");
    const shapes=width=>`<g stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none">${lines}</g>`;
    // 身體只畫外輪廓；手臂疊在身體前面，自己也有完整外框
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>`
      +`<mask id="poseBody"><rect width="400" height="300" fill="#fff"/><g fill="#000">${bodies}</g>${shapes(30).replace('fill="none"','fill="none" stroke="#000"')}</mask>`
      +`<mask id="poseArms"><rect width="400" height="300" fill="#fff"/>${shapes(30).replace('fill="none"','fill="none" stroke="#000"')}</mask></defs>`
      +`<g class="pose-fill">${bodies}</g><g class="pose-fill-line" stroke="currentColor">${shapes(30)}</g>`
      +`<g mask="url(#poseBody)" fill="#fff" stroke="#fff" stroke-width="8">${bodies}</g>`
      +`<g mask="url(#poseArms)" stroke="#fff">${shapes(38)}</g></svg>`;
  }

  function show(mount,poseKey){
    const pose=POSES[poseKey];
    mount.innerHTML=svg(pose)+pose.hands.map(([hand,x,y,size])=>`<span class="pose-hand" style="left:${x/4}%;top:${y/3}%;font-size:${size*.76}cqw">${hand}</span>`).join("")+`<b class="pose-name">${pose.label}</b>`;
  }

  // 像抽籤一樣：三十組都輪過一次才重來
  function next(){
    if(!bag.length) bag=POSE_SETS.map((_,i)=>i).sort(()=>Math.random()-.5);
    const index=bag.pop();
    current={number:index+1,title:POSE_SETS[index][0],poses:POSE_SETS[index][1]};
    return current;
  }

  return { next, show, current:()=>current, labels:keys=>keys.map(k=>POSES[k].label), total:POSE_SETS.length };
})();
