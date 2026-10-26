# 海外搜岗范围

选择海外平台或企业时读取本页，再按 [网站支持矩阵](../../../docs/site-support.md#overseas) 选择具体来源。沿用 [Tabbit 流程](tabbit.md) 的加载、保存批次、断点和入档步骤，不访问招聘接口。最初以 macOS Tabbit 1.18.21 实测 17 个来源；随后 Chrome 扩展复核及 LinkedIn 登录页补测，17 个来源均有可读样本。LinkedIn 1.1.0 已适配实测的 `/jobs/search-results` 登录布局，支持地点候选选择、地区核验、前两页与断点续扫；不退出用户账号或将账号地区结果当作全球搜索。详见 [Chrome 验证记录](../../../docs/site-support.md#overseas-chrome)。

- 海外来源通常仅接受 `keyword`；LinkedIn 另接受 `city`（国家、地区或城市文本，匿名入口空值回退到 `Worldwide`；已登录入口要求明确地区），已登录布局通过可见候选设置地区并核对页面显示。`keyword_mode=native` 将关键词交给网站；`visible-title` 在已加载的列表中按所有空格分词匹配标题，不区分大小写。后者用于 OpenAI、Databricks、YC 和 Wellfound，不能称为全站检索。空关键词表示该入口当前列表；空匹配不证明没有岗位或已有岗位下线。
- Wellfound 只使用 Software Engineer 分类；其他角色尚未接入。Indeed 固定美国站，Apple 默认美国地点。除 LinkedIn 的地区选择外，国家、城市、远程、实习、签证条件在采集后按 JD 筛选，不传给网站伪装已筛选。
- OpenAI 限定 Ashby 的 `/openai`，Anthropic 限定 Greenhouse 的 `/anthropic`。共享解析器不等于支持其他租户。LinkedIn 仅允许声明中的精确国家域名；新域名触发门禁时核实来源，不自动放开通配符。
- 岗位必须保留稳定 ID、真实招聘企业、来源 URL 和观察时间。平台名称不是招聘企业。Stripe 多地点保留在同一 ID 的记录中；跨站相似岗位不自动合并。Indeed 使用可见岗位 ID 生成详情链接，广告跟踪 URL 不入档。
- `coverage` 始终为 `partial`。Google、Amazon、Anthropic、Microsoft 和 Chrome 已登录 LinkedIn 第二页通过；其他翻页情况见支持矩阵。Netflix 仅首批已加载卡片，点击后重载实际详情 URL，防止标题已更新而正文仍属于前一职位。不得手动移除等待或门禁充数。
- 职责和要求都存在且未检测到截断，才标记 `jd_complete=true`；不认识的标题保留原文与 false。平台描述特别短、原文引用外部完整 JD 时保持待核对。签证、居住范围、薪资币种、工作性质和毕业时间只能依据原文；“Remote”不代表全球可申请。
- 采集不提交申请、不上传简历、不自动跟随外部申请站点。海外申请状态同步、专用学生入口与全部地区适配不在本次覆盖内。工程验证始终使用 `data/dev/`，不写用户主档案。

## LinkedIn 默认条件与首次使用

复用已有 `search-save`，搜索 ID 为 `linkedin-default`，数据保存在当前档案的 `state.json` 中（通常是 `data/main/state.json`）。不要从浏览器账号的当前地区猜测求职地区，也不把当前用户的偏好发布为全体用户默认。

通用模板见 [linkedin-search.json](../../../examples/linkedin-search.json)：关键词 `Engineer`、地区留空待用户填写、方向为空、来源仅 `linkedin`；工作方式、资历、职位类型和发布时间均不额外限制。已登录页面没有可核验的全球选项，留空或 `Worldwide` 返回 REGION_REQUIRED，不自动使用账号地区；地区筛选也不代表签证或工作许可符合要求。

1. 首次使用先读取 `show searches`。已有 `linkedin-default` 时复用最新版本，不重复询问。如果没有，先利用用户本轮已给的信息；缺项时一次提示：「LinkedIn 默认关键词为 Engineer，其他条件不限。请填写目标国家/地区或城市，也可修改关键词、补充职业方向。」用户未回答时不要将模板记为已确认偏好或开始正式筛选。用户明确授权的默认地区可直接保存；地区仍为空时需要先补齐。
2. 字段：`keyword` 是网站搜索词；`city` 可以是国家、地区或城市，已登录入口不能以 `Worldwide` 代替明确地区；`direction` 是可选的本地匹配方向；`sources` 固定为 `["linkedin"]`。多个地区分别保存为独立搜索 ID，不能把城市列表拼成单个地点查询。已保存默认后，只有用户要求改变条件才新增版本，不覆盖历史。
3. 将用户填写的 JSON 写到当前档案的 `inbox/linkedin-search.json`，再运行 `search-save linkedin-default <JSON路径>`。CLI 调用方式沿用主 Skill 的项目路径与 `--data` 约定。不要覆盖已有搜索；读取后仅更新用户要求修改的字段。通用模板可用于初始化，不要把私人答案写回 examples 或 Skill。
4. 取最新版本的 `data`，只传 `{keyword, city}` 给 LinkedIn 插槽；`direction` 用于本地匹配，`sources` 用于选插槽。没有现成偏好时不要让适配器自行猜测。
5. 搜索后通过可见页面核对实际关键词和地区（包括本地化名称）。URL 参数不是筛选成功的证据；缺失、冲突或仍显示账号默认地区时停止，记录未核验，不把结果当作符合用户地区的岗位。若用户提出远程、资历等额外条件，说明目前不能作为该插槽的原生参数传入；只能在取得的 JD 中另行核对，未知保持未知。
6. 不要求已登录用户重新登录或退出。已适配当前 Chrome 的 `/jobs/search-results` 布局；遇到 REGION_NOT_RESOLVED 时让用户选择门禁消息中的完整地点名称，不能默认选择第一项。若布局变化或关键词未生效，保留错误与断点；只有登录失效或验证码才要求用户接手。匿名读取保留原路径；旧版登录布局尚未验证。

实测：Chrome 当前德语界面下，美国与中国地区可切换，美国前两页各 25 条引用；采集 3 份详情并续扫新增 1 份，2 份 JD 完整、2 份待核对。候选必须完整匹配；美国支持常用中英文名称及实测德语名称，其他地区优先使用页面实际显示的完整名称，有歧义时交回用户选择。新版登录分支尚未在 Tabbit 上复测，不能把 Chrome 结果当作 Tabbit 结果。
