# LinguaMate Web

React 18 + Vite 前端，配套一个轻量 BFF（本地 Node 服务 / Vercel Serverless Functions），把浏览器请求安全地转发到 **Coze Workflow API**。Coze Token 只存在于服务端，浏览器永远接触不到。

## 架构

```
Browser (React + Vite)
        │  /api/analyze | /api/exercises | /api/chat | /api/ocr
        ▼
BFF (server/dev-server.js  ·  api/*.js on Vercel)
        │  Authorization: Bearer $COZE_TOKEN
        ▼
Coze Workflow API  POST /v1/workflow/run
```

- **方案 B**：4 个独立代理端点，分别对接 4 个 Coze 工作流，不做 Agent 意图路由。
- **Mock 模式**：未配置 `COZE_TOKEN` 或对应工作流 ID 时，自动返回与 `linguamate-pro-upgraded/schemas` 对齐的固定数据，前端可离线完整演示。
- **本地判分**：题目下发时同时返回 `answer_key`，前端直接比对，不再调用 `/submit-answer`。

## 目录结构

```
.
├── index.html                 # Vite 入口（根目录）
├── vite.config.js             # /api 开发代理 + base 配置
├── api/                       # Vercel Serverless Functions
│   ├── _http.js               # 共用请求/响应工具
│   ├── analyze.js
│   ├── exercises.js
│   ├── chat.js
│   ├── ocr.js
│   └── health.js
├── server/                    # 本地 BFF（零依赖 Node HTTP）
│   ├── coze.js                # Coze 客户端 + mock 夹具
│   ├── handlers.js            # 参数校验与 4 个端点逻辑
│   └── dev-server.js          # npm run dev:api
├── src/
│   ├── api/
│   │   ├── client.js          # Axios 封装，统一 BFF 错误
│   │   ├── adapters.js        # Coze 输出 → UI 结构 + 本地判分
│   │   └── history.js         # localStorage 学习记录
│   ├── components/
│   │   ├── MarkdownView.jsx   # 零依赖 Markdown 渲染
│   │   └── ExerciseList.jsx   # 三类题型渲染 + 本地判分
│   └── pages/                 # TextAnalysis / ImageAnalysis / ChatPractice / LearningHistory
├── .env.example
└── vercel.json
```

## 快速开始

```bash
npm install
cp .env.example .env          # 可保持 COZE_MOCK=1

# 终端 A：启动 BFF（http://127.0.0.1:8787）
npm run dev:api

# 终端 B：启动前端（http://127.0.0.1:5173）
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 会把 `/api/*` 代理到 BFF；`GET /api/health` 可查看当前是否处于 mock 模式、哪些工作流已配置。

> 接入真实 Coze 时，把 `.env` 中的 `COZE_MOCK` 改为 `0`，并填入 `COZE_TOKEN` 与 4 个工作流 ID。

生产构建：`npm run build`，产物在 `dist/`。

## 环境变量

### 前端（会被打包进浏览器，禁止放密钥）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | BFF 地址；BFF 独立部署时改成完整 URL |
| `VITE_TARGET_LANGUAGE` | `en` | 学习目标语言，随请求发给工作流 |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8787` | Vite 开发代理目标 |
| `VITE_BASE_PATH` | `/` | GitHub Pages 子路径部署时设为 `/linguamate-web/` |

### BFF（仅服务端）

| 变量 | 说明 |
| --- | --- |
| `COZE_API_BASE` | 默认 `https://api.coze.cn` |
| `COZE_TOKEN` | Coze 个人访问令牌（**不要** 加 `VITE_` 前缀） |
| `COZE_WORKFLOW_ANALYZE` | 文本分析工作流 ID |
| `COZE_WORKFLOW_EXERCISE` | 出题工作流 ID |
| `COZE_WORKFLOW_CHAT` | 情境对话工作流 ID |
| `COZE_WORKFLOW_OCR` | 图像 OCR 工作流 ID |
| `COZE_MOCK` | `1` 强制 mock；缺省时无 Token 也会自动 mock |
| `COZE_STRINGIFY_PARAMS` | `1`（默认）把数组/对象序列化为 JSON 字符串 |
| `COZE_IMAGE_AS_FILE_ID` | `1` 时先上传图片到 Coze Files API，再传 file id |
| `DEFAULT_TARGET_LANGUAGE` | 请求未指定时的目标语言，默认 `en` |
| `PORT` | 本地 BFF 端口，默认 `8787` |

## API 契约

统一成功响应：

```json
{ "success": true, "data": { }, "meta": { "mock": false, "workflow": "analyze" } }
```

统一错误响应：

```json
{ "success": false, "error": { "code": "COZE_WORKFLOW_FAILED", "message": "..." }, "meta": { "traceId": "..." } }
```

| 端点 | 请求体 | Coze 工作流参数 |
| --- | --- | --- |
| `POST /api/analyze` | `{ text, level, ui_language, target_language }` | `text, level, ui_language, target_language` |
| `POST /api/exercises` | `{ text, analysis, question_count, level, ui_language, target_language }` | 同上 + `analysis`（字符串或结构化对象）+ `question_count` |
| `POST /api/chat` | `{ user_message, scenario, conversation_history, first_turn, custom_scenario_name, custom_scenario_description, ... }` | `user_message, scenario, conversation_history, first_turn, custom_scenario_name, custom_scenario_description, level, ui_language, target_language` |
| `POST /api/ocr` | `{ image_base64 \| image_url, text, level, ui_language, target_language }` | `image_url, text, level, ui_language, target_language` |
| `GET /api/health` | — | 返回 mock 状态与工作流配置情况（不含 Token） |

`conversation_history` 使用 Coze 约定：`[{ "role": "user" | "assistant", "content": "..." }]`。首次对话传 `first_turn: true` 且 `conversation_history: []`，工作流应返回 `{ opening, role, goal }`。

## 字段适配（Coze → UI）

`src/api/adapters.js` 会先 `JSON.parse` 工作流里可能嵌套的字符串，再做映射：

| Coze 输出 | 前端使用位置 | 说明 |
| --- | --- | --- |
| `analysis_markdown` | `TextAnalysis` / `ImageAnalysis` 分析区 | 由 `MarkdownView` 渲染标题、列表、表格、代码块等 |
| `vocabulary[]` / `grammar` / `semantics` / `pragmatics` / `recommendations` | 分析结果 | 保留为结构化对象，便于后续扩展 |
| `questions[]` | `ExerciseList` | 支持 `multiple_choice` / `sentence_building` / `dialogue_completion` |
| `answer_key` | `ExerciseList` + `gradeAnswer` | 本地判分，不再请求后端 |
| `reply` / `reply_translation` | `ChatPractice` 气泡 | `reply` 兼容旧的 `response` 字段 |
| `correction` | 气泡下方提示 | 支持对象或字符串 |
| `suggestions[]` | 气泡下方快捷短语 | 最多展示 3 条 |
| `opening` / `role` / `goal` | 对话开场 + 顶部信息 | 首次对话由工作流下发 |
| `extracted_text` | 图片分析“识别文本”区 | OCR 结果 |
| `exercise_set_id` | 学习记录 | 记录本次练习批次 |

选择题的 `answer_key` 可以是字母（`"A"`）或选项原文；组句题/对话补全在判分前会统一小写、去标点、压缩空白。

## 部署

### Vercel（推荐，前后端一起）

1. 导入本仓库，Framework 选择 **Vite**。
2. Build Command：`npm run build`；Output Directory：`dist`。
3. 在 Project Settings → Environment Variables 配置 `COZE_TOKEN` 与 4 个 `COZE_WORKFLOW_*`。
4. `api/` 下的 Serverless Functions 会自动部署，前端使用默认 `VITE_API_BASE_URL=/api` 即可。

### GitHub Pages（仅前端）

```bash
VITE_BASE_PATH=/linguamate-web/ npm run build
npm run deploy
```

BFF 需要单独部署（Vercel / Railway 均可），并把 `VITE_API_BASE_URL` 指向 `https://<bff-domain>/api`。注意在 Pages 上使用 `BrowserRouter` 时，刷新子路由需要 404 回退；更推荐 Vercel。

## 安全

- `.env`、`.env.local` 已在 `.gitignore` 中；仓库只提交 `.env.example`。
- 任何 `VITE_*` 变量都会进入浏览器 bundle，**绝不要**把 `COZE_TOKEN` 写成 `VITE_COZE_TOKEN`。
- BFF 的 `/api/health` 只返回“是否配置”，不会回显 Token。

## 从旧版迁移的差异

| 旧 FastAPI | 新 BFF |
| --- | --- |
| `POST /upload/text` | `POST /api/analyze` |
| `POST /generate-exercises` | `POST /api/exercises` |
| `POST /submit-answer` | 移除，改为前端用 `answer_key` 本地判分 |
| `POST /upload/image`（multipart） | `POST /api/ocr`（JSON + base64 / URL） |
| `POST /chat` | `POST /api/chat` |
| `GET/DELETE /learning-records` | `src/api/history.js`（localStorage） |

## 已知限制

- 学习记录存在浏览器 `localStorage`（最多 50 条），跨设备/跨浏览器不同步；如需云端历史，可在 BFF 增加一个数据库端点。
- OCR 默认把图片作为 `data:` URL 传给工作流；若你的工作流只接受 Coze 文件 ID，设置 `COZE_IMAGE_AS_FILE_ID=1`。
- 工作流输出若使用了自定义字段名，只需调整 `src/api/adapters.js`，无需改动页面组件。

