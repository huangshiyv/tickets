# tickets

使用 GitHub Pages 托管的 Hello World 静态网页，无需后端或密钥。

## 本地运行

```bash
python3 -m http.server 8000 --directory site
```

浏览器访问 `http://localhost:8000`。修改 `site/index.html` 后刷新。

## 开启 GitHub Pages（首次设置）

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 在 **Actions → Deploy GitHub Pages → Run workflow** 手动运行一次，或推送到 `main`。
3. 部署成功后访问 https://huangshiyv.github.io/tickets/ 。

以后推送或合并 PR 到 `main` 会自动更新正式网站。公开仓库可免费使用 Pages；私有仓库取决于 GitHub 套餐。

## 查看 PR 页面变化

新建、重新打开 PR 或向 PR 推送提交时，**PR page preview** 自动生成桌面与手机截图，并检查标题和横向溢出。

打开 PR 的 **Checks → PR page preview → Details**，进入 Actions 运行，在 **Artifacts** 下载 `homepage-preview-*`：

- `desktop.png`：桌面截图。
- `mobile.png`：手机截图。
- `index.html`：可在浏览器打开的网页。

需登录 GitHub 下载，保留 14 天。Fork PR 首次运行可能需要维护者批准。
这是下载式预览，不会为 PR 分配在线网址，也不自动生成与 main 的差异图。
