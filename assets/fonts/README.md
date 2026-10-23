# 简历中文字体

Noto Sans SC，由 Google Fonts 项目提供，按同目录 OFL.txt 许可分发。PDF 导出嵌入所用字形，避免依赖阅读器的中文字体包。

从 v0.3.0 起，DOCX 也嵌入该字体，并为各文字片段指定字体。使用 OOXML 的 obfuscatedFont 格式，不安装或修改系统字体。完整字体使单份 DOCX 约为 6 MB；字体授权随源项目分发。具体编码规则参考 [Microsoft 的字体部件说明](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/1663dabc-5d98-463f-889e-bcd9b77c3d34)。

来源：https://github.com/google/fonts/tree/main/ofl/notosanssc

获取日期：2026-10-22。从上游 NotoSansSC[wght].ttf 使用 FontTools 固定 wght=400，生成 NotoSansSC-Regular.ttf；保留完整字符集和上游许可证。
