const API=window.EMS_CONFIG.API_URL;
const ROLE=window.EMS_CONFIG.ROLE||"guest";
const ADMIN_TOKEN=window.EMS_CONFIG.ADMIN_TOKEN||"";
const CURRENT_USER="良澤";
const state={instruments:[],cars:[],pairings:[],fixedConfigs:[],calibrations:[],repairs:[],people:[],logs:[],category:"全部"};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const isAdmin=()=>ROLE==="admin";
function escapeHtml(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function value(o,ks){for(const k of ks)if(o&&o[k]!==undefined&&o[k]!=="")return o[k];return""}
function normCat(raw){const s=String(raw||"").trim();if(/空品車|監測車/.test(s))return"空品車";if(/小孔|孔口/.test(s))return"小孔";if(/高量|採集器|^P\d+/i.test(s))return"高量採集器";if(/流量計|浮子|氣體流量/.test(s))return"流量計";if(/PM.?10/i.test(s))return"PM10";return"其他儀器"}
function pill(s){s=s||"未設定";const c=/送修|故障|停用|過期/.test(s)?"danger":/校正|保養|部分|待|替代/.test(s)?"warn":/可使用|使用中|正常|啟用/.test(s)?"":"neutral";return`<span class="status-pill ${c}">${escapeHtml(s)}</span>`}
async function get(action){const r=await fetch(`${API}?action=${encodeURIComponent(action)}&_=${Date.now()}`);const j=await r.json();if(!j.success)throw new Error(j.message||"讀取失敗");return j.data||[]}
async function post(action,payload){const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,adminToken:ADMIN_TOKEN,payload})});const j=await r.json();if(!j.success)throw new Error(j.message||"寫入失敗");return j.data}
function flash(msg,type="success"){const box=$(type==="success"?"#successBox":"#errorBox");box.textContent=msg;box.classList.remove("hidden");setTimeout(()=>box.classList.add("hidden"),4000)}
async function loadAll(){
 $("#loading").classList.remove("hidden");
 try{
   const [ping,instruments,cars,pairings,fixedConfigs,calibrations,repairs,people,logs]=await Promise.all([
     get("ping"),get("instruments"),get("cars"),get("currentPairings"),get("fixedOrificeConfigs"),get("orificeCalibrations"),get("repairs"),get("people"),get("logs")
   ]);
   Object.assign(state,{instruments,cars,pairings,fixedConfigs,calibrations,repairs,people,logs});
   $("#apiDot").className="status-dot online";$("#apiStatus").textContent="API 已連線";renderAll();
 }catch(e){$("#apiDot").className="status-dot offline";$("#apiStatus").textContent="API 連線失敗";flash(e.message,"error")}
 finally{$("#loading").classList.add("hidden")}
}
function getOrifices(){return state.instruments.filter(x=>normCat(value(x,["類別","名稱","編號"]))==="小孔"&&value(x,["狀態"])!=="停用")}
function renderAll(){
 const active=state.instruments.filter(x=>value(x,["狀態"])!=="停用");
 $("#metricCars").textContent=state.cars.length;
 $("#metricOrifices").textContent=active.filter(x=>normCat(value(x,["類別","名稱","編號"]))==="小孔").length;
 $("#metricHighVolume").textContent=active.filter(x=>normCat(value(x,["類別","名稱","編號"]))==="高量採集器").length;
 $("#metricRepairs").textContent=state.repairs.filter(x=>!/已取回|維修完成|取消/.test(value(x,["狀態"]))).length;
 renderDashboard();renderCars();renderCategoryTabs();renderInstruments();renderPairingControls();renderCarOrificeGrid();renderCalibrations();renderRepairs();renderPeople();renderLogs();renderTasks();
}
function carConfig(carNo){
 const fixed=state.fixedConfigs.find(x=>value(x,["車號"])===carNo)||{};
 const pairing=state.pairings.find(x=>value(x,["對象類型"])==="空品車"&&value(x,["對象編號"])===carNo)||{};
 return {fixed:value(fixed,["固定小孔"]),current:value(pairing,["小孔編號"])||value(fixed,["固定小孔"]),reason:value(pairing,["替換原因","用途"]),expected:value(pairing,["預計歸還"]),isTemporary:!!value(pairing,["小孔編號"])&&value(pairing,["小孔編號"])!==value(fixed,["固定小孔"])};
}
function renderDashboard(){
 $("#dashboardPairings").innerHTML=state.cars.slice(0,7).map(c=>{const no=value(c,["車號"]),cfg=carConfig(no);return`<div class="list-row"><div><strong>${escapeHtml(no)}</strong><br><span>固定 ${escapeHtml(cfg.fixed||"未設定")}｜目前 ${escapeHtml(cfg.current||"未設定")}</span></div>${pill(cfg.isTemporary?"替代使用中":"正常配置")}</div>`}).join("")||'<div class="empty">尚無資料</div>';
 $("#dashboardCars").innerHTML=state.cars.map(x=>`<div class="list-row"><div><strong>${escapeHtml(value(x,["車號"]))}</strong><br><span>${escapeHtml(value(x,["目前操作者"])||"尚未指定")}</span></div>${pill(value(x,["車輛狀態"]))}</div>`).join("")||'<div class="empty">尚無空品車資料</div>';
}
function renderCars(){
 const q=$("#carSearch").value.trim().toLowerCase();
 const rows=state.cars.filter(x=>JSON.stringify(x).toLowerCase().includes(q));
 $("#carsGrid").innerHTML=rows.map(x=>{const no=value(x,["車號"]),cfg=carConfig(no);return`<article class="entity-card"><div style="display:flex;justify-content:space-between;gap:12px"><div><h3>${escapeHtml(no)} 車</h3><div class="sub">空氣品質監測車</div></div>${pill(value(x,["車輛狀態"]))}</div><dl><dt>目前操作者</dt><dd>${escapeHtml(value(x,["目前操作者"])||"尚未指定")}</dd><dt>固定小孔</dt><dd>${escapeHtml(cfg.fixed||"未設定")}</dd><dt>目前使用</dt><dd>${escapeHtml(cfg.current||"未設定")}</dd><dt>配置狀態</dt><dd>${cfg.isTemporary?pill("替代使用中"):pill("正常配置")}</dd></dl></article>`}).join("")||'<div class="empty">沒有符合的空品車</div>';
}
function renderCategoryTabs(){
 const cats=["全部","小孔","流量計","高量採集器","PM10","其他儀器"];
 $("#categoryTabs").innerHTML=cats.map(c=>`<button class="category-tab ${state.category===c?"active":""}" data-category="${c}">${c} (${c==="全部"?state.instruments.length:state.instruments.filter(x=>normCat(value(x,["類別","名稱","編號"]))===c).length})</button>`).join("");
 $$("[data-category]").forEach(b=>b.onclick=()=>{state.category=b.dataset.category;renderCategoryTabs();renderInstruments()});
}
function renderInstruments(){
 const q=$("#instrumentSearch").value.trim().toLowerCase(),status=$("#instrumentStatus").value;
 const rows=state.instruments.filter(x=>(state.category==="全部"||normCat(value(x,["類別","名稱","編號"]))===state.category)&&(!status||value(x,["狀態"])===status)&&JSON.stringify(x).toLowerCase().includes(q));
 $("#instrumentTableBody").innerHTML=rows.map(x=>{const code=value(x,["編號"]);return`<tr><td><strong>${escapeHtml(code)}</strong></td><td>${escapeHtml(normCat(value(x,["類別","名稱","編號"])))}</td><td>${escapeHtml(value(x,["名稱"]))}</td><td>${escapeHtml([value(x,["品牌"]),value(x,["型號"])].filter(Boolean).join(" / "))}</td><td>${escapeHtml(value(x,["序號"]))}</td><td>${escapeHtml(value(x,["目前位置"])||"倉庫")}</td><td>${pill(value(x,["狀態"]))}</td><td class="admin-only"><div class="admin-action"><button class="secondary-button" onclick="editStatus('${escapeHtml(code)}')">狀態</button><button class="danger-button" onclick="archiveInstrument('${escapeHtml(code)}')">停用</button></div></td></tr>`}).join("")||'<tr><td colspan="8" class="empty">沒有符合的儀器</td></tr>';
}
function renderPairingControls(){
 const carOpts=state.cars.map(x=>`<option value="${escapeHtml(value(x,["車號"]))}">${escapeHtml(value(x,["車號"]))}</option>`).join("");
 $("#fixedCar").innerHTML=carOpts;$("#tempCar").innerHTML=carOpts;
 const oriOpts=getOrifices().map(x=>`<option value="${escapeHtml(value(x,["編號"]))}">${escapeHtml(value(x,["編號"]))}</option>`).join("");
 $("#fixedOrifice").innerHTML=oriOpts;$("#tempOrifice").innerHTML=oriOpts;
}
function renderCarOrificeGrid(){
 $("#carOrificeGrid").innerHTML=state.cars.map(c=>{const no=value(c,["車號"]),cfg=carConfig(no);return`<article class="entity-card"><div style="display:flex;justify-content:space-between;gap:12px"><div><h3>${escapeHtml(no)}</h3><div class="sub">小孔配置</div></div>${pill(cfg.isTemporary?"替代使用中":"正常配置")}</div><dl><dt>固定小孔</dt><dd>${escapeHtml(cfg.fixed||"未設定")}</dd><dt>目前使用</dt><dd>${escapeHtml(cfg.current||"未設定")}</dd><dt>替換原因</dt><dd>${escapeHtml(cfg.isTemporary?(cfg.reason||"未填寫"):"—")}</dd><dt>預計歸還</dt><dd>${escapeHtml(cfg.expected||"—")}</dd></dl></article>`}).join("")||'<div class="empty">尚無空品車資料</div>';
}
function renderCalibrations(){$("#calibrationTableBody").innerHTML=state.calibrations.map(x=>`<tr><td><strong>${escapeHtml(value(x,["小孔編號"]))}</strong></td><td>${escapeHtml(value(x,["報告編號"]))}</td><td>${escapeHtml(value(x,["校正日期"]))}</td><td>${escapeHtml(value(x,["到期日"]))}</td><td>${escapeHtml(value(x,["斜率(m³/min)"]))}</td><td>${escapeHtml(value(x,["截距(m³/min)"]))}</td><td>${escapeHtml(value(x,["相關係數(m³/min)"]))}</td><td>${escapeHtml(value(x,["保存形式"])||"紙本")}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">尚無小孔校正資料</td></tr>'}
function renderRepairs(){$("#repairTableBody").innerHTML=state.repairs.map(x=>`<tr><td>${escapeHtml(value(x,["對象類型"]))}</td><td>${escapeHtml(value(x,["所屬空品車"])||"—")}</td><td><strong>${escapeHtml(value(x,["儀器ID/編號","儀器項目"]))}</strong></td><td>${escapeHtml(value(x,["故障內容"]))}</td><td>${escapeHtml(value(x,["送修日期"]))}</td><td>${pill(value(x,["狀態"]))}</td><td>${escapeHtml(value(x,["登記者"])||"—")}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">目前沒有維修紀錄</td></tr>'}
function renderPeople(){
 $("#peopleTableBody").innerHTML=state.people.map(x=>`<tr><td><strong>${escapeHtml(value(x,["姓名"]))}</strong></td><td>${escapeHtml(value(x,["權限"]))}</td><td>${pill(value(x,["狀態"]))}</td><td>${escapeHtml(value(x,["最後更新時間"])||"—")}</td><td><button class="secondary-button" onclick="togglePerson('${escapeHtml(value(x,["姓名"]))}','${escapeHtml(value(x,["狀態"]))}')">${value(x,["狀態"])==="停用"?"啟用":"停用"}</button></td></tr>`).join("")||'<tr><td colspan="5" class="empty">尚未建立人員資料</td></tr>';
}
function renderLogs(){
 $("#logsTableBody").innerHTML=state.logs.slice().reverse().slice(0,100).map(x=>`<tr><td>${escapeHtml(value(x,["時間"]))}</td><td>${escapeHtml(value(x,["操作者"]))}</td><td>${escapeHtml(value(x,["動作"]))}</td><td>${escapeHtml(value(x,["對象"]))}</td><td class="sub">${escapeHtml(value(x,["內容"]))}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">尚無操作紀錄</td></tr>';
}
function renderTasks(){
 const tasks=[];
 state.cars.forEach(c=>{const no=value(c,["車號"]),cfg=carConfig(no);if(cfg.isTemporary)tasks.push({level:"info",title:`${no} 正在使用替代小孔 ${cfg.current}`,detail:`固定小孔 ${cfg.fixed}；原因：${cfg.reason||"未填寫"}`})});
 state.repairs.filter(x=>!/已取回|維修完成|取消/.test(value(x,["狀態"]))).forEach(x=>tasks.push({level:"danger",title:`${value(x,["儀器ID/編號","儀器項目"])} 維修尚未結案`,detail:value(x,["故障內容"])||"請確認維修進度"}));
 const today=new Date(),limit=new Date(today);limit.setDate(limit.getDate()+30);
 state.calibrations.forEach(x=>{const d=new Date(value(x,["到期日"]));if(!isNaN(d)&&d<=limit)tasks.push({level:d<today?"danger":"",title:`${value(x,["小孔編號"])} 校正${d<today?"已過期":"即將到期"}`,detail:`到期日：${value(x,["到期日"])}`})});
 $("#taskList").innerHTML=tasks.map(t=>`<div class="task-item"><div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.detail)}</span></div><div class="task-level ${t.level}">${t.level==="danger"?"需處理":t.level==="info"?"替代中":"提醒"}</div></div>`).join("")||'<div class="empty">目前沒有需要立即處理的事項</div>';
}
async function archiveInstrument(code){if(!confirm(`確定將 ${code} 設為停用？歷史紀錄會保留。`))return;try{await post("archiveInstrument",{編號:code,最後更新者:CURRENT_USER});flash(`${code} 已停用`);await loadAll()}catch(e){flash(e.message,"error")}}
async function editStatus(code){const status=prompt(`${code} 新狀態：可使用／校正中／維修／故障／停用`);if(!status)return;try{await post("updateInstrument",{編號:code,狀態:status,最後更新者:CURRENT_USER});flash(`${code} 狀態已更新`);await loadAll()}catch(e){flash(e.message,"error")}}
async function togglePerson(name,status){const newStatus=status==="停用"?"啟用":"停用";if(!confirm(`確定將 ${name} 設為${newStatus}？`))return;try{await post("updatePerson",{姓名:name,狀態:newStatus,最後更新者:CURRENT_USER});flash(`${name} 已${newStatus}`);await loadAll()}catch(e){flash(e.message,"error")}}
window.archiveInstrument=archiveInstrument;window.editStatus=editStatus;window.togglePerson=togglePerson;
function switchView(name){
 $$(".view").forEach(v=>v.classList.remove("active"));$$(".nav-item").forEach(v=>v.classList.remove("active"));
 $(`#view-${name}`).classList.add("active");$(`.nav-item[data-view="${name}"]`)?.classList.add("active");
 const t={dashboard:["系統總覽","即時讀取 EMS-Air Google 試算表"],cars:["空品車","操作者、固定小孔與目前使用小孔"],instruments:["儀器管理","分類、新增、停用與狀態管理"],pairings:["小孔配置","固定配置、臨時替換與恢復"],calibrations:["小孔校正","紙本報告關鍵資料"],repairs:["維修管理","空品車及各項儀器維修紀錄"],admin:["管理中心","管理員限定功能與追溯紀錄"]};
 $("#pageTitle").textContent=t[name][0];$("#pageSubtitle").textContent=t[name][1];$("#sidebar").classList.remove("open");
}
$$(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));$$("[data-admin-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.adminGo));
$("#refreshButton").onclick=loadAll;$("#instrumentSearch").oninput=renderInstruments;$("#instrumentStatus").onchange=renderInstruments;$("#carSearch").oninput=renderCars;$("#menuButton").onclick=()=>$("#sidebar").classList.toggle("open");
$("#addInstrumentButton").onclick=()=>$("#instrumentModal").classList.remove("hidden");$$("[data-close-modal]").forEach(b=>b.onclick=()=>$("#instrumentModal").classList.add("hidden"));
$("#addPersonButton").onclick=()=>$("#personModal").classList.remove("hidden");$$("[data-close-person]").forEach(b=>b.onclick=()=>$("#personModal").classList.add("hidden"));
$("#instrumentForm").onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.target).entries());p.目前位置=p.目前位置||"倉庫";p.最後更新者=CURRENT_USER;try{await post("addInstrument",p);$("#instrumentModal").classList.add("hidden");e.target.reset();flash(`${p.編號} 已新增`);await loadAll()}catch(err){flash(err.message,"error")}};
$("#personForm").onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.target).entries());p.最後更新者=CURRENT_USER;try{await post("addPerson",p);$("#personModal").classList.add("hidden");e.target.reset();flash(`${p.姓名} 已新增`);await loadAll()}catch(err){flash(err.message,"error")}};
$("#saveFixedButton").onclick=async()=>{const p={車號:$("#fixedCar").value,固定小孔:$("#fixedOrifice").value,備註:$("#fixedNote").value,最後更新者:CURRENT_USER};try{await post("saveFixedOrifice",p);flash(`${p.車號} 固定小孔已設為 ${p.固定小孔}`);await loadAll()}catch(e){flash(e.message,"error")}};
$("#saveTemporaryButton").onclick=async()=>{const p={車號:$("#tempCar").value,替代小孔:$("#tempOrifice").value,替換原因:$("#tempReason").value,預計歸還:$("#tempReturnDate").value,最後更新者:CURRENT_USER};try{await post("startTemporaryOrifice",p);flash(`${p.車號} 已改用 ${p.替代小孔}`);await loadAll()}catch(e){flash(e.message,"error")}};
$("#restoreFixedButton").onclick=async()=>{const p={車號:$("#tempCar").value,最後更新者:CURRENT_USER};if(!confirm(`確定讓 ${p.車號} 恢復固定小孔？`))return;try{await post("restoreFixedOrifice",p);flash(`${p.車號} 已恢復固定小孔`);await loadAll()}catch(e){flash(e.message,"error")}};
if(!isAdmin())$$(".admin-only").forEach(el=>el.classList.add("hidden"));
$("#roleLabel").textContent=isAdmin()?"最高管理員":"唯讀使用者";
loadAll();