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

With the conservative growth ranges, the decision is genuinely contested —
which scenario wins depends on the brief and on build discipline:

- Low-demand greenfield (10 SPD @ 15%): the lease tends to win a 10-year
  horizon; demand saturates the decade around 40 SPD, and owner capex is hard
  to recover. Overbuilding (6×250 kW) is badly punished here.
- Mid sites (20 SPD @ 10%): a *right-sized* owner build (≈4×200 kW + battery)
  beats the lease; an overbuilt one loses to it.
- Mature corridors (30 SPD @ 5%): ownership wins across builds.

This makes the game a judgment exercise rather than a foregone conclusion.
If ownership should win more broadly, the honest levers are the in-store
margin default, the simulation horizon, or per-stall capex — all in `sim.js`
constants at the top of the file.
