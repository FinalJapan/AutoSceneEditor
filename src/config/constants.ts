// 環境変数をインポート
import { 
  GOOGLE_CLOUD_API_KEY,
  OPENAI_API_KEY 
} from '@env';

// デバッグ用：環境変数が読み込まれているか確認
console.log('Google Cloud API Key:', GOOGLE_CLOUD_API_KEY ? '設定済み' : '未設定');
console.log('OpenAI API Key:', OPENAI_API_KEY ? '設定済み' : '未設定');

// API設定
// 注意：本番環境では環境変数やセキュアストレージを使用してください
export const API_CONFIG = {
  // Cloud Functions URL
  CLOUD_FUNCTIONS_URL: 'https://autosceneeditor2-87908445044.asia-northeast1.run.app',
  
  // 開発モード（true: モックデータ使用、false: 実際のAPI使用）
  USE_MOCK_DATA: false,
  
  // 開発用：直接APIを使用（本番では使わない！）
  USE_DIRECT_API: false,  // Cloud Runを使用するためfalseに変更
  
  // APIキー（開発用 - 本番では絶対に使わない！）
  GOOGLE_CLOUD_API_KEY: GOOGLE_CLOUD_API_KEY,
  OPENAI_API_KEY: OPENAI_API_KEY,
};

// APIキーは直接ここに記載しないでください！
// 以下のいずれかの方法で管理してください：
// 1. Cloud Functionsに実装して、クライアントからは直接APIキーを使わない（推奨）
// 2. expo-secure-storeを使用してセキュアに保存
// 3. 環境変数を使用（EAS Buildの場合） 

// 警告：本番環境では必ずCloud Functions経由でAPIを使用してください！ 