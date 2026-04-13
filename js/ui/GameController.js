import { GoGame } from "../core/GoGame.js";
import { SkillManager } from "../skills/SkillManager.js";
import { BoardRenderer } from "./BoardRenderer.js";
import {
  PLAYER_BLACK,
  PLAYER_WHITE,
  EMPTY,
  BLACK,
  WHITE,
  playerToColor,
  colorToPlayer,
  BOARD_SIZES,
} from "../config/constants.js";
import { SKILL_CATALOG } from "../config/skills.js";

function opponentPlayer(p) {
  return p === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

/**
 * 流程、DOM、悔棋栈、技能与落子交互
 */
export class GameController {
  constructor() {
    this.canvas = document.getElementById("board");
    this.elStart = document.getElementById("screen-start");
    this.elGame = document.getElementById("screen-game");
    this.elTurn = document.getElementById("turn-text");
    this.elRound = document.getElementById("round-num");
    this.elHint = document.getElementById("hint-text");
    this.elPanelBlack = document.getElementById("panel-black");
    this.elPanelWhite = document.getElementById("panel-white");
    this.btnStart = document.getElementById("btn-start");
    this.btnUndo = document.getElementById("btn-undo");
    this.btnResign = document.getElementById("btn-resign");
    this.btnNew = document.getElementById("btn-new");
    this.selectSize = document.getElementById("select-size");
    this.selectSkillB = document.getElementById("select-skill-b");
    this.selectSkillW = document.getElementById("select-skill-w");

    this.game = new GoGame(13);
    this.skills = null;
    this.renderer = new BoardRenderer(this.canvas, this.game);
    this.currentPlayer = PLAYER_BLACK;
    this.roundIndex = 1;
    /** @type {Set<string>} */
    this.banPointsForBlack = new Set();
    /** @type {Set<string>} */
    this.banPointsForWhite = new Set();
    this.history = [];
    /** @type {{ movingPlayer: number } | null} */
    this.mutualInterrupt = null;
    this.gameOver = false;

    this._fillSkillSelects();
    this._bindUi();
    this._onResize = () => {
      this.renderer.resize();
      this._draw();
    };
    window.addEventListener("resize", this._onResize);
  }

  _fillSkillSelects() {
    const opts = SKILL_CATALOG.map(
      (s) =>
        `<option value="${s.id}">${s.name}（${s.charges}次）— ${s.desc}</option>`
    ).join("");
    this.selectSkillB.innerHTML = opts;
    this.selectSkillW.innerHTML = opts;
    this.selectSize.innerHTML = BOARD_SIZES.map(
      (n) => `<option value="${n}">${n}×${n}</option>`
    ).join("");
    this.selectSize.value = "13";
  }

  _bindUi() {
    this.btnStart.addEventListener("click", () => this._startGame());
    this.btnUndo.addEventListener("click", () => this._undo());
    this.btnResign.addEventListener("click", () => this._resign());
    this.btnNew.addEventListener("click", () => this._backToMenu());
    document.getElementById("btn-cancel-skill")?.addEventListener("click", () => {
      if (this.skills?.cancelSkillMode()) {
        this._pushHint("已取消技能选择");
        this._draw();
        this._updatePanels();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.renderer.hoverCell = null;
      this._draw();
    });
    this.canvas.addEventListener("click", (e) => this._onBoardClick(e));
  }

  _cellKey(x, y) {
    return `${x},${y}`;
  }

  _captureState() {
    return {
      board: this.game.cloneBoard(),
      prisoners: { ...this.game.prisoners },
      positionHistory: [...this.game.positionHistory],
      lastMove: this.game.lastMove ? { ...this.game.lastMove } : null,
      currentPlayer: this.currentPlayer,
      roundIndex: this.roundIndex,
      banBlack: Array.from(this.banPointsForBlack),
      banWhite: Array.from(this.banPointsForWhite),
      gameOver: this.gameOver,
      mutualInterrupt: this.mutualInterrupt ? { ...this.mutualInterrupt } : null,
      sCharges: { ...this.skills.charges },
      sUiMode: this.skills.uiMode,
      sFeidao: this.skills.feidaoMovesLeft,
      sDyeFirst: this.skills.dyeFirst,
      sMutual: this.skills.mutualPending
        ? { ...this.skills.mutualPending }
        : null,
      sTroublePlayer: this.skills.troublePlayer,
      sTroubleStage: this.skills.troubleStage,
    };
  }

  _restoreState(s) {
    this.game.setBoardFrom(s.board);
    this.game.prisoners = { ...s.prisoners };
    this.game.positionHistory = [...s.positionHistory];
    this.game.lastMove = s.lastMove;
    this.currentPlayer = s.currentPlayer;
    this.roundIndex = s.roundIndex;
    this.banPointsForBlack = new Set(s.banBlack);
    this.banPointsForWhite = new Set(s.banWhite);
    this.gameOver = s.gameOver;
    this.mutualInterrupt = s.mutualInterrupt ? { ...s.mutualInterrupt } : null;
    this.skills.charges = { ...s.sCharges };
    this.skills.uiMode = s.sUiMode;
    this.skills.feidaoMovesLeft = s.sFeidao;
    this.skills.dyeFirst = s.sDyeFirst;
    this.skills.mutualPending = s.sMutual ? { ...s.sMutual } : null;
    this.skills.troublePlayer =
      s.sTroublePlayer !== undefined ? s.sTroublePlayer : null;
    this.skills.troubleStage = s.sTroubleStage ?? 0;
  }

  _pushHistory() {
    this.history.push(this._captureState());
    if (this.history.length > 80) this.history.shift();
  }

  _startGame() {
    const size = parseInt(this.selectSize.value, 10);
    const sb = this.selectSkillB.value;
    const sw = this.selectSkillW.value;
    this.game = new GoGame(size);
    this.skills = new SkillManager(sb, sw);
    this.renderer.setGame(this.game);
    this.currentPlayer = PLAYER_BLACK;
    this.roundIndex = 1;
    this.banPointsForBlack = new Set();
    this.banPointsForWhite = new Set();
    this.history = [];
    this.mutualInterrupt = null;
    this.gameOver = false;

    this.elStart.classList.add("hidden");
    this.elGame.classList.remove("hidden");
    requestAnimationFrame(() => {
      this.renderer.resize();
      this._draw();
      this._updatePanels();
      this._pushHint("黑棋先行。使用技能前请先点对应技能按钮。");
    });
  }

  _backToMenu() {
    this.elGame.classList.add("hidden");
    this.elStart.classList.remove("hidden");
    this.history = [];
    this._pushHint("");
  }

  _resign() {
    if (this.gameOver || !this.skills) return;
    const loser = this.currentPlayer;
    const w = opponentPlayer(loser);
    this.gameOver = true;
    this._pushHint(
      `${loser === PLAYER_BLACK ? "黑方" : "白方"}认输。${
        w === PLAYER_BLACK ? "黑方" : "白方"
      }胜。`
    );
    this._updatePanels();
  }

  _undo() {
    if (!this.skills || this.history.length === 0) return;
    const prev = this.history.pop();
    this._restoreState(prev);
    this._draw();
    this._updatePanels();
    this._pushHint("已悔棋");
  }

  _pushHint(t) {
    if (this.elHint) this.elHint.textContent = t || "";
  }

  _finishMoveTurnLogic(movingPlayer) {
    if (this.skills.feidaoMovesLeft > 0) {
      this.skills.feidaoMovesLeft--;
      if (this.skills.feidaoMovesLeft > 0) {
        this.currentPlayer = movingPlayer;
        this._pushHint(`飞刀：剩余连下 ${this.skills.feidaoMovesLeft} 手`);
        return;
      }
    }
    // 同归于尽等中断结束后：麻烦制造者第一手已下完，仍须再下本家一子
    if (
      this.skills.troublePlayer === movingPlayer &&
      this.skills.troubleStage === 2
    ) {
      this._pushHint("麻烦制造者：请再下本家一子");
      return;
    }
    this.currentPlayer = opponentPlayer(movingPlayer);
    this.roundIndex++;
    this._pushHint("");
  }

  /**
   * 落子成功后：提子与同归于尽、再结算回合/飞刀
   */
  _afterStonePlaced(movingPlayer, captured) {
    const inTrouble = this.skills.troublePlayer === movingPlayer;
    const troubleStageBefore = inTrouble ? this.skills.troubleStage : 0;

    if (captured.length) {
      const victim = colorToPlayer(captured[0].color);
      const pending = this.skills.onStonesCaptured(victim, captured);
      if (pending) {
        if (troubleStageBefore === 1) this.skills.troubleStage = 2;
        else if (troubleStageBefore === 2) this.skills.clearTrouble();
        this.mutualInterrupt = { movingPlayer };
        this.currentPlayer = victim;
        this._pushHint(
          `同归于尽：请${victim === PLAYER_BLACK ? "黑方" : "白方"}点击移除对方一颗子`
        );
        this._draw();
        this._updatePanels();
        return;
      }
    }

    if (troubleStageBefore === 1) {
      this.skills.troubleStage = 2;
      this._pushHint("麻烦制造者：请再下本家一子");
      this._draw();
      this._updatePanels();
      return;
    }

    if (troubleStageBefore === 2) {
      this.skills.clearTrouble();
    }

    this._finishMoveTurnLogic(movingPlayer);
    this._draw();
    this._updatePanels();
  }

  _onBoardClick(e) {
    if (this.gameOver || !this.skills) return;
    const rect = this.canvas.getBoundingClientRect();
    const gx = this.renderer.pixelToGrid(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    if (!gx) return;
    const { x, y } = gx;
    const key = this._cellKey(x, y);

    const mode = this.skills.uiMode;

    if (mode === "mutual_pick") {
      const victim = this.skills.mutualPending.player;
      const oppC = playerToColor(opponentPlayer(victim));
      if (this.game.board[y][x] !== oppC) {
        this._pushHint("请选择对方颜色的棋子");
        return;
      }
      this._pushHistory();
      const r = this.game.removeStone(x, y);
      if (!r.ok) return;
      this.skills.finishMutualPick();
      const mp = this.mutualInterrupt.movingPlayer;
      this.mutualInterrupt = null;
      this._finishMoveTurnLogic(mp);
      this._draw();
      this._updatePanels();
      return;
    }

    if (mode === "blast") {
      const oppC = playerToColor(opponentPlayer(this.currentPlayer));
      if (this.game.board[y][x] !== oppC) {
        this._pushHint("爆破：请点击对方的棋子");
        return;
      }
      this._pushHistory();
      this.game.removeStone(x, y);
      this.skills.charges[this.currentPlayer]--;
      this.skills.uiMode = "normal";
      this._finishMoveTurnLogic(this.currentPlayer);
      this._draw();
      this._updatePanels();
      return;
    }

    if (mode === "dye_pick1") {
      if (this.game.board[y][x] === EMPTY) {
        this._pushHint("请选择第一颗棋子");
        return;
      }
      this.skills.dyeFirst = { x, y };
      this.skills.uiMode = "dye_pick2";
      this._pushHint("染色：请选择第二颗棋子");
      return;
    }

    if (mode === "dye_pick2") {
      const f = this.skills.dyeFirst;
      if (!f || (f.x === x && f.y === y)) return;
      if (this.game.board[y][x] === EMPTY) {
        this._pushHint("请选择第二颗棋子");
        return;
      }
      this._pushHistory();
      const ok = this.game.swapColors(f.x, f.y, x, y);
      if (!ok.ok) return;
      this.skills.charges[this.currentPlayer]--;
      this.skills.uiMode = "normal";
      this.skills.dyeFirst = null;
      this._pushHint("染色完成，本回合可继续落子");
      this._draw();
      this._updatePanels();
      return;
    }

    if (mode === "ban") {
      if (this.game.board[y][x] !== EMPTY) {
        this._pushHint("请选择空位作为禁区");
        return;
      }
      this._pushHistory();
      const opp = opponentPlayer(this.currentPlayer);
      if (opp === PLAYER_BLACK) this.banPointsForBlack.add(key);
      else this.banPointsForWhite.add(key);
      this.skills.charges[this.currentPlayer]--;
      this.skills.uiMode = "normal";
      this._pushHint("已标记禁区，本回合可继续落子");
      this._draw();
      this._updatePanels();
      return;
    }

    if (this.skills.uiMode !== "normal") return;

    const p = this.currentPlayer;
    if (p === PLAYER_BLACK && this.banPointsForBlack.has(key)) {
      this._pushHint("该点被禁，黑方不可落子");
      return;
    }
    if (p === PLAYER_WHITE && this.banPointsForWhite.has(key)) {
      this._pushHint("该点被禁，白方不可落子");
      return;
    }

    const color = this.skills.stoneColorForMove(p);
    this._pushHistory();
    const res = this.game.tryPlay(x, y, color);
    if (!res.ok) {
      this.history.pop();
      this._pushHint(res.error || "不可落子");
      return;
    }
    this._afterStonePlaced(p, res.captured);
  }

  _onMouseMove(e) {
    if (this.gameOver || !this.skills) return;
    const rect = this.canvas.getBoundingClientRect();
    const gx = this.renderer.pixelToGrid(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    this.renderer.hoverCell = gx;
    const mode = this.skills.uiMode;
    const p = this.currentPlayer;
    if (mode === "normal" || this.skills.isFeidaoActive()) {
      this.renderer.hoverColor = this.skills.stoneColorForMove(p);
    } else {
      this.renderer.hoverColor = null;
    }
    this._draw();
  }

  _draw() {
    this.renderer.draw({
      forbiddenBlack: this.banPointsForBlack,
      forbiddenWhite: this.banPointsForWhite,
      uiMode: this.skills?.uiMode || "normal",
      allowPlacement:
        this.skills?.uiMode === "normal" || this.skills?.isFeidaoActive(),
    });
  }

  _updatePanels() {
    if (!this.skills) return;
    const b = this.game.prisoners[BLACK] ?? 0;
    const w = this.game.prisoners[WHITE] ?? 0;
    document.getElementById("cap-black").textContent = String(w);
    document.getElementById("cap-white").textContent = String(b);

    const turnName =
      this.currentPlayer === PLAYER_BLACK
        ? "黑方行棋"
        : "白方行棋";
    this.elTurn.textContent = this.gameOver ? "对局结束" : turnName;
    this.elRound.textContent = String(this.roundIndex);

    this._renderSidePanel(PLAYER_BLACK, this.elPanelBlack);
    this._renderSidePanel(PLAYER_WHITE, this.elPanelWhite);
  }

  _renderSidePanel(player, container) {
    const id = this.skills.getSkillId(player);
    const name =
      SKILL_CATALOG.find((s) => s.id === id)?.name || id || "—";
    container.querySelector(".skill-name").textContent = name;
    const rem = this.skills.remaining(player);
    const btn = container.querySelector(".btn-skill");
    btn.textContent =
      id === "mutual" ? `同归于尽（被动 ${rem}）` : `使用技能（剩余 ${rem}）`;
    btn.disabled =
      this.gameOver ||
      this.skills.uiMode !== "normal" ||
      !this.skills.canActivate(player) ||
      this.currentPlayer !== player;
    if (id === "mutual") btn.disabled = true;

    const isTurn = !this.gameOver && this.currentPlayer === player;
    container.classList.toggle("panel-active", isTurn);
  }

  _activateSkillFor(player) {
    if (this.gameOver || this.currentPlayer !== player) return;
    const r = this.skills.activate(player);
    if (!r.ok) {
      this._pushHint(r.error || "无法使用");
      return;
    }
    if (r.mode === "blast") this._pushHint("爆破：点击对方一颗棋子");
    else if (r.mode === "dye_pick1") this._pushHint("染色：选择第一颗棋子");
    else if (r.mode === "ban") this._pushHint("禁手：点击空位标记对手禁区");
    else if (r.mode === "feidao") this._pushHint("飞刀：请连下 3 手");
    else if (r.mode === "trouble")
      this._pushHint(
        "麻烦制造者：第一手为对方色，第二手为本家色，然后换手"
      );
    this._updatePanels();
    this._draw();
  }
}

/** 由 main 调用：绑定技能按钮（需在 DOM 就绪后） */
export function wireSkillButtons(ctrl) {
  document
    .getElementById("btn-skill-black")
    .addEventListener("click", () => ctrl._activateSkillFor(PLAYER_BLACK));
  document
    .getElementById("btn-skill-white")
    .addEventListener("click", () => ctrl._activateSkillFor(PLAYER_WHITE));
}
