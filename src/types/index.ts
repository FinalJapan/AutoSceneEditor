// Vision APIのレスポンス型
export interface VisionAnalysisResult {
  labels: string[];
  joy: number;
  text: string;
}

// 保存するシーンデータの型
export interface SceneData {
  id: string;
  imageUri: string;
  visionResult: VisionAnalysisResult;
  generatedCopy: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ナビゲーションパラメータの型
export type RootStackParamList = {
  Home: undefined;
  Capture: undefined;
  Edit: { sceneId: string };
  Detail: { sceneId: string };
}; 