import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getAuth } from 'firebase/auth';

const THEMES = {
  light: {
    primary: '#4A6FA5',
    secondary: '#166088',
    background: '#F8F9FA',
    text: '#333333',
    card: '#FFFFFF',
  },
  dark: {
    primary: '#6A11CB',
    secondary: '#2575FC',
    background: '#121212',
    text: '#FFFFFF',
    card: '#1E1E1E',
  },
};

const SupervisorDashboard = ({ route, navigation }) => {
  const [supervisorData, setSupervisorData] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [pressedButton, setPressedButton] = useState(null);
  const [loading, setLoading] = useState(true);

  const theme = THEMES[selectedTheme];
  const email = route.params?.email || getAuth().currentUser?.email;

  useEffect(() => {
    // Simulate fetch
    setTimeout(() => {
      setSupervisorData({ email: email || 'supervisor@example.com' });
      setLoading(false);
    }, 1500);
  }, [email]);

  const buttons = [
    { title: 'Project Tracking', screen: 'SupervisorProjectTracking', icon: 'bar-chart' },
    { title: 'Document Management', screen: 'SupervisorDocument', icon: 'document' },
    { title: 'Communication Tool', screen: 'Communication', icon: 'chatbubbles' },
    { title: 'Feedback & Evaluation', screen: 'SFeedbackEvaluation', icon: 'thumbs-up' },
    { title: 'Task Management', screen: 'SupervisorTaskManagement', icon: 'list' },
    { title: 'Automated Reminder', screen: 'SupervisorAutomatedReminder', icon: 'alarm' },
    { title: 'Change Password', screen: 'SupervisorChgPass', icon: 'lock' },
  ];

  const handleLogout = () => navigation.replace('SLogin');
  const handleGitHubLogin = () => navigation.navigate('GitHubLogin');
  const toggleTheme = () => {
    setSelectedTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerWrapper}>
          {/* Login Button Left */}
          <TouchableOpacity 
            onPress={handleGitHubLogin} 
            style={[styles.loginButton, { backgroundColor: theme.card }]}
          >
            <Image
              source={{ uri: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' }}
              style={styles.githubIcon}
            />
            <Text style={[styles.githubText, { color: theme.text }]}>Login</Text>
          </TouchableOpacity>

          {/* Center Title */}
          <View style={styles.headerCenter}>
            <Text style={[styles.headerText, { color: '#E53935' }]}>Supervisor Portal</Text>
            <Text style={[styles.subHeader, { color: '#d40808ff' }]}>
              {supervisorData ? `Welcome, ${supervisorData.email.split('@')[0]}` : 'Loading...'}
            </Text>
          </View>

          {/* Theme Toggle Right */}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.themeToggleButton, { backgroundColor: theme.card, borderColor: theme.text }]}
          >
            <Ionicons
              name={selectedTheme === 'light' ? 'moon' : 'sunny'}
              size={22}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {/* Cards */}
            <View style={styles.cardsContainer}>
              {buttons.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  onPressIn={() => setPressedButton(index)}
                  onPressOut={() => setPressedButton(null)}
                  onPress={() => navigation.navigate(item.screen, { email })}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.card,
                      transform: [{ translateY: pressedButton === index ? 4 : 0 }],
                      shadowColor: theme.primary,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={[styles.iconContainer]}>
  <Ionicons name={item.icon} style={styles.iconStyle} />
</View>
                    <Text style={[styles.cardText, { color: theme.text }]}>{item.title}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.secondary} style={{ opacity: 0.7 }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Logout Button */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out" size={20} color="#FFF" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },

  scrollContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 60, 
    paddingTop: 50 
  },

  // Header
  headerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
    position: 'relative',
  },
  headerCenter: { 
    flex: 1, 
    alignItems: 'center' 
  },
  headerText: { 
    fontSize: 26, 
    fontWeight: '800', 
    
  },
  subHeader: { 
    fontSize:17,
    marginTop: 3, 
    opacity: 0.8 
  },

  // Login Button (top left)
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00000020',
  },
  githubIcon: { 
    width: 22, 
    height: 22, 
    marginRight: 6 
  },
  githubText: { 
    fontSize: 14, 
    fontWeight: '600' 
  },

  // Cards Container
  cardsContainer: { 
    marginBottom: 20 
  },

  // Fancy Card
 card: {
  borderRadius: 30,
  padding: 10,
  marginBottom: 18,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',

  // Soft shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 6,

  backgroundColor: 'rgba(255,255,255,0.95)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.3)',

  // allow child views not to inherit shadow
  overflow: 'visible',
},


  cardContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },

  
    iconContainer: {
  padding: 10,
  borderRadius: 16,
  marginRight: 15,
  justifyContent: 'center',
  alignItems: 'center',
  width: 55,
  height: 55,
},

iconStyle: {
  color: '#E53935', // Fancy red icon color
  fontSize: 22,
},


  cardText: { 
    fontSize: 17,
    fontWeight: '700', 
    color: '#222',
    letterSpacing: 0.5,
    flex: 1 
  },

  // Theme Toggle (top right icon)
  themeToggleButton: {
    padding: 8,
    borderRadius: 20,
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,

    backgroundColor: '#ff4444',
  },
  logoutText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginLeft: 8 
  },
});

export default SupervisorDashboard;

