import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  ImageBackground,
  Animated
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
      source={{ uri: 'https://i.pinimg.com/736x/83/49/40/8349402233c4f9a5dc21b2dc6e9d2416.jpg' }}
      style={styles.container}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: 1.1 }] }}
    >

      

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

          {/* Text Section */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.title}>Welcome to</Text>
            <Text style={styles.appName}>SuperviseMe</Text>
            <Text style={styles.subTitle}>COMSATS University Islamabad</Text>
            {/* New Quote Added */}
            <Text style={styles.quote}>COMSATS Excellence, Supervised Perfectly</Text>
          </Animated.View>

          {/* Button Section */}
          <Animated.View style={[styles.buttonContainer, { transform: [{ scale: buttonScale }] }]}>
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
                  size={24} 
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

  topLeftOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 1,
    height: height * 0.7,
    borderBottomRightRadius: 200,
    zIndex: 1,
  },

  content: { 
    flex: 1,                   
    width: '100%', 
    padding: 20, 
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  header: { 
    alignItems: 'center', 
    marginTop: height * 0.25,
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FF9800',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  appName: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    color: '#e5ff00ff',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginTop: 5,
  },
  subTitle: {
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'center',
    color: '#15ee0dff',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginTop: 5,
  },
  quote: {
    fontSize: 20,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#feffe0ff',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: 15,
    letterSpacing: 0.5,
  },

  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: height * 0.1,
  },

  button: {
    width: width * 0.6,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#2563EB',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginRight: 6,
  },
  buttonIcon: { marginLeft: 2 },
});

export default WelcomeScreen;