"use strict";

// 中文、日文、英文三種介面。語音辨識、AI 祝福、拍貼上的字也跟著換。
// 老拍貼上的道具字（作業簿、日報、車票）是那個年代的東西，維持中文。
const I18N = (() => {
  const LANGS = {
    zh:{ name:"中文", html:"zh-Hant", speech:"zh-TW" },
    ja:{ name:"日本語", html:"ja", speech:"ja-JP" },
    en:{ name:"English", html:"en", speech:"en-US" }
  };
  const ORDER = ["zh","ja","en"];

  // 每一句：[中文, 日文, 英文]
  const TEXT = {
    pageTitle:["轉來坐｜老台灣願望拍貼","轉來坐｜昔の台湾 願いごと写真館","Zhuan Lai Tse | Old Taiwan Wish Photo Booth"],
    pageDesc:["轉一顆扭蛋，回到老台灣的風景裡拍照，帶走一句祝福。","ガチャを回して昔の台湾の風景で写真を撮り、あなたへの言葉を持ち帰りましょう。","Turn a capsule, step into old Taiwan for a photo, and take home a blessing."],
    langLabel:["語言","言語","Language"],
    home:["回到首頁","ホームに戻る","Back to start"],
    close:["關閉","閉じる","Close"],
    musicName:["雨夜花：","雨夜花：","Music: "],
    musicOn:["開","オン","On"],
    musicOff:["關","オフ","Off"],
    browserTip:["相機和麥克風可能不能用。請按右上角選單，選「用瀏覽器開啟」。","カメラとマイクが使えないかもしれません。右上のメニューから「ブラウザで開く」を選んでください。","The camera and microphone may not work here. Open the menu at the top right and choose “Open in browser”."],
    heroEyebrow:["今日限定 · 三連拍體驗","本日限定 · 3枚連続撮影","Today only · 3-shot photo booth"],
    heroTitle:["轉一顆，<br>回到那個年代。","ひとつ回して、<br>あの頃へ。","Turn the crank,<br>go back in time."],
    machine:["舊式紅色鐵殼扭蛋機","昔ながらの赤い鉄のガチャ","Old red metal capsule machine"],
    turnMachine:["轉動扭蛋機","ガチャを回す","Turn the capsule machine"],
    spinCoin:["按投幣孔，投壹圓","投入口を押してください","Tap the coin slot"],
    spinTurn:["轉把手","ハンドルを回す","Turn the handle"],
    spinFlat:["投幣，轉一下","お金を入れて回す","Drop a coin and turn"],
    revealEyebrow:["你的場景已出現","あなたの場所が出ました","Your place has appeared"],
    reroll:["再轉一顆","もう一回","Try another"],
    goHere:["就去這裡","ここにする","Go here"],
    wishEyebrow:["STEP 02 · 留下一句話","STEP 02 · ひとこと残す","STEP 02 · Leave a wish"],
    wishTitle:["您有什麼願望？","どんな願いがありますか？","What is your wish?"],
    micAria:["開始語音輸入","音声入力を始める","Start voice input"],
    micTalk:["說話","話す","Talk"],
    micDone:["說完了","終わり","Done"],
    micIdle:["按一下，開始說","押して、話してください","Tap, then speak"],
    restart:["講錯了，重講","言い直す","Start over"],
    typeInstead:["改用打字","文字で入力する","Type instead"],
    aiAnswering:["AI 正在回應你的願望","AIがあなたの願いに返事をしています","AI is answering your wish"],
    aiWriting:["正在寫一段只給你的祝福…","あなただけへの言葉を書いています…","Writing a blessing just for you…"],
    sayAgain:["重講一次","もう一度話す","Say it again"],
    writeAgain:["重寫一次","書き直す","Rewrite"],
    toCamera:["去拍照","写真を撮る","Take photos"],
    gotIt:["收到了","受け取りました","Got it"],
    noVoice:["這個瀏覽器無法使用語音，已切換成打字","このブラウザでは音声が使えないので、文字入力にします","Voice isn't available in this browser, so let's type"],
    notClear:["沒有聽清楚，再試一次或改用打字","よく聞き取れませんでした。もう一度話すか、文字で入力してください","I didn't catch that. Try again, or type it"],
    sayAgainNow:["好，請重新說一次","はい、もう一度どうぞ","OK, please say it again"],
    speakSlowly:["慢慢說，說完按一下","ゆっくり話して、終わったら押してください","Take your time, tap when you're done"],
    listening:["正在聽…","聞いています…","Listening…"],
    noSound:["沒有收到聲音，改用打字也可以","声が届きませんでした。文字で入力することもできます","No sound came through. You can type instead"],
    blessWriting:["正在寫祝福…","言葉を書いています…","Writing your blessing…"],
    blessWait:["請稍等…","少々お待ちください…","One moment…"],
    blessWritingLabel:["正在寫祝福","言葉を書いています","Writing your blessing"],
    blessLabel:["給您的祝福","あなたへの言葉","A blessing for you"],
    cameraEyebrow:["STEP 03 · 三連拍","STEP 03 · 3枚連続","STEP 03 · Three shots"],
    cameraTitle:["看鏡頭","カメラを見て","Look here"],
    cameraPlaceholder:["相機預覽會出現在這裡","ここにカメラが映ります","The camera preview will appear here"],
    cameraOpening:["正在開啟相機…","カメラを起動しています…","Opening the camera…"],
    cameraFail:["無法開啟相機<br><small>請允許相機權限後重新整理</small>","カメラを起動できません<br><small>カメラの使用を許可して、再読み込みしてください</small>","Can't open the camera<br><small>Allow camera access, then reload</small>"],
    cameraFailNote:["相機開不起來也沒關係","カメラがなくても大丈夫","No camera? That's fine"],
    skipToLantern:["不拍照，直接放天燈","写真なしで天灯を上げる","Skip photos, release a lantern"],
    poseRoll:["換一組","別のポーズ","New poses"],
    framePicker:["相紙樣式","写真の枠","Photo frame"],
    frameAlbum:["老相本","アルバム","Album"],
    framePostcard:["明信片","はがき","Postcard"],
    frameRed:["紅紙","赤い紙","Red"],
    frameFloral:["花布","花柄","Floral"],
    frameNotebook:["作業簿","ノート","Notebook"],
    frameNews:["老報紙","新聞","Newspaper"],
    frameYearbook:["畢業冊","卒業写真","Yearbook"],
    frameTheater:["戲院","映画館","Cinema"],
    startShots:["開始拍三張","3枚撮る","Take 3 photos"],
    skipBg:["先用原本的畫面拍","今の背景のまま撮る","Shoot with the real background"],
    shotNote:["倒數 3 秒，連拍三張","3秒数えて、3枚続けて撮ります","A 3-second countdown, then 3 photos"],
    bgPreparing:["正在準備老照片背景…","昔の写真の背景を準備しています…","Preparing the old-photo background…"],
    bgProgress:["正在準備老照片背景 {p}%","昔の写真の背景を準備中 {p}%","Preparing the old-photo background {p}%"],
    shotN:["第 {n} 張：{label}","{n}枚目：{label}","Photo {n}: {label}"],
    developing:["拍好了，正在沖洗…","撮れました。現像しています…","All done! Developing…"],
    reviewAlt:["您的願望相片","あなたの願いの写真","Your wish photo"],
    reviewEyebrow:["YOUR WISH STRIP","あなたの願いの写真","Your wish strip"],
    retake:["重拍","撮り直す","Retake"],
    takeHome:["帶回家","持って帰る","Take it home"],
    pickupAlt:["願望拍貼預覽","写真のプレビュー","Photo preview"],
    pickupEyebrow:["READY TO TAKE HOME","持ち帰りの準備ができました","Ready to take home"],
    pickupTitle:["用手機掃一下","スマホで読み取る","Scan with your phone"],
    qrMaking:["正在製作 QR Code…","QRコードを作っています…","Making the QR code…"],
    uploading:["照片上傳中…","写真をアップロードしています…","Uploading the photo…"],
    qrFail:["這裡暫時掃不了<br>請按下方「直接下載」存到手機","今は読み取れません<br>下の「ダウンロード」で保存してください","Scanning isn't available right now<br>Tap “Download” below to save it"],
    expiry:["照片 24 小時後自動刪除","写真は24時間後に自動で消えます","Photos are deleted after 24 hours"],
    download:["直接下載","ダウンロード","Download"],
    toLantern:["放天燈","天灯を上げる","Release a lantern"],
    finaleA1:["心裡的話，","心の言葉を、","Your words"],
    finaleA2:["寫在紙上了","紙に書きました","are on the paper"],
    finaleB1:["等一陣風來，","風を待って、","Wait for the breeze,"],
    finaleB2:["點起火，","火をともし、","light the flame,"],
    finaleB3:["讓它慢慢走","ゆっくり見送りましょう","and let it drift away"],
    light:["點燈","火をつける","Light it"],
    finaleEnd:["風，收下了您的話","風が、あなたの言葉を受け取りました","The wind has taken your words"],
    finaleC1:["它會慢慢飛，","ゆっくり飛んで、","It will drift slowly"],
    finaleC2:["飛到想念的人那裡","会いたい人のところへ","to the ones you miss"],
    again:["再來一次","もう一度","Once more"],
    openAlbum:["翻開大家的相冊","みんなのアルバムを開く","Open everyone's album"],
    prevPage:["上一頁","前へ","Back"],
    nextPage:["下一頁","次へ","Next"],
    backToMachine:["回到扭蛋機","ガチャに戻る","Back to the machine"],
    albumAsk:["要放進大家的相冊嗎？","みんなのアルバムに入れますか？","Add yours to everyone's album?"],
    albumAskText:["放進去之後，來到這個網站的人都看得到您的<b>拍貼和願望</b>，保留 30 天。不放也可以看別人的。","入れると、このサイトに来た人はみんな、あなたの<b>写真と願い</b>を見られます（30日間保存）。入れなくても、ほかの人のものは見られます。","Everyone who visits this site will see your <b>photo and wish</b> for 30 days. You can still look at everyone else's without adding yours."],
    albumNo:["不放，只看別人","入れずに見るだけ","Just look"],
    albumYes:["放進去","入れる","Add mine"],
    writeEyebrow:["WRITE IT DOWN","書いてみましょう","Write it down"],
    writeTitle:["寫下您的願望","願いを書いてください","Write your wish"],
    writePlaceholder:["例如：希望全家平安健康","例：家族みんなが元気でいられますように","e.g. I hope my whole family stays healthy"],
    writeDone:["好了","できた","Done"],
    writeFirst:["請先寫下願望","先に願いを書いてください","Please write a wish first"],
    albumOpening:["正在翻開相冊…","アルバムを開いています…","Opening the album…"],
    albumNotAdded:["這次沒放進去：{e}","今回は入りませんでした：{e}","Couldn't add it this time: {e}"],
    albumOnlyYou:["相冊還沒開通，這一頁只有您看得到","アルバムはまだ準備中です。このページはあなたにだけ見えます","The album isn't open yet, so only you can see this page"],
    albumFirst:["您是第一位，下一位就會看到您","あなたが最初の一人です。次の人があなたの写真を見ます","You're the first! The next visitor will see yours"],
    albumClosed:["相冊還沒開通，暫時看不到其他人","アルバムはまだ準備中で、ほかの人のものは見られません","The album isn't open yet, so others can't be shown"],
    bookTitle:["大家的相冊","みんなのアルバム","Everyone's Album"],
    bookHint:["按右邊，或用手把書翻開","右側を押すか、手でめくってください","Tap the right side, or swipe to open"],
    bookInside1:["翻翻看，","めくってみて、","Turn the pages"],
    bookInside2:["大家許了什麼願","みんなの願いごと","to see everyone's wishes"],
    bookEnd:["下一頁，留給下一位","次のページは、次の人へ","The next page is for the next visitor"],
    bookLoading:["翻開中…","開いています…","Opening…"],
    bookCover:["封面","表紙","Cover"],
    bookPageOne:["第 {a} / {t} 頁","{a} / {t} ページ","Page {a} of {t}"],
    bookPageTwo:["第 {a}–{b} 頁，共 {t} 頁","{a}–{b} ページ（全 {t} ページ）","Pages {a}–{b} of {t}"],
    bookPageLast:["第 {a} 頁，共 {t} 頁","{a} ページ（全 {t} ページ）","Page {a} of {t}"],
    photoOf:["{scene}的拍貼","{scene}の写真","Photo at {scene}"],
    fallbackBlessing:["願您平安健康，天天歡喜。","いつまでもお元気で、毎日笑顔でいられますように。","May you stay healthy and find joy in every day."]
  };

  // 場景：[名稱, 圓圈裡的短地名, 一句話]
  const SCENES = {
    alishan:[["阿里山の森林鉄道","阿里山","小さな汽車が駅に着き、山の霧がゆっくり流れてきます。"],["Alishan Forest Railway","Alishan","The little train pulls in as mountain mist drifts by."]],
    tamsui:[["淡水河の渡し船","淡水","渡し船が岸に着くと、向こうは観音山です。"],["Tamsui River Ferry","Tamsui","The ferry docks, with Guanyin Mountain across the water."]],
    beach:[["淡水の海水浴場","淡水","向こうに観音山が見えます。"],["Tamsui Beach","Tamsui","Guanyin Mountain stands across the water."]],
    xiluo:[["西螺大橋","西螺","橋が開通した日、みんなが見に来ました。"],["Xiluo Bridge","Xiluo","The day the bridge opened, everyone came to see."]],
    village:[["山村の吊り橋","山村","吊り橋を渡れば、家へ帰る道です。"],["Mountain Village Bridge","Village","Across the bridge is the road home."]],
    sunmoon:[["日月潭","日月潭","小舟が湖のほとりに寄り、水はとても静かです。"],["Sun Moon Lake","Sun Moon","A small boat rests by the shore; the water is still."]],
    qingshui:[["清水断崖","東海岸","崖がまっすぐ海へ落ちていきます。"],["Qingshui Cliffs","East Coast","The cliffs drop straight into the sea."]],
    puli:[["烏牛欄の吊り橋","埔里","橋のたもとに立つと、谷から風が吹き上げてきます。"],["Wuniulan Bridge","Puli","At the bridgehead, wind rises up from the valley."]],
    keelungbeach:[["基隆の海水浴場","基隆","夏は、みんなで水遊び。"],["Keelung Beach","Keelung","In summer, everyone comes to swim."]],
    keelung:[["基隆港","基隆","大きな船が入ってくる港です。"],["Keelung Harbor","Keelung","Where the big ships come in."]],
    chihkan:[["赤崁楼","台南","古都・台南の古い楼閣です。"],["Chihkan Tower","Tainan","An old tower in the old capital of Tainan."]],
    gaoping:[["下淡水渓の鉄橋","高屏","長い鉄橋が大きな川をまたいでいます。"],["Lower Tamsui River Bridge","Gaoping","A long iron bridge spans the wide river."]],
    harvest:[["農村の稲刈り","農村","稲が実ったら、家族みんなで田んぼへ。"],["Rice Harvest","Farm","When the rice is ripe, the whole family heads to the fields."]],
    lvchuan:[["台中の緑川","台中","柳が川沿いに垂れています。"],["Lüchuan River, Taichung","Taichung","Willows hang along the riverbank."]],
    longshan:[["艋舺の龍山寺","艋舺","ここでお参りして、無事を願います。"],["Longshan Temple","Mengjia","People come here to pray for peace."]],
    guanziling:[["関子嶺温泉","関子嶺","山あいの温泉宿です。"],["Guanziling Hot Springs","Guanziling","A hot-spring inn up in the mountains."]],
    mtali:[["阿里山の村","阿里山","山の中腹の小さな村に、かまどの煙がゆっくり上ります。"],["Alishan Village","Alishan","In a small hillside village, kitchen smoke rises slowly."]],
    yushan:[["阿里山から望む玉山","阿里山","線路沿いに歩くと、遠くに玉山が見えます。"],["Jade Mountain from Alishan","Alishan","Walk along the tracks and Jade Mountain appears far away."]],
    xiziwan:[["西子湾の海水浴場","高雄","色とりどりの旗がはためき、海風が夕焼けを運びます。"],["Sizihwan Beach","Kaohsiung","Bright flags flutter in the sea breeze at sunset."]],
    cijin:[["旗後の海水浴場","旗後","波が何度も岸に打ち寄せます。"],["Cijin Beach","Cijin","Waves roll onto the shore, one after another."]],
    yancheng:[["高雄銀座","塩埕","おしゃれをして、街を歩きます。"],["Kaohsiung Ginza","Yancheng","Dressed up nicely for a stroll through town."]],
    fengshan:[["鳳山の街並み","鳳山","古いガジュマルの下、通りはずっと涼しい。"],["Fengshan Street","Fengshan","Under the old banyan, the whole street stays cool."]],
    shimen:[["牡丹の石門","屏東","両側の岩壁の間を、川が流れます。"],["Shimen Gorge, Mudan","Pingtung","A stream runs between two rock walls."]],
    jiaoban:[["角板山のトロッコ","桃園","小さなトロッコが山のそばで、押す人を待っています。"],["Jiaoban Mountain Trolley","Taoyuan","A little push-car waits by the hill for someone to push it."]]
  };

  // 姿勢與套組：[日文, 英文]
  const POSES = {
    thumb:["いいね","Thumbs up"], thumbs:["両手でいいね","Two thumbs up"], ya:["ピース","Peace sign"], yas:["両手でピース","Double peace"],
    bigheart:["頭の上で大きなハート","Big heart overhead"], heart:["胸の前でハート","Heart at your chest"], wave:["手を振る","Wave"],
    hurray:["両手を上げる","Hands up high"], pray:["手を合わせる","Palms together"], gongxi:["おめでとうのポーズ","Lucky greeting"],
    muscle:["力こぶ","Show your muscles"], salute:["敬礼","Salute"], chin:["あごに手","Hand on chin"], phone:["電話のポーズ","Call me"],
    ok:["OKサイン","OK sign"], point:["カメラを指さす","Point at the camera"], fist:["ガッツポーズ","Fist pump"], hips:["腰に手","Hands on hips"],
    arms:["腕組み","Arms crossed"], duo:["二人で肩を寄せて","Shoulder to shoulder"], duoheart:["二人でハート","Heart together"]
  };
  const POSE_SETS = [
    ["旧友と3枚","Old friends"],["かっこいいおじいちゃん","Cool grandpa"],["かわいいおばあちゃん","Sweet grandma"],
    ["幸運がくる","Good luck is coming"],["元気がいちばん","Healthy and strong"],["遠足の写真","School trip"],
    ["放課後","After school"],["お正月だよ","Happy New Year"],["大スター","Big star"],
    ["歌謡ショー","Cabaret show"],["電話するね","I'll call you"],["社長のおごり","The boss is buying"],
    ["卒業写真","Graduation photo"],["夫婦で一枚","Husband and wife"],["義兄弟","Sworn brothers"],
    ["大親友","Best friends"],["お参りして無事を願う","Praying for peace"],["野球で優勝","Baseball champs"],
    ["兵隊さんの敬礼","Soldier's salute"],["おいしい！","Delicious!"],["映画のポスター","Movie poster"],
    ["孫に教わった","The grandkids taught me"],["若いころの私","Young me"],["きみが一番","You're the best"],
    ["久しぶり","Long time no see"],["今日はうれしい","Happy today"],["OK、大丈夫","OK, no problem"],
    ["力持ち","Strongman"],["大好きだよ","Love you"],["またね","Bye-bye"]
  ];

  // AI 沒回應時，依願望內容挑一句
  const LOCAL_BLESSINGS = {
    zh:[
      [/健康|身體|病|腳|手術|平安|長壽/,["願您身體勇健，每天都吃得下、睡得好。","願病痛遠離，日子平平安安。"]],
      [/孫|子女|兒|女兒|小孩|考試|讀書|學業/,["願孩子們順順利利，也常常回來看您。","願晚輩們都有好前途，您也放心歡喜。"]],
      [/錢|財|發|生意|工作|賺/,["願您財源廣進，做什麼都順順利利。","願生意興隆，日子越過越好。"]],
      [/家|團圓|回來|老伴|牽手/,["願全家人常常團圓，一起吃飯、一起笑。","願您和家人互相照顧，幸福長長久久。"]],
      [null,["願您平安健康，天天歡喜。","願您心想事成，日子甜甜蜜蜜。"]]
    ],
    ja:[
      [/健康|元気|体|身体|病|足|腰|手術|無事|長生き/,["いつまでもお元気で、毎日おいしく食べて、ぐっすり眠れますように。","病気が遠ざかり、穏やかな毎日が続きますように。"]],
      [/孫|子ども|子供|息子|娘|試験|受験|勉強|学校/,["お子さんやお孫さんが元気に育ち、たびたび会いに来てくれますように。","若い人たちの未来が明るく、あなたも安心して笑っていられますように。"]],
      [/お金|金運|商売|仕事|給料|宝くじ/,["お金に恵まれ、何をしてもうまくいきますように。","お仕事が順調で、暮らしがますます豊かになりますように。"]],
      [/家族|家|帰|夫|妻|一緒/,["家族がたびたび集まって、一緒に食べて笑えますように。","ご家族と支え合い、幸せがいつまでも続きますように。"]],
      [null,["いつまでもお元気で、毎日笑顔でいられますように。","願いがかなって、やさしい日々が続きますように。"]]
    ],
    en:[
      [/health|healthy|sick|ill|surgery|pain|safe|long life|recover/i,["May you stay strong, eat well, and sleep soundly every night.","May illness stay far away and your days be calm and safe."]],
      [/grand|child|kid|son|daughter|exam|school|study/i,["May the children do well, and come home to see you often.","May the young ones have bright futures, so you can smile with peace of mind."]],
      [/money|rich|business|job|work|career|lottery/i,["May good fortune find you, and may everything you do go smoothly.","May your work thrive and each year be better than the last."]],
      [/family|home|together|husband|wife|partner|reunion/i,["May your family gather often, to eat together and laugh together.","May you and your loved ones care for each other, happily, for many years."]],
      [null,["May you stay healthy and find joy in every day.","May your wish come true, and your days be gentle and sweet."]]
    ]
  };

  const MONTHS = ["Jan.","Feb.","Mar.","Apr.","May","Jun.","Jul.","Aug.","Sep.","Oct.","Nov.","Dec."];
  let lang = pick();

  function pick(){
    let saved = new URLSearchParams(location.search).get("lang");
    if(!LANGS[saved]){ try{ saved = localStorage.getItem("lang"); }catch(_){ saved = null; } }
    if(LANGS[saved]) return saved;
    const nav = (navigator.language || "zh").toLowerCase();
    return nav.startsWith("ja") ? "ja" : nav.startsWith("zh") ? "zh" : "en";
  }

  const index = () => ORDER.indexOf(lang);
  function t(key,vars={}){
    const row = TEXT[key];
    const text = row ? row[index()] : key;
    return text.replace(/\{(\w+)\}/g,(_,name)=>vars[name] ?? "");
  }

  function scene(base){
    if(lang==="zh") return base;
    const row = SCENES[base.key]?.[lang==="ja" ? 0 : 1];
    return row ? {...base, title:row[0], icon:row[1], poem:row[2]} : base;
  }

  const poseLabel = (key,zh) => lang==="zh" ? zh : POSES[key][lang==="ja" ? 0 : 1];
  const setTitle = (number,zh) => lang==="zh" ? zh : POSE_SETS[number-1][lang==="ja" ? 0 : 1];

  // 中日文用「」，英文用彎引號
  const quote = text => lang==="en" ? `“${text}”` : `「${text}」`;

  function date(d){
    if(lang==="zh") return `民國${d.getFullYear()-1911}年${d.getMonth()+1}月${d.getDate()}日`;
    if(lang==="ja") return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // 拍貼角落那行字
  function caption(base,d){
    const title = scene(base).title;
    if(lang==="zh") return `${title}留影 ${d.getFullYear()-1911}.${d.getMonth()+1}.${d.getDate()}`;
    if(lang==="ja") return `${title}にて ${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
    return `At ${title} · ${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function localBlessing(wish){
    const rules = LOCAL_BLESSINGS[lang];
    const pool = rules.find(([pattern]) => !pattern || pattern.test(wish))[1];
    return pool[Math.floor(Math.random()*pool.length)];
  }

  // 後端還沒換新版時會一律回中文；語言對不上就不用它
  function fits(reply){
    if(lang==="ja") return /[぀-ヿ]/.test(reply);
    if(lang==="en") return !/[㐀-鿿]/.test(reply) && /[a-z]/i.test(reply);
    return /[㐀-鿿]/.test(reply);
  }

  // 沒有中日文字就當英文排
  const latin = text => !/[぀-ヿ㐀-鿿]/.test(text);

  // 量著寬度換行：英文整個字一起換，中日文逐字換，標點不放在行首
  function wrap(c,text,width){
    const units = latin(text) ? text.split(/(?<=\s)/) : [...text];
    const lines = []; let line = "";
    units.forEach(unit => {
      const next = line+unit;
      if(c.measureText(next.trimEnd()).width>width && line.trim() && !"，。、！？；：」』）,.!?;:".includes(unit.trim())){ lines.push(line.trimEnd()); line = unit.trimStart(); }
      else line = next;
    });
    if(line.trim()) lines.push(line.trimEnd());
    return lines;
  }

  function apply(root=document){
    document.documentElement.lang = LANGS[lang].html;
    document.title = t("pageTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content",t("pageDesc"));
    root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    [["i18nAria","aria-label"],["i18nPlaceholder","placeholder"],["i18nAlt","alt"]].forEach(([data,attr]) => {
      root.querySelectorAll(`[data-${data.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}]`).forEach(el => el.setAttribute(attr,t(el.dataset[data])));
    });
    document.querySelectorAll("[data-lang]").forEach(el => el.setAttribute("aria-pressed",String(el.dataset.lang===lang)));
    const current = document.getElementById("langBtn");
    if(current) current.querySelector("b").textContent = LANGS[lang].name;
  }

  function set(next){
    if(!LANGS[next] || next===lang) return;
    lang = next;
    try{ localStorage.setItem("lang",lang); }catch(_){}
    apply();
    document.dispatchEvent(new CustomEvent("langchange",{detail:{lang}}));
  }

  return {
    get lang(){ return lang; },
    get speech(){ return LANGS[lang].speech; },
    LANGS, ORDER, t, set, apply, scene, poseLabel, setTitle, quote, date, caption, localBlessing, fits, latin, wrap
  };
})();
window.I18N = I18N;
