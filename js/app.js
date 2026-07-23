const API=window.EMS_CONFIG.API_URL;
const ADMIN_TOKEN=window.EMS_CONFIG.ADMIN_TOKEN||"";
const CURRENT_USER="良澤";
const PAIRING_KEY="emsAirHvOrificePairingV4";
const state={instruments:[],cars:[],repairs:[],pairings:loadPairings()};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fixedPairs=[
  {hv:"P2",flow:"FU2",orifice:"K"},{hv:"P3",flow:"FU3",orifice:"A"},{hv:"P4",flow:"FU4",orifice:"A"},{hv:"P5",flow:"FU5",orifice:"M"},{hv:"P6",flow:"FU6",orifice:"C"}
];
const knownWind=["B7","B8","B9","B10","B11"];
const knownFlow=["FU2","FU3","FU4","FU5","FU6","FU24","FU26","FU27","FU29","FU30","FU31","FU32","FU33"];
const knownHV=["P2","P3","P4","P5","P6","P23","P24","P26","P27","P28","P29","P30"];
function escapeHtml(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function value(o,ks){for(const k of ks)if(o&&o[k]!==undefined&&o[k]!=="")return o[k];return""}
function loadPairings(){try{const saved=JSON.parse(localStorage.getItem(PAIRING_KEY)||"null");if(saved?.current)return saved}catch{}return{current:Object.fromEntries(fixedPairs.map(x=>[x.hv,x.orifice])),history:[]}}
function savePairings(){localStorage.setItem(PAIRING_KEY,JSON.stringify(state.pairings))}
function normalizeStatus(s){s=String(s||"").trim();if(!s)return"尚未確認";if(/停用|封存/.test(s))return"尚未確認";return s}
function pill(s){s=normalizeStatus(s);const c=/故障|不可使用|送修|過期/.test(s)?"danger":/校正|維修|部分|待|尚未/.test(s)?"warn":/可使用|正常/.test(s)?"":"neutral";return`<span class="status-pill ${c}">${escapeHtml(s)}</span>`}
function categoryOf(x){const raw=[value(x,["類別"]),value(x,["名稱"]),value(x,["編號"])].join(" ");if(/高量|採集器|^P\d+/i.test(raw))return"高量採集器";if(/風速|風向|氣象/.test(raw)||knownWind.includes(value(x,["編號"])))return"風速計";if(/流量|浮子/.test(raw)||/^FU/i.test(value(x,["編號"])))return"流量計";if(/小孔|孔口/.test(raw))return"小孔";return"其他"}
async function get(action){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(`${API}?action=${encodeURIComponent(action)}&_=${Date.now()}`,{signal:controller.signal,cache:"no-store"});
    if(!r.ok)throw new Error(`API HTTP ${r.status}`);
    const j=await r.json();
    if(!j.success)throw new Error(j.message||`${action} 讀取失敗`);
    return j.data||[];
  }catch(err){
    if(err.name==="AbortError")throw new Error(`${action} 讀取逾時`);
    throw err;
  }finally{clearTimeout(timer)}
}
async function post(action,payload){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,adminToken:ADMIN_TOKEN,payload})});const j=await r.json();if(!j.success)throw new Error(j.message||"寫入失敗");return j.data}
function flash(msg,type="success"){const box=$(type==="success"?"#successBox":"#errorBox");box.textContent=msg;box.classList.remove("hidden");setTimeout(()=>box.classList.add("hidden"),4000)}
function instrumentByCode(code){return state.instruments.find(x=>String(value(x,["編號"])).toUpperCase()===code.toUpperCase())}
function statusOfCode(code){return normalizeStatus(value(instrumentByCode(code),["狀態"]))}
function noteOf(x){return value(x,["備註","故障內容","說明"])||"—"}
function allForCategory(cat){
  const found=state.instruments.filter(x=>categoryOf(x)===cat);
  const ids=cat==="高量採集器"?knownHV:cat==="風速計"?knownWind:cat==="流量計"?knownFlow:[];
  const map=new Map(found.map(x=>[String(value(x,["編號"])).toUpperCase(),x]));
  ids.forEach(id=>{if(!map.has(id.toUpperCase()))map.set(id.toUpperCase(),{編號:id,狀態:"尚未確認",備註:"資料待補"})});
  return [...map.values()].sort((a,b)=>
    String(value(a,["編號"])).localeCompare(String(value(b,["編號"])),"zh-Hant",{numeric:true})
  );
}
function unresolvedRepairs(){return state.repairs.filter(x=>!/已取回|維修完成|取消|結案/.test(value(x,["狀態"])))}
async function loadAll(){
  $("#loading").classList.remove("hidden");
  $("#errorBox").classList.add("hidden");
  const results=await Promise.allSettled([get("instruments"),get("cars"),get("repairs")]);
  const keys=["instruments","cars","repairs"];
  const failures=[];
  results.forEach((result,index)=>{
    if(result.status==="fulfilled")state[keys[index]]=result.value;
    else failures.push(`${keys[index]}：${result.reason?.message||"讀取失敗"}`);
  });
  if(failures.length===0){
    $("#apiDot").className="status-dot online";
    $("#apiStatus").textContent="API 已連線";
  }else{
    $("#apiDot").className="status-dot offline";
    $("#apiStatus").textContent=failures.length===3?"API 連線失敗":"部分資料未連線";
    flash(`目前先顯示預設架構。${failures.join("；")}`,"error");
  }
  renderAll();
  $("#loading").classList.add("hidden");
}

function runGlobalSearch(){
  const q=$("#globalSearch")?.value.trim().toUpperCase();
  const box=$("#searchResult");
  if(!box)return;
  if(!q){box.innerHTML='<div class="empty">輸入 P5、FU5、M、B7 等編號即可查詢</div>';return}
  const results=[];
  const pair=fixedPairs.find(p=>p.hv===q||p.flow===q||String(state.pairings.current[p.hv]||"").toUpperCase()===q.replace(/台$/,""));
  if(pair){
    results.push(`<article class="search-result-card"><strong>${pair.hv}</strong><span>固定流量計：${pair.flow}</span><span>目前小孔：${escapeHtml(state.pairings.current[pair.hv]||"待補")}台</span><span>狀態：${normalizeStatus(statusOfCode(pair.hv))}</span></article>`);
  }
  const inst=state.instruments.filter(x=>String(value(x,["編號"])).toUpperCase().includes(q));
  inst.forEach(x=>results.push(`<article class="search-result-card"><strong>${escapeHtml(value(x,["編號"]))}</strong><span>${escapeHtml(categoryOf(x))}</span><span>狀態：${escapeHtml(normalizeStatus(value(x,["狀態"])))}</span><span>備註：${escapeHtml(noteOf(x))}</span></article>`));
  box.innerHTML=results.length?results.join(""):'<div class="empty">找不到符合的資料</div>';
}

function renderAll(){
  const hv=allForCategory("高量採集器"),wind=allForCategory("風速計"),flow=allForCategory("流量計");
  $("#metricCars").textContent=state.cars.length||7;$("#metricHV").textContent=hv.length;$("#metricWind").textContent=wind.length;$("#metricFlow").textContent=flow.length;
  const issueCount=[...hv,...wind,...flow].filter(x=>!/可使用|正常/.test(normalizeStatus(value(x,["狀態"])))).length+unresolvedRepairs().length;
  $("#metricIssues").textContent=issueCount;
  renderDashboard();renderCars();renderPairings();renderInstrumentCategory("高量採集器","#highvolumeGrid");renderInstrumentCategory("風速計","#windGrid");renderInstrumentCategory("流量計","#flowGrid");renderRepairs();
}
function carStatus(car){
  const no=value(car,["車號"]),direct=normalizeStatus(value(car,["車輛狀態"]));
  const repairs=unresolvedRepairs().filter(r=>value(r,["所屬空品車"])===no||value(r,["對象編號"])===no);
  if(/不可使用|故障/.test(direct))return"不可使用";
  if(repairs.length||/維修|部分/.test(direct))return"部分設備維修";
  if(/可使用|正常/.test(direct))return"正常可使用";
  return"尚未確認";
}
function renderDashboard(){
  const cars=(state.cars.length?state.cars:["A6","A7","A8","A9","A10","A11","A12"].map(車號=>({車號}))).slice(0,7);
  $("#dashboardCars").innerHTML=cars.map(c=>`<div class="list-row"><div><strong>${escapeHtml(value(c,["車號"]))}</strong><br><span>${escapeHtml(value(c,["目前操作者"])||"尚未指定")}</span></div>${pill(carStatus(c))}</div>`).join("");
  $("#dashboardPairings").innerHTML=fixedPairs.map(p=>`<div class="list-row"><div><strong>${p.hv}</strong><br><span>${p.flow}（固定）｜${escapeHtml(state.pairings.current[p.hv]||"待補")}台</span></div>${pill(statusOfCode(p.hv))}</div>`).join("");
  const issues=[];
  ["高量採集器","風速計","流量計"].forEach(cat=>allForCategory(cat).forEach(x=>{const st=normalizeStatus(value(x,["狀態"]));if(!/可使用|正常/.test(st))issues.push({code:value(x,["編號"]),cat,st,note:noteOf(x)})}));
  unresolvedRepairs().forEach(x=>issues.push({code:value(x,["儀器ID/編號","儀器項目","對象編號"]),cat:"維修紀錄",st:value(x,["狀態"])||"維修",note:value(x,["故障內容"])||"—"}));
  $("#dashboardIssues").innerHTML=issues.length?`<div class="table-wrap flat"><table><thead><tr><th>編號</th><th>類別</th><th>狀態</th><th>備註</th></tr></thead><tbody>${issues.slice(0,15).map(x=>`<tr><td><strong>${escapeHtml(x.code)}</strong></td><td>${escapeHtml(x.cat)}</td><td>${pill(x.st)}</td><td>${escapeHtml(x.note)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">目前沒有待處理項目</div>';
}
function renderCars(){
  const q=$("#carSearch").value.trim().toLowerCase();
  const defaults={A6:"鐘",A7:"吳",A8:"聰",A9:"強",A10:"儀",A11:"許",A12:"閔"};
  const cars=state.cars.length?state.cars:Object.keys(defaults).map(車號=>({車號,目前操作者:defaults[車號]}));
  $("#carsGrid").innerHTML=cars.filter(x=>JSON.stringify(x).toLowerCase().includes(q)).map(x=>{const no=value(x,["車號"]),repairs=unresolvedRepairs().filter(r=>value(r,["所屬空品車"])===no||value(r,["對象編號"])===no);return`<article class="entity-card"><div class="entity-head"><div><h3>${escapeHtml(no)}</h3><div class="sub">負責人：${escapeHtml(value(x,["目前操作者"])||defaults[no]||"待補")}</div></div>${pill(carStatus(x))}</div><dl><dt>維修項目</dt><dd>${escapeHtml(repairs.map(r=>value(r,["儀器ID/編號","儀器項目"])).filter(Boolean).join("、")||"無")}</dd><dt>維修說明</dt><dd>${escapeHtml(repairs.map(r=>value(r,["故障內容"])).filter(Boolean).join("；")||"—")}</dd><dt>最後確認</dt><dd>${escapeHtml(value(x,["最後更新時間","最後確認"])||"尚未確認")}</dd></dl></article>`}).join("")||'<div class="empty">沒有符合的空品車</div>';
}
function renderPairings(){
  $("#pairHV").innerHTML=fixedPairs.map(x=>`<option value="${x.hv}">${x.hv}</option>`).join("");
  const orifices=["A","B","C","D","E","F","I","J","K","L","M","N"];
  $("#pairOrifice").innerHTML=orifices.map(x=>`<option value="${x}">${x}台</option>`).join("");updatePairForm();
  $("#pairingGrid").innerHTML=fixedPairs.map(p=>`<article class="entity-card"><div class="entity-head"><div><h3>${p.hv}</h3><div class="sub">小車高量</div></div>${pill(statusOfCode(p.hv))}</div><dl><dt>固定 FU</dt><dd>${p.flow}</dd><dt>目前小孔</dt><dd>${escapeHtml(state.pairings.current[p.hv]||"待補")}台</dd></dl></article>`).join("");
  $("#pairingHistoryBody").innerHTML=state.pairings.history.slice().reverse().map(h=>`<tr><td>${escapeHtml(h.at)}</td><td>${h.hv}</td><td>${h.flow}</td><td>${escapeHtml(h.old||"—")}</td><td>${escapeHtml(h.new)}</td><td>${escapeHtml(h.by||"—")}</td></tr>`).join("")||'<tr><td colspan="6" class="empty">尚無配對異動紀錄</td></tr>';
}
function updatePairForm(){const p=fixedPairs.find(x=>x.hv===$("#pairHV").value)||fixedPairs[0];$("#pairFlow").value=p.flow;$("#pairOrifice").value=state.pairings.current[p.hv]||p.orifice}
function renderInstrumentCategory(cat,target){
  const search=$(`.instrument-search[data-category="${cat}"]`)?.value.trim().toLowerCase()||"";const status=$(`.status-filter[data-category="${cat}"]`)?.value||"";
  const rows=allForCategory(cat).filter(x=>(!status||normalizeStatus(value(x,["狀態"]))===status)&&JSON.stringify(x).toLowerCase().includes(search));
  $(target).innerHTML=rows.map(x=>{const code=value(x,["編號"]),fixed=cat==="流量計"?fixedPairs.find(p=>p.flow===code)?.hv:"";const pairing=cat==="高量採集器"?fixedPairs.find(p=>p.hv===code):null;return`<article class="entity-card"><div class="entity-head"><div><h3>${escapeHtml(code)}</h3><div class="sub">${escapeHtml(cat)}</div></div>${pill(value(x,["狀態"]))}</div><dl>${pairing?`<dt>固定流量計</dt><dd>${pairing.flow}</dd><dt>目前小孔</dt><dd>${escapeHtml(state.pairings.current[code]||"待補")}台</dd>`:""}${fixed?`<dt>固定對應</dt><dd>${fixed}</dd>`:""}<dt>目前位置</dt><dd>${escapeHtml(value(x,["目前位置"])||"待補")}</dd><dt>備註</dt><dd>${escapeHtml(noteOf(x))}</dd></dl><button class="secondary-button small-button" onclick="openStatusModal('${escapeHtml(code)}')">更新狀態</button></article>`}).join("")||'<div class="empty">沒有符合的儀器</div>';
}
function renderRepairs(){$("#repairTableBody").innerHTML=state.repairs.map(x=>`<tr><td>${escapeHtml(value(x,["對象類型"]))}</td><td>${escapeHtml(value(x,["所屬空品車"])||"—")}</td><td><strong>${escapeHtml(value(x,["儀器ID/編號","儀器項目"]))}</strong></td><td>${escapeHtml(value(x,["故障內容"]))}</td><td>${escapeHtml(value(x,["送修日期"]))}</td><td>${pill(value(x,["狀態"]))}</td><td>${escapeHtml(value(x,["登記者"])||"—")}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">目前沒有維修紀錄</td></tr>'}
function openStatusModal(code){const x=instrumentByCode(code);$("#statusCode").value=code;$("#statusModalTitle").textContent=`更新 ${code} 狀態`;$("#statusValue").value=normalizeStatus(value(x,["狀態"]));$("#statusNote").value=value(x,["備註"]);$("#statusModal").classList.remove("hidden")}
window.openStatusModal=openStatusModal;
function closeStatusModal(){$("#statusModal").classList.add("hidden")}
function switchView(name){$$('.view').forEach(v=>v.classList.remove('active'));$$('.nav-item').forEach(v=>v.classList.remove('active'));$(`#view-${name}`).classList.add('active');$(`.nav-item[data-view="${name}"]`)?.classList.add('active');const titles={dashboard:["系統總覽","空品車維修、小孔配對與主要儀器狀態"],cars:["空品車","車況、維修項目與最後確認"],pairings:["小孔配對","P2～P6 固定 FU，只變更小孔"],highvolume:["高量採集器","小車與空品車高量採集器狀態"],wind:["風速計","可使用、校正、維修、故障與待確認"],flow:["流量計","固定對應與儀器狀態"],repairs:["維修紀錄","空品車及主要儀器維修資料"]};$("#pageTitle").textContent=titles[name][0];$("#pageSubtitle").textContent=titles[name][1];$("#sidebar").classList.remove("open")}
$$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));
$("#menuButton").onclick=()=>$("#sidebar").classList.toggle("open");$("#refreshButton").onclick=loadAll;$("#carSearch").oninput=renderCars;$("#globalSearchButton").onclick=runGlobalSearch;$("#globalSearch").onkeydown=e=>{if(e.key==="Enter")runGlobalSearch()};
$$('.instrument-search,.status-filter').forEach(el=>el.oninput=el.onchange=()=>{const cat=el.dataset.category;renderInstrumentCategory(cat,cat==="高量採集器"?"#highvolumeGrid":cat==="風速計"?"#windGrid":"#flowGrid")});
$("#pairHV").onchange=updatePairForm;$("#savePairingButton").onclick=()=>{const hv=$("#pairHV").value,p=fixedPairs.find(x=>x.hv===hv),next=$("#pairOrifice").value,old=state.pairings.current[hv]||"";state.pairings.current[hv]=next;state.pairings.history.push({at:new Date().toLocaleString("zh-TW",{hour12:false}),hv,flow:p.flow,old,new:next,by:$("#pairBy").value.trim()});savePairings();flash(`${hv} 已配對 ${next}台`);renderAll()};
$("#closeStatusModal").onclick=$("#cancelStatusModal").onclick=closeStatusModal;
$("#statusForm").onsubmit=async e=>{e.preventDefault();const code=$("#statusCode").value,status=$("#statusValue").value,note=$("#statusNote").value.trim();try{await post("updateInstrument",{編號:code,狀態:status,備註:note,最後更新者:CURRENT_USER});flash(`${code} 狀態已更新`);closeStatusModal();await loadAll()}catch(err){flash(err.message,"error")}};
loadAll();
