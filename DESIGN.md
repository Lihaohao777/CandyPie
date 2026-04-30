# CandyPie 设计文档

## 项目简介

CandyPie 是一个运行在 Windows 系统托盘的轻量级 AI 快捷聊天工具。
按下 `Ctrl+Space` 即可弹出小窗口，快速向任意 OpenAI 兼容 API 提问。

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron 28 | 系统托盘、全局快捷键、窗口管理、IPC |
| 前端 UI | Vue 3 | 聊天界面 + 设置界面（Composition API）|
| 构建工具 | Vite 5 | 渲染进程打包，`base: './'` 兼容 asar |
| 打包安装 | electron-builder | 生成 Windows NSIS 安装包 |
| Markdown | marked | 渲染 AI 回复 |

---

## 目录结构

```
winchat/
├── assets/                  # 应用图标（icon.png，打包时包含）
├── src/
│   ├── main/
│   │   └── index.js         # 主进程：托盘、快捷键、窗口、IPC、流式 API
│   ├── preload.js           # contextBridge 暴露 window.api
│   ├── picture/             # 原始素材（candy.svg）
│   └── renderer/
│       ├── index.html
│       ├── main.js          # Vue 应用入口
│       ├── App.vue          # 根组件，管理 messages 状态，切换视图
│       ├── store.js         # 响应式配置（从 userData 加载/保存）
│       └── components/
│           ├── ChatView.vue     # 聊天界面
│           └── SettingsView.vue # 设置界面
├── build-icon.js            # 用 sharp 将 SVG 转为 icon.png
├── vite.config.js
├── electron-builder.yml
└── package.json
```

---

## 核心功能

### 全局快捷键
- `Ctrl+Space` 切换窗口显示/隐藏（通过 `globalShortcut`）
- 单实例锁：`app.requestSingleInstanceLock()`，第二次启动时聚焦已有窗口

### 窗口
- 无边框（`frame: false`）、始终置顶（`alwaysOnTop: true`）、不在任务栏显示
- 失焦自动隐藏（仅打包模式，`ready-to-show` 后注册 blur 事件）
- 工具栏区域设置 `-webkit-app-region: drag` 支持拖动

### 系统托盘
- 左键单击：切换窗口
- 右键菜单：Open / Quit

### AI 请求（主进程）
- IPC 通道 `chat:send`，主进程用 `fetch` 发起 SSE 流式请求
- 兼容 OpenAI `/chat/completions` 格式
- 逐 chunk 通过 `chat:chunk` 发回渲染进程，完成后发 `chat:done`

### 聊天界面
- 多轮对话：每次发送携带完整历史（`rawContent` 保留含 `<think>` 的原始文本）
- `<think>...</think>` 块折叠展示（DeepSeek R1 风格）
- Markdown 渲染 + 代码块一键复制（base64 编码避免转义问题）
- 流式输出时仅在距底部 80px 内自动滚动，允许用户上滑查看
- 等待响应时显示三点跳动动画

### 配置
- 字段：`apiUrl`、`apiKey`、`modelName`、`systemPrompt`
- 存储路径：`%APPDATA%/candypie/config.json`

---

## IPC 通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `chat:send` | renderer → main | 发送消息 + 配置 + 历史 |
| `chat:chunk` | main → renderer | 流式文本片段 |
| `chat:done` | main → renderer | 流结束 |
| `chat:error` | main → renderer | 请求错误 |
| `config:load` | renderer → main | 读取配置 |
| `config:save` | renderer → main | 保存配置 |
| `window:hide` | renderer → main | 隐藏窗口 |

---

## 构建

```bash
npm install
npm run dev       # 开发模式（Vite + Electron 并行）
npm run dist      # 生产打包 → dist/CandyPie Setup x.x.x.exe
```

> 打包需要管理员权限或开启 Windows 开发者模式（符号链接权限）。
