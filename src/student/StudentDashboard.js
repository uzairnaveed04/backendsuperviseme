import React, { useEffect, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image 
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  }
};

const StudentDashboard = ({ navigation }) => {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [reminderCountdown, setReminderCountdown] = useState('');
  const [reminderDeadline, setReminderDeadline] = useState(null);

  const theme = THEMES[selectedTheme];

  useEffect(() => {
    const user = auth.currentUser;
    if (user) setEmail(user.email);

    // Fetch upcoming reminder
    const fetchReminders = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'reminders'),
          where('studentEmail', '==', user.email)
        );
        const snapshot = await getDocs(q);
        const now = new Date();
        const upcoming = snapshot.docs
          .map(doc => doc.data())
          .filter(r => r.deadline && r.deadline.toDate() > now)
          .sort((a,b) => a.deadline.toDate() - b.deadline.toDate());

        if (upcoming.length > 0) setReminderDeadline(upcoming[0].deadline.toDate());
      } catch (err) {
        console.error('Error fetching reminders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, []);

  useEffect(() => {
    if (!reminderDeadline) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = reminderDeadline - now;
      if (diff <= 0) {
        setReminderCountdown('Deadline Passed!');
        clearInterval(interval);
        return;
      }
      const d = Math.floor(diff / (1000*60*60*24));
      const h = Math.floor((diff/(1000*60*60))%24);
      const m = Math.floor((diff/(1000*60))%60);
      const s = Math.floor((diff/1000)%60);
      setReminderCountdown(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [reminderDeadline]);

  const buttons = [
    { title: 'Project Tracking', screen: 'ProjectTracking', icon: 'bar-chart' },
    { title: 'Document Management', screen: 'DocumentManagement', icon: 'document' },
    { title: 'Communication Tool', screen: 'CommunicationTool', icon: 'chatbubbles' },
    { title: 'Prerequisite Subjects', screen: 'PrerequisiteSubjects', icon: 'book' },
    { title: 'Feedback & Evaluation', screen: 'FeedbackEvaluation', icon: 'thumbs-up' },
    { title: 'Task & Reward', screen: 'TaskReward', icon: 'checkbox' },
    { title: 'Automated Reminder', screen: 'AutomatedReminder', icon: 'alarm' },
  ];

  const handleLogout = () => navigation.replace('Login');

  if (loading) return <ActivityIndicator size="large" color={theme.primary} style={{flex:1, justifyContent:'center'}} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.navigate('ConnectionScreen')} style={[styles.githubButton, { backgroundColor: theme.card }]}>
            <Ionicons name="logo-github" size={20} color={theme.text} />
            <Text style={[styles.githubText, { color: theme.text }]}>Login</Text>
          </TouchableOpacity>
          <View style={{flex:1, alignItems:'center'}}>
            <Text style={[styles.headerText, { color:  '#ff4444'}]}>Student Portal</Text>
            <Text style={[styles.subHeader, { color: '#ff4444' }]}>{email ? email.split('@')[0] : 'Loading...'}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedTheme(selectedTheme==='light'?'dark':'light')} style={[styles.themeButton, { backgroundColor: theme.card }]}>
            <Ionicons name={selectedTheme==='light'?'moon':'sunny'} size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Reminder */}
        {reminderCountdown ? (
          <View style={[styles.reminderContainer, { backgroundColor: selectedTheme==='dark'?'#ff8a80':'#ff5252' }]}>
            <Ionicons name="alarm" size={20} color="#FFF" style={{marginRight:10}} />
            <Text style={styles.reminderText}>Reminder: {reminderCountdown}</Text>
          </View>
        ) : null}

        {/* Cards */}
        <View style={styles.cardsContainer}>
  {buttons.map((btn, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate(btn.screen)}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
         <Ionicons name={btn.icon} size={20} color="red" />

        </View>
        <Text style={[styles.cardText, { color: theme.text }]}>{btn.title}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.secondary}
        style={{ opacity: 0.7 }}
      />
    </TouchableOpacity>
  ))}
</View>


        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#e9150aff' }]} onPress={handleLogout}>

          <Ionicons name="log-out" size={20} color="#FFF" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{flex:1},
  scrollContainer:{paddingHorizontal:20,paddingBottom:40,paddingTop:40},
  headerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:25},
  headerText:{fontSize:24,fontWeight:'800',letterSpacing:0.5},
  subHeader:{fontSize:15,marginTop:2,opacity:0.7, fontWeight: '500',},
  githubButton:{flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:6,borderRadius:20,borderWidth:1,borderColor:'#00000020'},
  githubText:{marginLeft:5,fontSize:13,fontWeight:'500'},
  cardsContainer:{marginBottom:20},
  card:{borderRadius:35,padding:18,marginBottom:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between',shadowOffset:{width:0,height:5},shadowOpacity:0.1,shadowRadius:10,elevation:5},
  cardContent:{flexDirection:'row',alignItems:'center',flex:1},
  iconContainer:{padding:10,borderRadius:10,marginRight:15,justifyContent:'center',alignItems:'center',width:40,height:40,  backgroundColor: 'transparent',},
  cardText:{fontSize:18,fontWeight:'600',flex:1},
  reminderContainer:{marginVertical:10,marginBottom:20,paddingHorizontal:18,paddingVertical:10,borderRadius:14,flexDirection:'row',alignItems:'center',shadowOffset:{width:0,height:3},shadowOpacity:0.35,shadowRadius:6,elevation:8,borderWidth:1.5,borderColor:'#fff4'},
  reminderText:{fontWeight:'bold',color:'#fff',fontSize:16,letterSpacing:0.5},
  logoutButton:{borderRadius:12,padding:16,flexDirection:'row',alignItems:'center',justifyContent:'center',marginTop:15,shadowOffset:{width:0,height:5},shadowOpacity:0.3,shadowRadius:5,elevation:6},
  logoutText:{color:'white',fontWeight:'bold',fontSize:16,marginLeft:10},
  themeButton:{padding:8,borderRadius:20,shadowOffset:{width:0,height:2},shadowOpacity:0.2,shadowRadius:4,elevation:3},
});

export default StudentDashboard;
