// Import Firebase modules (use the version compatible with your setup)
import { getAuth } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

// Firebase Realtime Database reference
const db = getDatabase();

// Function to save user data to Firebase Realtime Database
function saveUserData(userId, name, email, phone) {
  set(ref(db, 'users/' + userId), {
    name: name,
    email: email,
    phone: phone,
    // Add any other data you want to save here
  })
  .then(() => {
    console.log("User data saved successfully!");
  })
  .catch((error) => {
    console.error("Error saving user data:", error);
  });
}

// This function should be called after the user is successfully created
function handleUserSignUp() {
  // Get the logged-in user (from Firebase Authentication)
  const auth = getAuth();
  const user = auth.currentUser;  // This is the authenticated user object

  if (user) {
    // Get user data from the form (assuming the form elements are available)
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;

    // Save user data to Firebase Realtime Database
    saveUserData(user.uid, name, email, phone);
  } else {
    console.log("No user is currently signed in.");
  }
}

// Call this function after registration is successful
// For example, you can call it after a successful `createUserWithEmailAndPassword` if you have that logic already in place
handleUserSignUp();
