/**
 * TRACKER.JS — Quiz Espiritual White
 * --------------------------------------------------
 * Hospede este arquivo (ex: substitua o atual em
 * https://poderdoalto.digital/guiadosmilagres/tracker.js)
 * mantendo a tag <script src="..."> já existente no index.html.
 *
 * Ele cria window.quizTracker com os 4 métodos que o quiz já chama:
 *   trackStepView, trackStepAdvance, trackFieldSubmit, trackCtaClick
 *
 * Cada evento é enviado para:
 *   1) Google Analytics 4 (funil agregado, sem dados pessoais)
 *   2) Google Sheets via Apps Script (linha por linha, com nome do lead)
 */

(function () {
  // ======================= CONFIGURAÇÃO =======================
  // 1. Measurement ID do GA4
  const GA4_MEASUREMENT_ID = 'G-KNTNRYXJ2K';

  // 2. URL do Apps Script (webhook do Google Sheets)
  const SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxZIYRyhY5HBEsimeNtnqYrpPooKUcVnRDpOQeqyTAu4BKveYz7ADF4SYM8o4dhqm3k/exec';
  // ==============================================================

  function safeGet(storage, key) {
    try { return storage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function getOrCreateLeadId() {
    const KEY = 'quiz_lead_id';
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      return 'lead_unknown';
    }
  }

  function getStoredUtms() {
    // Mesma chave que o index.html já usa (quiz_persisted_params)
    const raw = safeGet(sessionStorage, 'quiz_persisted_params') || safeGet(localStorage, 'quiz_persisted_params');
    const params = new URLSearchParams(raw);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || ''
    };
  }

  function getStoredName() {
    return safeGet(sessionStorage, 'quiz_user_first_name') || safeGet(localStorage, 'quiz_user_first_name');
  }

  function getLandingUrl() {
    return safeGet(localStorage, 'quiz_landing_url') || safeGet(sessionStorage, 'quiz_landing_url');
  }

  const leadId = getOrCreateLeadId();

  // ---------------- GA4 (gtag.js) ----------------
  let gtagReady = false;

  function loadGA4() {
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf('XXXX') > -1) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA4_MEASUREMENT_ID, { send_page_view: false });

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
    document.head.appendChild(s);
    gtagReady = true;
  }

  function sendGA4Event(eventName, params) {
    if (!gtagReady || typeof window.gtag !== 'function') return;
    try {
      // Nunca mandamos nome/valor de campo pro GA4 (evita dado pessoal nas métricas)
      window.gtag('event', eventName, params);
    } catch (e) {}
  }

  // ---------------- Google Sheets (Apps Script) ----------------
  function sendToSheets(payload) {
    if (!SHEETS_WEBHOOK_URL || SHEETS_WEBHOOK_URL.indexOf('SEU_ID_AQUI') > -1) return;

    const body = JSON.stringify(payload);

    try {
      // sendBeacon: dispara mesmo se o usuário sair da página logo em seguida
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        const ok = navigator.sendBeacon(SHEETS_WEBHOOK_URL, blob);
        if (ok) return;
      }
    } catch (e) {}

    // fallback
    try {
      fetch(SHEETS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function buildBasePayload() {
    const utms = getStoredUtms();
    return Object.assign({
      lead_id: leadId,
      name: getStoredName(),
      landing_url: getLandingUrl(),
      page_url: window.location.href,
      user_agent: navigator.userAgent
    }, utms);
  }

  // ---------------- API pública usada pelo quiz ----------------
  window.quizTracker = {
    trackStepView: function (stepName, stepOrder) {
      const payload = Object.assign(buildBasePayload(), {
        event: 'step_view',
        step_name: stepName,
        step_order: stepOrder
      });
      sendToSheets(payload);
      sendGA4Event('quiz_step_view', { step_name: stepName, step_order: stepOrder });
    },

    trackStepAdvance: function (stepName, stepOrder) {
      const payload = Object.assign(buildBasePayload(), {
        event: 'step_advance',
        step_name: stepName,
        step_order: stepOrder
      });
      sendToSheets(payload);
      sendGA4Event('quiz_step_advance', { step_name: stepName, step_order: stepOrder });
    },

    trackFieldSubmit: function (stepName, stepOrder, fieldName, fieldValue) {
      const payload = Object.assign(buildBasePayload(), {
        event: 'field_submit',
        step_name: stepName,
        step_order: stepOrder,
        field_name: fieldName,
        field_value: fieldValue
      });
      sendToSheets(payload);
      // No GA4 mandamos só que o campo foi preenchido, sem o valor
      sendGA4Event('quiz_field_submit', { step_name: stepName, step_order: stepOrder, field_name: fieldName });
    },

    trackCtaClick: function (stepName, stepOrder) {
      const payload = Object.assign(buildBasePayload(), {
        event: 'cta_click',
        step_name: stepName,
        step_order: stepOrder
      });
      sendToSheets(payload);
      sendGA4Event('quiz_cta_click', { step_name: stepName, step_order: stepOrder });
      // Marca como lead qualificado no GA4 (útil pra otimizar campanhas de Ads)
      sendGA4Event('generate_lead', { step_name: stepName, step_order: stepOrder });
    }
  };

  loadGA4();
})();
