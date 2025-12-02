/**
 * FranchiseForecastCard Component
 * E22-FRANCHISE-FE-S1: Display forecast summary and top forecast branches
 */

import React from 'react';
import { FranchiseForecastResponseDto } from '@/types/franchise';

interface Props {
  forecast: FranchiseForecastResponseDto;
  currency: string;
}

export const FranchiseForecastCard: React.FC<Props> = ({ forecast, currency }) => {
  if (!forecast.branches.length) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Sales Forecast</h3>
        <p className="text-sm text-slate-400">No forecast data available</p>
      </div>
    );
  }

  // Calculate totals
  const totalForecast = forecast.branches.reduce(
    (sum, b) => sum + b.forecastNetSalesCents,
    0
  );
  const totalHistorical = forecast.branches.reduce(
    (sum, b) => sum + b.historicalNetSalesCents,
    0
  );
  const growth =
    totalHistorical > 0
      ? ((totalForecast - totalHistorical) / totalHistorical) * 100
      : 0;

  // Top 3 branches by forecast
  const topForecasts = [...forecast.branches]
    .sort((a, b) => b.forecastNetSalesCents - a.forecastNetSalesCents)
    .slice(0, 3);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">
        Sales Forecast
      </h3>

      {/* Total forecast vs historical */}
      <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-slate-400">Forecast Total</span>
          <span className="text-lg font-semibold text-slate-100">
            {currency} {(totalForecast / 100).toLocaleString()}
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-slate-400">Historical Avg</span>
          <span className="text-sm text-slate-300">
            {currency} {(totalHistorical / 100).toLocaleString()}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400">Expected Growth</span>
          <span
            className={`text-sm font-medium ${
              growth >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {growth >= 0 ? '+' : ''}
            {growth.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Top forecast branches */}
      <div>
        <p className="text-xs text-slate-400 font-medium mb-2">
          Top 3 Forecast Branches
        </p>
        {topForecasts.map((b, idx) => (
          <div
            key={b.branchId}
            className="flex items-center justify-between py-1 text-xs"
          >
            <span className="text-slate-300">
              {idx + 1}. {b.branchName}
            </span>
            <span className="text-slate-200 font-medium">
              {currency} {(b.forecastNetSalesCents / 100).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Lookback Period</span>
          <span className="text-slate-200 font-medium">
            {forecast.lookbackMonths} months
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-400">Target Month</span>
          <span className="text-slate-200 font-medium">
            {forecast.year}-{String(forecast.month).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};
