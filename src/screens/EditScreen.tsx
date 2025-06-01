import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SceneData, RootStackParamList } from '../types';
import * as FileSystem from 'expo-file-system';

const CLOUD_FUNCTIONS_URL = 'https://autosceneeditor-87908445044.asia-northeast1.run.app';

type EditScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Edit'>;
type EditScreenRouteProp = RouteProp<RootStackParamList, 'Edit'>;

export default function EditScreen() {
  const navigation = useNavigation<EditScreenNavigationProp>();
  const route = useRoute<EditScreenRouteProp>();
  
  const [imageUri, setImageUri] = useState('');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTextOverlay, setShowTextOverlay] = useState(true);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadTempData();
  }, []);

  const loadTempData = async () => {
    try {
      const tempData = await AsyncStorage.getItem(`temp_${route.params.sceneId}`);
      if (tempData) {
        const sceneData = JSON.parse(tempData);
        setImageUri(sceneData.imageUri);
        setGeneratedCopy(sceneData.generatedCopy);
        setTags(sceneData.tags);
      }
    } catch (error) {
      console.error('Failed to load temp data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    Alert.prompt(
      'タグを追加',
      'タグを入力してください',
      (text) => {
        if (text && text.trim()) {
          setTags([...tags, text.trim()]);
        }
      },
      'plain-text'
    );
  };

  const handleRemoveTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    setTags(newTags);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sceneData: SceneData = {
        id: route.params.sceneId,
        imageUri,
        visionResult: {
          labels: tags,
          joy: 0.8,
          text: '',
        },
        generatedCopy,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        `scene_${sceneData.id}`,
        JSON.stringify(sceneData)
      );

      // 一時データを削除
      await AsyncStorage.removeItem(`temp_${route.params.sceneId}`);

      Alert.alert('保存完了', 'シーンが保存されました', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const generateCopy = async () => {
    if (!imageUri) return;

    try {
      setIsGenerating(true);
      setGeneratedCopy('');

      // 画像をBase64に変換
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Vision APIで画像分析
      const visionResponse = await fetch(`${CLOUD_FUNCTIONS_URL}/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      if (!visionResponse.ok) {
        throw new Error('画像分析に失敗しました');
      }

      const { description } = await visionResponse.json();

      // GPT APIでキャプション生成
      const gptResponse = await fetch(`${CLOUD_FUNCTIONS_URL}/generate-caption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDescription: description,
          model: 'gpt-4o', // GPT-4oモデルを指定
          prompt: `あなたは記者です。以下の画像の説明を元に、魅力的なキャプションを生成してください。
必ず100文字以内に収めてください。文字数制限は厳密に守ってください。

画像の説明：
${description}

注意：
- 必ず100文字以内に収めること
- 記者の視点で書くこと
- 簡潔で魅力的な表現を心がけること`,
        }),
      });

      if (!gptResponse.ok) {
        throw new Error('キャプション生成に失敗しました');
      }

      const { caption } = await gptResponse.json();
      setGeneratedCopy(caption);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('エラー', 'キャプションの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.title}>編集</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollContainer} bounces={false}>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => setShowTextOverlay(!showTextOverlay)}
            activeOpacity={1}
          >
            <Image source={{ uri: imageUri }} style={styles.fullImage} />
            
            {showTextOverlay && (
              <View style={styles.textOverlay}>
                <ScrollView 
                  style={styles.overlayScrollView}
                  contentContainerStyle={styles.overlayContent}
                  showsVerticalScrollIndicator={false}
                >
                  <TouchableOpacity 
                    style={styles.textContainer}
                    onPress={() => setIsEditingText(true)}
                  >
                    <Text style={styles.overlayText}>
                      {generatedCopy}
                    </Text>
                    <Text style={styles.editHint}>タップして編集</Text>
                  </TouchableOpacity>
                  <Text style={styles.charCountOverlay}>{generatedCopy.length}文字</Text>
                </ScrollView>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setShowTextOverlay(!showTextOverlay)}
            >
              <Text style={styles.toggleButtonText}>
                {showTextOverlay ? '📝' : '👁️'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>

          <View style={styles.subContent}>
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionTitle}>タグ</Text>
              <View style={styles.tagContainer}>
                {(tags || []).map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tag}
                    onPress={() => handleRemoveTag(index)}
                  >
                    <Text style={styles.tagText}>#{tag}</Text>
                    <Text style={styles.tagRemove}>×</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addTag} onPress={handleAddTag}>
                  <Text style={styles.addTagText}>+ タグ追加</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📱 Xに投稿</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📄 Notionに保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal
          visible={isEditingText}
          transparent={true}
          animationType="slide"
        >
          <KeyboardAvoidingView 
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.editModal}>
              <View style={styles.editModalHeader}>
                <TouchableOpacity onPress={() => setIsEditingText(false)}>
                  <Text style={styles.modalButton}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>テキストを編集</Text>
                <TouchableOpacity onPress={() => setIsEditingText(false)}>
                  <Text style={styles.modalButton}>完了</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalTextInput}
                value={generatedCopy}
                onChangeText={setGeneratedCopy}
                multiline
                autoFocus
                placeholder="コピーを入力..."
              />
              <Text style={styles.modalCharCount}>{generatedCopy.length}文字</Text>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={showImageModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImageModal(false)}
        >
          <TouchableOpacity 
            style={styles.imageModalContainer}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}
          >
            <Image source={{ uri: imageUri }} style={styles.modalImage} />
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.closeModalText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');
const imageHeight = height * 0.7; // 画面の70%の高さ

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    color: '#999',
  },
  scrollContainer: {
    flex: 1,
  },
  imageContainer: {
    height: imageHeight,
    backgroundColor: '#000',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '70%',
  },
  overlayScrollView: {
    flex: 1,
  },
  overlayContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    backgroundColor: 'rgba(0,0,0,0.35)', // オーバーレイ透明度調整
    minHeight: '100%',
  },
  textContainer: {
    marginBottom: 10,
  },
  overlayText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  editHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 8,
  },
  charCountOverlay: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'right',
  },
  toggleButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // オーバーレイ透明度調整
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // オーバーレイ透明度調整
  },
  toggleButtonText: {
    fontSize: 20,
  },
  subContent: {
    backgroundColor: '#f5f5f5',
    minHeight: 200,
  },
  tagSection: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  tagSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 3,
  },
  tagText: {
    fontSize: 12,
    color: '#007AFF',
  },
  tagRemove: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  addTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 3,
  },
  addTagText: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  modalCharCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 10,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '80%',
    resizeMode: 'contain',
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 