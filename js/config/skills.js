/**
 * 技能元数据：id、显示名、次数、描述（与 SkillManager 中逻辑 id 一致）
 */
export const SKILL_CATALOG = [
  {
    id: "feidao",
    name: "飞刀大师",
    charges: 4,
    desc: "主动：激活后连下 3 手棋（对手不回应），共 4 次机会。",
  },
  {
    id: "blast",
    name: "爆破大师",
    charges: 3,
    desc: "主动：点击移除场上一颗对方棋子，不触发提子连锁。",
  },
  {
    id: "mutual",
    name: "同归于尽",
    charges: 5,
    desc: "被动：己方棋子被提时，可移除对方场上一颗棋子。",
  },
  {
    id: "dye",
    name: "染色大师",
    charges: 5,
    desc: "主动：依次点两颗棋子，交换颜色。",
  },
  {
    id: "ban",
    name: "禁手奇才",
    charges: 5,
    desc: "主动：标记一个空点，对手永久不可在此落子。",
  },
  {
    id: "trouble",
    name: "麻烦制造者",
    charges: 5,
    desc: "主动：第一手落对方色，第二手落本家色，然后换手。",
  },
];

export function getSkillDef(id) {
  return SKILL_CATALOG.find((s) => s.id === id) || null;
}
