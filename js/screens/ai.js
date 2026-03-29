import { state } from '../state.js';
import { registerScreen } from '../navigation.js';

// ─────────────────────────────────────────────
// AI PROVIDER CONFIG
// To switch to Groq on next stage, update:
//   API_URL  → 'https://api.groq.com/openai/v1/chat/completions'
//   MODEL    → 'llama3-8b-8192' (or preferred Groq model)
//   HEADERS  → add 'Authorization': 'Bearer YOUR_GROQ_API_KEY'
//   parseResponse() → parse OpenAI-compatible format
// ─────────────────────────────────────────────
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';

async function callAI(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || '';
}

// ─────────────────────────────────────────────
// BUILD SYMPTOM HISTORY STRING FOR PROMPTS
// ─────────────────────────────────────────────
function buildHistoryText() {
  if (state.entries.length === 0) return 'No symptom entries recorded yet.';
  return state.entries.map(e =>
    `Date: ${e.date} | Symptoms: ${e.symptoms.join(', ')} | Intensity: ${e.intensity}/10` +
    `${e.triggers.length ? ' | Triggers: ' + e.triggers.join(', ') : ''}` +
    `${e.notes ? ` | Notes: "${e.notes}"` : ''}`
  ).join('\n');
}

// ─────────────────────────────────────────────
// PROMPTS PER ACTION TYPE
// ─────────────────────────────────────────────
const PROMPTS = {
  analyze: (h) => `You are a health analysis AI assistant (NOT a doctor). A user has logged the following symptom history:\n\n${h}\n\nProvide a thoughtful analysis of their symptom pattern. Identify the most likely general condition (e.g., "early-stage cold", "stress-related symptoms"). Note symptom progression trends and which symptoms are most concerning. Use clear, friendly language. Start with a brief summary, then details. Under 300 words. Always remind them to consult a real doctor.`,

  correlations: (h) => `You are a health data analyst. User symptom history:\n\n${h}\n\nFind 3–4 meaningful correlations or patterns. For each: what tends to appear together, what worsens over time, what triggers seem linked. Format as clear numbered insights. Under 250 words.`,

  report: (h) => `Generate a structured medical summary report for a patient to bring to their doctor. Symptom history:\n\n${h}\n\nCreate a report with these sections:\n1. Timeline Summary\n2. Primary Symptoms & Progression\n3. Intensity Trends\n4. Identified Triggers\n5. Key Observations for the Doctor\n\nProfessional, factual, under 350 words.`,

  recommend: (h) => `You are a health guidance AI. Symptom history:\n\n${h}\n\nProvide:\n1. Immediate self-care actions (2–3 specific steps)\n2. Which specialist to see if symptoms persist (GP, ENT, etc.)\n3. Warning signs requiring immediate medical attention\n4. Lifestyle adjustments that might help\n\nSpecific and practical. Under 300 words. Emphasize consulting a real doctor.`
};

// ─────────────────────────────────────════════
// UI LABELS PER TYPE
// ─────────────────────────────────────────────
const UI = {
  analyze:      { label: '🔬 AI ANALYSIS',      loading: 'Analyzing your symptom patterns...' },
  correlations: { label: '🔗 CORRELATIONS',     loading: 'Finding hidden connections...' },
  report:       { label: '📋 DOCTOR REPORT',    loading: 'Generating your health report...' },
  recommend:    { label: '💊 RECOMMENDATIONS',  loading: 'Building personalized recommendations...' }
};

// ─────────────────────────────────────────────
// RUN AI ANALYSIS
// ─────────────────────────────────────────────
export async function runAI(type) {
  const area = document.getElementById('ai-result-area');
  if (!area) return;
  const ui = UI[type];

  // Show loading state
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">${ui.label}</div>
    <div class="ai-loading"><div class="ai-spinner"></div>${ui.loading}</div>
  </div>`;

  try {
    const history = buildHistoryText();
    const text    = await callAI(PROMPTS[type](history));

    if (type === 'report') {
      renderReport(area, text);
    } else {
      area.innerHTML = `<div class="ai-result-box">
        <div class="ai-result-label">${ui.label}</div>
        <div class="ai-result-content">${text}</div>
      </div>`;
    }
  } catch (err) {
    area.innerHTML = `<div class="ai-result-box">
      <div class="ai-result-label">${ui.label}</div>
      <div class="ai-result-content" style="color:var(--coral)">
        ⚠️ Could not reach AI. Please check your connection.\n\nError: ${err.message}
      </div>
    </div>`;
  }
}

function renderReport(area, text) {
  const today = new Date().toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' });
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">📋 DOCTOR REPORT</div>
    <div class="report-meta">
      <div><div class="report-meta-label">Generated</div><div class="report-meta-value">${today}</div></div>
      <div><div class="report-meta-label">Entries analyzed</div><div class="report-meta-value">${state.entries.length}</div></div>
      <div><div class="report-meta-label">Powered by</div><div class="report-meta-value">Claude AI</div></div>
    </div>
    <div class="ai-result-content">${text}</div>
    <div style="margin-top:16px;font-size:12px;color:var(--coral);font-style:italic">
      ⚠️ This report is for informational purposes only. Always consult a qualified medical professional.
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// INIT (clear previous results on screen open)
// ─────────────────────────────────────────────
function initAI() {
  const area = document.getElementById('ai-result-area');
  if (area) area.innerHTML = '';
}

registerScreen('ai', initAI);
