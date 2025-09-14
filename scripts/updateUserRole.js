const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

// Firebase configuration (same as your project)
const firebaseConfig = {
  // Add your Firebase config here
  // You can find this in your Firebase project settings
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateUserRole(userId, newRole) {
  try {
    // Get current user data
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      console.log('Current user data:', userData);
      
      // Update the role
      await updateDoc(userRef, {
        role: newRole
      });
      
      console.log(`Successfully updated user role to: ${newRole}`);
    } else {
      console.log('User not found!');
    }
  } catch (error) {
    console.error('Error updating user role:', error);
  }
}

// Usage: Replace 'YOUR_USER_ID' with your actual Firebase Auth UID
// and 'operatore' with the desired role
const userId = 'YOUR_USER_ID'; // Replace with your Firebase Auth UID
const newRole = 'operatore';

updateUserRole(userId, newRole);
