# 开发与试运行

当前交付为 P00 技术原型（0.0.1），面向 Windows x64。无需 API Key、账号、Python、模型或语音文件。首次安装开发依赖需要网络；构建完成后的桌宠可离线运行。

## 环境与首次运行

- Windows 11 x64；已测单屏 150% 缩放，其他环境见[验收记录](verification/P00.md)。
- Node.js 24.x（已测 24.16.0）、npm 11.x、Git、系统自带 Windows PowerShell 5.1。
- 普通用户权限即可，不需要管理员权限。

在项目根目录运行：

```powershell
npm ci
npm run setup:runtime
npm run build
npm start
```

`npm ci` 按锁文件安装依赖；`setup:runtime` 获取当前锁定版本的 Windows x64 Electron，并按 npm 包中附带的 SHA-256 校验后解压。下载缓存位于 `.local/tools`，不会提交 Git。

GitHub 下载较慢时可以明确选择镜像，校验规则相同：

```powershell
npm run setup:runtime -- -Source mirror
```

安装器支持官方 GitHub 和 npmmirror 两种来源；校验失败会停止。失败下载保留 `.partial` 文件，下次重新下载。网络及镜像可用性取决于本机环境。

## 日常操作

启动后会出现桌面角色“小芽”和原型控制台。

- 单击角色：播放问候；按住角色拖动：移动位置，松开后保存。
- 双击／右键角色，或点角色下方的 `···`：打开控制台。
- 透明空白和气泡不拦截下方窗口；角色图形及按钮可交互。
- 控制台可以试播四种动作、切换置顶和“安静展示”。安静展示仅隐藏气泡，P01 的三种互动模式尚未加入。
- 关闭控制台后桌宠继续运行。点系统托盘图标重新打开；右键托盘可找回桌宠、恢复角色或退出。
- “原型检查”可试输入中文、模拟素材缺失、恢复素材与退出。输入框不发送、不保存文本。
- 只启动桌宠：`npm start -- --pet-only`。

默认用户数据为 `%APPDATA%\TablePetTB\settings.json`，保存位置、置顶和气泡显示设置。损坏的 JSON 会另存为 `.corrupt-时间戳`，然后恢复默认值。退出前会完成待写入设置。角色源文件与构建目录不承担用户数据存储。

## 开发与检查

```powershell
npm run dev
npm run typecheck
npm test
npm run build
npm run test:desktop
npm run benchmark
node scripts/benchmark-interaction.mjs
```

开发命令运行 Vite 与 Electron；修改前端可热更新。结束时从托盘退出并在终端按 Ctrl+C。生产试运行前重新执行 `npm run build`，避免保留开发构建。

`npm test` 是坐标、命令与持久化单元测试。`test:desktop` 需要构建产物和可见、未锁屏的 Windows 桌面；无需另装 Playwright 浏览器。它会打开自己的窗口，并短暂移动鼠标检查穿透、点击与拖动。鼠标需暂时保持空闲；点击前会核对目标窗口属于本测试，发现外部窗口或位置变化即停止该操作。

`benchmark` 默认运行五次启动和约 10 分 20 秒待机。在独立测试实例中固定待机动作和单窗口，不响应拖动、动作或打开控制台；托盘仍可提前退出（提前结束的结果不作为完整验收）。每条样本验证窗口数和动作，防止把意外打开控制台后的占用当作仅桌宠基线。普通启动不受此限制。

`benchmark-interaction.mjs` 测量 60 秒控制台动作操作。期间保持屏幕唤醒、避免遮挡角色；记录其他程序负载，比较时使用同样条件。结果写入 `.local/verification`。GPU 读取 Windows 性能计数器，若系统无法提供则明确记录缺口；它不是整机 GPU 占用。

高级验证环境变量（不影响默认使用）：

| 变量 | 用途 |
|---|---|
| `TB_DATA_DIR` | 指定独立测试数据目录 |
| `TB_TEST_MODE=1` | 测试用主进程入口与多实例，不供正式运行使用 |
| `TB_BENCHMARK_DIR` | 输出就绪时间和资源记录 |
| `TB_BENCHMARK_IDLE=1` | 仅同时启用测试模式和采样目录时生效，固定待机测量场景 |

## 工程入口

| 目录 | 职责 |
|---|---|
| `src/main` | Windows 窗口、托盘、受控命令、设置与生命周期 |
| `src/preload` | 隔离的窗口通信桥，不暴露 Node.js |
| `src/renderer` | 桌宠、动态 SVG、控制台与样式 |
| `src/core` | 可单独验证的坐标与数据规则 |
| `src/shared` | 主进程与界面的类型契约 |
| `resources` | 测试角色清单和托盘图标 |
| `tests`、`scripts` | 单元／桌面测试、运行与性能工具 |

当前无安装包、自动更新、正式聊天面板、API、本地模型、提醒或截图功能。安装包按 P06 实施；本原型不是正式发行版。
