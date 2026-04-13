import {
  EMPTY,
  BLACK,
  WHITE,
  opponentColor,
  KO_HISTORY_DEPTH,
} from "../config/constants.js";

/**
 * 围棋规则引擎：落子、气、提子、劫（局面历史）
 */
export class GoGame {
  constructor(size) {
    this.size = size;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: this.size }, () =>
      Array(this.size).fill(EMPTY)
    );
    this.prisoners = { [BLACK]: 0, [WHITE]: 0 };
    this.positionHistory = [];
    this.lastMove = null;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  cloneBoard() {
    return this.board.map((row) => row.slice());
  }

  setBoardFrom(board2d) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        this.board[y][x] = board2d[y][x];
      }
    }
  }

  boardKey() {
    return this.board.map((r) => r.join("")).join("/");
  }

  getGroup(sx, sy) {
    const color = this.board[sy][sx];
    if (color === EMPTY) return null;
    const stones = [];
    const stack = [[sx, sy]];
    const seen = new Set();
    const key = (x, y) => `${x},${y}`;
    while (stack.length) {
      const [x, y] = stack.pop();
      const k = key(x, y);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!this.inBounds(x, y) || this.board[y][x] !== color) continue;
      stones.push([x, y]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        stack.push([x + dx, y + dy]);
      }
    }
    return { color, stones };
  }

  countLiberties(group) {
    if (!group) return 0;
    const lib = new Set();
    for (const [x, y] of group.stones) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.board[ny][nx] === EMPTY) lib.add(`${nx},${ny}`);
      }
    }
    return lib.size;
  }

  /** 返回无气的 color 方棋子坐标列表 */
  collectDeadStones(color) {
    const seen = new Set();
    const dead = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] !== color) continue;
        const k = `${x},${y}`;
        if (seen.has(k)) continue;
        const g = this.getGroup(x, y);
        for (const [gx, gy] of g.stones) seen.add(`${gx},${gy}`);
        if (this.countLiberties(g) === 0) {
          for (const s of g.stones) dead.push({ x: s[0], y: s[1] });
        }
      }
    }
    return dead;
  }

  /**
   * 尝试落子（会修改棋盘）
   * @param {boolean} opts.ignoreKo 技能等特殊情形可跳过劫检查
   */
  tryPlay(x, y, color, { ignoreKo = false } = {}) {
    if (!this.inBounds(x, y)) return { ok: false, error: "越界" };
    if (this.board[y][x] !== EMPTY) return { ok: false, error: "此处已有棋子" };

    const backup = this.cloneBoard();
    this.board[y][x] = color;

    const opp = opponentColor(color);
    const toRemove = this.collectDeadStones(opp);
    const captured = [];
    for (const p of toRemove) {
      const c = this.board[p.y][p.x];
      this.board[p.y][p.x] = EMPTY;
      captured.push({ x: p.x, y: p.y, color: c });
    }

    const myGroup = this.getGroup(x, y);
    if (this.countLiberties(myGroup) === 0) {
      this.setBoardFrom(backup);
      return { ok: false, error: "禁入点（无气且不提子）" };
    }

    const newKey = this.boardKey();
    if (!ignoreKo && this.positionHistory.includes(newKey)) {
      this.setBoardFrom(backup);
      return { ok: false, error: "打劫（局面重复）" };
    }

    this.positionHistory.push(newKey);
    while (this.positionHistory.length > KO_HISTORY_DEPTH) {
      this.positionHistory.shift();
    }

    for (const cap of captured) {
      this.prisoners[cap.color] = (this.prisoners[cap.color] || 0) + 1;
    }

    this.lastMove = { x, y };
    return { ok: true, captured };
  }

  /** 移除任意一颗棋子（爆破大师），不更新劫历史 */
  removeStone(x, y) {
    if (!this.inBounds(x, y)) return { ok: false, error: "越界" };
    if (this.board[y][x] === EMPTY) return { ok: false, error: "空点" };
    const color = this.board[y][x];
    this.board[y][x] = EMPTY;
    this.lastMove = { x, y };
    return { ok: true, color };
  }

  /** 染色：交换两格颜色 */
  swapColors(x1, y1, x2, y2) {
    if (!this.inBounds(x1, y1) || !this.inBounds(x2, y2))
      return { ok: false, error: "越界" };
    const a = this.board[y1][x1];
    const b = this.board[y2][x2];
    if (a === EMPTY || b === EMPTY) return { ok: false, error: "必须选择有子的点" };
    this.board[y1][x1] = b;
    this.board[y2][x2] = a;
    return { ok: true };
  }

  /** 简化点目：棋子数 + 己方连通空点（仅作参考） */
  estimateScore() {
    const visitedEmpty = new Set();
    const territory = { [BLACK]: 0, [WHITE]: 0 };

    const key = (x, y) => `${x},${y}`;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] !== EMPTY) continue;
        const k = key(x, y);
        if (visitedEmpty.has(k)) continue;

        const queue = [[x, y]];
        const cells = [];
        const borders = new Set();
        visitedEmpty.add(k);

        while (queue.length) {
          const [cx, cy] = queue.pop();
          cells.push([cx, cy]);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!this.inBounds(nx, ny)) continue;
            const v = this.board[ny][nx];
            if (v === EMPTY) {
              const nk = key(nx, ny);
              if (!visitedEmpty.has(nk)) {
                visitedEmpty.add(nk);
                queue.push([nx, ny]);
              }
            } else {
              borders.add(v);
            }
          }
        }

        if (borders.size === 1) {
          const owner = [...borders][0];
          if (owner === BLACK || owner === WHITE) {
            territory[owner] += cells.length;
          }
        }
      }
    }

    let stonesB = 0;
    let stonesW = 0;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] === BLACK) stonesB++;
        else if (this.board[y][x] === WHITE) stonesW++;
      }
    }

    const komi = 6.5;
    return {
      black: stonesB + territory[BLACK] + (this.prisoners[WHITE] || 0),
      white: stonesW + territory[WHITE] + (this.prisoners[BLACK] || 0) + komi,
      stonesBlack: stonesB,
      stonesWhite: stonesW,
      territoryBlack: territory[BLACK],
      territoryWhite: territory[WHITE],
    };
  }
}
