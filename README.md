# 技能围棋（在线版）

网页围棋 + 技能系统，新增 WebSocket 房间对战（同一房间两人同步棋局）。

## 目录结构

```
skill-go-online/
├── index.html          # 页面骨架与 DOM
├── css/
│   └── main.css        # 布局与主题样式
├── js/
│   ├── main.js         # 入口
│   ├── net/
│   │   └── NetClient.js            # WebSocket 客户端
│   ├── config/
│   │   ├── constants.js            # 棋盘常量、玩家与颜色映射
│   │   └── skills.js               # 技能列表与元数据
│   ├── core/
│   │   └── GoGame.js               # 落子、气、提子、劫、形势估算
│   ├── skills/
│   │   └── SkillManager.js         # 技能状态与交互模式
│   └── ui/
│       ├── BoardRenderer.js        # Canvas 绘制
│       ├── GameController.js       # 本地流程、悔棋、DOM 绑定
│       └── OnlineGameController.js # 在线模式封装
├── server/
│   └── server.js       # 静态资源 + WebSocket 房间服务
├── package.json
└── README.md
```

## 运行方式

需要 Node.js。进入项目根目录执行：

```bash
npm i
npm run dev
```

浏览器打开终端提示的 `http://localhost:3000`（或 Railway 提供的公网地址）。

## 部署到 Railway（推荐：A 方案单服务）

本项目后端（`server/server.js`）同时负责：

- 提供静态页面（`index.html` / `css/` / `js/`，或未来迁移到 `public/`）
- 提供 WebSocket 房间服务（同域名同端口）

### Railway 配置要点

- **Start Command**：`npm start`
- **端口**：Railway 会注入 `PORT` 环境变量；服务端已使用 `process.env.PORT` 监听
- **WebSocket**：无需额外配置，保持同一服务同一域名访问即可

### 目录建议（可选优化）

你现在的静态资源在仓库根目录，已可直接部署。若想更标准，可以把静态文件迁移到：

```
public/
  index.html
  css/
  js/
```

服务端会在检测到 `public/index.html` 存在时优先托管 `public/`，否则回退托管仓库根目录（兼容当前结构）。

## 在线对战用法

- 两个人都打开同一个地址，切换到“在线对战（房间）”
- 填同一个“房间号”，点“连接/加入”（无需填写服务器地址）
- 黑方点击“开始游戏（同步房间）”开始对局

## 规则摘要

- 黑先；支持 9×9、13×13、19×19。
- 劫：与最近若干手的全局面形不可重复。
- 黑方、白方开局各选一种技能；具体次数与效果见开局下拉里说明。
