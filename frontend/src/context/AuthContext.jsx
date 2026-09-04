import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Initialize state synchronously to avoid the set-state-in-effect issue
  // and prevent an unnecessary second render.
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("userInfo");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [loading] = useState(false);

  const login = async (phone, otp) => {
    const { data } = await api.post("/auth/verify-otp", { phone, otp });
    setUser(data);
    localStorage.setItem("userInfo", JSON.stringify(data));
    return data;
  };

  const doctorLogin = async (phone, otp) => {
    const { data } = await api.post("/auth/verify-doctor-otp", { phone, otp });
    setUser(data);
    localStorage.setItem("userInfo", JSON.stringify(data));
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("userInfo");
  };

  return (
    <AuthContext.Provider value={{ user, login, doctorLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
