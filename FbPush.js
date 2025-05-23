console.log('✅ 本次部署版本：2025-05-23-晚間');
require('dotenv').config();
const axios = require('axios');
const line = require('@line/bot-sdk');
const fs = require('fs');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

const fbPages = [
  {
    id: process.env.FB1_PAGE_ID,
    token: process.env.FB1_PAGE_TOKEN
  },
  {
    id: process.env.FB2_PAGE_ID,
    token: process.env.FB2_PAGE_TOKEN
  }
];

const stateFile = './pushed_posts.json';
let pushedIds = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile))
  : [];

function cleanText(raw) {
  return (raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[^\x00-\x7F\u4E00-\u9FFF\s\p{P}]/gu, '')
    .trim();
}

async function fetchAndPush() {
  const userIds = process.env.LINE_USER_ID
    ? process.env.LINE_USER_ID.split(',').map(id => id.trim())
    : [];

  for (const page of fbPages) {
    const { id, token } = page;
    if (!id || !token) continue;

    try {
      const res = await axios.get(
        `https://graph.facebook.com/v18.0/${id}/posts?access_token=${token}&fields=message,permalink_url,created_time`
      );

      const posts = res.data.data || [];
      const newest = posts.find(p => p.message && !pushedIds.includes(p.id));
      if (!newest) continue;

      pushedIds.push(newest.id);
      fs.writeFileSync(stateFile, JSON.stringify(pushedIds, null, 2));

      const text = `📢 ${cleanText(newest.message)}\n👉 ${newest.permalink_url}`;
      console.log('🚀 推播內容：', text);

      for (const uid of userIds) {
        await client.pushMessage(uid, { type: 'text', text });
        console.log(`✅ 已推播給 ${uid}`);
      }
    } catch (err) {
      console.error('❌ 錯誤：', err.message);
    }
  }
}

// 如果是直接執行 fbPush.js，就執行推播
if (require.main === module) {
  fetchAndPush();
}

// 如果是被別人引入的，匯出 function 給外部使用（例如 index.js）
module.exports = fetchAndPush;
