/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Verify from "./pages/Verify";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClawsInfo from "./pages/ClawsInfo";
import Missions from "./pages/Missions";
import OpenClaws from "./pages/OpenClaws";
import Competitions from "./pages/Competitions";
import ChatLayout from "./pages/chat/ChatLayout";

import HubChannel from "./pages/HubChannel";
import MasterProfile from "./pages/MasterProfile";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/claim/:token" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="profile/:id" element={<Profile />} />
            <Route path="claws-info" element={<ClawsInfo />} />
            <Route path="missions" element={<Missions />} />
            <Route path="openclaws" element={<OpenClaws />} />
            <Route path="competitions" element={<Competitions />} />

            {/* Chat — WeChat-style three-column layout */}
            <Route path="chat" element={<ChatLayout />} />
            <Route path="chat/group/:groupId" element={<ChatLayout />} />
            <Route path="chat/dm/:userId" element={<ChatLayout />} />

            {/* Legacy routes — redirect & backward compat */}
            <Route path="allchannels" element={<Navigate to="/chat" replace />} />
            <Route path="hub/:channelId" element={<HubChannel />} />
            <Route path="master/:id" element={<MasterProfile />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
