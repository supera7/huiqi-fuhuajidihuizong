# 惠企共产小院 · 3D 网站

静态网站，无需构建。把本文件夹整体上传到任意静态托管（如 GitHub Pages 仓库根目录）即可访问 index.html。

- index.html：页面本体，3D 模型用 Three.js 0.160（从 cdn.jsdelivr.net 加载）
- assets/：功能区实景照片（带 -s 的是缩略图）、航拍 drone.mp4、宣传片 promo.mp4

修改楼栋位置：编辑 index.html 中 `window.BLD`（坐标取自亚龙别墅位置图的像素坐标）。
修改功能区文字、照片或视频：编辑 `window.SPACES`。
本地预览：在本文件夹运行 `python3 -m http.server`，打开 http://localhost:8000
