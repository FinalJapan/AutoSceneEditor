const express = require('express');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Vision APIクライアント
const vision = new ImageAnnotatorClient();

// 画像分析エンドポイント
app.post('/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image data is required' });

    const [result] = await vision.labelDetection({ image: { content: image } });
    const labels = result.labelAnnotations?.map(label => label.description) || [];
    const description = labels.join(', ');
    res.json({ labels, description });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// キャプション生成エンドポイント
app.post('/generate-caption', async (req, res) => {
  // ここで毎回OpenAIクライアントを生成
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { imageDescription, model, prompt } = req.body;
  if (!imageDescription || !model || !prompt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'あなたは記者です。画像の説明を元に、魅力的なキャプションを生成してください。' },
        { role: 'user', content: `${prompt}\n\n${imageDescription}` }
      ],
      max_tokens: 100
    });

    res.json({ caption: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI APIエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ルート（/）はヘルスチェック用
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Cloud Run用にサーバーを起動
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});