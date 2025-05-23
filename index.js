require('dotenv').config();
const line = require('@line/bot-sdk');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();
app.use(bodyParser.json());

// 載入/建立 users.json
const usersFile = './users.json';
let users = [];
if (fs.existsSync(usersFile)) {
  users = JSON.parse(fs.readFileSync(usersFile));
  console.log('✅ 已載入 users.json：', users);
}

// 載入/建立 groups.json
const groupsFile = './groups.json';
let groups = [];
if (fs.existsSync(groupsFile)) {
  groups = JSON.parse(fs.readFileSync(groupsFile));
  console.log('✅ 已載入 groups.json：', groups);
}

app.post('/webhook', (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('❌ webhook 處理錯誤：', err);
      res.status(500).end();
    });
});

function handleEvent(event) {
  const source = event.source;

  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  // 處理個人用戶 ID
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

  // 處理群組 ID
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

  return Promise.resolve(null); // 不回覆
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 LINE Bot 伺服器啟動於 http://localhost:${port}`);
});
