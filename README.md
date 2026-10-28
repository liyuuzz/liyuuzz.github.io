# Profunfis 个人网站

这是一个静态网站，发布在 GitHub Pages。正文集中在 `content.json`，修改后提交到 GitHub 的 `main` 分支即可触发网站更新；发布可能需要一点时间。

## 修改文字和新增内容

- 首页介绍：修改 `hero.lede`；关于页文字在 `about.body`。
- 新增作品：在 `works.items` 数组末尾添加一项，填写 `label`（分类）、`title`（标题）、`desc`（简述）、`detail`（详情）、`image`（图片路径）及 `href`。例如第四项的链接为 `work.html?w=4`。当前封面是概念示意图，可以替换成自己的截图。
- 新增笔记：在 `notes.items` 数组添加一项，填写 `date`、`title`、`excerpt`、`body`（段落数组）和 `href`。链接编号 `note.html?n=数字` 对应该条在数组中的位置，从 1 开始。插入、删除或排序后，要同步检查所有笔记链接；将来建议日期写完整年份。
- 图片放在 `assets/works/`，`image` 填写相对路径，例如 `assets/works/example.jpg`。确认有使用权限，控制文件大小。

JSON 的文字要放在双引号里；每项之间要有逗号，最后一项后不要加逗号。不要随意调整现有条目的顺序，因为详情页地址依赖位置编号。

## 本地预览和发布

在项目目录运行 `python -m http.server 8000`，然后在浏览器打开 `http://localhost:8000/`。不要直接双击 HTML 文件，否则内容加载可能受浏览器限制。检查首页、作品、笔记和详情页后，将修改提交并推送到 GitHub 的 `main` 分支；GitHub Pages 配置和发布状态可在仓库的 Settings → Pages 查看。
