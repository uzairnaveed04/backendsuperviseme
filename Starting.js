import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  ImageBackground,
  Animated,
  Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Header fade + scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      })
    ]).start();

    // Logo glow animation (loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleStart = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      })
    ]).start(() => navigation.navigate('WelcomeScreen')); 
  };

  return (
    <ImageBackground
      source={{ uri: 'https://ww2.comsats.edu.pk/cs_atk/slides/3.jpg' }}
      style={styles.container}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: 1.1 }] }}
    >
      {/* 🌟 Top-Left Fancy Blue Layer */}
      <LinearGradient
        colors={[
          'rgba(37, 99, 235, 0.4)',   // Deep blue
          'rgba(37, 99, 235, 0.5)',   // Light blue
          'transparent'               // Fade out
        ]}
        style={styles.topLeftOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* 🌟 Light Fancy Gradient Full Overlay */}
      <LinearGradient
        colors={[
          'rgba(0,0,50,0.25)',   
          'rgba(0,0,0,0.15)',    
          'rgba(0,0,80,0.25)'    
        ]}
        style={styles.gradientOverlay}
      >
        <View style={styles.content}>
          {/* Animated Header */}
          <Animated.View style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}>
            <Text style={styles.title}>Welcome to</Text>
            <Text style={styles.appName}>SuperviseMe</Text>
            <Text style={styles.subTitle}>COMSATS University Islamabad</Text>

            {/* Logo with Glow */}
            <Animated.View style={[
              styles.logoWrapper, 
              { 
                shadowOpacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.9],
                }),
                transform: [{ scale: scaleAnim }]
              }
            ]}>
              <Image 
                source={{ uri: 'https://i.pinimg.com/736x/48/4e/85/484e85fda1c51309a3603fae41252d5e.jpg' }} 
                style={styles.universityLogo}
              />
            </Animated.View>
          </Animated.View>

          {/* Quote */}
          <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
            <Text style={styles.quoteText}>
              “Success comes from setting goals and managing them effectively.”
            </Text>
            <Text style={styles.quoteHighlight}>
              SuperviseMe makes that possible 🎓
            </Text>
          </Animated.View>

          {/* Fancy Start Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={styles.button}
              onPress={handleStart}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#2563EB', '#1E3A8A', '#3B82F6']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Get Started</Text>
                <Ionicons 
                  name="arrow-forward-circle" 
                  size={28} 
                  color="#fff" 
                  style={styles.buttonIcon} 
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%' },
  gradientOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 🌟 New Top-Left Blue Layer
  topLeftOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 1,
    height: height * 0.7,
    borderBottomRightRadius: 200,
    zIndex: 1,
  },

  content: { width: '90%', alignItems: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 25 },

  title: {
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginTop: 5,
  },
  subTitle: {
    fontSize: 23,
    fontWeight: '500',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginTop: 5,
  },

  logoWrapper: {
    marginTop: 15,
    borderRadius: 65,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 25,
    elevation: 20,
  },
  universityLogo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    resizeMode: 'cover',
    borderWidth: 3,
    borderColor: '#fff',
  },

  quoteContainer: {
    marginBottom: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  quoteHighlight: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginTop: 8,
  },

  button: {
    width: width * 0.75,
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#2563EB',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 15,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginRight: 10,
  },
  buttonIcon: { marginLeft: 5 },
});

export default WelcomeScreen;
