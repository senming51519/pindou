// game.js - 拼豆配对 微信小游戏版（平台包装层）
// 核心逻辑位于 shared-game-core.js（由 copy-core.bat 同步）

var _g = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}));
_g.GamePlatform = wx;
_g.GamePlatform._ANIM_DURATION = 600;
_g.GamePlatform._STAGGER_BASE = 80;
_g.GamePlatform._TEST_SKIP = -1;

require('./shared-game-core.js');
