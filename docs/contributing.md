# 贡献指南

先用合成样例复现，再改具体插槽或核心模块。提交内容不得包含真实简历、联系方式、Cookie、浏览器配置或个人投递档案。

## 添加企业网站

1. 在 `slots/sites/<id>/` 放 `manifest.json` 与 `adapter.mjs`。声明精确域名、协议版本、必要浏览器能力和支持的搜索字段。
2. 导出 manifest 和 createSiteSlot(port)，实现 probe、discover、readJob。网站只使用 BrowserPort，禁止直接依赖 cua、CDP、网络请求或本机路径。
3. 在 `slots/registry.json` 注册。不提供链接的列表先核对可见标题/地点再点击；不能从隐藏应用状态猜岗位 ID。
4. 添加脱敏/合成样例，覆盖列表、详情、分页重复、缺 JD、布局变化、登录中断、明确停招和访问失败。
5. 跑全部验证；再在 Chrome 插件中做只读实测，记录网址、日期、覆盖范围和失败场景。托管 ATS 需要单独适配和声明，不能自动放开所有子域名。

Moka 的共用解析器位于 `slots/sites/shared/moka.mjs`，通用列表/详情流程在 `shared/dom-site.mjs`。新租户仍需独立的 manifest 和薄 adapter，声明 company、domains、entry_url、path_prefix，再注册并做真实验证。不能只改企业名字就把任意 Moka 模板标为支持；标题、正文、分页和租户路径都要核对。独立企业网站可复用 DOM 流程或自行实现 SiteSlot，不需要改 BrowserPort 或核心。

新增网站的能力与验收统一记入 [网站支持列表](site-support.md)，未实测的入口保持待支持。

对于列表内展开详情的站点，参考 `slots/sites/jd/adapter.mjs`：从可见控件取得稳定 ID，点击实际展开控件后才读取正文，不读取隐藏详情代替操作。共用 URL 的网站声明 shared_detail_url，并验证多岗位去重、断点续扫与核心 seen_ids 的范围；保留真实列表 URL，不合成不存在的岗位链接。

## 添加浏览器

在 `slots/browsers/<id>/` 实现相同 BrowserPort。声明实际支持的能力；浏览器只做页面访问，不加入网站特例或评分。遵守宿主的权限、人工登录和交接机制。插件断连不能悄悄切到另一个访问方式。

先运行不依赖任何宿主的最小示例：

```bash
mkdir -p data/dev
node examples/slot-extension.mjs > data/dev/fixture-scan.json
python -m job_workbench --data data/dev/fixture-demo init
python -m job_workbench --data data/dev/fixture-demo ingest data/dev/fixture-scan.json
```

运行产物保存在 Git 忽略的 `data/` 内。此示例用一个仅支持 navigate/observe 的合成 BrowserPort 驱动已有 demo-company SiteSlot，验证网站和 runner 无需改动；它不连接浏览器、不访问网络。源码展示 connect/navigate/observe/handoff/release 与协议返回的最小实现。fixture 是专用合成来源，不能用于真实网站。

接入真实新端口时，将示例的固定观察替换为宿主提供的可见页面读取，创建自己的 `manifest.json` 与同字段 JS manifest，使用自己的 ID、实际 capabilities 和可选 `connection_hint`，在 registry 注册。连接后把 port 传给网站工厂及 `runScan(port, site, query)`；不要在核心里添加宿主特例。`doctor` 分别显示每个浏览器的连接提示，能力通过不代表真实连接通过。

跨语言门禁回归测试会比较 Python 与 JS 的完整响应。添加能力或错误字段时同步更新两端和 `contracts/protocol.md`。

模块职责和说明的权威位置见 [架构说明](architecture.md)。修改资源目录时统一更新 `job_workbench/resources.py`，不要在业务模块中再次推算项目路径。新增或删除文档时运行项目检查，确保内部链接有效。

## 修改核心

涉及导入、去重、版本、断点、证据或页面转义时必须增加对应行为测试。数据格式破坏性变化需明确迁移方案和 schema_version；协议破坏性变化需提升 protocol_version。恢复旧版也应追加记录，不能丢掉后来投递。

## 提交前

运行 README 中的测试、项目检查与源码打包命令，人工检查 HTML 窄屏和键盘操作。简历模板变化需导出 Word/PDF 检查全部页面。PR 说明问题、行为变化与验证范围；真实网站未验证的部分如实标明。不要在 issue 中上传私人数据，最小匿名样例即可。

业务档案、抓取 JSON、草稿、测试临时文件及开发日志统一放入 data/；不能强制提交。默认 data/main，测试使用 data/tmp，开发资料使用 data/dev。源码中的 examples 和文档配图仅使用合成、可公开内容。变更功能时同步 README、SKILL.md、参考流程及版本号；check_project 会检查版本一致性与 data 忽略规则。
