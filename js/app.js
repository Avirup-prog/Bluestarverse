// ============================================================
//  BLUESTAR — MAIN APP  v5
//  Tonight's poem · Constellation · Animated reveal ·
//  Leave a note · Likes · Share · Mobile · Auth fix
// ============================================================

var works = [];  // loaded from Supabase on boot
var SECRET_PASSWORD = "bluestar2026"; // ← Change before deploying!
var authed      = false;
var curWork     = null;
var curLang     = 'en';
var loginLocked = false;
var months      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── TONIGHT'S POEM ──────────────────────────────────────────
// Picks deterministically — changes every day at 6 PM IST (UTC+5:30 = 12:30 UTC)
function getISTDate() {
  var now = new Date();
  // IST is UTC+5:30. Shift current UTC time by +5h30m, then subtract 18h (6 PM)
  // so the "day" rolls over at 6 PM IST instead of midnight
  var istOffset = 5.5 * 60 * 60 * 1000;      // IST ahead of UTC in ms
  var sixPmOffset = 18 * 60 * 60 * 1000;      // 18 hours in ms
  var shifted = new Date(now.getTime() + istOffset - sixPmOffset);
  return shifted;
}
function getTonightIndex() {
  var d = getISTDate();
  var seed = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return seed % works.length;
}

function initTonightPoem() {
  if (!works.length) return;
  var w = works[getTonightIndex()];
  document.getElementById('featuredTitle').textContent = w.title;
  document.getElementById('featuredDate').textContent = w.date;
  document.getElementById('pillType').textContent = w.type;
  document.getElementById('pillLang').textContent = w.lang === 'hi' ? 'हिंदी' : 'English';

  // Show first 5 lines as preview
  var lines = w.content.split('\n').filter(function(l) { return l.trim() !== ''; }).slice(0, 5);
  var preview = document.getElementById('featuredPoem');
  preview.innerHTML = '';
  lines.forEach(function(line, i) {
    var span = document.createElement('span');
    span.style.cssText = 'display:block;opacity:0;transform:translateY(8px);transition:opacity 0.5s ease ' + (i * 0.18 + 0.3) + 's,transform 0.5s ease ' + (i * 0.18 + 0.3) + 's;';
    if (w.lang === 'hi') span.style.fontFamily = 'var(--font-hindi)';
    span.textContent = line;
    preview.appendChild(span);
  });
  setTimeout(function() {
    preview.querySelectorAll('span').forEach(function(s) {
      s.style.opacity = '1'; s.style.transform = 'translateY(0)';
    });
  }, 600);
}

function openTonightModal() {
  if (!works.length) return;
  openModal(works[getTonightIndex()]);
}

// Midnight countdown
function updateCountdown() {
  var now = new Date();
  // Next 6 PM IST = UTC 12:30. Find the next 12:30 UTC from now.
  var next = new Date(now);
  next.setUTCHours(12, 30, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1); // already past today's 6 PM IST
  var diff = Math.floor((next - now) / 1000);
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  var s = diff % 60;
  var el = document.getElementById('countdownTime');
  if (el) el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
}
function pad(n) { return String(n).padStart(2, '0'); }
setInterval(updateCountdown, 1000);
updateCountdown();

// ── CONSTELLATION MAP ────────────────────────────────────────
var constInited   = false;
var constHover    = -1;
var constAnimFrame = null;
var constBgStars  = [];
var constTick     = 0;
var constW = 0, constH = 0;

function getConstColor(w) {
  if (w.lang === 'hi') return '#f472b6';
  if (w.type === 'story' || w.type === 'blog') return '#a78bfa';
  return '#82bcff';
}

// Lay stars out in a stable grid-jitter pattern based on index
// so the map is consistent and looks like a real constellation
function getConstPos(i, total, W, H) {
  var cols = Math.ceil(Math.sqrt(total * 1.6));
  var rows = Math.ceil(total / cols);
  var col  = i % cols;
  var row  = Math.floor(i / cols);
  var jx   = (Math.sin(i * 7.3) * 0.35 + Math.sin(i * 2.1) * 0.2) * (W / cols);
  var jy   = (Math.cos(i * 5.7) * 0.35 + Math.cos(i * 3.4) * 0.2) * (H / rows);
  var px   = 0.1 * W + (col + 0.5) * (W * 0.82 / cols) + jx;
  var py   = 0.1 * H + (row + 0.5) * (H * 0.8 / rows) + jy;
  return { x: Math.min(Math.max(px, 24), W - 24), y: Math.min(Math.max(py, 24), H - 24) };
}

// Build constellation lines connecting nearby stars
function buildConstLines(positions) {
  var lines = [];
  for (var i = 0; i < positions.length; i++) {
    var nearest = [];
    for (var j = 0; j < positions.length; j++) {
      if (i === j) continue;
      var dx = positions[i].x - positions[j].x;
      var dy = positions[i].y - positions[j].y;
      nearest.push({ j: j, d: Math.sqrt(dx * dx + dy * dy) });
    }
    nearest.sort(function(a, b) { return a.d - b.d; });
    var connected = 0;
    for (var k = 0; k < nearest.length && connected < 2; k++) {
      var already = lines.some(function(l) {
        return (l[0] === i && l[1] === nearest[k].j) || (l[0] === nearest[k].j && l[1] === i);
      });
      if (!already && nearest[k].d < constW * 0.38) {
        lines.push([i, nearest[k].j]);
        connected++;
      }
    }
  }
  return lines;
}

function initConstellation() {
  if (constInited) { redrawConstellation(); return; }
  constInited = true;

  var canvas  = document.getElementById('constCanvas');
  if (!canvas) return;
  var wrap    = canvas.parentElement;
  var ctx     = canvas.getContext('2d');
  var tooltip = document.getElementById('constTooltip');

  function resize() {
    constW = wrap.offsetWidth;
    constH = canvas.offsetHeight || 320;
    canvas.width  = constW;
    canvas.height = constH;
    constBgStars = [];
    for (var i = 0; i < 90; i++) {
      constBgStars.push({
        x: Math.random() * constW, y: Math.random() * constH,
        r: Math.random() * 0.9 + 0.15, a: Math.random() * 0.35 + 0.08,
        phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.016 + 0.004
      });
    }
  }
  resize();
  window.addEventListener('resize', function() { resize(); });

  function drawFrame() {
    constTick++;
    ctx.clearRect(0, 0, constW, constH);
    ctx.fillStyle = '#07091c';
    ctx.fillRect(0, 0, constW, constH);

    // Background twinkle stars
    constBgStars.forEach(function(s) {
      var tw = 0.5 + 0.5 * Math.sin(constTick * s.speed + s.phase);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180,210,255,' + (s.a * tw) + ')'; ctx.fill();
    });

    if (!works.length) { constAnimFrame = requestAnimationFrame(drawFrame); return; }

    var positions = works.map(function(w, i) { return getConstPos(i, works.length, constW, constH); });
    var lines = buildConstLines(positions);

    // Draw constellation lines
    lines.forEach(function(pair) {
      var a = positions[pair[0]], b = positions[pair[1]];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(77,130,220,0.18)'; ctx.lineWidth = 0.8; ctx.stroke();
    });

    // Draw stars
    works.forEach(function(w, i) {
      var p   = positions[i];
      var col = getConstColor(w);
      var r   = Math.max(4, Math.min(8, 4 + w.title.length * 0.12));
      var isHov = i === constHover;
      var glowA = 0.15 + 0.1 * Math.sin(constTick * 0.022 + i * 0.8);

      // Outer glow
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (isHov ? 4 : 2.8), 0, Math.PI * 2);
      ctx.fillStyle = col.replace(')', ',' + (glowA * (isHov ? 2.5 : 1)) + ')').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba(');

      // Use proper rgba for each color
      var glowColor = col === '#82bcff' ? 'rgba(130,188,255,' : col === '#a78bfa' ? 'rgba(167,139,250,' : 'rgba(244,114,182,';
      ctx.fillStyle = glowColor + (glowA * (isHov ? 2.2 : 1)) + ')'; ctx.fill();

      // Hover ring
      if (isHov) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
        ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.4;
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // Star body
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (isHov ? 1.5 : 1), 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.globalAlpha = isHov ? 1 : 0.78; ctx.fill(); ctx.globalAlpha = 1;

      // Label on hover
      if (isHov) {
        var label = w.title.length > 20 ? w.title.substring(0, 18) + '…' : w.title;
        ctx.font = '500 11px Outfit,sans-serif';
        ctx.textAlign = 'center';
        var textY = p.y + r * 1.5 + 15;
        if (textY > constH - 10) textY = p.y - r * 1.5 - 6;
        ctx.fillStyle = 'rgba(220,235,255,0.9)'; ctx.fillText(label, p.x, textY);
      }
    });
    constAnimFrame = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  function getHit(mx, my) {
    if (!works.length) return -1;
    for (var i = 0; i < works.length; i++) {
      var p  = getConstPos(i, works.length, constW, constH);
      var r  = Math.max(4, Math.min(8, 4 + works[i].title.length * 0.12));
      var dx = mx - p.x, dy = my - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < r * 2.8) return i;
    }
    return -1;
  }

  function showConstTooltip(i, mx, my) {
    var w = works[i];
    document.getElementById('ttTag').textContent  = w.type + ' · ' + (w.lang === 'hi' ? 'हिंदी' : 'EN');
    document.getElementById('ttTitle').textContent = w.title;
    document.getElementById('ttMeta').textContent  = w.date;
    var tx = mx + 14, ty = my - 36;
    if (tx + 196 > constW) tx = mx - 196 - 10;
    if (ty < 4) ty = my + 14;
    tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px';
    tooltip.style.opacity = '1';
  }

  function updateConstSelected(i) {
    var sel = document.getElementById('constSelected');
    if (i === -1) {
      sel.innerHTML = '<div class="const-sel-empty">&#10022; hover a star to preview</div>';
      return;
    }
    var w = works[i];
    var col = getConstColor(w);
    var ll  = w.lang === 'hi' ? 'हिंदी' : 'EN';
    sel.innerHTML =
      '<div class="const-sel-content">' +
        '<div class="const-sel-icon" style="color:' + col + '">&#9733;</div>' +
        '<div class="const-sel-info">' +
          '<div class="const-sel-tag">' + w.type + ' &middot; ' + ll + '</div>' +
          '<div class="const-sel-title">' + w.title + '</div>' +
          '<div class="const-sel-excerpt">' + w.excerpt + '</div>' +
        '</div>' +
        '<button class="const-sel-open" onclick="openModal(works[' + i + '])">Read &rarr;</button>' +
      '</div>';
  }

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var hit = getHit(mx, my);
    constHover = hit;
    canvas.style.cursor = hit > -1 ? 'pointer' : 'crosshair';
    if (hit > -1) { showConstTooltip(hit, mx, my); updateConstSelected(hit); }
    else { tooltip.style.opacity = '0'; }
  });
  canvas.addEventListener('mouseleave', function() {
    constHover = -1; tooltip.style.opacity = '0';
    updateConstSelected(-1);
  });
  canvas.addEventListener('click', function(e) {
    var rect = canvas.getBoundingClientRect();
    var hit  = getHit(e.clientX - rect.left, e.clientY - rect.top);
    if (hit > -1) openModal(works[hit]);
  });

  // Touch support
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.touches[0];
    var hit = getHit(t.clientX - rect.left, t.clientY - rect.top);
    constHover = hit;
    if (hit > -1) { showConstTooltip(hit, t.clientX - rect.left, t.clientY - rect.top); updateConstSelected(hit); }
  }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.changedTouches[0];
    var hit = getHit(t.clientX - rect.left, t.clientY - rect.top);
    if (hit > -1) openModal(works[hit]);
    constHover = -1; tooltip.style.opacity = '0';
  }, { passive: false });
}

function redrawConstellation() {
  // Called after publish/delete — just clears selection
  var sel = document.getElementById('constSelected');
  if (sel) sel.innerHTML = '<div class="const-sel-empty">&#10022; hover a star to preview</div>';
}

// ── LIKES ────────────────────────────────────────────────────
function getLikes() {
  try { return JSON.parse(localStorage.getItem('bluestar_likes') || '{}'); } catch(e) { return {}; }
}
function saveLikes(obj) { try { localStorage.setItem('bluestar_likes', JSON.stringify(obj)); } catch(e) {} }
function getLikeCount(title) { return getLikes()[title] || 0; }
function hasLiked(title) {
  try { var s = JSON.parse(localStorage.getItem('bluestar_liked') || '[]'); return s.indexOf(title) > -1; }
  catch(e) { return false; }
}
function setLiked(title, val) {
  try {
    var s = JSON.parse(localStorage.getItem('bluestar_liked') || '[]');
    if (val && s.indexOf(title) === -1) s.push(title);
    if (!val) s = s.filter(function(t) { return t !== title; });
    localStorage.setItem('bluestar_liked', JSON.stringify(s));
  } catch(e) {}
}
function toggleLike() {
  if (!curWork) return;
  var title = curWork.title;
  var likes = getLikes(); var liked = hasLiked(title);
  var btn = document.getElementById('modalLikeBtn');
  var countEl = document.getElementById('likeCount');
  if (liked) {
    likes[title] = Math.max(0, (likes[title] || 1) - 1);
    setLiked(title, false); btn.classList.remove('liked');
    var hi = btn.querySelector('.heart-icon');
    if (hi) { hi.style.fill = 'none'; hi.style.stroke = 'currentColor'; }
  } else {
    likes[title] = (likes[title] || 0) + 1;
    setLiked(title, true); btn.classList.add('liked');
    var hi2 = btn.querySelector('.heart-icon');
    if (hi2) { hi2.style.fill = 'var(--like)'; hi2.style.stroke = 'var(--like)'; }
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    setTimeout(function() { btn.classList.remove('pop'); }, 400);
  }
  saveLikes(likes); countEl.textContent = likes[title] || 0;
}

// ── SHARE ────────────────────────────────────────────────────
function shareWork() {
  if (!curWork) return;
  var text = '"' + curWork.title + '" — a poem by Bluestar\n\n' + curWork.content.substring(0, 120) + '...';
  var url  = window.location.href;
  if (navigator.share) { navigator.share({ title: curWork.title, text: text, url: url }).catch(function(){}); return; }
  buildShareSheet(curWork.title, text, url);
  document.getElementById('shareSheetBg').classList.add('open');
}
function buildShareSheet(title, text, url) {
  var enc = encodeURIComponent(text + '\n' + url);
  var links = [
    { label:'WhatsApp', href:'https://wa.me/?text='+enc, svg:'<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.054 23.95l6.266-1.645A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.862 9.862 0 01-5.031-1.374l-.361-.214-3.741.981.999-3.648-.235-.374A9.861 9.861 0 012.1 12C2.1 6.534 6.534 2.1 12 2.1c5.467 0 9.9 4.434 9.9 9.9 0 5.467-4.433 9.9-9.9 9.9z"/></svg>' },
    { label:'Twitter',  href:'https://twitter.com/intent/tweet?text='+enc, svg:'<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    { label:'Telegram', href:'https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text), svg:'<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>' },
    { label:'Instagram',href:'https://instagram.com', svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg>' }
  ];
  var container = document.getElementById('shareLinks');
  container.innerHTML = '';
  links.forEach(function(l) {
    var a = document.createElement('a');
    a.className = 'share-link'; a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = l.svg + '<span>' + l.label + '</span>';
    container.appendChild(a);
  });
}
function closeShareSheet() { document.getElementById('shareSheetBg').classList.remove('open'); }
function copyLink() {
  var btn = document.getElementById('shareCopyBtn');
  var url = window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy link'; }, 2000); });
  } else {
    var ta = document.createElement('textarea'); ta.value = url;
    ta.style.cssText = 'position:fixed;opacity:0;'; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy link'; }, 2000);
  }
}

// ── LEAVE A NOTE ─────────────────────────────────────────────
function getNotes(title) {
  try { return JSON.parse(localStorage.getItem('notes_' + title) || '[]'); } catch(e) { return []; }
}
function saveNotes(title, arr) {
  try { localStorage.setItem('notes_' + title, JSON.stringify(arr.slice(0, 30))); } catch(e) {}
}
function renderNotes(title) {
  var list = document.getElementById('notesList'); if (!list) return;
  var notes = getNotes(title);
  list.innerHTML = '';
  if (!notes.length) {
    list.innerHTML = '<p class="notes-empty">No notes yet. Be the first to leave one.</p>'; return;
  }
  notes.slice(0, 8).forEach(function(n, i) {
    var item = document.createElement('div');
    item.className = 'note-item';
    item.style.animationDelay = (i * 60) + 'ms';
    item.innerHTML = '<div class="note-item-text">"' + escHtml(n.text) + '"</div><div class="note-item-meta">a reader &middot; ' + n.time + '</div>';
    list.appendChild(item);
  });
}
function updateNoteCount() {
  var inp = document.getElementById('noteInput'); if (!inp) return;
  var left = 80 - inp.value.length;
  var el   = document.getElementById('noteCount'); if (!el) return;
  el.textContent = left + ' left';
  el.classList.toggle('warn', left < 20);
}
function sendNote() {
  if (!curWork) return;
  var inp = document.getElementById('noteInput'); if (!inp) return;
  var val = inp.value.trim();
  if (!val) return;
  var notes = getNotes(curWork.title);
  var timeStr = timeAgo(new Date());
  notes.unshift({ text: val, time: timeStr });
  saveNotes(curWork.title, notes);
  inp.value = ''; document.getElementById('noteCount').textContent = '80 left';
  renderNotes(curWork.title);
  showToast('Note sent ✦');
}
function timeAgo(d) {
  var now  = new Date(); var diff = Math.floor((now - d) / 1000);
  if (diff < 5)   return 'just now';
  if (diff < 60)  return diff + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  return months[d.getMonth()] + ' ' + d.getDate();
}
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── CANVAS — SHOOTING STARS ───────────────────────────────────
(function initCanvas() {
  var canvas = document.getElementById('bgCanvas'); if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, stars = [], nebulas = [], shoots = [], tick = 0;
  function resize() {
    W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight;
    stars = [];
    var n = Math.floor(W * H / 5800);
    for (var i = 0; i < n; i++) stars.push({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.5+0.2, baseA:Math.random()*0.55+0.2, phase:Math.random()*Math.PI*2, speed:Math.random()*0.02+0.005, vx:(Math.random()-0.5)*0.04, vy:(Math.random()-0.5)*0.02, bright:Math.random()<0.07 });
  }
  window.addEventListener('resize', resize); resize();
  for (var j = 0; j < 6; j++) nebulas.push({ x:Math.random()*1400, y:Math.random()*900, r:Math.random()*260+100, hue:205+Math.random()*50, alpha:Math.random()*0.032+0.007, vx:(Math.random()-0.5)*0.1, vy:(Math.random()-0.5)*0.05 });
  function spawnShoot() {
    var a = (Math.random()*28+18)*Math.PI/180;
    shoots.push({ x:Math.random()*W*0.85+W*0.05, y:Math.random()*H*0.38, vx:Math.cos(a)*(Math.random()*7+5), vy:Math.sin(a)*(Math.random()*7+5), alpha:1, fade:Math.random()*0.013+0.008, width:Math.random()*1.4+0.5, trail:[] });
  }
  function scheduleShoot() { var d=Math.random()*3800+1000; setTimeout(function(){ spawnShoot(); if(Math.random()<0.22) setTimeout(spawnShoot,Math.random()*350+80); scheduleShoot(); }, d); }
  scheduleShoot();
  function draw() {
    ctx.clearRect(0,0,W,H); tick++;
    nebulas.forEach(function(n){ n.x+=n.vx; n.y+=n.vy; if(n.x>W+n.r)n.x=-n.r; if(n.x<-n.r)n.x=W+n.r; if(n.y>H+n.r)n.y=-n.r; if(n.y<-n.r)n.y=H+n.r; var g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r); g.addColorStop(0,'hsla('+n.hue+',75%,55%,'+n.alpha+')'); g.addColorStop(1,'transparent'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2); ctx.fill(); });
    stars.forEach(function(s){ s.x+=s.vx; s.y+=s.vy; if(s.x>W+2)s.x=-2; if(s.x<-2)s.x=W+2; if(s.y>H+2)s.y=-2; if(s.y<-2)s.y=H+2; var tw=0.5+0.5*Math.sin(tick*s.speed+s.phase); var a=s.baseA*(0.35+0.65*tw); if(s.bright){ctx.beginPath();ctx.arc(s.x,s.y,s.r*3.5,0,Math.PI*2);ctx.fillStyle='rgba(180,220,255,'+(a*0.14*(0.5+0.5*Math.sin(tick*s.speed*0.6+s.phase)))+')';ctx.fill();} ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle='rgba(200,225,255,'+a+')';ctx.fill(); });
    for(var i=shoots.length-1;i>=0;i--){ var ss=shoots[i]; ss.trail.push({x:ss.x,y:ss.y}); if(ss.trail.length>30)ss.trail.shift(); ss.x+=ss.vx;ss.y+=ss.vy;ss.alpha-=ss.fade; if(ss.alpha<=0||ss.x>W+60||ss.y>H+60){shoots.splice(i,1);continue;} if(ss.trail.length>1){for(var t=1;t<ss.trail.length;t++){var prog=t/ss.trail.length;ctx.beginPath();ctx.moveTo(ss.trail[t-1].x,ss.trail[t-1].y);ctx.lineTo(ss.trail[t].x,ss.trail[t].y);ctx.strokeStyle='rgba(180,220,255,'+(ss.alpha*prog*0.65)+')';ctx.lineWidth=ss.width*prog;ctx.lineCap='round';ctx.stroke();}} var hg=ctx.createRadialGradient(ss.x,ss.y,0,ss.x,ss.y,ss.width*5);hg.addColorStop(0,'rgba(255,255,255,'+ss.alpha+')');hg.addColorStop(0.4,'rgba(180,220,255,'+(ss.alpha*0.55)+')');hg.addColorStop(1,'transparent');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(ss.x,ss.y,ss.width*5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(ss.x,ss.y,ss.width*0.7,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,'+ss.alpha+')';ctx.fill(); }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── CURSOR ───────────────────────────────────────────────────
(function initCursor() {
  var cur = document.getElementById('cursor'); var trail = document.getElementById('cursor-trail');
  if (!cur || !trail) return;
  var mx=0,my=0,tx=0,ty=0;
  document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;cur.style.left=mx+'px';cur.style.top=my+'px';});
  function animTrail(){tx+=(mx-tx)*0.13;ty+=(my-ty)*0.13;trail.style.left=tx+'px';trail.style.top=ty+'px';requestAnimationFrame(animTrail);}
  animTrail();
  document.addEventListener('mouseleave',function(){cur.style.opacity='0';trail.style.opacity='0';});
  document.addEventListener('mouseenter',function(){cur.style.opacity='1';trail.style.opacity='1';});
})();

// ── LOADER ───────────────────────────────────────────────────
window.addEventListener('load', function() {
  // Load works from Supabase, seed if empty, then boot the UI
  db.seedIfEmpty(seedWorks).then(function() {
    return db.loadWorks();
  }).then(function(loaded) {
    works = loaded;
    setTimeout(function() {
      document.getElementById('loader').classList.add('hidden');
      updateStats(); renderRecentStrip(); initTonightPoem(); initScrollReveal(); setTimeout(initConstellation, 300);
    }, 2000);
  }).catch(function(err) {
    console.error('Boot error:', err);
    // Fall back to seed works so site is never blank
    works = seedWorks.slice();
    setTimeout(function() {
      document.getElementById('loader').classList.add('hidden');
      updateStats(); renderRecentStrip(); initTonightPoem(); initScrollReveal(); setTimeout(initConstellation, 300);
    }, 2000);
  });
});

// ── SCROLL REVEAL ────────────────────────────────────────────
function initScrollReveal() {
  var els = document.querySelectorAll('.scroll-reveal:not(.visible)');
  if (!els.length || !window.IntersectionObserver) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(function(el) { obs.observe(el); });
}

// ── NAV ───────────────────────────────────────────────────────
window.addEventListener('scroll', function() {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
});
function toggleMobileMenu() {
  var m=document.getElementById('mobileMenu'); var h=document.getElementById('hamburger');
  var open=m.classList.toggle('open'); h.classList.toggle('open',open);
}
function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── SECTION NAVIGATION ───────────────────────────────────────
function showSection(id) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var target=document.getElementById(id); if(!target) return;
  target.classList.add('active');
  target.querySelectorAll('.reveal-up,.reveal-left,.reveal-right').forEach(function(el){
    el.style.opacity='1'; el.style.transform='none'; el.style.animation='none';
  });
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.toggle('active',b.dataset.section===id);});
  window.scrollTo({top:0,behavior:'smooth'});
  if (id==='works') renderWorksGrid('all');
  if (id==='home')  { renderRecentStrip(); updateStats(); initTonightPoem(); setTimeout(initConstellation, 200); }
  if (id==='about') updateStats();
  if (id==='write') renderPubList();
  setTimeout(initScrollReveal, 80);
}
function showWrite() {
  closeMobileMenu();
  if (authed) showSection('write');
  else { showSection('auth'); setTimeout(function(){var i=document.getElementById('passInput');if(i)i.focus();},300); }
}

// ── AUTH ──────────────────────────────────────────────────────
function tryLogin() {
  if (loginLocked) return;
  var inp=document.getElementById('passInput'); var val=inp.value;
  var err=document.getElementById('authErr'); var btn=document.querySelector('.auth-box .btn-primary');
  if (!val.trim()) { err.textContent='Please enter your password.'; err.style.display='block'; inp.focus(); return; }
  if (val === SECRET_PASSWORD) {
    authed=true; inp.value=''; err.style.display='none'; showSection('write');
  } else {
    err.textContent='Wrong password. Please try again.'; err.style.display='block'; inp.value='';
    loginLocked=true;
    if(btn){btn.textContent='Try again...';btn.style.opacity='0.6';}
    var box=document.querySelector('.auth-box'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    setTimeout(function(){loginLocked=false;if(btn){btn.textContent='Enter \u2192';btn.style.opacity='1';}inp.focus();},1000);
  }
}
function logout() { authed=false; showSection('home'); showToast('Writing space locked \u2726'); }

// ── WORKS RENDERING ───────────────────────────────────────────
function renderWorksGrid(filter) {
  var grid=document.getElementById('worksGrid'); if(!grid) return;
  grid.innerHTML='';
  var filtered=works.filter(function(w){ if(filter==='all')return true; if(filter==='hi')return w.lang==='hi'; return w.type===filter; });
  if(!filtered.length){grid.innerHTML='<p style="color:var(--muted);font-size:0.9rem;padding:2rem 0;grid-column:1/-1;">No works yet in this category.</p>';return;}
  filtered.forEach(function(w,i){grid.appendChild(makeWorkCard(w,i*55));});
  setTimeout(initScrollReveal,50);
}
function renderRecentStrip() {
  var strip=document.getElementById('recentStrip'); if(!strip) return;
  strip.innerHTML='';
  works.slice(0,3).forEach(function(w,i){strip.appendChild(makeWorkCard(w,i*75));});
  setTimeout(initScrollReveal,50);
}
function makeWorkCard(w, delay) {
  var card=document.createElement('div');
  card.className='wcard scroll-reveal'+(w.lang==='hi'?' hindi':'');
  card.style.transitionDelay=(delay/2)+'ms';
  var ll=w.lang==='hi'?'\u0939\u093f\u0902\u0926\u0940':'EN';
  var likes=getLikeCount(w.title);
  card.innerHTML='<div class="wcard-tag">'+w.type+'</div><div class="wcard-title">'+w.title+'</div><div class="wcard-excerpt">'+w.excerpt+'</div><div class="wcard-foot"><span class="wcard-date">'+w.date+'</span><div class="wcard-right">'+(likes>0?'<span style="font-size:0.65rem;color:var(--like);">\u2665 '+likes+'</span>':'')+'<span class="wcard-lang">'+ll+'</span><span class="wcard-open">Read \u2192</span></div></div>';
  card.addEventListener('click',function(){openModal(w);});
  return card;
}
function filterWorks(filter,btn){
  document.querySelectorAll('.filt').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); renderWorksGrid(filter);
}

// ── MODAL & ANIMATED REVEAL ───────────────────────────────────
var revealTimer = null;
function openModal(w) {
  curWork = w;
  var isHindi = w.lang === 'hi';
  document.getElementById('mTag').textContent = w.type + (isHindi ? ' · हिंदी' : ' · English');
  document.getElementById('mTitle').textContent = w.title;
  document.getElementById('mMeta').textContent = w.date;

  // ── ANIMATED REVEAL: build lines ──
  var mc = document.getElementById('mContent');
  mc.className = 'modal-content' + (isHindi ? ' hindi' : '');
  mc.innerHTML = '';
  clearTimeout(revealTimer);

  var rawLines = w.content.split('\n');
  rawLines.forEach(function(line) {
    var span = document.createElement('span');
    if (line.trim() === '') {
      span.className = 'rline blank';
    } else {
      span.className = 'rline';
      span.textContent = line;
    }
    mc.appendChild(span);
  });

  // Stagger each line in
  mc.querySelectorAll('.rline:not(.blank)').forEach(function(el, i) {
    revealTimer = setTimeout(function() { el.classList.add('visible'); }, 120 + i * 220);
  });
  // Blank lines appear immediately
  mc.querySelectorAll('.rline.blank').forEach(function(el) { el.classList.add('visible'); });

  // Like state
  var liked = hasLiked(w.title); var lc = getLikeCount(w.title);
  var btn = document.getElementById('modalLikeBtn');
  btn.classList.toggle('liked', liked);
  var hi = btn.querySelector('.heart-icon');
  if (hi) { hi.style.fill = liked ? 'var(--like)' : 'none'; hi.style.stroke = liked ? 'var(--like)' : 'currentColor'; }
  document.getElementById('likeCount').textContent = lc;

  // Notes
  renderNotes(w.title);
  var ni = document.getElementById('noteInput'); if (ni) ni.value = '';
  var nc = document.getElementById('noteCount'); if (nc) nc.textContent = '80 left';

  document.getElementById('modalBg').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  clearTimeout(revealTimer);
  document.getElementById('modalBg').classList.remove('open');
  document.body.style.overflow = '';
  if (document.getElementById('home').classList.contains('active')) { renderRecentStrip(); }
  if (document.getElementById('works').classList.contains('active')) { var af=document.querySelector('.filt.active'); renderWorksGrid(af?af.textContent.trim().toLowerCase():'all'); }
  curWork = null;
}
document.getElementById('modalBg').addEventListener('click',function(e){if(e.target===this)closeModal();});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeModal();closeShareSheet();}
  if(e.key==='Enter'&&document.getElementById('auth').classList.contains('active'))tryLogin();
});

// ── WRITE / EDITOR ────────────────────────────────────────────
function setLang(lang){
  curLang=lang;
  var ta=document.getElementById('contentIn'); var tit=document.getElementById('titleIn');
  if(lang==='hi'){ta.className='content-in hi-mode';ta.placeholder='\u092F\u0939\u093E\u0901 \u0932\u093F\u0916\u094B...\n\n\u0939\u0930 \u0936\u092C\u094D\u0926 \u092F\u0939\u093E\u0901 \u0915\u093E \u0939\u0948\u0964';tit.style.fontFamily='var(--font-hindi)';document.getElementById('ltog-hi').classList.add('active');document.getElementById('ltog-en').classList.remove('active');}
  else{ta.className='content-in en-mode';ta.placeholder='Write freely...\n\nEvery word belongs here.';tit.style.fontFamily='var(--font-display)';document.getElementById('ltog-en').classList.add('active');document.getElementById('ltog-hi').classList.remove('active');}
}
document.getElementById('contentIn').addEventListener('input',function(){
  var wc=this.value.trim().split(/\s+/).filter(function(w){return w.length>0;}).length;
  document.getElementById('wcount').textContent=wc+' word'+(wc!==1?'s':'');
});
function publish(){
  var title=document.getElementById('titleIn').value.trim();
  var content=document.getElementById('contentIn').value.trim();
  var type=document.getElementById('wType').value;
  if(!title||!content){showToast('Add a title and some content first.');return;}
  var d=new Date(); var ds=months[d.getMonth()]+' '+d.getFullYear();
  var newWork={title:title,type:type,lang:curLang,date:ds,excerpt:content.substring(0,88)+(content.length>88?'...':''),content:content};

  // Show saving state
  var btn=document.querySelector('.editor-foot .btn-primary');
  if(btn){btn.textContent='Saving...';btn.style.opacity='0.7';}

  db.saveWork(newWork).then(function(saved){
    if(saved){
      works.unshift(saved); // saved has the db id attached
    } else {
      works.unshift(newWork); // offline fallback
    }
    document.getElementById('titleIn').value='';
    document.getElementById('contentIn').value='';
    document.getElementById('wcount').textContent='0 words';
    if(btn){btn.textContent='Publish \u2726';btn.style.opacity='1';}
    renderPubList(); updateStats(); renderRecentStrip();
    redrawConstellation();
    showToast('Published \u2726');
  }).catch(function(err){
    console.error('publish error',err);
    if(btn){btn.textContent='Publish \u2726';btn.style.opacity='1';}
    showToast('Could not save. Check your connection.');
  });
}
function renderPubList(){
  var list=document.getElementById('pubList'); if(!list)return;
  list.innerHTML='';
  works.forEach(function(w,i){
    var item=document.createElement('div'); item.className='pli';
    var ll=w.lang==='hi'?'\u0939\u093f\u0902\u0926\u0940':'EN';
    item.innerHTML='<div class="pli-title">'+w.title+'</div><div class="pli-right"><span class="pli-lang">'+ll+'</span><span class="pli-badge">'+w.type+'</span><span class="pli-date">'+w.date+'</span><button class="del-btn" onclick="deleteWork('+i+')">&#10005;</button></div>';
    list.appendChild(item);
  });
  var pc=works.filter(function(w){return w.type==='poem';}).length;
  var sc=works.filter(function(w){return w.type==='story';}).length;
  setEl('ws-total',works.length);setEl('ws-poems',pc);setEl('ws-stories',sc);
}
function deleteWork(i){
  if(!confirm('Delete "'+works[i].title+'"?'))return;
  var w=works[i];
  if(w.id){
    db.deleteWork(w.id).then(function(ok){
      if(!ok) showToast('Could not delete. Check your connection.');
    });
  }
  works.splice(i,1);
  renderPubList();updateStats();renderRecentStrip();
  redrawConstellation();
  showToast('Removed.');
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats(){
  var pc=works.filter(function(w){return w.type==='poem';}).length;
  var sc=works.filter(function(w){return w.type==='story';}).length;
  animCount('h-poems',pc);animCount('h-stories',sc);animCount('a-poems',pc);animCount('a-stories',sc);
}
function animCount(id,target){
  var el=document.getElementById(id); if(!el)return;
  var t0=null;
  (function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/1000,1);el.textContent=Math.round(target*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step);})(performance.now());
}
function setEl(id,val){var e=document.getElementById(id);if(e)e.textContent=val;}

// ── TOAST ─────────────────────────────────────────────────────
var toastTimer;
function showToast(msg){
  var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show');},2800);
}

// ── INIT ──────────────────────────────────────────────────────
(function(){
  var s=document.createElement('style');
  s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}35%{transform:translateX(10px)}55%{transform:translateX(-6px)}75%{transform:translateX(6px)}} .shake{animation:shake 0.45s ease;} @keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.45)}60%{transform:scale(0.92)}100%{transform:scale(1)}} .pop .heart-icon{animation:heartPop 0.35s cubic-bezier(0.16,1,0.3,1);}';
  document.head.appendChild(s);
})();

// Works are loaded from Supabase in the window load handler above.
// These are no-ops until works is populated — kept for safety.
updateStats();
