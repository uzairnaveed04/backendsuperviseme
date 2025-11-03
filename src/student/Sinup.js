import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ImageBackground, 
  Dimensions, 
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const Signup = ({ navigation }) => {
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
  // New state for welcome message on signup
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

  // useEffect to check if welcome message for signup has been shown before
  useEffect(() => {
    const checkWelcomeMessage = async () => {
      try {
        const welcomeShown = await AsyncStorage.getItem('signupWelcomeMessageShown');
        if (welcomeShown === null) {
          setShowWelcomeMessage(true);
          await AsyncStorage.setItem('signupWelcomeMessageShown', 'true');
        }
      } catch (e) {
        console.error("Failed to load signup welcome message status", e);
      }
    };
    checkWelcomeMessage();
  }, []);

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

const handleSignup = async () => {
    animateButton();
    
    const universityEmailRegex = /^(sp|fa)\d{2}-bse-\d{3}@cuiatk\.edu\.pk$/i;
    if (!universityEmailRegex.test(email)) {
      showModal('Invalid Email', 'Only university emails (@cuiatk.edu.pk) are allowed.');
      startShake();
      return;
    }

    if (password.length < 6) {
      showModal('Weak Password', 'Password must be at least 6 characters long.');
      startShake();
      return;
    }

    setLoading(true);

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        showModal('Email Already Registered', 'This email is already in use.');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 🟢 Fix is here: Changed 'firestore' to 'db'
      await setDoc(doc(db, 'students', user.uid), { 
        email,
        createdAt: new Date(),
      });

      showModal('Success', 'Account created successfully!', 'success');
      setTimeout(() => {
        navigation.replace('StudentDashboard');
      }, 1500);
    } catch (error) {
      showModal('Signup Failed', error.message);
      startShake();
    } finally {
      setLoading(false);
    }
  };
  return (
    <ImageBackground
      source={{ uri: 'https://i.pinimg.com/736x/e2/e7/c2/e2e7c2cc3ab92e27a8bbeea3054f58fa.jpg' }}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.overlay}>
          <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our university community</Text>
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

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSignup} 
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
                  <Text style={styles.buttonText}>Creating Account...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Sign Up</Text>
                  <Icon name="person-add" size={20} color="#fff" />
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
            onPress={() => navigation.navigate('Login')} 
            style={styles.linkContainer}
          >
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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

      {/* 🟢 NEW WELCOME MESSAGE MODAL */}
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
              {'\n'}Please create an account with your university email.
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
    height: '1000'
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
    color: '#fff', 
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18
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

export default Signup;