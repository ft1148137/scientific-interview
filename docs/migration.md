# 升级与迁移

升级前停止对应本地服务和写入任务，保留完整 `data/`。数据目录移动与核对步骤以 [存储约定](../skills/scientific-interview/references/storage.md) 为准，不合并覆盖已有档案。

## 更新源码

在原目录更新源码后，按 README 使用同一个虚拟环境重新执行 editable 安装和 `doctor`。若缺少模板、字体、示例或 Skill 文件，应恢复完整源码，不手工跳过检查。源码结构整理不改变数据 schema，也不自动重写已有私人档案。

## 移动项目目录

1. 停止该项目的服务和写入任务，整体保留源码与 `data/`，核对移动前后文件。
2. Python 虚拟环境不保证可以跨路径搬移。在新位置重新创建 `data/dev/venv` 并安装依赖；若原环境仍在此处，先将其移到 `data/dev/` 内另一个未占用位置保留。
3. 在新项目根目录运行 `python scripts/install_skill.py --check`。检查会说明链接是否指向当前源码。
4. 目标是旧链接时，运行 `python scripts/install_skill.py --repair` 切换到新源码；原目标是普通文件或目录时拒绝覆盖，先核对其归属或直接使用项目内 Skill。
5. 用新环境运行 `doctor`，核对 `status` 中的数据目录与记录数量，再启动服务。

链接修复不会移动私人档案，也不会自动替宿主选择 Python。

## 旧版兼容

- 项目名称为Scientific Interview，Skill 标识为 `scientific-interview`。Python 模块 `job_workbench` 和旧命令 `job-workbench` 保留兼容。
- `SCIENTIFIC_INTERVIEW_DATA` / `SCIENTIFIC_INTERVIEW_ROOT` 优先于对应 `JOB_WORKBENCH_*` 变量；档案写入仍限制在当前项目 `data/` 下。
- schema v1 档案继续支持。旧档案缺少复盘或分类字段时，不补造记录，不重写历史；新增信息时再保存。
- 旧 `interviews` 是简历访谈会话，不作为真实面试记录；`experiences` / `answers` 继续保留。实际面试复述存入 `debriefs`，确认后才能作为已核对材料使用。
- 已移除待补经历的页面和写入入口。旧 `plans` 数据原样保留，但不进入 HTML、分享副本、简历或访谈上下文。
- 续改简历的 `--parent` 沿用父稿内容与引用；只有明确重新选材时使用 `--rebuild`。导入原件使用 `--source-import`。旧导出文件不自动更新，需选定版本重新导出并核对排版。
- 旧候选/排除记录保留。已确认申请的岗位隐藏投递前标签，过往选择仍在历史中。
- v0.8.0 的扫描批次新增 seen_ids，断点新增 completed_ids，协议版本仍为 1；旧 completed_urls 继续兼容。共享 URL 的岗位使用来源 + ID 区分，旧 URL 记录不能证明整页岗位均已核验。断点的来源、插槽版本与查询必须一致，具体规则见 [插槽协议](../contracts/protocol.md)。
