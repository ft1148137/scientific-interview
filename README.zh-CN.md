# Scientific Interview

[English](README.md) | 简体中文

用 AI 搜岗、整理简历和复盘面试，把有来源的岗位信息、投递进度与个人资料持续保存在本地 HTML 工作台。

这是一个开源 **Skill + 本地工具**，通过你自己的 AI 宿主完成对话与分析，脚本负责校验和保存。当前版本 **v0.8.0**，适合源码安装试用。真实网站支持腾讯、美团、高德、字节跳动、京东、滴滴、小红书、快手，以及 Moka 上的 Kimi、智谱、阶跃星辰，浏览器接入使用 **Codex 的 Chrome 插件**，登录和验证码由人完成。

![合成数据的统计工作台](docs/assets/compact-charts.jpg)

*截图使用合成统计数据；首次运行演示只有少量岗位，用于体验流程。*

## 能做什么

- **增量搜岗**：保存搜索条件，对比新增岗位、JD 修改和有证据的停招；保留来源、快照与最后核验时间。
- **简历创建与修改**：导入已有简历，或通过经历访谈创建；每轮提问不超过三项，确认事实后保存版本，导出 Word、PDF、Markdown。
- **面经复盘**：向 AI 复述面试，记录问答、强项、不足与依据；已核对复盘可供简历修改和岗位评分参考。
- **岗位筛选与跟踪**：未投递岗位可标记“投递候选”或“不感兴趣”；默认“未决定”仅用于筛选。已投递岗位按最新申请状态跟踪。
- **量化求职过程**：投递总览、申请状态环状图、投递与反馈折线图、公司分布、方向与行业分布；连续 30 天无实质变化自动标记不活跃。
- **插槽扩展**：企业网站与浏览器分别实现协议、能力声明和门禁，可独立添加。

语义分析发生在宿主对话中，HTML 是本地档案界面。项目不要求额外配置模型 API Key；模型使用仍依赖你的宿主账户。当前没有内置定时搜岗服务，申请提交需要用户授权并核验结果。

README 提供中英文版本；工作台和大部分详细流程文档目前使用中文。

## 安装与体验

### 1. 获取完整源码

从 [GitHub 仓库](https://github.com/ft1148137/scientific-interview) 选择 **Code → Download ZIP** 并解压，或运行：

```bash
git clone https://github.com/ft1148137/scientific-interview.git
cd scientific-interview
```

在项目目录打开终端，确认能看到 `pyproject.toml`、`skills/` 和 `job_workbench/`。

需要 **Python 3.10+**。真实搜岗还需要可访问 Chrome 插件的 Codex 环境；单独体验演示、导入手工 JD 和查看工作台不需要浏览器插件。Node.js 18+ 仅用于插槽示例和开发测试。

本项目目前按完整源码安装使用；不要只复制 `SKILL.md`，也不要将同名 PyPI 包当作本项目的安装来源。下列命令已在 macOS 的独立环境验证；Windows 尚未做完整验证。

### 2. 创建环境并安装

macOS / Linux，在项目根目录运行：

```bash
python3 -m venv data/dev/venv
. data/dev/venv/bin/activate
python -m pip install -e ".[resume]"
python -m job_workbench doctor
```

Windows PowerShell 对应的环境步骤：

```powershell
py -3 -m venv data/dev/venv
.\data\dev\venv\Scripts\Activate.ps1
python -m pip install -e ".[resume]"
python -m job_workbench doctor
```

`[resume]` 安装 Word/PDF 所需依赖；只体验核心和 HTML 可改为 `python -m pip install -e .`。核心使用 Python 标准库。`doctor` 检查源码资源、依赖与插槽声明，并显示当前和建议 Python 路径；通过不代表 Chrome 已连接。

### 3. 启用 Skill

```bash
python scripts/install_skill.py
```

安装器先检查完整源码资源，再在 Codex 的 skills 目录创建 `scientific-interview` 符号链接，指向当前源码。默认目标为 `~/.codex/skills/`；设置了 `CODEX_HOME` 时使用其 `skills/` 子目录。已有文件或其他链接不会被覆盖。

可随时只读检查安装状态：

```bash
python scripts/install_skill.py --check
```

项目移动后，先在新位置重建虚拟环境并安装依赖，再运行 `python scripts/install_skill.py --repair` 修复旧符号链接。修复不会覆盖普通文件或目录，失败时保留原链接。完整步骤见 [迁移指南](docs/migration.md)。

重新打开 Codex 对话，调用 **`$scientific-interview`**。保留源码目录与虚拟环境，并让 Codex 使用上一步创建的 Python 环境。若宿主找不到依赖，可以明确告诉它：“使用本项目 `data/dev/venv` 中的 Python。”

不安装链接也能使用：在 Codex 中打开本项目，要求“读取并使用 `skills/scientific-interview/SKILL.md`”。Windows 不允许创建符号链接时也可采用此方式。普通终端命令不会替代 Chrome 插件，连接方法见 [浏览器采集说明](skills/scientific-interview/references/browser.md)。

### 4. 打开合成演示

```bash
python -m job_workbench --data data/demo demo
python -m job_workbench --data data/demo serve --port 8877
```

打开 [本地演示工作台](http://127.0.0.1:8877/index.html)。终端保持运行，`Ctrl+C` 停止服务。演示包括两轮扫描、JD 变化、候选、申请记录、简历和面经复盘，人物与经历均为合成数据。重复执行会保留已整理的演示资料。

也可以直接打开 `data/demo/report/index.html` 查看静态快照；标签保存、复盘实时同步需要通过 `serve` 访问。

## 开始自己的求职档案

先停止演示服务，再建立独立的私人档案：

```bash
python -m job_workbench init
python -m job_workbench render
python -m job_workbench serve --port 8877
```

默认使用 `data/main/`，不会复用演示资料。在 Codex 中可以这样说：

> 使用 $scientific-interview，档案用 data/main。帮我搜索腾讯招聘中的 AI 应用开发岗位，需要登录时让我接手。

> 修改我提供的简历，目标是数据分析。先核对事实，再用问题引导我补充已有经历，不要编造成果。

> 我刚完成一次面试，下面是我的复述。帮我整理问答、强项和不足，核对后保存到面经复盘，之后修改简历和评分时参考。

> 再运行上次的搜索，告诉我新增岗位、JD 变化和待核验项，并更新工作台。

个人经历和常见回答作为基础资料保留；“待补经历”计划板块已移除。面经复盘的原始复述与分析分开保存，未核对内容不会被当成已确认事实。详见 [复盘流程](skills/scientific-interview/references/debrief.md) 和 [简历流程](skills/scientific-interview/references/resume.md)。

## 数据、隐私与分享

**所有业务数据和运行产物都保存在本项目 `data/` 下，整个目录被 Git 忽略。**

| 位置 | 用途 |
|---|---|
| `data/main/` | 默认私人档案：岗位、面经、经历、简历、原件副本、备份和导出 |
| `data/main/report/index.html` | 完整私人工作台 |
| `data/demo/` | 合成演示档案 |
| `data/dev/`、`data/tmp/` | 本地环境、开发与测试产物 |
| `examples/`、`docs/assets/` | 随源码公开的合成样例与配图 |

用 `--data data/其他目录` 或 `SCIENTIFIC_INTERVIEW_DATA` 切换档案。数据与输出的相对路径以项目根目录为基准，写入 `data/` 外会被拒绝；外部简历可只读导入。移动项目时保留整个 `data/`，重建虚拟环境并修复 Skill 链接，详见 [迁移指南](docs/migration.md)。

本地存储不等于离线 AI：交给宿主分析的内容受该宿主的数据处理规则约束。本地档案没有额外加密，完整 HTML、`resume.json` 和 `changes.md` 可能包含私人信息。

只分享岗位清单时运行：

```bash
python -m job_workbench render --share
```

仅检查并分享生成的 `data/main/share/index.html`。分享副本排除个人资料、面经、匹配评语、决定、简历、申请与历史；岗位正文和来源链接仍需自行确认适合公开。

## 常用入口

```bash
python -m job_workbench --help
python -m job_workbench status
python -m job_workbench interview first --target 'AI 应用工程师'
python -m job_workbench render
```

将原始 JD 文本放入 `data/main/inbox/jd.txt` 后，可手工入档：

```bash
python -m job_workbench add-jd data/main/inbox/jd.txt --title '工程师' --company '目标企业' --url 'https://example.com/jobs/1' --complete
```

`--complete` 只在 JD 原文完整时使用，它不证明岗位仍在招聘。简历导入、版本续改与导出的具体命令见 [简历说明](skills/scientific-interview/references/resume.md)，统计口径见 [统计说明](docs/statistics.md)。安装后也可使用 `scientific-interview` 命令；内部模块 `job_workbench`、旧命令及 `JOB_WORKBENCH_*` 环境变量保留兼容，新变量优先。

## 已接入的网站

| 网站 | Slot ID | 当前入口 |
|---|---|---|
| 腾讯 | `tencent` | 原有招聘站点 |
| 美团 | `meituan` | 职位列表，可能包含社招和实习 |
| 高德 | `amap` | 社会招聘 |
| 字节跳动 | `bytedance` | 社会招聘 |
| 京东 | `jd` | 社会招聘，列表内展开详情 |
| 滴滴 | `didi` | 社会招聘 |
| 小红书 | `xiaohongshu` | 社会招聘 |
| 快手 | `kuaishou` | 国内社会招聘 |
| Kimi（月之暗面） | `moka-kimi` | Moka 社招租户 |
| 智谱 | `moka-zhipu` | Moka 社招租户 |
| 阶跃星辰 | `moka-step` | Moka 社招租户 |

例如对 AI 说：“使用Scientific Interview，在美团、字节和 Kimi 搜索我的目标岗位，先读取一批 JD 并保存到当前档案。”新增插槽支持关键词搜索；城市、方向等条件在采集后核对，单独的校招入口尚未接入。Moka 共用解析器，但每家企业需要独立声明租户路径，不会自动遍历整个平台。

百度招聘页在 2026-10-22 的两次接入尝试中均变为空白，尚未完成接入；汽车、制造等非互联网企业暂缓。京东多个岗位共用列表 URL，通过岗位 ID 区分；打开来源链接后需按标题定位。真实验证采用小批次抽样，不代表已经扫描全部岗位。见 [支持与验证记录](docs/site-support.md)。

## 常见问题

| 情况 | 处理 |
|---|---|
| 提示缺少依赖 / 找不到模块 | 激活本项目虚拟环境，重新执行安装命令和 `doctor`；AI 也需使用同一个 Python |
| Skill 没出现 | 重新打开 Codex 对话，或直接要求读取项目内的 `SKILL.md` |
| 安装器提示目标存在 | 普通文件或目录不会覆盖；确认旧符号链接应改用当前项目后执行 `--repair` |
| Chrome 无法连接 / 遇到登录 | 按采集说明连接插件或由人登录；保存断点后继续，不会自动换爬虫 |
| 端口被占用 | 改为 `serve --port 8878`，同时更换访问地址的端口 |
| 标签不能保存 | 使用 `serve` 提供的页面；直接双击 HTML 是只读快照 |
| 扫描版 PDF 无法读取文字 | 当前不提供 OCR；提供可提取文字的 PDF、Word 或直接复述经历 |
| 修改代码后更新 | 保留 `data/`，更新源码后重新执行 editable 安装及 `doctor`；不要把新仓库覆盖到私人数据上 |

## 扩展与开发

```text
skills/scientific-interview/   Skill 与按需加载的流程说明
contracts/                    protocol、数据格式与门禁
slots/sites/                  企业插槽、Moka 租户与共享解析器
slots/browsers/               codex-chrome
job_workbench/                校验、版本库、简历与本地服务
templates/                    HTML 工作台
examples/                     可公开的合成样例
tests/                        Python 行为测试与 JS 契约测试
data/                         本地数据及产物，禁止提交
```

新增网站实现 SiteSlot，新增浏览器实现 BrowserPort；注册清单并通过能力、域名和页面门禁。项目职责见 [架构说明](docs/architecture.md)，接入方法见 [协议](contracts/protocol.md) 与 [贡献指南](docs/contributing.md)。无浏览器依赖的接入示例：`node examples/slot-extension.mjs`。

安装完整依赖后运行：

```bash
python -m unittest discover -s tests -v
node --test tests/*.test.mjs
python scripts/check_project.py
python scripts/package_source.py
```

最后一条命令须在本项目 Git 仓库中运行（ZIP 下载者可先 `git init`），检查发布候选文件中的常见路径与密钥残留，并将源码包和校验清单写入 `data/releases/`。它排除私人数据与开发环境，仍需人工审阅新增样例和截图；不能替代隐私审查。不要直接压缩整个本地工作目录作为发布包。

当前已完成的检查见 [开源检查记录](docs/release-readiness.md)。网站入口、搜索范围与实测边界见 [网站支持列表](docs/site-support.md)。当前仅使用 Codex Chrome；其他网站、Windows、复杂多页简历和三位全新用户试用尚未完成完整验收。

源码采用 [MIT](LICENSE)；随附 Noto Sans SC 字体采用 [SIL OFL](assets/fonts/OFL.txt)，来源见 [字体说明](assets/fonts/README.md)。第三方网站内容、品牌和运行环境不随本项目源码获得授权。
