# 个人主页影片支线同步说明

> 给另一端负责 Creator City 社区地图、社区大厅和功能区的 Agent 使用。
>
> 本次同步只处理：个人资料输入、简历与 GitHub 信息、用户媒体上传与绑定、叙事编排、Remotion 个人影片、影片导演台和个人主页。
>
> 不要用本提交覆盖另一端已经修改的城市地图、社区大厅、建筑布局、功能页面或 Agent 社区代码。

## 1. 需求边界

需要同步的核心目标是：

1. 用户上传的视频必须稳定保留，并真正进入 Remotion 影片。
2. 再次导入 GitHub 时，不能清空用户手填的项目资料，也不能破坏视频与项目的绑定。
3. 简历、项目说明、素材评论和视频时间点应共同决定叙事，而不是生成无依据的填充文字。
4. 用户信息不足时，影片应减少对应章节、增加真实素材展示时间，不能出现“待补充”“职责待补充”一类胡言乱语。
5. 视频原文件丢失、项目未绑定或没有进入 Storyboard 时，导演台必须明确报错并阻止导出纯 Motion 成片。
6. 个人主页和导演台在读取旧档案时，应自动修复历史媒体绑定。

社区侧仍然只通过 `UserProfile`、`CreatorProject` 或 `/profile` 使用个人主页成果，不应直接依赖 Remotion 内部场景组件。

## 2. 从“星辰视频丢失”开始的问题根因

旧逻辑在重新导入 GitHub 时会整体替换 `profile.projects`：

```text
旧项目 ID + 已上传视频绑定
            ↓ 重新导入 GitHub
新项目 ID + 旧视频仍指向旧 ID
            ↓
Storyboard 找不到项目视频
            ↓
影片静默退回纯 Motion
```

视频二进制文件其实仍可能保存在浏览器 IndexedDB 中，但 Profile 中的项目 ID 与媒体关系已经断开，所以导演台看不到或无法使用这段视频。

本次修改同时修复新数据写入和旧数据迁移，避免只修复当前一次操作。

## 3. 本次完成的修改目录

### 3.1 项目与视频绑定修复

新增：

- `src/features/profileMediaBindings.ts`

主要行为：

- 以项目名称和 GitHub repository slug 生成稳定匹配键。
- 保留仍然有效的显式 `asset.projectId`。
- 当旧项目 ID 已失效时，根据文件名、素材评论、文档内容和叙事文本匹配当前项目。
- 同步修复双向关系：
  - `ProfileMediaAsset.projectId`
  - `CreatorProject.mediaAssetIds`
  - `CreatorProject.mediaAssetId`
  - `CreatorProject.mediaType`
  - `CreatorProject.presentationMode`
- 项目存在视频时自动使用 `live` 展示模式。

### 3.2 GitHub 导入不再覆盖用户资料

修改：

- `src/app/onboarding/page.tsx`

主要行为：

- GitHub 项目由“整体替换”改成“按项目名或仓库地址合并”。
- 已有项目保留原 ID，因此已经上传的视频不会因为再次导入 GitHub 而丢失绑定。
- 保留用户已经填写的：
  - 项目角色
  - 项目结果
  - 项目亮点
  - 架构与流程
  - 媒体关系
- GitHub 返回有效说明时，只补充原先为空或占位的说明。
- 合并技术栈，而不是覆盖用户信息。
- 新增项目链接时不再自动写入“待补充项目说明”和虚假的 `Project` 技术标签。
- 进入资料页时自动修复旧档案媒体绑定，并重新生成已过期的本地叙事。

### 3.3 简历真正参与项目叙事

修改：

- `src/features/mediaNarrative.ts`
- `src/remotion/storyboard.ts`

主要行为：

- 使用项目名称和 GitHub repository slug 在简历文本中寻找对应项目段落。
- 从该段落提取：
  - 问题背景
  - 本人角色
  - 关键行动
  - 可核验结果
  - 复盘方法
- 素材评论仍具有最高优先级，简历作为补充证据，项目字段作为后续回退。
- 支持更自然的素材评论写法，包括：
  - `问题：...`
  - `我负责：...`
  - `行动：...`
  - `重点看：00:12 ...`
  - `结果：...`
  - `复盘：...`
- 增强对非固定格式中文句子的识别，例如“围绕……设计”“项目获奖”“将……抽象为……”。

### 3.4 删除无依据的填充叙事

修改：

- `src/features/mediaNarrative.ts`
- `src/remotion/storyboard.ts`
- `src/features/profile.ts`

主要行为：

- 识别并过滤以下占位内容：
  - 待补充
  - 尚未提供
  - 请补充
  - No description
  - 旧版模板式空话
- 没有问题信息时，不生成虚构的问题章节。
- 没有职责或行动时，不生成“职责待补充”。
- 没有结果时，不生成虚构数字、影响或“结果待补充”。
- 没有复盘时，不强行加入方法论结论。
- 允许 Storyboard 使用 `media-full`，让真实视频片段短暂全屏展示。

新的事实优先级：

```text
素材评论与时间点
      ↓
已分析的素材叙事
      ↓
简历中的对应项目段落
      ↓
用户手填项目字段
      ↓
仅使用能够确认的事实
```

## 4. 视频生成节奏修改

修改：

- `src/remotion/storyboard.ts`

### 视频优先

- 只要项目存在已载入的视频，展示方式强制切换为 `live`。
- 项目场景至少安排三段真实媒体镜头。
- 优先使用素材评论中的明确时间点。
- 没有时间点时，从视频约 6%、40%、72% 的位置选择不同片段。
- 单段真实视频由原来的约 1.8–3.4 秒调整为约 2.8–4.2 秒。
- 重点证据允许使用 `media-full` 全屏镜头。
- 当文字信息较少时，不再用空话填时间，而是增加“项目全貌”和“操作细节”真实镜头。

### 动态时长

- 没有项目场景：约 30 秒。
- 一个重点项目：约 32 秒。
- 两个重点项目：约 36 秒。
- 单个项目根据实际 Story Beat 数量分配约 10–16 秒。
- 项目场景设置更高的最小时长，避免项目画面快速闪过。

## 5. 导演台不再静默生成错误成片

修改：

- `src/app/video/page.tsx`

导演台现在会检查三类问题：

1. 视频元数据存在，但 IndexedDB 原文件未能载入。
2. 视频没有绑定到当前有效项目。
3. 视频已载入且已绑定，但没有进入当前 Storyboard。

发现问题时：

- 在“真实视频素材检查”区域显示具体文件名和原因。
- 明确提示“系统不会再静默退回纯 Motion 成片”。
- 禁用“现场渲染 MP4”。
- 引导用户返回资料页修复绑定或重新上传。

这项行为是强制约束：不能为了让导出按钮可用而删除检查。

## 6. 个人主页与媒体解析修改

修改：

- `src/app/profile/page.tsx`
- `src/features/mediaLibrary.ts`

主要行为：

- 个人主页加载档案时先修复媒体关系，再解析 IndexedDB Object URL。
- 修复后的 Profile 会保存回本地，后续打开资料页、导演台或主页时保持一致。
- 媒体解析统一基于修复后的项目和素材关系，避免不同页面读取出不同结果。
- 主页仍然通过 `buildCreatorStoryboard(profile)` 生成与导演台一致的影片，不维护第二套叙事。

## 7. 另一端 Agent 应同步的文件白名单

只同步以下文件：

```text
src/app/onboarding/page.tsx
src/app/video/page.tsx
src/app/profile/page.tsx
src/features/mediaLibrary.ts
src/features/mediaNarrative.ts
src/features/profileMediaBindings.ts
src/features/profile.ts
src/remotion/storyboard.ts
docs/PERSONAL_PROFILE_VIDEO_SYNC.md
```

如果另一端分支已经改动这些文件，应人工合并个人主页逻辑，不要直接覆盖整文件。

## 8. 明确禁止覆盖的社区范围

不要因为同步本提交而替换或回退以下内容：

```text
src/city/**
src/app/city/**
src/app/collaboration/**
src/app/intelligence/**
src/app/leaderboard/**
src/app/projects/**
src/app/skills/**
src/services/agentNetwork.ts
src/data/cityFacilities.ts
src/city/config/**
public/assets/city/**
```

也不要覆盖另一端新增的 Debate、社区地图、建筑、NPC、Agent、榜单、资讯、黑客松、论坛或功能大厅实现。

## 9. 推荐同步方式

本次 Git 提交只包含个人主页影片支线文件。另一端优先使用：

```bash
git fetch origin
git cherry-pick <个人主页影片修复提交哈希>
```

如果发生冲突，只处理第 7 节白名单中的文件。不得通过 `git checkout --theirs .` 或整体目录覆盖来解决冲突。

## 10. 给另一端 Agent 的直接任务说明

可直接发送以下内容：

```text
请只同步 Creator City 的个人主页影片支线，不修改或回退你已经完成的社区地图、社区大厅、建筑布局、功能页面和 Agent 代码。

需要同步的目标：
1. GitHub 再导入改为合并项目，保留旧项目 ID、用户手填信息和视频绑定。
2. 自动修复历史 Profile 中失效的项目—媒体关系。
3. 简历对应项目段落、素材评论和视频时间点共同参与叙事。
4. 删除“待补充”“职责待补充”等无依据填充；缺少信息时减少章节并增加真实视频展示。
5. 项目视频必须进入 Storyboard，安排多个较长片段和必要的全屏证据镜头。
6. 视频丢失、未绑定或未进入分镜时，导演台明确报错并禁止生成纯 Motion 成片。
7. 个人主页、导演台和资料页统一使用修复后的 UserProfile 与同一套 Storyboard。

只处理 docs/PERSONAL_PROFILE_VIDEO_SYNC.md 第 7 节列出的文件。第 8 节社区范围全部保持你当前分支版本。
```

## 11. 验收清单

同步完成后至少检查：

- 上传一个项目视频并绑定项目，刷新资料页后绑定仍存在。
- 再次导入 GitHub，项目视频不会消失。
- 打开导演台，视频显示“可用于 Remotion 节选”。
- Storyboard 中存在多个真实视频片段，而不是只有纯 Motion。
- 评论中的 `00:12` 等时间点会改变实际节选位置。
- 资料不完整时不会出现“待补充”“职责待补充”等文字。
- 视频原文件被删除时，导演台禁止渲染并给出明确提示。
- 个人主页与导演台使用同一份用户信息和同一套影片编排。
- 社区地图、建筑、NPC、Debate 和其他大厅功能保持另一端版本不变。
- 运行 `npm run typecheck`、`npm run build` 和 `npm run remotion:still`。

