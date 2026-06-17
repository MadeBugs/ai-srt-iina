# ai-srt-iina 🎬

[**English**](README.md)

**使用 AI 语音识别为 [IINA](https://iina.io) 播放器生成字幕的插件。**

通过本地 AI 语音识别（[whisper.cpp](https://github.com/ggerganov/whisper.cpp)）为 IINA 中正在播放的视频实时生成 SRT 字幕。所有处理**完全在本地完成**——无需联网，数据不会离开你的电脑。

## 工作原理

```
IINA 中播放视频
  │
  ├─ 1. 插件 → AI Subtitle → 生成字幕
  │
  ├─ 2. ffmpeg 提取音频（16 kHz，单声道，WAV）
  │
  ├─ 3. whisper.cpp 转录音频 → SRT
  │       └─ 实时进度显示在 OSD 上
  │
  ├─ 4. 字幕保存为 {视频文件名}.ai.srt（缓存）
  │
  └─ 5. 字幕自动加载到 IINA 中
```

## 特性

- **完全本地运行，保护隐私**——使用 whisper.cpp，不调用任何云端 API
- **一键生成**——从 IINA 的插件菜单即可操作
- **实时反馈**——转写过程中 OSD 持续显示进度
- **智能缓存**——生成的字幕保存在视频同目录下（`{文件名}.ai.srt`），下次播放自动加载
- **支持取消**——可随时中止长时间转写
- **依赖检查**——工具缺失时提示友好的错误信息

## 前提条件

- [IINA](https://iina.io) >= 1.3.0（需要插件系统支持）
- [Homebrew](https://brew.sh/)
- [ffmpeg](https://ffmpeg.org/) — `brew install ffmpeg`
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — `brew install whisper-cpp`
- Whisper 模型文件（见下方说明）

### 下载 Whisper 模型

插件使用 `ggml-small.en-q8_0.bin`（约 500 MB），在速度和准确性之间取得了良好的平衡（适用于英文内容）：

```bash
mkdir -p ~/.cache/whisper-cpp/models
curl -L -o ~/.cache/whisper-cpp/models/ggml-small.en-q8_0.bin \
  https://huggingface.co/Pomni/whisper-small.en-ggml-allquants/resolve/main/ggml-small.en-q8_0.bin
```

> 你也可以使用任何 whisper.cpp 兼容的模型。插件按以下顺序搜索模型文件：
> 1. `~/.cache/whisper-cpp/models/`
> 2. `./models/`（相对于插件目录）
> 3. IINA 的 `@data` 目录

## 安装

### 开发模式（推荐）

```bash
git clone https://github.com/example/ai-srt-iina.git
cd ai-srt-iina
iina-plugin link IINA-AI-Subtitle.iinaplugin
```

### 手动安装

将 `IINA-AI-Subtitle.iinaplugin` 复制到 IINA 的插件目录：

```bash
cp -r IINA-AI-Subtitle.iinaplugin \
  ~/Library/Application\ Support/com.colliderli.iina/plugins/
```

### 验证安装

打开 IINA，查看菜单栏中的 `Plugins`。如果看到 **AI Subtitle** 及其子菜单项，说明安装成功。

## 使用方法

1. 在 IINA 中打开一个视频文件
2. 点击 `Plugins → AI Subtitle → Generate Subtitle`（快捷键：`Ctrl+Shift+G`）
3. 通过 OSD 查看进度：
   - `AI Subtitle: Extracting audio...` — ffmpeg 正在提取音轨
   - `AI Subtitle: Transcribing: 42%` — whisper.cpp 正在转写
   - `AI Subtitle: Ready` — 字幕加载完成
4. 生成的 `{视频文件名}.ai.srt` 文件出现在视频同目录下

> **提示：** 如果已经有生成过的字幕，可以按 `Ctrl+Shift+L`（或通过 `Plugins → AI Subtitle → Load Cached Subtitle`）立即加载缓存。

## 项目结构

```
ai-srt-iina/
├── IINA-AI-Subtitle.iinaplugin/   # IINA 插件包
│   ├── Info.json                   # 插件元数据和权限声明
│   ├── main.js                     # 入口文件，菜单注册，流程编排
│   ├── lib/
│   │   ├── cache-manager.js        # 路径解析与缓存管理
│   │   ├── dependency-checker.js   # 检查 ffmpeg、whisper、模型文件
│   │   ├── progress-parser.js      # 实时进度解析（stderr）
│   │   └── subtitle-generator.js   # 音频提取 + 转写核心逻辑
│   ├── __tests__/                  # Jest 测试套件
│   └── README.md                   # 插件内部文档（英文）
├── package.json                    # 测试依赖
├── jest.config.js                  # Jest 配置
├── README.md                       # 项目说明（英文）
└── README.zh.md                    # 项目说明（中文，即本文件）
```

### 架构说明

该插件运行在 IINA 的 **JavaScriptCore** 环境中——没有 Node.js、没有浏览器 API、没有 `fs` 模块。它使用 IINA 的原生 API：

| API | 用途 |
|---|---|
| `iina.utils.exec()` | 执行 ffmpeg、whisper-cpp 等外部命令 |
| `iina.utils.fileInPath()` | 检查二进制文件是否在 PATH 中 |
| `iina.file.access()` | 检查文件是否存在 |
| `iina.core.subtitle.loadTrack()` | 将字幕加载到播放器中 |
| `iina.core.osd()` | 在屏幕上方显示进度信息 |
| `iina.menu` | 注册插件的菜单项 |

**处理流程：**
1. `main.js` 接收菜单点击事件
2. `dependency-checker.js` 验证所有依赖是否就绪
3. `cache-manager.js` 计算缓存路径，检查是否已有字幕
4. `subtitle-generator.js` 编排两阶段处理：
   - *阶段 1：* ffmpeg 提取音频到临时目录（16 kHz，单声道，PCM s16le WAV）
   - *阶段 2：* whisper.cpp 转写（`--print-progress` 提供实时进度）
5. 生成的 SRT 文件复制到视频目录，命名为 `{原文件名}.ai.srt`
6. `progress-parser.js` 全程解析进度，更新 OSD 显示

## 开发指南

```bash
# 安装测试依赖
npm install

# 运行测试
npx jest

# 生成覆盖率报告
npx jest --coverage
```

### 测试覆盖

测试套件覆盖以下模块：
- **cache-manager**：路径解析、扩展名校验、缓存路径计算
- **dependency-checker**：二进制搜索、模型文件搜索、环境注入测试
- **progress-parser**：ffmpeg 和 whisper.cpp 的 stderr 解析、状态跟踪
- **subtitle-generator**：参数构建、成功/错误流程、取消逻辑、回调、临时文件清理

所有模块均采用依赖注入模式——通过 `env` 对象模拟 IINA 的原生 API，测试快速且无需运行 IINA 实例。

### 添加功能

1. 在 `lib/` 中添加或修改模块
2. 在 `__tests__/` 中编写/更新测试
3. 在 `main.js` 中接入新功能（菜单项 + 处理函数）
4. 运行 `npx jest` 确保无回归

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Shift+G` | 为当前视频生成字幕 |
| `Ctrl+Shift+L` | 加载缓存字幕（如果存在） |

*（可在 IINA 的插件偏好设置中自定义。）*

## 常见问题

| 现象 | 可能原因 | 解决方法 |
|---|---|---|
| "Whisper engine not found" | 未安装 whisper.cpp | `brew install whisper-cpp` |
| "ffmpeg not found" | 未安装 ffmpeg | `brew install ffmpeg` |
| "Model file not found" | 未下载模型文件 | 参见[下载模型](#下载-whisper-模型) |
| "Audio extraction failed" | 视频文件损坏或受 DRM 保护 | 尝试其他视频文件 |
| "Transcription failed" | whisper.cpp 配置问题 | 运行 `whisper-cpp --help` 检查安装 |
| 菜单中无 "AI Subtitle" | 插件未安装或 IINA 版本过低 | 确保 IINA >= 1.3.0 并重新链接插件 |

## 为什么选择本地 AI？

- **隐私保护**——你的视频永远不会被上传到任何地方
- **离线可用**——首次下载模型后无需联网
- **零成本**——无限次生成字幕，无需支付 API 费用
- **速度快**——小模型在现代硬件上运行流畅

## 许可证

[MIT](LICENSE)
