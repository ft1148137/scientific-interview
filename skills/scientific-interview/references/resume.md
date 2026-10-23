# 经历访谈与简历

命令前缀：`python3 <skill>/scripts/workbench.py --data <项目根目录>/data/main`。输入 JSON 先保存在该档案的 drafts/ 下，避免 shell 转义破坏文字。

## 已有简历

仅识别 PDF 简历，不导入 Word、Markdown、TXT 或图片；旧档案中的非 PDF 原件保留但不在简历原件列表显示。导出格式仍支持 Word、PDF、Markdown。

`resume-import <PDF路径>` 会按内容哈希去重、保留原文件名和原件并提取文本；render 后在私人工作台“简历版本”的原件列表中打开，分享副本不包含原件，提取结果不自动变为已确认经历。扫描版 PDF 返回 needs_transcription；使用宿主允许的视觉读取能力或请用户提供文字，不能猜测识别结果。

读取导入内容，按教育/工作/项目分段，保留日期、个人贡献、原成果和不确定之处。和经历库已有内容比较，先展示冲突，不直接覆盖。

先从原文整理 `profiles/personal` 和 `experiences`，已有信息不再让用户重填；只问缺失或冲突的事实。基础资料与经历确认后再起草。导入返回的是**原件 ID**，首次改写用 `resume-draft --source-import <原件ID>` 保留来源。`--parent` 只接受 `resume-save` 返回的 `resume-…` 版本，不能把导入 ID 当父版本。

## 从零创建和补充

先明确目标方向或 JD；没有方向时用兴趣、擅长的任务与最近经历帮助选择。不要要求先写一份完整经历表。

`interview <会话ID> --target '目标方向'` 提供当前资料缺口提示；它不是固定问卷。结合真实回答，用自然语言继续追问。每轮最多三个问题，优先最高价值的一两个：

- 回忆场景：工作、课程、个人实践中，是否曾经遇到与目标方向相关的具体问题？允许“没有”。
- 个人贡献：原流程如何，你亲自负责什么，别人负责什么？
- 方法与取舍：选了什么方案，遇到哪些失败，怎么调整？
- 结果与依据：交付物、使用反馈、质量变化是什么？没有数字不强求量化。

方向明确时按 [行业索引](industries/index.md) 读取适用校招/社招小节；用 `--industry <ID> --segment campus|experienced` 可将资料选择留在访谈会话中。先从原稿提取已知事实，仅补问会影响匹配结论的缺口。

真实经历尚不存在时，如实说明能力差距，不写进简历。用户可跳过、停止访谈或先看草稿；`interview <ID> --skip <问题ID>` 保存跳过记录。用户回答后更新对应字段，再开始下一轮。

## 保存与复用

参考项目 `examples/profile.json`、`experience.json`、`answer.json` 的结构。使用 `library-put profiles personal <file>` 或 `library-put experiences <ID> <file>` 保存草稿；事实确认后加 `--confirmed`。已有 ID 必须加当前 `--expected-version N`。删除采用新版本中的 `deleted: true`；历史不删。

`answer '问题' --context '目标岗位/语境'`：同问题同语境且已确认可复用；相似问法或不同语境只提供可编辑草稿，人工检查再使用。不要自动把薪资、到岗时间等旧答案视为仍然有效。

字面未命中时，工具返回 `semantic_review_required` 候选，**不代表已做语义匹配**。由 AI 阅读问题、语境、答案，判断意图是否相同；候选不足时加 `--all-candidates` 阅读全部已确认回答，不相关就不用。薪资/到岗或显式 `requires_recheck: true` 的回答始终提示核对当前值和更新时间；用户本轮已确认的同一版本不重复提问。

JSON 和 CLI 由 AI 处理，用户只需自然语言提供与核对事实。起草前检查基础资料是否已确认；允许用户暂缺联系方式等字段，不编造。版本冲突时按错误提供的 `show` 命令读取当前版本，合并后再写入，不仅仅替换版本号绕过保护。

## 草稿 修改 导出

1. `resume-draft --target '方向' --experience <ID> --out <项目根目录>/data/main/drafts/resume.json`。可重复指定经历；改写导入原件用 `--source-import <原件ID>`，修改已保存版本用 `--parent <resume-…ID>`，可同时引用。
   `--parent` 默认复制父稿的资料引用、条目选择、排序、bullets 和 change_notes。命令的 source_updates 提示已有新资料，不自动覆盖。用户明确需要从当前经历重新生成时加 `--rebuild`，可再用 `--experience` 选择；此时文案会重建。
2. AI 根据 JD 决定排序和措辞，编辑草稿的 entries/bullets 与 change_notes。基础资料、单位、日期或职责事实需先在经历库更正。每段保留 experience_id/version，不能替换成无法追溯的新事实。
   “未留存数据”“待核对材料”保存为 pending_notes，正文呈现真实职责、方法与交付；课程、试点、目标值等影响事实含义的限定必须保留。已有原稿中的负面/内部说明需要逐句判断，不按“没有”等关键词盲删。可选 facts 和 credentials 的规则见 [事实限定与资质](facts.md)。
3. 展示改动和需确认的问题。用户确认后 `resume-save <draft.json> --confirmed`，得到不可变版本 ID。
4. `resume-export <ID> [--out <项目根目录>/data/main/exports/custom]` 导出 Word、PDF、Markdown、JSON 和改动说明。自定义目录导出也会同步到私人档案的 exports，`render` 后工作台可下载。父子版本的系统差异和人工修改备注分开显示。按返回的绝对路径查看全部页面；必要时调整文字或模板后重导，不把空 PDF 或截断页当完成。
5. `resume-select <岗位key> <简历ID>` 选择后续投递版本；旧申请继续引用当时版本。`library-restore <集合> <ID> <版本>` 恢复经历/回答时会追加新版本。

DOCX 嵌入项目自带中文字体，文件约 6 MB；无需为了阅读安装项目字体，但不同办公软件仍需实际核验。PDF 与 DOCX 分别检查，不能用一种格式正常代替另一种。


已有简历和从零创建最终共用同一条流程。引导用户补足目标方向的真实经历，避免只做字面润色。

## 面经复盘参考

起草或续改简历前，按 [面经复盘](debrief.md) 读取已核对复盘。选择与目标相关的材料，保存 debrief_refs 和 debrief_notes；保留来源与不确定性，不把表现推断当作经历事实。
