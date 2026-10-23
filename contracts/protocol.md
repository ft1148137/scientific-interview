# 插槽协议 v1

核心、网站和浏览器各自承担一件事。网站依赖 BrowserPort，不导入宿主工具；浏览器只访问页面，不解释岗位。核心校验、版本写入、去重与渲染共用一条入口。

```text
主 Skill → SiteSlot → BrowserPort → codex-chrome → Chrome 插件
             ↓
       标准 ScanBatch → 数据门禁 → 版本库 → HTML
```

## 声明和注册

`slots/registry.json` 列出 manifest.json。字段：id、kind(site/browser)、version、protocol_version(1)、entry。网站还需 domains（精确主机名）、entry_url、requires、search_fields；可选 company 固定企业名，path_prefix 限定共享 ATS 的租户路径（精确路径或其子路径，不接受相似前缀）。声明后由采集和入档两层检查，租户岗位必须提供 external_id，避免 hash 路由去重冲突；shared_detail_url=true 用于列表内展开详情且共用 URL 的来源，此类岗位也必须提供 ID，入档不能按 seen_urls 推断整页岗位均已核验；浏览器需 capabilities。JSON 清单用于 Python 校验，JS 导出的 manifest 用于运行；测试保持两者一致。

注册只加载声明，不执行任意第三方代码。安装新源码需按用户环境的信任规则执行。当前只提供 codex-chrome；fixture 是测试记录来源，不是可用浏览器。

## BrowserPort

connect、navigate、observe、act、wait、release 返回 `{gate, code, message, data?}`。screenshot 成功时直接返回宿主图像，未连接时返回门禁；handoff 仅执行宿主交接，不返回门禁对象。

- `connect(options?)`：建立此端口对应的宿主连接，返回实际连接与能力。Codex Chrome 的实现只选择 Chrome extension，支持 browserId，多实例时不猜测；其他 BrowserPort 按自身宿主提供连接参数。
- `navigate(url, {reload?}?)`：校验声明域名，打开或复用本任务标签页；导航后再次检查 URL。reload=true 时若 URL 未变则重新加载，用于复位 URL 不随页码变化的列表；默认不重载。接入新 BrowserPort 时须支持使用方的分页复位语义。
- `observe({fields?,lists?,controls?})`：只读可见 DOM；返回 url、text、fields、lists、controls、observed_at、snapshot_id。字段配置为 CSS 选择器或 `{selector, attribute}`；属性仅允许 href、title 和以 id 结尾的标识，且只从可见匹配元素读取，不读隐藏 input、不接受脚本字符串或任意状态对象。controls 保留索引、可见性、disabled、tag、type、label 用于下一动作；允许已观测的无文字按钮，或自身/直接父元素有 title 标签的图标（如展开箭头）；标签同样执行提交/申请检查，隐藏、禁用和提交控件不能点击。可见字段优先选择可见的匹配元素；clipped_fields 和列表项 clipped 标记 line-clamp 截断，不能据此宣称 JD 完整。
- `act({kind,selector,index?,text?,value?,key?,snapshot_id})`：只允许对当前观测中的控件点击、填入搜索条件、滚动，以及对 text/search 输入框执行 press/Enter 搜索；拒绝密码/文件字段及提交申请操作。页面变化后旧 snapshot_id 失效。新标签页也校验域名。
- `wait({selector?,previousText?,timeoutMs?,observe?})`：有界等待可见元素后重新观察；previousText 用于等待翻页内容替换。超时后再次观察门禁，登录/验证码与限流优先于一般加载错误。
- `screenshot()`：截取当前视口，返回宿主图像；未连接时返回 WAIT_USER/CONNECT_REQUIRED。
- `handoff()`：按宿主协议保留当前页面供用户登录。
- `release()`：释放任务引用，不关闭用户原标签或清理登录。

能力词汇：navigate、observe、click、fill、wait、scroll、screenshot。网站 requires 必须是浏览器能力子集。实现缺少必要宿主接口时明确拒绝。

## SiteSlot

- `probe(observation)`：页面是否可读，登录/验证/频率限制如何处理。
- `discover(query,cursor)`：返回 `{refs,next_cursor,coverage}`。缺少分页边界证据时必须保持 partial，runner 不会因没有 next_cursor 自动提升为 complete。引用可为稳定详情 URL；不提供 URL 的动态列表可返回列表定位信息，readJob 须先核对标题和地点，避免顺序变化读错岗位。
- `readJob(ref)`：返回标准岗位记录或门禁结果。只有明确的页面停招原文支持 closed；无法访问为未知。

游标只保存稳定 URL、页码或站点分页信息，不保存元素句柄。恢复时重新发现页面；优先按 external_id 去重，无 ID 时按 URL 去重，不靠上次列表位置猜测新列表。

## ScanBatch 与 JobRecord

完整示例见 `examples/scan-first.json`、`scan-second.json`；JSON Schema 见 `scan.schema.json`，实际入档还执行跨字段与证据校验。

批次：protocol_version、id、source、slot_version、browser_id、query、observed_at、gate、coverage、records，以及可选 checkpoint/message、seen_ids/seen_urls。seen_ids 是同一来源已处理岗位的字符串 ID 数组，包含前面批次；seen_urls 作为无 ID 岗位及旧断点的兼容记录，不能代替共享页面来源的岗位 ID。id 同内容幂等，同 ID 不同内容报错。新一轮扫描必须使用新 ID。

门禁诊断可包含 `code`、`next_action`、`retryAfter`（秒）及 `retry_attempts`（0—2）。runner 保留这些字段，核心入档不丢弃。能力协商在 JS 与 Python 都返回 `{gate,code,message,missing,next_action}`，其中 missing 始终为排序、去重的数组，兼容时为空。错误的人类提示和机器字段分开。

岗位：external_id 可空，title、company、url 必需，location 可空，jd 可空，jd_complete 显式声明，status 为 open/closed/unknown，observed_at，evidence。下线还需 closed_reason 为证据文本的原句。JobKey 优先来源+ID，无 ID 使用规范化 URL 哈希。跨源不自动强行合并。

证据：url、observed_at（带时区 ISO 时间）、text、kind(page/closed/application/user_supplied)。合成数据不能伪装官网核验。录入原文不是人工确认简历事实。

核心保存 first_seen、current、snapshots、verification；decision、reviews、selected_resume、applications 分开维护。未知字段不冲掉旧值。扫描失败不是岗位下线。

本地历史例外：仅 user_supplied 来源（当前为 manual）允许岗位及证据的 url 显式为 null，必须同时有稳定 external_id、非空原文证据、unknown 招聘状态与 user_supplied 证据类型。无链接记录保持 needs_recheck；真实网站仍必须提供通过域名检查的 URL。批次可声明 historical=true，此时全部岗位保持待核验；可提供原 first_seen，必须不晚于 observed_at，不把迁移时间当作原收录时间。

申请证据可附 submission_date_unknown=true，表示只知道申请已被接收、不知道实际投递日期。它仍可使用 submitted 状态，但统计不将该条核验时间当成投递日期；已有明确投递日期的其他记录不受影响。

## 门禁与断点

PASS 继续；WAIT_USER 保存断点并交接；RETRY 按 retryAfter 有限重试；REJECT 记录原因，停止受影响步骤或隔离单条记录。门禁不等于重复请求用户批准。

断点：protocol_version、source、slot_version、query、cursor、next_index、completed_ids、completed_urls。新断点优先保存完成的 ID；旧断点仍兼容，不能把 URL 数组擅自转换成 ID。query 或版本不同不得直接恢复。用户接手后重新 probe；游标失效可重新扫描，入档去重保护历史。

runner 每次重新发现当前页并按完成标识去重，不从旧 next_index 盲目跳过前面的卡片。completed_ids 命中或旧 completed_urls 命中都会跳过；旧 URL 断点无法区分共享 URL 下的多个岗位，不应将这类断点用于证明逐岗覆盖。能力协商、参数或断点校验失败时，runScan 可能只返回门禁对象而非完整 ScanBatch；此时记录错误，不能直接交给 ingest。

限流断点还包含 retry_attempts、retry_code、retry_not_before。runner 初次失败不计作重试；之后最多两次实际重试，早于截止时间的调用不访问网站。耗尽时返回 WAIT_USER/RETRY_EXHAUSTED；用户明确要求继续后可用 resumeAfterUser:true 开启新周期，不能跳过等待截止时间。旧断点缺这些字段时按首次运行处理。

本地数据更新用乐观版本检查、单写入锁、原子替换与旧版备份。插槽永不直接写 state.json。
