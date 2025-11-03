import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  ImageBackground, 
  ActivityIndicator, 
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const Login = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState({ title: '', message: '', type: 'error' });
  const [loading, setLoading] = useState(false);
  const [buttonScale] = useState(new Animated.Value(1));
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [emailIconAnim] = useState(new Animated.Value(0));
  const [passwordIconAnim] = useState(new Animated.Value(0));
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);

  useEffect(() => {
    Animated.timing(emailIconAnim, {
      toValue: emailFocus ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [emailFocus]);

  useEffect(() => {
    Animated.timing(passwordIconAnim, {
      toValue: passwordFocus ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [passwordFocus]);

  useEffect(() => {
    const checkWelcomeMessage = async () => {
      try {
        const welcomeShown = await AsyncStorage.getItem('welcomeMessageShown');
        if (welcomeShown === null) {
          setShowWelcomeMessage(true);
          await AsyncStorage.setItem('welcomeMessageShown', 'true');
        }
      } catch (e) {
        console.error("Failed to load welcome message status", e);
      }
    };
    checkWelcomeMessage();
  }, []);

  const validateUniversityEmail = (email) => {
    const universityEmailPattern = /^(sp|fa)\d{2}-bse-\d{3}@cuiatk\.edu\.pk$/i;
    return universityEmailPattern.test(email);
  };

  const showModal = (title, message, type = 'error') => {
    setModalMessage({ title, message, type });
    setModalVisible(true);
  };

  const startShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handleLogin = async () => {
    animateButton();
    
    if (!email || !password) {
      showModal('Error', 'Please enter your university email and password.');
      startShake();
      return;
    }

    if (!validateUniversityEmail(email)) {
      showModal('Invalid Email', 'Only university emails (@cuiatk.edu.pk) are allowed.');
      startShake();
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await AsyncStorage.setItem('userId', user.uid);

      navigation.replace('StudentDashboard');

    } catch (error) {
      showModal('Login Failed', error.message);
      startShake();
    } finally {
      setLoading(false);
    }
  }; // Corrected position of the closing brace

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      showModal('Error', 'Please enter your university email address.');
      return;
    }

    if (!validateUniversityEmail(resetEmail)) {
      showModal('Invalid Email', 'Only university emails (@cuiatk.edu.pk) are allowed.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      showModal(
        'Email Sent', 
        'A password reset link has been sent to your email address.', 
        'success'
      );
      setForgotPasswordModal(false);
      setResetEmail('');
    } catch (error) {
      showModal('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://i.pinimg.com/736x/91/f5/e2/91f5e28d12d50d41bf66c13584084200.jpg' }}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.overlay}>
          <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </Animated.View>

          <View style={[
            styles.inputContainer,
            emailFocus && styles.inputContainerFocused
          ]}>
            <Animated.View style={[
              styles.iconContainer,
              { 
                transform: [
                  { 
                    translateY: emailIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5]
                    }) 
                  },
                  {
                    scale: emailIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2]
                    })
                  }
                ]
              }
            ]}>
              <Icon 
                name="email" 
                size={22} 
                color={emailFocus ? '#6C63FF' : '#aaa'} 
              />
            </Animated.View>
            <TextInput
              style={styles.input}
              placeholder="University Email"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
            />
            {email && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setEmail('')}
              >
                <Icon name="close" size={18} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>

          <View style={[
            styles.inputContainer,
            passwordFocus && styles.inputContainerFocused
          ]}>
            <Animated.View style={[
              styles.iconContainer,
              { 
                transform: [
                  { 
                    translateY: passwordIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5]
                    }) 
                  },
                  {
                    scale: passwordIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2]
                    })
                  }
                ]
              }
            ]}>
              <Icon 
                name="lock" 
                size={22} 
                color={passwordFocus ? '#6C63FF' : '#aaa'} 
              />
            </Animated.View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
            />
            {password && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setPassword('')}
              >
                <Icon name="close" size={18} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={() => setForgotPasswordModal(true)}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleLogin} 
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator 
                    size="small" 
                    color="#fff" 
                    style={styles.spinner}
                  />
                  <Text style={styles.buttonText}>Authenticating...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Login</Text>
                  <Icon name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Sinup')} 
            style={styles.linkContainer}
          >
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal 
        isVisible={forgotPasswordModal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.7}
        onBackdropPress={() => setForgotPasswordModal(false)}
      >
        <View style={styles.forgotModalContainer}>
          <Text style={styles.forgotModalTitle}>Reset Password</Text>
          <Text style={styles.forgotModalText}>
            Enter your university email to receive a password reset link
          </Text>
          
          <View style={styles.forgotInputContainer}>
            <Icon name="email" size={22} color="#6C63FF" style={styles.forgotIcon} />
            <TextInput
              style={styles.forgotInput}
              placeholder="University Email"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
              value={resetEmail}
              onChangeText={setResetEmail}
            />
          </View>
          
          <View style={styles.forgotButtonContainer}>
            <TouchableOpacity 
              style={[styles.forgotButton, styles.cancelButton]}
              onPress={() => setForgotPasswordModal(false)}
            >
              <Text style={styles.forgotButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.forgotButton, styles.submitButton]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.forgotButtonText}>Send Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main Success/Error Modal */}
      <Modal 
        isVisible={modalVisible} 
        animationIn="zoomIn" 
        animationOut="zoomOut"
        backdropTransitionOutTiming={0}
        backdropOpacity={0.7}
      >
        <View style={[
          styles.modalContainer, 
          modalMessage.type === 'success' ? styles.successModal : styles.errorModal,
          styles.modalShadow
        ]}>
          <Icon 
            name={modalMessage.type === 'success' ? "check-circle" : "error"} 
            size={50} 
            color="#fff" 
            style={styles.modalIcon}
          />
          <Text style={styles.modalTitle}>{modalMessage.title}</Text>
          <Text style={styles.modalMessage}>{modalMessage.message}</Text>
          <TouchableOpacity 
            style={styles.modalButton} 
            onPress={() => setModalVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* NEW WELCOME MESSAGE MODAL */}
      <Modal 
        isVisible={showWelcomeMessage}
        animationIn="zoomIn" 
        animationOut="zoomOut"
        backdropOpacity={0.8}
        onBackdropPress={() => setShowWelcomeMessage(false)}
      >
        <View style={styles.welcomeModalContainer}>
          <Icon name="star" size={60} color="#FFD700" style={{ marginBottom: 15 }} />
          <Text style={styles.welcomeTitle}>
            <Text style={styles.welcomeHighlight}>Hello, CUIATK Student!</Text>
          </Text>
          <Text style={styles.welcomeText}>
            This app is exclusively for 
            <Text style={styles.welcomeHighlight}> 6th, 7th, and 8th semester students</Text>.
            <Text style={styles.welcomeSubtext}>
              {'\n'}Log in with your university email to get started.
            </Text>
          </Text>
          <TouchableOpacity 
            style={styles.welcomeButton} 
            onPress={() => setShowWelcomeMessage(false)}
          >
            <Text style={styles.welcomeButtonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    width: width, 
    height: 950
  },
  keyboardAvoid: {
    flex: 1
  },
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0, 0, 0, 0.6)', 
    paddingHorizontal: 25,
    paddingBottom: 20
  },
  title: { 
    fontSize: 34, 
    fontWeight: 'bold', 
    marginBottom: 5, 
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 0.8
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4
  },
  inputContainer: {
    width: width * 0.85,
    marginBottom: 20,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8
  },
  inputContainerFocused: {
    borderColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  },
  iconContainer: {
    marginRight: 10
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 16,
    color: '#333',
    letterSpacing: 0.3
  },
  clearButton: {
    padding: 5,
    marginLeft: 10
  },
  button: {
    backgroundColor: '#6C63FF',
    padding: 18,
    borderRadius: 30,
    width: width * 0.85,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12
  },
  buttonDisabled: {
    backgroundColor: '#8a85ff'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginRight: 10
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spinner: {
    marginRight: 10
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginRight: width * 0.075,
    marginTop: -10,
    marginBottom: 15,
    
  },
  forgotPasswordText: {
    fontSize: 18,
    color: '#60A5FA',
    textDecorationLine: 'underline',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: width * 0.85
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)'
  },
  dividerText: {
    color: 'rgba(255,255,255,0.8)',
    marginHorizontal: 10,
    fontSize: 14
  },
  linkContainer: {
    marginTop: 10
  },
  linkText: {
    fontSize: 16,
    color: '#60A5FA',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  linkHighlight: {
    color: '#fff',
    fontWeight: 'bold',
    textDecorationLine: 'underline'
  },
  modalContainer: {
    width: width * 0.8,
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center'
  },
  modalShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20
  },
  modalIcon: {
    marginBottom: 15
  },
  successModal: { 
    backgroundColor: '#4BB543',
  },
  errorModal: { 
    backgroundColor: '#FF5252',
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  modalMessage: { 
    fontSize: 16, 
    color: '#fff', 
    textAlign: 'center', 
    marginBottom: 25,
    lineHeight: 22,
    letterSpacing: 0.3
  },
  modalButton: { 
    backgroundColor: 'rgba(255,255,255,0.3)', 
    paddingVertical: 12, 
    paddingHorizontal: 35, 
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)'
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#fff',
    letterSpacing: 0.5
  },
  // Forgot Password Modal Styles
  forgotModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: width * 0.85,
    alignSelf: 'center'
  },
  forgotModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 10,
    textAlign: 'center'
  },
  forgotModalText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22
  },
  forgotInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20
  },
  forgotIcon: {
    marginRight: 10
  },
  forgotInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333'
  },
  forgotButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  forgotButton: {
    padding: 15,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: '#f5f5f5'
  },
  submitButton: {
    backgroundColor: '#6C63FF'
  },
  forgotButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  // NEW WELCOME MODAL STYLES
  welcomeModalContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 25,
    width: width * 0.85,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#6C63FF',
    textAlign: 'center',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  welcomeHighlight: {
    color: '#E63946',
    fontWeight: 'bold',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 5,
  },
  welcomeButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
  },
  welcomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Login;