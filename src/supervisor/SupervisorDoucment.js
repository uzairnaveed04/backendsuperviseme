import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import RNFS from "react-native-fs";
import FileViewer from "react-native-file-viewer";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";

const { width, height } = Dimensions.get("window");

const SupervisorFilesScreen = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supervisorEmail, setSupervisorEmail] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Premium Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const headerScale = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(headerScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  // ✅ Get logged-in supervisor email
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setSupervisorEmail(user.email);
      } else {
        setSupervisorEmail(null);
        setFiles([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ Fetch files for this supervisor only
  const fetchFiles = async (isRefresh = false) => {
    if (!supervisorEmail) return;
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const res = await fetch(
        `http://192.168.10.8:3000/api/supervisor/files?supervisorEmail=${encodeURIComponent(
          supervisorEmail
        )}`
      );
      const data = await res.json();

      if (data.success) {
        setFiles(data.files || []);
      } else {
        Alert.alert("❌ Error", data.message || "Failed to fetch files");
      }
    } catch (err) {
      console.error("Error fetching files:", err);
      Alert.alert("❌ Error", "Failed to load files. Please check your network.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (supervisorEmail) {
      fetchFiles();
    }
  }, [supervisorEmail]);

  // ✅ Handle file download and opening
  const handleDownload = async (file) => {
    try {
      setDownloadingFile(file.filename);

      if (Platform.OS === "android") {
        try {
          await RNFS.mkdir(RNFS.DocumentDirectoryPath);
        } catch (err) {
          console.log("Directory creation error:", err);
        }
      }

      const fileUrl = `http://192.168.10.8:3000/api/supervisor/download?studentEmail=${encodeURIComponent(
        file.studentEmail
      )}&filename=${encodeURIComponent(file.filename)}`;
      const safeName = file.originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const localFile = `${RNFS.DocumentDirectoryPath}/${safeName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: fileUrl,
        toFile: localFile,
      }).promise;

      if (downloadResult.statusCode === 200) {
        showFancyAlert("🎉 Success", "File downloaded successfully!");
        FileViewer.open(localFile).catch((err) => {
          Alert.alert("Success", "File downloaded but could not be opened automatically.");
        });
      } else {
        Alert.alert("❌ Error", "Failed to download file");
      }
    } catch (err) {
      console.error("Download error:", err);
      Alert.alert("❌ Error", "Something went wrong while downloading");
    } finally {
      setDownloadingFile(null);
    }
  };

  const showFancyAlert = (title, message) => {
    Alert.alert(title, message, [{ text: "OK", style: "default" }], {
      cancelable: true,
    });
  };

  const getFileIcon = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    const iconMap = {
      pdf: "document-text",
      doc: "document",
      docx: "document",
      xls: "document",
      xlsx: "document",
      ppt: "document",
      pptx: "document",
      jpg: "image",
      jpeg: "image",
      png: "image",
      gif: "image",
      bmp: "image",
      zip: "archive",
      rar: "archive",
      tar: "archive",
      gz: "archive",
    };
    return iconMap[ext] || "document";
  };

  const getFileColor = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    const colorMap = {
      pdf: "#FF6B6B",
      doc: "#4DABF7",
      docx: "#4DABF7",
      xls: "#51CF66",
      xlsx: "#51CF66",
      ppt: "#FF922B",
      pptx: "#FF922B",
      jpg: "#F06595",
      jpeg: "#F06595",
      png: "#F06595",
      gif: "#F06595",
      bmp: "#F06595",
      zip: "#9775FA",
      rar: "#9775FA",
      tar: "#9775FA",
      gz: "#9775FA",
    };
    return colorMap[ext] || "#6366F1";
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const FileCard = ({ item, index }) => (
    <Animated.View
      style={[
        styles.fileCard,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={["#FFFFFF", "#F8FAFC"]}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* File Header */}
        <View style={styles.fileHeader}>
          <View
            style={[styles.fileIconContainer, { backgroundColor: `${getFileColor(item.originalName)}15` }]}
          >
            <Ionicons
              name={getFileIcon(item.originalName)}
              size={28}
              color={getFileColor(item.originalName)}
            />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={2}>
              {decodeURIComponent(item.originalName)}
            </Text>
            <View style={styles.fileMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="analytics" size={14} color="#64748B" />
                <Text style={styles.metaText}>{formatFileSize(item.size || 0)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={14} color="#64748B" />
                <Text style={styles.metaText}>
                  {new Date(item.uploadedAt || Date.now()).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Student Info */}
        <View style={styles.studentInfo}>
          <View style={styles.studentHeader}>
            <Ionicons name="person-circle" size={18} color="#6366F1" />
            <Text style={styles.studentLabel}>Student</Text>
          </View>
          <Text style={styles.studentEmail} numberOfLines={1}>
            {item.studentEmail}
          </Text>
        </View>

        {/* Download Button */}
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => handleDownload(item)}
          disabled={downloadingFile === item.filename}
        >
          <LinearGradient
            colors={["#8B5CF6", "#6366F1"]}
            style={styles.downloadBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {downloadingFile === item.filename ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="download" size={20} color="#FFFFFF" />
                <Text style={styles.btnText}>Download & Open</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  // ✅ Loading screen
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#6366F1" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={["#8B5CF6", "#6366F1"]}
            style={styles.loadingIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="folder-open" size={50} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.loadingText}>Loading your files...</Text>
          <Text style={styles.loadingSubtext}>Preparing your documents</Text>
        </View>
      </View>
    );
  }

  // ✅ Not logged-in
  if (!supervisorEmail) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#6366F1" barStyle="light-content" />
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={["#FF6B6B", "#FF8787"]}
            style={styles.errorIconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="lock-closed" size={50} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Text style={styles.errorMessage}>Please login to access your files</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#6366F1" barStyle="light-content" />

      {/* 🔥 Premium Header */}
      <Animated.View style={{ transform: [{ scale: headerScale }] }}>
        <LinearGradient
          colors={['#FF9800', '#FF9800']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="folder-open" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>My Files</Text>
                <Text style={styles.headerSubtitle}>Document Management</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <LinearGradient
                colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]}
                style={styles.fileCount}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.fileCountNumber}>{files.length}</Text>
                <Text style={styles.fileCountLabel}>Files</Text>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {files.length === 0 ? (
          /* 🎨 Premium Empty State */
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={["#F8FAFC", "#FFFFFF"]}
              style={styles.emptyContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document" size={80} color='#FF9800' />
              </View>
              <Text style={styles.emptyTitle}>No Files Yet</Text>
              <Text style={styles.emptyMessage}>Files uploaded by your students will appear here</Text>
              <TouchableOpacity style={styles.refreshButton} onPress={() => fetchFiles()}>
                <LinearGradient
                  colors={['#FF9800', '#FF9800']}
                  style={styles.refreshButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="refresh" size={22} color="#FFFFFF" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          /* 💎 Premium Files List */
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Recent Uploads</Text>
              <TouchableOpacity
                style={styles.refreshButtonSmall}
                onPress={() => fetchFiles(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Ionicons name="refresh" size={20} color="#6366F1" />
                )}
              </TouchableOpacity>
            </View>

            <FlatList
              data={files}
              keyExtractor={(item) => item.filename}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item, index }) => <FileCard item={item} index={index} />}
              refreshing={refreshing}
              onRefresh={() => fetchFiles(true)}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    // Removed shadow properties
  },
  loadingText: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1E293B",
  },
  loadingSubtext: {
    fontSize: 16,
    textAlign: "center",
    color: "#64748B",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    // Removed shadow properties
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#1E293B",
  },
  errorMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    color: "#64748B",
  },
  // 🔥 Premium Header
  header: {
    paddingTop: 25,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    // Removed shadow properties
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    // Removed shadow properties
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.1)", // Kept text shadow as it's not icon shadow
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#E0E7FF",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  fileCount: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    // Removed shadow properties
  },
  fileCountNumber: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 24,
  },
  fileCountLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  // 🎨 Premium Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyContent: {
    alignItems: "center",
    padding: 40,
    borderRadius: 30,
    width: "100%",
    maxWidth: 400,
    // Removed shadow properties
  },
  emptyIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#1E293B",
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    color: "#64748B",
  },
  refreshButton: {
    borderRadius: 16,
    overflow: "hidden",
    // Removed shadow properties
  },
  refreshButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 10,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  // 💎 Premium Files List
  listContainer: {
    flex: 1,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E293B",
  },
  refreshButtonSmall: {
    padding: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    // Removed shadow properties
  },
  flatListContent: {
    paddingBottom: 20,
  },
  // ✨ Premium File Cards
  fileCard: {
    borderRadius: 25,
    overflow: "hidden",
    marginBottom: 20,
    // Removed shadow properties
  },
  cardGradient: {
    padding: 25,
    overflow: "hidden",
  },
  fileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  fileIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 18,
    // Removed shadow properties
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    lineHeight: 24,
    color: "#1E293B",
  },
  fileMeta: {
    flexDirection: "row",
    gap: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  studentInfo: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: "#F1F5F9",
  },
  studentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  studentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
  },
  studentEmail: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1E293B",
  },
  downloadBtn: {
    borderRadius: 16,
    overflow: "hidden",
    // Removed shadow properties
  },
  downloadBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  btnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default SupervisorFilesScreen;