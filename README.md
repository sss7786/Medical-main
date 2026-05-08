
  # Medical Pre-consultation Organizer

  前端：Vite + React；后端：FastAPI Agent（对话、报告合成、会话记忆、PDF 文本提取）。

  ## 环境要求

  - Node.js 18+
  - Python 3.10+

  ## 后端（必须先启动，前端 `/api` 才会通）

  ```bash
  cd server
  python -m venv .venv
  .venv\Scripts\activate          # Windows
  # source .venv/bin/activate      # macOS/Linux
  pip install -r requirements.txt
  copy .env.example .env           # 填写 OPENAI_API_KEY 等
  uvicorn main:app --reload --host 127.0.0.1 --port 8000
  ```

  不配 API Key 也可运行：**对话**使用内置话术轮换，**刷新报告**使用离线占位 JSON；配置 Key 后调用真实大模型。

  ## 前端

  ```bash
  npm install
  npm run dev
  ```

  开发时前端请求 **`/api/*`**，由 Vite **自动代理**到 `http://127.0.0.1:8000`，避免浏览器用 `localhost` 直连后端时出现 IPv6/跨域问题。

  可选：在根目录 `.env.development` 设置 `VITE_API_BASE=http://127.0.0.1:8000` 则开发环境改为直连后端（一般不必）。

  生产构建若前后端不同域，使用 `.env.production`：`VITE_API_BASE=https://你的后端域名` 后重新 `npm run build`。

  ## 构建

  ```bash
  npm run build
  ```

  ```bash
  npm run test
  ```

  后端（在 `server` 目录、已安装依赖后）：

  ```bash
  python -m pytest tests/ -q
  ```

  ## 课程提交：打包源码（不含 node_modules / .env）

  在**项目根目录**执行（PowerShell）：

  ```powershell
  .\scripts\package-source-for-submission.ps1
  ```

  将生成 zip（默认在上级文件夹中，内含 `SUBMIT_README.txt`）。可按学校要求指定名称：

  ```powershell
  .\scripts\package-source-for-submission.ps1 -FolderName "学号-姓名-期末项目" -ZipName "学号-姓名-期末项目.zip"
  ```

  详细说明见 `docs/课程提交-打包说明.txt`。请将 **PDF 报告** 按智慧树要求与源码一并提交（单包或多包以通知为准）。

  原始 UI 来自 [Figma 设计稿](https://www.figma.com/design/96z99MQLRcpY8GCH7pqiMQ/Medical-Pre-consultation-Organizer)。

## 智能体设计说明（便于课程报告 / 答辩）


技术选型说明：未引入 LangChain / CrewAI 等框架，采用 **原生 FastAPI** 编排 LLM 与业务路由，依赖清晰、便于答辩时对照代码讲解；在能力层面仍覆盖课程要点（LLM、Tools、Memory、分步规划与安全规则）。

本项目满足「Web 集成的智能体应用」要求，具体包括：**自然语言对话（LLM 或离线话术）**、**工具调用（PDF 文本提取、结构化报告合成）**、**会话记忆（按 session 持久化合并过敏/用药摘要并注入后续对话）**、**规划与推理（系统 Prompt 分步澄清症状/时间线/用药/过敏；危急表述拦截）**。

- 能力清单也可通过 **`GET /api/health`** 中返回的 `agent` 字段快速展示（Tools / Memory / 规划说明）。
- 前端：对话、分步表单要点、PDF 上传均在同一 session 下驱动 **`POST /api/synthesize`**，Agent 输出与右侧报告预览联动；窄屏下通过 **右下角浮动按钮** 打开报告侧栏。
- 语音输入：在支持 **Web Speech API** 的浏览器（推荐 Chrome / Edge 桌面版）可将普通话/英语语音转为文字填入输入框。
- **「打印 / 导出 PDF」**：技术实现为浏览器打印预览；用户需在系统打印对话框中选择「另存为 PDF」或「Microsoft Print to PDF」生成文件（首次使用应用内会有提示）。

### 伦理与隐私（医疗场景）

仅作就诊前**信息整理**，不做诊断与治疗建议；急诊关键词触发时中止一般对话并提示就医。会话记忆以作业演示为目的存储于 `server/data/memory/`（提交打包请勿包含个人隐私真实数据）。

### 部署加分项（可选）

将前端静态资源托管至 Netlify / Vercel 等，后端部署至云主机或 PaaS，配置 `VITE_API_BASE` 指向公网 API，并在项目报告中写明 URL。

### AI 辅助工具声明（写入 PDF 报告时请按学院要求如实修改）

示例：「本项目使用 Cursor / 同类 IDE 辅助完成 FastAPI 路由与 React 组件的编写与重构；报告由本人撰写后使用工具进行语言润色。本人已通读并能够解释项目内全部核心代码。」

**课程期末报告（PDF 源稿）：** 见仓库内 [`期末项目报告.md`](./期末项目报告.md)（含背景、技术选型、实现细节、功能展示、问题与解决、总结展望及 **AI 工具声明** 专节）；用 Word 打开后导出 **PDF** 与智慧树要求一并打包提交。
