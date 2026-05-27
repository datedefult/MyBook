# MyWork - UI/设计文档

## 设计系统

### 设计理念

MyWork 的设计遵循以下原则：

- **简洁高效**：界面简洁，功能直观
- **现代美观**：采用现代化的设计风格
- **双主题支持**：完整支持浅色/深色主题
- **响应式交互**：流畅的动画和交互反馈

---

## 颜色系统

### 主色调

#### 蓝色 (Primary)
- **主色**: `#3B82F6` (blue-500)
- **悬停**: `#2563EB` (blue-600)
- **按下**: `#1D4ED8` (blue-700)
- **浅色背景**: `#EFF6FF` (blue-50)
- **深色背景**: `#1E3A8A` (blue-900/30)

用途：主按钮、链接、活跃状态、品牌色

### 功能色

#### 成功 (Success)
- **主色**: `#10B981` (emerald-500)
- **浅色**: `#D1FAE5` (emerald-100)

#### 警告 (Warning)
- **主色**: `#F59E0B` (amber-500)

#### 错误 (Error)
- **主色**: `#EF4444` (red-500)
- **浅色**: `#FEF2F2` (red-50)

### 中性色

#### 浅色主题
- **背景**: `#FFFFFF`
- **次要背景**: `#F9FAFB`
- **边框**: `#E5E7EB` (slate-200)
- **主文字**: `#111827` (slate-900)
- **次要文字**: `#6B7280` (slate-500)
- **占位文字**: `#9CA3AF` (slate-400)

#### 深色主题
- **背景**: `#020617` (slate-950)
- **次要背景**: `#0F172A` (slate-900)
- **边框**: `#334155` (slate-700/50)
- **主文字**: `#F9FAFB` (slate-50)
- **次要文字**: `#94A3B8` (slate-400)
- **占位文字**: `#475569` (slate-500)

### 标签配色

标签颜色根据标签名自动分配，使用以下预定义颜色：

```javascript
const TAG_COLORS = [
  '#3B82F6',   // blue
  '#10B981',   // emerald
  '#F59E0B',   // amber
  '#EF4444',   // red
  '#8B5CF6',   // violet
  '#EC4899',   // pink
  '#06B6D4',   // cyan
  '#F97316',   // orange
  '#14B8A6',   // teal
  '#6366F1'    // indigo
];
```

标签样式：
- 背景：颜色的浅色背景 (如 `bg-blue-100`)
- 文字：对应深色 (如 `text-blue-600`)
- 圆角：`rounded-md`
- 内边距：`px-2 py-0.5`
- 字号：`text-xs font-medium`

---

## 排版系统

### 字体

- **默认**: 系统默认 sans-serif 字体
- **等宽**: `font-mono` (用于代码、快捷键等)

### 字号层级

| 名称 | 字号 | 行高 | 用途 |
|------|------|------|------|
| text-xl | 1.25rem | 1.75rem | 页面标题 |
| text-base | 1rem | 1.5rem | 正文内容 |
| text-sm | 0.875rem | 1.25rem | 次要文字 |
| text-xs | 0.75rem | 1rem | 辅助文字、标签 |

### 字重

- **常规**: `font-normal` (400)
- **中等**: `font-medium` (500)
- **加粗**: `font-semibold` (600)

---

## 间距系统

使用 Tailwind CSS 标准间距：

```
0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
```

### 常用间距

- **组件间距**: `gap-3`, `gap-4`
- **内边距**: `p-3`, `p-4`, `px-4`, `py-3`
- **外边距**: `mb-4`, `mt-2`

---

## 圆角系统

| 类名 | 大小 | 用途 |
|------|------|------|
| rounded-md | 0.375rem | 按钮、卡片 |
| rounded-lg | 0.5rem | 输入框、弹窗 |
| rounded-xl | 0.75rem | 页面卡片、容器 |

---

## 阴影系统

| 类名 | 效果 | 用途 |
|------|------|------|
| shadow-sm | 轻微阴影 | 卡片、输入框 |
| shadow-md | 中等阴影 | 按钮悬停、弹窗 |
| shadow-lg | 大阴影 | 拖拽中、悬浮元素 |

---

## 组件设计规范

### 按钮 (Button)

#### 主按钮 (Primary)
```jsx
<button className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg px-6 py-2.5 shadow-md hover:shadow-lg transition-all duration-150">
```

#### 次要按钮 (Secondary)
```jsx
<button className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg px-4 py-2.5 transition-all duration-150">
```

#### 图标按钮 (Icon Button)
```jsx
<button className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-all duration-150">
```

### 输入框 (Input)

#### 文本输入框
```jsx
<input className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 dark:hover:border-slate-600 outline-none transition-all duration-150" />
```

#### 文本域 (Textarea)
```jsx
<textarea className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 dark:hover:border-slate-600 outline-none transition-all duration-150 resize-none" />
```

#### 选择器 (Select)
```jsx
<select className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 cursor-pointer" />
```

### 卡片 (Card)

#### 标准卡片
```jsx
<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-150">
```

#### 日志卡片
```jsx
<div className="group p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-150">
```

#### 任务卡片 (Kanban Card)
```jsx
<div className="group flex items-start gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer">
```

### 标签 (Tag Badge)

```jsx
<span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
```

### Toast 提示

#### 成功提示
```jsx
<div className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-sm animate-fade-in-up z-10 shadow-lg">
```

#### 错误提示
```jsx
<div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 max-w-2xl w-full">
```

---

## 页面布局

### 整体结构

```
┌─────────────────────────────────────────┐
│          Header (导航栏)                  │
├─────────────────────────────────────────┤
│                                         │
│          Main Content                   │
│          (主内容区)                      │
│                                         │
└─────────────────────────────────────────┘
```

### 导航栏 (Header)

高度：自适应内容，使用 `py-3`

布局：
- 左侧：导航按钮组
- 右侧：设置按钮

样式：
```jsx
<header className="flex items-center justify-between px-6 py-3 border-b border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
```

### 导航按钮

选中状态：
```jsx
<button className="bg-blue-500 text-white shadow-md relative">
```

未选中状态：
```jsx
<button className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200">
```

---

## 页面设计

### 工作日志页面 (Work Log Page)

#### 顶部输入区域
```
┌─────────────────────────────────────────┐
│  [输入框] #标签 #标签                     │
│  [+备注] [AI] [×] [发布]                 │
└─────────────────────────────────────────┘
```

#### 筛选侧边栏
- 可折叠设计
- 默认折叠状态只显示图标
- 展开宽度：280px

#### 主内容区
- 搜索栏
- 工具栏（展开/折叠、导出）
- 日志列表（按日期分组）

### 看板页面 (Kanban Page)

#### 布局
```
┌───────────────────────────────────┬─────┐
│  [快速添加任务输入框]              │     │
├─────────┬──────────┬─────────────┤草稿 │
│  待办   │ 进行中   │  已完成     │ 箱  │
├─────────┼──────────┼─────────────┤     │
│ [卡片]  │ [卡片]   │ [卡片]      │     │
│ [卡片]  │          │ [卡片]      │     │
└─────────┴──────────┴─────────────┴─────┘
```

#### 看板列
- 宽度：等分布局 `flex-1`
- 列标题：包含计数 badge
- 默认显示：最多 5 条任务
- 拖拽区域：全列可拖放

#### 草稿箱侧边栏
- 可折叠
- 展开宽度：280px
- 包含草稿输入和列表

### 报告页面 (Report Page)

#### 生成区域
- 时间范围选择
- 生成按钮
- 加载状态

#### 报告展示
- Markdown 预览
- 编辑模式
- 操作按钮（保存、复制、导出）

### 统计页面 (Stats Page)

#### 布局
```
┌─────────────────────────────────────────┐
│  [统计卡片1] [统计卡片2] [统计卡片3] [统计卡片4] │
├─────────────────────────────────────────┤
│  [标签统计]    │    [活动柱状图]        │
├─────────────────────────────────────────┤
│  [热力图]      │    [任务趋势图]        │
└─────────────────────────────────────────┘
```

#### 统计卡片
```jsx
<div className="flex items-start gap-2.5 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
    <Icon />
  </div>
  <div>
    <div className="text-xl font-bold">{数字}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{描述}</div>
  </div>
</div>
```

### 设置页面 (Settings Page)

#### 布局
- 全屏滚动页面
- 分区展示设置项
- 每个区域有标题和分隔线

#### 设置区块样式
```jsx
<section className="mb-8">
  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">区块标题</h2>
  <div className="h-px bg-slate-200 dark:bg-slate-700 mb-5" />
  {/* 设置内容 */}
</section>
```

---

## 动画与交互

### 过渡动画

使用统一的过渡时间：
- **快速**: `duration-150`（按钮悬停、状态切换）
- **中等**: `duration-300`（侧边栏折叠、页面切换）

常用过渡属性：
```jsx
transition-all duration-150
transition-all duration-300 ease-in-out
```

### 动画效果

#### 淡入上移
```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fade-in-up 0.2s ease-out; }
```

#### 弹出效果
```css
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-pop-in { animation: pop-in 0.2s ease-out; }
```

#### 数字滚动
用于统计数字，从 0 滚动到目标值。

### 拖拽效果

使用 `@dnd-kit` 实现：
- 拖拽中：半透明 `opacity-50`，放大 `scale-102`，大阴影 `shadow-lg`
- 放置区：放置目标高亮 `bg-blue-50 dark:bg-blue-900/20`，边框 `ring-2 ring-blue-300 dark:ring-blue-700`

### 悬停反馈

- **可点击元素**：背景色变化
- **按钮**：阴影增强
- **卡片**：阴影增强
- **图标**：颜色变化

---

## 深色模式

### 切换机制

使用 Tailwind CSS 的 `dark:` 前缀策略，通过 `<html>` 标签的 `dark` 类控制。

### 实现要点

1. **背景适配**: 所有背景都要有深色对应
2. **文字适配**: 文字颜色使用 `-50` 到 `-900` 调色板
3. **边框适配**: 边框使用半透明或深色对应色
4. **阴影适配**: 深色模式阴影调整或移除

### 示例模式

```jsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
```

---

## 响应式设计

### 窗口尺寸

应用为桌面 Electron 应用，推荐最小窗口尺寸：
- **最小宽度**: 960px
- **最小高度**: 600px

### 布局策略

- 使用 Flexbox 布局
- 可折叠侧边栏适应空间
- 图表自适应容器尺寸

---

## 图标系统

### 图标库

使用 **Lucide React** 图标库，保持图标风格一致。

### 图标大小

- **导航栏**: `w-5 h-5`
- **按钮**: `w-4 h-4`
- **卡片操作**: `w-4 h-4`
- **统计卡片**: `w-4 h-4`

### 常用图标

| 名称 | 用途 |
|------|------|
| ClipboardList | 工作日志 |
| Columns3 | 看板 |
| FileText | 报告 |
| BarChart3 | 统计 |
| Settings | 设置 |
| Plus | 添加 |
| X | 关闭/清除 |
| Search | 搜索 |
| Download | 导出 |
| Calendar | 日期 |
| Edit/Pencil | 编辑 |
| Trash2 | 删除 |
| Check | 确认 |
| ArrowLeft | 返回 |
| ChevronRight/Left | 展开/折叠 |
| Moon/Sun/Monitor | 主题切换 |
| Eye/EyeOff | 显示/隐藏 |
| RotateCcw | 重置/恢复 |
| Keyboard | 快捷键 |
| Sparkles | AI/优化 |
| Flame | 连续记录/热门 |
| CheckCircle2 | 完成 |
| ListTodo | 待办 |
| TrendingUp/Down | 趋势 |
| Info | 信息 |
| FolderOpen | 文件夹 |
---

## 可访问性

### 语义化 HTML

- 使用合适的 HTML 标签
- 按钮使用 `<button>`
- 输入框关联 `<label>`

### 键盘导航

- 所有交互元素支持 Tab 聚焦
- 支持 Esc 关闭弹窗
- 支持 Enter 确认操作
- 支持方向键导航（日历等）

### 焦点样式

```css
.focus-visible:outline-none
.focus-visible:ring-2
.focus-visible:ring-blue-500
.focus-visible:ring-offset-2
```

### 颜色对比度

确保文字与背景对比度符合 WCAG AA 标准：
- 正文：至少 4.5:1
- 大文字：至少 3:1

---

## 设计资源

### Tailwind 配置

项目使用标准 Tailwind CSS 配置，通过 `tailwind.config.js` 自定义。

### 类名约定

使用 Tailwind CSS 工具类，按以下顺序组织：
1. 定位与布局 (position, display, flex, grid)
2. 盒模型 (width, height, padding, margin, border)
3. 排版 (font, text, line-height)
4. 颜色 (bg, text, border-color)
5. 效果 (shadow, opacity, transition)
6. 交互 (hover:, focus:, dark:)

示例：
```jsx
<button className="flex items-center gap-2 px-6 h-9 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150">
```

---

## 开发规范

### 组件命名

- PascalCase：组件名
- camelCase：Props、state、函数
- kebab-case：CSS 类名

### 组件结构

```jsx
import { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';
import { useSomeStore } from '@/stores/some-store';
import { useI18n } from '@/stores/language-store';

interface Props {
  someProp: string;
}

export function ComponentName({ someProp }: Props): JSX.Element {
  const [state, setState] = useState('');
  const { t } = useI18n();
  
  // 逻辑代码
  
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

### 样式优先原则

优先使用 Tailwind CSS 工具类，只在必要时使用 `className` 或 CSS modules。

---

## 更新日志

### 设计变更记录

- v0.1.0: 初始设计版本
