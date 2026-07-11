// game.js - 拼豆配对 抖音小游戏版
const canvas = tt.createCanvas()
const ctx = canvas.getContext('2d')
const sys = tt.getSystemInfoSync()
const W = sys.windowWidth
const H = sys.windowHeight
canvas.width = W
canvas.height = H

// roundRect polyfill for Douyin
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r !== "number") r = (r && r[0]) || 0;
    r = Math.min(r, w/2, h/2);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}
