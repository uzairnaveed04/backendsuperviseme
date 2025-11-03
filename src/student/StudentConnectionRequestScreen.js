import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';

const StudentConnectionRequestScreen = (props) => {
  // ...existing code...

  let auth = null;
  try {
    auth = typeof getAuth === 'function' ? getAuth() : null;
  } catch (err) {
    console.warn('getAuth not available:', err);
    auth = null;
  }

  // Use auth?.currentUser when checking user or calling methods like getIdToken()

  // ...existing code...
};

export default StudentConnectionRequestScreen;