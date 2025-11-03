// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { LogBox } from 'react-native';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Missing or insufficient permissions',
  '@firebase/firestore',
]);

// Enable native screens for performance
enableScreens();

// Import Context Providers
import { ProjectProvider as StudentProjectProvider } from './src/student/ProjectTrackingContext';
import { ProjectProvider as SupervisorProjectProvider } from './src/supervisor/ProjectContext';

// Import Screens
import WelcomeScreen from './WelcomeScreen';
import Starting from './Starting';
import Login from './src/student/Login';
import Sinup from './src/student/Sinup';
import StudentDashboard from './src/student/StudentDashboard';
import ProjectTracking from './src/student/ProjectTracking';
import CommunicationTool from './src/student/CommunicationTool';
import ChatsScreen from './src/student/ChatsScreen';
import FeedbackEvaluation from './src/student/FeedbackEvaluation';
import TaskReward from './src/student/TaskReward';
import StudentWeeklyLogScreen from './src/student/StudentWeeklyLogScreen';
import AutomatedReminder from './src/student/AutomatedReminder';
import PrerequisiteSubjects from './src/student/PrerequisiteSubjects';
import GitHubAuth from './src/student/GitHubAuth';
import ConnectionScreen from './src/student/ConnectionScreen';
import DocumentManagement from './src/student/DocumentManagement';

// Supervisor Screens
import SLogin from './src/supervisor/SLogin';
import SupervisorDashboard from './src/supervisor/SupervisorDashboard';
import SupervisorProjectTracking from './src/supervisor/SupervisorProjectTracking';
import Communication from './src/supervisor/Communication';
import SChatScreen from './src/supervisor/SChatScreen';
import SFeedbackEvaluation from './src/supervisor/SFeedbackEvaluation';
import SupervisorTaskManagement from './src/supervisor/SupervisorTaskManagement';
import StudentKanbanBoard from './src/supervisor/StudentKanbanBoard';
import SupervisorAutomatedReminder from './src/supervisor/SupervisorAutomatedReminder';
import SupervisorChgPass from './src/supervisor/SupervisorChgPass';
import GitHubLogin from './src/supervisor/GitHubLogin';
import SupervisorDocument from './src/supervisor/SupervisorDoucment';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    // Wrap app in both providers so both student & supervisor contexts are available
    <SupervisorProjectProvider>
      <StudentProjectProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Starting" screenOptions={{ headerShown: false }}>
            {/* Student Screens */}
            <Stack.Screen name="Starting" component={Starting} />
            <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
            <Stack.Screen name="Sinup" component={Sinup} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
            <Stack.Screen name="ProjectTracking" component={ProjectTracking} />
            <Stack.Screen name="CommunicationTool" component={CommunicationTool} />
            <Stack.Screen name="ChatsScreen" component={ChatsScreen} />
            <Stack.Screen name="AutomatedReminder" component={AutomatedReminder} />
            <Stack.Screen name="TaskReward" component={TaskReward} />
            <Stack.Screen name="StudentWeeklyLogScreen" component={StudentWeeklyLogScreen} />
            <Stack.Screen name="PrerequisiteSubjects" component={PrerequisiteSubjects} />
            <Stack.Screen name="FeedbackEvaluation" component={FeedbackEvaluation} />
            <Stack.Screen name="GitHubAuth" component={GitHubAuth} />
             <Stack.Screen name="ConnectionScreen" component={ConnectionScreen} />
            <Stack.Screen name="DocumentManagement" component={DocumentManagement} /> 

            {/* Supervisor Screens */}
            <Stack.Screen name="SLogin" component={SLogin} />
            <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard} />
            <Stack.Screen name="SupervisorProjectTracking" component={SupervisorProjectTracking} />
            <Stack.Screen name="Communication" component={Communication} />
            <Stack.Screen name="SChatScreen" component={SChatScreen} />
            <Stack.Screen name="SupervisorTaskManagement" component={SupervisorTaskManagement} />
            <Stack.Screen name="SupervisorAutomatedReminder" component={SupervisorAutomatedReminder} />
            <Stack.Screen name="SupervisorChgPass" component={SupervisorChgPass} />
            <Stack.Screen name="SFeedbackEvaluation" component={SFeedbackEvaluation} />
            <Stack.Screen name="StudentKanbanBoard" component={StudentKanbanBoard} />
             <Stack.Screen name="GitHubLogin" component={GitHubLogin} /> 
            <Stack.Screen name="SupervisorDocument" component={SupervisorDocument} /> 
          </Stack.Navigator>
        </NavigationContainer>
      </StudentProjectProvider>
    </SupervisorProjectProvider>
  );
};

export default App;
