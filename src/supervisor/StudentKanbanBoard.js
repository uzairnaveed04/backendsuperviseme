import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // adjust path to your firebase config

import * as Progress from 'react-native-progress';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';

const KanbanBoard = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const supervisorEmail = user?.email;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const screenWidth = Dimensions.get('window').width;

  const columnWidth = Math.min(screenWidth * 0.85, 360);
  const totalColumnsWidth = columnWidth * 3 + 60;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }),
    ]).start();
  }, []);

  const normalizeEmail = (email) => {
    if (!email) return '';
    return email
      .toLowerCase()
      .trim()
      .replace('cualet.edu.pk', 'cuiatk.edu.pk')
      .replace('culatk.edu.pk', 'cuiatk.edu.pk');
  };

  useEffect(() => {
    if (!supervisorEmail) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('createdBy', '==', supervisorEmail)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedTasks = [];
        querySnapshot.forEach((doc) => {
          const taskData = doc.data();
          fetchedTasks.push({
            id: doc.id,
            ...taskData,
            assignedTo: normalizeEmail(taskData.assignedTo),
            status: taskData.status?.toString().toLowerCase().trim() || 'to do',
            initialStatus:
              taskData.initialStatus?.toString()?.toLowerCase?.().trim?.() ||
              taskData.status?.toString().toLowerCase().trim() ||
              'to do',
          });
        });
        setTasks(fetchedTasks);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching tasks:', error);
        Alert.alert('Error', 'Failed to fetch tasks.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [supervisorEmail]);

  const filterTasks = (status) => {
    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus === 'to do') {
      return tasks.filter(
        (task) => task.initialStatus?.toLowerCase().trim() === 'to do'
      );
    }

    if (normalizedStatus === 'in progress') {
      return tasks.filter(
        (task) =>
          task.initialStatus?.toLowerCase().trim() === 'to do' &&
          task.status?.toLowerCase().trim() !== 'completed'
      );
    }

    if (normalizedStatus === 'completed') {
      return tasks.filter(
        (task) => task.status?.toLowerCase().trim() === 'completed'
      );
    }

    return [];
  };

  const renderColumn = (status, title, iconName, gradientColors) => {
    const filteredTasks = filterTasks(status);

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={600}
        delay={150}
        style={[styles.column, { width: columnWidth }]}
      >
        <LinearGradient
          colors={gradientColors}
          style={styles.columnHeaderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.columnHeader}>
            <View style={styles.headerIconContainer}>
              <Ionicons name={iconName} size={24} color="white" />
            </View>
            <Text style={styles.columnHeaderText}>{title}</Text>
            <View style={styles.taskCountBadge}>
              <Text style={styles.taskCountText}>{filteredTasks.length}</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.tasksScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tasksContainer}
        >
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={54} color="#E6EAF8" />
              <Text style={styles.emptyText}>No tasks here yet</Text>
              <Text style={styles.emptySubText}>
                Tasks will appear here automatically
              </Text>
            </View>
          ) : (
            filteredTasks.map((task, index) => (
              <Animatable.View
                key={task.id}
                animation="bounceIn"
                duration={650}
                delay={index * 80}
                style={[styles.taskCard, { shadowColor: gradientColors[1] }]}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View
                    style={[styles.statusIndicator, { backgroundColor: gradientColors[1] }]}
                  />
                </View>

                {task.description ? (
                  <Text style={styles.taskDescription}>{task.description}</Text>
                ) : null}

                <View style={styles.taskMetaContainer}>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={14} color="#666" />
                    <Text style={styles.taskMeta}>{task.assignedTo || 'Unassigned'}</Text>
                  </View>

                  {status === 'completed' && task.updatedAt ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.taskMeta}>
                        {task.updatedAt.toDate
                          ? task.updatedAt.toDate().toLocaleDateString()
                          : String(task.updatedAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>Progress</Text>
                    <Text style={styles.progressPercentage}>
                      {task.status?.toLowerCase() === 'completed'
                        ? '100%'
                        : task.status?.toLowerCase() === 'in progress'
                        ? '50%'
                        : '0%'}
                    </Text>
                  </View>
                  <Progress.Bar
                    progress={
                      task.status?.toLowerCase() === 'completed'
                        ? 1
                        : task.status?.toLowerCase() === 'in progress'
                        ? 0.5
                        : 0
                    }
                    width={null}
                    unfilledColor="#EEF2FF"
                    borderWidth={0}
                    height={10}
                    borderRadius={12}
                    animated
                  />
                </View>
              </Animatable.View>
            ))
          )}
        </ScrollView>
      </Animatable.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#667eea" />
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Loading your tasks...</Text>
          <Text style={styles.loadingSubText}>Getting everything ready</Text>
        </Animatable.View>
      </LinearGradient>
    );
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <LinearGradient colors={['#FF9800', '#FF9800']} style={styles.headerGradient}>
        <Animatable.View animation="fadeInDown" duration={800} style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>🚀 Task Kanban Board</Text>
            <Text style={styles.headerSubtitle}>Manage your team's workflow</Text>
          </View>
          {/* Export button removed */}
        </Animatable.View>
      </LinearGradient>

      <ScrollView
        horizontal
        contentContainerStyle={[styles.columnsContainer, { width: totalColumnsWidth }]}
        showsHorizontalScrollIndicator={false}
        snapToInterval={columnWidth + 20}
        decelerationRate="fast"
        style={styles.scrollView}
      >
        {renderColumn('to do', 'To Do', 'rocket-outline', ['#FF9800', '#FF5722'])}
        {renderColumn('in progress', 'In Progress', 'time-outline', ['#2196F3', '#1976D2'])}
        {renderColumn('completed', 'Completed', 'checkmark-done-outline', ['#4CAF50', '#388E3C'])}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContent: { alignItems: 'center' },
  loadingText: { marginTop: 18, color: 'white', fontSize: 18, fontWeight: '600' },
  loadingSubText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: 'white', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.95)' },
  scrollView: { paddingVertical: 18 },
  columnsContainer: { paddingHorizontal: 20, paddingBottom: 18 },
  column: { marginRight: 20, backgroundColor: 'white', borderRadius: 18, minHeight: 520, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8, overflow: 'hidden' },
  columnHeaderGradient: { padding: 18 },
  columnHeader: { flexDirection: 'row', alignItems: 'center' },
  headerIconContainer: { backgroundColor: 'rgba(255,255,255,0.18)', padding: 8, borderRadius: 10, marginRight: 12 },
  columnHeaderText: { fontSize: 18, fontWeight: 'bold', color: 'white', flex: 1 },
  taskCountBadge: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  taskCountText: { color: 'white', fontSize: 13, fontWeight: '700' },
  tasksScrollView: { flex: 1 },
  tasksContainer: { padding: 14 },
  taskCard: { backgroundColor: 'white', padding: 16, borderRadius: 14, marginBottom: 12, borderLeftWidth: 0, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  taskTitle: { fontWeight: '700', fontSize: 15, color: '#2C3E50', flex: 1, marginRight: 8 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  taskDescription: { fontSize: 14, color: '#555', marginBottom: 10, lineHeight: 20 },
  taskMetaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  taskMeta: { fontSize: 13, color: '#666', marginLeft: 6 },
  progressContainer: { marginTop: 6 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: '#666', fontWeight: '500' },
  progressPercentage: { fontSize: 12, color: '#333', fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { fontSize: 15, color: '#B0B3C6', fontWeight: '600', marginTop: 14 },
  emptySubText: { fontSize: 13, color: '#B0B3C6', marginTop: 4 },
});

export default KanbanBoard;
