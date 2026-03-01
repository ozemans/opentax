// Lot-Level Tax Optimizer
// Pure functions only — no DOM access.
//
// computeLotProjections():          models FIFO/LIFO/min-tax scenarios for a pending sale.
// computeHarvestingOpportunities(): scans unsold positions for loss-harvesting candidates.
//
// All monetary values are integers in CENTS.

import type {
  TaxLot,
  LotSelectionStrategy,
  SelectedLotDetail,
  LotProjection,
  LotOptimizerInput,
  LotOptimizerResult,
  HarvestingCandidate,
  HarvestingAdvisorInput,
  HarvestingAdvisorResult,
  FilingStatus,
  FederalConfig,
  TaxBracket,
  CapitalGainsRateBracket,
} from '../types';

// ---------------------------------------------------------------------------
// Rate helpers
// ---------------------------------------------------------------------------

function getMarginalRate(taxableIncomeCents: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncomeCents >= brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

function getLTCGRate(taxableIncomeCents: number, cgRates: CapitalGainsRateBracket[]): number {
  for (const bracket of cgRates) {
    if (bracket.max === null || taxableIncomeCents <= bracket.max) return bracket.rate;
  }
  return cgRates[cgRates.length - 1].rate;
}

// ---------------------------------------------------------------------------
// Tax estimation
// ---------------------------------------------------------------------------

/**
 * Estimate incremental federal tax on a projected sale.
 * - ST gain: taxed at marginal ordinary income rate
 * - LT gain: taxed at preferential capital gains rate
 * - NIIT: 3.8% on net investment income above filing-status threshold
 *
 * All inputs and outputs in cents.
 */
function estimateTax(
  stGainCents: number,
  ltGainCents: number,
  ytdSTGainCents: number,
  ytdLTGainCents: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): number {
  const totalIncome = ytdSTGainCents + ytdLTGainCents;
  const brackets = config.brackets[filingStatus];
  const cgRates = config.capitalGainsRates[filingStatus];
  const stRate = getMarginalRate(totalIncome, brackets);
  const ltRate = getLTCGRate(totalIncome, cgRates);

  let tax = 0;

  if (stGainCents > 0) {
    tax += Math.round(stGainCents * stRate);
  }
  if (ltGainCents > 0) {
    tax += Math.round(ltGainCents * ltRate);
  }

  // NIIT: 3.8% on NII above threshold
  const niitThreshold = config.niit.threshold[filingStatus];
  const priorNII = ytdSTGainCents + ytdLTGainCents;
  const newNII = Math.max(0, stGainCents) + Math.max(0, ltGainCents);
  const totalNII = priorNII + newNII;

  if (totalNII > niitThreshold) {
    const niitableAmount = Math.min(newNII, totalNII - niitThreshold);
    if (niitableAmount > 0) {
      tax += Math.round(niitableAmount * config.niit.rate);
    }
  }

  return Math.max(0, tax);
}

// ---------------------------------------------------------------------------
// Lot selection helpers
// ---------------------------------------------------------------------------

function parseDateMs(dateStr: string): number {
  if (dateStr === 'VARIOUS') return 0;
  return new Date(dateStr).getTime();
}

/**
 * Fill a sale by drawing shares from sorted lots.
 * Handles partial-lot fills when a lot has more shares than needed.
 */
function fillLots(
  sortedLots: TaxLot[],
  sharesToSell: number,
  currentPricePerShareCents: number,
): SelectedLotDetail[] {
  const selected: SelectedLotDetail[] = [];
  let remaining = sharesToSell;

  for (const lot of sortedLots) {
    if (remaining <= 0) break;
    const sharesSold = Math.min(remaining, lot.quantity);
    const proceeds = Math.round(sharesSold * currentPricePerShareCents);
    const unitCost = lot.quantity > 0 ? lot.totalCostBasis / lot.quantity : lot.unitCostBasis;
    const basis = Math.round(sharesSold * unitCost);
    const gain = proceeds - basis;
    // Lots with VARIOUS dateAcquired are treated as long-term (conservative default)
    const isLongTerm = lot.isLongTerm ?? true;

    selected.push({ lot, sharesSold, proceeds, basis, gain, isLongTerm });
    remaining -= sharesSold;
  }

  return selected;
}

function buildProjection(
  strategy: LotSelectionStrategy,
  selected: SelectedLotDetail[],
  ytdSTGainCents: number,
  ytdLTGainCents: number,
  filingStatus: FilingStatus,
  config: FederalConfig,
): LotProjection {
  const totalShares = selected.reduce((s, d) => s + d.sharesSold, 0);
  const totalProceeds = selected.reduce((s, d) => s + d.proceeds, 0);
  const totalBasis = selected.reduce((s, d) => s + d.basis, 0);
  const shortTermGain = selected
    .filter((d) => !d.isLongTerm)
    .reduce((s, d) => s + d.gain, 0);
  const longTermGain = selected
    .filter((d) => d.isLongTerm)
    .reduce((s, d) => s + d.gain, 0);

  const estimatedFederalTax = estimateTax(
    shortTermGain,
    longTermGain,
    ytdSTGainCents,
    ytdLTGainCents,
    filingStatus,
    config,
  );

  return {
    strategy,
    selectedLots: selected,
    totalShares,
    totalProceeds,
    totalBasis,
    shortTermGain,
    longTermGain,
    estimatedFederalTax,
    afterTaxProceeds: totalProceeds - estimatedFederalTax,
    isRecommended: false, // set after comparing all projections
  };
}

// ---------------------------------------------------------------------------
// computeLotProjections
// ---------------------------------------------------------------------------

/**
 * Given a set of tax lots for one security and a number of shares to sell,
 * returns three sale projections (FIFO, LIFO, MIN_TAX) with estimated tax impact.
 *
 * MIN_TAX algorithm:
 *  1. Loss lots (unrealized loss) are sold first — always reduce tax.
 *  2. Among gain lots, prefer LT if ltRate < stRate (nearly always true).
 *  3. Within LT: prefer highest basis (smallest gain) when no LT carryforward,
 *     or lowest basis (exploit carryforward absorption) when ytdNetLT < 0.
 *  4. NIIT threshold pushes above-threshold gains to get +3.8%.
 */
export function computeLotProjections(input: LotOptimizerInput): LotOptimizerResult {
  const {
    lots,
    sharesToSell,
    currentPricePerShareCents,
    ytdShortTermGainCents,
    ytdLongTermGainCents,
    priorYearLTCarryforwardCents = 0,
    filingStatus,
    config,
  } = input;

  const unsold = lots.filter((l) => !l.dateSold && l.quantity > 0);
  const totalAvailableShares = unsold.reduce((s, l) => s + l.quantity, 0);

  if (sharesToSell <= 0 || totalAvailableShares < sharesToSell) {
    return { projections: [] };
  }

  // ── FIFO: oldest lots first ──────────────────────────────────────────────
  const fifoLots = [...unsold].sort(
    (a, b) => parseDateMs(a.dateAcquired) - parseDateMs(b.dateAcquired),
  );
  const fifoSelected = fillLots(fifoLots, sharesToSell, currentPricePerShareCents);

  // ── LIFO: newest lots first ──────────────────────────────────────────────
  const lifoLots = [...unsold].sort(
    (a, b) => parseDateMs(b.dateAcquired) - parseDateMs(a.dateAcquired),
  );
  const lifoSelected = fillLots(lifoLots, sharesToSell, currentPricePerShareCents);

  // ── MIN_TAX: score each lot by effective tax cost per share ──────────────
  const totalIncome = ytdShortTermGainCents + ytdLongTermGainCents;
  const stRate = getMarginalRate(totalIncome, config.brackets[filingStatus]);
  const ltRate = getLTCGRate(totalIncome, config.capitalGainsRates[filingStatus]);

  // Net YTD LT gain after prior-year LT carryforward (used for min-tax scoring)
  const ytdNetLT = ytdLongTermGainCents - priorYearLTCarryforwardCents;

  const scoredLots = unsold.map((lot) => {
    const unitCost = lot.quantity > 0 ? lot.totalCostBasis / lot.quantity : lot.unitCostBasis;
    const gainPerShare = currentPricePerShareCents - unitCost;
    const isLT = lot.isLongTerm ?? true;
    const effectiveRate = isLT ? ltRate : stRate;

    let score: number;
    if (gainPerShare < 0) {
      // Loss lot — sell first (lowers taxable income); score very negative
      score = gainPerShare * effectiveRate - 1e12;
    } else if (isLT && ytdNetLT < 0 && Math.abs(ytdNetLT) > gainPerShare * lot.quantity) {
      // Entire gain absorbed by LT carryforward → effectively 0 tax; prefer these early
      score = -gainPerShare;
    } else {
      // Normal gain lot — prefer lowest tax cost
      score = gainPerShare * effectiveRate;
    }

    return { lot, score };
  });

  scoredLots.sort((a, b) => a.score - b.score); // ascending: lowest tax cost first
  const minTaxLots = scoredLots.map((s) => s.lot);
  const minTaxSelected = fillLots(minTaxLots, sharesToSell, currentPricePerShareCents);

  // ── Build and compare projections ────────────────────────────────────────
  const projections = [
    buildProjection(
      'FIFO',
      fifoSelected,
      ytdShortTermGainCents,
      ytdLongTermGainCents,
      filingStatus,
      config,
    ),
    buildProjection(
      'LIFO',
      lifoSelected,
      ytdShortTermGainCents,
      ytdLongTermGainCents,
      filingStatus,
      config,
    ),
    buildProjection(
      'MIN_TAX',
      minTaxSelected,
      ytdShortTermGainCents,
      ytdLongTermGainCents,
      filingStatus,
      config,
    ),
  ];

  // Mark the lowest-tax projection as recommended (first one if tie)
  const minTax = Math.min(...projections.map((p) => p.estimatedFederalTax));
  let marked = false;
  for (const p of projections) {
    if (!marked && p.estimatedFederalTax === minTax) {
      p.isRecommended = true;
      marked = true;
    }
  }

  return { projections };
}

// ---------------------------------------------------------------------------
// computeHarvestingOpportunities
// ---------------------------------------------------------------------------

/**
 * Scan all unsold lots for positions with unrealized losses.
 * Returns up to 5 candidates sorted by estimated tax savings (highest first).
 *
 * Wash sale risk is flagged when the same security was bought or sold
 * within the 61-day window (30 days before/after the harvest date).
 */
export function computeHarvestingOpportunities(
  input: HarvestingAdvisorInput,
): HarvestingAdvisorResult {
  const {
    lots,
    currentPrices,
    ytdShortTermGainCents,
    ytdLongTermGainCents,
    filingStatus,
    config,
    form1099Bs,
  } = input;

  const totalIncome = ytdShortTermGainCents + ytdLongTermGainCents;
  const marginalRate = getMarginalRate(totalIncome, config.brackets[filingStatus]);

  // Group unsold lots by symbol
  const bySymbol = new Map<string, TaxLot[]>();
  for (const lot of lots) {
    if (lot.dateSold) continue;
    const group = bySymbol.get(lot.symbol) ?? [];
    group.push(lot);
    bySymbol.set(lot.symbol, group);
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const today = Date.now();
  const recentWindowMs = today - THIRTY_DAYS_MS;

  const candidates: HarvestingCandidate[] = [];

  for (const [symbol, symbolLots] of bySymbol) {
    const pricePerShare = currentPrices[symbol];
    if (!pricePerShare) continue;

    const totalShares = symbolLots.reduce((s, l) => s + l.quantity, 0);
    const currentValue = Math.round(totalShares * pricePerShare);
    const totalBasis = symbolLots.reduce((s, l) => s + l.totalCostBasis, 0);
    const unrealizedGain = currentValue - totalBasis;

    // Only positions with unrealized losses qualify
    if (unrealizedGain >= 0) continue;

    const unrealizedLoss = -unrealizedGain; // positive magnitude
    const estimatedTaxSavings = Math.round(unrealizedLoss * marginalRate);

    // Wash sale risk: any realized transaction or recent acquisition in the 30-day window?
    const symbolUpper = symbol.toUpperCase();
    const washSaleRisk =
      form1099Bs.some((tx) => {
        if ((tx.description ?? '').toUpperCase() !== symbolUpper) return false;
        const soldMs = new Date(tx.dateSold).getTime();
        const acquiredMs =
          tx.dateAcquired !== 'VARIOUS' ? new Date(tx.dateAcquired).getTime() : 0;
        return soldMs >= recentWindowMs || acquiredMs >= recentWindowMs;
      }) ||
      symbolLots.some((lot) => {
        if (lot.dateAcquired === 'VARIOUS') return false;
        const acquiredMs = new Date(lot.dateAcquired).getTime();
        return acquiredMs >= recentWindowMs;
      });

    candidates.push({
      symbol,
      description: symbolLots[0].description,
      lots: symbolLots,
      currentValueCents: currentValue,
      totalBasisCents: totalBasis,
      unrealizedLossCents: unrealizedLoss,
      estimatedTaxSavingsCents: estimatedTaxSavings,
      washSaleRisk,
    });
  }

  // Sort by savings descending; return top 5
  candidates.sort((a, b) => b.estimatedTaxSavingsCents - a.estimatedTaxSavingsCents);
  return { candidates: candidates.slice(0, 5) };
}
