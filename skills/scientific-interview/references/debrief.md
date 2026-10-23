# 面经复盘

用户只需自然语言复述。使用宿主 AI 分析，命令负责保存和引用；不要求用户填写 JSON。

## 记录一次面试

1. 读取 `show debriefs`，识别是否为同一次面试的补充。同公司不同轮次分别记录；不要把旧经历或简历访谈自动转换成面经。没有收录岗位也能保存。
2. 先保留用户原始复述 `recollection`，整理 company、role、date（YYYY-MM-DD，可缺）、round、可选 job_key、questions（question、当时的 answer、明确的 feedback）。不知道的日期、回答、结果不猜。outcome 只记录用户报告的结果，不自动改申请状态。
3. 每轮收到新信息就用 `library-put debriefs <稳定ID> <项目根目录>/data/main/drafts/debrief.json` 保存，即使未整理完整也保存待核对版本。只需公司、岗位和复述即可创建；缺公司或岗位时先问清。已有版本先 `show debriefs <ID>`，合并并传 `--expected-version N`，不要覆盖其他补充。成功命令自动生成 HTML，本地服务打开“面经复盘”时每 5 秒同步；离线 HTML 需重新打开生成文件。
4. 根据已提供的信息分析 strengths、gaps；每项包含 point、basis（记录中的准确引文）、source：user_recollection / interviewer_feedback / ai_inference。面试官反馈只能引用 questions.feedback；用户说“他可能不满意”属于回忆或推断，不能冒充明确反馈。AI 的结论保持推断标签，用户核对也不改变其来源。
5. 保存可执行 next_steps、resume_suggestions、matching_notes。每轮最多补问 1—3 个会改变结论的问题，如“当时具体怎么回答”“对方有明确反馈吗”“哪些是记不清的”。不用泛泛鼓励文字，不给没有依据的人格或能力评价。一次表现不能推导稳定能力；没有依据可以不下结论。
6. 整理结果供用户核对，确认后追加 `--confirmed` 版本；已确认的同一内容无需重复确认。之后每次补充仍保存新版本。`library-restore debriefs <ID> <版本>` 可恢复并保留全部历史。结构参照项目 `examples/debrief.json`。

## 用于简历与岗位评分

- 修改简历前运行 `debrief-context --target '目标方向'`；`resume-draft` 也返回这份上下文。岗位评分前运行 `debrief-context --key '<岗位key>' --target '岗位方向'`。工具仅提供最新已核对、未删除的候选，按同岗位及日期排序；**语义相关性由 AI 判断**，不要全部照搬。
- 强项可提示优先展示哪段真实经历；不足可提示补充证据、澄清职责或调整表达。新事实需进入经历库并确认后才能成为简历事实，不能把面试点评写成项目成果，也不能把“讲不清”直接等同于“不会”。
- 保存简历草稿或岗位 review 时，实际参考的复盘写入 `debrief_refs: [{"id":"复盘ID","version":2}]`，用 `debrief_notes` 说明关联的要求、影响和不确定性。无需相关复盘时保持空引用。
- 岗位评分仍必须有完整 JD 和已确认经历；复盘只是补充依据，不能独立支撑得分。不会自动调分、重写简历或变更投递状态。
- 复盘更新后，引用旧版本的岗位分数标记待复评；续改简历通过 source_updates 提示引用更新。过去的简历和申请保留原引用。
- 复盘属于私人档案，`render --share` 不包含复盘、分析和历史。旧经历与常用回答仍保留在折叠的资料区，供事实核对。
