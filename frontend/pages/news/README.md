# 岗位大新闻 · 资讯中心

一份面向年轻用户、大学生与求职者的「未来就业市场数字报纸」。
本模块是一个**独立产品模块**，不依赖「执图破局」平台的 shell / 导航 / 定位。

## 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 首页 | `index.html` | 今日头版 / 热门岗位资讯 / 新职业 / 行业岗位变化 / 全部资讯 |
| 详情页 | `detail.html?id=n001` | 正文阅读 + 关键数据 + 岗位信息 + AI 解读 + 相关资讯 |

## 运行

直接打开 `index.html` 即可（纯静态，无需构建）。也可用任意静态服务器托管本目录：

```bash
cd frontend/news
python -m http.server 8080
# 访问 http://localhost:8080/index.html
```

## 结构

```
news/
├─ index.html          首页
├─ detail.html         详情页
├─ css/news.css        独立设计系统（配色 / 组件 / 响应式 / 动效）
└─ js/
   ├─ data.js          Mock 数据层（newsData / careerData / industryData / trendData / articleData / aiInsightData）
   ├─ common.js        共享工具（DOM / toast / count-up / 收藏 / 抽象视觉图 / 趋势图）
   ├─ home.js          首页渲染与交互
   └─ detail.js        详情页渲染与交互
```

## 说明

- 所有数字、趋势、来源均为**示例数据**，仅用于演示信息呈现方式，不代表真实统计或新闻来源，后续可通过 API 替换 `data.js`。
- AI 解读为「AI 分析」性质，**AI 分析 ≠ 新闻事实**。
- 收藏为前端 localStorage 状态，分享为 Mock 交互。
