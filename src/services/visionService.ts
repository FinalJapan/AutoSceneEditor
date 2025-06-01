import { VisionAnalysisResult } from '../types';
import { API_CONFIG } from '../config/constants';

export async function analyzeImage(imageUri: string): Promise<VisionAnalysisResult> {
  // 開発モードではモックデータを返す
  if (API_CONFIG.USE_MOCK_DATA) {
    console.log('Vision API: モックデータを使用中');
    return {
      labels: ['カフェ', 'コーヒー', 'インテリア'],
      joy: 0.8,
      text: '',
    };
  }

  try {
    // 画像をBase64に変換
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 開発用：直接Google Vision APIを呼び出す
    if (API_CONFIG.USE_DIRECT_API && API_CONFIG.GOOGLE_CLOUD_API_KEY) {
      console.log('Vision API: 直接APIを使用中（開発モード）');
      console.log('APIキーの最初の10文字:', API_CONFIG.GOOGLE_CLOUD_API_KEY?.substring(0, 10) + '...');
      
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${API_CONFIG.GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              image: {
                content: base64
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'FACE_DETECTION', maxResults: 1 },
                { type: 'TEXT_DETECTION' }
              ]
            }]
          }),
        }
      );

      if (!visionResponse.ok) {
        const error = await visionResponse.text();
        console.error('Vision API エラー詳細:', error);
        throw new Error(`Vision API request failed: ${visionResponse.status}`);
      }

      const result = await visionResponse.json();
      const response = result.responses[0];
      
      // Vision APIのレスポンスを変換
      const labels = response.labelAnnotations?.map((label: any) => label.description) || [];
      const faces = response.faceAnnotations || [];
      const joy = faces.length > 0 ? faces[0].joyLikelihood === 'VERY_LIKELY' ? 0.9 : 0.5 : 0.5;
      const text = response.textAnnotations?.[0]?.description || '';
      
      return {
        labels: labels.slice(0, 3), // 上位3つのラベル
        joy,
        text,
      };
    }

    // Cloud Functionを呼び出し（本番用）
    const visionResponse = await fetch(`${API_CONFIG.CLOUD_FUNCTIONS_URL}/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
    });

    if (!visionResponse.ok) {
      throw new Error('Vision API request failed');
    }

    const result = await visionResponse.json();
    return result;
  } catch (error) {
    console.error('Vision API Error:', error);
    // エラー時もモックデータを返す
    return {
      labels: ['カフェ', 'コーヒー', 'インテリア'],
      joy: 0.8,
      text: '',
    };
  }
} 