import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import ChatPdf from "./PDFChatPage";
import LandingPage from "./LandingPage";


function App() {

  const API_URL = process.env.REACT_APP_API_URL;
  const [token, setToken] = useState(
    localStorage.getItem("app_token")
  );


  const onLoginSuccess = async (credentialResponse) => {
    try {
      // 1. Send Google ID token to backend
      const res = await fetch(
        `${API_URL}/auth/google`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_token: credentialResponse.credential,
          }),
        }
      );

      if (!res.ok) throw new Error("Auth failed");

      // 2. Receive APP JWT
      const data = await res.json();

      // 3. Store APP JWT (NOT google token)
      localStorage.setItem("app_token", data.access_token);
      setToken(data.access_token);
    } catch (err) {
      alert("Login failed");
    }
  };


  const logout = () => {
    localStorage.removeItem("app_token");
    localStorage.removeItem("chatSession");
    setToken(null);
  };



  if (!token) {
    return <LandingPage onLoginSuccess={onLoginSuccess} />;
  }


  return <ChatPdf onLogout={logout} />;
}

export default App;
