# Draw.io Integration 中文使用指南

> 基于 `hediet.vscode-drawio` 1.19.0 源码整理（2026-11）。这是一个**非官方**扩展，把 [Draw.io / diagrams.net](https://www.diagrams.net/) 完整嵌入 VS Code，默认使用内置离线版，无需联网、无需打开浏览器。
>
> 本文覆盖扩展的全部功能、具体操作步骤和适用场景。文中「**定制**」标记的功能是本仓库在上游 1.19.0 基础上新增或调整的行为。

## 目录

- [1. 安装与快速上手](#1-安装与快速上手)
- [2. 文件格式怎么选](#2-文件格式怎么选)
  - [图片：只记录相对地址（定制）](#图片只记录相对地址定制)
- [3. 编辑器一览：Open With 里各个选项的区别](#3-编辑器一览open-with-里各个选项的区别)
- [4. 图内链接：点击节点打开项目里的文件（定制）](#4-图内链接点击节点打开项目里的文件定制)
- [5. Code Link：图与代码互相跳转](#5-code-link图与代码互相跳转)
- [6. Markdown 内联图：把图写进文档](#6-markdown-内联图把图写进文档)
- [7. 导出、转换与自动化](#7-导出转换与自动化)
- [8. 协作编辑（Live Share）](#8-协作编辑live-share)
- [9. 主题、外观与编辑器配置](#9-主题外观与编辑器配置)
- [10. 插件与自定义图库](#10-插件与自定义图库)
- [11. 命令速查表](#11-命令速查表)
- [12. 配置速查表](#12-配置速查表)
- [13. 快捷键与交互入口](#13-快捷键与交互入口)
- [14. 典型使用场景](#14-典型使用场景)
- [15. 示例文件导览](#15-示例文件导览)
- [16. 限制与注意事项](#16-限制与注意事项)
- [17. 本地开发、调试与打包](#17-本地开发调试与打包)
- [18. 本仓库相对上游的定制差异](#18-本仓库相对上游的定制差异)

---

## 1. 安装与快速上手

### 安装

- **扩展市场**：VS Code 扩展面板搜索 `Draw.io Integration`（发布者 `hediet`）并安装。
- **本地安装包**：命令行执行 `code --install-extension dist\extension.vsix --force`，或扩展面板 `...` → `Install from VSIX...`。同版本号覆盖安装需要 `--force`。
- 要求 VS Code `>= 1.70.0`。安装后**重载窗口**一次。

### 三分钟上手

1. 在工作区新建一个**空文件**，命名为 `architecture.drawio`（或 `xxx.dio` / `xxx.drawio.svg` / `xxx.drawio.png`）。
2. 双击打开，默认就以 Draw.io 图形编辑器打开。也可以命令面板运行 `Draw.io: New Draw.io Diagram`，通过保存对话框创建。
3. 画几个节点和连线，直接关闭标签或按 `Ctrl+S` 保存。文件内容就是图数据本身。
4. 想看底层数据：命令面板 `View: Reopen Editor With...` → `Text Editor`，可以看到格式化过的 XML；两个视图可以并排打开，改动实时同步。

> 默认 `hediet.vscode-drawio.offline = true`，用的是扩展自带的 Draw.io，完全离线。若改成 `false`，会加载 `online-url` 指向的在线编辑器（默认 `https://embed.diagrams.net/`）。

---

## 2. 文件格式怎么选

| 后缀 | 文件内容 | 默认编辑器 | 优点 | 适合场景 |
|---|---|---|---|---|
| `.drawio` / `.dio` | 纯 XML（`<mxfile>`） | `Draw.io` | git diff 干净、可被 AI/脚本读写、可查找替换 | **首选**。团队协作、版本管理、AI 辅助改图 |
| `.drawio.svg` / `.dio.svg` | 合法 SVG 图片，内嵌图数据 | `Draw.io` | 可直接 `![](x.drawio.svg)` 嵌进 README，GitHub/GitLab 能直接显示，无需导出 | 开源项目文档、README 里的架构图 |
| `.drawio.png` / `.dio.png` | 合法 PNG 图片，内嵌图数据 | `Draw.io (Binary)` | 任意图片查看器都能显示 | 需要 PNG 的场景；画质不如 SVG，能用 SVG 就别用 PNG |

编辑 SVG/PNG 类文件时，扩展会在保存时**自动更新图片本身**，所以永远不需要手动「导出图片再替换」。

### 格式互转

命令面板 `Draw.io: Convert To...`，可在 `.drawio` / `.drawio.svg` / `.drawio.png` 之间转换（要求文件已保存、目标文件不存在）。转换后原文件会被重命名/替换，适合「先用纯 XML 迭代，最后转成图片给文档用」。

### 图与 XML 并排编辑

同一个 `.drawio` 文件可以同时用 `Draw.io` 和文本编辑器打开（用 `View: Reopen Editor With...` 切换，可开多个编辑器）：

- 在文本里批量查找替换标签、批量改样式，图上立即更新；
- 外部文本改动会增量合并到图，缩放、选中状态、撤销栈保留；
- 主编辑器保存时会自动格式化 XML、固定 `host`、保证 `<mxGraphModel>` 是明文（便于 diff）。

对 AI 助手同样友好：图在你眼里是画布，在 agent 眼里是文本；它能读 PR 中「新增了一个节点 / 改了一条连线」的 diff，也能直接改 XML。

> SVG 文件不适合这么用，因为图数据存在 SVG 元数据里而不是正文。

### 让任意 `.svg` 也用 Draw.io 打开

默认只接管 `*.drawio.svg`。在 `settings.json` 加：

```json
"workbench.editorAssociations": {
    "*.svg": "hediet.vscode-drawio-text"
}
```

注意：**只能编辑 Draw.io 生成的 SVG**，普通 SVG 打开后无法当作图编辑。

### 明暗配色

`hediet.vscode-drawio.svgAppearance` 控制 `.drawio.svg` 与 SVG 导出的配色：

- `light`（默认）：始终浅色；
- `dark`：始终深色；
- `auto`：随展示页面（例如 GitHub 深色模式的 README）自适应。

建议写进工作区设置，让团队保存出来的图片配色一致。设置**在下次保存时**生效。

### 图片：只记录相对地址（定制）

Draw.io 默认把插入的图片以 `data:image/png,<base64>` 直接写进 cell 的 `image=` 样式，一张截图就能让 `.drawio` 多出几万行 base64，git diff 基本没法看。本仓库改成**磁盘上只存相对路径**——图片文件由你自己放在工作区里（位置随意），扩展只引用、不创建、不复制、不移动它们：

```xml
<mxCell style="shape=image;image=./images/arch.png;aspect=fixed;" ... />
```

`git diff` 里只有这一行短文本；图片作为普通二进制文件随仓库一起提交。

#### 怎么用

| 操作 | 结果 |
|---|---|
| 从 **VS Code 资源管理器拖图片到画布** | 图片作为图节点插入；文件本来就在工作区时，直接引用它相对图文件的路径，不会再复制一份 |
| 在 `Insert > Image` 的 URL 框填**相对地址**（如 `./images/a.png`），或把图片拖进该对话框 | 扩展读取本地文件后插入，XML 仍写相对地址，不会报 `file not found` |
| 在文本编辑器里直接把 `image=` 改成另一个相对路径 | 保存后图上立即更新；外部文本改动走第 2 节的增量合并逻辑 |
| 从系统文件管理器拖入、粘贴图片、`Insert > Image` → `Open` 选本地文件 | **不推荐**：扩展不会为你创建图片文件，这类入口仍按 Draw.io 原生行为把 base64 写进 XML。请先把图片放进工作区，再从资源管理器拖入 |

已有 base64 的老图也**不会**被自动外置；要清理的话，把图片另存到工作区、再从资源管理器拖入替换即可。

#### 原理（为什么要绕一圈）

webview 的 `<base>` 指向扩展自带的 Draw.io 应用目录，浏览器会把 `./images/a.png` 解析到那里而不是图文件旁边，所以相对路径在编辑器里本身渲染不出来。扩展在**送入编辑器前**读取本地图片、临时换成 Draw.io 的短 data URI（只存在于内存与 webview），**写回磁盘前**再按图片内容哈希还原成相对路径。映射按内容计算，重开图、换机器 clone 都能对上；webview 地址、绝对路径、机器名永远不会写进文件。只有「来自某个磁盘相对引用」的图片才有映射，无来源的 base64 原样保留。

拖放时，扩展拦截 Draw.io 会把 `file:///...` 当文本插入的行为，并在插入后让 Draw.io 自己清理拖拽高亮；同一文件出现在多种 dataTransfer 格式里（`text/uri-list` / `application/vnd.code.resourceUrls`）时按规范化 URI 和图片内容双重去重，不会插入两张。

#### 图片放在哪

图片放在哪个目录完全由你自己决定：从 VS Code 资源管理器拖入时，扩展只是把该文件路径换算成相对图文件的引用，不移动、不复制、不改名，也**没有任何配置项**。换句话说，扩展对图片文件是**只读**的——它不会往磁盘上写任何图片。

#### 边界

- **只支持相对地址**：不生成 `http(s)` 外链、绝对路径或 `C:\...`；文件里已有的外链、内联 SVG 文本型 data URI、以及无来源的 base64 原样保留。扩展**不会创建、复制或移动任何图片文件**。
- 路径必须落在**工作区内**，越界会被拒绝并提示；图片文件找不到时保留原引用、不丢 cell，改好路径后重开即可。
- 支持 png / jpg / jpeg / gif / webp / bmp / svg / avif。
- 导出 SVG / PNG 时图片会内嵌，**导出的图片仍然自包含**；`Export To...` / `Convert To...` 输出 `.drawio` 时同样写相对地址，后台导出 API 也一致。
- **适用范围**：离线模式 + `Draw.io` 主编辑器里的 `.drawio` / `.dio`。在线模式、`.drawio.svg` / `.drawio.png` 内嵌的 XML、`Draw.io Inline Editor` 和内联 Markdown 编辑器暂不处理，仍按原来的 base64 方式工作（不会坏，只是 diff 里还有 base64）。

---

## 3. 编辑器一览：Open With 里各个选项的区别

| 显示名 | viewType | 适用文件 | 是否默认 | 定位 |
|---|---|---|---|---|
| `Draw.io` | `hediet.vscode-drawio-text` | `.drawio`、`.dio`、`.dio.svg`、`.drawio.svg` | ✅ `default` | **主力编辑器**，全功能 |
| `Draw.io (Binary)` | `hediet.vscode-drawio` | `.drawio.png`、`.dio.png` | ✅ `default` | 二进制 PNG 图 |
| `Draw.io Inline Editor` | `drawio-inline-editor.drawioEditor` | `.drawio`、`.dio` | ❌ `option` | 精简/实验入口，需手动 Open With |
| `Markdown with Diagrams (Experimental)` | `drawio-inline-editor.markdownEditor` | `.md` | ❌ `option` | 富 Markdown 编辑器，正文里内联可编辑的图 |
| `Markdown Editor`（VS Code Insiders 自带） | 非本扩展的 customEditor | `.md` 中 ```` ```drawio ```` 围栏 | — | WYSIWYG Markdown 编辑器，围栏块变成实时 Draw.io 编辑器 |

### 主力 `Draw.io` 与 `Draw.io Inline Editor` 的实际差别

画图本身几乎一样（加载的是同一份 Draw.io 前端），差别在 VS Code 集成侧：

| | `Draw.io` | `Draw.io Inline Editor` |
|---|---|---|
| 保存的 XML | 格式化缩进、规范化 host、明文 `mxGraphModel`，diff 干净 | draw.io 原样整篇替换，不格式化，可能是单行 |
| 与外部文本编辑同步 | 增量合并，保留缩放/选中/撤销 | 整图重载，视图状态丢失 |
| 状态栏 `Theme:`、Code Link 开关 | 有 | 无 |
| `Change Theme` / `Convert To...` / `Export To...` 命令 | 可用 | 点了没反应 |
| 自定义插件、自定义图库、Liveshare、Extras > Configuration 写回设置 | 支持 | 不支持（`customLibraries` 明确被省略） |
| File 菜单 | 隐藏 Export as / Import from / Plugins / Save & Exit 等，改由 VS Code 命令提供 | 保留（只隐藏 Print），Save & Exit 只触发保存不关标签 |
| 离线实现 | webview 直接加载扩展内的 webapp | iframe + 本地 HTTP 服务器 |

**结论**：日常一律用默认的 `Draw.io`；`Draw.io Inline Editor` 主要是开发/调试内联图功能时的实验入口。注意别和 `.md` 的 `Markdown with Diagrams` 混淆——后者才是「Markdown 正文内联图」的主场景。

---

## 4. 图内链接：点击节点打开项目里的文件（定制）

这是把图当作**项目导航图**用的功能：在节点上设置一个相对路径链接，点击后直接在 VS Code 里打开对应文件，与图并排显示。

### 怎么用

1. 在 `Draw.io` 编辑器里选中一个节点或连线。
2. 右键 → `Edit Link`（或 Draw.io 的链接编辑入口），填入**相对路径**，例如：
   - `./main.md`：图文件同目录的 `main.md`
   - `./docs/design.md`：子目录里的文件
   - `../README.md`：上一级目录（工作区内）
3. 点击该节点上的链接图标/链接文字。

### 点击后的行为

- **只支持相对路径，且相对于「图文件所在目录」解析**，不是工作区根目录、也不是 Draw.io 安装目录。
- **不会跳浏览器**：扩展会拦截被 Draw.io 绝对化的 webview URL，内部链接绝不会交给系统浏览器；真实 `https://` / `mailto:` 外链仍照常在默认浏览器打开。
- **打开到已有组**：优先图所在组**右边**的组 → 右边没有就用**左边**的组 → 左右都没有才在右侧**新建组**。这样图和 Markdown 可以同时看到。
- **已打开就切过去**：如果该文件的标签已经存在（含后台标签），直接激活那个视图，不会重复开新标签；快速连点也有去重。
- **文件不存在只提示**：弹出 `Draw.io: file not found: ... (relative to ...)`，不会自动创建文件。
- **导航历史正常**：标签以 `preview: false` 固定，焦点移到目标文件，`Alt+Left` 可以返回图。
- 所有编辑器都接入了这套逻辑：`Draw.io`、`Draw.io (Binary)`、`Draw.io Inline Editor`、`Markdown with Diagrams`、Insiders 的 Markdown 代码块图块。

### 边界

| 情况 | 行为 |
|---|---|
| 相对路径指向工作区外 | 提示 `link points outside the workspace`，拒绝打开 |
| `file:` / `javascript:` / `data:` 链接 | 忽略（安全考虑，图文件可能来自他人仓库） |
| `#锚点`、`?查询参数` | 忽略，只取路径部分 |
| 绝对路径、外部 URL | 外部 http(s)/mailto 走浏览器；其余不支持 |
| 在线模式（`offline: false`） | **不支持**相对路径跳转，保持原有外链行为 |

### 使用场景

- **架构图即导航**：每个方框链接到对应模块的 `README.md` / 设计文档 / 接口定义，点一下就到代码说明。
- **新人导览图**：画一张系统全景图，节点链接到各子系统的入门文档。
- **图 + 需求/ADR 并排**：左边看图、右边看决策记录，评审时不用切窗口。
- **项目首页图**：`docs/overview.drawio` 里的节点链接到 `docs/*.md`，把散落的文档串起来。

> 与 Code Link 的区别：本节是 Draw.io 自带的 **Edit Link**（写进 cell 的 `link` 属性，填路径字符串），适合链接文档/任意文件；下一节的 Code Link 是把节点与**代码位置/符号**绑定，适合跳到具体函数或某一行。两者现在共用同一套「相邻组打开 + 已打开激活 + Alt+Left 可返回」的逻辑。

---

## 5. Code Link：图与代码互相跳转

支持把节点/边关联到代码文件的某个选区、某个文件、某个文档符号或工作区符号，双击节点即可跳转。关联信息以**相对图文件的路径**保存，图可以随仓库移动。

### 开启

- 点击状态栏左侧 `Code Link`（`$(link) Code Link`），或命令面板 `Draw.io: Toggle Code Link Activation`；
- 也可以设 `hediet.vscode-drawio.codeLinkActivated: true`（默认 `false`，按图文件记忆）。

> 开启后，想改节点标签需要先关闭 Code Link，或选中节点按 `F2`——否则双击会触发跳转。

### 四种建立链接的方式

| 方式 | 触发 | 操作 |
|---|---|---|
| `#符号名` 标签 | 直接把节点标签写成 `#MyClass` | 启用 Code Link 后双击节点，执行工作区符号搜索并跳到定义 |
| `Link Code with Selected Node` | 命令面板 / `Shift+F3` | 先在代码里选中一段，再选中图节点执行命令，把选区 Range 写入节点 |
| `Link File With Selected Node` | **资源管理器右键 → `Draw.io` 组** | 先选中图节点，再在文件上右键，把该文件 URI 写入节点（此命令在命令面板中被隐藏） |
| `Link Symbol With Selected Node` | 命令面板 | 选中节点 → 打开目标代码文件 → 从文档符号树里选符号；层级用 `.` 分隔，图里可按 `Ctrl+M` 编辑路径 |
| `Link Workspace Symbol With Selected Node` | 命令面板 | 只存顶层符号路径，跳转时再解析；文件可以随意移动，但部分语言的 symbol provider 不支持导出符号会告警 |

### 跳转后的行为（本仓库已优化）

- 打开到图所在组的**右侧组 → 左侧组 → 右侧新建组**，不再固定 `ViewColumn.One` 同组替换；
- 目标文件已打开则直接激活，不重复开标签；
- 标签固定（`preview: false`），焦点移到目标文件，**`Alt+Left` 可以返回图**；
- 有精确 Range 时 `revealRange` 定位，并用当前主题的 `editor.stackFrameHighlightBackground` 高亮约 1 秒。

### 使用场景

- **代码导览 / Onboarding**：一张模块图，节点直接跳到入口类，新人不用全局搜索。
- **架构评审**：图上每个组件链接到实现位置，评审时点开就看代码。
- **截图对应源码**：把 UI 截图粘进图里，再给截图节点链接到对应 React 组件。
- **可视化书签**：把常用代码位置收进一张图，替代书签列表。
- 对 `.drawio.png` / `.drawio.svg` 同样有效，但**在 GitHub 网页上不生效**（需要 VS Code）。

> 提示：工作区符号搜索要求「**先打开过该项目里的任意一个文件**」，否则 VS Code 不会把这个项目纳入符号搜索范围；这个文件本身不必包含目标符号。

---

## 6. Markdown 内联图：把图写进文档

扩展增强了 VS Code 的 Markdown 预览，并在 Markdown 源码上提供 CodeLens 与命令，让图直接住在 `.md` 里。

### 两种图块写法

````markdown
```drawio
<mxfile>...</mxfile>
```

<!-- drawio:start locked -->
<mxfile>...</mxfile>
<!-- drawio:end -->
````

围栏块可加属性：```` ```drawio locked height=300 width=600 ````

- `locked`：只读，不显示编辑入口；
- `height=N`：固定图块高度（代码块图块最小约 120px）；
- `width=N`：预览宽度（最小 200，映射为 `maxWidth`）。

Markdown 预览会把这些块渲染成 Draw.io 图形查看器，预览里还有 **Edit** 按钮，点击会通过 URI handler 跳回源码中精确的图块。

### 命令与 CodeLens

| 命令 | 触发 | 作用 |
|---|---|---|
| `Draw.io: Insert New Diagram` | 命令面板 | 选择围栏格式或 HTML 注释格式，在光标处插入空图块 |
| `Draw.io: Edit Diagram` | CodeLens `Edit Diagram`、命令面板、预览 Edit 按钮 | 在旁边组打开完整编辑器编辑指定图块 |
| `Draw.io: Open Inline Preview` | CodeLens `Inline Edit`、命令面板 | 打开/复用 `Markdown with Diagrams` 编辑器并滚动到该图块 |
| `Draw.io: Preview Diagram` | CodeLens `Preview`、命令面板 | 只读预览面板 |
| `Draw.io: Toggle Diagram Lock` | CodeLens `Lock/Unlock`、命令面板 | 改写图块 `locked` 属性；锁定块会整行加底色，隐藏编辑入口 |
| `Draw.io: Convert Mermaid to Draw.io` | `mermaid` 代码块 CodeLens / 命令面板 | 把 Mermaid 源码转成可编辑的 Draw.io 图块（保留 `mermaidSource`） |
| `Draw.io: Convert PlantUML to Draw.io` | `plantuml` / `puml` 代码块 CodeLens | 同上，PlantUML 转图 |

编辑结果**直接写回 Markdown 文件**，所以 `.md` 始终是唯一数据源，撤销、脏状态、热退出都照常工作。`drawio-inline-editor.autoLock` 可以让图块在编辑后自动锁定。

### 链接的图片也能内联编辑

`![架构图](diagrams/arch.drawio.svg)` 这样的链接图片，在 `Markdown with Diagrams` 编辑器里可以直接编辑并写回图片文件；也可以在预览里点击 Edit 打开完整编辑器。

### `Markdown with Diagrams (Experimental)`

`View: Reopen Editor With... > Markdown with Diagrams (Experimental)`：把 `.md` 当作富文本编辑器，正文分段渲染、图块就地可编辑，支持 Mermaid/PlantUML 转换、滚动定位、链接图片编辑。用 `drawio-inline-editor.minimalUI`（默认 `true`）控制是否隐藏侧栏/格式面板/滚动条，`diagramPadding`（默认 28px）控制图内容留白。

### VS Code Insiders 的 WYSIWYG Markdown 编辑器（实验）

Insiders 版自带实验性 Markdown 编辑器（`View: Reopen Editor With... > Markdown Editor`）会把 ```` ```drawio ```` 围栏替换成实时、可调整大小的 Draw.io 编辑器：

- 修改直接写回围栏，撤销、脏状态、热退出都正常；
- 支持 `locked`、`height=N`；Markdown 编辑器自身的锁开关也会把图设为只读；
- 依赖 `markdown.codeBlockEditorProviders` 贡献点，**稳定版 VS Code 没有**，此时围栏按纯文本显示或由预览插件渲染；
- 动态 provider 只在**受信工作区**运行；
- 主题/字体/自定义库等设置要**重开 Markdown 编辑器**才生效；
- **Draw.io 插件不会加载进内联编辑器**。

### 使用场景

- 技术设计文档、ADR、教程里「图与文字同源」，评审时改图即改文档；
- 用 Mermaid 快速起草，再转成 Draw.io 精修布局；
- 团队文档统一放在 Markdown 里，避免「图文件 + 文档」两套资产不同步；
- 需要锁定的正式文档：加 `locked` 防止误改。

---

## 7. 导出、转换与自动化

### 交互命令

- `Draw.io: Export To...`：选择格式（`.svg` / `.png` / `.drawio`）与保存位置，导出当前可见页。
- `Draw.io: Convert To...`：把当前图文件在三种格式之间转换（见第 2 节）。

### 供其它扩展 / 脚本调用的导出 API

`hediet.vscode-drawio.export` 支持无界面、无弹窗的后台导出：

```ts
const uri = await vscode.commands.executeCommand("hediet.vscode-drawio.export", {
    source: "diagrams/architecture.drawio",
    destination: "public/diagrams/architecture.svg", // 可选
    format: "svg",        // 可选：svg | png | drawio
    overwrite: true,      // 可选，默认 false
});
```

- `source` / `destination` 可以是 `Uri`、URI 字符串、绝对路径或相对第一个工作区目录的路径；缺失的目录会自动创建。
- 不给 `destination` 时导出到源文件旁边（`architecture.drawio` → `architecture.svg`）；不给 `format` 时按目标扩展名推断，否则默认 SVG。
- 导出的是**已保存**的文件，多页图只导第一页；过程中会短暂打开一个临时标签再关闭。
- 成功返回写入文件的 `Uri`；失败（如目标已存在且未设 `overwrite`）会 reject 并给出原因。
- 不带参数调用时，退化成交互式的 `Draw.io: Export To...`。

### 使用场景

- CI / 构建脚本批量把 `.drawio` 生成成文档站用的 SVG/PNG；
- 其它扩展集成图导出（例如文档生成器、发布流水线）；
- 把纯 XML 图一次性转成图片提交到 README。

---

## 8. 协作编辑（Live Share）

安装 **VS Code Live Share** 后，协作会话会自动同步 Draw.io 图：

- 各参与者的活动图 URI、光标位置、选中单元格、框选矩形都会同步，并在图里渲染成彩色光标/选区；
- 参与者离开会话时其光标自动移除；
- 配合 Draw.io 的自由画笔和 LaTeX 支持，可以当远程白板用。

**场景**：远程架构评审、结对头脑风暴、远程代码面试白板、给同事讲解系统设计。

**限制**：内部是把图同步成文本文档再由 Live Share 共享；Live Share 不理解图语义，**多人同时修改可能产生冲突**。

---

## 9. 主题、外观与编辑器配置

### 切换主题

- 状态栏右侧 `Theme: <主题 - 外观>`，点击或命令面板 `Draw.io: Change Theme`，QuickPick 可实时预览。
- `hediet.vscode-drawio.theme`：`auto` / `kennedy`（默认）/ `min` / `simple` / `sketch`。
- `hediet.vscode-drawio.appearance`：`automatic` / `light`（默认）/ `dark` / `high-contrast-light` / `high-contrast`；`automatic` 会跟随 VS Code 明暗主题。

### Draw.io 原生配置

`hediet.vscode-drawio.config` 接受 [Draw.io 官方配置项](https://www.drawio.com/doc/faq/configure-diagram-editor)，例如把滚轮从缩放改成滚动：

```json
"hediet.vscode-drawio.config": {
    "zoomWheel": false
}
```

- 也可以在编辑器里打开 **Extras > Configuration** 图形化修改，改动会写回用户设置；AI 相关密钥（`gptApiKey` / `geminiApiKey` / `claudeApiKey`）存入 VS Code 的 **Secret Storage**，不会明文落在 settings.json。
- 工作区设置优先级高于用户设置；被工作区设置的选项不会出现在该对话框里。
- 有独立设置项的选项（如 `customFonts`）以独立设置为准。
- 内联 Markdown 编辑器也会读取这份配置，但滚轮始终用于滚动文档。

### 团队视觉规范

`styles`、`defaultVertexStyle`、`defaultEdgeStyle`、`colorNames`、`presetColors`、`customColorSchemes`、`customFonts` 可以统一格式面板里的默认样式、色板和字体，适合「所有架构图长一个样」的团队规范。把这些写进工作区 `.vscode/settings.json` 即可全员生效。

其它常用项：`zoomFactor`（滚轮缩放系数，默认 1.2）、`simpleLabels`（SVG 不用 ForeignObject）、`globalVars`（全局占位符变量）、`resizeImages`（粘贴图片是否自动缩放）、`showTooltipIcons` / `showLinkIcons` / `showConnectHandle`。

---

## 10. 插件与自定义图库

### Draw.io 插件

```json
"hediet.vscode-drawio.plugins": [
    { "file": "${workspaceFolder}/svgdata.js" }
]
```

- `file` 必须是绝对路径，可用 `${workspaceFolder}`。
- 打开图时，首次加载或插件文件变化会弹出 **Allow / Disallow** 信任确认；决定记入用户级 `hediet.vscode-drawio.knownPlugins`（含 `pluginId`、SHA256 指纹、`allowed`），避免随工作区分发的插件被静默加载。
- **受限模式（Restricted Mode）下工作区插件设置被忽略**；内联 Markdown 编辑器也不加载插件。
- 详见 `docs/plugins.md`。

### 自定义图库

`hediet.vscode-drawio.customLibraries` 数组，每项可含 `entryId`、`libName`，并用 `url` / `xml` / `json` / `file` 四种方式之一提供内容，例如企业内部的图标库、云厂商组件形状库。

**场景**：公司统一的架构图元件、领域专用图形、需要随仓库共享的形状库。

---

## 11. 命令速查表

命令面板中所有命令都带 `Draw.io: ` 前缀。

### 文件与导出

| 命令 | 触发 | 作用 |
|---|---|---|
| `New Draw.io Diagram` | 命令面板 | 通过保存对话框新建空 `.drawio` |
| `Convert To...` | 命令面板、Draw.io 菜单 | 在 `.drawio` / `.drawio.svg` / `.drawio.png` 间转换 |
| `Export To...` | 命令面板、Draw.io 菜单 | 导出当前页为 SVG/PNG/`.drawio`；也可被其它扩展带参调用 |
| `Edit Diagram As Text (Experimental)` | 命令面板（实验开关） | 在旁边组打开虚拟 `*.drawio-txt`，以 `id: label` 形式批量增删/改名节点 |

### 主题与 Code Link

| 命令 | 触发 | 作用 |
|---|---|---|
| `Change Theme` | 命令面板、状态栏 `Theme:` | 切换主题与明暗外观 |
| `Toggle Code Link Activation` | 命令面板、状态栏 `Code Link` | 开关节点跳转 |
| `Link Code with Selected Node` | 命令面板、`Shift+F3` | 把当前文本选区绑定选中节点 |
| `Link File With Selected Node` | **资源管理器右键 `Draw.io` 组** | 把文件绑定选中节点（命令面板中隐藏） |
| `Link Symbol With Selected Node` | 命令面板 | 绑定文档符号层级路径 |
| `Link Workspace Symbol With Selected Node` | 命令面板 | 绑定工作区顶层符号，文件可移动 |

### Markdown 内联图

| 命令 | 触发 | 作用 |
|---|---|---|
| `Insert New Diagram` | 命令面板 | 插入空图块 |
| `Edit Diagram` | 命令面板、CodeLens、预览 Edit 按钮 | 在旁边组编辑指定图块 |
| `Open Inline Preview` | 命令面板、CodeLens `Inline Edit` | 打开内联编辑器并定位 |
| `Preview Diagram` | 命令面板、CodeLens `Preview` | 只读预览 |
| `Toggle Diagram Lock` | 命令面板、CodeLens `Lock/Unlock` | 锁定/解锁图块 |
| `Convert Mermaid to Draw.io` | 命令面板、Mermaid 块 CodeLens | Mermaid 转可编辑图 |
| `Convert PlantUML to Draw.io` | 命令面板、PlantUML 块 CodeLens | PlantUML 转可编辑图 |

---

## 12. 配置速查表

### General（前缀 `hediet.vscode-drawio.`）

| 键 | 默认值 | 作用 |
|---|---|---|
| `offline` | `true` | 使用内置离线 Draw.io |
| `online-url` | `https://embed.diagrams.net/` | 关闭离线时加载的地址 |
| `codeLinkActivated` | `false` | 选中节点是否跳到关联代码 |
| `config` | `{}` | Draw.io 原生配置对象（含 Extras > Configuration 写回） |
| `local-storage` | `{}` | Draw.io 本地存储（只读，请勿手改） |
| `simpleLabels` | `false` | SVG 不使用 ForeignObject |
| `svgAppearance` | `light` | `.drawio.svg` / SVG 导出配色：`light` / `auto` / `dark` |
| `zoomFactor` | `1.2` | 滚轮/触控板缩放系数 |
| `globalVars` | — | 全局占位符变量（键值对，数量宜少） |
| `resizeImages` | `null` | 粘贴图片自动缩放；未设时询问 |
| `showTooltipIcons` | `false` | 显示提示图标 |
| `showLinkIcons` | `false` | 显示链接图标 |
| `showConnectHandle` | `false` | 选中形状时显示连接手柄 |

### Inline Editor（前缀 `drawio-inline-editor.`）

| 键 | 默认值 | 作用 |
|---|---|---|
| `autoLock` | `false` | 编辑后自动锁定图块 |
| `minimalUI` | `true` | 隐藏侧栏、格式面板、滚动条 |
| `diagramPadding` | `28` | 图内容四周留白（0–100px，需足够容纳选中手柄） |

### Plugins（前缀 `hediet.vscode-drawio.`）

| 键 | 默认值 | 作用 |
|---|---|---|
| `plugins` | `[]` | 本地 Draw.io 插件文件列表（绝对路径 / `${workspaceFolder}`） |
| `knownPlugins` | `[]` | 插件指纹白/黑名单（用户级、自动维护） |
| `customLibraries` | `[]` | 自定义图库（`url` / `xml` / `json` / `file`） |

### Theme and styles（前缀 `hediet.vscode-drawio.`）

| 键 | 默认值 | 作用 |
|---|---|---|
| `styles` | — | 格式面板 Style 页的颜色预设 |
| `defaultVertexStyle` | — | 形状默认样式 |
| `defaultEdgeStyle` | — | 连线默认样式 |
| `colorNames` | — | 颜色提示名（大写色值 → 名称） |
| `presetColors` | — | 颜色对话框上排色板 |
| `customColorSchemes` | — | 格式面板顶部配色方案页 |
| `customFonts` | `[]` | 自定义字体 |
| `theme` | `kennedy` | `auto` / `kennedy` / `min` / `simple` / `sketch` |
| `appearance` | `light` | `automatic` / `light` / `dark` / `high-contrast-light` / `high-contrast` |

> 配置按图文件作用域读取，可在资源/工作区级别覆盖。另有一个未公开声明的 `hediet.vscode-drawio.enableExperimentalFeatures` 用于开启 `Edit Diagram As Text (Experimental)`；该命令的启用条件键名与实现不完全一致，若命令不可用，直接用 `View: Reopen Editor With... > Text Editor` 更可靠。

---

## 13. 快捷键与交互入口

| 入口 | 操作 |
|---|---|
| `Shift+F3` | `Link Code with Selected Node`（查找框不可见时） |
| `F2` | 在 Draw.io 里改选中节点标签（Code Link 开启时尤其有用） |
| `Ctrl+M` | 在 Draw.io 里编辑符号层级路径 |
| `Ctrl+P` / `Ctrl+Shift+P` / `Ctrl+Tab` / `Ctrl+S` / `Ctrl+Shift+S` / `F1` | 快捷键透传，交还 VS Code 处理，不被 Draw.io 截获 |
| 状态栏左 `Code Link` | 开关图到代码的跳转 |
| 状态栏右 `Theme: ...` | 切换主题/外观 |
| 资源管理器右键 → `Draw.io` | `Link File With Selected Node` |
| 资源管理器拖图片到画布 / `Insert > Image` 填相对地址 | 图片外置为本地文件，图里只存 `image=./...`（见第 2 节） |
| Markdown 源码 CodeLens | `Edit Diagram` / `Inline Edit` / `Preview` / `Lock` / `Convert to draw.io` |
| Markdown 预览里的 Edit 按钮 | 跳回源码中对应图块并打开编辑器 |
| `View: Reopen Editor With...` | 在图形编辑器、文本编辑器、各实验编辑器之间切换 |

---

## 14. 典型使用场景

| 场景 | 推荐用法 | 关键步骤 |
|---|---|---|
| 写设计文档，图和文字要同步 | Markdown 内联图 + `Edit Diagram` | `Insert New Diagram` → 编辑 → 内容直接写回 `.md` |
| README 里放架构图 | `.drawio.svg` | 建 `arch.drawio.svg` 画图 → `![](arch.drawio.svg)`，无需导出；深色模式设 `svgAppearance: auto` |
| 图作为项目导航 | 图内相对链接（第 4 节） | 节点 Edit Link 填 `./docs/api.md` → 点击在相邻组打开 |
| 新人熟悉代码库 | Code Link | 图上节点标 `#ServiceName` 或用 `Link Code with Selected Node` 绑定入口类 |
| 架构评审 / 代码走读 | Code Link + 并排布局 | 图放一组、代码在相邻组；`Alt+Left` 来回切换 |
| 团队协作画图 | Live Share | 开会话即可，能看到彼此光标和选区 |
| AI 辅助改图 | `.drawio` 纯 XML + 并排文本 | 让 agent 改 XML，图上实时看到结果；PR 里 diff 可读 |
| 架构图里放截图，PR 还要能审 | 图片相对引用（第 2 节） | 截图先放进工作区 → 从资源管理器拖入 → XML 里是 `image=./images/xxx.png`，diff 无 base64 |
| 批量生成文档图片 | 导出 API | 构建脚本调 `hediet.vscode-drawio.export` 生成 SVG/PNG |
| 团队统一图形规范 | `styles` / `customLibraries` / `customFonts` | 写进工作区 `.vscode/settings.json` |
| 远程面试白板 | Live Share + 自由画笔 + LaTeX | 共享会话后在图里直接书写 |
| Mermaid 草稿转精修图 | `Convert Mermaid to Draw.io` | Mermaid 块 CodeLens 一键转换，再手工调布局 |

---

## 15. 示例文件导览

仓库 `examples/` 目录可以直接打开体验：

| 目录 | 内容 |
|---|---|
| `examples/formats/` | `Example.dio.svg`、`Example.drawio.png`、`test.dio.png`：三种「图片即图」格式及 Markdown 嵌入效果 |
| `examples/use-cases/` | `class-diagrams.dio`、`cloud-architecture.drawio`、`packages.dio`、`screenshots.dio`、`wireframes.dio`：UML 类图、云架构、包图、截图注释、线框原型 |
| `examples/linking/` | `main.dio` + `demo-src/`：`#Foo` 符号跳转、相对路径链接 `../../formats/README.md` 的具体行列、链接 `../../data/dummy.pdf` 任意文件、`Baz.BazBar` 层级符号、C++ 与泛型函数示例 |
| `examples/inline-editor/` | `README.md`（测试用例集：CodeLens、内联编辑器、锁定、Mermaid/PlantUML 转换）、`showcase.md`（完整展示与语法参考）、`sample.md`、`performance.md`（100 个图块压测）、链接图片素材 |
| `examples/openmd.drawio` | 单节点 `link="./markdown-editor.md"`，演示图内链接打开 Markdown |
| `examples/markdown-editor.md` | 用 `Reopen Editor With... > Markdown Editor` 打开的 ```` ```drawio ```` 实时编辑器示例 |
| `examples/data/`、`examples/temp/` | 链接目标与大文件性能/自定义图库测试素材 |

`docs/` 下的正文文档：`code-link.md`（Code Link 详解）、`plugins.md`（插件加载与信任机制）；其余为该扩展 README 的演示动图与主题截图。

---

## 16. 限制与注意事项

- VS Code `>= 1.70.0`；部分功能（WYSIWYG Markdown 编辑器里的图块）**仅 VS Code Insiders** 提供，稳定版会退化为纯文本或普通预览渲染。
- `Markdown with Diagrams`、`Draw.io Inline Editor`、`Edit Diagram As Text` 属于实验性功能。
- **受限模式**会禁止工作区设置修改 `config`、`customLibraries`、`plugins`、`offline`、`online-url`；动态 Markdown provider 也只在受信工作区运行。
- 第 4 节的图内相对链接**仅支持离线模式与相对路径**；在线模式下相对链接会被解析到远程域名，保持原有外链行为。
- 第 2 节的图片相对引用**仅支持离线模式 + `.drawio` / `.dio` 主编辑器 + 相对地址**；`.drawio.svg` / `.drawio.png` 内嵌的图数据、内联编辑器与在线模式仍保留 base64；拖入的图片必须位于工作区内。粘贴、系统拖入、`Insert > Image` → `Open` 产生的 base64 不会被自动外置，图片需先放进工作区再拖入。
- 通过 `workbench.editorAssociations` 关联 `.svg` 后，仍只能编辑 Draw.io 生成的 SVG。
- Code Link 依赖语言的工作区符号搜索能力，且在 GitHub 网页上不生效；跳转前需先打开过目标项目的任一文件。
- Draw.io 插件不会加载进内联 Markdown 编辑器；主题/字体等 baked-in 设置需要重开编辑器才生效。
- Live Share 基于文本同步，并发修改可能冲突。
- `.drawio.png` 画质不如 `.drawio.svg`；需要可读 diff 时优先纯 `.drawio`。

---

## 17. 本地开发、调试与打包

在本仓库里改代码或验证功能：

```bat
git submodule update --init --recursive
corepack enable && corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn dev
```

- `yarn dev` = `webpack --mode development --watch`，把源码编译到 `dist/`，**不会退出**。注意 webview 里的 `webview-content.html` 是**打进扩展主 bundle** 的（不是单独构建的 `dist/custom-drawio-plugins/index.js`），改拖放/图片相关逻辑后要确认 `dist/extension/index.js` 已重新生成。
- 按 `F5` 选择 `Extension (dev)` 启动 Extension Development Host（以 `examples/` 为工作区），即可测试；改代码后需在调试宿主窗口执行 `Developer: Reload Window` 并重新打开图文件。
- 生成可安装包：`yarn build`（生产构建 + 自定义插件 + vsce 打包），产物 `dist/extension.vsix`；`yarn package-extension-stable` 可重打稳定通道包。
- 安装：`code --install-extension dist\extension.vsix --force`，然后重载窗口。

---

## 18. 本仓库相对上游的定制差异

| 功能 | 上游 1.19.0 | 本仓库 |
|---|---|---|
| 节点 Edit Link 填 `./main.md` | 被 Draw.io 绝对化成 webview CDN URL，调用 `openExternal` 跳系统浏览器 | 还原相对路径（相对图文件目录），在 VS Code 内打开；内部 URL 绝不外抛，webview 点击被守卫拦截 |
| 打开链接的编辑器组 | 无此逻辑 / 跳转外部 | 右侧组 → 左侧组 → 右侧新建；已打开则激活；`preview: false`，`Alt+Left` 可返回 |
| 相对链接的目标 | 无 | 工作区内校验、不存在只提示、快速连点去重、非文本回退 `vscode.open` |
| Code Link 的 `revealSelection` | 固定 `ViewColumn.One` + `preserveFocus: true`，同组预览标签替换，`Alt+Left` 回不到图 | 复用与上一条相同的 `openLinkedFile`，相邻组打开、激活已有视图、固定标签、保留导航历史；跳转后 `revealRange` 高亮 1 秒 |
| 适用编辑器 | 主编辑器 / 内联编辑器 / 代码块各有独立实现 | 4 个自定义编辑器 + Insiders 代码块图块统一接入同一套解析与打开逻辑 |
| 插入 / 拖入图片 | 编码成 `data:image/png,<base64>` 写进 `image=`，diff 里几万行乱码 | 磁盘只存相对地址，图片文件由用户自己管理、扩展只读不写；拦截 VS Code 资源管理器拖放、解析相对地址填框、按内容哈希双向映射、导出/转换保持一致 |

相关源码：`src/utils/openDiagramLink.ts`（解析与打开）、`src/utils/linkGuard.ts`（webview 点击守卫）、`src/DrawioClient/DrawioClientFactory.ts`、`src/inline-editor/`、`src/codeblock-editor/`、`src/features/CodeLinkFeature.ts`。

图片相对引用相关源码：`src/utils/linkedImages.ts`（XML 双向转换与内容哈希）、`src/utils/vscodeLinkedImageHost.ts`（只读本地图片、工作区边界校验）、`src/DrawioClient/webview-content.html`（拖放拦截、`Insert > Image` 相对地址解析、拖拽高亮重置）、`src/DrawioEditorProviderText.ts`（保存/加载时接入转换）、`src/DrawioEditorService.ts`（导出与转换路径）、`src/DrawioClient/CustomizedDrawioClient.ts`（webview ↔ 宿主消息通道）。
