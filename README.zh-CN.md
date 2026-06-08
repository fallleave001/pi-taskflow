<div align="center">

<img src="./assets/hero.png" alt="pi-taskflow — declarative DAG orchestration for Pi subagents: stateful, resumable, context-isolated" width="900">

<p>
  <a href="https://www.npmjs.com/package/pi-taskflow"><img src="https://img.shields.io/npm/v/pi-taskflow?style=flat-square&color=B692FF&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/pi-taskflow"><img src="https://img.shields.io/npm/dm/pi-taskflow?style=flat-square&color=6E8BFF&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-43D9AD?style=flat-square" alt="MIT license"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/runtime%20deps-0-43D9AD?style=flat-square" alt="zero runtime dependencies"></a>
  <a href="https://github.com/heggria/pi-taskflow/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/heggria/pi-taskflow/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/tests-394-6E8BFF?style=flat-square" alt="394 tests"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/dogfooded-%E2%9C%93-43D9AD?style=flat-square" alt="dogfooded"></a>
  <a href="https://pi.dev"><img src="https://img.shields.io/badge/for-Pi%20coding%20agent-B692FF?style=flat-square" alt="for the Pi coding agent"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="./README.hi.md">हिन्दी</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.ar.md">العربية</a>
</p>

<p><strong>为 <a href="https://pi.dev">Pi</a> 子代理（subagents）提供的声明式 DAG 编排。</strong><br/>
发散（fan out）· 门控（gate）· 恢复（resume）· 保存为命令——中间结果始终远离你的上下文（context）。</p>

```bash
pi install npm:pi-taskflow
```

</div>

---

[English](../README.md) | **简体中文** | [हिन्दी](../README.hi.md) | [Español](../README.es.md) | [العربية](../README.ar.md)

---

**子代理（subagents）是发射后不管的（fire-and-forget）。而任务流（taskflows）可以发射、发散、暂停、门控、恢复，并把自己保存为一条命令。**

你已经熟悉内置子代理工具的 `task` / `tasks` / `chain` 了。`pi-taskflow` 使用**相同的**简写方式——所以你现有的委托任务瞬间就变得**可追踪、可恢复、可保存为一条 `/tf:<name>` 命令**。当你超出简写的极限时，完整的 DSL 提供了真正的 DAG：对数十个条目进行动态发散、条件路由、质量门控、人工审批、重试，以及硬性的消费上限。

而整个过程，**只有最终的阶段（phase）会进入你的对话。** 所有中间转录结果都留在运行时（runtime）里，从不占用你的上下文窗口（context window）。

## 为什么存在这个项目

使用原始的子代理时你会撞上这样的墙：你用自然语言描述一个多步骤计划，模型每次运行都要重新推导，中间过程的转录结果淹没你的上下文，而一旦某次模型调用失败，你就要从零开始。没有复用，没有恢复，没有结构。

`pi-taskflow` 把计划**从提示词（prompt）中移出来，放进了声明式定义里。** 运行时拥有 DAG、循环、重试和中间状态。你只需声明一次管线（pipeline），就可以按名字运行它一百次。

<div align="center">
<img src="./assets/context-isolation.png" alt="使用原始子代理时，所有转录结果都会淹没上下文；使用 pi-taskflow 时，转录结果留在运行时中，只有最终结果返回" width="900">
</div>

> 当一个任务需要十二个步骤、带有分支发散和一个评审门控时，你需要的是编排（orchestration），而不是靠运气写提示词。

| | subagent（内置） | **pi-taskflow** |
|---|---|---|
| **谁来驱动** | 模型，一步接一步 | 运行时，依据定义 |
| **拓扑结构** | 链式 / 扁平并行 | **DAG——分层并发 + 路由** |
| **中间结果** | 在你的上下文窗口中 | **在运行时中——不在你的上下文里** |
| **规模** | 少量任务 | **`map` 动态发散，覆盖数十个条目** |
| **可复用性** | 每次重新描述 | **保存为 `/tf:<name>`** |
| **可恢复性** | ✗ | **✓ 跨会话——已缓存的阶段自动跳过** |
| **质量门控** | ✗ | **`gate` 阶段，发出 `VERDICT: BLOCK` 即中止** |
| **条件路由** | ✗ | **`when` 守卫 + `join: any` 或-连接** |
| **容错** | ✗ | **逐阶段 `retry` + 临时错误自动重试** |
| **人工介入** | ✗ | **`approval` 阶段（审批 / 驳回 / 编辑）** |
| **成本控制** | ✗ | **全局 `budget`（美元 / token 上限）** |
| **组合** | ✗ | **`flow` 阶段运行已保存的子流** |
| **实时进度** | 运行时不可见 | **实时 DAG 渲染，含耗时和成本** |
| **使用体验** | 每次内联 JSON | **简写（`task`/`tasks`/`chain`）*或* DSL** |

它并没有取代子代理工具。它给你的子代理赋予了一个 DAG、一段记忆（memory）和一个名字（name）。

## 与其他 Pi 扩展的对比

> 📖 完整文档请参阅 [English README](../README.md)

## 30 秒快速上手

**1. 安装**——一条命令：

```bash
pi install npm:pi-taskflow
```

> **可选：** 运行一次 `/tf init` 来将 18 个内置代理的模型角色（`fast`、`strong`、`thinker`……）映射到你自己的模型上——交互式选择器。跳过的话，代理会直接使用 Pi 的默认模型。详见 [Model roles](#model-roles)。

**2. 运行**——在 Pi 会话中直接对模型说：

> *运行一个链：先检查认证流程，然后总结发现。*

模型会自动调用 `taskflow` 工具。你会看到实时进度、每步耗时、token 成本和一条已保存的运行记录——**与内置工具同样的操作，但现在是可追踪和可恢复的了。**

**3. 保存**——说一句 *"保存它"*，你就永久拥有了 `/tf:<name>`。

就这样。在你咖啡凉下来之前，你就可以运行第一个工作流了——不需要写任何阶段定义。

### 简写（与内置工具形状相同）

```jsonc
// 单任务——一个代理，一个任务
{ "task": "Summarize the architecture of src/", "agent": "explorer" }

// 并行——同时发射多个，输出合并
{ "tasks": [
  { "task": "Audit auth in src/api",             "agent": "analyst" },
  { "task": "Audit input validation in src/api", "agent": "analyst" }
] }

// 链式——顺序执行；每一步都能看到上一步的输出
{ "chain": [
  { "task": "List the public API of src/lib", "agent": "scout" },
  { "task": "Write docs for:\n{previous.output}", "agent": "writer" }
] }
```

`agent` 是可选的（默认使用第一个发现的代理）。加上 `name` 可以给运行打标签，并解锁保存为命令的功能。

> 📖 完整文档请参阅 [English README](../README.md)

## 🍽️ 我们吃自己的狗粮

`pi-taskflow` 的每一个功能都是**通过 `pi-taskflow` 自己**发布的。

我们的 `self-improve` 流是一个 10 阶段的 DAG——它审计代码库、修补缺陷、验证正确性、在质量门控处拦截、并生成报告——全部以声明式方式完成。它被保存为 `/tf:self-improve`，每次发布前都会运行。Pi 生态中没有任何其他代理编排器是用自己构建自己的。

| 战役 | 规模 | 阶段数 | 成果 |
|----------|-------|--------|---------|
| [v0.0.8 狗粮行动](./docs/dogfooding-v0.0.8-report.md) | 全代码库审计 → 分类 → 修复 → 验证 | 10 阶段，234 项测试 | 13 处修复，全部通过 |
| [v0.0.6 自我审计](./docs/self-audit-report.md) | 资产盘点 → 映射审计 → 门控 → 审批 → 映射修复 → 归约 | 9 阶段 | 修复 11 个关键缺陷 |
| [跨运行缓存狗粮行动](./docs/rfc-cross-run-memoization.md) | 真实运行时 + 磁盘存储 | 专用测试套件 | 对抗性指纹下的缓存正确性验证 |
| [对抗性交叉评审](./docs/brainstorm-adversarial-review-report.md) | 多代理对抗性评审 | `tournament` + `gate` | P0 级缓存键修复已发布 |
| [初始化设计重审](./docs/issue-necessity-review-report.md) | 必要性审计 → 并行检查 → 判定 | 7 阶段 | 完整重设计计划已验证 |

> **元注释：** 我们用 `pi-taskflow` 自己的 `map` 发散、`gate` 判定、`approval` 人工介入、`tournament` 择优、`loop` 循环至完成、以及 `cross-run` 缓存——来构建 `pi-taskflow` 本身。

## What's inside

<div align="center">

**0 运行时依赖** · **394 项测试** · **10 种阶段类型** · **跨会话恢复** · **跨运行备忘** · **~4.9k LOC 运行时**

</div>

> 📖 完整文档请参阅 [English README](../README.md)

---

**如果这个项目为你省下了一个上下文窗口，请在 GitHub 上点个 ⭐——这真的能帮到我们。**