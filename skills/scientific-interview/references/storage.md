# 数据目录约定

所有求职业务数据和运行产物统一写入 `<项目根目录>/data/`，该目录整体被 Git 忽略。不要把真实资料写入源码、examples、docs 或 Skill 目录。源码内的 examples 和文档配图仅保留可公开的合成样例。

默认档案为 `data/main/`。需要隔离演示、用户或验证时使用其他 data 子目录，例如 `data/demo/`。`--data` 和 `SCIENTIFIC_INTERVIEW_DATA` 只能指向项目 data 内部；两者都未提供时使用默认目录。相对数据目录与 `--out` 路径以项目根目录为基准，不随宿主当前工作目录变化；Skill 操作时优先使用完整绝对路径。

```text
data/
  main/
    state.json        岗位、经历、回答、复盘、简历版本及申请记录
    inbox/            抓取 JSON、粘贴 JD、用户资料的工作副本
    drafts/           AI 整理的资料、评分和简历草稿
    originals/        导入原件的保留副本（程序生成）
    backups/          历史备份（程序生成）
    exports/          简历及版本说明（程序生成）
    report/           私人 HTML 工作台（程序生成）
    share/            独立岗位分享副本（程序生成）
  demo/               合成演示档案
  tmp/                测试临时目录，测试结束清理
  dev/                开发日志、截图、验证资料和旧本地工作目录
  releases/           干净源码 ZIP 与 SHA-256 清单（打包工具生成）
```

输入资料可从用户指定的外部路径只读导入，保留的原件与后续输出必须进入 data。`resume-draft --out`、`resume-export --out`、`render --out` 同样受路径检查；不要用软链接把输出绕到 data 外部。JSON 草稿由 AI 直接写文件时也遵守此约定。

`data/` 只作本地存储，不代表已经脱敏；不能强制加入 Git 或整目录分享。需要分享岗位时生成独立 share/index.html 并检查正文。浏览器凭据仍由浏览器管理，不导出到文件。安装 Skill 到宿主的链接不是业务数据，仍使用安装器。

## 旧目录迁移

发现历史档案在 `.local/`、`~/.job-workbench` 或其他旧位置时，不要在默认目录另建空档案并假装沿用了历史。确认本轮使用的旧档案后，停止对应写入和服务，将整个档案目录迁入 data 下尚不存在的目标，保留 state.json、backups、originals、exports 等所有文件，核对文件数量及主数据哈希后再启动服务。不能合并覆盖已有目标，不改写旧状态内容。更新命令、环境变量和页面路径；外部位置未被用户指定时不擅自扫描或搬动。
