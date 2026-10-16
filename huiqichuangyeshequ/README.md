# 惠企创业社区 · 3D 大厦

静态网站，无需构建。把本文件夹整体上传到 GitHub Pages 仓库根目录即可访问 index.html。

- index.html：页面本体，3D 模型用 Three.js 0.160（从 cdn.jsdelivr.net 加载）
- assets/：社区实景照片（已压缩），带 -s 的是缩略图

修改空间文字或照片：编辑 index.html 中 `window.SPACES`（实景空间）和 `window.FLOORS`（楼层功能分布）。
本地预览：在本文件夹运行 `python3 -m http.server`，打开 http://localhost:8000
