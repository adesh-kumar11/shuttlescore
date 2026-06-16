import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveLiveMatch, savePlayers, saveTeams, saveHistory, saveTournament, saveRoomMeta, getRoomMeta,
  subscribeLiveMatch, subscribePlayers, subscribeTeams, subscribeHistory, subscribeTournament
} from "./firebase";

import {
  gw, mw, shuffle,
  mkMatch, mkBye,
  buildKnockout, buildRoundRobin, buildQualifier,
  propagateKnockout, rrStandingsCalc, computeStats
} from "./gameLogic";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const C={
  bg:"#060d14",surf:"#0d1b2a",card:"#112035",
  bdr:"#1e3a52",bdrBr:"#2a5278",
  sA:"#ff4d6d",sAd:"#ff4d6d18",
  sB:"#38b6ff",sBd:"#38b6ff18",
  gr:"#1db954",grd:"#1db95418",grDim:"#0d5229",
  net:"#e8f4f8",acc:"#ffe566",accd:"#ffe56618",
  txt:"#e8f5ff",txtM:"#8db4cc",txtD:"#3d6880",
  win:"#22c55e",winD:"#22c55e18",
  loss:"#ef4444",lossD:"#ef444418",
  orange:"#ff8c42",purple:"#b47dff",
};

const css=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{font-size:15px}
body{background:${C.bg};color:${C.txt};font-family:'DM Sans',sans-serif;min-height:100dvh;overflow-x:hidden}
.app{max-width:480px;margin:0 auto;padding:10px 11px 88px}

.bot-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:${C.surf};border-top:1px solid ${C.bdr};display:flex;z-index:50;padding-bottom:env(safe-area-inset-bottom)}
.nbn{flex:1;padding:9px 2px 7px;border:none;background:transparent;color:${C.txtD};cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;transition:color .2s;min-width:0;overflow:hidden}
.nbn.on{color:${C.gr}}
.ni{font-size:18px;line-height:1}

.hdr{display:flex;align-items:center;gap:6px;margin-bottom:12px;padding-top:env(safe-area-inset-top);flex-wrap:nowrap;overflow:hidden}
.lbox{width:30px;height:30px;min-width:30px;background:${C.gr};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.linfo{min-width:0;flex-shrink:1}
.ltxt{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.5px;line-height:1.1;white-space:nowrap}
.lsub{font-size:9px;color:${C.txtD};font-weight:600;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
.hr{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
.room-chip{display:flex;align-items:center;gap:3px;background:${C.grd};border:1px solid ${C.gr}44;padding:3px 7px;border-radius:20px;font-size:10px;font-weight:700;color:${C.gr};max-width:90px;overflow:hidden}
.room-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.sdot.ok{background:${C.win}}.sdot.err{background:${C.loss}}.sdot.spin{background:${C.acc};animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.sync-pill{display:flex;align-items:center;gap:3px;font-size:9px;color:${C.txtD};white-space:nowrap}

.card{background:${C.card};border-radius:14px;border:1px solid ${C.bdr}}
.p14{padding:14px}.p16{padding:16px}
.card+.card{margin-top:9px}
.ey{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.txtD};margin-bottom:9px}

.sb{background:linear-gradient(150deg,${C.card} 0%,${C.surf} 100%);border-radius:14px;border:1px solid ${C.bdr};padding:12px;margin-bottom:10px}
.sb-top{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:start;margin-bottom:10px}
.sbt{display:flex;flex-direction:column;gap:2px;min-width:0}
.sbt-r{align-items:flex-end;text-align:right}
.sbn{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbp{font-size:10px;color:${C.txtM};line-height:1.4;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pips{display:flex;gap:3px;margin-top:5px}
.sbt-r .pips{justify-content:flex-end}
.pip{width:11px;height:11px;border-radius:50%;border:1.5px solid ${C.bdr};transition:all .3s;flex-shrink:0}
.pip.wa{background:${C.sA};border-color:${C.sA};box-shadow:0 0 6px ${C.sA}88}
.pip.wb{background:${C.sB};border-color:${C.sB};box-shadow:0 0 6px ${C.sB}88}
.sb-mid{display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:2px;flex-shrink:0}
.sb-ml{font-size:9px;font-weight:700;color:${C.txtD};letter-spacing:.8px;white-space:nowrap}
.sb-sc{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}
.scn{font-family:'Syne',sans-serif;font-size:86px;font-weight:800;line-height:.9;letter-spacing:-5px}
.scn.a{color:${C.sA};text-shadow:0 0 50px ${C.sA}44}
.scn.b{color:${C.sB};text-shadow:0 0 50px ${C.sB}44}
.sc-sep{display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0}
.sorb{width:9px;height:9px;border-radius:50%;background:${C.acc};animation:sg 1.2s ease-in-out infinite}
@keyframes sg{0%,100%{box-shadow:0 0 4px ${C.acc}}50%{box-shadow:0 0 14px ${C.acc};opacity:.6}}
.sep-l{width:2px;height:36px;background:${C.bdr};border-radius:1px}
.set-row{display:flex;justify-content:center;gap:5px;flex-wrap:wrap;margin-top:6px}
.spill{display:flex;align-items:center;gap:3px;background:${C.surf};border:1px solid ${C.bdr};border-radius:16px;padding:3px 8px;font-family:'JetBrains Mono',monospace;font-size:11px}
.sn{font-size:9px;color:${C.txtD};margin-right:1px}

.court-wrap{position:relative;border-radius:14px;overflow:hidden;margin-bottom:10px;user-select:none;touch-action:manipulation}
.ctap{position:absolute;top:0;height:100%;transition:background .1s}
.ctap:active{background:rgba(255,255,255,.07)}
.rpl{position:absolute;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);animation:rOut .5s ease-out forwards}
@keyframes rOut{0%{width:0;height:0;opacity:.8}100%{width:120px;height:120px;opacity:0}}
.ptt{position:absolute;font-family:'Syne',sans-serif;font-size:24px;font-weight:800;pointer-events:none;animation:ptU .6s ease-out forwards}
@keyframes ptU{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-40px)}}

.btn{padding:9px 13px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;line-height:1}
.bg{background:${C.gr};color:#000}.bg:hover{filter:brightness(1.08)}
.by{background:${C.acc};color:#000}.by:hover{filter:brightness(1.08)}
.bo{background:${C.card};color:${C.txt};border:1px solid ${C.bdr}}.bo:hover{border-color:${C.bdrBr}}
.br{background:${C.lossD};color:${C.loss};border:1px solid ${C.loss}33}
.bpu{background:${C.purple}22;color:${C.purple};border:1px solid ${C.purple}44}
.bor{background:${C.orange}22;color:${C.orange};border:1px solid ${C.orange}44}
.bsm{padding:5px 10px;font-size:12px;border-radius:8px}
.bxs{padding:4px 8px;font-size:11px;border-radius:7px}
.bfull{width:100%}
.btn:disabled{opacity:.35;pointer-events:none}
.ctrl{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}

.inp{background:${C.surf};border:1.5px solid ${C.bdr};color:${C.txt};padding:9px 11px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:border .2s;width:100%}
.inp:focus{border-color:${C.gr}}
.inp::placeholder{color:${C.txtD}}
.ir{display:flex;gap:7px;margin-bottom:9px}
.lbl{font-size:11px;font-weight:700;color:${C.txtD};margin-bottom:4px}
.sel{background:${C.surf};border:1.5px solid ${C.bdr};color:${C.txt};padding:9px 11px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;width:100%;cursor:pointer}
.sel:focus{border-color:${C.gr}}
option{background:${C.surf};color:${C.txt}}

.chip{display:inline-flex;align-items:center;gap:4px;background:${C.surf};border:1px solid ${C.bdr};padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600;margin:3px}
.cx{background:none;border:none;color:${C.txtD};cursor:pointer;font-size:14px;line-height:1;padding:0}.cx:hover{color:${C.loss}}

.cfgr{display:flex;gap:7px;margin-bottom:10px}
.cfgo{flex:1;padding:9px 5px;border:1.5px solid ${C.bdr};border-radius:10px;background:transparent;color:${C.txtM};cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:700;font-size:12px;transition:all .18s;text-align:center;line-height:1.4}
.cfgo.on{border-color:${C.gr};background:${C.grd};color:${C.gr}}

.tabs{display:flex;gap:6px;margin-bottom:13px;flex-wrap:wrap}
.tab{padding:6px 12px;border:1.5px solid ${C.bdr};border-radius:20px;cursor:pointer;font-size:11px;font-weight:700;font-family:'DM Sans',sans-serif;transition:all .18s;background:transparent;color:${C.txtM}}
.tab.on{background:${C.gr};color:#000;border-color:${C.gr}}

.mc{background:${C.card};border:1px solid ${C.bdr};border-radius:13px;padding:12px;margin-bottom:8px}
.mc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;margin-bottom:7px}
.mcs{flex:1;min-width:0}.mcs-r{text-align:right}
.mcn{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mcp{font-size:10px;color:${C.txtM};margin-top:1px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mcpi{display:flex;gap:3px;margin-top:4px}
.mcpi-r{justify-content:flex-end}
.rpip{width:9px;height:9px;border-radius:50%;background:${C.bdr};flex-shrink:0}
.rpip.w{background:${C.win};box-shadow:0 0 5px ${C.win}55}
.rpip.l{background:${C.loss};box-shadow:0 0 4px ${C.loss}33}
.mc-sets{display:flex;gap:5px;align-items:center;flex-wrap:wrap;padding-top:7px;border-top:1px solid ${C.bdr}}
.mcb{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700}
.mcb.w{background:${C.winD};color:${C.win};border:1px solid ${C.win}33}
.mcb.t{background:${C.accd};color:${C.acc};border:1px solid ${C.acc}33}

.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:7px}
.sb2{background:${C.surf};border-radius:10px;padding:9px 5px;text-align:center;overflow:hidden}
.sv{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sl{font-size:9px;color:${C.txtD};font-weight:700;margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
.wrb{height:4px;background:${C.bdr};border-radius:2px;overflow:hidden;margin:4px 0}
.wrf{height:100%;background:linear-gradient(90deg,${C.gr},${C.acc});border-radius:2px}
.psc{background:${C.card};border:1px solid ${C.bdr};border-radius:13px;padding:12px;margin-bottom:7px}
.psc-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ava{width:34px;height:34px;min-width:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:14px;flex-shrink:0}
.psc-info{flex:1;min-width:0}
.psc-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psc-rec{font-size:11px;color:${C.txtM};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psc-wr{text-align:right;flex-shrink:0}
.psc-pct{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;line-height:1}
.psc-lbl{font-size:9px;color:${C.txtD}}

.reg-card{background:${C.card};border:1px solid ${C.bdr};border-radius:12px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px;overflow:hidden}
.reg-num{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:${C.acc};min-width:20px;width:20px;flex-shrink:0;text-align:center}
.reg-name{flex:1;font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reg-sub{font-size:11px;color:${C.txtM};margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.reg-acts{display:flex;gap:4px;flex-shrink:0}

/* ── VISUAL BRACKET ── */
.bracket-wrap{overflow-x:auto;overflow-y:visible;padding:6px 6px 12px;margin-bottom:10px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#1e3a52 transparent}
.bracket-wrap::-webkit-scrollbar{height:4px}
.bracket-wrap::-webkit-scrollbar-track{background:transparent}
.bracket-wrap::-webkit-scrollbar-thumb{background:#1e3a52;border-radius:4px}
.bracket-wrap svg{display:block;overflow:visible}

/* Bracket node box */
.b-node{background:${C.surf};border:1.5px solid ${C.bdr};border-radius:8px;overflow:hidden;transition:border-color .2s}
.b-node.done{border-color:${C.gr}66}
.b-node.live-m{border-color:${C.acc};box-shadow:0 0 8px ${C.acc}44}
.b-node.bye{opacity:.5;border-style:dashed}
.b-slot{display:flex;align-items:center;gap:5px;padding:5px 8px;font-size:11px;font-weight:600;min-height:26px;line-height:1.2}
.b-slot+.b-slot{border-top:1px solid ${C.bdr}}
.b-slot.bwin{background:${C.grd};color:${C.gr}}
.b-slot.blose{color:${C.txtD}}
.b-slot.btbd{color:${C.txtD};font-style:italic}
.b-seed{font-size:9px;color:${C.txtD};font-family:'JetBrains Mono',monospace;min-width:10px;flex-shrink:0}
.b-score{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;flex-shrink:0}
.b-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.b-actions{display:flex;gap:4px;padding:4px 6px;border-top:1px solid ${C.bdr};background:${C.card};flex-wrap:wrap}
.b-round-label{font-size:9px;font-weight:700;color:${C.txtD};letter-spacing:1px;text-transform:uppercase;text-align:center;margin-bottom:6px;white-space:nowrap}

/* List fixture card (RR/groups) */
.fcard{background:${C.card};border:1px solid ${C.bdr};border-radius:12px;margin-bottom:7px;overflow:hidden}
.fcard-head{display:flex;align-items:center;gap:6px;padding:10px 12px}
.ft{font-weight:700;font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3}
.ft-r{text-align:right}
.f-score{display:flex;align-items:center;gap:5px;flex-shrink:0}
.finp{width:34px;text-align:center;background:${C.surf};border:1.5px solid ${C.bdr};color:${C.txt};padding:4px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600}
.finp:focus{border-color:${C.gr};outline:none}
.fcard-foot{display:flex;gap:5px;padding:6px 10px;border-top:1px solid ${C.bdr};background:${C.surf};flex-wrap:wrap}
.f-result{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;padding:0 4px;text-align:center;min-width:50px}
.f-sets-detail{font-size:9px;color:${C.txtD};padding:0 12px 6px;font-family:'JetBrains Mono',monospace}
.bye-card{background:${C.card};border:1px solid ${C.bdr}33;border-radius:12px;padding:8px 12px;margin-bottom:7px;display:flex;align-items:center;gap:8px;opacity:.6}

.std{width:100%;border-collapse:collapse;font-size:11px}
.std th{text-align:left;padding:5px 6px;color:${C.txtD};font-weight:700;font-size:9px;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid ${C.bdr}}
.std td{padding:6px 6px;border-bottom:1px solid ${C.bdr}33;max-width:100px;overflow:hidden;text-overflow:ellipsis}
.std tr:first-child td{color:${C.acc}}
.pts{font-family:'JetBrains Mono',monospace;font-weight:700;color:${C.gr}}
.qual-badge{display:inline-block;background:${C.grd};color:${C.gr};border:1px solid ${C.gr}44;border-radius:10px;font-size:9px;font-weight:700;padding:1px 5px;margin-left:4px}
.group-hdr{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:${C.acc};margin:10px 0 6px;letter-spacing:.5px}

.modal{position:fixed;inset:0;background:#000d;display:flex;align-items:flex-end;justify-content:center;z-index:300;animation:fIn .2s}
@keyframes fIn{from{opacity:0}to{opacity:1}}
.modal-box{background:${C.card};border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:480px;border-top:1px solid ${C.bdr};max-height:80dvh;overflow-y:auto}
.modal-title{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:12px}
.sel-item{display:flex;align-items:center;gap:8px;padding:10px 12px;background:${C.surf};border-radius:10px;margin-bottom:6px;cursor:pointer;border:1.5px solid transparent;transition:all .15s;font-weight:600;font-size:13px}
.sel-item:hover{border-color:${C.gr};background:${C.grd};color:${C.gr}}

.toast{position:fixed;top:54px;left:50%;transform:translateX(-50%);background:${C.card};border:1px solid ${C.gr};color:${C.gr};padding:7px 16px;border-radius:20px;font-weight:700;font-size:12px;z-index:400;animation:tIn .25s ease-out;white-space:nowrap;pointer-events:none}
@keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

.ov{position:fixed;inset:0;background:#000d;display:flex;align-items:center;justify-content:center;z-index:300;animation:fIn .2s}
.wm{background:${C.card};border-radius:20px;padding:26px 20px;text-align:center;border:1px solid ${C.gr}44;max-width:310px;width:92%}
.tr{font-size:52px;margin-bottom:4px;animation:bIn .5s ease-out}
@keyframes bIn{0%{transform:scale(0)}70%{transform:scale(1.1)}100%{transform:scale(1)}}

.live-bar{background:${C.accd};border:1px solid ${C.acc}44;border-radius:11px;padding:8px 12px;margin-bottom:9px;display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:${C.acc}}
.ldot{width:7px;height:7px;border-radius:50%;background:#ff4444;animation:pulse 1s infinite;flex-shrink:0}

.empty{text-align:center;padding:30px 16px;color:${C.txtD}}
.ei{font-size:36px;margin-bottom:7px;opacity:.5}.et{font-size:13px;font-weight:600}.es{font-size:11px;margin-top:3px}
.div{height:1px;background:${C.bdr};margin:12px 0}

.lobby{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90dvh;padding:20px;text-align:center}
.llogo{font-size:52px;margin-bottom:10px}
.ltitle{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;letter-spacing:-1px;margin-bottom:3px}
.lsub{font-size:13px;color:${C.txtM};margin-bottom:24px}
.rcard{background:${C.card};border:1px solid ${C.bdr};border-radius:14px;padding:16px;width:100%;max-width:320px;margin-bottom:10px;text-align:left}
.rcardT{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;margin-bottom:11px}
.locked{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,13,20,.65);border-radius:14px;font-size:26px}
`;

// ─── COURT ───────────────────────────────────────────────────────────────────
function Court({onScore,serving,disabled}){
  const [fx,setFx]=useState([]);const nid=useRef(0);
  const tap=useCallback((side,e)=>{
    if(disabled)return;
    const r=e.currentTarget.closest(".court-wrap").getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top,id=nid.current++;
    setFx(f=>[...f,{id,x,y,side}]);setTimeout(()=>setFx(f=>f.filter(i=>i.id!==id)),600);
    onScore(side);
  },[onScore,disabled]);
  return(
    <div className="court-wrap" style={{opacity:disabled?.5:1,pointerEvents:disabled?"none":"auto"}}>
      <svg viewBox="0 0 540 300" style={{display:"block",width:"100%"}}>
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a5c2e"/><stop offset="100%" stopColor="#073d1e"/></linearGradient></defs>
        <rect width="540" height="300" fill="url(#cg)"/>
        <rect x="24" y="16" width="492" height="268" fill="none" stroke={C.gr} strokeWidth="2" opacity=".9"/>
        <rect x="56" y="16" width="428" height="268" fill="none" stroke={C.grDim} strokeWidth="1.2" opacity=".6"/>
        <line x1="24" y1="96" x2="516" y2="96" stroke={C.gr} strokeWidth="1.2" opacity=".6"/>
        <line x1="24" y1="204" x2="516" y2="204" stroke={C.gr} strokeWidth="1.2" opacity=".6"/>
        <line x1="270" y1="96" x2="270" y2="204" stroke={C.gr} strokeWidth="1.2" opacity=".5"/>
        <line x1="270" y1="10" x2="270" y2="290" stroke={C.net} strokeWidth="2.5" opacity=".85"/>
        <circle cx="270" cy="10" r="4" fill={C.net} opacity=".5"/><circle cx="270" cy="290" r="4" fill={C.net} opacity=".5"/>
        {serving==="A"&&<circle cx="142" cy="150" r="8" fill={C.acc} opacity=".9"><animate attributeName="r" values="8;10;8" dur="1.1s" repeatCount="indefinite"/></circle>}
        {serving==="B"&&<circle cx="398" cy="150" r="8" fill={C.acc} opacity=".9"><animate attributeName="r" values="8;10;8" dur="1.1s" repeatCount="indefinite"/></circle>}
        <text x="142" y="150" textAnchor="middle" dominantBaseline="middle" fill={C.sA} opacity=".14" style={{fontSize:36,fontFamily:"Syne,sans-serif",fontWeight:800}}>TAP</text>
        <text x="398" y="150" textAnchor="middle" dominantBaseline="middle" fill={C.sB} opacity=".14" style={{fontSize:36,fontFamily:"Syne,sans-serif",fontWeight:800}}>TAP</text>
      </svg>
      <div className="ctap" style={{left:0,width:"50%"}} onClick={e=>tap("A",e)}/>
      <div className="ctap" style={{right:0,width:"50%"}} onClick={e=>tap("B",e)}/>
      {fx.map(f=>(
        <div key={f.id}>
          <div className="rpl" style={{left:f.x,top:f.y,background:f.side==="A"?C.sA:C.sB}}/>
          <div className="ptt" style={{left:f.x-14,top:f.y-14,color:f.side==="A"?C.sA:C.sB}}>+1</div>
        </div>
      ))}
    </div>
  );
}

// ─── SCOREBOARD ──────────────────────────────────────────────────────────────
function Scoreboard({tA,tB,sA,sB,sets,serving,setsToWin}){
  const wA=sets.filter(s=>s.winner==="A").length,wB=sets.filter(s=>s.winner==="B").length;
  return(
    <div className="sb">
      <div className="sb-top">
        <div className="sbt"><div className="sbn" style={{color:C.sA}}>{tA.name||"Team A"}</div><div className="sbp">{tA.players.join(" / ")}</div><div className="pips">{Array.from({length:setsToWin}).map((_,i)=><div key={i} className={`pip ${wA>i?"wa":""}`}/>)}</div></div>
        <div className="sb-mid"><div className="sb-ml">{tA.type==="doubles"?"DBL":"SGL"}</div><div style={{fontSize:9,color:C.txtD,fontWeight:700}}>SET {sets.length+1}</div></div>
        <div className="sbt sbt-r"><div className="sbn" style={{color:C.sB}}>{tB.name||"Team B"}</div><div className="sbp">{tB.players.join(" / ")}</div><div className="pips">{Array.from({length:setsToWin}).map((_,i)=><div key={i} className={`pip ${wB>i?"wb":""}`}/>)}</div></div>
      </div>
      <div className="sb-sc">
        <div className="scn a">{sA}</div>
        <div className="sc-sep">{serving==="A"?<div className="sorb"/>:<div style={{width:9,height:9}}/>}<div className="sep-l"/>{serving==="B"?<div className="sorb"/>:<div style={{width:9,height:9}}/>}</div>
        <div className="scn b">{sB}</div>
      </div>
      {sets.length>0&&<div className="set-row">{sets.map((s,i)=>(
        <div key={i} className="spill"><span className="sn">S{i+1}</span>
          <span style={{color:s.winner==="A"?C.sA:C.txtD,fontWeight:s.winner==="A"?700:400}}>{s.scoreA}</span>
          <span style={{color:C.txtD}}>–</span>
          <span style={{color:s.winner==="B"?C.sB:C.txtD,fontWeight:s.winner==="B"?700:400}}>{s.scoreB}</span>
        </div>
      ))}</div>}
    </div>
  );
}

// ─── VISUAL KNOCKOUT BRACKET ─────────────────────────────────────────────────
function KnockoutBracket({rounds,isRef,onLaunch,onSwap,onBye}){
  const BOX_W=166,BOX_H=70,GAP_X=66,LABEL_H=36,PAD=12;
  // unit = vertical space allocated per R0 slot (box + 2-row buttons + breathing room)
  const unit=152;
  const r0n=rounds[0]?.matches.length||1;

  const getPos=(ri,mi)=>{
    const slotsPerMatch=r0n/rounds[ri].matches.length;
    const firstSlot=mi*slotsPerMatch;
    const lastSlot=firstSlot+slotsPerMatch-1;
    const centerY=LABEL_H+PAD+((firstSlot+lastSlot)/2)*unit+BOX_H/2;
    return{x:PAD+ri*(BOX_W+GAP_X), y:centerY-BOX_H/2};
  };

  const svgW=PAD*2+rounds.length*(BOX_W+GAP_X)-GAP_X;
  const svgH=LABEL_H+PAD+r0n*unit+PAD*2;

  const connectors=rounds.slice(0,-1).flatMap((rnd,ri)=>
    rnd.matches.map((_,mi)=>{
      if(mi%2!==0)return null;
      const p1=getPos(ri,mi),p2=getPos(ri,mi+1)||getPos(ri,mi);
      const pN=getPos(ri+1,Math.floor(mi/2));
      const x1=p1.x+BOX_W, y1=p1.y+BOX_H/2;
      const x2=p2.x+BOX_W, y2=p2.y+BOX_H/2;
      const midX=x1+GAP_X/2;
      const xN=pN.x, yN=pN.y+BOX_H/2;
      const bothDone=rounds[ri].matches[mi]?.status==="done"&&rounds[ri].matches[mi+1]?.status==="done";
      const lineCol=bothDone?C.gr+"88":C.bdrBr;
      return(
        <g key={`c${ri}-${mi}`}>
          <polyline points={`${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
            fill="none" stroke={lineCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1={midX} y1={(y1+y2)/2} x2={xN} y2={yN} stroke={lineCol} strokeWidth="2" strokeLinecap="round"/>
        </g>
      );
    }).filter(Boolean)
  );

  return(
    <div className="bracket-wrap">
      <svg width={svgW} height={svgH} style={{display:"block",minWidth:svgW}}>
        {/* Round column headers */}
        {rounds.map((rnd,ri)=>{
          const lx=PAD+ri*(BOX_W+GAP_X);
          return(
            <g key={`lbl${ri}`}>
              <text x={lx+BOX_W/2} y={LABEL_H-12} textAnchor="middle"
                fill={C.txtD} fontSize="10" fontWeight="700" fontFamily="DM Sans,sans-serif" letterSpacing="1.5">
                {rnd.name.replace("🏆 ","").toUpperCase()}
              </text>
              <rect x={lx} y={LABEL_H-5} width={BOX_W} height="2" rx="1" fill={C.bdr}/>
            </g>
          );
        })}

        {connectors}

        {rounds.map((rnd,ri)=>rnd.matches.map((match,mi)=>{
          const{x,y}=getPos(ri,mi);
          const done=match.status==="done";
          const bye=match.isBye||match.status==="bye";
          const wA=done&&match.winner===match.teamA;
          const wB=done&&match.winner===match.teamB;
          const tbd=!bye&&(match.teamA==="TBD"||match.teamB==="TBD");
          const nameA=(match.teamA||"TBD").slice(0,17);
          const nameB=bye?"BYE":(match.teamB||"TBD").slice(0,17);
          const scoreA=done?String(match.scoreA):"";
          const scoreB=done?String(match.scoreB):"";

          // Two-row button positions
          const bW=Math.floor((BOX_W-8)/3); // ~52px each for 3 buttons
          const btnY1=y+BOX_H+14; // Play row
          const btnY2=y+BOX_H+44; // Swap / Bye row

          return(
            <g key={match.id} opacity={bye?0.5:1}>
              {/* Subtle glow on completed matches */}
              {done&&<rect x={x-2} y={y-2} width={BOX_W+4} height={BOX_H+4} rx="11" fill={C.gr} opacity=".08"/>}

              {/* Card background */}
              <rect x={x} y={y} width={BOX_W} height={BOX_H} rx="9"
                fill={done?"#0c1d30":bye?"#0a1520":C.surf}
                stroke={done?C.gr:tbd?C.bdrBr:C.bdr}
                strokeWidth={done?1.5:1}
                strokeDasharray={tbd?"6 3":undefined}/>

              {/* Winner row highlight */}
              {wA&&<rect x={x+1} y={y+1} width={BOX_W-2} height={BOX_H/2-1} rx="8" fill={C.gr} opacity=".14"/>}
              {wB&&<rect x={x+1} y={y+BOX_H/2+1} width={BOX_W-2} height={BOX_H/2-2} rx="7" fill={C.gr} opacity=".14"/>}

              {/* Team A */}
              <text x={x+10} y={y+BOX_H/4+5} dominantBaseline="middle"
                fill={wA?C.gr:tbd?C.txtD:C.txt}
                fontSize={tbd?10:12} fontWeight={wA?700:600} fontFamily="DM Sans,sans-serif">
                {nameA}
              </text>
              {scoreA&&<text x={x+BOX_W-9} y={y+BOX_H/4+5} dominantBaseline="middle" textAnchor="end"
                fill={wA?C.gr:C.txtM} fontSize="14" fontWeight="700" fontFamily="JetBrains Mono,monospace">{scoreA}</text>}

              {/* Divider */}
              <line x1={x+6} y1={y+BOX_H/2} x2={x+BOX_W-6} y2={y+BOX_H/2}
                stroke={done?C.bdrBr:C.bdr} strokeWidth="1"/>

              {/* Team B */}
              <text x={x+10} y={y+BOX_H*3/4+5} dominantBaseline="middle"
                fill={wB?C.gr:tbd||bye?C.txtD:C.txt}
                fontSize={tbd||bye?10:12} fontWeight={wB?700:600} fontFamily="DM Sans,sans-serif">
                {nameB}
              </text>
              {scoreB&&<text x={x+BOX_W-9} y={y+BOX_H*3/4+5} dominantBaseline="middle" textAnchor="end"
                fill={wB?C.gr:C.txtM} fontSize="14" fontWeight="700" fontFamily="JetBrains Mono,monospace">{scoreB}</text>}

              {/* Sets detail chip */}
              {done&&match.setsDetail&&(
                <text x={x+BOX_W/2} y={y+BOX_H+9} textAnchor="middle"
                  fill={C.gr+"99"} fontSize="8.5" fontFamily="JetBrains Mono,monospace">{match.setsDetail}</text>
              )}

              {/* Action buttons — referee only, non-TBD, non-bye */}
              {isRef&&!tbd&&!bye&&(
                <g>
                  {/* Row 1: Play / Replay (full width, prominent) */}
                  <rect x={x+2} y={btnY1} width={BOX_W-4} height={26} rx="7"
                    fill={done?C.gr+"1e":C.gr} stroke={done?C.gr+"55":"none"} strokeWidth="1"
                    style={{cursor:"pointer"}} onClick={()=>onLaunch(match,{round:ri,match:mi})}/>
                  <text x={x+BOX_W/2} y={btnY1+13} textAnchor="middle" dominantBaseline="middle"
                    fill={done?C.gr:"#000"} fontSize="12" fontWeight="800" fontFamily="DM Sans,sans-serif"
                    style={{pointerEvents:"none"}}>
                    {done?"↺  REPLAY":"▶  PLAY"}
                  </text>

                  {/* Row 2: Swap A | Swap B | Bye */}
                  {/* Swap A */}
                  <rect x={x+2} y={btnY2} width={bW} height={22} rx="6"
                    fill={C.purple+"18"} stroke={C.purple+"44"} strokeWidth="1"
                    style={{cursor:"pointer"}} onClick={()=>onSwap({round:ri,match:mi},"A")}/>
                  <text x={x+2+bW/2} y={btnY2+11} textAnchor="middle" dominantBaseline="middle"
                    fill={C.purple} fontSize="10" fontWeight="700" fontFamily="DM Sans,sans-serif"
                    style={{pointerEvents:"none"}}>⇄ A</text>

                  {/* Swap B */}
                  <rect x={x+4+bW} y={btnY2} width={bW} height={22} rx="6"
                    fill={C.purple+"18"} stroke={C.purple+"44"} strokeWidth="1"
                    style={{cursor:"pointer"}} onClick={()=>onSwap({round:ri,match:mi},"B")}/>
                  <text x={x+4+bW+bW/2} y={btnY2+11} textAnchor="middle" dominantBaseline="middle"
                    fill={C.purple} fontSize="10" fontWeight="700" fontFamily="DM Sans,sans-serif"
                    style={{pointerEvents:"none"}}>⇄ B</text>

                  {/* Bye */}
                  <rect x={x+6+bW*2} y={btnY2} width={BOX_W-8-bW*2} height={22} rx="6"
                    fill={C.orange+"18"} stroke={C.orange+"44"} strokeWidth="1"
                    style={{cursor:"pointer"}} onClick={()=>onBye({round:ri,match:mi},match)}/>
                  <text x={x+6+bW*2+(BOX_W-8-bW*2)/2} y={btnY2+11} textAnchor="middle" dominantBaseline="middle"
                    fill={C.orange} fontSize="10" fontWeight="700" fontFamily="DM Sans,sans-serif"
                    style={{pointerEvents:"none"}}>BYE</text>
                </g>
              )}
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

// ─── TOURNAMENT VIEW ──────────────────────────────────────────────────────────
export function TournamentView({teams,players,room,isRef,onStartMatch,toast$,onTournSave}){
  const [tourn,setTourn]=useState(null);
  const [tab,setTab]=useState("bracket");
  const [swapModal,setSwapModal]=useState(null);
  const [byeModal,setByeModal]=useState(null);
  const [setsToWin,setSetsToWin]=useState(2);
  const [format,setFormat]=useState("knockout");
  const [topN,setTopN]=useState(4);

  useEffect(()=>{
    if(!room)return;
    return subscribeTournament(room,d=>{if(d&&d.type){setTourn(d);}});
  },[room]);

  // Expose save function to parent for score sync
  const save=useCallback((t)=>{
    setTourn(t);
    if(t)saveTournament(room,t);
    if(onTournSave)onTournSave(t);
  },[room,onTournSave]);

  const startTournament=()=>{
    if(teams.length<2){toast$("Need at least 2 teams");return;}
    const names=teams.map(t=>t.name);
    let built;
    if(format==="round-robin")built=buildRoundRobin(names);
    else if(format==="qualifier")built=buildQualifier(names,Math.min(topN,names.length));
    else built=buildKnockout(names);
    save({...built,started:true,setsToWin,createdAt:Date.now()});
    setTab("bracket");
  };

  // ── KEY FIX: Use ref so writeResult always sees latest tourn ──
  const tournRef=useRef(tourn);
  useEffect(()=>{tournRef.current=tourn;},[tourn]);

  // Resolve a match from tournament data using a path.
  // path.group → group stage; path.ko → knockout phase (qualifier or rr-ko); else → pure KO / RR rounds
  const resolveMatch=(t,path)=>{
    if(path.group!==undefined)return t.groups?.[path.group]?.rounds?.[path.round]?.matches?.[path.match];
    if(path.ko)return t.knockout?.rounds?.[path.round]?.matches?.[path.match];
    return t.rounds?.[path.round]?.matches?.[path.match];
  };
  const propagateAfter=(t,path)=>{
    if(t.type==="knockout")t.rounds=propagateKnockout(t.rounds||[]);
    if(path.ko&&t.knockout)t.knockout.rounds=propagateKnockout(t.knockout.rounds||[]);
  };

  // Write result back from a live match to the fixture
  const writeResult=useCallback((path,sets,winnerSide,tA,tB)=>{
    const currentTourn=tournRef.current; // Always latest, no stale closure
    if(!currentTourn||!path)return;
    const t=JSON.parse(JSON.stringify(currentTourn));
    const match=resolveMatch(t,path);
    if(!match){console.warn("writeResult: match not found at path",path);return;}
    match.scoreA=sets.filter(s=>s.winner==="A").length;
    match.scoreB=sets.filter(s=>s.winner==="B").length;
    match.setsDetail=sets.map(s=>s.scoreA+"-"+s.scoreB).join(", ");
    match.winner=winnerSide==="A"?tA.name:tB.name;
    match.status="done";
    propagateAfter(t,path);
    save(t);
    toast$("✅ Result saved to bracket!");
  },[save,toast$]); // No tourn dependency — uses ref instead

  // Expose writeResult via ref so parent can call it
  const writeResultRef=useRef(writeResult);
  useEffect(()=>{writeResultRef.current=writeResult;},[writeResult]);
  useEffect(()=>{
    window.__writeTourn=(...args)=>{
      console.log("🎯 __writeTourn bridge fired!", args[0]);
      writeResultRef.current(...args);
    };
    console.log("✅ __writeTourn registered on window");
    return()=>{delete window.__writeTourn;};
  },[]);

  const setMatchScore=(path,sA,sB)=>{
    if(!tourn||!isRef)return;
    const t=JSON.parse(JSON.stringify(tourn));
    const match=resolveMatch(t,path);
    if(!match)return;
    match.scoreA=sA;match.scoreB=sB;
    const wa=parseInt(sA),wb=parseInt(sB);
    if(!isNaN(wa)&&!isNaN(wb)&&(wa>=21||wb>=21)&&Math.abs(wa-wb)>=2){
      match.winner=wa>wb?match.teamA:match.teamB;match.status="done";
    }else{match.winner=null;match.status="pending";}
    propagateAfter(t,path);
    save(t);
  };

  const launchMatch=(match,path)=>{
    const tA=teams.find(t=>t.name===match.teamA)||{name:match.teamA,members:[match.teamA]};
    const tB=teams.find(t=>t.name===match.teamB)||{name:match.teamB,members:[match.teamB]};
    onStartMatch({
      teamA:{name:tA.name,players:tA.members,type:tA.members.length>1?"doubles":"singles"},
      teamB:{name:tB.name,players:tB.members,type:tB.members.length>1?"doubles":"singles"},
      setsToWin:tourn?.setsToWin||2,
      path
    });
  };

  const swapTeam=(path,slot)=>setSwapModal({path,slot});
  const doSwapTeam=(newTeam)=>{
    if(!swapModal||!tourn)return;
    const{path,slot}=swapModal;
    const t=JSON.parse(JSON.stringify(tourn));
    const match=resolveMatch(t,path);
    if(!match){setSwapModal(null);return;}
    if(slot==="A")match.teamA=newTeam;else match.teamB=newTeam;
    match.winner=null;match.status="pending";match.scoreA=null;match.scoreB=null;match.setsDetail="";
    propagateAfter(t,path);
    save(t);setSwapModal(null);
  };

  const assignBye=(path,matchRef,advSlot)=>{
    const t=JSON.parse(JSON.stringify(tourn));
    const m=resolveMatch(t,path);
    if(!m){setByeModal(null);return;}
    const adv=advSlot==="A"?m.teamA:m.teamB;
    m.winner=adv;m.status="bye";m.isBye=true;m.scoreA=advSlot==="A"?1:0;m.scoreB=advSlot==="B"?1:0;
    propagateAfter(t,path);
    save(t);setByeModal(null);
  };

  // Advance top-N teams from standings into a knockout bracket.
  // Works for both qualifier (groups) and round-robin (single pool).
  const promoteToKnockout=(n)=>{
    if(!tourn)return;
    const t=JSON.parse(JSON.stringify(tourn));
    const allStandings=[];
    if(t.type==="qualifier"){
      t.groups.forEach(g=>{
        const teamSet=new Set();
        g.rounds.forEach(r=>r.matches.forEach(m=>{if(!m.isBye){if(m.teamA&&m.teamA!=="TBD")teamSet.add(m.teamA);if(m.teamB&&m.teamB!=="TBD")teamSet.add(m.teamB);}}));
        const standings=rrStandingsCalc(g.rounds.flatMap(r=>r.matches),[...teamSet]);
        standings.forEach(([name,s])=>allStandings.push({name,pts:s.pts,pd:s.pd}));
      });
    }else if(t.type==="round-robin"){
      const teamSet=new Set();
      t.rounds.forEach(r=>r.matches.forEach(m=>{if(!m.isBye){if(m.teamA)teamSet.add(m.teamA);if(m.teamB)teamSet.add(m.teamB);}}));
      const standings=rrStandingsCalc(t.rounds.flatMap(r=>r.matches),[...teamSet]);
      standings.forEach(([name,s])=>allStandings.push({name,pts:s.pts,pd:s.pd}));
    }
    allStandings.sort((a,b)=>b.pts-a.pts||b.pd-a.pd);
    const topN=n||tourn.topN||4;
    const qualifiers=allStandings.slice(0,topN).map(x=>x.name);
    t.knockout=buildKnockout(qualifiers);
    t.groupsDone=true;
    save(t);
    setTab(t.type==="qualifier"?"bracket":"knockout");
    toast$(`🏆 Top ${topN} teams advanced to knockout!`);
  };

  // Fixture card for list view (RR / groups)
  const FCard=({match,path})=>{
    if(match.isBye||match.status==="bye")return(
      <div className="bye-card"><div style={{fontSize:18}}>🎟️</div><div><div style={{fontWeight:700,fontSize:12}}>{match.teamA||match.teamB}</div><div style={{fontSize:10,color:C.txtD}}>BYE</div></div></div>
    );
    const isDone=match.status==="done";
    const wA=isDone&&match.winner===match.teamA;
    const wB=isDone&&match.winner===match.teamB;
    return(
      <div className="fcard">
        <div className="fcard-head">
          <div className="ft" style={{color:wA?C.gr:C.txt}}>{wA&&"🏆 "}{match.teamA||"TBD"}</div>
          <div className="f-score">
            {isRef?(
              <>
                <input className="finp" type="number" min="0" value={match.scoreA??""} onChange={e=>setMatchScore(path,e.target.value,match.scoreB??"")} placeholder="0"/>
                <span style={{color:C.txtD,fontWeight:700}}>–</span>
                <input className="finp" type="number" min="0" value={match.scoreB??""} onChange={e=>setMatchScore(path,match.scoreA??"",e.target.value)} placeholder="0"/>
              </>
            ):(
              <div className="f-result" style={{color:isDone?C.acc:C.txtD}}>{isDone?`${match.scoreA}–${match.scoreB}`:"vs"}</div>
            )}
          </div>
          <div className="ft ft-r" style={{color:wB?C.gr:C.txt}}>{match.teamB||"TBD"}{wB&&" 🏆"}</div>
        </div>
        {isDone&&match.setsDetail&&<div className="f-sets-detail">Sets: {match.setsDetail}</div>}
        {isRef&&(
          <div className="fcard-foot">
            <button className="btn bg bxs" onClick={()=>launchMatch(match,path)}>▶ Play</button>
            <button className="btn bpu bxs" onClick={()=>swapTeam(path,"A")}>🔀A</button>
            <button className="btn bpu bxs" onClick={()=>swapTeam(path,"B")}>🔀B</button>
            <button className="btn bor bxs" onClick={()=>setByeModal({path,match})}>BYE</button>
          </div>
        )}
      </div>
    );
  };

  const RRStandings=({rounds,teamNames})=>{
    const std=rrStandingsCalc(rounds.flatMap(r=>r.matches),teamNames);
    return(
      <table className="std">
        <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PD</th><th>Pts</th></tr></thead>
        <tbody>{std.map(([name,s],i)=>(
          <tr key={name}>
            <td style={{color:C.txtD,fontWeight:600}}>{i+1}</td>
            <td style={{fontWeight:700}}>{name}</td>
            <td>{s.w}</td><td>{s.l}</td>
            <td style={{fontFamily:"'JetBrains Mono',monospace",color:s.pd>=0?C.win:C.loss}}>{s.pd>0?"+":""}{s.pd}</td>
            <td className="pts">{s.pts}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  };

  if(!tourn||!tourn.started){
    return(
      <div className="card p14">
        <div className="ey">Tournament Setup</div>
        <div style={{fontSize:12,color:C.txtM,marginBottom:12}}>{teams.length} team{teams.length!==1?"s":""} registered.{teams.length<2&&<span style={{color:C.loss}}> Add at least 2 teams in Registry.</span>}</div>
        {teams.map((t,i)=>(
          <div key={i} className="reg-card" style={{marginBottom:5}}><div className="reg-num">{i+1}</div><div style={{flex:1,minWidth:0}}><div className="reg-name">{t.name}</div><div className="reg-sub">{t.members.join(" & ")}</div></div></div>
        ))}
        {teams.length>=2&&isRef&&(
          <>
            <div className="div"/>
            <div className="ey">Format</div>
            <div className="cfgr">
              <button className={`cfgo ${format==="knockout"?"on":""}`} onClick={()=>setFormat("knockout")}>🏆 Knockout<br/><span style={{fontSize:10,fontWeight:400}}>Elim bracket</span></button>
              <button className={`cfgo ${format==="round-robin"?"on":""}`} onClick={()=>setFormat("round-robin")}>🔄 Round Robin<br/><span style={{fontSize:10,fontWeight:400}}>All vs all</span></button>
              <button className={`cfgo ${format==="qualifier"?"on":""}`} onClick={()=>setFormat("qualifier")}>⭐ Qualifier<br/><span style={{fontSize:10,fontWeight:400}}>Groups→KO</span></button>
            </div>
            {format==="qualifier"&&(
              <>
                <div className="ey" style={{marginTop:8}}>Teams advancing to knockout</div>
                <div className="cfgr">{[2,4,8,16].filter(n=>n<teams.length).map(n=><button key={n} className={`cfgo ${topN===n?"on":""}`} onClick={()=>setTopN(n)}>Top {n}</button>)}</div>
              </>
            )}
            <div className="ey" style={{marginTop:8}}>Match format</div>
            <div className="cfgr">{[1,2,3].map(n=><button key={n} className={`cfgo ${setsToWin===n?"on":""}`} onClick={()=>setSetsToWin(n)}>{n===1?"1 Set":n===2?"Best of 3":"Best of 5"}</button>)}</div>
            <button className="btn bg bfull" style={{marginTop:10}} onClick={startTournament}>🏆 Generate {format==="knockout"?"Bracket":format==="round-robin"?"Fixtures":"Qualifier"}</button>
          </>
        )}
      </div>
    );
  }

  const isKO=tourn.type==="knockout";
  const isRR=tourn.type==="round-robin";
  const isQual=tourn.type==="qualifier";
  const isRRKO=isRR&&!!tourn.knockout; // round-robin that has advanced to knockout phase

  const tabs=[];
  if(isKO)tabs.push({id:"bracket",label:"🏆 Bracket"});
  if(isRR){
    tabs.push({id:"bracket",label:"📋 Fixtures"},{id:"standings",label:"📊 Standings"});
    if(isRRKO)tabs.push({id:"knockout",label:"🏆 Knockout"});
  }
  if(isQual)tabs.push({id:"groups",label:"👥 Groups"},{id:"standings",label:"📊 Standings"},{id:"bracket",label:"🏆 Knockout"});

  return(
    <>
      <div className="tabs">{tabs.map(t=><button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>

      {/* PURE KNOCKOUT BRACKET */}
      {isKO&&(
        <KnockoutBracket
          rounds={tourn.rounds}
          isRef={isRef}
          onLaunch={(match,path)=>launchMatch(match,path)}
          onSwap={(path,slot)=>swapTeam(path,slot)}
          onBye={(path,match)=>setByeModal({path,match})}
        />
      )}

      {/* QUALIFIER KNOCKOUT BRACKET */}
      {isQual&&tab==="bracket"&&(
        !tourn.groupsDone||!tourn.knockout?(
          <div className="card p14" style={{textAlign:"center",padding:"28px 16px"}}>
            <div style={{fontSize:28,marginBottom:8}}>⏳</div>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Group Stage Incomplete</div>
            <div style={{fontSize:12,color:C.txtM}}>Complete group matches, then use <strong>Advance → Knockout</strong> in the Standings tab.</div>
          </div>
        ):(
          <KnockoutBracket
            rounds={tourn.knockout.rounds}
            isRef={isRef}
            onLaunch={(match,path)=>launchMatch(match,{...path,ko:true})}
            onSwap={(path,slot)=>swapTeam({...path,ko:true},slot)}
            onBye={(path,match)=>setByeModal({path:{...path,ko:true},match})}
          />
        )
      )}

      {/* ROUND-ROBIN + KNOCKOUT BRACKET */}
      {isRRKO&&tab==="knockout"&&(
        <KnockoutBracket
          rounds={tourn.knockout.rounds}
          isRef={isRef}
          onLaunch={(match,path)=>launchMatch(match,{...path,ko:true})}
          onSwap={(path,slot)=>swapTeam({...path,ko:true},slot)}
          onBye={(path,match)=>setByeModal({path:{...path,ko:true},match})}
        />
      )}

      {/* RR FIXTURES LIST */}
      {isRR&&tab==="bracket"&&tourn.rounds.map((rnd,ri)=>(
        <div key={ri} style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.txtD,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>{rnd.name}</div>
          {rnd.matches.map((match,mi)=><FCard key={match.id} match={match} path={{round:ri,match:mi}}/>)}
        </div>
      ))}

      {/* RR STANDINGS + ADVANCE BUTTON */}
      {isRR&&tab==="standings"&&(
        <>
          <div className="card p14">
            <div className="ey">Standings</div>
            <RRStandings rounds={tourn.rounds} teamNames={teams.map(t=>t.name)}/>
          </div>
          {isRef&&!tourn.groupsDone&&(
            <div className="card p14" style={{marginTop:8}}>
              <div className="ey">Advance to Knockout</div>
              <div style={{fontSize:12,color:C.txtM,marginBottom:10}}>Top teams by points (then point difference) advance:</div>
              <div className="cfgr">
                {[2,4,8,16].filter(n=>n<teams.length).map(n=>(
                  <button key={n} className="cfgo" onClick={()=>promoteToKnockout(n)}>Top {n}</button>
                ))}
              </div>
            </div>
          )}
          {isRRKO&&<div style={{color:C.gr,fontWeight:700,fontSize:13,textAlign:"center",padding:"8px 0"}}>✅ Teams advanced — see Knockout tab</div>}
        </>
      )}

      {/* QUALIFIER GROUPS */}
      {isQual&&tab==="groups"&&tourn.groups.map((g,gi)=>(
        <div key={gi}>
          <div className="group-hdr">{g.groupName}</div>
          {g.rounds.map((rnd,ri)=>(
            <div key={ri} style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:C.txtD,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>{rnd.name}</div>
              {rnd.matches.map((match,mi)=><FCard key={match.id} match={match} path={{group:gi,round:ri,match:mi}}/>)}
            </div>
          ))}
        </div>
      ))}

      {/* QUALIFIER STANDINGS + ADVANCE BUTTON */}
      {isQual&&tab==="standings"&&(
        <>
          {tourn.groups.map((g,gi)=>{
            const teamSet=new Set();
            g.rounds.forEach(r=>r.matches.forEach(m=>{if(!m.isBye){if(m.teamA&&m.teamA!=="TBD")teamSet.add(m.teamA);if(m.teamB&&m.teamB!=="TBD")teamSet.add(m.teamB);}}));
            return(
              <div key={gi} className="card p14" style={{marginBottom:9}}>
                <div className="ey">{g.groupName}</div>
                <RRStandings rounds={g.rounds} teamNames={[...teamSet]}/>
              </div>
            );
          })}
          {isRef&&!tourn.groupsDone&&(
            <button className="btn by bfull" style={{marginTop:8}} onClick={()=>promoteToKnockout(tourn.topN)}>
              ⭐ Advance Top {tourn.topN} → Knockout
            </button>
          )}
          {tourn.groupsDone&&<div style={{color:C.gr,fontWeight:700,fontSize:13,textAlign:"center",padding:"8px 0"}}>✅ Teams advanced — see Knockout tab</div>}
        </>
      )}

      {isRef&&<button className="btn br bsm" style={{marginTop:8}} onClick={()=>save(null)}>Reset Tournament</button>}

      {/* SWAP MODAL */}
      {swapModal&&(
        <div className="modal" onClick={()=>setSwapModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Replace Team</div>
            {teams.map(t=>(
              <div key={t.name} className="sel-item" onClick={()=>doSwapTeam(t.name)}>
                <div><div style={{fontWeight:700}}>{t.name}</div><div style={{fontSize:11,color:C.txtM}}>{t.members.join(" & ")}</div></div>
              </div>
            ))}
            <button className="btn bo bfull" style={{marginTop:8}} onClick={()=>setSwapModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* BYE MODAL */}
      {byeModal&&(
        <div className="modal" onClick={()=>setByeModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Who advances with BYE?</div>
            {["A","B"].map(slot=>{
              const name=slot==="A"?byeModal.match.teamA:byeModal.match.teamB;
              return<div key={slot} className="sel-item" onClick={()=>assignBye(byeModal.path,byeModal.match,slot)}>🎟️ {name} advances</div>;
            })}
            <button className="btn bo bfull" style={{marginTop:8}} onClick={()=>setByeModal(null)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────
function Registry({players,teams,onSavePlayers,onSaveTeams,isRef}){
  const [tab,setTab]=useState("players");
  const [pInput,setPInput]=useState("");
  const [tName,setTName]=useState("");
  const [tP1,setTP1]=useState("");
  const [tP2,setTP2]=useState("");
  const [editIdx,setEditIdx]=useState(null);
  const [swapModal,setSwapModal]=useState(null);

  const addPlayer=()=>{const n=pInput.trim();if(!n||players.includes(n))return;onSavePlayers([...players,n]);setPInput("");};
  const playerUsedInTeam=(p,exIdx=null)=>teams.some((t,i)=>i!==exIdx&&t.members.includes(p));

  const addTeam=()=>{
    const n=tName.trim(),p1=tP1.trim(),p2=tP2.trim();
    if(!n||!p1)return;
    const members=[p1,p2].filter(Boolean);
    if(playerUsedInTeam(p1,editIdx)){alert(`${p1} is already in another team!`);return;}
    if(p2&&playerUsedInTeam(p2,editIdx)){alert(`${p2} is already in another team!`);return;}
    if(p1===p2){alert("Both players cannot be the same!");return;}
    if(editIdx!==null){const u=[...teams];u[editIdx]={name:n,members};onSaveTeams(u);setEditIdx(null);}
    else onSaveTeams([...teams,{name:n,members}]);
    setTName("");setTP1("");setTP2("");
  };

  const doSwap=(newP)=>{
    if(!swapModal)return;
    const{teamIdx,memberIdx}=swapModal;
    if(playerUsedInTeam(newP,teamIdx)){alert(`${newP} already in another team!`);return;}
    const u=teams.map((t,i)=>{if(i!==teamIdx)return t;const m=[...t.members];m[memberIdx]=newP;return{...t,members:m};});
    onSaveTeams(u);setSwapModal(null);
  };

  const avail=(exIdx)=>players.filter(p=>!playerUsedInTeam(p,exIdx));

  return(
    <>
      <div className="tabs">
        <button className={`tab ${tab==="players"?"on":""}`} onClick={()=>setTab("players")}>Players ({players.length})</button>
        <button className={`tab ${tab==="teams"?"on":""}`} onClick={()=>setTab("teams")}>Teams ({teams.length})</button>
      </div>
      {tab==="players"&&(
        <div className="card p14">
          <div className="ey">Player Registry</div>
          {isRef&&<div className="ir"><input className="inp" value={pInput} onChange={e=>setPInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} placeholder="Player name…"/><button className="btn bg" style={{whiteSpace:"nowrap"}} onClick={addPlayer}>Add</button></div>}
          {players.length===0&&<div className="empty" style={{padding:"16px 0"}}><div className="ei">👤</div><div className="et">No players yet</div></div>}
          {players.map((p,i)=>(
            <div key={p} className="reg-card">
              <div className="reg-num">{i+1}</div>
              <div style={{flex:1,minWidth:0}}><div className="reg-name">{p}</div><div className="reg-sub">{playerUsedInTeam(p)?"In a team":"Available"}</div></div>
              {isRef&&<button className="btn br bxs" onClick={()=>{onSavePlayers(players.filter(x=>x!==p));onSaveTeams(teams.filter(t=>!t.members.includes(p)));}}>✕</button>}
            </div>
          ))}
        </div>
      )}
      {tab==="teams"&&(
        <div className="card p14">
          <div className="ey">Team Registry</div>
          {isRef&&(
            <>
              <div className="lbl">Team name</div>
              <input className="inp" value={tName} onChange={e=>setTName(e.target.value)} placeholder="e.g. Smashers" style={{marginBottom:8}}/>
              <div className="lbl">Player 1 *</div>
              <select className="sel" value={tP1} onChange={e=>setTP1(e.target.value)} style={{marginBottom:8}}>
                <option value="">— select —</option>
                {avail(editIdx).filter(p=>p!==tP2).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <div className="lbl">Player 2 <span style={{color:C.txtD}}>(optional)</span></div>
              <select className="sel" value={tP2} onChange={e=>setTP2(e.target.value)} style={{marginBottom:10}}>
                <option value="">— none (singles) —</option>
                {avail(editIdx).filter(p=>p!==tP1).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <button className="btn bg bfull" onClick={addTeam} style={{marginBottom:8}}>{editIdx!==null?"Update Team":"Add Team"}</button>
              {editIdx!==null&&<button className="btn bo bfull" style={{marginBottom:8}} onClick={()=>{setEditIdx(null);setTName("");setTP1("");setTP2("");}}>Cancel</button>}
            </>
          )}
          {teams.length===0&&<div className="empty" style={{padding:"16px 0"}}><div className="ei">👥</div><div className="et">No teams yet</div></div>}
          {teams.map((t,i)=>(
            <div key={i} className="reg-card" style={{flexWrap:"wrap",alignItems:"flex-start"}}>
              <div className="reg-num" style={{paddingTop:2}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}><div className="reg-name">{t.name}</div><div className="reg-sub">{t.members.join(" & ")}</div></div>
              {isRef&&<div className="reg-acts">
                <button className="btn bpu bxs" onClick={()=>setSwapModal({teamIdx:i,memberIdx:0})}>🔀</button>
                {t.members.length>1&&<button className="btn bpu bxs" onClick={()=>setSwapModal({teamIdx:i,memberIdx:1})}>🔀2</button>}
                <button className="btn bo bxs" onClick={()=>{setEditIdx(i);setTName(t.name);setTP1(t.members[0]||"");setTP2(t.members[1]||"");}}>✏️</button>
                <button className="btn br bxs" onClick={()=>onSaveTeams(teams.filter((_,x)=>x!==i))}>✕</button>
              </div>}
            </div>
          ))}
        </div>
      )}
      {swapModal&&(
        <div className="modal" onClick={()=>setSwapModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Swap player in {teams[swapModal.teamIdx]?.name}</div>
            {avail(swapModal.teamIdx).map(p=><div key={p} className="sel-item" onClick={()=>doSwap(p)}>{p}</div>)}
            <button className="btn bo bfull" style={{marginTop:8}} onClick={()=>setSwapModal(null)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function StatsView({history,players}){
  const [tab,setTab]=useState("players");
  const {pS,tS}=computeStats(history,players);
  const acs=[C.sA,C.sB,C.gr,C.acc,C.purple,C.orange,"#00d4aa"];
  if(!history.length)return<div className="empty"><div className="ei">📊</div><div className="et">No data yet</div><div className="es">Play matches to see stats</div></div>;
  return(
    <>
      <div className="tabs">
        <button className={`tab ${tab==="players"?"on":""}`} onClick={()=>setTab("players")}>Players</button>
        <button className={`tab ${tab==="teams"?"on":""}`} onClick={()=>setTab("teams")}>Teams</button>
      </div>
      {tab==="players"&&Object.entries(pS).filter(([,s])=>s.matches>0).sort((a,b)=>b[1].wins-a[1].wins).map(([name,s],i)=>{
        const wr=s.matches?Math.round(s.wins/s.matches*100):0,c=acs[i%acs.length];
        return(
          <div key={name} className="psc">
            <div className="psc-top">
              <div className="ava" style={{background:c+"28",color:c,border:`2px solid ${c}40`}}>{name[0].toUpperCase()}</div>
              <div className="psc-info"><div className="psc-name">{name}</div><div className="psc-rec">{s.wins}W – {s.losses}L · {s.matches}M</div></div>
              <div className="psc-wr"><div className="psc-pct" style={{color:c}}>{wr}%</div><div className="psc-lbl">WIN RATE</div></div>
            </div>
            <div className="wrb"><div className="wrf" style={{width:`${wr}%`}}/></div>
            <div className="sg" style={{marginTop:8}}>
              <div className="sb2"><div className="sv" style={{color:C.win}}>{s.wins}</div><div className="sl">Wins</div></div>
              <div className="sb2"><div className="sv">{s.setsWon}</div><div className="sl">Sets</div></div>
              <div className="sb2"><div className="sv" style={{color:C.gr}}>{s.pointsWon}</div><div className="sl">Pts</div></div>
            </div>
          </div>
        );
      })}
      {tab==="teams"&&Object.entries(tS).sort((a,b)=>b[1].wins-a[1].wins).map(([name,s])=>{
        const tot=s.wins+s.losses,wr=tot?Math.round(s.wins/tot*100):0;
        return(
          <div key={name} className="psc">
            <div className="psc-top">
              <div className="ava" style={{background:C.accd,color:C.acc,border:`2px solid ${C.acc}40`}}>🏸</div>
              <div className="psc-info"><div className="psc-name">{name}</div><div className="psc-rec">{s.players?.join(" & ")} · {tot}M</div></div>
              <div className="psc-wr"><div className="psc-pct" style={{color:C.acc}}>{wr}%</div><div className="psc-lbl">WIN RATE</div></div>
            </div>
            <div className="wrb"><div className="wrf" style={{width:`${wr}%`}}/></div>
            <div className="sg" style={{marginTop:8}}>
              <div className="sb2"><div className="sv" style={{color:C.win}}>{s.wins}</div><div className="sl">Wins</div></div>
              <div className="sb2"><div className="sv">{s.setsWon}</div><div className="sl">Sets</div></div>
              <div className="sb2"><div className="sv" style={{color:C.gr}}>{s.pointsWon}</div><div className="sl">Pts</div></div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── LOBBY ───────────────────────────────────────────────────────────────────
function Lobby({onJoin}){
  const [mode,setMode]=useState("home");
  const [rName,setRName]=useState("");
  const [refC,setRefC]=useState("");
  const [viewC,setViewC]=useState("");
  const [joinC,setJoinC]=useState("");
  const [passC,setPassC]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const w=(p,ms=10000)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Timeout — check connection")),ms))]);

  const create=async()=>{
    const r=rName.trim().toLowerCase().replace(/\s+/g,"-");
    if(!r){setErr("Enter a room name");return;}
    if(!refC.trim()){setErr("Set a referee password");return;}
    setLoading(true);setErr("");
    try{
      const ex=await w(getRoomMeta(r));
      if(ex){setErr("Room name taken");setLoading(false);return;}
      await w(saveRoomMeta(r,{name:rName.trim(),refCode:refC.trim(),viewCode:viewC.trim()||"",createdAt:Date.now()}));
      onJoin({room:r,role:"referee",roomDisplayName:rName.trim()});
    }catch(e){setErr(e.message);}
    setLoading(false);
  };

  const join=async()=>{
    const r=joinC.trim().toLowerCase().replace(/\s+/g,"-");
    if(!r){setErr("Enter a room code");return;}
    setLoading(true);setErr("");
    try{
      const meta=await w(getRoomMeta(r));
      if(!meta){setErr("Room not found");setLoading(false);return;}
      const isRef=passC.trim()===meta.refCode;
      const isView=!meta.viewCode||passC.trim()===meta.viewCode||isRef;
      if(!isView){setErr("Wrong access code");setLoading(false);return;}
      onJoin({room:r,role:isRef?"referee":"spectator",roomDisplayName:meta.name||r});
    }catch(e){setErr(e.message);}
    setLoading(false);
  };

  return(
    <div className="lobby">
      <div className="llogo">🏸</div>
      <div className="ltitle">SHUTTLE<span style={{color:C.gr}}>SCORE</span></div>
      <div className="lsub">Live badminton tracker</div>
      {mode==="home"&&(
        <div style={{width:"100%",maxWidth:300,display:"flex",flexDirection:"column",gap:9}}>
          <button className="btn bg bfull" style={{padding:14}} onClick={()=>setMode("create")}>＋ Create room</button>
          <button className="btn bo bfull" style={{padding:14}} onClick={()=>setMode("join")}>→ Join room</button>
          <div style={{fontSize:11,color:C.txtD,textAlign:"center",marginTop:4}}>Each group gets their own private room.</div>
        </div>
      )}
      {mode==="create"&&(
        <div className="rcard">
          <div className="rcardT">Create Room</div>
          <div className="lbl">Room name</div><input className="inp" value={rName} onChange={e=>setRName(e.target.value)} placeholder="e.g. Sunday Gang" style={{marginBottom:9}}/>
          <div className="lbl">Referee password *</div><input className="inp" type="password" value={refC} onChange={e=>setRefC(e.target.value)} placeholder="Only you know this" style={{marginBottom:9}}/>
          <div className="lbl">Spectator code <span style={{color:C.txtD}}>(optional)</span></div><input className="inp" value={viewC} onChange={e=>setViewC(e.target.value)} placeholder="Leave blank = open to all" style={{marginBottom:13}}/>
          {err&&<div style={{color:C.loss,fontSize:12,marginBottom:8}}>⚠ {err}</div>}
          <button className="btn bg bfull" onClick={create} disabled={loading}>{loading?"Creating…":"Create →"}</button>
          <button className="btn bo bfull" style={{marginTop:7}} onClick={()=>{setMode("home");setErr("");}}>← Back</button>
        </div>
      )}
      {mode==="join"&&(
        <div className="rcard">
          <div className="rcardT">Join Room</div>
          <div className="lbl">Room code</div><input className="inp" value={joinC} onChange={e=>setJoinC(e.target.value)} placeholder="e.g. sunday-gang" style={{marginBottom:9}}/>
          <div className="lbl">Access code</div><input className="inp" type="password" value={passC} onChange={e=>setPassC(e.target.value)} placeholder="Referee or spectator code" style={{marginBottom:13}}/>
          {err&&<div style={{color:C.loss,fontSize:12,marginBottom:8}}>⚠ {err}</div>}
          <button className="btn bg bfull" onClick={join} disabled={loading}>{loading?"Checking…":"Join →"}</button>
          <button className="btn bo bfull" style={{marginTop:7}} onClick={()=>{setMode("home");setErr("");}}>← Back</button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App(){
  const [session,setSession]=useState(null);
  const [view,setView]=useState("match");
  const [setupStep,setSetupStep]=useState(0);
  const [toastMsg,setToastMsg]=useState(null);
  const [syncSt,setSyncSt]=useState("spin");

  const [players,setPlayers]=useState([]);
  const [teams,setTeams]=useState([]);
  const [history,setHistory]=useState([]);

  const [teamA,setTeamA]=useState({name:"Red",players:[],type:"singles"});
  const [teamB,setTeamB]=useState({name:"Blue",players:[],type:"singles"});
  const [scoreA,setScoreA]=useState(0);
  const [scoreB,setScoreB]=useState(0);
  const [serving,setServing]=useState("A");
  const [sets,setSets]=useState([]);
  const [winner,setWinner]=useState(null);
  const [lastPt,setLastPt]=useState(null);
  const [matchSTW,setMatchSTW]=useState(2);
  const [matchStatus,setMatchStatus]=useState("idle");
  const [activeTournPath,setActiveTournPath]=useState(null);
  const activeTournPathRef=useRef(null);
  const teamARef=useRef(teamA);const teamBRef=useRef(teamB);const setsRef=useRef(sets);
  useEffect(()=>{activeTournPathRef.current=activeTournPath;},[activeTournPath]);
  useEffect(()=>{teamARef.current=teamA;},[teamA]);
  useEffect(()=>{teamBRef.current=teamB;},[teamB]);
  useEffect(()=>{setsRef.current=sets;},[sets]);

  const [matchType,setMatchType]=useState("singles");
  const [setsToWin,setSetsToWin]=useState(2);
  const [tAName,setTAName]=useState("Red");
  const [tBName,setTBName]=useState("Blue");
  const [selA,setSelA]=useState([]);
  const [selB,setSelB]=useState([]);
  const maxS=matchType==="doubles"?2:1;

  const toast$=msg=>{setToastMsg(msg);setTimeout(()=>setToastMsg(null),2500);};
  const isRef=session?.role==="referee";
  const room=session?.room;

  useEffect(()=>{
    if(!room)return;
    const u=[];
    u.push(subscribePlayers(room,p=>{setPlayers(p);setSyncSt("ok");}));
    u.push(subscribeTeams(room,t=>{setTeams(t);setSyncSt("ok");}));
    u.push(subscribeHistory(room,h=>{setHistory(h);setSyncSt("ok");}));
    u.push(subscribeLiveMatch(room,d=>{
      setSyncSt("ok");
      if(!isRef){
        setTeamA(d.teamA||teamA);setTeamB(d.teamB||teamB);
        setScoreA(d.scoreA??0);setScoreB(d.scoreB??0);
        setServing(d.serving||"A");setSets(d.sets||[]);
        setWinner(d.winner||null);setMatchSTW(d.setsToWin||2);
        setMatchStatus(d.status||"idle");
      }
    }));
    return()=>u.forEach(f=>f());
  },[room,isRef]);// eslint-disable-line

  const push=useCallback((state)=>{
    if(!room)return;
    setSyncSt("spin");
    saveLiveMatch(room,state).then(()=>setSyncSt("ok")).catch(()=>setSyncSt("err"));
  },[room]);

  const handleScore=useCallback((side)=>{
    if(winner||!isRef)return;
    setLastPt(side);
    const nA=scoreA+(side==="A"?1:0),nB=scoreB+(side==="B"?1:0);
    const g=gw(nA,nB);
    if(g){
      const ns=[...sets,{scoreA:nA,scoreB:nB,winner:g}];setSets(ns);
      const m=mw(ns,matchSTW);
      if(m){
        setWinner(m);
        const nh=[{teamA,teamB,sets:ns,winner:m,type:teamA.type,date:Date.now()},...history];
        setHistory(nh);saveHistory(room,nh);setMatchStatus("finished");
        push({teamA,teamB,scoreA:nA,scoreB:nB,sets:ns,serving,winner:m,setsToWin:matchSTW,status:"finished"});
        // ── Write result back to tournament fixture ──
        const path=activeTournPathRef.current;
        console.log("🏆 MATCH DONE. activeTournPath:", JSON.stringify(activeTournPathRef.current));
        console.log("🏆 window.__writeTourn exists:", !!window.__writeTourn);
        if(path&&window.__writeTourn){
          console.log("🏆 Calling writeTourn:", JSON.stringify(path));
          window.__writeTourn(path,ns,m,teamA,teamB);
        } else {
          console.log("❌ NOT calling writeTourn. path:", path, "__writeTourn:", !!window.__writeTourn);
        }
      }else{
        setScoreA(0);setScoreB(0);setServing(g);
        push({teamA,teamB,scoreA:0,scoreB:0,sets:ns,serving:g,winner:null,setsToWin:matchSTW,status:"live"});
      }
    }else{
      setScoreA(nA);setScoreB(nB);setServing(side);
      push({teamA,teamB,scoreA:nA,scoreB:nB,sets,serving:side,winner:null,setsToWin:matchSTW,status:"live"});
    }
  },[scoreA,scoreB,sets,winner,teamA,teamB,matchSTW,serving,history,isRef,push,room]);

  const undoPoint=()=>{
    if(!isRef||winner)return;
    let nA=scoreA,nB=scoreB,ns=sets;
    if(scoreA===0&&scoreB===0&&sets.length>0){
      const prev=sets[sets.length-1];ns=sets.slice(0,-1);
      nA=prev.scoreA-(lastPt==="A"?1:0);nB=prev.scoreB-(lastPt==="B"?1:0);
      setSets(ns);setScoreA(nA);setScoreB(nB);
    }else{
      if(lastPt==="A"){nA=Math.max(0,scoreA-1);setScoreA(nA);}
      else if(lastPt==="B"){nB=Math.max(0,scoreB-1);setScoreB(nB);}
    }
    push({teamA,teamB,scoreA:nA,scoreB:nB,sets:ns,serving,winner:null,setsToWin:matchSTW,status:"live"});
  };

  const resetMatch=()=>{
    setScoreA(0);setScoreB(0);setSets([]);setWinner(null);setServing("A");setLastPt(null);setMatchStatus("idle");setActiveTournPath(null);
    if(isRef)push({teamA,teamB,scoreA:0,scoreB:0,sets:[],serving:"A",winner:null,setsToWin:matchSTW,status:"idle"});
  };

  const onStartMatchFromTourn=(config)=>{
    setTeamA(config.teamA);setTeamB(config.teamB);setMatchSTW(config.setsToWin||2);
    setScoreA(0);setScoreB(0);setSets([]);setWinner(null);setServing("A");setLastPt(null);setMatchStatus("live");
    setActiveTournPath(config.path||null);
    push({teamA:config.teamA,teamB:config.teamB,scoreA:0,scoreB:0,sets:[],serving:"A",winner:null,setsToWin:config.setsToWin||2,status:"live"});
    setView("match");toast$("🏸 Match started! Tap the court to score.");
  };

  const startMatch=()=>{
    if(!selA.length||!selB.length){toast$("Select players for both sides");return;}
    const tA={name:tAName||selA.join(" & "),players:selA,type:matchType};
    const tB={name:tBName||selB.join(" & "),players:selB,type:matchType};
    setTeamA(tA);setTeamB(tB);setMatchSTW(setsToWin);
    setScoreA(0);setScoreB(0);setSets([]);setWinner(null);setServing("A");setLastPt(null);setMatchStatus("live");setActiveTournPath(null);
    push({teamA:tA,teamB:tB,scoreA:0,scoreB:0,sets:[],serving:"A",winner:null,setsToWin,status:"live"});
    setView("match");setSetupStep(0);
  };

  const toggleSel=(side,name)=>{
    if(side==="A")setSelA(a=>a.includes(name)?a.filter(x=>x!==name):[...a,name]);
    else setSelB(b=>b.includes(name)?b.filter(x=>x!==name):[...b,name]);
  };

  if(!session)return<><style>{css}</style><Lobby onJoin={s=>{setSession(s);setSyncSt("spin");}}/></>;

  const navItems=[
    {id:"match",icon:"🏸",label:"Match"},
    {id:"setup",icon:"⚙️",label:"Setup"},
    {id:"registry",icon:"👥",label:"Registry"},
    {id:"tournament",icon:"🏆",label:"Tourn."},
    {id:"stats",icon:"📊",label:"Stats"},
    {id:"history",icon:"📋",label:"History"},
  ];

  return(
    <>
      <style>{css}</style>
      <div className="app">
        <div className="hdr">
          <div className="lbox">🏸</div>
          <div className="linfo"><div className="ltxt">SHUTTLE<span style={{color:C.gr}}>SCORE</span></div><div className="lsub">Live Tracker</div></div>
          <div className="hr">
            <div className="sync-pill"><div className={`sdot ${syncSt}`}/></div>
            <div className="room-chip"><span>#{session.roomDisplayName}</span></div>
            {isRef&&<div style={{background:C.grd,border:`1px solid ${C.gr}44`,padding:"3px 7px",borderRadius:20,fontSize:9,fontWeight:700,color:C.gr}}>✏️ Ref</div>}
            <button className="btn bxs bo" onClick={()=>{setSession(null);setSyncSt("spin");delete window.__writeTourn;}}>⏏</button>
          </div>
        </div>

        {view==="match"&&(
          <>
            {!isRef&&matchStatus==="live"&&<div className="live-bar"><div className="ldot"/><span>LIVE — updates automatically</span></div>}
            <Scoreboard tA={teamA} tB={teamB} sA={scoreA} sB={scoreB} sets={sets} serving={serving} setsToWin={matchSTW}/>
            <div style={{position:"relative"}}>
              <Court onScore={handleScore} serving={serving} disabled={!!winner||!isRef}/>
              {!isRef&&<div className="locked">👀</div>}
            </div>
            {isRef?(
              <div className="ctrl">
                <button className="btn br bsm" onClick={undoPoint} disabled={scoreA===0&&scoreB===0&&!sets.length}>↩ Undo</button>
                <button className="btn bo bsm" onClick={()=>setServing(s=>s==="A"?"B":"A")}>🔄 Serve</button>
                <div style={{flex:1}}/>
                <button className="btn bo bsm" onClick={resetMatch}>↺ Reset</button>
                <button className="btn by bsm" onClick={()=>{setView("setup");setSetupStep(0);}}>+ Setup</button>
              </div>
            ):(
              <div style={{textAlign:"center",color:C.txtD,fontSize:12,padding:"8px 0"}}>👀 Spectator mode</div>
            )}
            {isRef&&<div style={{textAlign:"center",color:C.txtD,fontSize:10,marginTop:-2}}>Tap court to score · Gold dot = server</div>}
            {activeTournPath&&isRef&&<div style={{textAlign:"center",background:C.accd,border:`1px solid ${C.acc}44`,borderRadius:8,padding:"6px",marginTop:6,fontSize:11,color:C.acc}}>🏆 Tournament match — result will auto-save to fixture</div>}
          </>
        )}

        {view==="setup"&&!isRef&&<div className="card p16" style={{textAlign:"center",padding:"40px 16px"}}><div style={{fontSize:36,marginBottom:9}}>🔒</div><div style={{fontFamily:"Syne,sans-serif",fontSize:16,fontWeight:800,marginBottom:5}}>Referee Only</div></div>}
        {view==="setup"&&isRef&&(
          <>
            {setupStep===0&&(
              <div className="card p14">
                <div className="ey">Match Format</div>
                <div className="cfgr">
                  <button className={`cfgo ${matchType==="singles"?"on":""}`} onClick={()=>{setMatchType("singles");setSelA([]);setSelB([]);}}>🏃 Singles<br/><span style={{fontSize:11,fontWeight:400}}>1 vs 1</span></button>
                  <button className={`cfgo ${matchType==="doubles"?"on":""}`} onClick={()=>{setMatchType("doubles");setSelA([]);setSelB([]);}}>👥 Doubles<br/><span style={{fontSize:11,fontWeight:400}}>2 vs 2</span></button>
                </div>
                <div className="ey" style={{marginTop:13}}>Best Of</div>
                <div className="cfgr">{[1,2,3].map(n=><button key={n} className={`cfgo ${setsToWin===n?"on":""}`} onClick={()=>setSetsToWin(n)}>{n===1?"1 Set":n===2?"Best of 3":"Best of 5"}<br/><span style={{fontSize:10,fontWeight:400}}>{n} to win</span></button>)}</div>
                <button className="btn bg bfull" style={{marginTop:13}} onClick={()=>setSetupStep(1)}>Next: Pick Players →</button>
              </div>
            )}
            {setupStep===1&&(
              <div className="card p14">
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                  <button className="btn bo bsm" onClick={()=>setSetupStep(0)}>← Back</button>
                  <div className="ey" style={{marginBottom:0}}>Pick Players</div>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:9}}>
                  <div style={{flex:1,background:C.sAd,border:`1px solid ${C.sA}44`,borderRadius:9,padding:"7px 10px",minWidth:0}}>
                    <div className="lbl" style={{color:C.sA}}>Side A · {selA.length}/{maxS}</div>
                    <div style={{fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selA.join(" & ")||"—"}</div>
                  </div>
                  <div style={{flex:1,background:C.sBd,border:`1px solid ${C.sB}44`,borderRadius:9,padding:"7px 10px",minWidth:0}}>
                    <div className="lbl" style={{color:C.sB}}>Side B · {selB.length}/{maxS}</div>
                    <div style={{fontWeight:700,fontSize:12,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selB.join(" & ")||"—"}</div>
                  </div>
                </div>
                {players.length===0?<div className="empty" style={{padding:"16px 0"}}><div className="ei">👤</div><div className="et">No players</div><div className="es">Add in Registry tab</div></div>:(
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:11}}>
                    {players.map(p=>{
                      const iA=selA.includes(p),iB=selB.includes(p);
                      return(
                        <div key={p} style={{display:"flex",alignItems:"center",gap:6,background:C.surf,borderRadius:9,padding:"7px 10px",border:`1px solid ${iA?C.sA+"55":iB?C.sB+"55":C.bdr}`}}>
                          <div style={{flex:1,fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p}</div>
                          <button className="btn bsm" style={iA?{background:C.sA,color:"#fff"}:{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt}} onClick={()=>toggleSel("A",p)} disabled={iB||(!iA&&selA.length>=maxS)}>A</button>
                          <button className="btn bsm" style={iB?{background:C.sB,color:"#fff"}:{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt}} onClick={()=>toggleSel("B",p)} disabled={iA||(!iB&&selB.length>=maxS)}>B</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button className="btn bg bfull" onClick={()=>setSetupStep(2)} disabled={!selA.length||!selB.length}>Next: Team Names →</button>
              </div>
            )}
            {setupStep===2&&(
              <div className="card p14">
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                  <button className="btn bo bsm" onClick={()=>setSetupStep(1)}>← Back</button>
                  <div className="ey" style={{marginBottom:0}}>Team Names</div>
                </div>
                <div style={{marginBottom:9}}><div className="lbl" style={{color:C.sA}}>Side A – {selA.join(" & ")}</div><input className="inp" value={tAName} onChange={e=>setTAName(e.target.value)} placeholder="Team name…"/></div>
                <div style={{marginBottom:13}}><div className="lbl" style={{color:C.sB}}>Side B – {selB.join(" & ")}</div><input className="inp" value={tBName} onChange={e=>setTBName(e.target.value)} placeholder="Team name…"/></div>
                <div style={{background:C.surf,borderRadius:9,padding:"9px 11px",marginBottom:13,fontSize:11,color:C.txtM,display:"flex",justifyContent:"space-between"}}><span>{matchType==="doubles"?"2v2 Doubles":"1v1 Singles"}</span><span style={{color:C.txt,fontWeight:700}}>{setsToWin===1?"1 Set":setsToWin===2?"Best of 3":"Best of 5"}</span></div>
                <button className="btn by bfull" onClick={startMatch}>▶ Go Live</button>
              </div>
            )}
          </>
        )}

        {view==="registry"&&<Registry players={players} teams={teams} isRef={isRef} onSavePlayers={p=>{setPlayers(p);savePlayers(room,p);}} onSaveTeams={t=>{setTeams(t);saveTeams(room,t);}}/>}

        <div style={{display:view==="tournament"?"":"none"}}><TournamentView teams={teams} players={players} room={room} isRef={isRef} onStartMatch={onStartMatchFromTourn} toast$={toast$}/></div>

        {view==="stats"&&<StatsView history={history} players={players}/>}

        {view==="history"&&(
          history.length===0?<div className="empty"><div className="ei">📋</div><div className="et">No matches yet</div></div>
          :history.map((m,i)=>(
            <div key={i} className="mc">
              <div className="mc-top">
                <div className="mcs"><div className="mcn" style={{color:C.sA}}>{m.teamA.name}</div><div className="mcp">{m.teamA.players.join(" · ")}</div><div className="mcpi"><div className={`rpip ${m.winner==="A"?"w":"l"}`}/></div></div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:28,flexShrink:0}}><div style={{fontSize:9,color:C.txtD,fontWeight:700}}>VS</div><div className="mcb t">{m.type==="doubles"?"2v2":"1v1"}</div></div>
                <div className="mcs mcs-r"><div className="mcn" style={{color:C.sB}}>{m.teamB.name}</div><div className="mcp">{m.teamB.players.join(" · ")}</div><div className="mcpi mcpi-r"><div className={`rpip ${m.winner==="B"?"w":"l"}`}/></div></div>
              </div>
              <div className="mc-sets">
                <span style={{fontSize:9,color:C.txtD,fontWeight:700,marginRight:3,textTransform:"uppercase"}}>Sets</span>
                {m.sets.map((s,j)=>(
                  <div key={j} className="spill">
                    <span style={{color:s.winner==="A"?C.sA:C.txtD,fontWeight:s.winner==="A"?700:400}}>{s.scoreA}</span>
                    <span style={{color:C.txtD}}>–</span>
                    <span style={{color:s.winner==="B"?C.sB:C.txtD,fontWeight:s.winner==="B"?700:400}}>{s.scoreB}</span>
                  </div>
                ))}
                <div style={{flex:1}}/><div className="mcb w">🏆 {m.winner==="A"?m.teamA.name:m.teamB.name}</div>
              </div>
              {m.date&&<div style={{fontSize:9,color:C.txtD,marginTop:4}}>{new Date(m.date).toLocaleString()}</div>}
            </div>
          ))
        )}
      </div>

      <div className="bot-nav">
        {navItems.map(n=>(
          <button key={n.id} className={`nbn ${view===n.id?"on":""}`} onClick={()=>setView(n.id)}>
            <span className="ni">{n.icon}</span>{n.label}
          </button>
        ))}
      </div>

      {winner&&(
        <div className="ov">
          <div className="wm">
            <div className="tr">🏆</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:C.txtD,textTransform:"uppercase",marginBottom:3}}>Winner</div>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:28,fontWeight:800,letterSpacing:-1,color:winner==="A"?C.sA:C.sB,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(winner==="A"?teamA:teamB).name}</div>
            <div style={{color:C.txtM,fontSize:12,marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(winner==="A"?teamA:teamB).players.join(" & ")}</div>
            <div className="set-row" style={{marginBottom:16}}>
              {sets.map((s,i)=>(
                <div key={i} className="spill"><span className="sn">S{i+1}</span>
                  <span style={{color:s.winner==="A"?C.sA:C.txtD,fontWeight:s.winner==="A"?700:400}}>{s.scoreA}</span>
                  <span style={{color:C.txtD}}>–</span>
                  <span style={{color:s.winner==="B"?C.sB:C.txtD,fontWeight:s.winner==="B"?700:400}}>{s.scoreB}</span>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:7,justifyContent:"center"}}>
              {isRef&&<><button className="btn bo" onClick={()=>{setWinner(null);resetMatch();}}>Again</button><button className="btn by" onClick={()=>{setWinner(null);resetMatch();setView("setup");setSetupStep(0);}}>New Match</button>{activeTournPath&&<button className="btn bg" onClick={()=>{setWinner(null);resetMatch();setView("tournament");}}>→ Bracket</button>}</>}
              {!isRef&&<button className="btn bo" onClick={()=>setWinner(null)}>Close</button>}
            </div>
          </div>
        </div>
      )}

      {toastMsg&&<div className="toast">{toastMsg}</div>}
    </>
  );
}
