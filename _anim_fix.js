const fs = require("fs");
const path = require("path");
const targetFile = path.join(__dirname, "wechat-game", "game.js");
const buf = fs.readFileSync(targetFile);
let code = buf.toString("utf8");

// Replace autoFill section
const autoFillRegex = /var moves = \[\][\s\S]*?(playSfx\('place'\)\s*)moveHistory\.push\(\{ type: "autoFill", moves \}\)\s*selectedPos = null\s*draw\(\)/;
const autoFillReplace = 'var moves = []\n          var animMoves = []\n          for (var i = 0; i < toFill; i++) {\n            moves.push({ sr: avail[i].r, sc: avail[i].c, br: region[i].r, bc: region[i].c, clr: slotBead })\n            animMoves.push({ fromType: "slot", fr: avail[i].r, fc: avail[i].c, toType: "board", tr: region[i].r, tc: region[i].c, color: slotBead })\n          }\n          $1var movesCopy = moves.slice()\n          startAnimBatch(animMoves, function() {\n            for (var xi = 0; xi < movesCopy.length; xi++) {\n              var mx = movesCopy[xi]\n              boardGrid[mx.br][mx.bc] = mx.clr\n              slotGrid[mx.sr][mx.sc] = null\n            }\n            moveHistory.push({ type: "autoFill", moves: movesCopy })\n            selectedPos = null\n            draw()\n          })';
code = code.replace(autoFillRegex, autoFillReplace);

// Replace groupMove section
const groupMoveRegex = /var moved = \[\][\s\S]*?(playSfx\('move'\)\s*)moveHistory\.push\(\{ type: "groupMove", moves: moved \}\)\s*selectedPos = null\s*draw\(\)/;
const groupMoveReplace = 'var moved = []\n          var animMoves = []\n          for (var i = 0; i < toMove; i++) {\n            var bp = group[i], sp = emptySlots[i]\n            var cellColor = boardGrid[bp.r][bp.c]\n            if (!cellColor) continue\n            moved.push({ br: bp.r, bc: bp.c, sr: sp.r, sc: sp.c, color: cellColor })\n            animMoves.push({ fromType: "board", fr: bp.r, fc: bp.c, toType: "slot", tr: sp.r, tc: sp.c, color: cellColor })\n          }\n          $1var movedCopy = moved.slice()\n          startAnimBatch(animMoves, function() {\n            for (var xi = 0; xi < movedCopy.length; xi++) {\n              var mx = movedCopy[xi]\n              slotGrid[mx.sr][mx.sc] = mx.color\n              boardGrid[mx.br][mx.bc] = null\n            }\n            moveHistory.push({ type: "groupMove", moves: movedCopy })\n            selectedPos = null\n            draw()\n          })';
code = code.replace(groupMoveRegex, groupMoveReplace);

fs.writeFileSync(targetFile, code, "utf8");
try { new Function(code); console.log("Syntax OK"); } catch(e) { console.log("FAIL:", e.message); }
const c = (code.match(/startAnimBatch/g) || []).length;
console.log("startAnimBatch count:", c);
