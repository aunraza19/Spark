export function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function formatRange(min: number, max: number): string {
  return min === max ? formatNumber(min) : `${formatNumber(min)} to ${formatNumber(max)}`;
}
