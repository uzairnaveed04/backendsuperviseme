import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity,
  ScrollView,
  Linking,
  RefreshControl,
  StatusBar
} from 'react-native';

import { getAuth } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

// ✅ React Native CLI compatible vector icons
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import Octicons from 'react-native-vector-icons/Octicons';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SupervisorConnectionRequestsScreen = () => {
  const auth = getAuth();
  const navigation = useNavigation();
  const [requests, setRequests] = useState([]);
  const [activeConnections, setActiveConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentRepos, setStudentRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // moved to component scope so RefreshControl/onRefresh can call it
  const fetchRequestsAndConnections = useCallback(async () => {
    if (!auth.currentUser?.email) return;

    try {
      setLoading(true);

      const supervisorEmail = auth.currentUser.email.toLowerCase();
      const safeSupervisorEmail = supervisorEmail.replace(/\./g, '_').replace(/@/g, '_');

      // 1️⃣ Pending Requests - Use backend API
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('http://192.168.100.15:3000/api/connection-requests', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to fetch requests');
        setRequests(result.data);
      } catch (apiError) {
        console.error('API request failed:', apiError);
        throw apiError;
      }

      // 2️⃣ Active Connections - Use backend API
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('http://192.168.100.15:3000/api/connections', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to fetch connections');
        setActiveConnections(result.data);
      } catch (connectionError) {
        console.log('Connection API failed:', connectionError.message);
        setActiveConnections([]);
      }

    } catch (error) {
      console.error('Error fetching requests/connections:', error);
      Alert.alert('Error', 'Failed to load connection requests');
    } finally {
      setLoading(false);
    }
  }, [auth.currentUser, navigation]);

  useEffect(() => {
    fetchRequestsAndConnections();
  }, [fetchRequestsAndConnections]);

  const fetchStudentRepos = async (studentUID) => {
    try {
      setReposLoading(true);
      const token = await auth.currentUser?.getIdToken?.();
      if (token) {
        const resp = await fetch(`http://192.168.100.15:3000/api/student-repositories/${studentUID}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (resp.ok) {
          const json = await resp.json();
          if (json.success) {
            setStudentRepos(json.data || []);
            return;
          }
        }
      }
      console.error('Failed to fetch student repositories via API');
      setStudentRepos([]);
    } catch (err) {
      console.error('Error fetching student repos:', err);
      Alert.alert('Error', 'Failed to load student repositories');
    } finally {
      setReposLoading(false);
    }
  };

  const handleSelectStudent = async (student) => {
    try {
      setSelectedStudent(student);
      const token = await auth.currentUser?.getIdToken?.();
      if (token) {
        await fetch(`${process.env.BACKEND_URL || 'http://192.168.100.15:3000'}/link-student-repos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ studentUID: student.studentUID })
        });
      }
    } catch (e) {
      console.warn('Link repos call failed:', e.message);
    } finally {
      await fetchStudentRepos(student.studentUID);
    }
  };

  useEffect(() => {
    if (!selectedStudent) return;

    // call the outer fetchStudentRepos (no duplicate inner function)
    fetchStudentRepos(selectedStudent.studentUID);
  }, [selectedStudent]);

  const refreshStudentRepos = async () => {
    if (!selectedStudent) return;
    setIsRefreshing(true);
    try { await fetchStudentRepos(selectedStudent.studentUID); }
    finally { setIsRefreshing(false); }
  };

  const handleOpenRepo = async (repoUrl) => {
    try {
      if (repoUrl) await Linking.openURL(repoUrl);
    } catch (e) {
      console.error('Open URL failed', e);
    }
  };

  const fetchContributors = async (owner, name) => {
    try {
      const token = await auth.currentUser?.getIdToken?.();
      if (!token) return { active: [], inactive: [] };
      const resp = await fetch(`${process.env.BACKEND_URL || 'http://192.168.100.15:3000'}/api/supervisor/repo-data/${owner}/${name}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) return { active: [], inactive: [] };
      const json = await resp.json();
      return json.data?.contributors || { active: [], inactive: [] };
    } catch {
      return { active: [], inactive: [] };
    }
  };

  const handleDecision = async (requestId, decision, studentData) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`http://192.168.100.15:3000/api/connection-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: decision
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update request');

      setRequests(prev => prev.filter(req => req.id !== requestId));

      if (decision === 'accepted') {
        setActiveConnections(prev => [
          ...prev,
          {
            studentUID: studentData.studentUID,
            studentEmail: studentData.studentEmail,
            supervisorUID: auth.currentUser.uid,
            supervisorEmail: auth.currentUser.email,
            createdAt: new Date(),
            status: 'active'
          }
        ]);
      }

      Alert.alert('Success', `Request ${decision} successfully`);
      
      if (requests.length <= 1) {
        navigation.replace('SupervisorApproval');
      }
    } catch (error) {
      console.error('Error handling decision:', error);
      Alert.alert('Error', `Failed to ${decision} request`);
    }
  };

  if (loading && !isRefreshing) {
    return (
      <View style={styles.center}>
        <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar backgroundColor="#4f46e5" barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Connections</Text>
        <Text style={styles.headerSubtitle}>Manage connection requests and repositories</Text>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={loading && isRefreshing}
            onRefresh={() => {
              fetchRequestsAndConnections();
              if (selectedStudent) refreshStudentRepos();
            }}
            colors={['#4f46e5']}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Section 1: Pending Requests */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <MaterialIcons name="pending-actions" size={22} color="#ffffff" />
              <Text style={styles.sectionTitle}>Pending Requests</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          </View>
          
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No pending requests</Text>
              <Text style={styles.emptyStateSubtext}>All connection requests have been processed</Text>
            </View>
          ) : (
            <FlatList
              data={requests}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <View style={styles.requestCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Ionicons name="person-outline" size={20} color="#4f46e5" />
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentEmail}>{item.studentEmail}</Text>
                      <Text style={styles.requestDate}>
                        Requested: {item.timestamp?.toLocaleString() || 'Unknown date'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.acceptButton]}
                      onPress={() => handleDecision(item.id, 'accepted', item)}
                    >
                      <Feather name="check" size={18} color="white" />
                      <Text style={styles.buttonText}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.rejectButton]}
                      onPress={() => handleDecision(item.id, 'rejected')}
                    >
                      <Feather name="x" size={18} color="white" />
                      <Text style={styles.buttonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* Section 2: Active Students */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <MaterialIcons name="people-alt" size={22} color="#ffffff" />
              <Text style={styles.sectionTitle}>Active Students</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeConnections.length}</Text>
            </View>
          </View>
          
          {selectedStudent ? (
            <View style={styles.detailContainer}>
              <View style={styles.detailHeader}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => { setSelectedStudent(null); setStudentRepos([]); }}
                >
                  <Ionicons name="arrow-back" size={20} color="#4f46e5" />
                  <Text style={styles.backLink}>Back to Students</Text>
                </TouchableOpacity>
                
                <View style={styles.studentInfo}>
                  <View style={[styles.avatar, styles.avatarLarge]}>
                    <Ionicons name="person-outline" size={24} color="#4f46e5" />
                  </View>
                  <View>
                    <Text style={styles.detailStudentEmail}>{selectedStudent.studentEmail}</Text>
                    <Text style={styles.studentStatus}>Active • Connected</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  onPress={refreshStudentRepos} 
                  disabled={isRefreshing}
                  style={styles.refreshButton}
                >
                  <Feather 
                    name="refresh-cw" 
                    size={18} 
                    color={isRefreshing ? '#cbd5e1' : '#4f46e5'} 
                  />
                  <Text style={[styles.refreshLink, isRefreshing && { color: '#cbd5e1' }]}>
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.sectionDivider}>
                <Text style={styles.subsectionTitle}>Repositories</Text>
              </View>
              
              {reposLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4f46e5" />
                  <Text style={styles.loadingText}>Loading repositories...</Text>
                </View>
              ) : (
                <FlatList
                  data={studentRepos}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.listContainer}
                  renderItem={({ item }) => (
                    <RepoCard item={item} fetchContributors={fetchContributors} onOpen={handleOpenRepo} />
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
                      <Text style={styles.emptyStateText}>No repositories found</Text>
                      <Text style={styles.emptyStateSubtext}>Student hasn't added any repositories yet</Text>
                    </View>
                  }
                />
              )}
            </View>
          ) : activeConnections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No active students</Text>
              <Text style={styles.emptyStateSubtext}>Approved students will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={activeConnections}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.activeCard} 
                  onPress={() => handleSelectStudent(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Ionicons name="person-outline" size={20} color="#10b981" />
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentEmail}>{item.studentEmail}</Text>
                      <Text style={styles.requestDate}>
                        Connected on: {item.createdAt?.toDate?.()?.toLocaleString?.() || new Date(item.createdAt).toLocaleString?.() || '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.viewDetails}>
                    <Text style={styles.viewDetailsText}>View repositories</Text>
                    <Ionicons name="chevron-forward" size={18} color="#4f46e5" />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Swipe down to refresh</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const RepoCard = ({ item, fetchContributors, onOpen }) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState({ active: [], inactive: [] });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const result = await fetchContributors(item.owner, item.name);
      if (mounted) {
        setGroups(result);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [item.owner, item.name]);

  return (
    <View style={styles.repoCard}>
      <View style={styles.repoHeader}>
        <View style={styles.repoIcon}>
          <Octicons name="repo" size={20} color="#4f46e5" />
        </View>
        <View style={styles.repoInfo}>
          <Text style={styles.repoName}>{item.name}</Text>
          <Text style={styles.repoMeta}>Owner: {item.owner}</Text>
        </View>
        {item.githubUrl && (
          <TouchableOpacity 
            style={styles.repoLinkButton}
            onPress={() => onOpen(item.githubUrl)}
          >
            <Ionicons name="open-outline" size={20} color="#4f46e5" />
          </TouchableOpacity>
        )}
      </View>
      
      {item.pendingApproval && (
        <View style={styles.pendingApproval}>
          <Ionicons name="time-outline" size={16} color="#d97706" />
          <Text style={styles.pendingApprovalText}>Pending supervisor approval</Text>
        </View>
      )}
      
      <View style={styles.contributorsSection}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="people-outline" size={16} color="#64748b" />
          <Text style={styles.contributorsTitle}>Contributors</Text>
        </View>
        
        {loading ? (
          <ActivityIndicator style={styles.contributorsLoading} color="#4f46e5" />
        ) : (
          <View style={styles.contributorsList}>
            <View style={styles.contributorType}>
              <View style={[styles.statusIndicator, styles.activeIndicator]} />
              <Text style={styles.contributorText}>
                Active ({groups.active.length}): {groups.active.length === 0 ? 'None' : groups.active.map(c => c.login).join(', ')}
              </Text>
            </View>
            
            <View style={styles.contributorType}>
              <View style={[styles.statusIndicator, styles.inactiveIndicator]} />
              <Text style={styles.contributorText}>
                Inactive ({groups.inactive.length}): {groups.inactive.length === 0 ? 'None' : 
                  groups.inactive.map(c => c.login + (c.pendingInvite ? ' (pending)' : '')).join(', ')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e7ff',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  badge: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginVertical: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 8,
  },
  requestCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  activeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentInfo: {
    flex: 1,
  },
  studentEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  studentStatus: {
    fontSize: 12,
    color: '#64748b',
  },
  requestDate: {
    fontSize: 13,
    color: '#64748b',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48%',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  detailContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  detailHeader: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  backLink: {
    color: '#4f46e5',
    fontWeight: '500',
    marginLeft: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    alignSelf: 'flex-end',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    marginTop: 8,
  },
  refreshLink: {
    color: '#4f46e5',
    fontWeight: '500',
    marginLeft: 6,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  viewDetailsText: {
    color: '#4f46e5',
    fontWeight: '500',
    marginRight: 4,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  repoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  repoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  repoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  repoInfo: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  repoMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  repoLinkButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
  },
  pendingApproval: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  pendingApprovalText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  contributorsSection: {
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contributorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 6,
  },
  contributorsLoading: {
    marginVertical: 8,
  },
  contributorsList: {
    marginTop: 4,
  },
  contributorType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  activeIndicator: {
    backgroundColor: '#10b981',
  },
  inactiveIndicator: {
    backgroundColor: '#64748b',
  },
  contributorText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    padding: 16,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

export default SupervisorConnectionRequestsScreen;