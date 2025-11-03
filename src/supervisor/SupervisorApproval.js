import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, ActivityIndicator, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { getAuth } from 'firebase/auth';

const SupervisorDashboard = () => {
  const BACKEND_URL = "http://192.168.10.4:3000";
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [idToken, setIdToken] = useState('');

  const fetchAllRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      // Ensure we have a fresh Firebase ID token
      const user = getAuth().currentUser;
      const token = await user?.getIdToken?.();
      if (!token) throw new Error('Missing auth token');
      setIdToken(token);
      
      const response = await fetch(
        `${BACKEND_URL}/api/supervisor/all-repos`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Invalid response');
      }

      setRepositories(result.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRepositories();
  }, []);

  if (loading && !selectedRepo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#238636" />
        <Text style={styles.loadingText}>Loading repositories...</Text>
      </View>
    );
  }

  if (error && !selectedRepo) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️ Error</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity onPress={fetchAllRepositories}>
          <Text style={styles.retryButton}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (selectedRepo) {
    return (
      <RepositoryDetail 
        repo={selectedRepo}
        onBack={() => setSelectedRepo(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>All Repositories</Text>
      <FlatList
        data={repositories}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.repoCard}
            onPress={() => setSelectedRepo(item)}
          >
            <Image 
              source={{ uri: 'https://github.githubassets.com/favicons/favicon.png' }}
              style={styles.repoIcon}
            />
            <View style={styles.repoInfo}>
              <Text style={styles.repoName}>{item.name}</Text>
              <Text style={styles.ownerText}>Owner: {item.owner}</Text>
              <Text style={styles.memberText}>
                Members: {item.memberCount || 0}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No repositories found</Text>
        }
      />
    </View>
  );
};

const RepositoryDetail = ({ repo, onBack }) => {
  const [contributors, setContributors] = useState({ active: [], inactive: [] });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState({
    contributors: true,
    activities: true
  });
  const [error, setError] = useState(null);
  const [idToken, setIdToken] = useState('');

  const fetchRepoData = async () => {
    try {
      setLoading({ contributors: true, activities: true });
      setError(null);
      const user = getAuth().currentUser;
      const token = await user?.getIdToken?.();
      if (!token) throw new Error('Missing auth token');
      setIdToken(token);
      
      // Fetch contributors
      const contributorsRes = await fetch(
        `${BACKEND_URL}/api/supervisor/repo-data/${repo.owner}/${repo.name}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const contributorsData = await contributorsRes.json();
      
      // Fetch activities
      const activitiesRes = await fetch(
        `${BACKEND_URL}/api/supervisor/repo-activity/${repo.owner}/${repo.name}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const activitiesData = await activitiesRes.json();

      if (contributorsData.success) {
        setContributors(contributorsData.data.contributors);
      }
      
      if (activitiesData.success) {
        setActivities(activitiesData.data);
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading({ contributors: false, activities: false });
    }
  };

  useEffect(() => {
    fetchRepoData();
  }, [repo]);

  const handleOpenUrl = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Back to All Repositories</Text>
      </TouchableOpacity>

      {/* Repository Header */}
      <View style={styles.repoHeader}>
        <Image 
          source={{ uri: 'https://github.githubassets.com/favicons/favicon.png' }}
          style={styles.repoIconLarge}
        />
        <View>
          <Text style={styles.repoTitle}>{repo.name}</Text>
          <Text style={styles.repoSubtitle}>Owner: {repo.owner}</Text>
          <TouchableOpacity onPress={() => handleOpenUrl(repo.githubUrl)}>
            <Text style={styles.repoUrl}>{repo.githubUrl}</Text>
          </TouchableOpacity>
          <Text style={styles.repoMeta}>
            Created: {new Date(repo.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Contributors Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Contributors ({contributors.total || contributors.active.length + contributors.inactive.length})
        </Text>
        {loading.contributors ? (
          <ActivityIndicator size="small" color="#238636" />
        ) : (
          <>
            <Text style={styles.subsectionTitle}>Active ({contributors.active.length})</Text>
            {contributors.active.length > 0 ? (
              <FlatList
                horizontal
                data={contributors.active}
                keyExtractor={item => item.username}
                renderItem={({ item }) => (
                  <View style={styles.contributorCard}>
                    <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.commitText}>{item.commits} commits</Text>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.emptyText}>No active contributors</Text>
            )}

            <Text style={[styles.subsectionTitle, { marginTop: 15 }]}>Inactive ({contributors.inactive.length})</Text>
            {contributors.inactive.length > 0 ? (
              <FlatList
                horizontal
                data={contributors.inactive}
                keyExtractor={item => item.username}
                renderItem={({ item }) => (
                  <View style={styles.contributorCard}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.inactiveText}>No commits</Text>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.emptyText}>All members are active</Text>
            )}
          </>
        )}
      </View>

      {/* Recent Activity Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Recent Activity ({activities.length})
        </Text>
        {loading.activities ? (
          <ActivityIndicator size="small" color="#238636" />
        ) : activities.length > 0 ? (
          <FlatList
            data={activities}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.activityCard}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityAction}>{item.action}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.activityFile}>{item.filePath}</Text>
                <Text style={styles.activityCommitter}>by {item.committer}</Text>
                <TouchableOpacity onPress={() => handleOpenUrl(item.commitUrl)}>
                  <Text style={styles.activityLink}>View Commit</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <Text style={styles.emptyText}>No recent activity</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#24292e',
  },
  repoCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  repoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  repoInfo: {
    flex: 1,
  },
  repoName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24292e',
  },
  ownerText: {
    fontSize: 14,
    color: '#586069',
    marginTop: 4,
  },
  memberText: {
    fontSize: 14,
    color: '#0366d6',
    marginTop: 4,
  },
  backButton: {
    padding: 10,
    marginBottom: 10,
  },
  backText: {
    color: '#0366d6',
    fontSize: 16,
    fontWeight: '500',
  },
  repoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  repoIconLarge: {
    width: 60,
    height: 60,
    marginRight: 16,
  },
  repoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#24292e',
  },
  repoSubtitle: {
    fontSize: 16,
    color: '#586069',
    marginTop: 4,
  },
  repoUrl: {
    fontSize: 14,
    color: '#0366d6',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  repoMeta: {
    fontSize: 14,
    color: '#586069',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#24292e',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    color: '#586069',
    marginBottom: 8,
  },
  contributorCard: {
    width: 120,
    backgroundColor: '#ffffff',
    padding: 12,
    marginRight: 10,
    borderRadius: 8,
    elevation: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e1e4e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#586069',
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    color: '#24292e',
    textAlign: 'center',
  },
  commitText: {
    fontSize: 12,
    color: '#2c974b',
    textAlign: 'center',
    marginTop: 4,
  },
  inactiveText: {
    fontSize: 12,
    color: '#d73a49',
    textAlign: 'center',
    marginTop: 4,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityAction: {
    fontSize: 16,
    fontWeight: '500',
    color: '#24292e',
  },
  activityTime: {
    fontSize: 12,
    color: '#586069',
  },
  activityFile: {
    fontSize: 14,
    color: '#0366d6',
    marginBottom: 4,
  },
  activityCommitter: {
    fontSize: 12,
    color: '#586069',
    fontStyle: 'italic',
  },
  activityLink: {
    fontSize: 14,
    color: '#0366d6',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  loadingText: {
    marginTop: 10,
    color: '#586069',
  },
  errorText: {
    fontSize: 18,
    color: '#d73a49',
    marginBottom: 8,
  },
  errorDetail: {
    color: '#6a737d',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    color: '#0366d6',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    color: '#6a737d',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
});

export default SupervisorDashboard;