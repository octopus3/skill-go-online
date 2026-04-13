import { GameController } from "./GameController.js";
import { NetClient } from "../net/NetClient.js";
import { PLAYER_BLACK, PLAYER_WHITE } from "../config/constants.js";
import { GoGame } from "../core/GoGame.js";
import { SkillManager } from "../skills/SkillManager.js";

function wsUrlFromOrigin(origin) {
  const u = new URL(origin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}

export class OnlineGameController extends GameController {
  constructor() {
    super();

    this.mode = "local"; // local | online
    this.mySeat = 0; // 1 黑 2 白 0 观战

    this.net = null;
    this.roomId = "";
    this._lastSentStateKey = "";
    this._applyingRemote = false;

    this._ensureOnlineUi();
  }

  _ensureOnlineUi() {
    // Start screen additions
    const grid = this.elStart.querySelector(".setup-grid");
    const wrap = document.createElement("div");
    wrap.className = "online-box";
    wrap.innerHTML = `
      <div class="divider"></div>
      <div class="row">
        <label class="field">
          <span>模式</span>
          <select id="select-mode">
            <option value="local" selected>本地双人</option>
            <option value="online">在线对战（房间）</option>
          </select>
        </label>
        <label class="field">
          <span>房间号</span>
          <input id="input-room" class="text" placeholder="例如: room123" />
        </label>
      </div>
      <div class="row actions">
        <button type="button" class="btn" id="btn-join-room">连接/加入</button>
        <span class="status" id="net-status"></span>
      </div>
      <p class="subtitle small" id="room-hint"></p>
    `;
    grid.appendChild(wrap);

    this.selectMode = document.getElementById("select-mode");
    this.inputRoom = document.getElementById("input-room");
    this.btnJoinRoom = document.getElementById("btn-join-room");
    this.elNetStatus = document.getElementById("net-status");
    this.elRoomHint = document.getElementById("room-hint");

    this.inputRoom.value = `room-${Math.random().toString(36).slice(2, 6)}`;

    this.selectMode.addEventListener("change", () => {
      this.mode = this.selectMode.value === "online" ? "online" : "local";
      this._applyModeUi();
    });

    this.btnJoinRoom.addEventListener("click", () => this._connectAndJoin());
    this._applyModeUi();
  }

  _applyModeUi() {
    const isOnline = this.mode === "online";
    this.btnStart.textContent = isOnline ? "开始游戏（由黑方创建）" : "开始游戏";
    this.btnStart.disabled = isOnline; // 在线：由黑方发起并广播
    this.selectSize.disabled = !isOnline ? false : false;
    this.selectSkillB.disabled = false;
    this.selectSkillW.disabled = false;
    this.elRoomHint.textContent = isOnline
      ? "在线模式：两人输入同一房间号并加入后，黑方点击“开始游戏”同步给白方。"
      : "";
  }

  _setNetStatus(text) {
    if (this.elNetStatus) this.elNetStatus.textContent = text || "";
  }

  _connectAndJoin() {
    if (this.mode !== "online") return;
    const room = (this.inputRoom.value || "").trim();
    if (!room) {
      this._setNetStatus("请填写房间号");
      return;
    }
    this.roomId = room;
    const url = wsUrlFromOrigin(location.origin);
    this.net = new NetClient({
      url,
      onStatus: (s) => this._setNetStatus(s.message || (s.connected ? "已连接" : "未连接")),
      onMessage: (msg) => this._onNetMessage(msg),
    });
    this.net.connect();
    this.net.join(room);
  }

  _onNetMessage(msg) {
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "joined") {
      this.mySeat = msg.seat ?? 0;
      if (msg.setup && msg.state) {
        this._applyRemoteSetupAndState(msg.setup, msg.state);
      } else if (msg.setup && !msg.state) {
        this._applyRemoteSetupOnly(msg.setup);
      }
      this._updateOnlineStartButton();
      return;
    }

    if (msg.type === "room") {
      const seatText =
        this.mySeat === 1 ? "你是黑方" : this.mySeat === 2 ? "你是白方" : "你是观战";
      const players = Array.isArray(msg.players) ? msg.players : [];
      const hasB = players.some((p) => p.seat === 1);
      const hasW = players.some((p) => p.seat === 2);
      this.elRoomHint.textContent = `房间：${msg.roomId}（${seatText}）| 黑方：${
        hasB ? "已加入" : "未加入"
      }，白方：${hasW ? "已加入" : "未加入"}。`;
      this._updateOnlineStartButton();
      return;
    }

    if (msg.type === "setup") {
      if (msg.setup) this._applyRemoteSetupOnly(msg.setup);
      this._updateOnlineStartButton();
      return;
    }

    if (msg.type === "state") {
      if (msg.state) this._applyRemoteStateOnly(msg.state);
      return;
    }
  }

  _updateOnlineStartButton() {
    if (this.mode !== "online") return;
    const canStart = this.mySeat === 1 && this.net;
    this.btnStart.disabled = !canStart;
    this.btnStart.textContent = canStart ? "开始游戏（同步房间）" : "等待黑方开始";
  }

  _applyRemoteSetupOnly(setup) {
    if (!setup) return;
    if (typeof setup.size === "number") this.selectSize.value = String(setup.size);
    if (setup.skillB) this.selectSkillB.value = setup.skillB;
    if (setup.skillW) this.selectSkillW.value = setup.skillW;
    // 在线时仅供显示：避免白方改设置导致误会
    if (this.mySeat === 2) {
      this.selectSize.disabled = true;
      this.selectSkillB.disabled = true;
      this.selectSkillW.disabled = true;
    }
  }

  _applyRemoteSetupAndState(setup, state) {
    this._applyRemoteSetupOnly(setup);
    this._applyRemoteStateOnly(state, setup);
  }

  _applyRemoteStateOnly(state, setup = null) {
    if (!state) return;
    this._applyingRemote = true;
    try {
      const size =
        setup?.size ??
        (Array.isArray(state.board) ? state.board.length : parseInt(this.selectSize.value, 10) || 13);
      const sb = setup?.skillB ?? this.selectSkillB.value;
      const sw = setup?.skillW ?? this.selectSkillW.value;

      if (!this.skills) {
        this.game = new GoGame(size);
        this.skills = new SkillManager(sb, sw);
        this.renderer.setGame(this.game);
        this.elStart.classList.add("hidden");
        this.elGame.classList.remove("hidden");
        requestAnimationFrame(() => this.renderer.resize());
      }

      this._restoreState(state);
      this._draw();
      this._updatePanels();
    } finally {
      this._applyingRemote = false;
    }
  }

  _broadcastSetupIfHost() {
    if (this.mode !== "online" || this.mySeat !== 1 || !this.net) return;
    const setup = {
      size: parseInt(this.selectSize.value, 10),
      skillB: this.selectSkillB.value,
      skillW: this.selectSkillW.value,
    };
    this.net.send({ type: "set_setup", roomId: this.roomId, setup });
  }

  _broadcastStateIfHost() {
    if (this.mode !== "online" || this.mySeat !== 1 || !this.net) return;
    if (this._applyingRemote) return;
    const state = this._captureState();
    const key = JSON.stringify(state);
    if (key === this._lastSentStateKey) return;
    this._lastSentStateKey = key;
    this.net.send({ type: "set_state", roomId: this.roomId, state });
  }

  _startGame() {
    if (this.mode !== "online") return super._startGame();
    if (this.mySeat !== 1) return;
    this._broadcastSetupIfHost();
    super._startGame();
    this._broadcastStateIfHost();
  }

  _undo() {
    if (this.mode === "online") {
      this._pushHint("在线模式暂不支持悔棋");
      return;
    }
    return super._undo();
  }

  _resign() {
    super._resign();
    if (this.mode === "online") this._broadcastStateIfHost();
  }

  _backToMenu() {
    super._backToMenu();
    if (this.mode === "online" && this.mySeat === 1) {
      this.net?.send({ type: "reset_room", roomId: this.roomId });
    }
  }

  _activateSkillFor(player) {
    if (this.mode === "online") {
      if (this.mySeat !== player) return;
    }
    super._activateSkillFor(player);
    if (this.mode === "online") this._broadcastStateIfHost();
  }

  _onBoardClick(e) {
    if (this.mode === "online") {
      // 只允许自己的回合操作
      if (this.mySeat === 0) return;
      if (this.currentPlayer !== this.mySeat) return;
    }
    super._onBoardClick(e);
    if (this.mode === "online") this._broadcastStateIfHost();
  }
}

