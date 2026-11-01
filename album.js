"use strict";

// 大家的相冊：一頁一個人，像翻畢業紀念冊那樣翻。
// 桌機攤開兩頁，手機一次一頁；翻頁用一張「正在翻的紙」蓋在書上轉過去。
const FlipAlbum = (() => {
  const TURN_MS = 820;
  let book, leaf, under = {}, pages = [], at = 0, turning = false, loadPage = null, single = false;

  const esc = text => String(text||"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));

  function pageHtml(page){
    if(!page) return `<div class="album-page is-blank"></div>`;
    if(page.kind==="cover") return `<div class="album-page is-cover"><b>大家的相冊</b><span>轉來坐</span><small>翻翻看，大家許了什麼願</small></div>`;
    if(page.kind==="end") return `<div class="album-page is-end"><b>下一頁，留給下一位</b><small>${esc(page.note||"")}</small></div>`;
    const image = page.src ? `<img src="${esc(page.src)}" alt="${esc(page.scene)}的拍貼">` : `<div class="album-wait">翻開中…</div>`;
    return `<div class="album-page">${image}<p>「${esc(page.wish)}」</p><small>${esc(page.scene)}　${esc(page.date)}</small></div>`;
  }

  // 每一面的內容：桌機 at 是左頁，手機 at 就是那一頁
  const stride = () => single ? 1 : 2;
  function fill(el,index){ el.innerHTML = pageHtml(pages[index]); }

  function render(){
    if(single){ fill(under.right,at); under.left.innerHTML=""; }
    else{ fill(under.left,at); fill(under.right,at+1); }
    $("#albumCount").textContent = `${Math.floor(at/stride())+1} / ${Math.ceil(pages.length/stride())}`;
    $("#albumPrev").disabled = at<=0;
    $("#albumNext").disabled = at+stride()>=pages.length;
    ensure(at); ensure(at+1); ensure(at+stride()); ensure(at+stride()+1);
  }

  async function ensure(index){
    const page=pages[index];
    if(!page || page.src || page.loading || !page.id || !loadPage) return;
    page.loading=true;
    try{ page.src=await loadPage(page.id); }catch(_){ page.src=""; }
    page.loading=false;
    if(!turning) render();
  }

  function turn(step){
    const target=at+step*stride();
    if(turning || target<0 || target>=pages.length) return;
    turning=true;
    window.RetroSfx?.page?.();
    const forward=step>0;
    // 紙翻起來時，底下要先露出目的地那一頁
    if(single){
      fill(leaf.front,forward?at:target); leaf.back.innerHTML="";
      fill(under.right,forward?target:at);
    }else{
      fill(leaf.front,forward?at+1:target+1);
      fill(leaf.back,forward?target:at);
      if(forward) fill(under.right,target+1); else fill(under.left,target);
    }
    const el=leaf.root;
    el.hidden=false; el.style.transition="none";
    el.style.transform=`rotateY(${forward?0:-180}deg)`;
    void el.offsetWidth;
    el.style.transition=`transform ${TURN_MS}ms cubic-bezier(.45,.05,.3,1)`;
    el.style.transform=`rotateY(${forward?-180:0}deg)`;
    setTimeout(()=>{ at=target; el.hidden=true; turning=false; render(); },TURN_MS+20);
  }

  function layout(){
    const next=matchMedia("(max-width:820px),(max-aspect-ratio:1/1)").matches;
    if(next===single) return;
    single=next;
    book.classList.toggle("is-single",single);
    at=single?at:at-at%2;
    render();
  }

  function open(list,loader,startAt=0){
    book=$("#albumBook");
    under={left:$("#albumLeft"),right:$("#albumRight")};
    leaf={root:$("#albumLeaf"),front:$("#albumLeafFront"),back:$("#albumLeafBack")};
    pages=list; loadPage=loader; turning=false; leaf.root.hidden=true;
    single=matchMedia("(max-width:820px),(max-aspect-ratio:1/1)").matches;
    book.classList.toggle("is-single",single);
    at=single?startAt:startAt-startAt%2;
    render();
  }

  function bind(){
    $("#albumPrev").addEventListener("click",()=>turn(-1));
    $("#albumNext").addEventListener("click",()=>turn(1));
    const area=$("#albumBook");
    let startX=null;
    area.addEventListener("pointerdown",e=>{ startX=e.clientX; });
    area.addEventListener("pointerup",e=>{
      if(startX===null) return;
      const dx=e.clientX-startX; startX=null;
      if(Math.abs(dx)>40) turn(dx<0?1:-1);
    });
    document.addEventListener("keydown",e=>{
      if(state.screen!=="album") return;
      if(e.key==="ArrowRight") turn(1);
      if(e.key==="ArrowLeft") turn(-1);
    });
    window.addEventListener("resize",()=>{ if(book) layout(); });
  }

  return { open, bind };
})();
