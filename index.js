console.log('✅ 本次部署版本：2025-05-23-晚間');
require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);
const app = express();
app.use(bodyParser.json());

// users.json
const usersFile = './users.json';
let users = fs.existsSync(usersFile)
  ? JSON.parse(fs.readFileSync(usersFile))
  : [];

// groups.json
const groupsFile = './groups.json';
let groups = fs.existsSync(groupsFile)
  ? JSON.parse(fs.readFileSync(groupsFile))
  : [];

// 推播相關
const fbPages = [
  { id: process.env.FB1_PAGE_ID, token: process.env.FB1_PAGE_TOKEN },
  { id: process.env.FB2_PAGE_ID, token: process.env.FB2_PAGE_TOKEN }
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

// webhook 記錄 userId / groupId
app.post('/webhook', (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('❌ webhook 錯誤：', err);
      res.status(500).end();
    });
});

function handleEvent(event) {
  const source = event.source;
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // userId
  if (source.type === 'user') {
    const userId = source.userId;
    if (!users.includes(userId)) {
      users.push(userId);
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      console.log('✅ 已新增用戶 ID:', userId);
    } else {
      console.log('ℹ️ 用戶 ID 已存在:', userId);
    }
  }

  // groupId
  if (source.type === 'group') {
    const groupId = source.groupId;
    if (!groups.includes(groupId)) {
      groups.push(groupId);
      fs.writeFileSync(groupsFile, JSON.stringify(groups, null, 2));
      console.log('✅ 已新增群組 ID:', groupId);
    } else {
      console.log('ℹ️ 群組 ID 已存在:', groupId);
    }
  }

  return Promise.resolve(null); // 不回覆任何訊息
}

// cron-job.org 呼叫的路由
app.get('/fbpush', (req, res) => {
  fetchAndPush()
    .then(() => res.send('✅ LINE 推播成功'))
    .catch(err => res.status(500).send('❌ 推播失敗: ' + err.message));
});

// 伺服器啟動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 LINE Bot 伺服器啟動於 http://localhost:${port}`);
});
