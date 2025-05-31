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

  const { visionResult, length = 'long' } = req.body;
  if (!visionResult) {
    return res.status(400).json({ error: 'Vision result is required' });
  }

  try {
    const prompt = `
以下の画像解析結果から、${length === 'short' ? '60字' : '100字'}程度の日本語のキャプションを生成してください。
感情的で魅力的な文章にしてください。

ラベル: ${visionResult.labels.join(', ')}
感情スコア: ${visionResult.joy}
${visionResult.text ? `OCRテキスト: ${visionResult.text}` : ''}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは記者です。画像の説明を元に、魅力的なキャプションを生成してください。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    res.json({ copy: completion.choices[0].message.content });
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
