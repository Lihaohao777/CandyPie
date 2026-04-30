# CandyPie

一个住在系统托盘里的轻量级 AI 聊天工具。按下 `Ctrl+Space` 即可弹出对话窗口，向任意 OpenAI 兼容的 AI 提问。

## 功能

- 全局快捷键 `Ctrl+Space` 切换窗口显示/隐藏
- 支持任意 OpenAI 兼容 API（OpenAI、DeepSeek、本地模型等）
- 流式输出 + Markdown 渲染
- 代码块一键复制
- 支持 `<think>` 思考过程折叠（DeepSeek R1 风格）
- 多轮对话（自动携带历史记录）
- 无边框、始终置顶，不占用任务栏
- 单实例运行，重复启动自动聚焦已有窗口
- 配置本地持久化（`%APPDATA%/candypie/config.json`）

## 快速开始

### 直接安装（Windows）

1. 从 Releases 下载 `CandyPie Setup x.x.x.exe`
2. 安装后运行，程序出现在系统托盘
3. 按 `Ctrl+Space` 或点击托盘图标打开窗口
4. 点击 ⚙ 按钮填写 API 地址、Key 和模型名称

### 从源码运行

**环境要求：** Node.js 18+

```bash
git clone <repo>
cd winchat
npm install
npm run dev
```

### 打包构建

```bash
npm run dist
```

输出：`dist/CandyPie Setup x.x.x.exe`

> 打包时需要管理员权限或开启 Windows 开发者模式。

## 配置说明

| 字段 | 说明 |
|------|------|
| API 地址 | 接口基础地址，如 `https://api.openai.com/v1` |
| API Key | 你的 API 密钥 |
| 模型名称 | 如 `gpt-4o`、`deepseek-reasoner` |
| 系统提示词 | 可选，给 AI 的角色设定 |

## 技术栈

Electron · Vue 3 · Vite · electron-builder · marked
