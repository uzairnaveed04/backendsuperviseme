import React, { useState, useEffect } from 'react';
import {
  View,
  Button,
  ActivityIndicator,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Image,
  FlatList,
  Modal,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { auth, db } from '../../firebaseConfig'; // Import auth from your config
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
// REMOVE THIS LINE: import { getAuth } from 'firebase/auth';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Octicons from 'react-native-vector-icons/Octicons';
import { authorize } from 'react-native-app-auth';
import { LogBox } from 'react-native';

const { width } = Dimensions.get('window');
const CLIENT_ID = 'Ov23liYfRRqZVQ9klJrx';
const CLIENT_SECRET = '52fa429f9841bad57d94f76743e05bb0ed340d01';
const BACKEND_URL = "http://192.168.10.8:3000";

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

export default function GitHubAuth() {
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

  // REMOVE THIS LINE: const auth = getAuth();
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews'
]);
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

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const authState = await authorize(config);
      setAccessToken(authState.accessToken);
      
      // Fetch user data from GitHub
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
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      // Better guidance for the common Android error "Data intent is null"
      console.error('Auth error:', error);
      const msg = error?.message || String(error);
      if (msg.includes('Data intent is null')) {
        showAlert('Authentication failed', 'Auth returned with empty intent. On Android you must add an intent-filter in AndroidManifest.xml that matches the redirect URI scheme (see console for snippet). Then rebuild the app.', 'error');
      } else if (msg.includes('User cancelled') || msg.includes('User cancelled flow') || msg.includes('AuthorizationException')) {
        // User cancelled the auth flow — offer a retry
        showAlert('Authentication cancelled', 'You cancelled the sign-in. Tap Retry to try again.', 'info', 'retry');
      } else {
        showAlert('Error', 'Authentication failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Add safety check for auth
        if (!auth) {
          console.error('Auth not initialized');
          return;
        }
        
        const user = auth.currentUser;
        if (!user) return;

        // Use backend API to check connection status
        const token = await user.getIdToken();
        const response = await fetch('http://192.168.10.8:3000/api/student/status', {
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
  }, [auth?.currentUser]); // Add optional chaining

  const searchRepositories = async (username) => {
    try {
      // Use backend API to search repositories
      // Add safety check for auth
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
      const url = `http://192.168.10.8:3000/api/repositories/search?owner=${username}`;
      console.log('🔗 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Response status:', response.status);
      console.log('📊 Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ API Response:', result);
        if (result.success) {
          setSearchResults(result.data || []);
          console.log('📊 Found repositories:', result.data?.length || 0);
        } else {
          setSearchResults([]);
          showAlert('Info', result.error || 'No repositories found', 'info');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        setSearchResults([]);

        // Show more specific error message
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
      // Use Firebase auth token instead of GitHub access token
      // Add safety check for auth
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
      console.log('📤 Request body:', requestBody);

      const res = await fetch(`http://192.168.10.8:3000/api/validate-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📊 Validation response status:', res.status);

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned an invalid response');
      }

      const data = await res.json();
      console.log('📥 Response data:', data);

      if (!res.ok) {
        console.error('❌ API Error:', data);
        console.error('❌ Required fields:', data.required);
        console.error('❌ Missing fields details:', JSON.stringify(data, null, 2));
        throw new Error(data.error || data.message || 'Validation failed');
      }

      if (!data.success) {
        console.error('❌ Validation failed:', data.error);
        throw new Error(data.error || 'Validation failed');
      }

      // Extract data from backend response
      const repoInfo = data.data?.repository || data.repoInfo;
      const contributors = data.data?.contributors || data.contributors || [];

      console.log('✅ Repository info:', repoInfo);
      console.log('✅ Contributors:', contributors.length);

      setValidatedRepoInfo(repoInfo);
      setValidatedContributors(contributors);

      // ✅ Also update the main contributors state for display
      setContributors(contributors);
      console.log('📊 Updated contributors state with', contributors.length, 'contributors:', contributors);

      // ✅ Auto switch to Stats tab to show the fetched contributors
      if (contributors && contributors.length > 0) {
        setActiveTab('contributions');
        console.log('🔄 Auto-switched to Stats tab to show', contributors.length, 'contributors');

        // ✅ Force refresh the contributors display in Stats section
        setTimeout(() => {
          console.log('🔄 Contributors state after timeout:', contributors.length);
          console.log('🔄 Current activeTab:', 'contributions');
        }, 500);
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

      // Use backend API to save repository data
      // Add safety check for auth
      if (!auth) {
        throw new Error('Authentication not initialized');
      }
      
      const token = await auth.currentUser.getIdToken();
      const saveResponse = await fetch('http://192.168.10.8:3000/api/repositories/save', {
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
      
      // Add safety check for auth
      if (!auth) {
        throw new Error('Authentication not initialized');
      }
      
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(
        `http://192.168.10.8:3000/api/contributors/${userData.username}/${repoName}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
            Accept: 'application/json'
          }
        }
      );

      console.log('📊 Contributors response status:', resp.status);

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
    <LinearGradient colors={['#0d1117', '#161b22']} style={styles.center}>
      <ActivityIndicator size="large" color="#58a6ff" />
      <Text style={{ marginTop: 10, color: '#c9d1d9' }}>Processing...</Text>
    </LinearGradient>
  );
}


  return (
    <LinearGradient colors={['#0d1117', '#161b22']} style={styles.mainContainer}>
  <ScrollView contentContainerStyle={styles.container} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
        {userData ? (
          <>
            <View style={styles.header}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: userData.avatar }} style={styles.avatar} />
                  <Icon name="verified" size={24} color="#58a6ff" style={styles.verifiedIcon} />
                </View>
                <Text style={styles.username}>Welcome, {userData.username}!</Text>
                <Text style={styles.subtitle}>GitHub Uploader</Text>
              </View>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'upload' && styles.activeTab]}
                onPress={() => setActiveTab('upload')}
              >
                <Octicons name="upload" size={20} color={activeTab === 'upload' ? '#ffffff' : '#8b949e'} />
                <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'team' && styles.activeTab]}
                onPress={() => setActiveTab('team')}
              >
                <FontAwesome name="users" size={20} color={activeTab === 'team' ? '#ffffff' : '#8b949e'} />
                <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>Team</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'contributions' && styles.activeTab]}
                onPress={() => { setActiveTab('contributions'); getContributorStats(); }}
              >
                <FontAwesome name="line-chart" size={20} color={activeTab === 'contributions' ? '#ffffff' : '#8b949e'} />
                <Text style={[styles.tabText, activeTab === 'contributions' && styles.activeTabText]}>Stats</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'upload' && (
              <View style={styles.card}>
                <Text style={styles.label}><Octicons name="repo" size={16} color="#58a6ff" /> Repository Name</Text>
                <TextInput 
                  placeholder="my-repo" 
                  placeholderTextColor="#6e7681" 
                  value={repoName} 
                  onChangeText={setRepoName} 
                  style={styles.input} 
                />
                <Text style={styles.label}><Octicons name="git-branch" size={16} color="#58a6ff" /> Branch</Text>
                <TextInput 
                  placeholder="main" 
                  placeholderTextColor="#6e7681" 
                  value={branch} 
                  onChangeText={setBranch} 
                  style={styles.input} 
                />
                <Text style={styles.label}><Octicons name="file" size={16} color="#58a6ff" /> File Path</Text>
                <TextInput 
                  placeholder="src/App.js" 
                  placeholderTextColor="#6e7681" 
                  value={filePath} 
                  onChangeText={setFilePath} 
                  style={styles.input} 
                />
                <Text style={styles.label}><Octicons name="code" size={16} color="#58a6ff" /> File Content</Text>
                <TextInput 
                  placeholder="Your code here..." 
                  placeholderTextColor="#6e7681" 
                  value={fileContent} 
                  onChangeText={setFileContent} 
                  multiline 
                  style={[styles.input, styles.codeInput]} 
                />
                <Text style={styles.label}><Octicons name="git-commit" size={16} color="#58a6ff" /> Commit Message</Text>
                <TextInput 
                  placeholder="Describe changes" 
                  placeholderTextColor="#6e7681" 
                  value={commitMessage} 
                  onChangeText={setCommitMessage} 
                  style={styles.input} 
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.uploadButton]} onPress={handleUpload}>
                    <Text style={styles.buttonText}><Octicons name="upload" size={16} /> Upload to GitHub</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.prButton]} onPress={createPullRequest}>
                    <Text style={styles.buttonText}><Octicons name="git-pull-request" size={16} /> Create PR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'team' && (
              <View style={styles.card}>
                <Text style={styles.label}><Octicons name="repo-template" size={16} color="#58a6ff" /> New Repository Name</Text>
                <TextInput 
                  placeholder="team-project" 
                  placeholderTextColor="#6e7681" 
                  value={repoName} 
                  onChangeText={setRepoName} 
                  style={styles.input} 
                />
                <Text style={styles.label}><FontAwesome name="users" size={16} color="#58a6ff" /> Team Members (comma separated)</Text>
                <TextInput 
                  placeholder="user1, user2, user3" 
                  placeholderTextColor="#6e7681" 
                  value={teamMembers} 
                  onChangeText={setTeamMembers} 
                  style={styles.input} 
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.createButton]} onPress={createTeamRepo}>
                    <Text style={styles.buttonText}><Octicons name="repo" size={16} /> Create Repo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.validateButton]} onPress={validateRepo}>
                    <Text style={styles.buttonText}><Octicons name="check" size={16} /> Validate</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.syncButton]} onPress={syncRepository}>
                    <Text style={styles.buttonText}><Octicons name="sync" size={16} /> Sync</Text>
                  </TouchableOpacity>
                </View>
                
                {validatedRepoInfo && (
                  <View style={[styles.card, styles.infoCard]}>
                    <Text style={styles.sectionHeader}><Octicons name="info" size={16} color="#58a6ff" /> Validated Repository</Text>
                    <View style={styles.infoRow}>
                      <Octicons name="repo" size={14} color="#8b949e" />
                      <Text style={styles.infoText}>Name: {validatedRepoInfo.name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Octicons name="note" size={14} color="#8b949e" />
                      <Text style={styles.infoText}>Description: {validatedRepoInfo.description || 'No description'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Octicons name={validatedRepoInfo.private ? 'lock' : 'globe'} size={14} color="#8b949e" />
                      <Text style={styles.infoText}>Visibility: {validatedRepoInfo.private ? 'Private' : 'Public'}</Text>
                    </View>

                    <Text style={styles.sectionHeader}><Octicons name="people" size={16} color="#58a6ff" /> Contributors</Text>
                    <FlatList
                      data={validatedContributors}
                      nestedScrollEnabled={true}
                      scrollEnabled={false}
                      keyExtractor={(item) => item.login}
                      renderItem={({ item }) => (
                        <View style={styles.contributorCard}>
                          <Image source={{ uri: item.avatar_url }} style={styles.smallAvatar} />
                          <View style={styles.contributorInfo}>
                            <Text style={styles.contributorName}>{item.login}</Text>
                            <Text style={styles.contributorType}>Contributor</Text>
                          </View>
                          <View style={styles.contributorStats}>
                            <Octicons name="git-commit" size={14} color="#8b949e" />
                            <Text style={styles.contributorCount}>{item.contributions || 0}</Text>
                          </View>
                        </View>
                      )}
                    />
                    <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearValidatedData}>
                      <Text style={styles.buttonText}><Octicons name="trash" size={16} /> Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text style={styles.sectionHeader}><Octicons name="bookmark" size={16} color="#58a6ff" /> Your Repositories</Text>
                <FlatList
                  data={searchResults}
                  nestedScrollEnabled={true}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.repoItem}>
                      <Octicons name="repo" size={16} color="#58a6ff" style={styles.repoIcon} />
                      <Text style={styles.repoName}>{item.name}</Text>
                      <TouchableOpacity style={styles.selectButton} onPress={() => setRepoName(item.name)}>
                        <Text style={styles.selectButtonText}>Select</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Octicons name="repo" size={32} color="#6e7681" />
                      <Text style={styles.emptyText}>No repositories found</Text>
                    </View>
                  }
                />
              </View>
            )}

            {activeTab === 'contributions' && (
              <View style={styles.card}>
                <Text style={styles.label}><Octicons name="repo" size={16} color="#58a6ff" /> Repository Name</Text>
                <TextInput 
                  placeholder="my-repo" 
                  placeholderTextColor="#6e7681" 
                  value={repoName} 
                  onChangeText={setRepoName} 
                  style={styles.input} 
                />
                <TouchableOpacity style={[styles.actionButton, styles.refreshButton]} onPress={getContributorStats} disabled={isLoading}>
                  <Text style={styles.buttonText}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Octicons name="sync" size={16} /> Refresh Stats
                      </>
                    )}
                  </Text>
                </TouchableOpacity>
                
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#58a6ff" />
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionHeader}><Octicons name="graph" size={16} color="#58a6ff" /> Contributors</Text>
                    {console.log('📊 Stats section rendering with:', {
                      validatedContributors: validatedContributors.length,
                      contributors: contributors.length,
                      usingData: validatedContributors.length > 0 ? 'validatedContributors' : 'contributors'
                    })}
                    <FlatList
                      data={validatedContributors.length > 0 ? validatedContributors : contributors}
                      nestedScrollEnabled={true}
                      keyExtractor={(item, index) =>
                        item.author?.login ||
                        item.login ||
                        `contributor-${index}`
                      }
                      renderItem={({ item }) => (
                        <View style={styles.contributorCard}>
                          <Image 
                            source={{ uri: item.avatar || item.avatar_url || item.author?.avatar_url }} 
                            style={styles.smallAvatar} 
                          />
                          <View style={styles.contributorInfo}>
                            <Text style={styles.contributorName}>
                              {item.login || item.author?.login || 'Unknown'}
                            </Text>
                            <Text style={[
                              styles.contributorStatus,
                              item.status === 'active' ? styles.activeStatus : styles.inactiveStatus
                            ]}>
                              {item.status || 'contributor'}
                            </Text>
                          </View>
                          <View style={styles.contributorStats}>
                            <Octicons name="git-commit" size={14} color="#8b949e" />
                            <Text style={styles.contributorCount}>{item.contributions || item.total || 0}</Text>
                          </View>
                        </View>
                      )}
                      ListEmptyComponent={
                        <View style={styles.emptyState}>
                          <Octicons name="person" size={32} color="#6e7681" />
                          <Text style={styles.emptyText}>No contributors found</Text>
                        </View>
                      }
                    />
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={() => { setUserData(null); setAccessToken(''); }}>
              <Text style={styles.logoutButtonText}><Octicons name="sign-out" size={16} /> Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.authContainer}>
            <Octicons name="mark-github" size={64} color="#58a6ff" style={styles.githubLogo} />
            <Text style={styles.welcomeTitle}>GitHub Uploader</Text>
            <Text style={styles.welcomeSubtitle}>Connect your GitHub account to get started</Text>
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}><Octicons name="sign-in" size={16} /> Login with GitHub</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showDialog}
        onRequestClose={closeDialog}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            dialogType === 'error' && styles.errorModal,
            dialogType === 'success' && styles.successModal,
            dialogType === 'info' && styles.infoModal
          ]}>
            <View style={styles.modalHeader}>
              {dialogType === 'error' && <Octicons name="alert" size={24} color="#f85149" />}
              {dialogType === 'success' && <Octicons name="check-circle" size={24} color="#238636" />}
              {dialogType === 'info' && <Octicons name="info" size={24} color="#58a6ff" />}
              <Text style={styles.modalTitle}>{dialogTitle}</Text>
            </View>
            <Text style={styles.modalMessage}>{dialogMessage}</Text>
            {dialogAction === 'retry' ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.infoButton, { flex: 1, marginRight: 8 }]}
                  onPress={() => { closeDialog(); handleLogin(); }}
                >
                  <Text style={styles.modalButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.errorButton, { flex: 1 }]}
                  onPress={closeDialog}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  dialogType === 'error' && styles.errorButton,
                  dialogType === 'success' && styles.successButton,
                  dialogType === 'info' && styles.infoButton
                ]}
                onPress={closeDialog}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingBottom:20,
    paddingTop:20
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    marginBottom: 24,
    alignItems: 'center'
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20
  },
  avatarContainer: {
    position: 'relative'
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#30363d'
  },
  verifiedIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0d1117',
    borderRadius: 12,
    padding: 2
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#c9d1d9'
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    marginTop: 4
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 8
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  activeTab: {
    backgroundColor: '#1f6feb'
  },
  tabText: {
    marginLeft: 8,
    color: '#8b949e',
    fontWeight: '600'
  },
  activeTabText: {
    color: '#ffffff'
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  infoCard: {
    marginTop: 16
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#c9d1d9',
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    fontSize: 14
  },
  codeInput: {
    height: 150,
    fontFamily: 'monospace',
    textAlignVertical: 'top'
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4
  },
  uploadButton: {
    backgroundColor: '#238636'
  },
  prButton: {
    backgroundColor: '#1f6feb'
  },
  createButton: {
    backgroundColor: '#238636'
  },
  validateButton: {
    backgroundColor: '#ffa500'
  },
  syncButton: {
    backgroundColor: '#1f6feb'
  },
  refreshButton: {
    backgroundColor: '#1f6feb',
    marginBottom: 16
  },
  clearButton: {
    backgroundColor: '#f85149',
    marginTop: 12
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14
  },
  contributorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0d1117',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  contributorInfo: {
    flex: 1
  },
  contributorName: {
    color: '#c9d1d9',
    fontWeight: '600'
  },
  contributorType: {
    color: '#8b949e',
    fontSize: 12
  },
  contributorStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4
  },
  activeStatus: {
    backgroundColor: 'rgba(46, 160, 67, 0.1)',
    color: '#3fb950'
  },
  inactiveStatus: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    color: '#f85149'
  },
  contributorStats: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  contributorCount: {
    color: '#8b949e',
    marginLeft: 4,
    fontSize: 14
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 12,
    color: '#c9d1d9',
    flexDirection: 'row',
    alignItems: 'center'
  },
  repoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0d1117',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  repoIcon: {
    marginRight: 12
  },
  repoName: {
    flex: 1,
    color: '#c9d1d9',
    fontWeight: '500'
  },
  selectButton: {
    backgroundColor: '#238636',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  selectButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  infoText: {
    color: '#8b949e',
    marginLeft: 8,
    fontSize: 14
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32
  },
  emptyText: {
    color: '#6e7681',
    marginTop: 8,
    fontSize: 14
  },
  loadingContainer: {
    paddingVertical: 32
  },
  logoutButton: {
    backgroundColor: '#f85149',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  githubLogo: {
    marginBottom: 24
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c9d1d9',
    marginBottom: 8,
    textAlign: 'center'
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#8b949e',
    marginBottom: 32,
    textAlign: 'center'
  },
  loginButton: {
    backgroundColor: '#238636',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center'
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13,17,23,0.8)'
  },
  modalContainer: {
    width: width * 0.85,
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363d'
  },
  errorModal: {
    borderTopWidth: 4,
    borderTopColor: '#f85149'
  },
  successModal: {
    borderTopWidth: 4,
    borderTopColor: '#238636'
  },
  infoModal: {
    borderTopWidth: 4,
    borderTopColor: '#58a6ff'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#c9d1d9'
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    color: '#8b949e',
    lineHeight: 24
  },
  modalButton: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center'
  },
  errorButton: {
    backgroundColor: '#f85149'
  },
  successButton: {
    backgroundColor: '#238636'
  },
  infoButton: {
    backgroundColor: '#1f6feb'
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});