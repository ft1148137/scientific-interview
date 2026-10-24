# Tabbit 浏览器插槽

浏览器 ID 为 `tabbit`，使用安装版 Tabbit 的官方 `tabbit-cli nodejs` 任务。网站适配器、扫描 runner 和 Python 入档协议与 Chrome 共用，不启动独立 Playwright 浏览器，不访问招聘接口。测试范围见 [网站支持列表](../../../docs/site-support.md)。

## 安装与连接

1. 从 [Tabbit 官网](https://www.tabbit.com/) 安装浏览器，完成首次引导。导入其他浏览器资料不是必需步骤；是否导入由用户选择。
2. 阅读安装版本附带的 `tabbit/SKILL.md`，遵循官方 [CLI 安装检查](https://www.tabbit.com/blog/2026-09-18-tabbit-cli-quick-start)。Skill 通常注册在 `~/.agents/skills/tabbit/`；缺失时按官方恢复说明处理，不自行读内部 endpoint、启动 Runtime Service 或调用版本目录里的 CLI。macOS 1.16.27 的源 Skill 随应用的 `TabbitDance/skills/tabbit` 安装；可以只读核对说明，执行仍须使用稳定启动器。
3. macOS 使用 `"$HOME/.local/bin/tabbit-cli"`；Windows 使用 `%LOCALAPPDATA%\Tabbit\LocalAgent\bin\tabbit-cli.exe`。本项目仅实测 macOS，Windows 接入流程尚待验证。
4. `create --task "Scientific Interview"` 获取任务；后续保持同一任务名称及浏览器实例，不抢占其他任务标签。默认用任务新建页，只有用户要求时才获取已有标签。

## 在官方 nodejs 任务中运行

下面是传给 `tabbit-cli nodejs --task "Scientific Interview" --request-id <本次唯一ID>` 的 JavaScript 程序体。将项目绝对路径替换为当前实际位置；不要直接在普通 Node 进程运行，它依赖 Tabbit 注入的页面对象。读取当前安装版本的官方 Skill，确认 API 相符后执行。

```js
const {pathToFileURL} = await import('node:url');
const root = pathToFileURL('<项目绝对路径>/').href;
const browserModule = await import(root + 'slots/browsers/tabbit/adapter.mjs');
const siteModule = await import(root + 'slots/sites/tencent/adapter.mjs');
const {runScan} = await import(root + 'slots/runner.mjs');
const port = browserModule.createBrowserPort(
  {getPage: () => page, context, tabbit, usePage, reportIssue},
  siteModule.manifest.domains
);
const connection = await port.connect();
if (connection.gate !== 'PASS') return connection;
const site = siteModule.createSiteSlot(port);
// 按用户搜索条件填写，只传 manifest.search_fields 声明支持的字段。
const query = {keyword: 'Agent'};
globalThis.scientificInterview = {port, site, query, runScan};
const batch = await runScan(port, site, query, {maxJobs: 1, maxPages: 1});
scientificInterview.lastBatch = batch;
const fs = await import('node:fs/promises');
await fs.mkdir(new URL('data/dev/tabbit/', root), {recursive: true});
await fs.writeFile(new URL('data/dev/tabbit/scan-first.json', root), JSON.stringify(batch, null, 2));
return {gate: batch.gate, code: batch.code, records: batch.records?.length,
  coverage: batch.coverage, checkpoint: !!batch.checkpoint};
```

实际批次使用不同文件名，先保存再入档；示例关键词不是用户偏好。Tabbit 支持导入本地 ES 模块，无需生成或分发第三方浏览器代码包。

## 结果、续扫与人工交接

- CLI 成功结果位于 `result.value`；若 `queued/running`，用同一 request ID 查询 receipt，不能重新提交动作。若结果为 resource，按官方 Skill 分页读取完整资源，不能把截断输出当完整批次。失败或中断时先观察页面再决定恢复。
- 每个新程序使用新 request ID；保持任务名不变。使用 `scientificInterview` 的同一 port/site/query，传入 `lastBatch.checkpoint` 续扫并保存新批次。遵守 runner 的等待截止时间和两次重试上限；不要清掉断点绕过失败。
- 核对是完整 ScanBatch 后才通过 `python -m job_workbench --data <data内档案> ingest <data内批次文件>` 入档，再 `render`。工程实测用 `data/dev/` 隔离档案，不导入用户主档案。
- `WAIT_USER / LOGIN_OR_CHALLENGE` 时保留断点。端口 `handoff()` 记录官方认证提示；宿主随后用原任务名执行普通 `finish`，保留登录页并释放所有权，交给用户。用户完成后重新 `create`，从 inventory 获取该保留组，重新建 port 并从磁盘断点恢复。任务结束会清除 globals/receipts，不能依赖内存断点。
- 跳转到未声明的认证域名会返回 `DOMAIN_REJECTED`（例如未登录的京东社招）。说明真实落地页，交由用户登录；不要扩大网站域名或把这种拒绝记作岗位下线。
- `release()` 只清除端口引用。正常结束仍必须调用官方 `finish --task "Scientific Interview"`；普通 finish 保留页面。关闭无用测试页只限任务新建页，不能使用 `--discard` 关闭用户页面。
- `screenshot()` 返回 Tabbit 的图像产物回执；需要归档时将回执指定的本地文件复制进项目 `data/dev/`。浏览器自身配置、登录态及宿主管理的运行文件不搬进仓库。

## 兼容性边界

端口支持域名检查、可见 DOM 观察、搜索填写/Enter、点击、滚动、有界等待、截图与人工交接。操作前核对快照及目标，拒绝申请/提交/密码/文件控件。新标签页可能晚于页面重绘出现，因此使用官方 transition 汇总后再选择目标；未就绪或域名越界保持门禁，不把列表页当作详情。

接入通过不代表全部来源重新验收、登录态自动迁移或永不需要人工操作。具体实测与未测项以支持列表为准。当前京东校招首次搜索仍有结果不更新的限制，RETRY 后按预算处理；不要把能读取详情误报成关键词筛选通过。
