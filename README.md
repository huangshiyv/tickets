# 逐光 · Sun Atlas

一个可部署到 GitHub Pages 的太阳地图应用。独立界面实现，使用 Leaflet 1.9.4、SunCalc 1.9.0 和 Three.js 0.170.0（许可保留在 `site/vendor`），无需 Node.js 后端或 API 密钥。

## 功能

- 点击地图、拖动标记、搜索地点、输入经纬度或浏览器定位。
- 选择日期、固定 UTC 偏移与一天中的时间，分享带参数的链接。
- 太阳方位角、高度角、日出日落方向、白天太阳方向弧线。
- 日出、日落、太阳正午、晨昏、日照时长和傍晚黄金时段。
- 物体阴影方向与长度，极昼和极夜提示，手机布局。
- 3D 日照视图：可旋转的示意建筑、太阳高度角、平行入射光线与实时阴影；支持侧视、俯视和手机双指缩放，与地图的地点、日期、时间及物体高度同步。

## 3D 日照

点击地图上方的 **3D 日照**，拖动旋转视角，滚轮或双指缩放。**侧面看角度** 展示阳光和地面的夹角，**俯视阴影** 查看投影方向；拖动时间轴或更改物体高度可观察变化。夜间隐藏直射光线和太阳。点击 **二维地图** 可继续选点；分享链接会保留 3D 显示模式。

场景为平地和示意建筑，不包含真实城市建筑或地形。太阳方位和高度按当前地点与时间计算；建筑高于 18 米时场景等比例缩小单位，超长阴影可能超出地面范围。适合直观理解照射角度，不作为真实建筑遮挡分析。
Three.js 在首次打开 3D 时从本站加载，无外部 3D 服务或密钥。浏览器需支持 WebGL2，不可用时会提示并允许返回二维地图。按需绘制，二维模式不持续渲染 3D 场景。

地图上的方向弧线使用固定半径表示方位变化，不表示太阳实际空间轨道；虚线表示日出日落方向，橙线表示当前太阳方向，灰绿虚线表示阴影方向。
首次打开默认使用浏览器当前的 UTC 偏移、当地日期和时间（包含浏览器当前生效的夏令时）；分享链接中的设置优先恢复。支持半小时和 45 分钟时区。后续计算使用所选固定 UTC 偏移，不根据观测地点或所选日期自动调整夏令时；跨日期事件标注 `+1日` / `-1日`。位置或季节变更后请确认时区。
计算适合摄影与日常规划，不考虑地形遮挡，不用于精密测量。

## 本地运行

```bash
python3 -m http.server 8000 --directory site
```

访问 `http://localhost:8000`。所有前端依赖已放入 vendor，无需安装或构建。

## 地图和搜索

地图瓦片访问 `tile.openstreetmap.org`，地点搜索访问 `nominatim.openstreetmap.org`，需要网络且受服务使用政策和可用性限制。搜索仅在提交时发起，无自动补全；不要用于批量请求。较大规模部署应更换为有相应配额的服务或自行托管。

- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/nominatim/

查询词会发给 Nominatim；地图瓦片请求会透露浏览区域。浏览器定位需用户授权和 HTTPS（或 localhost）；授权后的坐标用于本地太阳计算和地图显示，不自动发送给地点搜索。
外部服务失败时仍可输入坐标并进行太阳计算，页面会显示提示。

## 部署

在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
推送到 `main` 后自动部署；也可从 **Actions → Deploy GitHub Pages** 手动运行。
成功后的网址：https://huangshiyv.github.io/tickets/

## PR 预览与检查

新建 PR 或向 PR 推送提交后，**PR page preview** 自动运行桌面/手机浏览器测试，检查太阳事件、时间轴、阴影、极昼极夜、模拟搜索、分享状态恢复与横向溢出，以及 3D 实际渲染、旋转、侧视/俯视、建筑高度、昼夜变化和 WebGL 不可用时的回退。

在对应 Actions 运行的 **Artifacts** 下载 `homepage-preview-*`，解压后可查看 `desktop.png`、`mobile.png` 和 `desktop-3d.png`、`mobile-3d.png`；网页预览应在解压目录运行 `python3 -m http.server 8000` 并打开浏览器（包含 JS/CSS/vendor，不能只复制 HTML）。下载需登录，保留 14 天，没有 PR 独立在线链接。

本地执行相同检查（在仓库外安装测试依赖，不修改项目依赖文件）：

```bash
npm install --prefix /tmp/solar-tools --no-package-lock playwright@1.64.1
/tmp/solar-tools/node_modules/.bin/playwright install chromium
# 另一个终端先启动上述 Python HTTP 服务器
NODE_PATH=/tmp/solar-tools/node_modules node tests/preview.cjs
```

可以用 `CHROMIUM_PATH` 指定现有 Chromium，用 `PREVIEW_DIR` 指定截图输出目录。
