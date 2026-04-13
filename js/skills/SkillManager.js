import { getSkillDef } from "../config/skills.js";
import {
  PLAYER_BLACK,
  PLAYER_WHITE,
  playerToColor,
  opponentColor,
} from "../config/constants.js";

/**
 * 技能状态与交互模式（飞刀连下、爆破选子、染色两步、禁手标记、麻烦下对方色、同归于尽待选）
 */
export class SkillManager {
  constructor(skillIdBlack, skillIdWhite) {
    this.skillId = {
      [PLAYER_BLACK]: skillIdBlack,
      [PLAYER_WHITE]: skillIdWhite,
    };
    this.charges = {
      [PLAYER_BLACK]: this._initialCharges(skillIdBlack),
      [PLAYER_WHITE]: this._initialCharges(skillIdWhite),
    };
    this.resetModes();
  }

  _initialCharges(skillId) {
    const def = getSkillDef(skillId);
    return def ? def.charges : 0;
  }

  resetModes() {
    this.uiMode = "normal"; // normal | blast | dye_pick1 | dye_pick2 | ban | mutual_pick
    this.feidaoMovesLeft = 0;
    this.dyeFirst = null;
    /** @type {{ player: number, capturedColor: number, count: number } | null} */
    this.mutualPending = null;
    /** 麻烦制造者：先下对方色一子，再下本家一子，才换手 */
    this.troublePlayer = null;
    /** 0 未激活；1 下一手须为对方色；2 下一手须为本家色 */
    this.troubleStage = 0;
  }

  getSkillId(player) {
    return this.skillId[player];
  }

  remaining(player) {
    return this.charges[player] ?? 0;
  }

  canActivate(player) {
    const id = this.skillId[player];
    if (!id || id === "mutual") return false;
    if (this.uiMode !== "normal") return false;
    if (this.feidaoMovesLeft > 0) return false;
    if (this.troublePlayer === player && this.troubleStage > 0) return false;
    return (this.charges[player] ?? 0) > 0;
  }

  /**
   * 激活主动技能（进入对应 UI 模式）；飞刀直接扣次数并进入连下
   */
  activate(player) {
    const id = this.skillId[player];
    if (!this.canActivate(player)) return { ok: false, error: "无法使用" };
    if (id === "feidao") {
      this.charges[player]--;
      this.feidaoMovesLeft = 3;
      return { ok: true, mode: "feidao" };
    }
    if (id === "blast") {
      this.uiMode = "blast";
      return { ok: true, mode: "blast" };
    }
    if (id === "dye") {
      this.uiMode = "dye_pick1";
      this.dyeFirst = null;
      return { ok: true, mode: "dye_pick1" };
    }
    if (id === "ban") {
      this.uiMode = "ban";
      return { ok: true, mode: "ban" };
    }
    if (id === "trouble") {
      this.uiMode = "normal";
      this.troublePlayer = player;
      this.troubleStage = 1;
      this.charges[player]--;
      return { ok: true, mode: "trouble" };
    }
    return { ok: false, error: "未知技能" };
  }

  cancelSkillMode() {
    if (this.uiMode === "blast" || this.uiMode === "ban") {
      this.uiMode = "normal";
      return true;
    }
    if (this.uiMode === "dye_pick1" || this.uiMode === "dye_pick2") {
      this.uiMode = "normal";
      this.dyeFirst = null;
      return true;
    }
    return false;
  }

  /** 落子颜色：考虑麻烦制造者（阶段1对方色，阶段2本家色） */
  stoneColorForMove(player) {
    const my = playerToColor(player);
    if (this.troublePlayer !== player || this.troubleStage <= 0) return my;
    if (this.troubleStage === 1) return opponentColor(my);
    return my;
  }

  clearTrouble() {
    this.troublePlayer = null;
    this.troubleStage = 0;
  }

  /** 同归于尽：被提子方触发 */
  onStonesCaptured(victimPlayer, capturedPieces) {
    if (!capturedPieces.length) return null;
    const id = this.skillId[victimPlayer];
    if (id !== "mutual") return null;
    if ((this.charges[victimPlayer] ?? 0) <= 0) return null;
    this.charges[victimPlayer]--;
    this.uiMode = "mutual_pick";
    this.mutualPending = {
      player: victimPlayer,
      capturedColor: capturedPieces[0].color,
      count: capturedPieces.length,
    };
    return this.mutualPending;
  }

  finishMutualPick() {
    this.uiMode = "normal";
    this.mutualPending = null;
  }

  isFeidaoActive() {
    return this.feidaoMovesLeft > 0;
  }
}
