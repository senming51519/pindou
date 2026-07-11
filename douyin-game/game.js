
// game.js - 拼豆配对 抖音小游戏版
var canvas = tt.createCanvas()
var ctx = canvas.getContext('2d')
var sys = tt.getSystemInfoSync()
var W = sys.windowWidth
var H = sys.windowHeight
canvas.width = W
canvas.height = H

var SAFE_TOP = (sys.safeArea && sys.safeArea.top) || 0
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


// ===== Constants =====
var GRID = 20
var SLOT_ROWS = 2
var SLOT_COLS = 20
var RED = '#f44336', BLUE = '#2196f3', GREEN = '#4caf50'
var PURPLE = '#9c27b0', PINK = '#e91e63', ORANGE = '#ff9800'
var ALL_COLORS = [RED, BLUE, GREEN, PURPLE, PINK, ORANGE]

// Color name to hex lookup for published_levels backward compatibility
var COLOR_MAP = {
  WHITE: "#ffffff", LIGHT_GRAY: "#e0e0e0", GRAY: "#9e9e9e", DARK_GRAY: "#616161",
  BLACK: "#212121", RED: "#f44336", DARK_RED: "#c62828", PINK: "#e91e63",
  LIGHT_PINK: "#f8bbd0", ORANGE: "#ff9800", DARK_ORANGE: "#e65100", PEACH: "#ffccbc",
  YELLOW: "#ffeb3b", GREEN: "#4caf50", DARK_GREEN: "#2e7d32", LIGHT_GREEN: "#81c784",
  LIME: "#cddc39", TEAL: "#009688", MINT: "#a5d6a7", BLUE: "#2196f3",
  DARK_BLUE: "#1565c0", LIGHT_BLUE: "#90caf9", NAVY: "#1a237e", PURPLE: "#9c27b0",
  DARK_PURPLE: "#6a1b9a", LAVENDER: "#ce93d8", BROWN: "#795548", BEIGE: "#d7ccc8"
};

// Convert any color name in template colors to hex
function ensureHexColors(tmpl) {
  if (!tmpl || !tmpl.colors) return tmpl;
  for (var key in tmpl.colors) {
    var val = tmpl.colors[key];
    if (typeof val === "string" && val.charAt(0) !== "#" && COLOR_MAP[val]) {
      tmpl.colors[key] = COLOR_MAP[val];
    }
  }
  return tmpl;
}

// ===== Layout (computed from screen) =====
var PAD = Math.max(8, W * 0.02)
var BOARD_SIZE = W - PAD * 2
var CELL = BOARD_SIZE / GRID
var TOP_OFFSET = 72
var SLOT_CELL = Math.min(28, (W - PAD * 2) / SLOT_COLS)
var SLOT_TOP = H - 92 - SLOT_ROWS * (SLOT_CELL + 3)
var BTN_TOP = SLOT_TOP + SLOT_ROWS * (SLOT_CELL + 3) + 8
var SELECTOR_PANEL_H = 70  // 关卡选择器占位高度

// Center vertically
var CONTENT_H = BTN_TOP + 42 + SELECTOR_PANEL_H  // unused with CY=0
var CY = 0

// ===== State =====
var targetGrid = [], boardGrid = [], slotGrid = []
var selectedPos = null
var currentTemplate = 'heart'
var HIDE_LEVEL_SELECTOR = false;  // 上线后设为 true 隐藏关卡选择器
var levelSelectorVisible = false;   // 当前是否展开关卡选择面板
var moveHistory = []
// Animation system
var animBatch = null
var animTimer = null
var ANIM_DURATION = 350 // ms

function easeOutQuad(t) { return t * (2 - t) }

function startAnimBatch(batch, callback) {
  // Add stagger delay for each block (60ms apart)
  for (var si = 0; si < batch.length; si++) {
    batch[si].stagger = si * 120
  }
  var totalDur = ANIM_DURATION + (batch.length - 1) * 60
  animBatch = { batch: batch, progress: 0, totalDur: totalDur, callback: callback || function(){} }
  if (!animTimer) {
    animTimer = setInterval(function() {
      animBatch.progress = Math.min(1, animBatch.progress + 16 / animBatch.totalDur)
      draw()
      if (animBatch.progress >= 1) {
        clearInterval(animTimer)
        animTimer = null
        var cb = animBatch.callback
        animBatch = null
        cb()
        draw()
      }
    }, 16)
  }
}

function isAnimatingFrom(type, r, c) {
  if (!animBatch) return false
  for (var i = 0; i < animBatch.batch.length; i++) {
    var m = animBatch.batch[i]
    if (m.fromType === type && m.fr === r && m.fc === c) return true
  }
  return false
}

function getCenter(type, r, c) {
  if (type === 'board') {
    return { x: PAD + c * CELL + CELL/2, y: CY + TOP_OFFSET + r * CELL + CELL/2 }
  } else {
    return { x: PAD + c * SLOT_CELL + SLOT_CELL/2, y: CY + SLOT_TOP + r * (SLOT_CELL + 3) + SLOT_CELL/2 }
  }
}
var timerStarted = false
var totalTargetCells = 0
var zoom = 1.0
var MIN_ZOOM = 0.8, MAX_ZOOM = 3.5
var zoomSliderDragging = false
var panX = 0, panY = 0
var isPanning = false
var panStartX = 0, panStartY = 0
var panStartPanX = 0, panStartPanY = 0

var TEMPLATE_ORDER = ['heart', 'star', 'pika', 'cat', 'flower', 'dog', 'rabbit']
var TEMPLATES = {
  heart: { data: [[0,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,0],[0,0,0,0,2,1,1,1,1,1,1,1,1,1,2,0,0,0,0,0],[0,0,0,2,1,1,1,1,1,1,1,1,1,1,1,2,0,0,0,0],[0,0,2,1,1,1,3,3,1,1,3,3,1,1,1,1,2,0,0,0],[0,0,2,1,1,3,3,3,3,3,3,3,3,1,1,1,2,0,0,0],[0,0,0,2,1,1,3,3,3,3,3,3,1,1,1,2,0,0,0,0],[0,0,0,0,2,1,1,1,1,1,1,1,1,1,2,0,0,0,0,0],[0,0,0,0,0,2,1,1,1,1,1,1,1,2,0,0,0,0,0,0],[0,0,0,0,0,0,2,1,1,1,1,1,2,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,1,1,1,2,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,2,1,2,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0]], colors: {1:RED,2:BLUE,3:GREEN} },
  star: { data: [[0,2,2,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,2,0],[2,1,1,2,0,0,0,0,2,2,2,0,0,0,0,2,1,1,2,0],[2,1,1,1,2,0,2,2,2,2,2,2,2,0,2,1,1,1,2,0],[0,2,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,2,0,0],[0,0,2,1,1,1,2,2,2,2,2,2,2,1,1,1,2,0,0,0],[0,0,0,2,1,1,2,2,2,2,2,2,2,1,1,2,0,0,0,0],[0,0,0,2,1,3,3,2,2,2,2,3,3,3,1,2,0,0,0,0],[0,0,2,1,1,3,3,2,2,2,2,3,3,3,1,1,2,0,0,0],[0,0,2,1,1,1,2,2,2,2,2,2,2,1,1,1,2,0,0,0],[0,0,0,2,1,1,1,2,2,2,2,2,1,1,1,2,0,0,0,0],[0,0,0,0,2,1,1,2,2,2,2,2,1,1,2,0,0,0,0,0],[0,0,0,0,0,2,1,2,2,2,2,2,1,2,0,0,0,0,0,0],[0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0]], colors: {1:RED,2:BLUE,3:GREEN} },
  pika: { data: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0],[0,0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0,0],[0,0,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,0,0],[0,0,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,0,0],[0,0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0,0],[0,0,0,1,1,1,1,1,2,2,2,2,1,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,1,1,2,2,1,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],[0,0,0,0,0,3,3,1,1,1,1,1,1,3,3,0,0,0,0,0],[0,0,0,0,3,3,3,3,1,1,1,1,3,3,3,3,0,0,0,0],[0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0],[0,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0]], colors: {1:RED,2:BLUE,3:GREEN} },
  cat: { data: [[0,0,0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0],[0,0,0,2,1,1,2,0,0,0,0,0,0,2,1,1,2,0,0,0],[0,0,2,1,1,1,1,2,3,3,3,3,2,1,1,1,1,2,0,0],[0,0,2,1,1,1,1,1,3,3,3,3,1,1,1,1,1,2,0,0],[0,0,2,1,1,1,1,3,3,3,3,3,3,1,1,1,1,2,0,0],[0,0,0,2,1,1,1,3,3,3,3,3,3,1,1,1,2,0,0,0],[0,0,0,0,2,1,3,3,3,3,3,3,3,3,1,2,0,0,0,0],[0,0,0,0,2,1,3,3,3,3,3,3,3,3,1,2,0,0,0,0],[0,0,0,0,0,2,3,3,3,3,3,3,3,3,2,0,0,0,0,0],[0,0,0,0,2,1,3,3,3,3,3,3,3,3,1,2,0,0,0,0],[0,0,0,0,2,1,1,3,3,3,3,3,3,1,1,2,0,0,0,0],[0,0,0,2,1,1,1,1,3,3,3,3,1,1,1,1,2,0,0,0],[0,0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0,0],[0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],[0,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,0],[0,0,2,2,2,1,1,1,1,1,1,1,1,1,1,2,2,2,0,0],[0,0,0,0,2,2,2,2,2,1,1,2,2,2,2,2,0,0,0,0]], colors: {1:RED,2:BLUE,3:GREEN} },
  flower: { data: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],[0,0,0,0,1,1,1,1,3,3,1,1,1,1,0,0,0,0,0,0],[0,0,0,1,1,1,1,3,3,3,3,1,1,1,1,0,0,0,0,0],[0,0,0,1,1,1,1,3,3,3,3,1,1,1,1,0,0,0,0,0],[0,0,0,0,1,1,3,3,3,3,3,3,1,1,0,0,0,0,0,0],[0,0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0,0,0,0],[0,0,0,0,0,2,2,3,3,3,3,2,2,0,0,0,0,0,0,0],[0,0,0,0,2,2,2,2,3,3,2,2,2,2,0,0,0,0,0,0],[0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0,0,0],[0,0,0,0,0,2,2,2,2,2,2,2,2,0,0,0,0,0,0,0],[0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]], colors: {1:RED,2:BLUE,3:GREEN} },
  dog: { data: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,4,4,4,0,0,4,4,4,0,0,0,0,0,0],[0,0,0,0,0,4,4,4,4,0,0,4,4,4,4,0,0,0,0,0],[0,0,0,0,4,4,6,6,4,0,0,4,6,6,4,4,0,0,0,0],[0,0,0,4,4,6,6,6,6,0,0,6,6,6,6,4,4,0,0,0],[0,0,0,4,6,6,6,6,6,6,6,6,6,6,6,6,4,0,0,0],[0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0],[0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0],[0,0,0,0,6,6,3,3,6,6,6,6,3,3,6,6,0,0,0,0],[0,0,0,0,6,6,3,3,6,6,6,6,3,3,6,6,0,0,0,0],[0,0,0,0,6,6,6,1,1,1,1,1,1,6,6,6,0,0,0,0],[0,0,0,0,0,6,6,1,1,1,1,1,1,6,6,0,0,0,0,0],[0,0,0,0,0,6,6,5,5,5,5,5,5,6,6,0,0,0,0,0],[0,0,0,0,0,0,6,5,5,5,5,5,5,6,0,0,0,0,0,0],[0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],[0,0,0,0,1,1,1,2,2,1,1,2,2,1,1,1,0,0,0,0],[0,0,0,0,0,0,6,6,6,6,6,6,6,6,0,0,0,0,0,0],[0,0,0,0,0,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]], colors: {1:RED,2:GREEN,3:BLUE,4:PURPLE,5:PINK,6:ORANGE} },
  rabbit: { data: [[0,0,0,0,5,5,0,0,0,0,0,0,0,0,5,5,0,0,0,0],[0,0,0,5,5,5,0,0,0,0,0,0,0,0,5,5,5,0,0,0],[0,0,5,5,5,5,0,0,0,0,0,0,0,0,5,5,5,5,0,0],[0,0,5,4,4,5,0,0,0,0,0,0,0,0,5,4,4,5,0,0],[0,0,0,4,4,4,0,0,0,0,0,0,0,0,4,4,4,0,0,0],[0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0],[0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],[0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],[0,0,0,0,4,4,3,3,4,4,4,4,3,3,4,4,0,0,0,0],[0,0,0,0,4,4,3,3,4,4,4,4,3,3,4,4,0,0,0,0],[0,0,0,0,0,4,4,1,1,1,1,1,1,4,4,0,0,0,0,0],[0,0,0,0,0,0,4,4,1,1,1,1,4,4,0,0,0,0,0,0],[0,0,0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,2,4,4,2,2,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,2,2,4,4,2,2,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]], colors: {1:RED,2:GREEN,3:BLUE,4:ORANGE,5:PURPLE} }
}

// ===== Timer =====
var timeLeft = 180
var timerInterval = null
var gameOverActive = false
var rewardAd = null
var AD_UNIT_ID = 'your_ad_unit_id'
var adEnabled = false // 开发阶段隐藏广告按钮，上线后改为true
// ===== Audio =====
var bgm, sfxPlace, sfxMove, sfxWin
var musicMuted = false

function initAudio() {
  try {
    bgm = tt.createInnerAudioContext()
    bgm.loop = true
    bgm.src = 'bgm.mp3'
    sfxPlace = tt.createInnerAudioContext()
    sfxPlace.src = 'place.wav'
    sfxMove = tt.createInnerAudioContext()
    sfxMove.src = 'move.wav'
    sfxWin = tt.createInnerAudioContext()
    sfxWin.src = 'win.wav'
  } catch(e) { console.log('Audio:', e) }
}

function playBgm() { if (bgm && !musicMuted) { bgm.play() } }
function stopBgm() { if (bgm) { bgm.stop() } }

function playSfx(name) {
  if (musicMuted) return
  try {
    if (name === 'place' && sfxPlace) { sfxPlace.stop(); sfxPlace.play() }
    else if (name === 'move' && sfxMove) { sfxMove.stop(); sfxMove.play() }
    else if (name === 'win' && sfxWin) { sfxWin.stop(); sfxWin.play() }
  } catch(e) {}
}

function toggleMusic() {
  musicMuted = !musicMuted
  if (musicMuted) { stopBgm() } else { playBgm() }
  draw()
}
function startTimer() {
  stopTimer()
  timeLeft = 180
  gameOverActive = false
  timerInterval = setInterval(function() {
    timeLeft--
    draw()
    if (timeLeft <= 0 && !gameOverActive) {
      stopTimer()
      gameOverActive = true
      draw()
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

function formatTime(sec) {
  var m = Math.floor(sec / 60)
  var s = sec % 60
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s
}

function showGameOver() {
  gameOverActive = true
  draw()
}

function initRewardAd() {
  if (rewardAd) return
  try {
    rewardAd = tt.createRewardedVideoAd({ adUnitId: AD_UNIT_ID })
    rewardAd.onError(function(err) {
      console.log('Error:', err)
    })
    rewardAd.onClose(function(res) {
      if (res && res.isEnded) {
        timeLeft += 60
        gameOverActive = false
        timerStarted = true
        startTimer()
        draw()
      } else {
        draw()
      }
    })
  } catch(e) {
    console.log('Ad init error:', e)
  }
}

function showRewardAd() {
  initRewardAd()
  if (rewardAd) {
    rewardAd.show().catch(function(err) {
      console.log('Ad show error:', err)
      rewardAd.load().catch(function(){})
    })
  }
}

function restartLevel() {
  gameOverActive = false
  startLevel()
}

// ===== Utility =====
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ===== Game Logic =====
function startLevel() {
  var tmpl = TEMPLATES[currentTemplate]

  // Auto-detect grid size from template data (supports 20x20, 80x80, etc.)
  if (tmpl && tmpl.data && tmpl.data.length > 0 && tmpl.data[0] && tmpl.data.length === tmpl.data[0].length && tmpl.data.length !== GRID) {
    GRID = tmpl.data.length;
    CELL = BOARD_SIZE / GRID;
    SLOT_ROWS = GRID > 40 ? 4 : (GRID > 20 ? 3 : 2);
    SLOT_CELL = Math.min(28, (W - PAD * 2) / SLOT_COLS);
    SLOT_TOP = H - 92 - SLOT_ROWS * (SLOT_CELL + 3);
    BTN_TOP = SLOT_TOP + SLOT_ROWS * (SLOT_CELL + 3) + 8;
    CY = 0;
  }
  targetGrid = []
  boardGrid = []
  slotGrid = []

  // Calculate template bounds for centering
  var tMinR = GRID, tMaxR = 0, tMinC = GRID, tMaxC = 0
  for (var r = 0; r < GRID; r++)
    for (var c = 0; c < GRID; c++)
      if (tmpl.data[r] && tmpl.data[r][c] > 0) {
        if (r < tMinR) tMinR = r
        if (r > tMaxR) tMaxR = r
        if (c < tMinC) tMinC = c
        if (c > tMaxC) tMaxC = c
      }
  var tRows = tMaxR - tMinR + 1
  var tCols = tMaxC - tMinC + 1
  var rowOff = Math.floor((GRID - tRows) / 2) - tMinR
  var colOff = Math.floor((GRID - tCols) / 2) - tMinC

  for (var r = 0; r < GRID; r++) {
    targetGrid[r] = []
    for (var c = 0; c < GRID; c++) {
      var sr = r - rowOff
      var sc = c - colOff
      var v = (sr >= 0 && sr < GRID && tmpl.data[sr] && tmpl.data[sr][sc]) || 0
      targetGrid[r][c] = v > 0 ? tmpl.colors[v] : null
    }
  }

  var targetCells = []
  for (var r = 0; r < GRID; r++)
    for (var c = 0; c < GRID; c++)
      if (targetGrid[r][c]) targetCells.push({ row: r, col: c, color: targetGrid[r][c] })
  totalTargetCells = targetCells.length

  for (var r = 0; r < GRID; r++) { boardGrid[r] = []; for (var c = 0; c < GRID; c++) boardGrid[r][c] = null }

  var colorCounts = {}
  for (var i = 0; i < targetCells.length; i++) {
    var c = targetCells[i].color
    colorCounts[c] = (colorCounts[c] || 0) + 1
  }

  var beadArray = []
  for (var col in colorCounts)
    for (var n = 0; n < colorCounts[col]; n++) beadArray.push(col)
  shuffle(beadArray)

  var bi = 0
  for (var r = 0; r < GRID; r++)
    for (var c = 0; c < GRID; c++)
      if (targetGrid[r][c]) boardGrid[r][c] = beadArray[bi++]

  for (var r = 0; r < SLOT_ROWS; r++) { slotGrid[r] = []; for (var c = 0; c < SLOT_COLS; c++) slotGrid[r][c] = null }

  selectedPos = null
  moveHistory = []
  timerStarted = false
  timeLeft = 180
  stopTimer()
  draw()
}
function getConnectedGroup(startR, startC, color) {
  var visited = {}
  var queue = [{ r: startR, c: startC }]
  var group = []
  while (queue.length > 0) {
    var cur = queue.shift()
    var key = cur.r + "," + cur.c
    if (visited[key]) continue
    visited[key] = true
    if (boardGrid[cur.r][cur.c] !== color) continue
    if (boardGrid[cur.r][cur.c] === targetGrid[cur.r][cur.c]) continue
    group.push({ r: cur.r, c: cur.c })
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]]
    for (var d = 0; d < 4; d++) {
      var nr = cur.r + dirs[d][0], nc = cur.c + dirs[d][1]
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && boardGrid[nr][nc] === color && boardGrid[nr][nc] !== targetGrid[nr][nc])
        queue.push({ r: nr, c: nc })
    }
  }
  return group
}

function getConnectedRegion(startR, startC, color) {
  var visited = {}
  var queue = [{ r: startR, c: startC }]
  var region = []
  while (queue.length > 0) {
    var cur = queue.shift()
    var key = cur.r + "," + cur.c
    if (visited[key]) continue
    visited[key] = true
    if (boardGrid[cur.r][cur.c] !== null) continue
    if (targetGrid[cur.r][cur.c] !== color) continue
    region.push({ r: cur.r, c: cur.c })
    var dirs = [[-1,0],[1,0],[0,-1],[0,1]]
    for (var d = 0; d < 4; d++) {
      var nr = cur.r + dirs[d][0], nc = cur.c + dirs[d][1]
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && boardGrid[nr][nc] === null)
        queue.push({ r: nr, c: nc })
    }
  }
  return region
}

function checkVictory() {
  for (var r = 0; r < GRID; r++)
    for (var c = 0; c < GRID; c++)
      if (targetGrid[r][c] && boardGrid[r][c] !== targetGrid[r][c]) return false
  return true
}
// ===== Drawing =====
function draw() {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = "#f0f0f8"
  ctx.fillRect(0, 0, W, H)



  // Board
  ctx.save()
  var cx = PAD + BOARD_SIZE / 2
  var cy = CY + TOP_OFFSET + BOARD_SIZE / 2
  ctx.translate(panX + cx, panY + cy)
  ctx.scale(zoom, zoom)
  ctx.translate(-cx, -cy)
  for (var r = 0; r < GRID; r++) {
    for (var c = 0; c < GRID; c++) {
      var x = PAD + c * CELL + CELL/2
      var y = CY + TOP_OFFSET + r * CELL + CELL/2
      var tc = targetGrid[r][c]
      var bc = boardGrid[r][c]
      var matched = bc && tc && bc === tc

      if (!tc) continue
      // Base
      // Only draw base background for unmatched cells
      if (!matched) {
      var hb = CELL * 0.44
      ctx.beginPath()
      roundRect(ctx, x - hb, y - hb, hb*2, hb*2, CELL*0.08)
      ctx.fill()
      }
      // Bead
      if (bc && !isAnimatingFrom('board', r, c)) {
        var hs = CELL * 0.34
        ctx.fillStyle = "rgba(0,0,0,0.12)"
        ctx.beginPath()
        roundRect(ctx, x - hs + 1, y - hs + 2, hs*2, hs*2, 3)
        ctx.fill()

        ctx.fillStyle = bc
        ctx.beginPath()
        roundRect(ctx, x - hs, y - hs, hs*2, hs*2, 4)
        ctx.fill()

        var grad = ctx.createLinearGradient(x - hs, y - hs, x + hs, y + hs)
        grad.addColorStop(0, "rgba(255,255,255,0.30)")
        grad.addColorStop(0.5, "rgba(255,255,255,0.05)")
        grad.addColorStop(1, "rgba(0,0,0,0.10)")
        ctx.fillStyle = grad
        ctx.beginPath()
        roundRect(ctx, x - hs, y - hs, hs*2, hs*2, 4)
        ctx.fill()

        if (matched) {
          ctx.strokeStyle = bc
          ctx.lineWidth = 2
          ctx.beginPath()
          roundRect(ctx, x - hs - 2, y - hs - 2, hs*2 + 4, hs*2 + 4, 5)
          ctx.stroke()
        }
      }
    }
  }
  ctx.restore()

  // Timer
  ctx.fillStyle = timeLeft <= 30 ? "#ff5252" : "#7c4dff"
  ctx.font = "bold 22px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("⏱ " + formatTime(timeLeft), W/2, SAFE_TOP + 20)

  // Title
  ctx.fillStyle = "#4a148c"
  ctx.font = "bold 18px sans-serif"
  ctx.fillText("🧩 拼豆配对", W/2, SAFE_TOP + 44)

  // Stats
  var correct = 0
  for (var r = 0; r < GRID; r++)
    for (var c = 0; c < GRID; c++)
      if (targetGrid[r][c] && boardGrid[r][c] === targetGrid[r][c]) correct++

  // Slot header

  // Slot grid
  var slotStartX = PAD
  for (var r = 0; r < SLOT_ROWS; r++) {
    for (var c = 0; c < SLOT_COLS; c++) {
      var sx = slotStartX + c * SLOT_CELL
      var sy = CY + SLOT_TOP + r * (SLOT_CELL + 3)
      var color = slotGrid[r] && slotGrid[r][c]
      var sel = selectedPos && selectedPos.type === "slot" && selectedPos.r === r && selectedPos.c === c

      ctx.fillStyle = color ? (sel ? "#ddd" : "#e8e8f0") : "#e8e8f0"
      ctx.beginPath()
      roundRect(ctx, sx, sy, SLOT_CELL, SLOT_CELL, 3)
      ctx.fill()

      if (!color) {
        ctx.strokeStyle = "#ccc"
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        roundRect(ctx, sx, sy, SLOT_CELL, SLOT_CELL, 3)
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (color && !isAnimatingFrom('slot', r, c)) {
        ctx.fillStyle = color
        ctx.beginPath()
        roundRect(ctx, sx + 1, sy + 1, SLOT_CELL - 2, SLOT_CELL - 2, 2)
        ctx.fill()

        var grad = ctx.createLinearGradient(sx, sy, sx + SLOT_CELL, sy + SLOT_CELL)
        grad.addColorStop(0, "rgba(255,255,255,0.25)")
        grad.addColorStop(0.5, "rgba(255,255,255,0.05)")
        grad.addColorStop(1, "rgba(0,0,0,0.08)")
        ctx.fillStyle = grad
        ctx.beginPath()
        roundRect(ctx, sx + 1, sy + 1, SLOT_CELL - 2, SLOT_CELL - 2, 2)
        ctx.fill()
      }

      if (sel) {
        ctx.strokeStyle = "#7c4dff"
        ctx.lineWidth = 2
        ctx.beginPath()
        roundRect(ctx, sx - 1, sy - 1, SLOT_CELL + 2, SLOT_CELL + 2, 4)
        ctx.stroke()
      }
    }
  }

  // Bottom buttons
  var btnY = CY + BTN_TOP
  var btnW = (W - PAD * 2 - 6) / 2
  var btns = [{ label: "🔄 新一局", action: "newGame" }, { label: "↩ 撤销", action: "undo" }]
  for (var i = 0; i < btns.length; i++) {
    var bx = PAD + i * (btnW + 6)
    ctx.fillStyle = "#7c4dff"
    ctx.beginPath()
    roundRect(ctx, bx, btnY, btnW, 32, 6)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = "13px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(btns[i].label, bx + btnW/2, btnY + 21)
  }
  }
  // ===== Level Selector =====
  if (!HIDE_LEVEL_SELECTOR) {
    var selToggleY = CY + BTN_TOP + 48;
    ctx.fillStyle = levelSelectorVisible ? "#6a1b9a" : "#9c27b0";
    ctx.beginPath();
    roundRect(ctx, PAD, selToggleY, W - PAD * 2, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((levelSelectorVisible ? "▲ " : "▼ ") + "关卡选择 (" + TEMPLATE_ORDER.length + "关)", W/2, selToggleY + 17);
    if (levelSelectorVisible) {
      var totalRows = Math.ceil(TEMPLATE_ORDER.length / 4);
      var panelH = totalRows * (24 + 4);
      var selPanelY = (selToggleY > H * 0.6) ? selToggleY - panelH - 10 : selToggleY + 30;
      var cols = 4;
      var rowH = 24;
      var gap = 4;
      var itemW = (W - PAD * 2 - gap * (cols - 1)) / cols;
      var curIdx = TEMPLATE_ORDER.indexOf(currentTemplate);
      ctx.fillStyle = "rgba(240,240,248,0.95)";
      ctx.beginPath();
      roundRect(ctx, PAD, selPanelY - 2, W - PAD * 2, panelH + 4, 6);
      ctx.fill();
      ctx.strokeStyle = "#d0d0e0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundRect(ctx, PAD, selPanelY - 2, W - PAD * 2, panelH + 4, 6);
      ctx.stroke();
      for (var li = 0; li < TEMPLATE_ORDER.length; li++) {
        var r2 = Math.floor(li / cols);
        var c2 = li % cols;
        var lx = PAD + 2 + c2 * (itemW + gap);
        var ly = selPanelY + r2 * (rowH + gap);
        var isCur = (li === curIdx);
        ctx.fillStyle = isCur ? "#7c4dff" : "#e8e0f0";
        ctx.beginPath();
        roundRect(ctx, lx, ly, itemW, rowH, 4);
        ctx.fill();
        ctx.fillStyle = isCur ? "#fff" : "#4a148c";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        var labelStr = TEMPLATE_ORDER[li];
        ctx.fillText(labelStr.substring(0, 9), lx + itemW/2, ly + 15);
      }
    }
  }


  // Zoom slider
  var sliderX = 4
  var sliderY = CY + TOP_OFFSET + 20
  var sliderH = BOARD_SIZE - 40
  var sliderW = 6
  var thumbR = 10
  var thumbY = sliderY + (1 - (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * sliderH

  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.beginPath()
  roundRect(ctx, sliderX, sliderY, sliderW, sliderH, 3)
  ctx.fill()

  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.beginPath()
  ctx.arc(sliderX + sliderW / 2, thumbY, thumbR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#7c4dff"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(sliderX + sliderW / 2, thumbY, thumbR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = "#7c4dff"
  ctx.font = "10px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("+" + Math.round(zoom * 10) / 10 + "x", sliderX + sliderW / 2, sliderY - 6)
  // Victory overlay
  if (checkVictory()) {
    stopTimer()
    playSfx('win')
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    roundRect(ctx, W/2 - 100, CY + H/2 - 80, 200, 160, 16)
    ctx.fill()
    ctx.fillStyle = "#4a148c"
    ctx.font = "bold 28px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("🎉", W/2, CY + H/2 - 40)
    ctx.font = "bold 18px sans-serif"
    ctx.fillText("通关啦！", W/2, CY + H/2 - 8)
    ctx.fillStyle = "#666"
    ctx.font = "14px sans-serif"
    ctx.fillText("所有色块已匹配", W/2, CY + H/2 + 18)
    ctx.fillStyle = "#7c4dff"
    ctx.beginPath()
    roundRect(ctx, W/2 - 50, CY + H/2 + 36, 100, 32, 6)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = "14px sans-serif"
    ctx.fillText("下一关", W/2, CY + H/2 + 57)
  }
  // Game over overlay
  if (gameOverActive) {
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    roundRect(ctx, W/2 - 110, CY + H/2 - 90, 220, 180, 16)
    ctx.fill()
    ctx.fillStyle = "#ff5252"
    ctx.font = "bold 24px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("⏰ 时间到！", W/2, CY + H/2 - 52)
    ctx.fillStyle = "#666"
    ctx.font = "14px sans-serif"
    ctx.fillText("未能在3分钟内完成拼图", W/2, CY + H/2 - 24)
    if (adEnabled) {
      ctx.fillStyle = "#ff9800"
      ctx.beginPath()
      roundRect(ctx, W/2 - 80, CY + H/2 + 4, 160, 38, 8)
      ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.font = "bold 14px sans-serif"
      ctx.fillText("▶ 看广告续时60秒", W/2, CY + H/2 + 29)
    }
    ctx.fillStyle = "#7c4dff"
    ctx.beginPath()
    roundRect(ctx, W/2 - 80, CY + H/2 + 50, 160, 38, 8)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = "bold 14px sans-serif"
    ctx.fillText("🔄 重新挑战", W/2, CY + H/2 + 75)
  }
  // Draw animated blocks with dramatic effects
  if (animBatch) {
    for (var ai = 0; ai < animBatch.batch.length; ai++) {
      var m = animBatch.batch[ai]
      var bp = Math.max(0, Math.min(1, (animBatch.progress * animBatch.totalDur - m.stagger) / ANIM_DURATION))
      if (bp <= 0) continue
      var pp = easeOutQuad(bp)
      var from = getCenter(m.fromType, m.fr, m.fc)
      var to = getCenter(m.toType, m.tr, m.tc)
      // High arc trajectory
      var arcH = Math.sin(pp * Math.PI) * 25
      var cx2 = from.x + (to.x - from.x) * pp
      var cy2 = from.y + (to.y - from.y) * pp - arcH
      // Dramatic scale: shrink then expand
      var baseS = (m.fromType === 'board') ? CELL * 0.7 : SLOT_CELL * 0.7
      var scaleP = 1 - Math.sin(pp * Math.PI) * 0.35
      var s = baseS / scaleP
      // Ghost trail
      for (var trail = 0; trail < 5; trail++) {
        var tp = pp - 0.04 * (trail + 1)
        if (tp > 0) {
          var tx = from.x + (to.x - from.x) * tp
          var ty = from.y + (to.y - from.y) * tp - Math.sin(tp * Math.PI) * 25
          var ts = baseS / (1 - Math.sin(tp * Math.PI) * 0.35)
          ctx.globalAlpha = 0.15 * (1 - trail * 0.18)
          ctx.fillStyle = m.color
          ctx.beginPath()
          roundRect(ctx, tx - ts/2, ty - ts/2, ts, ts, 4)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1.0
      // Big shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)"
      ctx.beginPath()
      roundRect(ctx, cx2 - s/2 + 3, cy2 - s/2 + 5, s, s, 4)
      ctx.fill()
      // Glow
      ctx.shadowColor = m.color
      ctx.shadowBlur = 15
      ctx.fillStyle = m.color
      ctx.beginPath()
      roundRect(ctx, cx2 - s/2, cy2 - s/2, s, s, 4)
      ctx.fill()
      ctx.shadowBlur = 0
      // Inner highlight
      var grad2 = ctx.createLinearGradient(cx2 - s/2, cy2 - s/2, cx2 + s/2, cy2 + s/2)
      grad2.addColorStop(0, "rgba(255,255,255,0.40)")
      grad2.addColorStop(0.5, "rgba(255,255,255,0.05)")
      grad2.addColorStop(1, "rgba(0,0,0,0.15)")
      ctx.fillStyle = grad2
      ctx.beginPath()
      roundRect(ctx, cx2 - s/2, cy2 - s/2, s, s, 4)
      ctx.fill()
    }
  }

// ===== Touch Handling =====
var touchStartPos = null

tt.onTouchStart(function(e) {
  var t = e.touches[0]
  touchStartPos = { x: t.clientX, y: t.clientY }
  // When zoomed, board is larger than screen - allow panning from anywhere
  if (zoom > 1.0) {
    panStartX = t.clientX
    panStartY = t.clientY
    panStartPanX = panX
    panStartPanY = panY
  }
  // Check zoom slider
  var sx = 4, sy2 = CY + TOP_OFFSET + 20, sh2 = BOARD_SIZE - 40, sw2 = 6, tr = 10
  if (t.clientX >= sx - tr && t.clientX <= sx + sw2 + tr && t.clientY >= sy2 - tr && t.clientY <= sy2 + sh2 + tr) {
    zoomSliderDragging = true
    var ratio = 1 - (t.clientY - sy2) / sh2
    ratio = Math.max(0, Math.min(1, ratio))
    zoom = MIN_ZOOM + ratio * (MAX_ZOOM - MIN_ZOOM)
    draw()
    return
  }
})

tt.onTouchMove(function(e) {
  var t = e.touches[0]
  if (zoomSliderDragging) {
    var sy2 = CY + TOP_OFFSET + 20
    var sh2 = BOARD_SIZE - 40
    var ratio = 1 - (t.clientY - sy2) / sh2
    ratio = Math.max(0, Math.min(1, ratio))
    zoom = MIN_ZOOM + ratio * (MAX_ZOOM - MIN_ZOOM)
    draw()
    return
  }
  if (zoom > 1.0 && panStartX !== 0) {
    var dx = t.clientX - panStartX
    var dy = t.clientY - panStartY
    // Only pan if finger moved enough (5px threshold)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      panX = panStartPanX + dx
      panY = panStartPanY + dy
      isPanning = true
      draw()
    }
  }
})
tt.onTouchEnd(function(e) {
  if (!touchStartPos) return
  var t = e.changedTouches[0]
  var tx = t.clientX, ty = t.clientY
  var dx = tx - touchStartPos.x, dy = ty - touchStartPos.y
  touchStartPos = null
  zoomSliderDragging = false
  var wasPanning = isPanning
  isPanning = false
  panStartX = 0

  // Ignore if swiped (scrolling)
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return

  // Check music toggle
  if (tx >= W - 40 && tx <= W && ty >= SAFE_TOP && ty <= SAFE_TOP + 40) {
    toggleMusic()
    return
  }

  // Check victory overlay first
  if (checkVictory()) {
    var btnX = W/2 - 50, btnY2 = CY + H/2 + 36
    if (tx >= btnX && tx <= btnX + 100 && ty >= btnY2 && ty <= btnY2 + 32) {
      var curIdx = TEMPLATE_ORDER.indexOf(currentTemplate)
      var nextIdx = (curIdx + 1) % TEMPLATE_ORDER.length
      currentTemplate = TEMPLATE_ORDER[nextIdx]
      startLevel()
    }
    return
  }

  // Check game over overlay
  if (gameOverActive) {
    var adBtnX = W/2 - 80, adBtnY = CY + H/2 + 4, adBtnW = 160, adBtnH = 38
    var retryBtnY = CY + H/2 + 50
    if (adEnabled && tx >= adBtnX && tx <= adBtnX + adBtnW && ty >= adBtnY && ty <= adBtnY + adBtnH) {
      // Watch ad to add 60 seconds
      showRewardAd()
      return
    }
    if (tx >= adBtnX && tx <= adBtnX + adBtnW && ty >= retryBtnY && ty <= retryBtnY + adBtnH) {
      // Restart level
      gameOverActive = false
      startLevel()
      return
    }
    return
  }

  // Level selector toggle
  if (!HIDE_LEVEL_SELECTOR) {
    var selToggleY = CY + BTN_TOP + 48;
    if (ty >= selToggleY && ty <= selToggleY + 26 && tx >= PAD && tx <= W - PAD) {
      levelSelectorVisible = !levelSelectorVisible;
      draw();
      return;
    }
    if (levelSelectorVisible) {
      var cols = 4;
      var rowH = 24;
      var gap = 4;
      var itemW = (W - PAD * 2 - gap * (cols - 1)) / cols;
      var totalRows = Math.ceil(TEMPLATE_ORDER.length / 4);
      var panelH = totalRows * (24 + 4);
      var selPanelY = (selToggleY > H * 0.6) ? selToggleY - panelH - 10 : selToggleY + 30;
      for (var li = 0; li < TEMPLATE_ORDER.length; li++) {
        var r2 = Math.floor(li / cols);
        var c2 = li % cols;
        var lx = PAD + 2 + c2 * (itemW + gap);
        var ly = selPanelY + r2 * (rowH + gap);
        if (tx >= lx && tx <= lx + itemW && ty >= ly && ty <= ly + rowH) {
          if (TEMPLATE_ORDER[li] !== currentTemplate) {
            levelSelectorVisible = false;
            currentTemplate = TEMPLATE_ORDER[li];
            startLevel();
          }
          return;
        }
      }
    }
  }

  if (wasPanning) return

  // Transform to board coordinates
  var cx3 = PAD + BOARD_SIZE / 2
  var cy3 = CY + TOP_OFFSET + BOARD_SIZE / 2
  var bx = (tx - panX - cx3) / zoom + cx3
  var by = (ty - panY - cy3) / zoom + cy3
  var bCol = Math.floor((bx - PAD) / CELL)
  var bRow = Math.floor((by - CY - TOP_OFFSET) / CELL)
  var onBoard = (bRow >= 0 && bRow < GRID && bCol >= 0 && bCol < GRID)
  // Check slot screen coordinates
  var onSlot = (ty >= CY + SLOT_TOP && ty <= CY + SLOT_TOP + SLOT_ROWS * (SLOT_CELL + 3))
  var sCol = Math.floor((tx - PAD) / SLOT_CELL)
  var sRow = Math.floor((ty - CY - SLOT_TOP) / (SLOT_CELL + 3))
  var onSlotGrid = onSlot && sRow >= 0 && sRow < SLOT_ROWS && sCol >= 0 && sCol < SLOT_COLS
  // 2. Slots with beads (when no board action at this position)
  if (onSlotGrid) {
    var slotBead = slotGrid[sRow] && slotGrid[sRow][sCol]
    if (slotBead) {
      handleSlotTap(sRow, sCol)
      return
    }
  }
  // 1. Board actionable cells (only when NOT on slot grid)
  if (onBoard && !onSlotGrid) {
    var bBead = boardGrid[bRow] && boardGrid[bRow][bCol]
    var bTarget = targetGrid[bRow] && targetGrid[bRow][bCol]
    if (bBead || (selectedPos && selectedPos.type === "slot" && bTarget)) {
      handleBoardTap(bRow, bCol)
      return
    }
  }
  // 3. Board (any remaining cell - for non-zoomed deselection)
  if (onBoard && !onSlotGrid) {
    handleBoardTap(bRow, bCol)
    return
  }
  // 4. Empty slots (for non-zoomed interactions)
  if (onSlotGrid) {
    handleSlotTap(sRow, sCol)
    return
  }

})

function handleBoardTap(row, col) {
  var bead = boardGrid[row][col]
  var target = targetGrid[row][col]

  if (!bead || !target) {
    if (selectedPos && selectedPos.type === "slot" && target) {
      var sr = selectedPos.r, sc = selectedPos.c
      var slotBead = slotGrid[sr][sc]
      if (slotBead && slotBead === target) {
        var region = getConnectedRegion(row, col, slotBead)
        var avail = []
        for (var r = 0; r < SLOT_ROWS; r++)
          for (var c = 0; c < SLOT_COLS; c++)
            if (slotGrid[r][c] === slotBead) avail.push({ r, c })
        var toFill = Math.min(region.length, avail.length)
        if (toFill > 0) {
          var moves = []
          for (var i = 0; i < toFill; i++) {
            moves.push({ sr: avail[i].r, sc: avail[i].c, br: region[i].r, bc: region[i].c, clr: slotBead })
            boardGrid[region[i].r][region[i].c] = slotBead
            slotGrid[avail[i].r][avail[i].c] = null
          }
          playSfx('place')
          moveHistory.push({ type: "autoFill", moves })
          selectedPos = null
          draw()
        }
      }
    }
    return
  }

  if (bead === target) {
    selectedPos = null
    draw()
    return
  }

  // Start timer on first move
  if (!timerStarted) { timerStarted = true; startTimer() }

  // Wrong bead - flood fill group
  var group = getConnectedGroup(row, col, bead)
  if (group.length === 0) return

  var emptySlots = []
  for (var r = 0; r < SLOT_ROWS; r++)
    for (var c = 0; c < SLOT_COLS; c++)
      if (!slotGrid[r][c]) emptySlots.push({ r, c })
  var toMove = Math.min(group.length, emptySlots.length)
  if (toMove === 0) return

  var moved = []
  for (var i = 0; i < toMove; i++) {
    var bp = group[i], sp = emptySlots[i]
    var cellColor = boardGrid[bp.r][bp.c]
    if (!cellColor) continue
    moved.push({ br: bp.r, bc: bp.c, sr: sp.r, sc: sp.c, color: cellColor })
    slotGrid[sp.r][sp.c] = cellColor
    boardGrid[bp.r][bp.c] = null
  }
  playSfx('move')
  moveHistory.push({ type: "groupMove", moves: moved })
  selectedPos = null
  draw()
}

function handleSlotTap(sr, sc) {
  var bead = slotGrid[sr][sc]
  if (selectedPos) {
    if (selectedPos.type === "slot" && selectedPos.r === sr && selectedPos.c === sc) {
      selectedPos = null
      draw()
      return
    }
    if (bead && selectedPos.type === "slot") {
      var ssr = selectedPos.r, ssc = selectedPos.c
      var selBead = slotGrid[ssr][ssc]
      if (selBead) {
        moveHistory.push({ type: "swapSlots", r1: ssr, c1: ssc, r2: sr, c2: sc, c1c: selBead, c2c: bead })
        slotGrid[ssr][ssc] = bead
        slotGrid[sr][sc] = selBead
        selectedPos = null
        draw()
        return
      }
    }
    if (!bead && selectedPos.type === "slot") {
      var ssr = selectedPos.r, ssc = selectedPos.c
      var selBead = slotGrid[ssr][ssc]
      if (selBead) {
        moveHistory.push({ type: "moveSlot", fromR: ssr, fromC: ssc, toR: sr, toC: sc, color: selBead })
        slotGrid[sr][sc] = selBead
        slotGrid[ssr][ssc] = null
        selectedPos = { type: "slot", r: sr, c: sc }
        draw()
        return
      }
    }
    if (bead) {
      selectedPos = { type: "slot", r: sr, c: sc }
      draw()
      return
    }
    selectedPos = null
    draw()
    return
  }
  if (bead) {
    selectedPos = { type: "slot", r: sr, c: sc }
    draw()
    return
  }
}

function undo() {
  if (moveHistory.length === 0) return
  var last = moveHistory.pop()

  if (last.type === "groupMove") {
    for (var i = 0; i < last.moves.length; i++) {
      var m = last.moves[i]
      boardGrid[m.br][m.bc] = m.color
      slotGrid[m.sr][m.sc] = null
    }
  } else if (last.type === "autoFill") {
    for (var i = 0; i < last.moves.length; i++) {
      var m = last.moves[i]
      boardGrid[m.br][m.bc] = null
      slotGrid[m.sr][m.sc] = m.clr
    }
  } else if (last.type === "moveSlot") {
    slotGrid[last.fromR][last.fromC] = last.color
    slotGrid[last.toR][last.toC] = null
  } else if (last.type === "swapSlots") {
    slotGrid[last.r1][last.c1] = last.c2c
    slotGrid[last.r2][last.c2] = last.c1c
  }

  selectedPos = null
  draw()
}

// ===== Load custom levels from storage =====
function loadCustomLevels() {
  try {
    var stored = tt.getStorageSync("puzzle_levels");
    if (stored) {
      var data = (typeof stored === "string") ? JSON.parse(stored) : stored;
      if (data && data.levels) {
        for (var key in data.levels) {
          if (data.levels[key] && data.levels[key].data && data.levels[key].colors) {
            TEMPLATES[key] = ensureHexColors(data.levels[key]);
            if (TEMPLATE_ORDER.indexOf(key) === -1) {
              TEMPLATE_ORDER.push(key);
            }
          }
        }
        return;
      }
    }
    // Legacy format
    var legacy = tt.getStorageSync("puzzle_custom_templates");
    if (legacy) {
      var customs = (typeof legacy === "string") ? JSON.parse(legacy) : legacy;
      for (var key in customs) {
        if (customs[key] && customs[key].data && customs[key].colors) {
          TEMPLATES[key] = ensureHexColors(customs[key]);
          if (TEMPLATE_ORDER.indexOf(key) === -1) {
            TEMPLATE_ORDER.push(key);
          }
        }
      }
    }
  } catch(e) {}
}

// ===== CDN level loading (for production) =====
var LEVELS_CDN_URL = '';  // 上线后设为远程 JSON 地址，如 https://example.com/levels.json
function loadLevelsFromCDN() {
  if (!LEVELS_CDN_URL) return;
  try {
    tt.request({
      url: LEVELS_CDN_URL,
      success: function(res) {
        var data = res.data;
        if (data && data.levels) {
          var newLevels = false;
          for (var key in data.levels) {
            if (data.levels[key] && data.levels[key].data && data.levels[key].colors) {
              TEMPLATES[key] = ensureHexColors(data.levels[key]);
              if (TEMPLATE_ORDER.indexOf(key) === -1) {
                TEMPLATE_ORDER.push(key);
                newLevels = true;
              }
            }
          }
          // Auto-switch to custom level if CDN loaded new levels
          if (newLevels && currentTemplate === 'heart' && TEMPLATE_ORDER.length > 7) {
            currentTemplate = TEMPLATE_ORDER[7];
            draw();
          }
        }
      }
    });
  } catch(e) {}
}

// Load published_levels.json (saved by PC admin)
try {
  var fsm = tt.getFileSystemManager();
  var pubStr = fsm.readFileSync("published_levels.json", "utf8");
  var pubData = JSON.parse(pubStr);
  if (pubData && pubData.levels) {
    for (var key in pubData.levels) {
      if (pubData.levels[key] && pubData.levels[key].data && pubData.levels[key].colors) {
        TEMPLATES[key] = ensureHexColors(pubData.levels[key]);
        if (TEMPLATE_ORDER.indexOf(key) === -1) {
          TEMPLATE_ORDER.push(key);
        }
      }
    }
  }
} catch(e) {
  // published_levels.json not found - OK, use storage-only
}
loadCustomLevels();
loadLevelsFromCDN();

// ===== Hot Reload: Sync levels from PC admin without recompile =====
function reloadLevelsFromStorage() {
  try {
    var stored = tt.getStorageSync("puzzle_levels");
    if (stored) {
      var data = (typeof stored === 'string') ? JSON.parse(stored) : stored;
      if (data && data.levels) {
        for (var key in data.levels) {
          if (data.levels[key] && data.levels[key].data && data.levels[key].colors) {
            TEMPLATES[key] = ensureHexColors(data.levels[key]);
            if (TEMPLATE_ORDER.indexOf(key) === -1) {
              TEMPLATE_ORDER.push(key);
            }
            console.log('[HotReload] Loaded level: ' + key);
          }
        }
        if (TEMPLATES[currentTemplate]) {
          startLevel();
        } else {
          currentTemplate = TEMPLATE_ORDER[0];
          startLevel();
        }
        console.log('[HotReload] Levels synced! Total: ' + TEMPLATE_ORDER.length);
      }
    }
  } catch(e) {
    console.log('[HotReload] Error:', e);
  }
}
if (TEMPLATE_ORDER.length > 7) {
  for (var si = 7; si < TEMPLATE_ORDER.length; si++) {
    currentTemplate = TEMPLATE_ORDER[si];
    break;
  }
}
try { initAudio(); playBgm(); startLevel() } catch(e) { tt.showModal({ title:"启动失败", content:e.message||String(e), showCancel:false }) }


















