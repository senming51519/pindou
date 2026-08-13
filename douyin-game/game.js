// game.js - 拼豆配对 抖音小游戏版（平台包装层）
// 核心逻辑位于 shared-game-core.js（由 copy-core.bat 同步）

var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}));
_g.GamePlatform = tt;
_g.GamePlatform._ANIM_DURATION = 350;
_g.GamePlatform._STAGGER_BASE = 120;

require('./shared-game-core.js');