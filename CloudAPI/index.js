const express = require('express');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Vision APIクライアント
let vision;
try {
  vision = new ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  console.log('Vision APIクライアントの初期化成功');
} catch (error) {
  console.error('Vision APIクライアントの初期化エラー:', error);
}

// 画像分析エンドポイント
app.post('/analyze-image', async (req, res) => {
  try {
    if (!vision) {
      throw new Error('Vision APIクライアントが初期化されていません');
    }

    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    console.log('Vision API リクエスト開始');
    
    // 複数の分析を同時に実行
    const [result] = await vision.annotateImage({
      image: { content: image },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'LANDMARK_DETECTION', maxResults: 5 },
        { type: 'LANDSCAPE_DETECTION' },
        { type: 'IMAGE_PROPERTIES' }
      ],
      imageContext: {
        languageHints: ['ja', 'en']
      }
    });

    console.log('Vision API レスポンス受信');

    // 結果の集約
    const labels = result.labelAnnotations?.map(label => label.description) || [];
    const landmarks = result.landmarkAnnotations?.map(landmark => landmark.description) || [];
    const properties = result.imagePropertiesAnnotation?.dominantColors?.colors || [];

    // 色の情報を抽出
    const dominantColors = properties.slice(0, 3).map(color => ({
      red: color.color.red,
      green: color.color.green,
      blue: color.color.blue,
      score: color.score
    }));

    // 結果をマージ
    const allDescriptions = [...labels, ...landmarks];
    const description = allDescriptions.join(', ');

    console.log('解析結果:', { 
      labelCount: labels.length,
      landmarkCount: landmarks.length,
      colorCount: dominantColors.length
    });

    res.json({ 
      labels, 
      landmarks,
      dominantColors,
      description 
    });
  } catch (error) {
    console.error('Vision APIエラー詳細:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.details || '詳細なエラー情報がありません'
    });
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
