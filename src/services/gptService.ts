import { VisionAnalysisResult } from '../types';
import { API_CONFIG } from '../config/constants';

export async function generateCopy(
  visionResult: VisionAnalysisResult,
  length: 'short' | 'long' = 'long'
): Promise<string> {
  // 開発モードではモックデータを返す
  if (API_CONFIG.USE_MOCK_DATA) {
    console.log('GPT API: モックデータを使用中');
    const mockCopies = {
      short: 'カフェでゆったりとした午後のひととき。香り豊かなコーヒーと共に。',
      long: 'カフェでゆったりとした午後のひととき。香り豊かなコーヒーと共に、日常から少し離れて自分だけの時間を楽しむ。窓から差し込む優しい光が、心地よい空間を演出している。',
    };
    return mockCopies[length];
  }

  try {
    // 開発用：直接OpenAI APIを呼び出す
    if (API_CONFIG.USE_DIRECT_API && API_CONFIG.OPENAI_API_KEY) {
      console.log('GPT API: 直接APIを使用中（開発モード）');
      
      const prompt = `
以下の画像解析結果から、${length === 'short' ? '60字' : '100字'}程度の日本語のキャプションを生成してください。
感情的で魅力的な文章にしてください。

ラベル: ${visionResult.labels.join(', ')}
感情スコア: ${visionResult.joy}
${visionResult.text ? `OCRテキスト: ${visionResult.text}` : ''}
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'あなたは記者です。画像を分析し、何が写っているか分析。画像の内容から魅力的なキャプションを生成してください。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API エラー詳細:', error);
        throw new Error(`OpenAI API request failed: ${response.status}`);
      }

      const result = await response.json();
      return result.choices[0].message.content.trim();
    }

    // Cloud Functionを呼び出し（本番用）
    const response = await fetch(`${API_CONFIG.CLOUD_FUNCTIONS_URL}/generate-caption`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visionResult,
        length,
      }),
    });

    if (!response.ok) {
      throw new Error('GPT API request failed');
    }

    const result = await response.json();
    return result.copy;
  } catch (error) {
    console.error('GPT API Error:', error);
    // エラー時もモックデータを返す
    const mockCopies = {
      short: 'カフェでゆったりとした午後のひととき。香り豊かなコーヒーと共に。',
      long: 'カフェでゆったりとした午後のひととき。香り豊かなコーヒーと共に、日常から少し離れて自分だけの時間を楽しむ。窓から差し込む優しい光が、心地よい空間を演出している。',
    };
    return mockCopies[length];
  }
} 