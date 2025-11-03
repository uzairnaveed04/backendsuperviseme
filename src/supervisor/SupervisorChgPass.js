import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import Modal from 'react-native-modal';

const { width, height } = Dimensions.get('window');

const SupervisorChangePassword = ({ route, navigation }) => {
  const { email } = route.params || {}; 
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const showMessage = (message, isError = false) => {
    setModalMessage(message);
    if (isError) {
      setIsErrorModalVisible(true);
    } else {
      setIsSuccessModalVisible(true);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showMessage('Please enter a new password and confirm it.', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match.', true);
      return;
    }

    if (newPassword.length < 6) {
      showMessage('Password should be at least 6 characters.', true);
      return;
    }

    setIsLoading(true);
    try {
      const supervisorRef = doc(db, 'supervisors', email);
      await updateDoc(supervisorRef, { password: newPassword });
      
      showMessage('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      showMessage(`Failed to update password: ${error.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (password.length === 0) return { strength: 0, color: '#E0E0E0', text: '' };
    if (password.length < 6) return { strength: 33, color: '#FF6B6B', text: 'Weak' };
    if (password.length < 8) return { strength: 66, color: '#FFA726', text: 'Medium' };
    return { strength: 100, color: '#4CAF50', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#FF9800" barStyle="light-content" />
      
      {/* Background Gradient Effect */}
      <View style={styles.background}>
        <View style={styles.gradientTop} />
        <View style={styles.gradientBottom} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Header Section */}
            <Animatable.View 
              animation="fadeInDown"
              duration={1000}
              style={styles.header}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="lock-closed" size={42} color="#FFFFFF" />
                <View style={styles.iconGlow} />
              </View>
              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>Secure your account with a new password</Text>
            </Animatable.View>

            {/* Form Section */}
            <Animatable.View 
              animation="fadeInUp"
              duration={1000}
              delay={300}
              style={styles.formContainer}
            >
              {/* New Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <View style={[
                  styles.inputContainer,
                  focusedInput === 'newPassword' && styles.inputContainerFocused
                ]}>
                  <Ionicons 
                    name="key-outline" 
                    size={22} 
                    color={focusedInput === 'newPassword' ? "#667EEA" : "#999"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#A0A0A0"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('newPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  {newPassword.length > 0 && (
                    <Ionicons 
                      name={passwordStrength.strength === 100 ? "checkmark-circle" : "alert-circle"} 
                      size={20} 
                      color={passwordStrength.color} 
                    />
                  )}
                </View>
                
                {/* Password Strength Indicator */}
                {newPassword.length > 0 && (
                  <Animatable.View 
                    animation="fadeIn"
                    duration={500}
                    style={styles.strengthContainer}
                  >
                    <View style={styles.strengthBar}>
                      <View 
                        style={[
                          styles.strengthFill,
                          { 
                            width: `${passwordStrength.strength}%`,
                            backgroundColor: passwordStrength.color
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.text}
                    </Text>
                  </Animatable.View>
                )}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                <View style={[
                  styles.inputContainer,
                  focusedInput === 'confirmPassword' && styles.inputContainerFocused
                ]}>
                  <Ionicons 
                    name="key" 
                    size={22} 
                    color={focusedInput === 'confirmPassword' ? "#667EEA" : "#999"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor="#A0A0A0"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  {confirmPassword.length > 0 && newPassword === confirmPassword && (
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  )}
                </View>
              </View>

              {/* Requirements List */}
              <Animatable.View 
                animation="fadeIn"
                duration={800}
                delay={600}
                style={styles.requirementsContainer}
              >
                <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={newPassword.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={newPassword.length >= 6 ? "#4CAF50" : "#999"} 
                  />
                  <Text style={styles.requirementText}>At least 6 characters</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={newPassword === confirmPassword && newPassword.length > 0 ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={newPassword === confirmPassword && newPassword.length > 0 ? "#4CAF50" : "#999"} 
                  />
                  <Text style={styles.requirementText}>Passwords must match</Text>
                </View>
              </Animatable.View>

              {/* Submit Button */}
              <Animatable.View 
                animation="pulse"
                iterationCount="infinite"
                duration={2000}
                style={styles.buttonContainer}
              >
                <TouchableOpacity 
                  style={[
                    styles.button,
                    isLoading && styles.buttonDisabled,
                    (!newPassword || !confirmPassword || newPassword !== confirmPassword) && styles.buttonDisabled
                  ]} 
                  onPress={handleChangePassword}
                  disabled={isLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  activeOpacity={0.9}
                >
                  <View style={styles.buttonContent}>
                    {isLoading ? (
                      <Animatable.View
                        animation="rotate"
                        iterationCount="infinite"
                        duration={1000}
                      >
                        <Ionicons name="refresh" size={24} color="white" />
                      </Animatable.View>
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Update Password</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="white" />
                      </>
                    )}
                  </View>
                  
                  {/* Button Gradient Effect */}
                  <View style={styles.buttonGlow} />
                </TouchableOpacity>
              </Animatable.View>
            </Animatable.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        isVisible={isSuccessModalVisible}
        onBackdropPress={() => setIsSuccessModalVisible(false)}
        onBackButtonPress={() => setIsSuccessModalVisible(false)}
        animationIn="zoomIn"
        animationOut="zoomOut"
        backdropOpacity={0.7}
        backdropColor="#000"
      >
        <View style={styles.modalContent}>
          <Animatable.View
            animation="bounceIn"
            duration={1000}
            style={styles.modalIconSuccess}
          >
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <View style={styles.modalIconGlow} />
          </Animatable.View>
          <Text style={styles.modalTitle}>Success!</Text>
          <Text style={styles.modalText}>{modalMessage}</Text>
          <TouchableOpacity
            style={styles.modalButtonSuccess}
            onPress={() => {
              setIsSuccessModalVisible(false);
              navigation.goBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.modalButtonText}>Continue</Text>
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        isVisible={isErrorModalVisible}
        onBackdropPress={() => setIsErrorModalVisible(false)}
        onBackButtonPress={() => setIsErrorModalVisible(false)}
        animationIn="shake"
        animationOut="fadeOut"
        backdropOpacity={0.7}
        backdropColor="#000"
      >
        <View style={styles.modalContent}>
          <Animatable.View
            animation="pulse"
            duration={500}
            style={styles.modalIconError}
          >
            <Ionicons name="close-circle" size={80} color="#F44336" />
            <View style={styles.modalIconGlow} />
          </Animatable.View>
          <Text style={styles.modalTitle}>Oops!</Text>
          <Text style={styles.modalText}>{modalMessage}</Text>
          <TouchableOpacity
            style={styles.modalButtonError}
            onPress={() => setIsErrorModalVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.modalButtonText}>Try Again</Text>
            <Ionicons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientTop: {
    height: height * 0.4,
    backgroundColor: '#FF9800',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  gradientBottom: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 25,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
    marginTop: 15,
  },
  iconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 20,
    borderRadius: 30,
    marginBottom: 20,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  inputWrapper: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#667EEA',
    marginBottom: 8,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#667EEA',
    backgroundColor: '#FFFFFF',
    shadowColor: '#667EEA',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  strengthContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginRight: 10,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'all 0.3s ease',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 50,
  },
  requirementsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  buttonContainer: {
    marginTop: 30,
  },
  button: {
    backgroundColor: '#667EEA',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowColor: '#999',
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  buttonGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 35,
    alignItems: 'center',
    margin: 20,
  },
  modalIconSuccess: {
    marginBottom: 20,
    position: 'relative',
  },
  modalIconError: {
    marginBottom: 20,
    position: 'relative',
  },
  modalIconGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 50,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
  },
  modalButtonSuccess: {
    backgroundColor: '#4CAF50',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalButtonError: {
    backgroundColor: '#F44336',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default SupervisorChangePassword;