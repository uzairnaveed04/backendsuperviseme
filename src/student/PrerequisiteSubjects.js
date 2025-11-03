import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import CheckBox from "@react-native-community/checkbox";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import * as Animatable from "react-native-animatable";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";

const { width } = Dimensions.get("window");

const THEMES = {
  light: {
    primary: "#6366F1",
    secondary: "#8B5CF6",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1E293B",
    accent: "#EC4899",
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
    muted: "#94A3B8",
  },
};

const PrerequisiteSubjects = ({ navigation }) => {
  const [subjects, setSubjects] = useState([]);
  const [checkedMap, setCheckedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [userId, setUserId] = useState(null);

  const theme = THEMES.light;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setErrorMsg("User not logged in");
        setLoading(false);
        return;
      }

      setUserId(user.uid);

      const fetchSubjects = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
          const docRef = doc(db, "requiredSubjectsV2", "list1");
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const subjectsData = data.subjects || [];
            setSubjects(subjectsData);

            if (data.studentSubjects && data.studentSubjects[user.uid]) {
              const studentData = data.studentSubjects[user.uid];

              const allFalse = Object.values(studentData.checkedMap || {}).every(
                (val) => val === false
              );

              if (allFalse) {
                const initial = {};
                subjectsData.forEach((sbj) => (initial[sbj] = false));
                setCheckedMap(initial);
                setAlreadySubmitted(false);
              } else {
                setCheckedMap(studentData.checkedMap || {});
                setAlreadySubmitted(true);
              }
            } else {
              const initial = {};
              subjectsData.forEach((sbj) => (initial[sbj] = false));
              setCheckedMap(initial);
              setAlreadySubmitted(false);
            }
          } else {
            console.warn("No requiredSubjectsV2/list1 document found");
            setSubjects([]);
          }
        } catch (err) {
          console.error("🔥 Firestore read error:", err);
          setErrorMsg(err?.message || String(err));
        } finally {
          setLoading(false);
        }
      };

      fetchSubjects();
    });

    return () => unsub();
  }, []);

  const toggle = (subject) => {
    if (alreadySubmitted) return;
    setCheckedMap((prev) => ({ ...prev, [subject]: !prev[subject] }));
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.elastic(2),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSubmit = async () => {
    animateButton();

    const anySelected = Object.values(checkedMap).some((val) => val);

    if (!anySelected) {
      setErrorMsg("⚠️ Please select at least one subject before submitting.");
      return;
    }

    if (!userId) return;

    try {
      const docRef = doc(db, "requiredSubjectsV2", "list1");

      await updateDoc(docRef, {
        [`studentSubjects.${userId}`]: {
          checkedMap,
          submittedAt: new Date().toISOString(),
        },
      });

      setSubmitStatus("success");
      setAlreadySubmitted(true);

      // ✅ ADDED NAVIGATION
      // This line navigates the user to the dashboard and prevents them from returning to this screen.
      navigation.replace('StudentDashboard');

    } catch (err) {
      console.error("🔥 Firestore save error:", err);
      setErrorMsg(err?.message || String(err));
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[theme.primary, theme.secondary]}
        style={styles.loadingContainer}
      >
        <Animatable.View 
          animation="pulse" 
          iterationCount="infinite"
          style={styles.loadingContent}
        >
          <View style={styles.loadingIconContainer}>
            <Ionicons name="book" size={60} color="#FFF" />
          </View>
          <ActivityIndicator size="large" color="#FFF" style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Loading Subjects...</Text>
          <Text style={styles.loadingSubtext}>Preparing your academic profile</Text>
        </Animatable.View>
      </LinearGradient>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[theme.background, "#F1F5F9"]}
        style={styles.background}
      >
        
        {/* Enhanced Header */}
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerBackground}>
            <View style={styles.headerOrb1} />
            <View style={styles.headerOrb2} />
          </View>
          <Animatable.View 
            animation="fadeInDown" 
            duration={800}
            style={styles.headerContent}
          >
            <View style={styles.headerIconContainer}>
              <Ionicons name="school" size={32} color="#FFF" />
            </View>
            <Text style={styles.title}>
              Select Your Cleared Subjects
            </Text>
            <Text style={styles.subtitle}>
              {alreadySubmitted
                ? "✅ You have already submitted your subjects"
                : "Mark all subjects you've successfully completed"}
            </Text>
          </Animatable.View>
        </LinearGradient>

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >

          {errorMsg && (
            <Animatable.View
              animation="fadeIn"
              style={styles.errorBanner}
            >
              <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={24} color="#FFF" />
              </View>
              <Text style={styles.errorText}>Error: {errorMsg}</Text>
            </Animatable.View>
          )}

          {subjects.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.emptyIconContainer}
              >
                <Ionicons name="document-text-outline" size={64} color={theme.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No subjects found</Text>
              <Text style={styles.emptySubtitle}>
                Check your Firestore database structure
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.subjectsContainer}>
                {subjects.map((subject, index) => (
                  <Animatable.View
                    key={subject}
                    animation="fadeInRight"
                    duration={600}
                    delay={index * 100}
                    style={[
                      styles.card,
                      checkedMap[subject] && styles.checkedCard,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.cardTouchable}
                      onPress={() => toggle(subject)}
                      disabled={alreadySubmitted}
                      activeOpacity={0.7}
                    >
                      <View style={styles.checkboxContainer}>
                        <CheckBox
                          value={checkedMap[subject]}
                          onValueChange={() => toggle(subject)}
                          tintColors={{ true: theme.success, false: theme.muted }}
                          onTintColor={theme.success}
                          onCheckColor="#FFF"
                          boxType="circle"
                          style={styles.checkbox}
                          disabled={alreadySubmitted}
                        />
                      </View>
                      
                      <Text style={[
                        styles.label,
                        checkedMap[subject] && styles.checkedLabel
                      ]}>
                        {subject}
                      </Text>
                      
                      {checkedMap[subject] && (
                        <Animatable.View 
                          animation="bounceIn" 
                          style={styles.checkIconContainer}
                        >
                          <LinearGradient
                            colors={[theme.success, '#34D399']}
                            style={styles.successBadge}
                          >
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#FFF"
                            />
                          </LinearGradient>
                        </Animatable.View>
                      )}
                    </TouchableOpacity>
                  </Animatable.View>
                ))}
              </View>
            </>
          )}

          {!alreadySubmitted && subjects.length > 0 && (
            <Animated.View style={[styles.buttonContainer, { transform: [{ scale: buttonScale }] }]}>
              <TouchableOpacity onPress={handleSubmit} activeOpacity={0.8}>
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.buttonIconContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  </View>
                  <Text style={styles.buttonText}>Submit Subjects</Text>
                  <View style={styles.buttonArrow}>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {submitStatus && (
            <Animatable.View
              animation={submitStatus === "success" ? "bounceIn" : "shake"}
              style={[
                styles.statusBanner,
                submitStatus === "success" ? styles.successBanner : styles.errorBanner,
              ]}
            >
              <View style={styles.statusIconContainer}>
                <Ionicons
                  name={submitStatus === "success" ? "checkmark-done-circle" : "alert-circle"}
                  size={28}
                  color="#FFF"
                />
              </View>
              <Text style={styles.statusText}>
                {submitStatus === "success"
                  ? "✅ You are eligible for the program!"
                  : "❌ Please complete all required subjects"}
              </Text>
            </Animatable.View>
          )}
        </ScrollView>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 35,
  },
  background: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
    padding: 40,
  },
  loadingIconContainer: {
    marginBottom: 20,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  loadingSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
  },
  headerGradient: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerOrb1: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerOrb2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    alignItems: "center",
    zIndex: 1,
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  subjectsContainer: {
    marginTop: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  checkedCard: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF9",
    shadowColor: "#10B981",
  },
  cardTouchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  checkboxContainer: {
    marginRight: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
  },
  label: {
    fontSize: 16,
    color: "#1E293B",
    flex: 1,
    fontWeight: "500",
  },
  checkedLabel: {
    color: "#065F46",
    fontWeight: "600",
  },
  checkIconContainer: {
    marginLeft: "auto",
  },
  successBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContainer: {
    marginTop: 30,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonIconContainer: {
    marginRight: 12,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 18,
  },
  buttonArrow: {
    marginLeft: 12,
    opacity: 0.8,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  successBanner: {
    backgroundColor: "#10B981",
  },
  errorBanner: {
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  statusIconContainer: {
    marginRight: 12,
  },
  errorIconContainer: {
    marginRight: 12,
  },
  statusText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
    flex: 1,
  },
  errorText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    color: "#1E293B",
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default PrerequisiteSubjects;