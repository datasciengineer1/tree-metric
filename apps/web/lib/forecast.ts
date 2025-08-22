export type Series = { t: string; y: number }[];

export function linregForecast(series: Series, horizon = 8) {
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map(p => p.y);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const xbar = sum(xs) / n, ybar = sum(ys) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - xbar) * (ys[i] - ybar); den += (xs[i] - xbar) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = ybar - slope * xbar;

  const last = new Date(series[n - 1].t).getTime();
  const day = 86400000;

  const fcst: Series = [];
  for (let h = 1; h <= horizon; h++) {
    const x = n - 1 + h;
    const y = intercept + slope * x;
    fcst.push({ t: new Date(last + h * 7 * day).toISOString().slice(0, 10), y });
  }
  return { slope, intercept, horizon, fcst };
}

export function pctChange(a: number, b: number) {
  if (b === 0) return 0;
  return (a - b) / Math.abs(b);
}
