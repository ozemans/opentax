import { useState, useMemo, useCallback } from 'react';
import type { TaxLot, Form1099B, FederalConfig, LotProjection, LotSelectionStrategy } from '@/engine/types';
import { computeLotProjections, computeHarvestingOpportunities } from '@/engine/federal/lot-optimizer';
import type { FilingStatus } from '@/engine/types';

interface LotOptimizerPanelProps {
  lots: TaxLot[];
  filingStatus: FilingStatus;
  config: FederalConfig;
  form1099Bs: Form1099B[];
  ytdShortTermGainCents: number;
  ytdLongTermGainCents: number;
  priorYearSTCarryforwardCents?: number;
  priorYearLTCarryforwardCents?: number;
  onConfirmSale: (newTransactions: Form1099B[]) => void;
}

function fmt(cents: number): string {
  const abs = Math.abs(cents);
  const str = (abs / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return cents < 0 ? `-${str}` : str;
}

function gainColor(cents: number): string {
  return cents >= 0 ? 'text-success' : 'text-accent';
}

const STRATEGY_LABELS: Record<LotSelectionStrategy, string> = {
  FIFO: 'FIFO',
  LIFO: 'LIFO',
  MIN_TAX: 'Min-Tax',
};

const STRATEGY_DESCRIPTIONS: Record<LotSelectionStrategy, string> = {
  FIFO: 'First in, first out — sells oldest lots first. Common broker default.',
  LIFO: 'Last in, first out — sells newest lots first.',
  MIN_TAX: 'Optimized — picks lots to minimize your estimated federal tax.',
};

export function LotOptimizerPanel({
  lots,
  filingStatus,
  config,
  form1099Bs,
  ytdShortTermGainCents,
  ytdLongTermGainCents,
  priorYearSTCarryforwardCents = 0,
  priorYearLTCarryforwardCents = 0,
  onConfirmSale,
}: LotOptimizerPanelProps) {
  // Unique symbols from unsold lots
  const symbols = useMemo(
    () => [...new Set(lots.filter((l) => !l.dateSold && l.quantity > 0).map((l) => l.symbol))].sort(),
    [lots],
  );

  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbols[0] ?? '');
  const [sharesToSellStr, setSharesToSellStr] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [projections, setProjections] = useState<LotProjection[] | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<LotSelectionStrategy | null>(null);
  const [harvestOpen, setHarvestOpen] = useState(false);
  // Price map for harvesting: symbol → cents per share
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});

  const symbolLots = useMemo(
    () => lots.filter((l) => l.symbol === selectedSymbol && !l.dateSold && l.quantity > 0),
    [lots, selectedSymbol],
  );

  const totalAvailableShares = useMemo(
    () => symbolLots.reduce((s, l) => s + l.quantity, 0),
    [symbolLots],
  );

  const handleCalculate = useCallback(() => {
    const sharesToSell = parseFloat(sharesToSellStr);
    const pricePerShare = parseFloat(priceStr);
    if (!isFinite(sharesToSell) || sharesToSell <= 0) return;
    if (!isFinite(pricePerShare) || pricePerShare <= 0) return;

    const result = computeLotProjections({
      lots: symbolLots,
      symbol: selectedSymbol,
      sharesToSell,
      currentPricePerShareCents: Math.round(pricePerShare * 100),
      ytdShortTermGainCents,
      ytdLongTermGainCents,
      priorYearSTCarryforwardCents,
      priorYearLTCarryforwardCents,
      filingStatus,
      config,
    });

    setProjections(result.projections);
    const recommended = result.projections.find((p) => p.isRecommended);
    setSelectedStrategy(recommended?.strategy ?? null);

    // Add price to map for harvesting use
    if (selectedSymbol && priceStr) {
      setPriceMap((prev) => ({ ...prev, [selectedSymbol]: priceStr }));
    }
  }, [
    sharesToSellStr,
    priceStr,
    symbolLots,
    selectedSymbol,
    ytdShortTermGainCents,
    ytdLongTermGainCents,
    priorYearSTCarryforwardCents,
    priorYearLTCarryforwardCents,
    filingStatus,
    config,
  ]);

  const handleConfirmSale = useCallback(() => {
    if (!projections || !selectedStrategy) return;
    const projection = projections.find((p) => p.strategy === selectedStrategy);
    if (!projection) return;

    const today = new Date().toISOString().slice(0, 10);
    const newTransactions: Form1099B[] = projection.selectedLots.map((detail) => ({
      description: `${detail.lot.symbol} — ${detail.lot.description}`,
      dateAcquired: detail.lot.dateAcquired,
      dateSold: today,
      proceeds: detail.proceeds,
      costBasis: detail.basis,
      gainLoss: detail.gain,
      isLongTerm: detail.isLongTerm,
      basisReportedToIRS: false, // lot-level tracking; basis not separately reported
      category: detail.isLongTerm ? '8949_E' as const : '8949_B' as const,
      ...(detail.lot.washSaleDisallowed ? { washSaleDisallowed: detail.lot.washSaleDisallowed } : {}),
    }));

    onConfirmSale(newTransactions);
    // Reset panel
    setSharesToSellStr('');
    setPriceStr('');
    setProjections(null);
    setSelectedStrategy(null);
  }, [projections, selectedStrategy, onConfirmSale]);

  // Harvesting opportunities
  const harvestingResult = useMemo(() => {
    const currentPrices: Record<string, number> = {};
    for (const [sym, priceStrVal] of Object.entries(priceMap)) {
      const p = parseFloat(priceStrVal);
      if (isFinite(p) && p > 0) currentPrices[sym] = Math.round(p * 100);
    }
    if (Object.keys(currentPrices).length === 0) return null;

    return computeHarvestingOpportunities({
      lots,
      currentPrices,
      ytdShortTermGainCents,
      ytdLongTermGainCents,
      filingStatus,
      config,
      form1099Bs,
    });
  }, [lots, priceMap, ytdShortTermGainCents, ytdLongTermGainCents, filingStatus, config, form1099Bs]);

  if (symbols.length === 0) {
    return (
      <p className="text-sm font-body text-slate">
        Import holdings first to use the lot optimizer.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Symbol */}
        <div>
          <label htmlFor="lot-symbol" className="block text-xs font-display font-medium text-slate-dark mb-1">
            Security
          </label>
          <select
            id="lot-symbol"
            value={selectedSymbol}
            onChange={(e) => {
              setSelectedSymbol(e.target.value);
              setProjections(null);
              setSelectedStrategy(null);
            }}
            className="w-full rounded-lg border border-slate-light bg-white px-3 py-2 text-sm font-body text-slate-dark focus:border-highlight focus:outline-none"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="mt-1 text-xs font-body text-slate">
            {totalAvailableShares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares available
          </p>
        </div>

        {/* Shares to sell */}
        <div>
          <label htmlFor="lot-shares" className="block text-xs font-display font-medium text-slate-dark mb-1">
            Shares to Sell
          </label>
          <input
            id="lot-shares"
            type="number"
            min="0"
            step="0.001"
            value={sharesToSellStr}
            onChange={(e) => setSharesToSellStr(e.target.value)}
            placeholder="e.g. 10"
            className="w-full rounded-lg border border-slate-light bg-white px-3 py-2 text-sm font-body text-slate-dark focus:border-highlight focus:outline-none"
          />
        </div>

        {/* Current price */}
        <div>
          <label htmlFor="lot-price" className="block text-xs font-display font-medium text-slate-dark mb-1">
            Current Price/Share ($)
          </label>
          <input
            id="lot-price"
            type="number"
            min="0"
            step="0.01"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            placeholder="e.g. 185.50"
            className="w-full rounded-lg border border-slate-light bg-white px-3 py-2 text-sm font-body text-slate-dark focus:border-highlight focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCalculate}
        disabled={!sharesToSellStr || !priceStr}
        className="rounded-lg bg-highlight px-4 py-2 text-sm font-body font-medium text-white
          hover:bg-highlight-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Calculate
      </button>

      {/* Projection results */}
      {projections && projections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-display font-semibold text-slate-dark">Sale Projections</h3>

          <div className="overflow-x-auto rounded-xl border border-slate-light/30">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate" />
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Strategy</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">ST Gain/Loss</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">LT Gain/Loss</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Est. Tax</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">After-Tax Proceeds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-light/20">
                {projections.map((p) => (
                  <tr
                    key={p.strategy}
                    onClick={() => setSelectedStrategy(p.strategy)}
                    className={`cursor-pointer transition-colors ${
                      selectedStrategy === p.strategy ? 'bg-highlight-light/40' : 'hover:bg-surface/50'
                    }`}
                  >
                    <td className="px-3 py-2 w-8">
                      <input
                        type="radio"
                        name="lot-strategy"
                        checked={selectedStrategy === p.strategy}
                        onChange={() => setSelectedStrategy(p.strategy)}
                        aria-label={`Select ${STRATEGY_LABELS[p.strategy]}`}
                        className="accent-highlight"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-dark">{STRATEGY_LABELS[p.strategy]}</span>
                      {p.isRecommended && (
                        <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                          Recommended
                        </span>
                      )}
                      <p className="text-xs text-slate mt-0.5">{STRATEGY_DESCRIPTIONS[p.strategy]}</p>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${gainColor(p.shortTermGain)}`}>
                      {fmt(p.shortTermGain)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${gainColor(p.longTermGain)}`}>
                      {fmt(p.longTermGain)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-accent font-medium">
                      {fmt(p.estimatedFederalTax)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark font-medium">
                      {fmt(p.afterTaxProceeds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedStrategy && (
            <button
              type="button"
              onClick={handleConfirmSale}
              className="rounded-lg bg-success px-4 py-2 text-sm font-body font-medium text-white
                hover:bg-success/90 transition-colors"
            >
              Confirm {STRATEGY_LABELS[selectedStrategy]} Sale — Add to Transactions
            </button>
          )}
        </div>
      )}

      {/* Loss Harvesting Advisor */}
      <div className="rounded-2xl border border-slate-light/40">
        <button
          type="button"
          onClick={() => setHarvestOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          aria-expanded={harvestOpen}
        >
          <span className="text-sm font-display font-semibold text-slate-dark">
            Loss Harvesting Advisor
          </span>
          <svg
            className={`h-4 w-4 text-slate transition-transform ${harvestOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {harvestOpen && (
          <div className="border-t border-slate-light/40 px-4 pb-4 pt-3 space-y-4">
            <p className="text-xs font-body text-slate">
              Enter current prices for your positions to identify harvesting opportunities.
              Enter prices using the calculator above — each price you enter is saved here.
            </p>

            {/* Per-symbol price inputs for symbols not yet priced */}
            {symbols.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {symbols.map((sym) => (
                  <div key={sym}>
                    <label
                      htmlFor={`harvest-price-${sym}`}
                      className="block text-xs font-display font-medium text-slate-dark mb-1"
                    >
                      {sym} Price/Share ($)
                    </label>
                    <input
                      id={`harvest-price-${sym}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceMap[sym] ?? ''}
                      onChange={(e) => setPriceMap((prev) => ({ ...prev, [sym]: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-light bg-white px-3 py-2 text-sm font-body text-slate-dark focus:border-highlight focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {harvestingResult && harvestingResult.candidates.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-display font-semibold text-slate-dark uppercase tracking-wide">
                  Top Harvesting Opportunities
                </h4>
                {harvestingResult.candidates.map((c) => (
                  <div
                    key={c.symbol}
                    className="flex items-start justify-between rounded-xl border border-slate-light/30 px-3 py-3 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-slate-dark text-sm">{c.symbol}</span>
                        {c.washSaleRisk && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Wash sale risk
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-body text-slate mt-0.5 truncate">{c.description}</p>
                      <p className="text-xs font-body text-slate mt-1">
                        Unrealized loss: <span className="text-accent font-medium">{fmt(c.unrealizedLossCents)}</span>
                        {' · '}
                        Current value: {fmt(c.currentValueCents)}
                        {' · '}
                        Basis: {fmt(c.totalBasisCents)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate">Est. savings</p>
                      <p className="text-sm font-display font-semibold text-success">
                        {fmt(c.estimatedTaxSavingsCents)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-body text-slate">
                {Object.keys(priceMap).length > 0
                  ? 'No harvesting opportunities found at current prices.'
                  : 'Enter prices above to identify opportunities.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
