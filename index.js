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

async function handleEvent(event) {
  const source = event.source;

  // 紀錄 userId 或 groupId
  if (source.type === 'user') {
    const userId = source.userId;
    if (!users.includes(userId)) {
      users.push(userId);
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      console.log('✅ 已新增用戶 ID:', userId);
    }
  } else if (source.type === 'group') {
    const groupId = source.groupId;
    if (!groups.includes(groupId)) {
      groups.push(groupId);
      fs.writeFileSync(groupsFile, JSON.stringify(groups, null, 2));
      console.log('✅ 已新增群組 ID:', groupId);
    }
  }

  // 查詢關鍵字指令
  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.trim();

    if (msg === '查粉專' || msg === '查社區') {
      return replyLatestPost(event.replyToken, process.env.FB1_PAGE_ID, process.env.FB1_PAGE_TOKEN);
    }

    if (msg === '查藥局') {
      return replyLatestPost(event.replyToken, process.env.FB2_PAGE_ID, process.env.FB2_PAGE_TOKEN);
    }

    if (msg === '幫助') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📋 可用指令：\n🔍 查社區\n🔍 查藥局\n🔍 查粉專\n🔍 幫助`
      });
    }
  }

  return Promise.resolve(null); // 不回覆其他訊息
}

async function replyLatestPost(replyToken, pageId, pageToken) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}/posts?access_token=${pageToken}&fields=message,permalink_url`
    );

    const posts = res.data.data;
    console.log('📥 抓到貼文數：', posts.length);

    if (!posts || posts.length === 0) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '找不到貼文喔！'
      });
    }

    const latest = posts.find(p => p.message) || posts[0]; // 如果都沒有 message，就拿第一篇

    const text = `${latest.message ? '📢 ' + latest.message.trim() + '\n' : ''}👉 ${latest.permalink_url}`;
    return client.replyMessage(replyToken, { type: 'text', text });

  } catch (err) {
    console.error('❌ 查詢失敗：', err.message);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '發生錯誤，請稍後再試 🙇‍♂️'
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 LINE Bot 伺服器啟動於 http://localhost:${port}`);
});

const fbPush = require('./fbPush');

app.get('/fbpush', async (req, res) => {
  console.log('📥 收到 EasyCron 呼叫 /fbpush');
  try {
    await fbPush();
    res.send('✅ 推播成功');
  } catch (err) {
    console.error('❌ 推播失敗：', err.message);
    res.status(500).send('❌ 推播失敗');
  }
});
app.get('/fbpush', (req, res) => {
  fetchAndPush()
    .then(() => res.send('✅ 推播成功'))
    .catch(err => res.status(500).send('❌ 推播失敗: ' + err.message));
});
