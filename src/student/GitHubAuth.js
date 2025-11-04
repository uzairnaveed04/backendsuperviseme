import React, { useState, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Image,
  FlatList,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  Alert
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import Octicons from 'react-native-vector-icons/Octicons';
import { authorize } from 'react-native-app-auth';
import { LogBox } from 'react-native';

const { width, height } = Dimensions.get('window');
const CLIENT_ID = 'Ov23liYfRRqZVQ9klJrx';
const CLIENT_SECRET = '52fa429f9841bad57d94f76743e05bb0ed340d01';
const BACKEND_URL = "https://backendsuperviseme.vercel.app";

const config = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUrl: 'superviseme://auth',
  scopes: ['read:user', 'repo'],
  serviceConfiguration: {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
  },
};

// Premium Color Theme
const theme = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8C5A',
  secondary: '#FFD166',
  accent: '#06D6A0',
  background: '#0F172A',
  card: '#1E293B',
  text: '#FFFFFF',
  muted: '#94A3B8',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  gradient: ['#FF6B35', '#FF8C5A'],
  secondaryGradient: ['#FFD166', '#FFB74D'],
  accentGradient: ['#06D6A0', '#00B894'],
  darkGradient: ['#1E293B', '#334155'],
  githubGradient: ['#0d1117', '#161b22', '#0d1117']
};

// Premium Input Component
const PremiumInput = ({ icon, label, placeholder, value, onChangeText, multiline = false, height = 50 }) => (
  <View style={styles.inputContainer}>
    <View style={styles.inputHeader}>
      <Feather name={icon} size={16} color={theme.primary} />
      <Text style={styles.inputLabel}>{label}</Text>
    </View>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      style={[
        styles.input,
        multiline && { height: height, textAlignVertical: 'top' }
      ]}
    />
  </View>
);

// Premium Button Component
const PremiumButton = ({ title, icon, onPress, gradient, loading = false }) => (
  <TouchableOpacity style={styles.premiumButton} onPress={onPress} disabled={loading}>
    <LinearGradient
      colors={gradient}
      style={styles.premiumButtonGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          <Feather name={icon} size={18} color="#FFFFFF" />
          <Text style={styles.premiumButtonText}>{title}</Text>
        </>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

// Repository Card Component
const RepositoryCard = ({ item, onSelect }) => (
  <TouchableOpacity style={styles.repoCard} onPress={onSelect}>
    <LinearGradient
      colors={theme.darkGradient}
      style={styles.repoGradient}
    >
      <View style={styles.repoHeader}>
        <Feather name="folder" size={20} color={theme.primary} />
        <Text style={styles.repoName}>{item.name}</Text>
      </View>
      <TouchableOpacity style={styles.selectButton} onPress={onSelect}>
        <Text style={styles.selectButtonText}>Select</Text>
      </TouchableOpacity>
    </LinearGradient>
  </TouchableOpacity>
);

// Contributor Card Component
const ContributorCard = ({ item }) => (
  <View style={styles.contributorCard}>
    <LinearGradient
      colors={theme.darkGradient}
      style={styles.contributorGradient}
    >
      <Image 
        source={{ uri: item.avatar || item.avatar_url }} 
        style={styles.contributorAvatar} 
      />
      <View style={styles.contributorInfo}>
        <Text style={styles.contributorName}>
          {item.login || 'Unknown'}
        </Text>
        <View style={[
          styles.statusBadge,
          item.status === 'active' ? styles.activeBadge : styles.inactiveBadge
        ]}>
          <Text style={styles.statusText}>
            {item.status || 'contributor'}
          </Text>
        </View>
      </View>
      <View style={styles.contributorStats}>
        <Feather name="git-commit" size={16} color={theme.muted} />
        <Text style={styles.contributorCount}>{item.contributions || 0}</Text>
      </View>
    </LinearGradient>
  </View>
);

const GitHubAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [userData, setUserData] = useState(null);
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');
  const [filePath, setFilePath] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [contributors, setContributors] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [searchResults, setSearchResults] = useState([]);
  const [validatedRepoInfo, setValidatedRepoInfo] = useState(null);
  const [validatedContributors, setValidatedContributors] = useState([]);
  const [hasActiveConnection, setHasActiveConnection] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogType, setDialogType] = useState('info');
  const [dialogAction, setDialogAction] = useState(null);
  const [showClearMenu, setShowClearMenu] = useState(false);
  
  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];

  LogBox.ignoreLogs(['VirtualizedLists should never be nested inside plain ScrollViews']);

  useEffect(() => {
    // Start animations when component mounts
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
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const startRotateAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const showAlert = (title, message, type = 'info', action = null) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogType(type);
    setDialogAction(action);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setDialogAction(null);
  };

  const handleClearScreen = () => {
    Alert.alert(
      'Clear Screen',
      'Are you sure you want to clear all data?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setRepoName('');
            setBranch('main');
            setFilePath('');
            setFileContent('');
            setCommitMessage('');
            setTeamMembers('');
            setContributors([]);
            setSearchResults([]);
            setValidatedRepoInfo(null);
            setValidatedContributors([]);
            setShowClearMenu(false);
            showAlert('Success', 'All fields cleared successfully!', 'success');
          },
        },
      ]
    );
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      startRotateAnimation();
      
      const authState = await authorize(config);
      setAccessToken(authState.accessToken);
      
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
        },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserData({
          username: userData.login,
          avatar: userData.avatar_url,
        });
        await searchRepositories(userData.login);
        rotateAnim.stopAnimation();
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Auth error:', error);
      const msg = error?.message || String(error);
      if (msg.includes('Data intent is null')) {
        showAlert('Authentication failed', 'Auth returned with empty intent. Please check your configuration.', 'error');
      } else if (msg.includes('User cancelled') || msg.includes('User cancelled flow') || msg.includes('AuthorizationException')) {
        showAlert('Authentication cancelled', 'You cancelled the sign-in. Tap Retry to try again.', 'info', 'retry');
      } else {
        showAlert('Error', 'Authentication failed', 'error');
      }
      rotateAnim.stopAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (!auth) {
          console.error('Auth not initialized');
          return;
        }
        
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        const response = await fetch('https://backendsuperviseme.vercel.app/api/student/status', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setHasActiveConnection(result.data.hasActiveConnection);
          } else {
            setHasActiveConnection(false);
          }
        } else {
          setHasActiveConnection(false);
        }
      } catch (e) {
        console.error('Connection check failed', e);
        setHasActiveConnection(false);
      } finally {
        setConnectionChecked(true);
      }
    };
    checkConnection();
  }, [auth?.currentUser]);

  const searchRepositories = async (username) => {
    try {
      if (!auth) {
        showAlert('Error', 'Authentication not initialized', 'error');
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        showAlert('Error', 'Please login first', 'error');
        return;
      }

      console.log('🔍 Searching repositories for owner:', username);
      const token = await user.getIdToken();
      const url = `https://backendsuperviseme.vercel.app/api/repositories/search?owner=${username}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSearchResults(result.data || []);
        } else {
          setSearchResults([]);
          showAlert('Info', result.error || 'No repositories found', 'info');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        setSearchResults([]);

        if (response.status === 404) {
          showAlert('Error', 'API endpoint not found. Please check backend server.', 'error');
        } else if (response.status === 401) {
          showAlert('Error', 'Authentication failed. Please login again.', 'error');
        } else {
          showAlert('Error', `Server error: ${response.status}`, 'error');
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to load repositories', 'error');
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const validateRepo = async () => {
    if (!repoName || !userData?.username) {
      return showAlert('Error', 'Repository name and user data required', 'error');
    }

    setIsLoading(true);
    try {
      if (!auth) {
        throw new Error('Authentication not initialized');
      }
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please login first');
      }

      const firebaseToken = await user.getIdToken();
      console.log('🔍 Validating repository:', repoName, 'for user:', userData.username);

      const requestBody = {
        username: userData.username,
        repoName: repoName
      };

      const res = await fetch(`https://backendsuperviseme.vercel.app/api/validate-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify(requestBody),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned an invalid response');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Validation failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      const repoInfo = data.data?.repository || data.repoInfo;
      const contributors = data.data?.contributors || data.contributors || [];

      setValidatedRepoInfo(repoInfo);
      setValidatedContributors(contributors);
      setContributors(contributors);

      if (contributors && contributors.length > 0) {
        setActiveTab('contributions');
      }

      let alertMessage = `Repository validated successfully!\n\nFound ${contributors.length} contributors.`;
      if (data.contributorsError) {
        alertMessage += `\n\nContributors error: ${data.contributorsError.message || data.contributorsError}`;
      }

      if (data.rateLimit) {
        alertMessage += `\n\nAPI Rate Limit: ${data.rateLimit.remaining}/${data.rateLimit.limit}`;
      }

      showAlert('Success', alertMessage, 'success');

    } catch (error) {
      console.error('Validation error:', error);
      
      let errorDetails = error.message;
      if (error.details?.githubError) {
        errorDetails += `\nGitHub says: ${error.details.githubError}`;
      }
      if (error.details?.rateLimit?.remaining === '0') {
        const resetTime = new Date(error.details.rateLimit.reset * 1000);
        errorDetails += `\n\nRate limit exceeded. Will reset at: ${resetTime}`;
      }

      showAlert('Validation Failed', 
        `Error: ${errorDetails}\n\n` +
        `Possible solutions:\n` +
        `• Check your access token has "repo" scope\n` +
        `• Verify the repository exists and is accessible\n` +
        `• Try again later if rate limited`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const syncRepository = async () => {
    if (!repoName) return showAlert('Error', 'Repository name required', 'error');

    setIsLoading(true);
    try {
      const [repoResponse, contributorsResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${userData.username}/${repoName}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        }),
        fetch(`https://api.github.com/repos/${userData.username}/${repoName}/contributors`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      ]);

      if (!repoResponse.ok || !contributorsResponse.ok) {
        throw new Error('Failed to fetch data from GitHub');
      }

      const repoData = await repoResponse.json();
      const contributors = await contributorsResponse.json();

      if (!auth) {
        throw new Error('Authentication not initialized');
      }
      
      const token = await auth.currentUser.getIdToken();
      const saveResponse = await fetch('https://backendsuperviseme.vercel.app:3000/api/repositories/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repoName: repoData.name,
          owner: userData.username,
          teamMembers: contributors.map(c => c.login),
          repoData: repoData
        })
      });

      const saveResult = await saveResponse.json();

      if (saveResult.success) {
        showAlert('Success', 'Repository synced successfully', 'success');
      } else {
        throw new Error(saveResult.error || 'Failed to save repository');
      }
    } catch (error) {
      showAlert('Error', error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getContributorStats = async () => {
    if (!repoName || !userData?.username) {
      showAlert('Error', 'Repository name and user data required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      console.log('📊 Fetching contributor stats for:', `${userData.username}/${repoName}`);
      
      if (!auth) {
        throw new Error('Authentication not initialized');
      }
      
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(
        `https://backendsuperviseme.vercel.app/api/contributors/${userData.username}/${repoName}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
            Accept: 'application/json'
          }
        }
      );

      if (resp.ok) {
        const json = await resp.json();
        const groups = json.data?.contributors || { active: [], inactive: [] };
        const merged = [
          ...groups.active.map(c => ({ ...c, status: 'active' })),
          ...groups.inactive.map(c => ({ ...c, status: 'inactive' }))
        ];
        setContributors(merged);
        return;
      }

      const response = await fetch(
        `https://api.github.com/repos/${userData.username}/${repoName}/contributors`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json'
          }
        }
      );
      const text = await response.text();
      let contributors;
      try { contributors = JSON.parse(text); } catch { throw new Error(`Invalid response: ${text.substring(0, 100)}...`); }
      if (!response.ok) { throw new Error(contributors.message || 'Failed to fetch contributors'); }
      const formatted = contributors.map(c => ({ login: c.login, avatar_url: c.avatar_url, contributions: c.contributions }));
      setContributors(formatted);

    } catch (error) {
      console.error('Contributors fetch error:', error);
      showAlert('Error', `Failed to get contributors: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!repoName || !filePath || !fileContent) {
      return showAlert('Error', 'Please fill all required fields', 'error');
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/upload-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          githubUsername: userData.username,
          repoName: repoName
            .replace(/https?:\/\/github\.com\/.+\//gi, '')
            .replace(/\.git$/gi, '')
            .trim(),
          filePath: filePath.trim(),
          fileContent,
          commitMessage: commitMessage || 'Code upload from mobile'
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      showAlert('Success', 'File uploaded successfully!', 'success');
    } catch (error) {
      showAlert('Error', error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createTeamRepo = async () => {
    if (!repoName || !teamMembers) {
      return showAlert('Error', 'Repository name and team members are required', 'error');
    }

    if (repoName.length < 3) {
      return showAlert('Invalid Name', 'Repository name must be at least 3 characters long', 'error');
    }

    if (!/^[a-z0-9-]+$/i.test(repoName)) {
      return showAlert(
        'Invalid Name',
        'Repository name can only contain letters, numbers and hyphens',
        'error'
      );
    }

    setIsLoading(true);

    try {
      if (!auth) throw new Error('Authentication not initialized');

      const firebaseIdToken = await auth.currentUser.getIdToken();

      const members = Array.from(new Set(
        teamMembers
          .split(',')
          .map(m => m.trim())
          .filter(m => m.length > 0)
          .map(m => m.toLowerCase())
      ));

      if (members.length === 0) throw new Error('Please enter at least one valid team member');

      showAlert('Processing', 'Creating repository and adding collaborators...', 'info');

      const res = await fetch(`${BACKEND_URL}/create-team-repo`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseIdToken}`
        },
        body: JSON.stringify({
          teamName: repoName,
          members,
          permission: 'push',
          studentUID: auth.currentUser.uid,
          studentGithubAccessToken: accessToken,
          githubUsername: userData.username
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create repository');

      showAlert(
        'Success',
        `🎉 Repository created successfully!\n\n` +
        `Name: ${repoName}\n` +
        `URL: ${data.repo?.url || data.githubUrl || 'Not available'}\n` +
        `Members added: ${data.collaborators?.successful || 0}/${members.length}`,
        'success'
      );

      await searchRepositories(userData.username);

    } catch (error) {
      console.error('Creation error:', error);
      showAlert(
        'Creation Failed',
        error.message.includes('already exists')
          ? `Repository "${repoName}" already exists`
          : error.message,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createPullRequest = async () => {
    if (!repoName || !branch) {
      return showAlert('Error', 'Repository and branch name are required', 'error');
    }

    setIsLoading(true);

    try {
      const branchRes = await fetch(
        `https://api.github.com/repos/${userData.username}/${repoName}/branches/${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json'
          }
        }
      );

      if (!branchRes.ok) {
        throw new Error(`Branch "${branch}" doesn't exist in ${repoName}`);
      }

      const prRes = await fetch(`${BACKEND_URL}/create-pr`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          githubUsername: userData.username,
          repo: repoName,
          title: commitMessage || `Changes from ${branch}`,
          head: branch,
          base: 'main',
          accessToken
        }),
      });

      const responseText = await prRes.text();
      let prData;

      try {
        prData = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 100)}...`);
      }

      if (!prRes.ok) {
        throw new Error(prData.error || 'PR creation failed');
      }

      showAlert(
        'PR Created!',
        `Successfully created PR #${prData.pr_number}\n\n${prData.url}`,
        'success'
      );

    } catch (error) {
      console.error('PR Creation Failed:', {
        error: error.message,
        repo: repoName,
        branch,
        user: userData?.username
      });

      showAlert(
        'PR Failed',
        error.message.includes('Unexpected token')
          ? 'Server error - please check backend logs'
          : error.message,
        'error'
      );

    } finally {
      setIsLoading(false);
    }
  };

  const clearValidatedData = () => {
    setValidatedRepoInfo(null);
    setValidatedContributors([]);
  };

  // Loading state UI
  if (isLoading) {
    return (
      <LinearGradient colors={theme.githubGradient} style={styles.center}>
        <Animated.View style={[styles.loadingContainer, { transform: [{ rotate: rotateInterpolate }] }]}>
          <Octicons name="sync" size={64} color={theme.primary} />
        </Animated.View>
        <Text style={styles.loadingText}>Connecting to GitHub...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <LinearGradient colors={theme.githubGradient} style={styles.backgroundGradient}>
        
        {/* Floating Clear Button */}
        {userData && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setShowClearMenu(!showClearMenu)}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.clearIconContainer, { transform: [{ scale: showClearMenu ? 1.1 : 1 }] }]}>
              <Feather name="trash-2" size={24} color="#FFFFFF" />
            </Animated.View>
          </TouchableOpacity>
        )}

        {/* Clear Menu Modal */}
        {showClearMenu && (
          <TouchableOpacity 
            style={styles.clearMenuOverlay}
            onPress={() => setShowClearMenu(false)}
            activeOpacity={1}
          >
            <Animated.View 
              style={[
                styles.clearMenu,
                { 
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }] 
                }
              ]}
            >
              <TouchableOpacity 
                style={styles.clearMenuItem}
                onPress={handleClearScreen}
              >
                <Feather name="trash" size={20} color={theme.error} />
                <Text style={styles.clearMenuText}>Clear All Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.clearMenuItem}
                onPress={() => {
                  setRepoName('');
                  setFilePath('');
                  setFileContent('');
                  setShowClearMenu(false);
                }}
              >
                <Feather name="file-text" size={20} color={theme.warning} />
                <Text style={styles.clearMenuText}>Clear Forms</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.clearMenuItem}
                onPress={() => {
                  setSearchResults([]);
                  setValidatedRepoInfo(null);
                  setValidatedContributors([]);
                  setShowClearMenu(false);
                }}
              >
                <Feather name="database" size={20} color={theme.accent} />
                <Text style={styles.clearMenuText}>Clear Cache</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        )}

        <ScrollView 
          contentContainerStyle={styles.container} 
          nestedScrollEnabled={true} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={{
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }}
          >
            {userData ? (
              <>
                {/* Premium Header */}
                <View style={styles.header}>
                  <LinearGradient
                    colors={theme.gradient}
                    style={styles.headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.userInfo}>
                      <View style={styles.avatarContainer}>
                        <Image source={{ uri: userData.avatar }} style={styles.avatar} />
                        <View style={styles.verifiedBadge}>
                          <Feather name="check" size={16} color="#FFFFFF" />
                        </View>
                      </View>
                      <View style={styles.userText}>
                        <Text style={styles.username}>Welcome, {userData.username}!</Text>
                        <Text style={styles.subtitle}>GitHub Repository Manager</Text>
                      </View>
                      <View style={styles.connectionStatus}>
                        <View style={[styles.statusDot, hasActiveConnection ? styles.statusActive : styles.statusInactive]} />
                        <Text style={styles.statusText}>
                          {hasActiveConnection ? 'Connected' : 'No Connection'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Premium Tabs */}
                <View style={styles.tabContainer}>
                  {[
                    { key: 'upload', icon: 'upload', label: 'Upload' },
                    { key: 'team', icon: 'users', label: 'Team' },
                    { key: 'contributions', icon: 'bar-chart', label: 'Stats' }
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.tabButton,
                        activeTab === tab.key && styles.activeTab
                      ]}
                      onPress={() => setActiveTab(tab.key)}
                    >
                      <LinearGradient
                        colors={activeTab === tab.key ? theme.gradient : ['transparent', 'transparent']}
                        style={styles.tabGradient}
                      >
                        <Feather 
                          name={tab.icon} 
                          size={20} 
                          color={activeTab === tab.key ? '#FFFFFF' : theme.muted} 
                        />
                        <Text style={[
                          styles.tabText,
                          activeTab === tab.key && styles.activeTabText
                        ]}>
                          {tab.label}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Tab Content */}
                <View style={styles.tabContent}>
                  {activeTab === 'upload' && (
                    <Animated.View style={styles.tabSection}>
                      <PremiumInput
                        icon="folder"
                        label="Repository Name"
                        placeholder="my-repo"
                        value={repoName}
                        onChangeText={setRepoName}
                      />
                      <PremiumInput
                        icon="git-branch"
                        label="Branch"
                        placeholder="main"
                        value={branch}
                        onChangeText={setBranch}
                      />
                      <PremiumInput
                        icon="file"
                        label="File Path"
                        placeholder="src/App.js"
                        value={filePath}
                        onChangeText={setFilePath}
                      />
                      <PremiumInput
                        icon="code"
                        label="File Content"
                        placeholder="Your code here..."
                        value={fileContent}
                        onChangeText={setFileContent}
                        multiline
                        height={120}
                      />
                      <PremiumInput
                        icon="message-square"
                        label="Commit Message"
                        placeholder="Describe changes"
                        value={commitMessage}
                        onChangeText={setCommitMessage}
                      />
                      
                      <View style={styles.buttonGrid}>
                        <PremiumButton
                          title="Upload to GitHub"
                          icon="upload"
                          onPress={handleUpload}
                          gradient={theme.gradient}
                        />
                        <PremiumButton
                          title="Create PR"
                          icon="git-pull-request"
                          onPress={createPullRequest}
                          gradient={theme.accentGradient}
                        />
                      </View>
                    </Animated.View>
                  )}

                  {activeTab === 'team' && (
                    <Animated.View style={styles.tabSection}>
                      <PremiumInput
                        icon="folder-plus"
                        label="New Repository Name"
                        placeholder="team-project"
                        value={repoName}
                        onChangeText={setRepoName}
                      />
                      <PremiumInput
                        icon="users"
                        label="Team Members (comma separated)"
                        placeholder="user1, user2, user3"
                        value={teamMembers}
                        onChangeText={setTeamMembers}
                      />
                      
                      <View style={styles.buttonGrid}>
                        <PremiumButton
                          title="Create Repo"
                          icon="plus-circle"
                          onPress={createTeamRepo}
                          gradient={[theme.success, '#059669']}
                        />
                        <PremiumButton
                          title="Validate"
                          icon="check-circle"
                          onPress={validateRepo}
                          gradient={[theme.warning, '#D97706']}
                        />
                        <PremiumButton
                          title="Sync"
                          icon="refresh-cw"
                          onPress={syncRepository}
                          gradient={theme.secondaryGradient}
                        />
                      </View>

                      {/* Validated Repository Info */}
                      {validatedRepoInfo && (
                        <View style={styles.validatedSection}>
                          <Text style={styles.sectionTitle}>Validated Repository</Text>
                          <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                              <Feather name="folder" size={16} color={theme.primary} />
                              <Text style={styles.infoText}>Name: {validatedRepoInfo.name}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Feather name="file-text" size={16} color={theme.primary} />
                              <Text style={styles.infoText}>Description: {validatedRepoInfo.description || 'No description'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Feather name={validatedRepoInfo.private ? 'lock' : 'globe'} size={16} color={theme.primary} />
                              <Text style={styles.infoText}>Visibility: {validatedRepoInfo.private ? 'Private' : 'Public'}</Text>
                            </View>
                            
                            <Text style={styles.contributorsTitle}>Contributors ({validatedContributors.length})</Text>
                            <FlatList
                              data={validatedContributors}
                              scrollEnabled={false}
                              keyExtractor={(item) => item.login}
                              renderItem={({ item }) => (
                                <View style={styles.contributorItem}>
                                  <Image source={{ uri: item.avatar_url }} style={styles.smallAvatar} />
                                  <Text style={styles.contributorName}>{item.login}</Text>
                                  <Text style={styles.contributorCount}>{item.contributions} commits</Text>
                                </View>
                              )}
                            />
                            
                            <TouchableOpacity 
                              style={styles.clearDataButton}
                              onPress={clearValidatedData}
                            >
                              <Text style={styles.clearDataText}>Clear Validation Data</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Repository List */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Repositories</Text>
                        <FlatList
                          data={searchResults}
                          scrollEnabled={false}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => (
                            <RepositoryCard item={item} onSelect={() => setRepoName(item.name)} />
                          )}
                          ListEmptyComponent={
                            <View style={styles.emptyState}>
                              <Feather name="folder" size={48} color={theme.muted} />
                              <Text style={styles.emptyText}>No repositories found</Text>
                            </View>
                          }
                        />
                      </View>
                    </Animated.View>
                  )}

                  {activeTab === 'contributions' && (
                    <Animated.View style={styles.tabSection}>
                      <PremiumInput
                        icon="folder"
                        label="Repository Name"
                        placeholder="my-repo"
                        value={repoName}
                        onChangeText={setRepoName}
                      />
                      
                      <PremiumButton
                        title="Refresh Stats"
                        icon="refresh-cw"
                        onPress={getContributorStats}
                        gradient={theme.gradient}
                        loading={isLoading}
                      />

                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contributors</Text>
                        <FlatList
                          data={validatedContributors.length > 0 ? validatedContributors : contributors}
                          scrollEnabled={false}
                          keyExtractor={(item, index) => item.login || `contributor-${index}`}
                          renderItem={({ item }) => <ContributorCard item={item} />}
                          ListEmptyComponent={
                            <View style={styles.emptyState}>
                              <Feather name="users" size={48} color={theme.muted} />
                              <Text style={styles.emptyText}>No contributors found</Text>
                              <Text style={styles.emptySubtext}>Select a repository and click Refresh Stats</Text>
                            </View>
                          }
                        />
                      </View>
                    </Animated.View>
                  )}
                </View>

                {/* Logout Button */}
                <TouchableOpacity 
                  style={styles.logoutButton}
                  onPress={() => { setUserData(null); setAccessToken(''); }}
                >
                  <LinearGradient
                    colors={[theme.error, '#DC2626']}
                    style={styles.logoutGradient}
                  >
                    <Feather name="log-out" size={20} color="#FFFFFF" />
                    <Text style={styles.logoutText}>Logout</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              /* Auth Screen */
              <View style={styles.authContainer}>
                <Animated.View style={[styles.authCard, { transform: [{ scale: scaleAnim }] }]}>
                  <LinearGradient
                    colors={theme.gradient}
                    style={styles.authGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.authHeader}>
                      <Octicons name="mark-github" size={80} color="#FFFFFF" />
                      <Text style={styles.welcomeTitle}>GitHub Manager</Text>
                      <Text style={styles.welcomeSubtitle}>
                        Connect your GitHub account to manage repositories and collaborate with your team
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.loginButton}
                      onPress={handleLogin}
                    >
                      <LinearGradient
                        colors={['#FFFFFF', '#F3F4F6']}
                        style={styles.loginGradient}
                      >
                        <Octicons name="mark-github" size={24} color="#000000" />
                        <Text style={styles.loginButtonText}>Continue with GitHub</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Premium Dialog Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDialog}
          onRequestClose={closeDialog}
        >
          <View style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.modalContainer,
                { transform: [{ scale: scaleAnim }] }
              ]}
            >
              <LinearGradient
                colors={dialogType === 'error' ? [theme.error, '#DC2626'] : 
                       dialogType === 'success' ? theme.accentGradient : 
                       theme.secondaryGradient}
                style={styles.modalGradient}
              >
                <View style={styles.modalIcon}>
                  {dialogType === 'error' && <Feather name="alert-circle" size={48} color="#FFFFFF" />}
                  {dialogType === 'success' && <Feather name="check-circle" size={48} color="#FFFFFF" />}
                  {dialogType === 'info' && <Feather name="info" size={48} color="#FFFFFF" />}
                </View>
                <Text style={styles.modalTitle}>{dialogTitle}</Text>
                <Text style={styles.modalMessage}>{dialogMessage}</Text>
                
                {dialogAction === 'retry' ? (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.retryButton]}
                      onPress={() => { closeDialog(); handleLogin(); }}
                    >
                      <Text style={styles.modalButtonText}>Retry</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={closeDialog}
                    >
                      <Text style={styles.modalButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={closeDialog}
                  >
                    <Text style={styles.modalButtonText}>OK</Text>
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  backgroundGradient: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    marginBottom: 20,
  },
  loadingText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  
  // Clear Button Styles
  clearButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  clearIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 110,
    paddingLeft: 20,
  },
  clearMenu: {
    backgroundColor: theme.card,
    borderRadius: 15,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 180,
  },
  clearMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clearMenuText: {
    color: theme.text,
    marginLeft: 12,
    fontWeight: '600',
    fontSize: 14,
  },

  // Header Styles
  header: {
    marginBottom: 25,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  headerGradient: {
    padding: 25,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userText: {
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusActive: {
    backgroundColor: theme.success,
  },
  statusInactive: {
    backgroundColor: theme.muted,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 15,
    padding: 8,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeTab: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tabText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  // Tab Content
  tabContent: {
    flex: 1,
  },
  tabSection: {
    marginBottom: 20,
  },

  // Input Styles
  inputContainer: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    color: theme.text,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: theme.text,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Button Styles
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  premiumButton: {
    flex: 1,
    minWidth: '48%',
    marginHorizontal: 4,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },

  // Section Styles
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  validatedSection: {
    marginTop: 20,
  },
  infoCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    color: theme.text,
    marginLeft: 8,
    fontSize: 14,
  },
  contributorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 12,
    marginBottom: 8,
  },
  contributorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 6,
  },
  smallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
  },
  contributorName: {
    color: theme.text,
    flex: 1,
    fontWeight: '500',
  },
  contributorCount: {
    color: theme.muted,
    fontSize: 12,
  },
  clearDataButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  clearDataText: {
    color: theme.error,
    fontWeight: '600',
    fontSize: 14,
  },

  // Repository Card
  repoCard: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  repoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  repoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  repoName: {
    color: theme.text,
    fontWeight: '600',
    marginLeft: 12,
    fontSize: 16,
  },
  selectButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },

  // Contributor Card
  contributorCard: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  contributorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contributorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  contributorInfo: {
    flex: 1,
  },
  contributorName: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  inactiveBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  contributorStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contributorCount: {
    color: theme.muted,
    marginLeft: 6,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: theme.card,
    borderRadius: 12,
    marginVertical: 10,
  },
  emptyText: {
    color: theme.muted,
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: theme.muted,
    marginTop: 4,
    fontSize: 14,
    textAlign: 'center',
  },

  // Logout Button
  logoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: theme.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },

  // Auth Styles
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authCard: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  authGradient: {
    padding: 40,
    alignItems: 'center',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  loginButton: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 15,
  },
  loginButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    marginLeft: 12,
    fontSize: 18,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContainer: {
    width: width * 0.85,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  modalGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default GitHubAuth;