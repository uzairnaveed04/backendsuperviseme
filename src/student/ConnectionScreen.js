import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity 
} from 'react-native';
import {  db } from '../../firebaseConfig';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';

export default function StudentConnectionRequestScreen() {
  const auth = getAuth();
  const navigation = useNavigation();
  const [studentEmail, setStudentEmail] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser?.email) {
        setStudentEmail(auth.currentUser.email); // Set the email from auth
        
        try {
          // Use backend API to check student status
          const token = await auth.currentUser.getIdToken();
          console.log('🔍 Making API call to check student status...');
          console.log('🔗 URL: https://backendsuperviseme.vercel.app/api/student/status');

          const response = await fetch('https://backendsuperviseme.vercel.app/api/student/status', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('📊 Response status:', response.status);
          console.log('📊 Response headers:', response.headers);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API Error: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          console.log('✅ API Response:', result);

          if (result.success) {
            const hasActiveConnection = result.data.hasActiveConnection;
            const hasPendingRequest = result.data.hasPendingRequest;
            const hasAny = hasActiveConnection || hasPendingRequest;

            setHasPendingRequest(hasAny);

            // If already requested or connected, go straight to GitHub auth
            if (hasAny) {
              console.log('🔄 Student already has connection/request, navigating to GitHubAuth');
              try {
                navigation.replace('GitHubAuth');
              } catch (e) {
                console.error('Navigation error:', e);
              }
              return;
            }
          } else {
            console.error('Failed to check student status:', result.error);
          }
        } catch (error) {
          console.error('Error checking requests:', error);
          console.log('🔄 API failed, assuming no existing connections (continue to connection screen)');

          // If API fails, assume no existing connections and let user proceed
          setHasPendingRequest(false);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [auth.currentUser]);

 const sendRequest = async () => {
  if (!supervisorEmail.trim()) {
    Alert.alert('Error', 'Please enter supervisor email.');
    return;
  }

  try {
    setIsLoading(true);

    console.log('🚀 Sending connection request...');
    console.log('- Student UID:', auth.currentUser.uid);
    console.log('- Student Email:', auth.currentUser.email);
    console.log('- Supervisor Email:', supervisorEmail.trim().toLowerCase());

    // Add student UID to the request
    const supervisorEmailLower = supervisorEmail.trim().toLowerCase();
    const requestData = {
      studentUID: auth.currentUser.uid,
      studentEmail: auth.currentUser.email,
      supervisorEmail: supervisorEmailLower,
      status: 'pending',
      createdAt: new Date(),
      // Add these fields for better querying
      safeStudentEmail: auth.currentUser.email.replace(/\./g, '_').replace(/@/g, '_'),
      safeSupervisorEmail: supervisorEmailLower.replace(/\./g, '_').replace(/@/g, '_')
    };

    console.log('📄 Request data:', requestData);

    // Use backend API instead of direct Firebase
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('https://backendsuperviseme.vercel.app/api/connection-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        supervisorEmail: supervisorEmailLower
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to send request');
    }

    console.log('✅ Request sent successfully with ID:', result.requestId);

    setHasPendingRequest(true);
    setIsLoading(false); // Stop loading immediately after success

    console.log('🔄 About to show success alert and navigate to GitHubAuth');

    Alert.alert(
      'Success',
      'Connection request sent to supervisor!',
      [
        {
          text: 'Continue to GitHub Setup',
          onPress: () => {
            console.log('🚀 Continue button pressed, navigating to GitHubAuth...');
            setTimeout(() => {
              try {
                navigation.navigate('GitHubAuth');
                console.log('✅ Navigation to GitHubAuth successful');
              } catch (navError) {
                console.error('❌ Navigation error:', navError);
                // Try alternative navigation methods
                try {
                  navigation.push('GitHubAuth');
                  console.log('✅ Navigation via push successful');
                } catch (pushError) {
                  console.error('❌ Push navigation also failed:', pushError);
                }
              }
            }, 100); // Small delay to ensure alert closes
          }
        },
        {
          text: 'Stay Here',
          style: 'cancel'
        }
      ]
    );
  } catch (error) {
    console.error('❌ Error sending request:', error);
    alert(
      'Error',
      `Could not send request: ${error.message}`,
      [
        {
          text: 'Retry',
          onPress: () => setIsLoading(false)
        }
      ]
    );
  } finally {
    setIsLoading(false);
  }
};

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If a request/connection exists, we're navigating away; keep a minimal loader as fallback
  if (hasPendingRequest) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heroTitle}>Connect with your Supervisor</Text>
      <Text style={styles.heroSubtitle}>Send a one‑time request to get started</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your Email</Text>
        <Text style={styles.email}>{studentEmail || 'Not available'}</Text>

        <Text style={[styles.label, { marginTop: 10 }]}>Supervisor Email</Text>
        <TextInput
          style={styles.input}
          placeholder="supervisor@university.edu"
          value={supervisorEmail}
          onChangeText={setSupervisorEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#9aa1a9"
        />

        <TouchableOpacity style={[styles.primaryButton, !studentEmail && styles.disabled]} onPress={sendRequest} disabled={!studentEmail}>
          <Text style={styles.primaryButtonText}>Send Connection Request</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f6f8fa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#24292e',
    marginTop: 8
  },
  heroSubtitle: {
    color: '#6a737d',
    marginBottom: 16,
    marginTop: 4
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#24292e',
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    color: '#586069',
    textAlign: 'center'
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
    color: '#24292e'
  },
  email: {
    fontSize: 16,
    marginBottom: 20,
    color: '#0366d6',
    fontWeight: '600',
    padding: 10,
    backgroundColor: '#f6f8fa',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#d1d5da'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    fontSize: 16,
    color: '#24292e'
  },
  primaryButton: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.6
  }
});