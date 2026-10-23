# 事实限定与资质

用户只需自然语言描述。AI 仅在某个字段能减少误解时整理它；不要展示必填大表，也不要为缺字段延长访谈。完整 JSON 示例在项目 `examples/experience-facts.json`、`profile-credentials.json`。

## 经历的可选事实

保留既有 title/context/responsibility/actions/result/evidence。额外支持：

- `pending_notes`：文本列表，保存尚缺指标、冲突或待核对材料。留在私人档案及起草命令提示，不自动进入简历。
- `facts.stage`：简短、可对外呈现的阶段限定，如“课程模拟”“单仓旺季试点”。
- `facts.responsibility_boundary`：可对外呈现的职责范围，如“本人协调排期，技术负责人做最终放行”。
- `facts.metrics`：可选指标列表。每项 `name` 与 `status` 必需；status 为 `target`（目标）、`forecast`（预测）、`actual`（已实现）、`settled`（已结算）、`unknown`（待核验）。`value`、`unit`、`period`、`definition`、`owner_scope`、`evidence` 为可选文本。
- `facts.evidence_refs`：材料列表。每项 `reference` 为材料名称/位置，另可有 `kind`、`scope`、`version`。引用只是定位信息，不证明材料已被打开或核实。

指标与材料可记录 `disclosure: public|private|unknown`，省略视为 unknown。只有明确 public 的指标会自动呈现到简历；材料位置不会自动写入简历或变成外链。不要把客户明细复制到这些字段。

有 facts 时，草稿保留 `fact_context`；保存时必须与引用的经历版本相同，导出自动显示阶段、职责范围及公开指标的状态/口径。修改限定先更新经历版本，再起草或明确重建；不能只删除限定来使成果看起来更强。文案本身是否忠实仍由 AI 与用户核对，字段校验不能替代语义核验。

## 培训、证书、授权

`profiles/personal.credentials` 为可选列表，每项包含：

- `name`、`kind: training|certificate|authorization`。
- `status: held|expired|pending|unknown`，只反映已核对材料，不推断实时有效性。
- 可选文本 `issuer`、`date`、`expires_on`、`registration`、`evidence`。
- `include_in_resume` 默认 false；用户确认需要展示后设置 true，导出保留类型和状态。

培训不变成证书，证书持有不等于有效注册或现场授权。姓名、联系方式等沿用已有 profile 字段。
