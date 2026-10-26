# 网站支持与验证范围

v0.13.0；社招抽样实测日期：2026-10-22，九个校招来源抽样实测日期：2026-10-23。当前注册 37 个真实网站来源（11 个既有来源、9 个独立校招来源和 17 个海外实验性来源），另有手工录入、合成演示和 2 个浏览器插槽，共 41 份声明。文档复核不代表重新访问了网站。既有网站实测使用 Codex Chrome 插件；2026-10-24 新增 Tabbit 抽样实测（见文末），登录和验证码由人完成。每个网站均是可独立注册的 SiteSlot，Moka 平台解析与企业租户配置分开维护。

| 企业 | Slot ID / 官方入口 | 关键词与详情 | 已有翻页验证 |
|---|---|---|---|
| 腾讯 | `tencent` · [入口](https://careers.tencent.com/search.html) | 保留原有适配，v0.7/v0.8 做自动化回归 | 2026-10-22 未重新实测 |
| 美团 | `meituan` · [入口](https://zhaopin.meituan.com/web/position) | 读取 1 份完整 JD，综合入口含社招/应届/实习 | 第 2 页 10 条，仍有后续页 |
| 高德 | `amap` · [入口](https://talent.amap.com/off-campus/position-list) | 读取 1 份完整 JD，社会招聘 | 第 2 页 10 条、末页；复位回第 1 页验证通过 |
| 字节跳动 | `bytedance` · [入口](https://jobs.bytedance.com/experienced/position) | 读取 1 份完整 JD，社会招聘 | 第 2 页 10 条，仍有后续页 |
| 京东 | `jd` · [入口](https://zhaopin.jd.com/web/job_info_list/3?isHunterFlag=false) | 同页读取 2 份完整 JD，续扫新增第 3 份 | 第 2 页 4 条、末页 |
| 滴滴 | `didi` · [入口](https://talent.didiglobal.com/social?page=1&size=10) | 读取 1 份完整 JD，社会招聘 | 第 2 页 10 条，仍有后续页 |
| 小红书 | `xiaohongshu` · [入口](https://job.xiaohongshu.com/social/position) | 读取 1 份完整 JD，社会招聘 | 第 2 页 10 条，仍有后续页 |
| 快手 | `kuaishou` · [入口](https://zhaopin.kuaishou.cn/#/official/social/) | 读取 1 份完整 JD，国内社会招聘 | 第 2 页 2 条、末页 |
| Kimi（月之暗面） | `moka-kimi` · [入口](https://app.mokahr.com/apply/moonshot/148506#/jobs) | 读取 1 份完整 JD，社招租户 | 采用共用分页实现，未单独实测翻页 |
| 智谱 | `moka-zhipu` · [入口](https://app.mokahr.com/social-recruitment/zphz/148983#/jobs) | 读取 1 份完整 JD，社招租户 | 采用共用分页实现，未单独实测翻页 |
| 阶跃星辰 | `moka-step` · [入口](https://app.mokahr.com/social-recruitment/step/94904#/jobs) | 读取 1 份完整 JD，社招租户 | 第 2 页 1 条、末页 |
| 字节校园招聘 | `bytedance-campus` · [入口](https://jobs.bytedance.com/campus/position) | 读取 3 份完整 JD，包含正式与实习原文 | 第二页 10 条、仍有后续页；断点续扫通过 |
| 小红书校园招聘 | `xiaohongshu-campus` · [入口](https://job.xiaohongshu.com/campus/position) | 读取 3 份完整 JD，当前应届生项目 | 第二页 10 条、仍有后续页；断点续扫通过 |
| 腾讯校园招聘 | `tencent-campus` · [入口](https://join.qq.com/post.html?query=p_1) | 3 份完整 JD，当前应届项目，续扫通过 | 第二页 10 条、仍有后续页 |
| 京东校园招聘 | `jd-campus` · [入口](https://campus.jd.com/home#/jobs) | 3 份完整 JD，Enter 搜索，续扫通过 | 未通过：点击后列表未变化，返回 PAGE_NOT_CHANGED |
| 滴滴校园招聘 | `didi-campus` · [入口](https://campus.didiglobal.com/campus_apply/didiglobal/96064#/jobs) | 3 份完整 JD，独立 Moka 校招租户，续扫通过 | 未通过：无关键词列表加载超时；算法查询不足两页，下一页禁用 |
| 快手校园招聘 | `kuaishou-campus` · [入口](https://campus.kuaishou.cn/recruit/campus/e/#/campus/jobs?recruitSubProjectCodes=20271779425607) | 3 份完整 JD，2027 应届项目，续扫通过 | 第二页 10 条、仍有后续页 |
| Kimi 校招 / 实习 | `moka-kimi-campus` · [入口](https://app.mokahr.com/campus-recruitment/moonshot/148507#/jobs) | 3 份 JD；1 份通过完整性检查、2 份待核对；续扫通过 | 无关键词目录第二页 30 条，仍有后续页 |
| 智谱校招 / 实习 | `moka-zhipu-campus` · [入口](https://app.mokahr.com/campus-recruitment/zphz/148984#/jobs) | 3 份完整 JD，续扫通过 | 当前全目录 26 条，下一页禁用；未验证多页 |
| 阶跃星辰校招 / 实习 | `moka-step-campus` · [入口](https://app.mokahr.com/campus-recruitment/step/94905#/jobs) | 3 份 JD；2 份通过完整性检查、1 份待核对；续扫通过 | 无关键词目录第二页 30 条，仍有后续页 |

v0.7.0 的六个新增来源已完成表中抽样；v0.8.0 新增京东、滴滴、小红书和快手，仍使用关键词 `Agent` 做工程验证，四站共取得 6 份完整 JD（含京东断点续扫），检查稳定 ID、证据与正式入档接口。表中数量只是当时样本，不是网站固定岗位数，也不代表各来源已全量抓取。验证批次均保留 coverage=partial；没有提交申请。原始采集记录与开发日志只存于本机 data/dev，不进入源码包。

## 搜索范围与门禁

- 新增来源目前仅接受 keyword。城市、行业和方向由采集后的筛选流程核对；不能把不支持的参数交给网站后默认为筛选生效。
- 快手搜索默认国内工作地点，未覆盖海外招聘。京东和滴滴的关键词通过页面搜索框提交；URL 可能不反映关键词，继续扫描必须保留原查询。
- 既有高德、字节、京东、滴滴、小红书、快手和三个 Moka 租户使用社招入口。校招由表中的九个独立 *-campus 插槽覆盖，不能把既有社招来源当作校招来源。美团通用列表可能返回应届和实习，使用时仍需逐项核验岗位性质。
- Moka 主结果与侧栏“最新职位”、高德主结果与推荐列表分开，推荐卡片不进入本次搜索结果。
- 重新发现列表会回到初始页，再按游标逐页恢复；不复用旧元素句柄。列表定位的岗位在点击前核对完整卡片文本，详情再核对标题与稳定 ID。
- 京东详情在列表内展开，多个岗位共用来源 URL。ID 来自可见行的控件属性，按来源+ID 入档和续扫；打开来源链接会到列表，需要按标题找到岗位。无法读到明确停招原文时不会判定 closed。
- 租户限定在精确主机和 path_prefix 内，同属 app.mokahr.com 的其他企业仍拒绝。入档时再次校验企业名与租户路径。
- 发现明确职责和要求、有正文且没有识别到截断时，才标记完整 JD。自定义写法无法识别时保留原文和 jd_complete=false；需进一步人工核对，不能直接评分。
- 空列表、超时、登录、布局变化和 404 都不等于下线。只有带明确停招原文的详情证据才支持 closed；缺分页证据不能声明全量完成。
- 页面 DOM、类名或 ATS 模板更新可能需要修订插槽。当前实测是可用性抽样，不是长期稳定性或所有岗位类型的保证。

## 暂未接入

BOSS 直聘与猎聘于 2026-10-23 进行了登录后验证。BOSS 曾读到推荐列表及一份职位详情，但关键词搜索持续加载，详情随后变为空白；猎聘职位列表未稳定加载，曾转为 about:blank。原因尚未确定，搜索、分页、断点续扫与正式入档没有通过端到端验证，因此两站均未注册。共享解析器已支持动态招聘企业及列表/详情企业一致性检查，合成测试通过不代表平台可用。匿名企业保留原文，不以招聘平台名称或猎头雇主替代；本轮未采集入用户主档案。

百度在 2026-10-22 的 v0.8.0 接入验证中，分别从官网首页和已经观察到的 `/jobs/social` 入口尝试，共两次看到招聘页框架后转为 `about:blank`。没有读到稳定岗位列表或详情，原因尚未确定；未注册插槽，也未绕过 Chrome 改用接口抓取。

汽车、制造及其他非互联网企业按本轮范围暂缓。这不删除已有行业参考资料，也不影响手工导入 JD、简历与面经复盘。

未来新增 Moka 企业可复用平台解析器，但必须增加独立租户声明并验证实际页面，不能将“支持已注册租户”表述为“支持所有 Moka 网站”。接入步骤见 [贡献指南](contributing.md)。

## 校招首批接入（2026-10-23）

两个校招来源使用独立 ID；字节和小红书的社招/校招均增加路径门禁，采集与入档双层拒绝跨渠道 URL。既有这两个社招插槽版本变为 1.0.1，旧版本断点须重新发现；不改历史岗位与申请。校园 JD 保留页面招聘项目、正式/实习、岗位方向等原文，不自动推断毕业资格。

实测使用关键词 Agent，每站先读取 2 份 JD，再从 checkpoint 续读 1 份，检查第二页；两个批次均为 partial，不代表全量采集。6 份样本仅进入 data/dev/campus-integration-2026-10-23 下的隔离档案，不改用户主档案，不提交申请。

字节校园列表包含日常实习、正式校招及专项项目；当前不提供站内招聘类型或届别参数，应逐岗查看原文筛选。小红书校园职位列表当前显示 2027 校园招聘，入口随官网更新，不硬编码年份；REDstar、独立实习生入口未纳入本插槽。未给出截止日期或毕业时间的岗位保持未知。

高德官方校园首页的应届入口实测跳转到 campus-talent.alibaba.com，使用应届批次与部门筛选，部分岗位对应多个集团业务；需要独立适配和归属验证，本轮不注册为已支持。首批未覆盖美团及三个 Moka 校招租户；腾讯、京东、滴滴和快手在第二批单独验证，三个 Moka 校招租户见 v0.11.0 记录。


## 校招第二批（v0.10.0，2026-10-23）

新增腾讯、京东、滴滴、快手四个独立校园来源。关键词“算法”各读取 2 份完整 JD，再由断点续读 1 份，共 12 份。腾讯/快手第二页通过；京东/滴滴翻页未通过实测，不能宣布完成目录扫描。所有批次保持 partial，工程记录只保存在 data/dev/campus-expansion-2026-10-23，未向主档案导入这些样本。

腾讯入口选择应届毕业生项目，不覆盖实习及青云专项。快手入口固定官网当前 2027 应届项目代码 20271779425607，不覆盖留用实习；换届应重新核验入口和项目，不能自动改年份。京东使用校园首页默认项目范围，未提供单独项目参数，需逐岗核对毕业区间及正式/实习要求。滴滴沿用 Moka 解析器，但仅限独立校园域名及租户路径，日常实习的另一个租户未注册。

腾讯、京东、快手列表没有详情链接，插槽点击经核对的卡片后，从实际详情网址取得稳定 ID；标题不一致或列表变化时拒绝写入。JD 证据仅保存职位内容，不包含账户页眉。腾讯保留原始职责、要求、加分项等段落；京东保留完整地点及毕业条件，不能拿列表中截断的地点代替详情。

## Moka 校招第三批（v0.11.0，2026-10-23）

从企业官方入口确认 Kimi（月之暗面）、智谱、阶跃星辰的独立校园租户。关键词 Agent 各读 2 份 JD，再从 checkpoint 续读 1 份，取得 9 个不同岗位；隔离档案重复导入不新增岗位。6 份通过完整性检查，3 份自定义格式保留原文且 jd_complete=false。初始扫描与续扫均为 partial，不代表全量抓取。

Agent 查询均不足两页；无关键词目录中 Kimi、阶跃星辰第二页各 30 条，仍有后续页。智谱当时全目录 26 条、下一页禁用，因此只验证了单页边界。数量是实测快照，不是固定值。分页测试中阶跃 JD 正文出现“安全验证”造成门禁误报；已改为识别独立验证提示或明确验证指令并复测通过，真正登录/滑块/验证提示仍然停下。

校园租户内混合正式、实习及专项名称，不能仅按入口推断毕业资格。保留职位性质、职能类型和地点字段，地点缺失或截断时未知；不从卡片末段猜测。支持 Markdown 标题、核心职责、岗位描述等已验证格式，未经识别的格式不直接评分。阶跃独立 StepStar 租户 step/141903 尚未注册，当前普通校园租户里已有的 Stepstar 标题岗位仍可读取。

美团本轮确认校园列表和一份应届详情；详情路径与综合招聘共用，highlightType 仅是展示参数，不能当作岗位性质证据。暂不注册独立美团校招来源，需增加基于详情类型的采集与入档校验。既有 meituan 综合插槽继续可用。高德转阿里统一校园平台仍待适配。

原始验证记录仅存于 data/dev/campus-moka-2026-10-23；没有向主档案导入测试样本，没有提交申请。源码只包含合成测试、租户入口与解析规则。


## Tabbit 浏览器插槽（v0.12.0，2026-10-24）

使用 macOS Apple Silicon 上的 Tabbit 1.16.27 官方稳定启动器与有头浏览器任务，未导入 Chrome 资料、未登录 Tabbit 账号、未提交申请。官网最新版下载节点当时连接失败，因此以下结论仅对应实测版本。新增浏览器 ID 为 `tabbit`，20 个真实网站的声明能力协商通过；能力兼容不代表每个来源已重新实测。

| 来源 | 实测结果 | 边界 |
|---|---|---|
| 腾讯社招 | 2 份完整 JD、第二页、断点续扫不重复、新标签详情 | 国际岗位跳 Workday，按域名拒绝；期间出现一次导航超时，保留失败记录 |
| Kimi / Moka 社招 | 2 份完整 JD、第二页 30 个引用、断点续扫不重复 | 抽样验证，不代表全量覆盖 |
| 字节校招 | 1 份完整 JD | 未重测分页与续扫 |
| 滴滴社招 | 搜索输入、点击搜索和新标签详情；2 份完整 JD（含“大模型”关键词复测） | 未重测分页与续扫 |
| 京东社招 | 未登录时跳转 passport.jd.com，DOMAIN_REJECTED | 登录后待验证，不扩大域名门禁 |
| 京东校招 | 页面、详情、输入与 Enter 可执行；首次搜索结果更新不稳定 | 手动复测能筛出算法岗位，但完整扫描仍可能超时。增加结果变化等待，失败返回 RETRY；此前读到的未筛选样本不入档。分页与续扫未验收 |

Tabbit 端口复核每次操作的快照、控件及目标域名；点击时汇总页面变化后识别新标签，避免提前将列表误作详情。等待替换内容直接比较可见 DOM 文本，不能仅凭 locator 存在判断搜索或翻页成功。京东校招 SiteSlot 升为 1.0.1，补充 fill 能力声明及搜索结果变化检查；旧版本断点不能直接复用。

真实样本、失败回执和开发日志仅放在 `data/dev/tabbit/`，成功样本使用隔离档案入档与去重验证。主档案不变。未逐站重测其他企业、BOSS/猎聘、Windows、登录交接恢复和验证码；不能将这些项目列为本轮已通过。安装与续扫见 [Tabbit 接入说明](../skills/scientific-interview/references/tabbit.md)。

<a id="overseas"></a>
## 海外来源（2026-10-26，v0.13.0）

本轮通过 macOS Tabbit 1.18.21 的官方 CLI 访问可见页面。17 个来源各读取 2 条岗位，Amazon 断点续读 1 条，共 35 条；30 条通过职责/要求完整性检查，5 条保留原文及 `jd_complete=false`。35 条通过正式 `ingest_scan` 边界及 CLI 入档、HTML 渲染检查；在隔离内存档案重复导入仍为 35 条。CLI 档案与报告位于 `data/dev/`，未改用户主档案。工程原文、批次与日志仅存 `data/dev/`；发布源码只含合成测试。后续 Codex Chrome 验证见下节；Windows 与申请状态同步仍未实测。

所有批次均为 partial。原生搜索仅声明 `keyword`；“标题筛选”指当前已加载列表中，不区分大小写地匹配全部空格分词，不能当作全站全文搜索。无匹配或未读到的岗位不自动判为下线。以下“2/2”表示两条样本通过完整性规则，不代表该来源其他 JD 一定完整。

| 来源 / Slot ID | 已验证入口 | 关键词与详情样本 | 分页范围 |
|---|---|---|---|
| LinkedIn / `linkedin` | [入口](https://www.linkedin.com/jobs/search/) | 原生关键词，Worldwide；完整性 0/2，保留正文待核对 | 首批可见列表；无限滚动未接入 |
| Indeed / `indeed` | [入口](https://www.indeed.com/jobs) | 原生关键词，美国站；完整性 1/2，另一条正文短 | 有下一页适配，未实测第二页 |
| Wellfound / `wellfound` | [入口](https://wellfound.com/role/software-engineer) | Software Engineer 分类内标题筛选；完整性 2/2 | 首批可见列表；其他角色和分页未接入 |
| YC Work at a Startup / `yc` | [入口](https://www.workatastartup.com/jobs) | 标题筛选；真实企业及薪资/签证等可见字段；完整性 1/2 | 首批可见列表；更多加载未接入 |
| OpenAI / `openai` | [入口](https://jobs.ashbyhq.com/openai) | Ashby 独立租户；标题筛选；完整性 2/2 | 当前已加载列表；不声明全量 |
| Anthropic / `anthropic` | [入口](https://job-boards.greenhouse.io/anthropic) | Greenhouse 独立租户；原生关键词；完整性 2/2 | 第二页 50 条，仍有后续 |
| Google / `google` | [入口](https://www.google.com/about/careers/applications/jobs/results/) | 原生关键词；完整性 2/2 | 第二页 20 条，仍有后续 |
| Microsoft / `microsoft` | [入口](https://apply.careers.microsoft.com/careers) | Eightfold 现站入口；原生关键词；完整性 2/2 | 第二页 10 条，仍有后续 |
| Amazon / `amazon` | [入口](https://www.amazon.jobs/en/search) | 原生关键词；完整性 2/2；续扫新增 1 条完整 JD，无重复 | 第二页 10 条，仍有后续 |
| NVIDIA / `nvidia` | [入口](https://jobs.nvidia.com/careers) | Eightfold 现站入口；原生关键词；完整性 2/2 | 共用分页适配，未单独实测第二页 |
| Apple / `apple` | [入口](https://jobs.apple.com/en-us/search) | 原生关键词，默认美国地点；完整性 2/2 | 有下一页适配，未实测第二页 |
| Stripe / `stripe` | [入口](https://stripe.com/careers/search) | 原生关键词；同 ID 多地点保留一条；完整性 2/2 | 有下一页适配，未实测第二页 |
| Databricks / `databricks` | [入口](https://www.databricks.com/company/careers/open-positions) | 标题筛选；排除站点导航；完整性 2/2 | 当前已加载目录；不声明全量 |
| Airbnb / `airbnb` | [入口](https://careers.airbnb.com/positions/) | 原生关键词；完整性 2/2 | 有下一页适配，未实测第二页 |
| Uber / `uber` | [入口](https://jobs.uber.com/en/jobs/) | 原生关键词；完整性 2/2 | 有下一页适配，未实测第二页 |
| Netflix / `netflix` | [入口](https://explore.jobs.netflix.net/careers) | 原生关键词；点击后重载详情防止旧正文；完整性 1/2 | 首批 10 张可见卡片；“显示更多职位”未接入 |
| Meta / `meta` | [入口](https://www.metacareers.com/jobsearch/) | 原生关键词；保留简介、职责、要求等详情区域；完整性 2/2 | 首批可见列表；翻页未接入 |

入口重定向已按实际页面核验：OpenAI 使用 Ashby 的 `/openai`，Anthropic 使用 Greenhouse 的 `/anthropic`，Microsoft 使用 `apply.careers.microsoft.com`，Netflix 使用 `explore.jobs.netflix.net`。这些是独立声明的租户/入口，不能扩大为整个平台任意企业。

LinkedIn 本轮列表返回 www、sg、kr、id、ae、in、uk、cn、au、ie、ca 等精确国家主机；列表与详情核验岗位 ID、标题和招聘企业，入档统一为 www 的岗位 ID 链接。未声明的国家主机保持域名拒绝，不偷偷放开整个域名后缀。没有自动点击外部申请链接。

Indeed 的普通/广告卡片均从可见链接 ID 提取岗位键，规范为 `/viewjob?jk=…`，不保存广告跟踪跳转。Wellfound 目前仅覆盖已验证 Software Engineer 分类，不能把其他角色关键词传入后声称全站搜索。Stripe 保留多个办公/远程地点，不将同一 ID 拆成多次岗位。Google 使用浏览器解析后的 href，正确处理页面 base。

Netflix 的动态详情曾出现标题和 URL 已更新但正文仍属于前一岗位；适配器现会重载实际详情 URL，再核验标题、ID 和 JD。两个最终样本正文已经区分，第二条的非标准标题仍保持待核对。Uber 卡片/详情的“Job removed”包含收藏反馈语义，不能仅凭这句判为岗位停招。

海外列表可能包含学生/实习职位，本轮不宣称覆盖独立校招入口、所有国家或所有岗位。保留原文中的签证、薪资、地点和远程限制；未明示的资格保持未知。页内认证/人机验证由页面门禁停止，登录入口存在本身不等于必须登录；未实施绕过或接口抓取。

<a id="overseas-chrome"></a>
## Codex Chrome 扩展复核（2026-10-26，v0.13.0）

使用现有 `codex-chrome` BrowserPort、相同的 17 个 SiteSlot 和 runner，经已连接的 Chrome 扩展实测；没有切回 Tabbit、访问招聘接口或修改插槽代码。工程关键词为 `Engineer`，只按每个来源既有的关键词模式和地区/分类范围验证。

| 结果 | 来源 | 样本与限制 |
|---|---|---|
| 首次读取通过 | OpenAI、Anthropic、Google、Microsoft、Amazon、Stripe、Apple、Airbnb、Meta、Wellfound、YC | 每站 2 条岗位；YC 其中 1 条 JD 待核对 |
| 首次加载超时，断点重试通过 | NVIDIA、Databricks、Uber、Netflix、Indeed | 每站 2 条岗位；Netflix、Indeed 各 1 条 JD 待核对。Netflix 两条记录的 ID 与正文不同 |
| 初测失败，后续已修复（见下文） | LinkedIn | 当前 Chrome 已登录，搜索跳到 `/jobs/search-results`，页面使用不同列表结构并带入账号地区。现有匿名列表选择器无匹配，最终为 RETRY/BROWSER_ERROR，0 条入档；不能把该页面当成已执行 Worldwide 检索，也不要求用户退出账号来绕过差异 |

16 个来源共读取 32 条岗位，Amazon 续扫新增 1 条且无重复。33 条通过正式入档边界及隔离 CLI/HTML 流程，重复导入仍为 33 条；30 条通过 JD 完整性检查、3 条待核对。失败批次、断点、样本与测试档案仅存 `data/dev/overseas-chrome/`，不写用户主档案。

分页抽查：Amazon 第二页 10 条、Anthropic 50 条、Microsoft 10 条；Google 首次返回 PAGE_NOT_CHANGED，随后观察页面已切换，重新执行发现第二页通过、20 条。四站均仍有后续页，coverage 保持 partial。这是一次小样本兼容性测试，首次加载与 Google 翻页存在时序波动，不能承诺每次无需重试。其余来源分页未在 Chrome 逐站验证。

此结果补充前一节 Tabbit 的抽样记录：Tabbit 未登录环境的 LinkedIn 成功不代表 Chrome 已登录界面已适配。LinkedIn 的后续修复与当前边界见下一节。

## LinkedIn 已登录页面补测（2026-10-26，插槽 1.1.0）

- 保留匿名入口；新增当前 `/jobs/search-results` 布局。通过可见地点候选设置并核验国家/地区，先前的 location URL 参数被忽略问题不再静默通过。
- Chrome 当前德语界面下，美国与中国地区自动切换通过。美国前两页各 25 条岗位引用，详情采集 3 条、断点续扫新增 1 条且无重复。4 条均通过隔离入档；2 条 JD 完整、2 条保留待核对。没有提交申请或上传简历。
- 岗位 ID 来自可见卡片 componentkey，详情再次核验 URL ID、正文区域 ID、标题和企业；只保存岗位正文证据。展开正文后仍不满足完整性检查的记录不评分。
- 保留 partial；只验证前两页和有界续扫，不声明全量。新版登录分支未在 Tabbit 上复测，其他登录布局和语言组合也未穷尽验证。
- 地区需完整匹配候选，美国支持常用中英文名称及实测德语名称；同名城市不自动挑第一项。已登录页面没有可核验的 Worldwide 选项，缺少地区时返回 REGION_REQUIRED；用户在 Skill 中补齐条件后保存默认。见 [填写流程](../skills/scientific-interview/references/international.md#linkedin-默认条件与首次使用)。
- 验证文件位于被忽略的 `data/dev/linkedin-signed-in/`，未进入个人岗位档案。旧版本断点需按版本不兼容处理，不能直接改版本号冒充已核验。
