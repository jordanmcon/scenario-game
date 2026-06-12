# Host vs Owner — the EV charging decision game

A browser game simulating the decision every retailer with a good parcel
eventually faces: take a CPO's site-host lease, or own the charging program.
Both paths run on the identical stochastic demand trace over 10 years, so the
comparison is apples-to-apples and the crossover (or lack of one) is visible.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup, styles, stage containers. Open directly in a browser — no build step, no dependencies (Google Fonts optional). |
| `sim.js` | Pure simulation model, no DOM. Also loads in Node (`require('./sim')`) for tuning sweeps and smoke tests. |
| `app.js` | UI layer: stage state machine, canvas chart, slider wiring. |

Deploy by serving the folder statically (GitHub Pages, Vercel, Netlify).

## The model (day-level, 3,650 days max)

- **Demand**: starts at the brief's sessions/day (rolled 10–30), grows
  logistically at 5–15%/yr (higher start → slower growth) saturating toward
  120 SPD, with seasonality and lognormal daily noise.
- **Site host**: zero capex; lease $/stall/yr with 2% escalator plus in-store
  margin on sessions the CPO serves. The CPO runs 4×150 kW stalls, prices high
  (suppressing demand via elasticity), and repairs slowly (~18 days), so
  served sessions — and the host's foot traffic — erode as demand grows.
- **Owner**: upfront capex (stalls, cabinets, optional battery); charging
  revenue net of processing; energy at $0.11/kWh; monthly demand charges on
  estimated peak (battery cuts billed peak ~45%); O&M and network fees; plus
  the same in-store margin on far more served sessions.
- **Happiness**: served-ratio × uptime factor × charging-speed satisfaction.
- **Challenge-the-assumptions panel**: lease rate, CPO price, both repair
  SLAs, in-store margin, and demand growth are user-adjustable within
  defensible bounds; the Brief updates live.

## Tuning notes (current constants)

Constants calibrated against operator P&L experience: 35 kWh/session, battery
cuts billed demand peak ~60%, and dispenser capex uses a high fixed cost with
a shallow per-kW slope ($50k + $50/kW), since real-world cost differences
between 200 kW and 400 kW dispensers are modest. Capex incentives (utility
make-ready, state grants) and clean-fuel credit revenue (LCFS-style programs)
are deliberately **not** modeled — the debrief calls them out as unmodeled
upside for ownership, keeping the on-screen owner line conservative.

Resulting meta (10-yr horizon, owner picks the best of several sensible
builds, 24 runs per archetype):

- Ownership wins ~100% of runs on every archetype from 15 SPD upward, by
  +$75k (thin sites) to +$400k (mature corridors).
- The thinnest greenfield (10 SPD @ 15%) still favors the lease by ~$100k
  over 10 years — demand saturates the decade around 40 SPD.
- At a 5-year horizon the lease wins essentially always: owner capex has not
  paid back yet. Ownership is a long-horizon decision and the game shows the
  J-curve honestly.
- Right-sizing dominates: 4 stalls at 200 kW is the winning build nearly
  everywhere. Note a model artifact: with 35 kWh sessions and the 18-minute
  session floor, power above ~200 kW adds happiness but not throughput, so
  high-power builds pay capex and demand charges for satisfaction alone.
