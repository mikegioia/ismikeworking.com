import type { Assessment } from '../engine/types';

function fmt(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

export function breakdownHtml(a: Assessment): string {
  if (a.signals.length === 0) {
    return '<p class="math">No rules fired. The engine shrugs.</p>';
  }
  const rows = a.signals
    .map((s) => `<li><span>${escapeHtml(s.label)}</span><b>${fmt(s.contribution)}</b></li>`)
    .join('');
  return `<ul>${rows}</ul><p class="math">score: ${a.score < 0 ? `−${Math.abs(a.score)}` : a.score} → ${escapeHtml(a.verdict.text)}</p>`;
}
