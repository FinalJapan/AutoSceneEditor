import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { GestureHandlerRootView, PinchGestureHandler } from 'react-native-gesture-handler';
import { RootStackParamList } from '../types';
import { analyzeImage } from '../services/visionService';
import { generateCopy } from '../services/gptService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/constants';

type CaptureScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Capture'>;

export default function CaptureScreen() {
  const navigation = useNavigation<CaptureScreenNavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState<any>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1); // デフォルトは1x
  const [baseZoom, setBaseZoom] = useState(1); // ピンチ操作の基準値

  // ズームプリセット（1xと1.5xのみ）
  const zoomLevels = [1, 1.5];

  // カメラのズーム値（0-1）に変換
  const getCameraZoom = (displayZoom: number) => {
    // 1xを基準（zoom: 0）として計算
    if (displayZoom === 1) return 0;      // 1x -> 標準ズーム（zoom: 0）
    if (displayZoom === 1.5) return 0.5;  // 1.5x -> 望遠ズーム（zoom: 0.5）
    
    // ピンチ操作用の中間値の計算（1x-1.5xの範囲のみ）
    return Math.max(0, Math.min(0.5, (displayZoom - 1) * 1));
  };

  // プリセットズームの変更
  const handlePresetZoomChange = (zoomLevel: number) => {
    setCurrentZoom(zoomLevel);
    setBaseZoom(zoomLevel);
  };

  // ピンチジェスチャーのハンドラー
  const onPinchGestureEvent = ({ nativeEvent: { scale } }: any) => {
    const newZoom = Math.max(1, Math.min(1.5, baseZoom * scale));
    setCurrentZoom(newZoom);
  };

  const takePicture = async () => {
    if (camera) {
      try {
        const photo = await camera.takePictureAsync();
        setImageUri(photo.uri);
        processImage(photo.uri);
      } catch (error) {
        Alert.alert('エラー', '写真の撮影に失敗しました');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setProcessing(true);
    console.log('=== API設定の確認 ===');
    console.log('USE_DIRECT_API:', API_CONFIG.USE_DIRECT_API);
    console.log('Google API Key exists:', !!API_CONFIG.GOOGLE_CLOUD_API_KEY);
    console.log('OpenAI API Key exists:', !!API_CONFIG.OPENAI_API_KEY);
    
    try {
      // Vision APIで画像を解析
      const visionResult = await analyzeImage(uri);
      
      // GPT APIでコピーを生成
      const generatedCopy = await generateCopy(visionResult, 'long');
      
      // シーンデータを作成
      const sceneId = `scene_${Date.now()}`;
      const sceneData = {
        id: sceneId,
        imageUri: uri,
        visionResult,
        generatedCopy,
        tags: visionResult.labels,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 一時的に保存
      await AsyncStorage.setItem(`temp_${sceneId}`, JSON.stringify(sceneData));
      
      // 編集画面へ遷移
      navigation.navigate('Edit', { sceneId });
    } catch (error) {
      Alert.alert('エラー', '画像の処理に失敗しました');
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>カメラへのアクセスが許可されていません</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>カメラを許可</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (processing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.processingText}>画像を解析中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {!imageUri ? (
          <>
            <PinchGestureHandler
              onGestureEvent={onPinchGestureEvent}
            >
              <View style={styles.camera}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  ref={(ref) => setCamera(ref)}
                  zoom={getCameraZoom(currentZoom)}
                />
              </View>
            </PinchGestureHandler>
            <SafeAreaView style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </SafeAreaView>

            {/* ズームコントロール */}
            <View style={styles.zoomControlContainer}>
              <View style={styles.zoomLevels}>
                {zoomLevels.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.zoomLevel,
                      Math.abs(currentZoom - level) < 0.1 && styles.activeZoomLevel,
                    ]}
                    onPress={() => handlePresetZoomChange(level)}
                  >
                    <Text style={[
                      styles.zoomLevelText,
                      Math.abs(currentZoom - level) < 0.1 && styles.activeZoomLevelText
                    ]}>
                      {level === 1 ? '1x' : level.toFixed(1) + 'x'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.galleryButton}
                onPress={pickImage}
              >
                <Text style={styles.galleryButtonText}>🖼️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <View style={styles.placeholder} />
            </View>
          </>
        ) : (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <View style={styles.previewControls}>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setImageUri(null)}
                >
                  <Text style={styles.buttonText}>撮り直す</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 10,
    margin: 20,
    backgroundColor: 'rgba(0,0,0,0.3)', 
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#000',
  },
  galleryButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
  },
  galleryButtonText: {
    fontSize: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#ddd',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 30,
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  zoomControlContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomLevels: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4,
  },
  zoomLevel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeZoomLevel: {
    backgroundColor: 'white',
  },
  zoomLevelText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  activeZoomLevelText: {
    color: 'black',
  },
}); 
