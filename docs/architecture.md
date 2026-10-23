# 项目结构与维护边界

Scientific Interview由对话 Skill、本地 Python 工具、网站/浏览器插槽和 HTML 工作台组成。当前交付方式是完整源码安装，所有业务数据与运行产物保存在项目的 `data/` 内。

## 各部分负责什么

| 位置 | 职责 |
|---|---|
| `skills/scientific-interview/` | AI 的操作流程、访谈方法、事实确认与人工交接 |
| `job_workbench/` | 数据校验、业务规则、版本保存、简历导出与本地服务 |
| `slots/sites/` | 企业插槽与 Moka 独立租户；shared/ 复用 DOM 采集和平台解析，不依赖宿主 |
| `slots/browsers/` | 按宿主能力访问浏览器，保持与网站无关 |
| `contracts/` | 插槽协议、门禁和扫描数据格式 |
| `templates/` | 工作台界面、统计计算和图表展示 |
| `examples/` | 随源码提供的合成资料，供演示和测试使用 |
| `assets/` | 简历字体及其许可 |
| `scripts/` | 安装、检查和源码打包工具 |
| `tests/` | 业务保护、插槽契约、界面统计及安装发布边界测试 |
| `data/` | 私人档案、环境、临时文件和生成物，Git 忽略 |

## 执行关系

1. 宿主读取 Skill，按需加载采集、简历或复盘流程。
2. 搜岗通过 BrowserPort 和 SiteSlot 采集，runner 执行门禁，形成标准扫描结果。
3. AI 整理资料与分析结论，通过 CLI 提交；核心模块校验后由 Store 统一保存并备份。
4. render 读取档案生成 HTML；本地 server 提供浏览、标签保存与复盘同步。

网站和浏览器不直接修改档案。AI 不绕过校验手写主数据。公开分享使用独立字段白名单；私人档案与分享副本分别生成。

## Python 模块边界

- `cli.py`：参数解析与命令调度。`demo.py`：通过正常业务入口构造合成演示。
- `jobs.py`：岗位、变化、决定、评分和申请；`library.py`：个人资料、经历、回答和简历访谈；`debriefs.py`：面经验证及引用。
- `resumes.py`：原件导入、草稿、版本和导出；`render.py` / `server.py`：页面生成和本地服务。
- `store.py`：数据目录边界、锁、原子写入和版本备份。
- `contracts.py` / `registry.py`：数据校验、能力协商和插槽加载。
- `resources.py`：项目根目录、模板、字体、示例、行业说明及 Skill 路径的统一来源。

运行模块从 `resources.py` 获取资源路径，不各自推算源码位置。独立脚本只在引导 Python 导入时定位源码；资源随完整项目保留。CLI 与安装器会检查必要资源是否缺失。

源码资源位置与私人档案位置用途不同，但当前都以同一个项目根目录为基准。以后如支持独立 wheel 安装，需要同时设计资源打包与工作区选择；不能只移动 Python 文件或放开数据写入边界。

## 规则只在一个地方维护

| 内容 | 权威说明 |
|---|---|
| 安装与上手 | [English](../README.md) / [简体中文](../README.zh-CN.md) |
| AI 操作流程 | [Skill](../skills/scientific-interview/SKILL.md) 及其 references |
| 数据保存与迁移边界 | [存储约定](../skills/scientific-interview/references/storage.md) |
| 插槽接口与门禁 | [protocol](../contracts/protocol.md) |
| 统计含义 | [统计口径](statistics.md) |
| 网站入口与实测范围 | [网站支持列表](site-support.md) |
| 当前验证结果与限制 | [发布检查](release-readiness.md) |
| 版本变化 | [CHANGELOG](../CHANGELOG.md) |

其他文档链接到对应说明，不重复维护一份规则。与当前版本不符的验收记录、体验报告和配图已移除；旧档案仍需要的兼容说明保留在迁移指南。
