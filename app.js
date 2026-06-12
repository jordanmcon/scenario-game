/* Host vs Owner — UI layer. Depends on sim.js (HostOwnerSim) and index.html ids. */
(function () {
  'use strict';
  var Sim = HostOwnerSim;
  var $ = function (id) { return document.getElementById(id); };
  var C_OWN = '#3ec54b', C_HOST = '#41a6f6';

  var scen = null, A = null, demand = null;
  var P_host = null, P_own = null, chosen = null;
  var day = 0, target = Sim.YR, timer = null;

  /* ---------- assumptions ---------- */
  function readAssume() {
    return {
      lease: +$('aLease').value,
      cpoPrice: +$('aCPOp').value,
      cpoRepair: +$('aRep').value,
      ownRepair: +$('aORep').value,
      instore: +$('aStore').value,
      growth: +$('aGrow').value / 100
    };
  }
  function syncAssume() {
    A = readAssume();
    $('vLease').textContent = '$' + A.lease.toLocaleString() + '/stall/yr';
    $('vCPOp').textContent = '$' + A.cpoPrice.toFixed(2) + '/kWh';
    $('vRep').textContent = A.cpoRepair + ' days';
    $('vORep').textContent = A.ownRepair + (A.ownRepair === 1 ? ' day' : ' days');
    $('vStore').textContent = '$' + A.instore.toFixed(2) + '/session';
    $('vGrow').textContent = Math.round(A.growth * 1000) / 10 + '%/yr';
    $('bSPD').textContent = scen.spd;
    $('bGrow').textContent = Math.round(A.growth * 1000) / 10 + '%';
    $('bCPOp').textContent = '$' + A.cpoPrice.toFixed(2);
    $('bLease').textContent = '$' + A.lease.toLocaleString();
    $('bRep').textContent = '~' + A.cpoRepair + ' days';
    $('bStore').textContent = '~$' + A.instore.toFixed(2);
    $('bORep').textContent = '~' + A.ownRepair + '-day';
  }
  ['aLease', 'aCPOp', 'aRep', 'aORep', 'aStore', 'aGrow'].forEach(function (id) {
    $(id).addEventListener('input', syncAssume);
  });

  /* ---------- owner config ---------- */
  function syncCfg() {
    var c = { stalls: +$('iS').value, kW: +$('iK').value, price: +$('iC').value, batt: $('iB').checked };
    $('vS').textContent = c.stalls;
    $('vK').textContent = c.kW + ' kW';
    $('vC').textContent = '$' + c.price.toFixed(2) + '/kWh';
    $('vCap').textContent = fmt$(Sim.capexOwn(c));
    return c;
  }
  ['iS', 'iK', 'iC', 'iB'].forEach(function (id) { $(id).addEventListener('input', syncCfg); });

  /* ---------- chart ---------- */
  function fmt$(x) {
    var a = Math.abs(x);
    var s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : Math.round(a);
    return (x < 0 ? '-$' : '$') + s;
  }
  function draw() {
    var cv = $('chart'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var n = day, W = cv.width, H = cv.height, pad = 46;
    if (n < 2) return;
    var lo = 0, hi = 0;
    [P_host.arr, P_own.arr].forEach(function (a) {
      for (var i = 0; i < n; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    });
    if (hi === lo) hi = lo + 1;
    var X = function (i) { return pad + (W - pad - 10) * i / Math.max(n - 1, target - 1); };
    var Y = function (v) { return 10 + (H - 40) * (1 - (v - lo) / (hi - lo)); };
    ctx.strokeStyle = '#8b8bb0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - 10, Y(0)); ctx.stroke();
    ctx.fillStyle = '#8b8bb0'; ctx.font = '15px "VT323",monospace';
    for (var y = 1; y <= Math.ceil(target / 365); y++) {
      var x = X(y * 365);
      if (x < W - 10) {
        ctx.fillText('Y' + y, x - 7, H - 6);
        ctx.strokeStyle = '#26264a';
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, H - 30); ctx.stroke();
      }
    }
    ctx.fillText(fmt$(hi), 2, 14);
    ctx.fillText(fmt$(lo), 2, H - 32);
    ctx.fillText('$0', 2, Y(0) + 3);
    var step = Math.max(1, Math.floor(n / 300));
    [[P_host, C_HOST], [P_own, C_OWN]].forEach(function (pair) {
      var P = pair[0];
      ctx.strokeStyle = pair[1];
      ctx.lineWidth = (chosen === P) ? 4 : 2;
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      ctx.beginPath();
      for (var i = 0; i < n; i += step) {
        var px = Math.round(X(i)), py = Math.round(Y(P.arr[i]));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(Math.round(X(n - 1)), Math.round(Y(P.arr[n - 1])));
      ctx.stroke();
    });
  }
  function paint() {
    $('mYr').textContent = 'Y' + (day / 365).toFixed(1);
    var cash = chosen.arr[day - 1] || chosen.cum;
    $('mCash').textContent = fmt$(cash);
    $('mCash').style.color = cash >= 0 ? C_OWN : '#ff3c50';
    $('mHap').textContent = chosen.hapYN ? Math.round(chosen.hapY / chosen.hapYN) + '%' : '\u2014';
    $('mLost').textContent = Math.round(chosen.lostY).toLocaleString();
    draw();
  }

  /* ---------- run loop ---------- */
  function resetYearStats() { Sim.resetYearStats(P_host); Sim.resetYearStats(P_own); }
  /* ---------- debrief narrative: explains the run without declaring universal truths ---------- */
  /* ---------- counterfactuals: variants of the owner build on the SAME demand trace ---------- */
  function cfgDesc(c) {
    return c.stalls + '\u00d7' + c.kW + ' kW ' + (c.batt ? 'with' : 'without') + ' the battery';
  }
  function cfLabel(c, base) {
    var s = (c.stalls !== base.stalls) ? 'a ' + c.stalls + '-stall version of this station' : 'this same station';
    if (c.batt !== base.batt) s += c.batt ? ' with the battery' : ' without the battery';
    return s;
  }
  function counterfactual() {
    var base = P_own.o, cands = [], seen = {};
    [Math.max(2, base.stalls - 2), base.stalls, Math.min(12, base.stalls + 2), 4].forEach(function (st) {
      [true, false].forEach(function (b) {
        var key = st + ':' + b;
        if (seen[key] || (st === base.stalls && b === base.batt)) return;
        seen[key] = 1;
        cands.push({ stalls: st, kW: base.kW, price: base.price, batt: b });
      });
    });
    var best = null;
    var curHap = P_own.hapYN ? P_own.hapY / P_own.hapYN : 100;
    cands.forEach(function (c) {
      var P = Sim.makePath(Object.assign({ type: 'own', repair: A.ownRepair }, c));
      for (var d = 0; d < day; d++) {
        if (d % 365 === 0 && d > 0) Sim.resetYearStats(P); // mirror the main loop: hap = final-year
        Sim.stepDay(P, d, demand, A);
      }
      var hap = P.hapYN ? P.hapY / P.hapYN : 100;
      // only recommend designs that serve drivers at least as well — winning by
      // turning customers away is not advice this analyst gives
      if (hap >= curHap - 5 && (!best || P.cum > best.cum)) best = { cum: P.cum, cfg: c };
    });
    return best;
  }

  function narrative(yr) {
    var lead = P_own.cum - P_host.cum;
    var scale = Math.max(Math.abs(P_own.cum), Math.abs(P_host.cum), 1);
    var close = Math.abs(lead) < Math.max(50000, 0.08 * scale);
    var ownHap = P_own.hapYN ? Math.round(P_own.hapY / P_own.hapYN) : 0;
    var hostHap = P_host.hapYN ? Math.round(P_host.hapY / P_host.hapYN) : 0;
    var hostLost = (P_host.lostY + P_host.servedY) > 0 ? P_host.lostY / (P_host.lostY + P_host.servedY) : 0;
    var ownLost = (P_own.lostY + P_own.servedY) > 0 ? P_own.lostY / (P_own.lostY + P_own.servedY) : 0;
    var s = [];

    if (yr === 10) {
      var base = P_own.o, cf = counterfactual();
      var margin = Math.max(25000, 0.15 * Math.abs(P_own.cum));
      var knob = cf && (cf.cfg.batt !== base.batt) && (cf.cfg.stalls !== base.stalls) ? 'the battery and sizing'
               : cf && (cf.cfg.batt !== base.batt) ? 'the battery' : 'sizing';
      if (P_own.cum <= P_host.cum && cf && cf.cum > P_host.cum) {
        s.push('<b>MAIN TAKEAWAY:</b> the lease beat this particular station design \u2014 but not ownership itself. On this exact demand trace, ' +
          (chosen === P_own ? cfLabel(cf.cfg, base) : 'an owner build of ' + cfgDesc(cf.cfg)) +
          ' finishes around ' + fmt$(cf.cum) + ', ahead of the lease\u2019s ' + fmt$(P_host.cum) +
          '. The decision that mattered here was ' + knob + ', not lease-versus-own.');
      } else if (P_own.cum > P_host.cum && cf && cf.cum > P_own.cum + margin) {
        s.push('<b>MAIN TAKEAWAY:</b> this design beats the lease \u2014 and ' + cfLabel(cf.cfg, base) +
          ' beats it by more (' + fmt$(cf.cum) + ' vs ' + fmt$(P_own.cum) +
          ' on the same demand). The knob that mattered was ' + knob + '.');
      } else if (P_own.cum > P_host.cum) {
        s.push('<b>MAIN TAKEAWAY:</b> this design holds up \u2014 we re-ran battery and sizing variants of the same station on this exact demand, and none of them does meaningfully better. Ownership wins this brief, and you sized it about right.');
      } else {
        s.push('<b>MAIN TAKEAWAY:</b> we re-ran battery and sizing variants of this station on the same demand, and none finishes ahead of the lease within ten years. On a corridor like this one, under these assumptions, taking the check is a defensible answer \u2014 and that\u2019s worth knowing before the capex, not after.');
      }
    }

    if (close) {
      s.push('In this run the two paths finished within shouting distance of each other (' +
        fmt$(Math.abs(lead)) + ' apart) \u2014 close enough that a different roll of the same demand dice could flip the result.');
    } else if (lead > 0) {
      s.push('In this run, owning finished ahead by ' + fmt$(lead) +
        '. That is one outcome under one demand trace and one set of assumptions \u2014 not a law of EV charging.');
    } else {
      s.push('In this run, the lease finished ahead by ' + fmt$(-lead) +
        '. That is one outcome under one demand trace and one set of assumptions \u2014 not a law of EV charging.');
    }

    if (yr === 5) {
      s.push('Five years is usually mid-J-curve for an owner build: the capex hole is real and the growth that justifies it is still compounding. The more telling read at this checkpoint is the slope of the two lines, not their height \u2014 if the owner line is climbing faster than the lease line, the second five years tends to decide it.');
    }
    if (P_own.payback !== null) {
      s.push('The owner build recovered its capex around year ' + P_own.payback.toFixed(1) +
        '; everything after that point is the corridor\u2019s growth working for whoever owns the asset.');
    } else {
      s.push('The owner build has not recovered its capex in this window \u2014 which can mean the corridor is thinner than the build assumed, the build was sized for a demand curve that hasn\u2019t arrived yet, or simply that this site needed a longer horizon than the simulation shows.');
    }

    if (yr > 1 && hostLost > 0.12) {
      s.push('Worth noticing: the CPO\u2019s four stalls turned away roughly ' + Math.round(hostLost * 100) +
        '% of demand this year, and every one of those is also a lost store visit \u2014 the quiet cost of a lease is rarely written in the lease.');
    }
    if (yr > 1 && ownLost > 0.12) {
      s.push('The owner build also turned away about ' + Math.round(ownLost * 100) +
        '% of demand this year \u2014 under-sizing can squander the very growth that justifies owning in the first place.');
    }
    if (yr > 1 && ownHap - hostHap >= 15) {
      s.push('The happiness gap (' + ownHap + '% vs ' + hostHap +
        '%) compounds in ways this model only gestures at: repeat visits, reviews, and brand association all ride on whether the chargers work when drivers arrive.');
    }

    s.push('Also worth knowing: two real-world factors are deliberately left out of this math \u2014 capex incentives (utility make-ready and state grant programs) and clean-fuel credit revenue (LCFS-style programs in some markets). Where they apply, both can dramatically improve the economics of owning, so the owner line you see here errs on the conservative side.');
    s.push('The durable takeaway isn\u2019t which line finished higher \u2014 re-run the same choices and the gap will move \u2014 but which assumptions the outcome is sensitive to on a site like this one: demand growth, repair speed, and what a charging customer is worth inside the store. Those are answerable questions for a real site, with real traffic counts and a real tariff, and they deserve better data than a simulation\u2019s dice.');
    return s.join(' ');
  }

  function milestone() {
    clearInterval(timer); timer = null;
    var yr = Math.round(day / 365);
    var rows = [[P_own, 'Owner'], [P_host, 'Site host']].map(function (pair) {
      var P = pair[0];
      var hap = P.hapYN ? Math.round(P.hapY / P.hapYN) : 0;
      return '<tr><td>' + pair[1] + (P === chosen ? ' \u25c2 you' : '') + '</td><td>' + fmt$(P.cum) +
        '</td><td>' + hap + '%</td><td>' + Math.round(P.servedY).toLocaleString() +
        '</td><td>' + Math.round(P.lostY).toLocaleString() + '</td></tr>';
    }).join('');
    var lead = P_own.cum > P_host.cum ? 'Owner' : 'Site host';
    var verdict = lead + ' leads by ' + fmt$(Math.abs(P_own.cum - P_host.cum)) + ' at year ' + yr + '.';
    if (P_own.payback !== null) verdict += ' Owner capex paid back at year ' + P_own.payback.toFixed(1) + '.';
    else if (chosen === P_own) verdict += ' Owner capex not yet paid back.';
    $('summary').innerHTML =
      '<h3>Year ' + yr + ' checkpoint</h3>' +
      '<table class="cmp"><tr><th>Path</th><th>Cumulative cash</th><th>Happy (yr ' + yr +
      ')</th><th>Sessions served (yr)</th><th>Lost (yr)</th></tr>' + rows + '</table>' +
      '<div style="font-size:19px">' + verdict + '</div>' +
      '<div class="debrief"><div class="dl">\u2605 Analyst debrief \u2605</div>' + narrative(yr) + '</div>';
    if (day < 3650) $('bSkip10').style.display = 'inline-block';
    $('bRestart').style.display = 'inline-block';
  }
  function run(toDay, perFrame) {
    $('bSkip10').style.display = 'none';
    target = toDay; resetYearStats();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      for (var i = 0; i < perFrame && day < target; i++) {
        if (day % 365 === 0 && day > 0) resetYearStats();
        Sim.stepDay(P_host, day, demand, A);
        Sim.stepDay(P_own, day, demand, A);
        day++;
      }
      paint();
      if (day >= target) milestone();
    }, 50);
  }
  function start(ownCfg) {
    A = readAssume();
    demand = Sim.makeDemand(scen.spd, A.growth);
    day = 0;
    P_host = Sim.makePath({ type: 'host', stalls: 4, kW: 150, price: A.cpoPrice, repair: A.cpoRepair });
    P_own = Sim.makePath(Object.assign({ type: 'own', repair: A.ownRepair }, ownCfg));
    chosen = ownCfg.chosen === 'host' ? P_host : P_own;
    $('lCash').textContent = 'Cumulative cash (' + (chosen === P_own ? 'owner' : 'site host') + ')';
    $('legNote').textContent = chosen === P_own ? '\u00b7 you chose to own' : '\u00b7 you took the lease';
    $('stChoice').style.display = 'none';
    $('stConfig').style.display = 'none';
    $('stAssume').style.display = 'none';
    $('stSim').style.display = 'block';
    $('summary').innerHTML = '';
    $('bRestart').style.display = 'none';
    run(1825, 12);
  }

  /* ---------- stage wiring ---------- */
  $('pickHost').addEventListener('click', function () {
    start({ chosen: 'host', stalls: 6, kW: 250, price: 0.48, batt: true });
  });
  $('pickOwn').addEventListener('click', function () {
    $('stChoice').style.display = 'none';
    $('stConfig').style.display = 'block';
    syncCfg();
  });
  $('bBuild').addEventListener('click', function () {
    start(Object.assign({ chosen: 'own' }, syncCfg()));
  });
  $('bSkip10').addEventListener('click', function () { run(3650, 45); });
  $('bRestart').addEventListener('click', function () {
    if (timer) clearInterval(timer); timer = null;
    scen = Sim.rollScenario();
    $('aGrow').value = scen.growth * 100;
    syncAssume();
    $('stSim').style.display = 'none';
    $('stAssume').style.display = 'block';
    $('stChoice').style.display = 'block';
  });

  /* ---------- init ---------- */
  scen = Sim.rollScenario();
  $('aGrow').value = scen.growth * 100;
  syncAssume();
  syncCfg();
})();
