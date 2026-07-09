/* ==========================================================================
   CUTE NOTEPAD — SCRIPT.JS
   Organized in sections: Storage helpers, Sound, Mascot, Confetti,
   Navigation, Widgets (clock/calendar/mood/quote), Notes, Tasks,
   Stickers, Pomodoro, Themes, Terminal, Achievements, Init.
   ========================================================================== */

/* ---------------- Storage helpers ---------------- */
const store = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ /* storage full or blocked */ }
  }
};

const state = {
  notes: store.get('cn_notes', []),
  tasks: store.get('cn_tasks', []),
  stickers: store.get('cn_stickers', []),
  settings: store.get('cn_settings', { theme:'light', sound:true, reduceMotion:false }),
  achievements: store.get('cn_achievements', {}),
  moods: store.get('cn_moods', {}),
  selectedNoteId: null,
};

function saveNotes(){ store.set('cn_notes', state.notes); }
function saveTasks(){ store.set('cn_tasks', state.tasks); }
function saveStickers(){ store.set('cn_stickers', state.stickers); }
function saveSettings(){ store.set('cn_settings', state.settings); }
function saveAchievements(){ store.set('cn_achievements', state.achievements); }
function saveMoods(){ store.set('cn_moods', state.moods); }

/* ---------------- Sound (Web Audio, no external files) ---------------- */
let audioCtx;
function beep(freq = 520, duration = 0.08){
  if(!state.settings.sound) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }catch(e){ /* audio not available, fail silently */ }
}

/* ---------------- Mascot ---------------- */
const mascotEl = document.getElementById('mascot');
const mascotBubble = document.getElementById('mascot-bubble');
const mascotLines = [
  "You got this! 🐰", "Tiny steps count too!", "Ooh, fancy note!",
  "Don't forget to breathe.", "I believe in you!", "Sticker time is the best time.",
];
function mascotSay(text, ms = 2600){
  mascotBubble.textContent = text;
  mascotBubble.classList.add('show');
  clearTimeout(mascotSay._t);
  mascotSay._t = setTimeout(()=> mascotBubble.classList.remove('show'), ms);
}
function mascotJump(){
  mascotEl.classList.remove('jump');
  void mascotEl.offsetWidth; // restart animation
  mascotEl.classList.add('jump');
}
mascotEl.addEventListener('click', ()=>{
  mascotSay(mascotLines[Math.floor(Math.random()*mascotLines.length)]);
  mascotJump();
  beep(660,0.06);
});
// occasional idle chatter
setInterval(()=>{
  if(Math.random() < 0.15) mascotSay(mascotLines[Math.floor(Math.random()*mascotLines.length)], 2200);
}, 25000);

/* ---------------- Confetti (lightweight, self-contained) ---------------- */
const confettiCanvas = document.getElementById('confetti-canvas');
const cctx = confettiCanvas.getContext('2d');
function resizeConfettiCanvas(){
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfettiCanvas);
resizeConfettiCanvas();

function fireConfetti(count = 80){
  if(state.settings.reduceMotion) return;
  const colors = ['#FF8FB1','#C9B6F0','#B8E8D4','#FFE1A8','#7CF5D0'];
  const particles = Array.from({length: count}, () => ({
    x: confettiCanvas.width/2 + (Math.random()-0.5)*200,
    y: confettiCanvas.height*0.25,
    vx: (Math.random()-0.5)*8,
    vy: Math.random()*-6 - 4,
    size: Math.random()*6+4,
    color: colors[Math.floor(Math.random()*colors.length)],
    rotation: Math.random()*360,
    vr: (Math.random()-0.5)*10,
    life: 0,
  }));
  let frame = 0;
  function tick(){
    cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    frame++;
    let alive = false;
    particles.forEach(p=>{
      p.vy += 0.18; // gravity
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr; p.life++;
      if(p.y < confettiCanvas.height + 20) alive = true;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rotation * Math.PI/180);
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      cctx.restore();
    });
    if(alive && frame < 240) requestAnimationFrame(tick);
    else cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  }
  tick();
}

/* ---------------- Achievement toast ---------------- */
const toastEl = document.getElementById('achievement-toast');
const ACHIEVEMENTS = {
  firstNote: { icon:'📝', label:'First Note — you wrote your very first note!' },
  stickerCollector: { icon:'🎀', label:'Sticker Collector — placed 5 stickers!' },
  productivityMaster: { icon:'🏆', label:'Productivity Master — cleared your whole task list!' },
  focusChampion: { icon:'🍅', label:'Focus Champion — completed a full pomodoro session!' },
};
function unlockAchievement(key){
  if(state.achievements[key]) return;
  state.achievements[key] = true;
  saveAchievements();
  renderBadges();
  const info = ACHIEVEMENTS[key];
  toastEl.innerHTML = `<span style="font-size:20px">${info.icon}</span><span>${info.label}</span>`;
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 3400);
  fireConfetti(100);
  mascotSay("Badge unlocked! 🎉", 3000);
  beep(880,0.12);
}
function renderBadges(){
  const lists = [document.getElementById('badge-list'), document.getElementById('settings-badges')];
  lists.forEach(list=>{
    if(!list) return;
    list.innerHTML = Object.keys(ACHIEVEMENTS).map(key=>{
      const unlocked = !!state.achievements[key];
      const info = ACHIEVEMENTS[key];
      return `<span class="badge-pill ${unlocked?'':'locked'}" title="${info.label}">${info.icon} ${key.replace(/([A-Z])/g,' $1')}</span>`;
    }).join('');
  });
}

/* ---------------- Navigation ---------------- */
const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
navButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v=>v.classList.remove('active'));
    document.getElementById(btn.dataset.view).classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    beep(440,0.05);
  });
});
document.getElementById('menu-toggle').addEventListener('click', (e)=>{
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  e.target.setAttribute('aria-expanded', sidebar.classList.contains('open'));
});

/* ---------------- Widgets: clock ---------------- */
function tickClock(){
  const el = document.getElementById('clock');
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
setInterval(tickClock, 1000);

/* ---------------- Widgets: calendar ---------------- */
function renderCalendar(){
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const label = now.toLocaleDateString([], { month:'long', year:'numeric' });
  document.getElementById('cal-label').textContent = label;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const grid = document.getElementById('cal-grid');
  let html = ['S','M','T','W','T','F','S'].map(d=>`<span style="font-weight:700">${d}</span>`).join('');
  for(let i=0;i<firstDay;i++) html += '<span></span>';
  for(let d=1; d<=daysInMonth; d++){
    const isToday = d === now.getDate();
    html += `<span class="${isToday?'today':''}">${d}</span>`;
  }
  grid.innerHTML = html;
}

/* ---------------- Widgets: mood ---------------- */
function todayKey(){ return new Date().toISOString().slice(0,10); }
const moodMessages = {
  '😊':"Glad you're feeling good today!",
  '🤩':"That excitement is contagious!",
  '😌':"Calm days are good days.",
  '😴':"Maybe a short break is in order?",
  '😢':"Sending you a little comfort. 💛",
};
function renderMood(){
  const saved = state.moods[todayKey()];
  document.querySelectorAll('.mood-btn').forEach(btn=>{
    btn.classList.toggle('selected', btn.dataset.mood === saved);
  });
  document.getElementById('mood-note').textContent = saved ? moodMessages[saved] : '';
}
document.querySelectorAll('.mood-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    state.moods[todayKey()] = btn.dataset.mood;
    saveMoods();
    renderMood();
    beep(500,0.05);
  });
});

/* ---------------- Widgets: quote ---------------- */
const QUOTES = [
  "Tiny steps become big achievements!",
  "You got this, one page at a time.",
  "Be your own kind of cozy today.",
  "Progress, not perfection.",
  "A little sparkle goes a long way.",
  "Rest is productive too.",
  "Your notebook, your rules.",
  "Small wins deserve big celebrations.",
];
function newQuote(){
  const el = document.getElementById('quote-text');
  el.style.opacity = 0;
  setTimeout(()=>{
    el.textContent = `"${QUOTES[Math.floor(Math.random()*QUOTES.length)]}"`;
    el.style.opacity = 1;
  }, 200);
}
document.getElementById('quote-refresh').addEventListener('click', ()=>{ newQuote(); beep(600,0.05); });

/* ==========================================================================
   NOTES
   ========================================================================== */
const notesListEl = document.getElementById('notes-list');
const noteTitleEl = document.getElementById('note-title');
const noteBodyEl = document.getElementById('note-body');
const noteSearchEl = document.getElementById('note-search');

function createNote(){
  const note = {
    id: 'n' + Date.now(),
    title: '',
    body: '',
    pinned: false,
    updatedAt: Date.now(),
  };
  state.notes.unshift(note);
  saveNotes();
  state.selectedNoteId = note.id;
  renderNotesList();
  loadNoteIntoEditor(note.id);
  if(!state.achievements.firstNote) unlockAchievement('firstNote');
}

function renderNotesList(){
  const query = noteSearchEl.value.trim().toLowerCase();
  let list = [...state.notes].sort((a,b)=> (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  if(query){
    list = list.filter(n => (n.title+n.body).toLowerCase().includes(query));
  }
  if(list.length === 0){
    notesListEl.innerHTML = `<li class="empty-hint">No notes yet — hit "+ New" to start writing 🌸</li>`;
    return;
  }
  notesListEl.innerHTML = list.map(n=>{
    const snippet = n.body.replace(/<[^>]*>/g,' ').trim().slice(0,60) || 'Empty note…';
    const date = new Date(n.updatedAt).toLocaleDateString([], {month:'short', day:'numeric'});
    return `<li class="note-card ${n.id===state.selectedNoteId?'selected':''}" data-id="${n.id}">
      <div class="n-title">${n.pinned?'📌 ':''}${escapeHtml(n.title) || 'Untitled note'}</div>
      <div class="n-snippet">${escapeHtml(snippet)}</div>
      <div class="n-meta">${date}</div>
    </li>`;
  }).join('');
  notesListEl.querySelectorAll('.note-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      state.selectedNoteId = card.dataset.id;
      loadNoteIntoEditor(card.dataset.id);
      renderNotesList();
    });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function loadNoteIntoEditor(id){
  const note = state.notes.find(n=>n.id===id);
  if(!note){
    noteTitleEl.value = '';
    noteBodyEl.innerHTML = '';
    document.getElementById('last-edited').textContent = 'Not edited yet';
    updateCounts();
    if(typeof renderNoteStickers === 'function') renderNoteStickers(null);
    return;
  }
  noteTitleEl.value = note.title;
  noteBodyEl.innerHTML = note.body;
  document.getElementById('pin-btn').style.opacity = note.pinned ? '1' : '0.5';
  document.getElementById('last-edited').textContent = 'Edited ' + new Date(note.updatedAt).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
  updateCounts();
  if(typeof renderNoteStickers === 'function') renderNoteStickers(note);
}

function updateCounts(){
  const text = noteBodyEl.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('word-count').textContent = `${words} word${words===1?'':'s'}`;
  document.getElementById('char-count').textContent = `${text.length} characters`;
}

let saveDebounce;
function persistCurrentNote(){
  const note = state.notes.find(n=>n.id===state.selectedNoteId);
  if(!note) return;
  note.title = noteTitleEl.value;
  note.body = noteBodyEl.innerHTML;
  note.updatedAt = Date.now();
  saveNotes();
  document.getElementById('last-edited').textContent = 'Edited just now';
  renderNotesList();
}
function scheduleSave(){
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(persistCurrentNote, 500);
  updateCounts();
}
noteTitleEl.addEventListener('input', scheduleSave);
noteBodyEl.addEventListener('input', scheduleSave);
noteSearchEl.addEventListener('input', renderNotesList);

document.getElementById('new-note-btn').addEventListener('click', ()=>{ createNote(); beep(700,0.06); });

document.getElementById('pin-btn').addEventListener('click', ()=>{
  const note = state.notes.find(n=>n.id===state.selectedNoteId);
  if(!note) return;
  note.pinned = !note.pinned;
  saveNotes();
  renderNotesList();
  document.getElementById('pin-btn').style.opacity = note.pinned ? '1' : '0.5';
  beep(note.pinned ? 720 : 400, 0.06);
});

document.getElementById('delete-note-btn').addEventListener('click', ()=>{
  const idx = state.notes.findIndex(n=>n.id===state.selectedNoteId);
  if(idx === -1) return;
  if(!confirm('Delete this note? This cannot be undone.')) return;
  state.notes.splice(idx,1);
  saveNotes();
  state.selectedNoteId = state.notes[0]?.id || null;
  renderNotesList();
  loadNoteIntoEditor(state.selectedNoteId);
  beep(300,0.08);
});

document.getElementById('download-note-btn').addEventListener('click', ()=>{
  const note = state.notes.find(n=>n.id===state.selectedNoteId);
  if(!note) return;
  const text = (note.title || 'Untitled note') + '\n\n' + (noteBodyEl.innerText || '');
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (note.title || 'note').replace(/[^a-z0-9\-_ ]/gi,'').trim() + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  beep(600,0.06);
});

document.querySelectorAll('.fmt-btn[data-cmd]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    noteBodyEl.focus();
    const cmd = btn.dataset.cmd;
    if(cmd.startsWith('formatBlock')){
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
    } else {
      document.execCommand(cmd, false, null);
    }
    scheduleSave();
  });
});

/* ---- Font size popover: preserves the text selection so clicking a size still applies to it ---- */
let savedNoteRange = null;
document.addEventListener('selectionchange', ()=>{
  const sel = window.getSelection();
  if(sel.rangeCount && noteBodyEl.contains(sel.anchorNode)){
    savedNoteRange = sel.getRangeAt(0).cloneRange();
  }
});

const fontSizeBtn = document.getElementById('font-size-btn');
const fontSizeMenu = document.getElementById('font-size-menu');
fontSizeBtn.addEventListener('mousedown', (e)=>{
  e.preventDefault(); // keeps focus (and selection) inside note-body
  const willOpen = fontSizeMenu.hidden;
  closeAllPopovers();
  fontSizeMenu.hidden = !willOpen;
  fontSizeBtn.setAttribute('aria-expanded', String(willOpen));
});
fontSizeMenu.querySelectorAll('.size-option').forEach(opt=>{
  opt.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    applyFontSize(parseInt(opt.dataset.size, 10));
    fontSizeMenu.hidden = true;
    fontSizeBtn.setAttribute('aria-expanded','false');
    beep(600,0.05);
  });
});

function applyFontSize(px){
  const sel = window.getSelection();
  let range = (sel.rangeCount && noteBodyEl.contains(sel.anchorNode)) ? sel.getRangeAt(0) : savedNoteRange;
  if(!range){
    // no prior selection at all — apply to the whole note as a fallback
    noteBodyEl.style.fontSize = px + 'px';
    scheduleSave();
    return;
  }
  noteBodyEl.focus();
  sel.removeAllRanges();
  sel.addRange(range);

  if(range.collapsed){
    // cursor only, no highlighted text — resize the current line/block instead
    let node = range.startContainer;
    if(node.nodeType === 3) node = node.parentNode;
    let block = node;
    while(block && block !== noteBodyEl && !['DIV','P','H1','H2','H3','LI'].includes(block.tagName)){
      block = block.parentNode;
    }
    if(block && block !== noteBodyEl){ block.style.fontSize = px + 'px'; }
  } else {
    const span = document.createElement('span');
    span.style.fontSize = px + 'px';
    try{
      range.surroundContents(span);
    }catch(err){
      const content = range.extractContents();
      span.appendChild(content);
      range.insertNode(span);
    }
  }
  scheduleSave();
}

/* ---- Sticker-on-note: same drag/resize/remove behavior as the sticker board, scoped per note ---- */
const noteStickerBtn = document.getElementById('note-sticker-btn');
const noteStickerMenu = document.getElementById('note-sticker-menu');
const noteStickerLayer = document.getElementById('note-sticker-layer');

noteStickerBtn.addEventListener('mousedown', (e)=>{
  e.preventDefault();
  const willOpen = noteStickerMenu.hidden;
  closeAllPopovers();
  noteStickerMenu.hidden = !willOpen;
  noteStickerBtn.setAttribute('aria-expanded', String(willOpen));
});
noteStickerMenu.querySelectorAll('.sticker-choice').forEach(btn=>{
  btn.addEventListener('mousedown', (e)=>{
    e.preventDefault();
    addStickerToCurrentNote(btn.dataset.emoji);
    noteStickerMenu.hidden = true;
    noteStickerBtn.setAttribute('aria-expanded','false');
  });
});

function closeAllPopovers(){
  fontSizeMenu.hidden = true;
  fontSizeBtn.setAttribute('aria-expanded','false');
  noteStickerMenu.hidden = true;
  noteStickerBtn.setAttribute('aria-expanded','false');
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.popover-wrap')) closeAllPopovers();
});

function addStickerToCurrentNote(emoji){
  const note = state.notes.find(n=>n.id===state.selectedNoteId);
  if(!note){ mascotSay("Open or start a note first!", 2400); return; }
  if(!note.stickers) note.stickers = [];
  const layerRect = noteStickerLayer.getBoundingClientRect();
  const s = {
    id: 'ns'+Date.now()+Math.random().toString(36).slice(2,6),
    emoji,
    x: Math.random()*(layerRect.width-60)+10,
    y: Math.random()*(Math.max(layerRect.height,120)-60)+10,
    size: 34,
  };
  note.stickers.push(s);
  saveNotes();
  noteStickerLayer.appendChild(buildNoteStickerEl(s, note));
  beep(720,0.05);
  if(state.stickers.length + state.notes.reduce((a,n)=>a+(n.stickers?.length||0),0) >= 5 && !state.achievements.stickerCollector){
    unlockAchievement('stickerCollector');
  }
}

function buildNoteStickerEl(s, note){
  const el = document.createElement('div');
  el.className = 'sticker';
  el.textContent = s.emoji;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  el.style.fontSize = s.size + 'px';
  el.dataset.id = s.id;
  el.tabIndex = 0;

  let dragging = false, offsetX = 0, offsetY = 0;
  el.addEventListener('pointerdown', (e)=>{
    dragging = true;
    el.setPointerCapture(e.pointerId);
    const rect = noteStickerLayer.getBoundingClientRect();
    offsetX = e.clientX - rect.left - s.x;
    offsetY = e.clientY - rect.top - s.y;
  });
  el.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const rect = noteStickerLayer.getBoundingClientRect();
    s.x = Math.max(0, Math.min(rect.width - s.size*0.6, e.clientX - rect.left - offsetX));
    s.y = Math.max(0, Math.min(Math.max(rect.height,120) - s.size*0.6, e.clientY - rect.top - offsetY));
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
  });
  el.addEventListener('pointerup', ()=>{ dragging = false; saveNotes(); });
  el.addEventListener('wheel', (e)=>{
    e.preventDefault();
    s.size = Math.max(16, Math.min(90, s.size - e.deltaY*0.08));
    el.style.fontSize = s.size + 'px';
    saveNotes();
  }, { passive:false });
  el.addEventListener('dblclick', ()=>{
    note.stickers = note.stickers.filter(x=>x.id!==s.id);
    saveNotes();
    el.remove();
    beep(320,0.06);
  });
  return el;
}

function renderNoteStickers(note){
  noteStickerLayer.innerHTML = '';
  if(!note || !note.stickers) return;
  note.stickers.forEach(s => noteStickerLayer.appendChild(buildNoteStickerEl(s, note)));
}

/* ==========================================================================
   TASKS
   ========================================================================== */
const taskListEl = document.getElementById('task-list');
const taskFormEl = document.getElementById('task-form');
let bestProgressSeen = 0;

function renderTasks(){
  if(state.tasks.length === 0){
    taskListEl.innerHTML = `<li class="empty-hint">No tasks yet — add one above to get started! ✅</li>`;
  } else {
    taskListEl.innerHTML = state.tasks.map(t=>`
      <li class="task-item ${t.done?'completed':''}" data-id="${t.id}">
        <button class="task-checkbox ${t.done?'done':''}" aria-label="Toggle task complete">${t.done?'✓':''}</button>
        <span class="task-text">${escapeHtml(t.text)}</span>
        <span class="priority-tag priority-${t.priority}">${t.priority}</span>
        <button class="icon-mini edit-task" aria-label="Edit task">✏️</button>
        <button class="icon-mini delete-task" aria-label="Delete task">🗑️</button>
      </li>
    `).join('');
  }

  taskListEl.querySelectorAll('.task-checkbox').forEach(cb=>{
    cb.addEventListener('click', ()=>{
      const id = cb.closest('.task-item').dataset.id;
      const task = state.tasks.find(t=>t.id===id);
      task.done = !task.done;
      saveTasks();
      renderTasks();
      updateProgress();
      beep(task.done ? 780 : 350, 0.06);
      if(task.done) mascotSay("Yay, one down! 🎉", 2000);
    });
  });
  taskListEl.querySelectorAll('.delete-task').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.closest('.task-item').dataset.id;
      state.tasks = state.tasks.filter(t=>t.id!==id);
      saveTasks();
      renderTasks();
      updateProgress();
    });
  });
  taskListEl.querySelectorAll('.edit-task').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.closest('.task-item').dataset.id;
      const task = state.tasks.find(t=>t.id===id);
      const next = prompt('Edit task', task.text);
      if(next !== null && next.trim()){
        task.text = next.trim();
        saveTasks();
        renderTasks();
      }
    });
  });
}

function updateProgress(){
  const total = state.tasks.length;
  const done = state.tasks.filter(t=>t.done).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-percent').textContent = `${pct}% complete`;
  const score = done * 10;
  document.getElementById('productivity-score').textContent = `Productivity score: ${score}`;

  const motivationEl = document.getElementById('task-motivation');
  if(total > 0 && pct === 100){
    motivationEl.textContent = "All done! You're unstoppable. 🌟";
    if(!state.achievements.productivityMaster) unlockAchievement('productivityMaster');
  } else if(pct >= 50){
    motivationEl.textContent = "Great momentum, keep going!";
  } else if(pct > 0){
    motivationEl.textContent = "Nice start — one task at a time.";
  } else {
    motivationEl.textContent = '';
  }
}

taskFormEl.addEventListener('submit', (e)=>{
  e.preventDefault();
  const input = document.getElementById('task-input');
  const priority = document.getElementById('task-priority').value;
  if(!input.value.trim()) return;
  state.tasks.push({ id:'t'+Date.now(), text: input.value.trim(), priority, done:false });
  saveTasks();
  input.value = '';
  renderTasks();
  updateProgress();
  beep(650,0.05);
});

/* ==========================================================================
   STICKERS
   ========================================================================== */
const stickerBoard = document.getElementById('sticker-board');

function renderStickers(){
  stickerBoard.innerHTML = '';
  state.stickers.forEach(s => stickerBoard.appendChild(buildStickerEl(s)));
}

function buildStickerEl(s){
  const el = document.createElement('div');
  el.className = 'sticker';
  el.textContent = s.emoji;
  el.style.left = s.x + 'px';
  el.style.top = s.y + 'px';
  el.style.fontSize = s.size + 'px';
  el.dataset.id = s.id;
  el.tabIndex = 0;

  let dragging = false, offsetX = 0, offsetY = 0;
  el.addEventListener('pointerdown', (e)=>{
    dragging = true;
    el.setPointerCapture(e.pointerId);
    const rect = stickerBoard.getBoundingClientRect();
    offsetX = e.clientX - rect.left - s.x;
    offsetY = e.clientY - rect.top - s.y;
  });
  el.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    const rect = stickerBoard.getBoundingClientRect();
    s.x = Math.max(0, Math.min(rect.width - s.size*0.6, e.clientX - rect.left - offsetX));
    s.y = Math.max(0, Math.min(rect.height - s.size*0.6, e.clientY - rect.top - offsetY));
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
  });
  el.addEventListener('pointerup', ()=>{ dragging = false; saveStickers(); });
  el.addEventListener('wheel', (e)=>{
    e.preventDefault();
    s.size = Math.max(20, Math.min(120, s.size - e.deltaY*0.08));
    el.style.fontSize = s.size + 'px';
    saveStickers();
  }, { passive:false });
  el.addEventListener('dblclick', ()=>{
    state.stickers = state.stickers.filter(x=>x.id!==s.id);
    saveStickers();
    el.remove();
    beep(320,0.06);
  });
  return el;
}

document.querySelectorAll('.sticker-choice').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const boardRect = stickerBoard.getBoundingClientRect();
    const s = {
      id: 's'+Date.now()+Math.random().toString(36).slice(2,6),
      emoji: btn.dataset.emoji,
      x: Math.random()*(boardRect.width-60)+10,
      y: Math.random()*(boardRect.height-60)+10,
      size: 40,
    };
    state.stickers.push(s);
    saveStickers();
    stickerBoard.appendChild(buildStickerEl(s));
    beep(720,0.05);
    if(state.stickers.length >= 5 && !state.achievements.stickerCollector){
      unlockAchievement('stickerCollector');
    }
  });
});
document.getElementById('clear-stickers').addEventListener('click', ()=>{
  if(state.stickers.length && !confirm('Remove all stickers from the board?')) return;
  state.stickers = [];
  saveStickers();
  renderStickers();
});

/* ==========================================================================
   POMODORO
   ========================================================================== */
let pomodoro = { seconds: 25*60, mode:'focus', running:false, timer:null };
const pomodoroTimeEl = document.getElementById('pomodoro-time');
const pomodoroModeEl = document.getElementById('pomodoro-mode');
const startBtn = document.getElementById('pomodoro-start');
const pauseBtn = document.getElementById('pomodoro-pause');
const resetBtn = document.getElementById('pomodoro-reset');

function renderPomodoro(){
  const m = String(Math.floor(pomodoro.seconds/60)).padStart(2,'0');
  const s = String(pomodoro.seconds%60).padStart(2,'0');
  pomodoroTimeEl.textContent = `${m}:${s}`;
  pomodoroModeEl.textContent = pomodoro.mode === 'focus' ? 'Focus session' : 'Break time';
}

function tickPomodoro(){
  pomodoro.seconds--;
  if(pomodoro.seconds <= 0){
    if(pomodoro.mode === 'focus'){
      unlockAchievement('focusChampion');
      fireConfetti(120);
      mascotSay("Focus session complete! 🍅", 3000);
      pomodoro.mode = 'break';
      pomodoro.seconds = 5*60;
    } else {
      pomodoro.mode = 'focus';
      pomodoro.seconds = 25*60;
      mascotSay("Break's over — ready when you are!", 2600);
    }
  }
  renderPomodoro();
}

startBtn.addEventListener('click', ()=>{
  if(pomodoro.running) return;
  pomodoro.running = true;
  pomodoro.timer = setInterval(tickPomodoro, 1000);
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  beep(700,0.06);
});
pauseBtn.addEventListener('click', ()=>{
  pomodoro.running = false;
  clearInterval(pomodoro.timer);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  beep(400,0.06);
});
resetBtn.addEventListener('click', ()=>{
  pomodoro.running = false;
  clearInterval(pomodoro.timer);
  pomodoro.mode = 'focus';
  pomodoro.seconds = 25*60;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  renderPomodoro();
});

/* ==========================================================================
   THEMES
   ========================================================================== */
const THEME_ORDER = ['light','dark','pink','lavender','terminal'];
function applyTheme(theme){
  document.body.dataset.theme = theme;
  state.settings.theme = theme;
  saveSettings();
  document.querySelectorAll('.theme-swatch').forEach(sw=>{
    sw.classList.toggle('active', sw.dataset.theme === theme);
  });
  document.querySelectorAll('.theme-dot').forEach(dot=>{
    dot.classList.toggle('active', dot.dataset.theme === theme);
  });
  const isTerminal = theme === 'terminal';
  document.getElementById('terminal-toggle').hidden = !isTerminal;
  if(!isTerminal){
    document.getElementById('terminal-console').hidden = true;
  }
}
document.querySelectorAll('.theme-swatch, .theme-dot').forEach(sw=>{
  sw.addEventListener('click', ()=>{ applyTheme(sw.dataset.theme); beep(560,0.06); });
});

/* ---------------- Sound / motion toggles ---------------- */
const soundToggleBtn = document.getElementById('sound-toggle');
const soundCheckbox = document.getElementById('sound-checkbox');
const motionCheckbox = document.getElementById('motion-checkbox');

function applySoundUI(){
  soundToggleBtn.textContent = state.settings.sound ? '🔊' : '🔇';
  soundToggleBtn.setAttribute('aria-pressed', state.settings.sound);
  soundCheckbox.checked = state.settings.sound;
}
function applyMotionUI(){
  document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
  motionCheckbox.checked = state.settings.reduceMotion;
}
soundToggleBtn.addEventListener('click', ()=>{
  state.settings.sound = !state.settings.sound;
  saveSettings();
  applySoundUI();
});
soundCheckbox.addEventListener('change', ()=>{
  state.settings.sound = soundCheckbox.checked;
  saveSettings();
  applySoundUI();
});
motionCheckbox.addEventListener('change', ()=>{
  state.settings.reduceMotion = motionCheckbox.checked;
  saveSettings();
  applyMotionUI();
});

document.getElementById('reset-data-btn').addEventListener('click', ()=>{
  if(!confirm('This clears all notes, tasks, stickers and badges. Continue?')) return;
  ['cn_notes','cn_tasks','cn_stickers','cn_achievements','cn_moods'].forEach(k=>localStorage.removeItem(k));
  location.reload();
});

/* ==========================================================================
   TERMINAL (only meaningful in terminal theme)
   ========================================================================== */
const terminalConsole = document.getElementById('terminal-console');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');

function termPrint(line){
  const p = document.createElement('div');
  p.textContent = line;
  terminalOutput.appendChild(p);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
const TERMINAL_COMMANDS = {
  help: () => termPrint('Commands: help, notes, theme, clear, about'),
  notes: () => termPrint(`You have ${state.notes.length} note(s) saved.`),
  theme: () => termPrint(`Current theme: ${state.settings.theme}. Try the settings panel to change it!`),
  clear: () => { terminalOutput.innerHTML=''; },
  about: () => termPrint('Notepad Studio v1.0 — a cozy corner of the internet. Made with HTML, CSS & JS. Easter egg: try "sudo hug"'),
  'sudo hug': () => termPrint('>> hug delivered. 🤗 warning: may cause smiling.'),
};
document.getElementById('terminal-toggle').addEventListener('click', ()=>{
  terminalConsole.hidden = false;
  terminalInput.focus();
});
document.getElementById('terminal-close').addEventListener('click', ()=>{ terminalConsole.hidden = true; });
terminalInput.addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter') return;
  const cmd = terminalInput.value.trim().toLowerCase();
  termPrint('> ' + terminalInput.value);
  if(TERMINAL_COMMANDS[cmd]) TERMINAL_COMMANDS[cmd]();
  else termPrint(`Unknown command: "${cmd}". Try "help".`);
  terminalInput.value = '';
});

/* ==========================================================================
   INIT
   ========================================================================== */
function init(){
  applyTheme(state.settings.theme || 'light');
  applySoundUI();
  applyMotionUI();
  tickClock();
  renderCalendar();
  renderMood();
  newQuote();
  renderNotesList();
  if(state.notes.length){
    state.selectedNoteId = state.notes[0].id;
    loadNoteIntoEditor(state.selectedNoteId);
    renderNotesList();
  }
  renderTasks();
  updateProgress();
  renderStickers();
  renderPomodoro();
  renderBadges();
  setTimeout(()=> mascotSay("Welcome back! ☕", 3200), 900);
}
document.addEventListener('DOMContentLoaded', init);
