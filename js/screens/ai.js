import { state } from '../state.js';
import { registerScreen } from '../navigation.js';
import { isLocked, showPaywall, premiumBadge } from '../premium.js';
import { t } from '../i18n.js';

// ─────────────────────────────────────────────
// GROQ API CONFIG
// Get your FREE key at: https://console.groq.com
// Add it in Profile → Settings → AI Provider
// ─────────────────────────────────────────────
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function callGroq(prompt) {
  const key = state.groqKey;
  if (!key) throw new Error('NO_KEY');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      max_tokens:  1000,
      temperature: 0.4,
      messages:    [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// ─────────────────────────────────────────────
// BUILD HISTORY TEXT FOR PROMPTS
// ─────────────────────────────────────────────
export function buildHistoryText() {
  if (state.entries.length === 0) return 'No symptom entries recorded yet.';
  return [...state.entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e =>
      `Date: ${e.date} | Symptoms: ${e.symptoms.join(', ')} | Intensity: ${e.intensity}/10` +
      `${e.triggers.length ? ' | Triggers: ' + e.triggers.join(', ') : ''}` +
      `${e.notes ? ` | Notes: "${e.notes}"` : ''}`
    ).join('\n');
}

// ─────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────
const PROMPTS = {
  analyze: h => `You are a health analysis AI (NOT a doctor). User symptom history:\n\n${h}\n\nAnalyze the pattern. Identify the most likely general condition. Note progression trends and most concerning symptoms. Friendly language, brief summary first then details. Under 300 words. Remind them to see a real doctor.`,

  correlations: h => `You are a health data analyst. User symptom history:\n\n${h}\n\nFind 3–4 meaningful correlations: what appears together, what worsens over time, which triggers seem linked. Numbered list. Under 250 words.`,

  report: h => `Generate a structured medical summary for a patient to show their doctor.\n\nSymptom history:\n${h}\n\nSections:\n1. Timeline Summary\n2. Primary Symptoms & Progression\n3. Intensity Trends\n4. Identified Triggers\n5. Key Points for the Doctor\n\nProfessional tone. Under 350 words.`,

  recommend: h => `You are a health guidance AI. Symptom history:\n\n${h}\n\nProvide:\n1. 2–3 immediate self-care actions\n2. Which type of doctor to see and when\n3. Warning signs requiring urgent care\n4. Helpful lifestyle adjustments\n\nPractical and specific. Under 300 words. Emphasize consulting a real doctor.`,

  doctor_visit: (h, appointmentDate, doctorType) =>
    `You are preparing a patient for a medical appointment on ${appointmentDate} with a ${doctorType}.\n\nTheir symptom history:\n${h}\n\nCreate a structured pre-appointment briefing with:\n1. CHIEF COMPLAINT (1-2 sentences: main reason for the visit)\n2. SYMPTOM TIMELINE (chronological, key dates and changes)\n3. TOP 3 CONCERNS TO DISCUSS (most important for this appointment)\n4. QUESTIONS TO ASK THE DOCTOR (5 specific, practical questions)\n5. RELEVANT CONTEXT (triggers, patterns, what helped or worsened symptoms)\n\nClear, concise, doctor-friendly. This is what the patient will show/read to the doctor. Under 400 words.`
};

const UI = {
  analyze:      { label: '🔬 AI ANALYSIS',     loading: 'Analyzing your symptom patterns...' },
  correlations: { label: '🔗 CORRELATIONS',    loading: 'Finding hidden connections...' },
  report:       { label: '📋 DOCTOR REPORT',   loading: 'Generating your health report...' },
  recommend:    { label: '💊 RECOMMENDATIONS', loading: 'Building recommendations...' },
  doctor_visit: { label: '🏥 VISIT BRIEFING',  loading: 'Preparing your appointment briefing...' }
};

// ─────────────────────────────────────────────
// RUN AI
// ─────────────────────────────────────────────
export async function runAI(type) {
  // Premium gate for all AI features
  if (isLocked('ai')) { showPaywall(type); return; }

  const area = document.getElementById('ai-result-area');
  if (!area) return;
  const ui = UI[type] || UI.analyze;

  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">${ui.label}</div>
    <div class="ai-loading"><div class="ai-spinner"></div>${ui.loading}</div>
  </div>`;

  try {
    const history = buildHistoryText();
    let   text;

    if (type === 'doctor_visit') {
      // Read values from the doctor visit form
      const dateEl   = document.getElementById('dv-date');
      const doctorEl = document.getElementById('dv-doctor');
      const apptDate = dateEl?.value   || 'upcoming appointment';
      const docType  = doctorEl?.value || 'General Practitioner';
      text = await callGroq(PROMPTS.doctor_visit(history, apptDate, docType));
      renderDoctorVisitResult(area, text, apptDate, docType);
      return;
    }

    text = await callGroq(PROMPTS[type](history));

    if (type === 'report') {
      renderReport(area, text);
    } else {
      area.innerHTML = `<div class="ai-result-box">
        <div class="ai-result-label">${ui.label}</div>
        <div class="ai-result-content">${text}</div>
      </div>`;
    }
  } catch (err) {
    if (err.message === 'NO_KEY') {
      area.innerHTML = `<div class="ai-result-box">
        <div class="ai-result-label" style="color:var(--gold)">⚙️ GROQ API KEY REQUIRED</div>
        <div class="ai-result-content" style="color:var(--cream60)">
To use AI features, add your free Groq API key:\n\n1. Go to <strong style="color:var(--gold)">console.groq.com</strong> → Sign up free\n2. Create an API key\n3. Paste it in <strong style="color:var(--gold)">Profile → AI Provider → Add Key</strong>

Groq is free and runs fast. No credit card needed.
        </div>
      </div>`;
    } else {
      area.innerHTML = `<div class="ai-result-box">
        <div class="ai-result-label">⚠️ ERROR</div>
        <div class="ai-result-content" style="color:var(--coral)">Could not reach Groq AI.\n\n${err.message}</div>
      </div>`;
    }
  }
}

function renderReport(area, text) {
  const today = new Date().toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' });
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">📋 DOCTOR REPORT</div>
    <div class="report-meta">
      <div><div class="report-meta-label">Generated</div><div class="report-meta-value">${today}</div></div>
      <div><div class="report-meta-label">Entries</div><div class="report-meta-value">${state.entries.length}</div></div>
      <div><div class="report-meta-label">Powered by</div><div class="report-meta-value">Groq AI</div></div>
    </div>
    <div class="ai-result-content">${text}</div>
    <div style="margin-top:16px;font-size:12px;color:var(--coral);font-style:italic">
      ⚠️ For informational purposes only. Always consult a qualified medical professional.
    </div>
  </div>`;
}

function renderDoctorVisitResult(area, text, apptDate, docType) {
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">🏥 APPOINTMENT BRIEFING</div>
    <div class="report-meta">
      <div><div class="report-meta-label">Appointment</div><div class="report-meta-value">${apptDate}</div></div>
      <div><div class="report-meta-label">Doctor type</div><div class="report-meta-value">${docType}</div></div>
    </div>
    <div class="ai-result-content">${text}</div>
    <div style="margin-top:16px;padding:14px 16px;background:var(--mint-dim);border-radius:var(--r-sm);display:flex;gap:10px;align-items:center">
      <div style="font-size:20px">💡</div>
      <div style="font-size:13px;color:var(--cream60)">Show this briefing to your doctor at the start of your appointment to make the most of your time.</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// RENDER AI SCREEN with Doctor Visit form
// ─────────────────────────────────────────────
function renderAIScreen() {
  const locked = isLocked('ai');
  // Update AI provider label in result area
  const area = document.getElementById('ai-result-area');
  if (area) area.innerHTML = '';

  // Render doctor visit form
  const dvForm = document.getElementById('dv-form');
  if (!dvForm) return;

  const today = new Date().toISOString().split('T')[0];
  dvForm.innerHTML = `
    <div class="dv-row">
      <div class="dv-field">
        <div class="dv-label">📅 Appointment date</div>
        <input type="date" id="dv-date" class="dv-input" value="${today}" min="${today}">
      </div>
      <div class="dv-field">
        <div class="dv-label">🩺 Doctor type</div>
        <select id="dv-doctor" class="dv-input">
          <option>General Practitioner</option>
          <option>ENT Specialist</option>
          <option>Cardiologist</option>
          <option>Gastroenterologist</option>
          <option>Neurologist</option>
          <option>Dermatologist</option>
          <option>Pulmonologist</option>
          <option>Psychiatrist / Therapist</option>
          <option>Orthopedist</option>
          <option>Other Specialist</option>
        </select>
      </div>
    </div>
    <button class="dv-btn ${locked ? 'dv-btn--locked' : ''}"
      onclick="${locked ? "showPaywall('doctor_visit')" : "runAI('doctor_visit')"}">
      ${locked ? '🔒 Premium feature — Upgrade to unlock' : '🏥 Generate Visit Briefing'}
    </button>`;
}

export function initAI() {
  renderAIScreen();
}

registerScreen('ai', initAI);
