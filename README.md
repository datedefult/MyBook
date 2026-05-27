# MyWork

一个基于 Electron + React + TypeScript 构建的桌面工作管理应用。

## 致谢

本项目基于 [WorkPulse](https://github.com/dobest1024/WorkPulse) 进行二次开发，感谢原作者的优秀工作！

## 功能特性

- 任务看板管理
- 工作记录追踪
- 数据统计报告
- 多语言支持
- 暗色模式

## 技术栈

- Electron
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Better-sqlite3
- Electron Vite

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
# 构建 Windows 版本
npm run dist:win

# 构建 macOS 版本
npm run dist:mac

# 构建 Linux 版本
npm run dist:linux
```

## 项目结构

```
WorkPulse-self/
├── src/
│   ├── main/       # 主进程代码
│   ├── preload/    # 预加载脚本
│   └── renderer/   # 渲染进程代码
├── resources/      # 资源文件
├── out/            # 编译输出
└── build-output/   # 构建产物
```

## License

本项目沿用原项目的 [MIT License](https://github.com/dobest1024/WorkPulse/blob/main/LICENSE)。

Copyright © 2026
