'use strict';

/* ================================================================
   THEME  —  persiste em localStorage, respeita preferência do SO
   ================================================================ */
(function () {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

window.addEventListener('DOMContentLoaded', () => {
  const btnTheme = document.getElementById('btnTheme');

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
  }

  btnTheme.addEventListener('click', () => {
    // Animate the button
    btnTheme.style.transform = 'rotate(360deg)';
    btnTheme.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)';
    setTimeout(() => { btnTheme.style.transform = ''; btnTheme.style.transition = ''; }, 460);

    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });
});

/* ================================================================
   INTRO
   ================================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Wipe animation: in at .1s, out at 1.1s → total ~1.6s
  // App fades in after wipe exits
  const intro = document.getElementById('intro');
  const app   = document.getElementById('app');

  setTimeout(() => {
    intro.classList.add('exit');
    app.classList.add('visible');
    setTimeout(() => { intro.style.display = 'none'; }, 420);
  }, 3700);
});

/* ================================================================
   UTILS
   ================================================================ */
const $    = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function isUrl(s) {
  try { return Boolean(new URL(s)); } catch { return false; }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n) {
  if (!n) return '';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

/* ================================================================
   STATE
   ================================================================ */
const S = {
  url:    '',
  mode:   'video',
  sel:    null,
  vFmts:  [],
  aFmts:  [],
};

/* ================================================================
   DOM REFS
   ================================================================ */
const urlInput      = $('urlInput');
const btnPaste      = $('btnPaste');
const btnFetch      = $('btnFetch');
const fetchTxt      = $('fetchTxt');
const fetchSpin     = $('fetchSpin');
const urlFeedback   = $('urlFeedback');
const urlFeedbackTxt= $('urlFeedbackTxt');

const secInfo       = $('secInfo');
const thumbImg      = $('thumbImg');
const thumbDur      = $('thumbDur');
const infoTitle     = $('infoTitle');
const infoTags      = $('infoTags');

const secFmt        = $('secFmt');
const modeToggle    = $('modeToggle');
const qWrap         = $('qWrap');
const btnDl         = $('btnDl');
const fmtFeedback   = $('fmtFeedback');

const secProg       = $('secProg');
const progTitle     = $('progTitle');
const progPct       = $('progPct');
const progBar       = $('progBar');
const statSpeed     = $('statSpeed');
const statSpeedVal  = $('statSpeedVal');
const statEta       = $('statEta');
const statEtaVal    = $('statEtaVal');
const statSize      = $('statSize');
const statSizeVal   = $('statSizeVal');

const stateDone     = $('stateDone');
const donePath      = $('donePath');
const btnNew        = $('btnNew');

const stateErr      = $('stateErr');
const errDetail     = $('errDetail');
const btnRetry      = $('btnRetry');

/* ================================================================
   PASTE
   ================================================================ */
btnPaste.addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      urlInput.value = t.trim();
      urlInput.classList.add('has-value');
      clearUrlFeedback();
    }
  } catch { urlInput.focus(); }
});

urlInput.addEventListener('input', () => {
  urlInput.classList.toggle('has-value', urlInput.value.length > 0);
  clearUrlFeedback();
});

/* ================================================================
   FETCH INFO
   ================================================================ */
btnFetch.addEventListener('click', fetchInfo);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchInfo(); });

function setFetchLoading(on) {
  btnFetch.disabled = on;
  on ? (hide(fetchTxt), show(fetchSpin)) : (show(fetchTxt), hide(fetchSpin));
}

function showUrlFeedback(msg) {
  urlFeedbackTxt.textContent = msg;
  show(urlFeedback);
}

function clearUrlFeedback() { hide(urlFeedback); }

async function fetchInfo() {
  const url = urlInput.value.trim();
  if (!url)        { showUrlFeedback('Cola ou escreve uma URL primeiro.'); return; }
  if (!isUrl(url)) { showUrlFeedback('URL invalida — verifica o formato (ex: https://...).'); return; }

  clearUrlFeedback();
  S.url = url;
  S.sel = null;

  // Collapse lower steps
  hide(secInfo); hide(secFmt); hide(secProg);
  hide(stateDone); hide(stateErr); hide(fmtFeedback);
  btnDl.disabled = true;

  setFetchLoading(true);

  try {
    const res  = await fetch('/api/info', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showUrlFeedback(data.error || 'Nao foi possivel obter informacoes do video.');
      return;
    }

    S.vFmts = data.video_formats || [];
    S.aFmts = data.audio_formats || [];

    // ── Populate info section ──
    infoTitle.textContent = data.title || 'Sem titulo';

    // Tags
    infoTags.innerHTML = '';
    if (data.platform) {
      const t = document.createElement('span');
      t.className = 'tag orange';
      t.textContent = data.platform;
      infoTags.appendChild(t);
    }
    if (data.uploader) {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = data.uploader;
      infoTags.appendChild(t);
    }
    if (data.duration) {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = data.duration;
      infoTags.appendChild(t);
    }
    if (data.view_count) {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = fmtNum(data.view_count) + ' views';
      infoTags.appendChild(t);
    }

    // Thumbnail
    if (data.thumbnail) {
      thumbImg.src = data.thumbnail;
      thumbImg.style.display = '';
    } else {
      thumbImg.style.display = 'none';
    }

    if (data.duration) { thumbDur.textContent = data.duration; show(thumbDur); }
    else { hide(thumbDur); }

    show(secInfo);
    show(secFmt);

    // Reset to video tab
    S.mode = 'video';
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === 'video')
    );
    renderFormats('video');

  } catch {
    showUrlFeedback('Erro de ligacao. Verifica se o servidor esta a correr.');
  } finally {
    setFetchLoading(false);
  }
}

/* ================================================================
   FORMAT GRID
   ================================================================ */
modeToggle.addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if (!btn || btn.dataset.mode === S.mode) return;
  S.mode = btn.dataset.mode;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === S.mode)
  );
  renderFormats(S.mode);
});

function renderFormats(mode) {
  const fmts = mode === 'video' ? S.vFmts : S.aFmts;
  qWrap.innerHTML = '';
  S.sel = null;
  btnDl.disabled = true;
  hide(fmtFeedback);

  fmts.forEach((fmt, i) => {
    const btn = document.createElement('button');
    btn.className = 'q-btn';
    btn.type = 'button';

    const ext = fmt.ext || (mode === 'audio' ? 'mp3' : 'mp4');

    btn.innerHTML = `
      <span class="q-name">${esc(fmt.label)}</span>
      <span class="q-ext">${esc(ext)}</span>
      ${fmt.filesize ? `<span class="q-size">${esc(fmt.filesize)}</span>` : ''}
      <span class="q-check" aria-hidden="true">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="3.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </span>
    `;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.sel = fmt;
      btnDl.disabled = false;
      hide(fmtFeedback);
    });

    qWrap.appendChild(btn);

    // Stagger entrance animation
    requestAnimationFrame(() =>
      setTimeout(() => btn.classList.add('in'), i * 28)
    );
  });
}

/* ================================================================
   DOWNLOAD BUTTON — with hint if no format selected
   ================================================================ */
btnDl.addEventListener('click', () => {
  if (!S.sel) {
    show(fmtFeedback);
    return;
  }
  startDownload();
});

async function startDownload() {
  show(secProg);
  hide(stateDone);
  hide(stateErr);
  setProg(0, 'A iniciar...');
  hide(statSpeed); hide(statEta); hide(statSize);
  btnDl.disabled = true;

  try {
    const res  = await fetch('/api/download', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        url:       S.url,
        format_id: S.sel.format_id,
        mode:      S.mode,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showErr(data.error || 'Erro ao iniciar o download.');
      return;
    }

    listenSSE(data.session_id);

  } catch {
    showErr('Erro de ligacao ao servidor.');
  }
}

/* ================================================================
   SSE PROGRESS
   ================================================================ */
function listenSSE(sid) {
  const es = new EventSource(`/api/progress/${sid}`);

  es.onmessage = ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {

      case 'progress': {
        setProg(msg.pct, 'A baixar...');

        if (msg.speed) {
          statSpeedVal.textContent = msg.speed;
          show(statSpeed);
        }
        if (msg.eta) {
          statEtaVal.textContent = msg.eta;
          show(statEta);
        }
        if (msg.downloaded && msg.total) {
          statSizeVal.textContent = `${msg.downloaded} / ${msg.total}`;
          show(statSize);
        }
        break;
      }

      case 'processing': {
        setProg(100, 'A processar ficheiro...');
        hide(statSpeed); hide(statEta);
        statSizeVal.textContent = 'A converter...';
        show(statSize);
        break;
      }

      case 'done': {
        es.close();
        setProg(100, 'Concluido');
        setTimeout(() => {
          show(stateDone);
          donePath.textContent = msg.out_dir
            ? `Guardado em: ${msg.out_dir}`
            : 'Ficheiro guardado na pasta Downloads.';
          btnDl.disabled = false;
        }, 300);
        break;
      }

      case 'error': {
        es.close();
        showErr(msg.message || 'Erro desconhecido.');
        btnDl.disabled = false;
        break;
      }
    }
  };

  es.onerror = () => {
    es.close();
    showErr('Ligacao perdida com o servidor. Tenta novamente.');
    btnDl.disabled = false;
  };
}

function setProg(pct, label) {
  const p = Math.min(100, Math.max(0, pct));
  progBar.style.width   = p + '%';
  progPct.textContent   = Math.round(p) + '%';
  progTitle.textContent = label;
}

function showErr(msg) {
  show(stateErr);
  errDetail.textContent = msg;
}

/* ================================================================
   RESET / RETRY
   ================================================================ */
btnNew.addEventListener('click', resetAll);

btnRetry.addEventListener('click', () => {
  hide(stateErr);
  startDownload();
});

function resetAll() {
  urlInput.value = '';
  urlInput.classList.remove('has-value');
  S.url = ''; S.sel = null;
  hide(secInfo); hide(secFmt); hide(secProg);
  hide(stateDone); hide(stateErr); hide(fmtFeedback);
  clearUrlFeedback();
  btnDl.disabled = true;
  setProg(0, '');
  urlInput.focus();
}
