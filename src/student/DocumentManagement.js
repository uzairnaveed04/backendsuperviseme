import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  TextInput,
  StyleSheet,
  NativeModules,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  Easing
} from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import LinearGradient from "react-native-linear-gradient";
import * as Animatable from "react-native-animatable";
import Ionicons from "react-native-vector-icons/Ionicons";
import ConfettiCannon from "react-native-confetti-cannon";

// 🛑 FIX: URL path ko /api/upload kar diya gaya hai, taaki woh backend route se match kare.

const SERVER_URL = "http://192.168.10.8:3000/api/upload"; // backend set to 192.168.10.8

const { FilePickerModule } = NativeModules;
const { width, height } = Dimensions.get('window');

const THEMES = {
  light: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    tertiary: '#06B6D4',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    accent: '#EC4899',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    muted: '#94A3B8',
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6'
  },
};

const StudentScreen = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [studentEmail, setStudentEmail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pickingFile, setPickingFile] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const theme = THEMES.light;
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const buttonScale = useState(new Animated.Value(1))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      })
    ]).start();

    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setStudentEmail(user.email);
      } else {
        setStudentEmail(null);
      }
    });
    return unsubscribe;
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.elastic(2),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const selectPDF = async () => {
    if (!FilePickerModule || !FilePickerModule.pickFile) {
        Alert.alert("❌ Module Error", "File Picker Module is not properly linked. Please check MainApplication.kt and rebuild the app.");
        return;
    }
    
    try {
      setPickingFile(true);
      const file = await FilePickerModule.pickFile(); 
      
      if (!file) {
        setPickingFile(false);
        return;
      }

      setSelectedFile({
        uri: file.uri,
        name: file.name,
        type: file.type, 
      });

      console.log("📂 Picked File:", file);
      setPickingFile(false);
    } catch (err) {
      console.error("File picker error:", err);
      Alert.alert("❌ Error", err.message || "Could not pick file.");
      setPickingFile(false);
    }
  };

  const uploadPDF = async () => {
    if (!selectedFile || !supervisorEmail || !studentEmail) {
      return Alert.alert("❌ Missing Info", "Please select a PDF and enter supervisor email.");
    }

    try {
      setUploading(true);
      animateButton();

      const auth = getAuth();
      const token = await auth.currentUser.getIdToken();

      const formData = new FormData();
      formData.append("file", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.type,
      });
      // ✅ Consistency: studentEmail aur supervisorEmail FormData mein jaa rahe hain
      formData.append("studentEmail", studentEmail); 
      formData.append("supervisorEmail", supervisorEmail);

      console.log("📤 Upload Request:", {
        studentEmail,
        supervisorEmail,
        file: selectedFile.name,
      });

      // 🛑 Fetch request ab correct URL par jaega
      const response = await fetch(SERVER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        // Backend se 403 (Forbidden) ya koi aur error aane par user ko sahi message milega
        const errorMessage = response.status === 403 
          ? "❌ You must first be approved by this supervisor before uploading documents."
          : `Server Error: ${response.status}. Check console for details.`;

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        
        Alert.alert("✅ Success", `File uploaded successfully!\nSent to: ${supervisorEmail}`);
        setSelectedFile(null);
        setSupervisorEmail("");
      } else {
        Alert.alert("❌ Upload Failed", data.message || "Upload failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("❌ Upload Error", err.message || "Unable to upload file. Check your server status and network connection.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <LinearGradient colors={[theme.background, '#F1F5F9']} style={{ flex: 1 }}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar backgroundColor={theme.primary} barStyle="light-content" />
        
        {/* Enhanced Header Section */}
        <Animated.View
          style={[
            styles.headerContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.headerBackground}>
              <View style={styles.headerOrb1} />
              <View style={styles.headerOrb2} />
            </View>
            <View style={styles.headerContent}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="document-attach" size={32} color="#FFF" />
              </View>
              <Text style={styles.headerTitle}>Secure Document Upload</Text>
              <Text style={styles.headerSubtitle}>
                Share your academic documents securely with your supervisor
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Student Info Card */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={200}
          style={styles.infoCard}
        >
          <View style={styles.infoHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.infoIconContainer}
            >
              <Ionicons name="person-circle" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.infoTitle}>Student Information</Text>
          </View>
          <Text style={styles.infoLabel}>Logged in as:</Text>
          <Text style={styles.studentEmail}>{studentEmail || "Not logged in"}</Text>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: studentEmail ? theme.success : theme.error }]} />
            <Text style={styles.statusText}>
              {studentEmail ? "✅ Authenticated & Ready" : "❌ Not Authenticated"}
            </Text>
          </View>
        </Animatable.View>

        {/* Supervisor Email Input */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={300}
          style={styles.inputSection}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.sectionIconContainer}
            >
              <Ionicons name="mail" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Supervisor's Email</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="supervisor@cuiatk.edu.pk"
              placeholderTextColor={theme.muted}
              value={supervisorEmail}
              onChangeText={setSupervisorEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!uploading}
            />
            <View style={styles.inputBorder} />
          </View>
        </Animatable.View>

        {/* File Selection Section */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={400}
          style={styles.fileSection}
        >
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.sectionIconContainer}
            >
              <Ionicons name="document" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Select Document</Text>
          </View>

          <TouchableOpacity 
            style={[styles.filePicker, pickingFile && styles.filePickerDisabled]}
            onPress={selectPDF}
            disabled={pickingFile}
          >
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.05)']}
              style={styles.filePickerGradient}
            >
              {pickingFile ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Ionicons name="folder-open" size={32} color={theme.primary} />
                  <Text style={styles.filePickerText}>Choose PDF File</Text>
                  <Text style={styles.filePickerSubtext}>Tap to browse your files</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Selected File Preview */}
          {selectedFile && (
            <Animatable.View 
              animation="fadeInUp"
              style={styles.filePreview}
            >
              <View style={styles.fileHeader}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                  style={styles.fileIconContainer}
                >
                  <Ionicons name="document-text" size={24} color={theme.primary} />
                </LinearGradient>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileType}>PDF Document • Ready to upload</Text>
                </View>
                <TouchableOpacity onPress={removeFile} style={styles.removeButton}>
                  <LinearGradient
                    colors={['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.1)']}
                    style={styles.removeButtonGradient}
                  >
                    <Ionicons name="close" size={18} color={theme.error} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          )}
        </Animatable.View>

        {/* Upload Button */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={500}
          style={styles.uploadSection}
        >
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={[
                styles.uploadButton,
                (!selectedFile || !supervisorEmail || !studentEmail || uploading) && styles.uploadButtonDisabled
              ]}
              onPress={uploadPDF}
              disabled={!selectedFile || !supervisorEmail || !studentEmail || uploading}
            >
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={styles.uploadButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color="#FFF" />
                    <Text style={styles.uploadButtonText}>Upload Document</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" style={styles.uploadIcon} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animatable.View>

        {/* Instructions */}
        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={600}
          style={styles.instructions}
        >
          <View style={styles.instructionsHeader}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.instructionsIconContainer}
            >
              <Ionicons name="information-circle" size={24} color={theme.primary} />
            </LinearGradient>
            <Text style={styles.instructionsTitle}>How to Upload</Text>
          </View>
          <View style={styles.instructionSteps}>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.instructionStepText}>Enter your supervisor's official email address</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.instructionStepText}>Select a PDF document from your device</Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.instructionStepText}>Click upload to securely send the file</Text>
            </View>
          </View>
        </Animatable.View>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={300}
            origin={{ x: width / 2, y: 0 }}
            explosionSpeed={500}
            fallSpeed={3000}
            colors={[theme.primary, theme.secondary, theme.success, theme.tertiary]}
            fadeOut={true}
          />
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 45
  },
  
  /* Enhanced Header */
  headerContainer: {
    marginBottom: 25,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  headerGradient: {
    paddingVertical: 25,
    paddingHorizontal: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerOrb1: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerOrb2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    zIndex: 1,
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },

  /* Info Card */
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Input Section */
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  inputBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    pointerEvents: 'none',
  },

  /* File Section */
  fileSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  filePicker: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  filePickerDisabled: {
    opacity: 0.6,
  },
  filePickerGradient: {
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  filePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 8,
  },
  filePickerSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  filePreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 12,
    color: '#64748B',
  },
  removeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  removeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Upload Section */
  uploadSection: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  uploadButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  uploadIcon: {
    marginLeft: 10,
    opacity: 0.9,
  },

  /* Instructions */
  instructions: {
    marginHorizontal: 20,
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  instructionSteps: {
    gap: 12,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionStepText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    lineHeight: 20,
  },
});

export default StudentScreen;