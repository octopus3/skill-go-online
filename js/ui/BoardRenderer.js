import { EMPTY, BLACK, WHITE } from "../config/constants.js";

/**
 * Canvas：木纹底、网格、星位、棋子、最后一手、禁区叉、悬浮预览
 */
export class BoardRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.game = game;
    this.hoverCell = null;
    this.hoverColor = null;
    this.animPulse = 0;
  }

  setGame(game) {
    this.game = game;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._w = w;
    this._h = h;
    const pad = Math.min(w, h) * 0.06;
    this.pad = pad;
    const inner = Math.min(w, h) - 2 * pad;
    this.cell = inner / (this.game.size - 1);
    this.offX = (w - inner) / 2;
    this.offY = (h - inner) / 2;
  }

  gridToPixel(x, y) {
    return {
      px: this.offX + x * this.cell,
      py: this.offY + y * this.cell,
    };
  }

  pixelToGrid(px, py) {
    const x = Math.round((px - this.offX) / this.cell);
    const y = Math.round((py - this.offY) / this.cell);
    const n = this.game.size;
    if (x < 0 || x >= n || y < 0 || y >= n) return null;
    return { x, y };
  }

  _starPoints(n) {
    if (n === 19)
      return [
        [3, 3],
        [9, 3],
        [15, 3],
        [3, 9],
        [9, 9],
        [15, 9],
        [3, 15],
        [9, 15],
        [15, 15],
      ];
    if (n === 13)
      return [
        [3, 3],
        [9, 3],
        [3, 9],
        [9, 9],
        [6, 6],
      ];
    if (n === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
    return [];
  }

  draw({ forbiddenBlack, forbiddenWhite, uiMode, allowPlacement }) {
    const ctx = this.ctx;
    const w = this._w;
    const h = this._h;
    ctx.clearRect(0, 0, w, h);

    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#e8d4b8");
    grd.addColorStop(0.5, "#dcb896");
    grd.addColorStop(1, "#c9a574");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#1a1208";
    ctx.lineWidth = 1;
    const n = this.game.size;
    for (let i = 0; i < n; i++) {
      const a = this.gridToPixel(i, 0);
      const b = this.gridToPixel(i, n - 1);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
      const c = this.gridToPixel(0, i);
      const d = this.gridToPixel(n - 1, i);
      ctx.beginPath();
      ctx.moveTo(c.px, c.py);
      ctx.lineTo(d.px, d.py);
      ctx.stroke();
    }

    ctx.fillStyle = "#1a1208";
    for (const [sx, sy] of this._starPoints(n)) {
      const p = this.gridToPixel(sx, sy);
      ctx.beginPath();
      ctx.arc(p.px, p.py, n >= 15 ? 3.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawBan = (set, color) => {
      if (!set) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const key of set) {
        const [xs, ys] = key.split(",").map(Number);
        const p = this.gridToPixel(xs, ys);
        const s = this.cell * 0.22;
        ctx.beginPath();
        ctx.moveTo(p.px - s, p.py - s);
        ctx.lineTo(p.px + s, p.py + s);
        ctx.moveTo(p.px + s, p.py - s);
        ctx.lineTo(p.px - s, p.py + s);
        ctx.stroke();
      }
    };
    drawBan(forbiddenBlack, "rgba(180,40,40,0.85)");
    drawBan(forbiddenWhite, "rgba(40,80,180,0.85)");

    const r = this.cell * 0.42;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = this.game.board[y][x];
        if (c === EMPTY) continue;
        const p = this.gridToPixel(x, y);
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        if (c === BLACK) {
          const g = ctx.createRadialGradient(
            p.px - r * 0.35,
            p.py - r * 0.35,
            r * 0.1,
            p.px,
            p.py,
            r
          );
          g.addColorStop(0, "#555");
          g.addColorStop(1, "#0a0a0a");
          ctx.fillStyle = g;
        } else {
          const g = ctx.createRadialGradient(
            p.px - r * 0.35,
            p.py - r * 0.35,
            r * 0.1,
            p.px,
            p.py,
            r
          );
          g.addColorStop(0, "#fff");
          g.addColorStop(1, "#c8c8c8");
          ctx.fillStyle = g;
        }
        ctx.fill();
        ctx.strokeStyle = c === BLACK ? "#000" : "#888";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    const lm = this.game.lastMove;
    if (lm) {
      const p = this.gridToPixel(lm.x, lm.y);
      ctx.fillStyle = "#c62828";
      ctx.beginPath();
      ctx.arc(p.px, p.py, Math.max(2, r * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }

    const allowGhost =
      typeof allowPlacement === "boolean"
        ? allowPlacement
        : uiMode === "normal";

    if (this.hoverCell && allowGhost) {
      const { x, y } = this.hoverCell;
      if (this.game.board[y][x] === EMPTY && this.hoverColor) {
        const p = this.gridToPixel(x, y);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(p.px, p.py, r * (0.95 + 0.05 * Math.sin(this.animPulse)), 0, Math.PI * 2);
        ctx.fillStyle = this.hoverColor === BLACK ? "#000" : "#fff";
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    this.animPulse += 0.12;
  }
}
