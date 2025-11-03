import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ImageBackground, 
  Dimensions,
  Animated
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const [button1Scale] = useState(new Animated.Value(1));
  const [button2Scale] = useState(new Animated.Value(1));

  const animateButton = (buttonScale) => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <ImageBackground
      source={{ uri: 'https://pbs.twimg.com/media/CqELGZVWIAAKxFb?format=jpg&name=large' }}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        
        {/* ✨ Fancy Role Selection Text Only */}
        <Animatable.Text 
          animation="pulse" 
          iterationCount="infinite"
          easing="ease-out"
          style={styles.roleText}
        >
          🎓 Select Your Role 
        </Animatable.Text>

        {/* Buttons with Animation */}
        <View style={styles.buttonsContainer}>
          
          {/* Student Button */}
          <Animatable.View 
            animation="fadeInUp"
            duration={800}
            delay={500}
          >
            <Animated.View style={{ transform: [{ scale: button1Scale }] }}>
              <TouchableOpacity 
                style={[styles.button, styles.studentButton]}
                onPress={() => {
                  animateButton(button1Scale);
                  navigation.navigate('Login');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="school" size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Student</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </Animatable.View>

          {/* Supervisor Button */}
          <Animatable.View 
            animation="fadeInUp"
            duration={800}
            delay={800}
          >
            <Animated.View style={{ transform: [{ scale: button2Scale }] }}>
              <TouchableOpacity 
                style={[styles.button, styles.supervisorButton]}
                onPress={() => {
                  animateButton(button2Scale);
                  navigation.navigate('SLogin');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="person" size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Supervisor</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </Animatable.View>

        </View>

        {/* Footer */}
        <Animatable.View 
          animation="fadeIn"
          duration={1500}
          delay={1000}
          style={styles.footer}
        >
          <Text style={styles.footerText}>Empowering Academic Excellence</Text>
        </Animatable.View>

      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    width: width,
    height: height,
  },
  overlay: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 25,
  },
  roleText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 40,
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center'
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 25,
    width: width * 0.85,
    borderRadius: 30,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  studentButton: {
    backgroundColor: '#6C63FF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  supervisorButton: {
    backgroundColor: '#FF5252',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center'
  },
  buttonIcon: {
    marginRight: 10
  },
  footer: {
    position: 'absolute',
    bottom: 30
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    letterSpacing: 0.5,
    fontStyle: 'italic'
  }
});

export default WelcomeScreen;
