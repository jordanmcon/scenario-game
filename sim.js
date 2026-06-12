/* Host vs Owner — simulation model.
 * Pure logic, no DOM. window.HostOwnerSim in the browser; module.exports in Node
 * (handy for smoke tests / future tuning sweeps).
 *
 * Model summary:
 * - Daily demand: starts at scenario SPD (10–30), grows logistically toward
 *   SAT=120 sessions/day at the assumed annual rate, with seasonality and
 *   lognormal daily noise. Both paths share the same trace.
 * - Site host: zero capex; lease $/stall/yr with 2% escalator + in-store
 *   margin on sessions the CPO actually serves. CPO runs 4×150 kW stalls,
 *   prices high (suppressing demand via elasticity), repairs slowly.
 * - Owner: upfront capex; charging revenue net of processing, energy cost,
 *   monthly demand charges (battery cuts billed peak ~45%), O&M + network
 *   fees, plus the same in-store margin on served sessions.
 * - Happiness blends served ratio, uptime, and charging speed.
 */
var HostOwnerSim = (function () {
  'use strict';

  var YR = 365, MAXD = 3650;
  var KWH_PER_SESSION = 42;
  var ELEC = 0.11;            // $/kWh wholesale
  var DEMAND_CHARGE = 18;     // $/kW-month
  var SAT = 120;              // demand saturation, sessions/day
  var FAIL_P = 1 / 180;       // per-stall daily failure probability (~2/yr)
  var OM_PER_STALL_YR = 2200; // owner O&M
  var NET_PER_STALL_YR = 1200;// owner network/software fees
  var PROC = 0.029;           // payment processing on charging revenue
  var CONCURRENCY = 0.18;     // share of theoretical stall-minutes usable given peaky arrivals

  function gauss() {
    var u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Starting demand 10–30 SPD; higher start => slower growth (15% -> 5%). */
  function rollScenario() {
    var spd = 10 + Math.round(Math.random() * 20);
    var growth = 0.15 - (spd - 10) / 20 * 0.10;
    return { spd: spd, growth: growth };
  }

  function makeDemand(startSPD, growth) {
    var a = [], b = startSPD;
    for (var d = 0; d < MAXD; d++) {
      var season = 1 + 0.12 * Math.sin(2 * Math.PI * (d % 365) / 365);
      var noise = Math.exp(0.22 * gauss());
      a.push(b * season * noise);
      b += b * growth * (1 - b / SAT) / 365;   // logistic taper toward SAT
    }
    return a;
  }

  function elast(price) {
    return Math.min(1.8, Math.max(0.4, Math.pow(0.45 / price, 1.2)));
  }
  function capexOwn(c) {
    return c.stalls * (30000 + 150 * c.kW)
         + Math.ceil(c.stalls / 6) * 100000
         + (c.batt ? 150000 : 0);
  }
  function speedSat(kW) {
    return Math.min(1, Math.pow(kW / 300, 0.35));
  }

  /* o: {type:'host'|'own', stalls, kW, price, repair, batt?} */
  function makePath(o) {
    return {
      o: o,
      down: new Array(o.stalls).fill(0),
      cum: o.type === 'own' ? -capexOwn(o) : 0,
      arr: [],
      hapY: 0, hapYN: 0, lostY: 0, servedY: 0,
      monthPeak: 0, payback: null
    };
  }
  function resetYearStats(P) { P.hapY = 0; P.hapYN = 0; P.lostY = 0; P.servedY = 0; }

  /* A: assumptions {lease, instore} (cpo params live in the path's o). */
  function stepDay(P, d, demand, A) {
    var o = P.o, up = 0, i;
    for (i = 0; i < o.stalls; i++) {
      if (P.down[i] > 0) P.down[i]--;
      else if (Math.random() < FAIL_P) P.down[i] = Math.round(o.repair * (0.7 + 0.6 * Math.random()));
      if (P.down[i] === 0) up++;
    }
    var att = demand[d] * elast(o.price);
    var dur = Math.max(18, Math.min(120, KWH_PER_SESSION / (0.55 * o.kW) * 60));
    var cap = up * (1440 / dur) * CONCURRENCY;
    var served = Math.min(att, cap), lost = att - served;
    var kwh = served * KWH_PER_SESSION;
    var net;
    if (o.type === 'own') {
      var rev = kwh * o.price * (1 - PROC) + served * A.instore;
      var peak = up * o.kW * Math.min(1, cap > 0 ? att / cap : 1) * 0.8 * (o.batt ? 0.55 : 1);
      P.monthPeak = Math.max(P.monthPeak, peak);
      net = rev - kwh * ELEC - (OM_PER_STALL_YR + NET_PER_STALL_YR) * o.stalls / 365;
      if (d % 30 === 29) { net -= P.monthPeak * DEMAND_CHARGE; P.monthPeak = 0; }
    } else {
      net = A.lease * o.stalls * Math.pow(1.02, d / 365) / 365 + served * A.instore;
    }
    P.cum += net;
    P.arr.push(P.cum);
    if (P.payback === null && P.cum >= 0 && o.type === 'own') P.payback = d / 365;
    var hap = att > 0 ? 100 * (served / att) * (0.75 + 0.25 * up / o.stalls) * speedSat(o.kW) : 100;
    P.hapY += hap; P.hapYN++; P.lostY += lost; P.servedY += served;
  }

  return {
    YR: YR, MAXD: MAXD, SAT: SAT,
    rollScenario: rollScenario,
    makeDemand: makeDemand,
    elast: elast,
    capexOwn: capexOwn,
    speedSat: speedSat,
    makePath: makePath,
    resetYearStats: resetYearStats,
    stepDay: stepDay
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HostOwnerSim;
