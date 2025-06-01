// Vision APIのテストスクリプト
// 使い方: node src/utils/testVisionApi.js YOUR_API_KEY

const apiKey = process.argv[2];

if (!apiKey) {
  console.log('使い方: node src/utils/testVisionApi.js YOUR_API_KEY');
  process.exit(1);
}

console.log('APIキーでVision APIをテスト中...');
console.log('APIキーの最初の10文字:', apiKey.substring(0, 10) + '...');

// テスト画像（小さなBase64エンコードされた画像）
const testImage = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=';

async function testVisionApi() {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: testImage
            },
            features: [
              { type: 'LABEL_DETECTION', maxResults: 5 }
            ]
          }]
        }),
      }
    );

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Vision API接続成功！');
      console.log('レスポンス:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Vision APIエラー:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.error?.message?.includes('API key not valid')) {
        console.log('\n対処法:');
        console.log('1. Google Cloud Consoleで新しいAPIキーを作成');
        console.log('2. Vision APIが有効になっているか確認');
        console.log('3. 請求先アカウントが設定されているか確認');
      }
    }
  } catch (error) {
    console.log('❌ ネットワークエラー:', error.message);
  }
}

testVisionApi(); 