/** 棋盘与渲染相关常量 */
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export const PLAYER_BLACK = 0;
export const PLAYER_WHITE = 1;

export const BOARD_SIZES = [9, 13, 19];

/** 超级劫简化：禁止与最近若干手全局面形重复 */
export const KO_HISTORY_DEPTH = 16;

export function opponentColor(c) {
  return c === BLACK ? WHITE : BLACK;
}

export function playerToColor(playerIndex) {
  return playerIndex === PLAYER_BLACK ? BLACK : WHITE;
}

export function colorToPlayer(color) {
  return color === BLACK ? PLAYER_BLACK : PLAYER_WHITE;
}
