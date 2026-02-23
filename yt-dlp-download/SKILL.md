---
name: yt-dlp-download
description: Download videos from 1000+ sites (YouTube, Bilibili, TikTok, etc.) using yt-dlp. Use when the user provides a video URL and wants to download it, or says "下载这个视频" / "download this video" / gives a link to download.
---

# yt-dlp 视频下载

基于 [yt-dlp](https://github.com/yt-dlp/yt-dlp)：命令行音视频下载工具，支持数千站点。

## 何时使用

- 用户发来一个视频链接并要求下载
- 用户说「下载这个视频」「把这个链接的视频下下来」等
- 用户提供 URL（YouTube、B站、抖音、Twitter 等）并希望保存到本地

## 快速流程

1. **确认 yt-dlp 可用**
   - 若未安装：`pip install yt-dlp` 或从 [Releases](https://github.com/yt-dlp/yt-dlp/releases) 下载 `yt-dlp.exe`（Windows）并放入 PATH。
   - 可选：安装 [FFmpeg](https://ffmpeg.org/) 以便合并音视频、转码。

2. **执行下载**
   - 用户提供 **单个 URL**：直接下载。
   - 命令模板：`yt-dlp <视频URL>`
   - 若用户指定了保存目录，使用：`yt-dlp -o "<目录>/%(title)s.%(ext)s" <URL>`

3. **常用选项（按需使用）**
   - 指定输出目录：`-P <目录>` 或 `-o "<目录>/%(title)s.%(ext)s"`
   - 仅音频并转 MP3：`-x --audio-format mp3`
   - 指定画质（如 720p）：`-f "bv*[height<=720]+ba/b"`
   - 带字幕：`--write-subs --sub-langs zh,en`

## 命令示例

```bash
# 默认下载（最佳画质，当前目录）
yt-dlp "https://www.youtube.com/watch?v=VIDEO_ID"

# 保存到指定目录
yt-dlp -o "D:/Videos/%(title)s.%(ext)s" "https://..."

# 只下音频并转为 MP3
yt-dlp -x --audio-format mp3 "https://..."
```

## 注意事项

- 下载前确认用户给的确实是**视频/音频页面 URL**，不要对非媒体链接执行下载。
- 若需登录（如会员专享），可提示用户使用 `--cookies-from-browser BROWSER` 或 `--username`/`--password`（见 yt-dlp 文档）。
- 遇到报错先执行 `yt-dlp -U` 更新，再重试。
